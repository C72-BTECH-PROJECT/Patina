<#
.SYNOPSIS
  Start all Patina processes the verified way and wait until each is healthy.

.DESCRIPTION
  R-02 (REBUILD/DECISIONS.md section 1). Starts, from the repo root:
    nlp-engine          :8000  nlp-engine\venv, loopback, offline model load (~15 s); then
                               one warm-up parse of a synthetic fixture must answer 200 (R-38)
    github-evidence     :8001  github-evidence\venv, loopback
    assessment-service  :8002  assessment-service\.venv (python -m app), loopback
    core (backend)      :5001  node index.js, loopback (HOST default 127.0.0.1)
    gateway             :5000  node index.js, the only entry point
    frontend (dev)      :3000  npm start (skip with -NoFrontend)

  Commands are the ones verified in REBUILD/inventory/baseline.md section 2.
  Each service's stdout/stderr goes to tests\.out\start-all\<service>.*.log
  (git-ignored). The PIDs started are recorded in tests\.out\start-all\pids.json
  so scripts\stop-all.ps1 stops exactly those processes and nothing else.

  This script never prints environment values. It prints one status table and
  exits 1 naming every service that did not come up; in that case it stops what
  it started (unless -KeepOnFailure).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-all.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-all.ps1 -NoFrontend
#>
[CmdletBinding()]
param(
  [switch]$NoFrontend,
  [switch]$KeepOnFailure
)

$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$runDir = Join-Path $repo 'tests\.out\start-all'
$pidFile = Join-Path $runDir 'pids.json'
New-Item -ItemType Directory -Force $runDir | Out-Null

$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source

# Health URLs use 127.0.0.1 because the loopback-only services do not listen on
# every address that "localhost" can resolve to.
$services = @(
  [ordered]@{ Name = 'nlp-engine'; Port = 8000; Dir = 'nlp-engine'; Loopback = $true; TimeoutSec = 180
    Exe = (Join-Path $repo 'nlp-engine\venv\Scripts\python.exe')
    Args = @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000')
    # Deterministic set ordering (ISSUES I-0015) and no model downloads at start.
    Env = @{ PYTHONHASHSEED = '0'; HF_HUB_OFFLINE = '1'; TRANSFORMERS_OFFLINE = '1' }
    Health = 'http://127.0.0.1:8000/' },
  [ordered]@{ Name = 'github-evidence'; Port = 8001; Dir = 'github-evidence'; Loopback = $true; TimeoutSec = 60
    Exe = (Join-Path $repo 'github-evidence\venv\Scripts\python.exe')
    Args = @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8001')
    Env = @{}
    Health = 'http://127.0.0.1:8001/health' },
  [ordered]@{ Name = 'assessment-service'; Port = 8002; Dir = 'assessment-service'; Loopback = $true; TimeoutSec = 60
    Exe = (Join-Path $repo 'assessment-service\.venv\Scripts\python.exe')
    Args = @('-m', 'app')
    # app/config.py reads these (its .env load does not override process env).
    Env = @{ ASSESSMENT_HOST = '127.0.0.1'; ASSESSMENT_PORT = '8002' }
    Health = 'http://127.0.0.1:8002/' },
  [ordered]@{ Name = 'core'; Port = 5001; Dir = 'backend'; Loopback = $true; TimeoutSec = 60
    Exe = $node; Args = @('index.js'); Env = @{}
    Health = 'http://127.0.0.1:5001/api/health' },
  [ordered]@{ Name = 'gateway'; Port = 5000; Dir = 'gateway'; Loopback = $false; TimeoutSec = 60
    Exe = $node; Args = @('index.js'); Env = @{}
    Health = 'http://127.0.0.1:5000/health' }
)
if (-not $NoFrontend) {
  $services += [ordered]@{ Name = 'frontend'; Port = 3000; Dir = 'frontend'; Loopback = $false; TimeoutSec = 240
    Exe = $npm; Args = @('start'); Env = @{ BROWSER = 'none' }
    Health = 'http://127.0.0.1:3000/' }
}

function Get-Listeners([int]$port) {
  @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

# Returns the body text of a 2xx answer, or $null for anything else.
function Get-HealthBody([string]$url) {
  try {
    $req = [System.Net.HttpWebRequest]::Create($url)
    $req.Proxy = $null
    $req.Timeout = 3000
    $req.ReadWriteTimeout = 3000
    $resp = $req.GetResponse()
    $code = [int]$resp.StatusCode
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $text = $reader.ReadToEnd()
    $reader.Close()
    $resp.Close()
    if ($code -ge 200 -and $code -lt 300) { return [string]$text }
    return $null
  } catch {
    return $null
  }
}

# R-38 warm parse helper (Invoke-WarmParse), shared with scripts\warm-nlp.ps1.
. (Join-Path $PSScriptRoot 'nlp-warm.lib.ps1')

# R-03/R-04: a 2xx health body that says status "degraded" (core: database check failed).
function Test-Degraded([string]$text) {
  try { return ((ConvertFrom-Json $text).status -eq 'degraded') } catch { return $false }
}

function Get-StartStamp([int]$id) {
  try { return (Get-Process -Id $id -ErrorAction Stop).StartTime.ToFileTimeUtc() } catch { return $null }
}

function Test-Descendant([int]$childId, [int]$ancestorId) {
  if ($childId -eq $ancestorId) { return $true }
  $parents = @{}
  foreach ($p in (Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId)) {
    $parents[[int]$p.ProcessId] = [int]$p.ParentProcessId
  }
  $cur = $childId
  for ($i = 0; $i -lt 12; $i++) {
    if (-not $parents.ContainsKey($cur)) { return $false }
    $cur = $parents[$cur]
    if ($cur -eq $ancestorId) { return $true }
    if ($cur -eq 0) { return $false }
  }
  return $false
}

function Save-Records($records) {
  $data = @($records | ForEach-Object {
      [ordered]@{
        service = $_.Name; port = $_.Port
        launcherPid = $_.LauncherPid; launcherStart = $_.LauncherStart
        listenPid = $_.ListenPid; listenStart = $_.ListenStart
      }
    })
  ConvertTo-Json -InputObject $data -Depth 4 | Set-Content -Encoding ASCII $pidFile
}

# --- Refuse to start on top of a previous run or a busy port ---------------
if (Test-Path $pidFile) {
  $alive = @()
  foreach ($r in @((Get-Content -Raw $pidFile | ConvertFrom-Json) | ForEach-Object { $_ })) {
    foreach ($pair in @(@($r.launcherPid, $r.launcherStart), @($r.listenPid, $r.listenStart))) {
      if ($pair[0] -and $pair[1] -and ((Get-StartStamp ([int]$pair[0])) -eq [long]$pair[1])) { $alive += $r.service; break }
    }
  }
  if ($alive.Count -gt 0) {
    Write-Host "start-all: FAILED: a previous start-all run is still running ($((($alive | Select-Object -Unique) -join ', '))). Run scripts\stop-all.ps1 first."
    exit 1
  }
  Remove-Item -Force $pidFile
}

$problems = @()
foreach ($s in $services) {
  if (-not $s.Exe -or -not (Test-Path $s.Exe)) {
    $problems += "$($s.Name): interpreter not found ($(if ($s.Exe) { $s.Exe } else { 'node/npm not on PATH' }))"
  }
  $busy = @(Get-Listeners $s.Port)   # @() is required: a function returning one object unrolls it, and .Count is empty in PowerShell 5.1
  if ($busy.Count -gt 0) {
    $problems += "$($s.Name): port $($s.Port) is already in use by PID $(($busy.OwningProcess | Select-Object -Unique) -join ',') (not started by this script)"
  }
}
if ($problems.Count -gt 0) {
  Write-Host 'start-all: FAILED before starting anything:'
  $problems | ForEach-Object { Write-Host "  $_" }
  exit 1
}

# --- Start -----------------------------------------------------------------
$records = @()
$failed = @()
try {
  foreach ($s in $services) {
    $saved = @{}
    foreach ($k in $s.Env.Keys) {
      $saved[$k] = [Environment]::GetEnvironmentVariable($k, 'Process')
      [Environment]::SetEnvironmentVariable($k, $s.Env[$k], 'Process')
    }
    try {
      $p = Start-Process -FilePath $s.Exe -ArgumentList $s.Args -PassThru -WindowStyle Hidden `
        -WorkingDirectory (Join-Path $repo $s.Dir) `
        -RedirectStandardOutput (Join-Path $runDir "$($s.Name).out.log") `
        -RedirectStandardError (Join-Path $runDir "$($s.Name).err.log")
    } finally {
      foreach ($k in $saved.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k], 'Process') }
    }
    $null = $p.Handle  # keep the handle so ExitCode is readable if it dies early
    $records += [pscustomobject]@{
      Name = $s.Name; Port = $s.Port; Spec = $s; Proc = $p
      LauncherPid = $p.Id; LauncherStart = (Get-StartStamp $p.Id)
      ListenPid = $null; ListenStart = $null
      State = 'starting'; Bind = ''; Note = ''; Degraded = $false
      Deadline = (Get-Date).AddSeconds($s.TimeoutSec)
    }
    Save-Records $records
  }

  # --- Wait for health -----------------------------------------------------
  while (@($records | Where-Object { $_.State -eq 'starting' }).Count -gt 0) {
    foreach ($r in @($records | Where-Object { $_.State -eq 'starting' })) {
      $own = @()
      $healthBody = Get-HealthBody $r.Spec.Health
      if ($null -ne $healthBody) {
        # Only core's own status is read: the gateway's aggregate is often 'degraded'
        # for a moment while the slower Python services are still loading.
        if ($r.Name -eq 'core') { $r.Degraded = Test-Degraded $healthBody }
        $own = @(Get-Listeners $r.Port | Where-Object { Test-Descendant ([int]$_.OwningProcess) $r.LauncherPid })
        if ($own.Count -eq 0) {
          # Something else took the port after the free-port check; keep
          # waiting for our own process, and say so if the deadline passes.
          $r.Note = 'port answered, but not by the process this script started'
        }
      }
      if ($own.Count -gt 0) {
        $r.ListenPid = [int]$own[0].OwningProcess
        $r.ListenStart = Get-StartStamp $r.ListenPid
        $addrs = @($own | ForEach-Object { $_.LocalAddress } | Select-Object -Unique)
        $r.Bind = $addrs -join ','
        $nonLoop = @($addrs | Where-Object { $_ -ne '127.0.0.1' -and $_ -ne '::1' })
        if ($r.Spec.Loopback -and $nonLoop.Count -gt 0) {
          $r.State = 'down'; $r.Note = 'listening on a non-loopback address'
        } else {
          $r.State = 'up'
        }
        Save-Records $records
      } elseif ($r.Proc.HasExited) {
        $r.State = 'down'
        $r.Note = "process exited (code $($r.Proc.ExitCode))" + $(if ($r.Note) { "; $($r.Note)" } else { '' })
      } elseif ((Get-Date) -gt $r.Deadline) {
        $r.State = 'down'
        $r.Note = if ($r.Note) { "$($r.Note) (waited $($r.Spec.TimeoutSec) s)" } else { "no healthy answer within $($r.Spec.TimeoutSec) s" }
      }
    }
    if (@($records | Where-Object { $_.State -eq 'starting' }).Count -gt 0) { Start-Sleep -Milliseconds 1000 }
  }

  # --- R-38: warm parse ----------------------------------------------------
  $nlp = $records | Where-Object { $_.Name -eq 'nlp-engine' -and $_.State -eq 'up' } | Select-Object -First 1
  if ($nlp) {
    $warm = Invoke-WarmParse 'http://127.0.0.1:8000/parse' (Join-Path $repo 'tests\fixtures\f3_support_nogithub.pdf') 120000
    if ($warm.Code -eq 200) {
      Write-Host "start-all: nlp-engine warm-up parse answered 200 in $($warm.Seconds) s"
    } else {
      $nlp.State = 'down'
      $nlp.Note = "the warm-up parse answered $(if ($warm.Code) { "HTTP $($warm.Code)" } else { 'nothing' }) after $($warm.Seconds) s"
    }
  }
  $failed = @($records | Where-Object { $_.State -ne 'up' })
} catch {
  Write-Host "start-all: FAILED while starting: $($_.Exception.Message)"
  $failed = @($records | Where-Object { $_.State -ne 'up' })
  if ($failed.Count -eq 0) { $failed = @([pscustomobject]@{ Name = 'start-all'; Port = ''; Note = 'script error' }) }
}

# --- Report ----------------------------------------------------------------
$table = foreach ($s in $services) {
  $r = $records | Where-Object { $_.Name -eq $s.Name } | Select-Object -First 1
  [pscustomobject]@{
    Service = $s.Name
    Port    = $s.Port
    Status  = if ($r -and $r.State -eq 'up') { if ($r.Degraded) { 'degraded' } else { 'up' } } else { 'down' }
    Bind    = if ($r) { $r.Bind } else { '' }
    PID     = if ($r) { $r.LauncherPid } else { '' }
  }
}
Write-Host ($table | Format-Table -AutoSize | Out-String).TrimEnd()

if ($failed.Count -gt 0) {
  Write-Host ''
  foreach ($f in $failed) {
    Write-Host "start-all: FAILED: $($f.Name) did not come up on port $($f.Port): $($f.Note). Logs: tests\.out\start-all\$($f.Name).err.log"
    # The service's own reason (e.g. core's SESSION_SECRET rule) is in its error log;
    # show its last line here. Services log rule names there, never values.
    $errLog = Join-Path $runDir "$($f.Name).err.log"
    if (Test-Path $errLog) {
      $last = Get-Content $errLog -Tail 20 -ErrorAction SilentlyContinue | Where-Object { $_.Trim() } | Select-Object -Last 1
      if ($last) { Write-Host "start-all:   last line of $($f.Name).err.log: $($last.Trim())" }
    }
  }
  if ($KeepOnFailure) {
    Write-Host 'start-all: processes left running (-KeepOnFailure); stop them with scripts\stop-all.ps1'
  } else {
    Write-Host 'start-all: stopping what this run started'
    & (Join-Path $PSScriptRoot 'stop-all.ps1') | Out-Null
  }
  exit 1
}

Write-Host ''
$degraded = @($records | Where-Object { $_.Degraded })
if ($degraded.Count -gt 0) {
  Write-Host "start-all: WARNING: $(($degraded | ForEach-Object { $_.Name }) -join ', ') answered 'degraded' (core: its database check failed). Processes are up; see the service log."
}
Write-Host 'start-all: all services up. Entry point: http://localhost:5000 (stop with scripts\stop-all.ps1)'
exit 0
