<#
.SYNOPSIS
  Stop exactly the processes that scripts\start-all.ps1 started.

.DESCRIPTION
  R-02. Reads tests\.out\start-all\pids.json. A recorded PID is stopped (with
  its child processes) only if a process with that PID still exists AND has the
  start time recorded by start-all, so a reused PID is never touched. Anything
  else listening on the Patina ports is reported, never stopped.

  One exception, for the frontend only: when start-all recorded the frontend's
  launcher but never recorded its listener PID (start-all was interrupted or
  timed out before the dev server answered, and the npm launcher has since
  exited, so the tree cannot be reached from it), the node.exe process that is
  listening on the frontend's port (3000) is stopped by port.

  Exit 0 when every recorded process is gone; 1 otherwise.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $repo 'tests\.out\start-all\pids.json'

if (-not (Test-Path $pidFile)) {
  Write-Host 'stop-all: nothing to stop (no tests\.out\start-all\pids.json; start-all has not started anything).'
  exit 0
}

function Get-StartStamp([int]$id) {
  try { return (Get-Process -Id $id -ErrorAction Stop).StartTime.ToFileTimeUtc() } catch { return $null }
}

function Test-Ours($id, $stamp) {
  if (-not $id -or -not $stamp) { return $false }
  return ((Get-StartStamp ([int]$id)) -eq [long]$stamp)
}

# PS 5.1 emits a JSON array as one object; ForEach-Object enumerates it.
$records = @((Get-Content -Raw $pidFile | ConvertFrom-Json) | ForEach-Object { $_ })

foreach ($r in $records) {
  # Launcher first (/T takes its children, usually including the listener);
  # the listener is re-checked so an already-gone PID is skipped.
  foreach ($pair in @(@($r.launcherPid, $r.launcherStart), @($r.listenPid, $r.listenStart))) {
    if (Test-Ours $pair[0] $pair[1]) {
      # taskkill writes to stderr when a child exits mid-kill; PS 5.1 would
      # turn that into a terminating error under 'Stop', so relax it here.
      $ErrorActionPreference = 'Continue'
      & taskkill.exe /PID ([int]$pair[0]) /T /F 2>&1 | Out-Null
      $ErrorActionPreference = 'Stop'
    }
  }
}

# Frontend fallback: no listener PID was recorded, so stop the dev server by its port.
# Only node.exe listeners are stopped; anything else on the port is left and reported.
$stoppedByPort = @()
foreach ($r in @($records | Where-Object { $_.service -eq 'frontend' -and -not $_.listenPid })) {
  $holders = @(Get-NetTCPConnection -LocalPort ([int]$r.port) -State Listen -ErrorAction SilentlyContinue |
      ForEach-Object { [int]$_.OwningProcess } | Select-Object -Unique)
  foreach ($h in $holders) {
    $name = try { (Get-Process -Id $h -ErrorAction Stop).ProcessName } catch { '' }
    if ($name -ne 'node') { continue }
    $ErrorActionPreference = 'Continue'
    & taskkill.exe /PID $h /T /F 2>&1 | Out-Null
    $ErrorActionPreference = 'Stop'
    $stoppedByPort += $h
  }
}
if ($stoppedByPort.Count -gt 0) {
  Write-Host "stop-all: frontend listener PID was not recorded; stopped node.exe PID $($stoppedByPort -join ',') listening on port 3000."
}

# Wait up to 15 s for every recorded process to be gone (and the by-port stop to free the port).
$deadline = (Get-Date).AddSeconds(15)
do {
  $remaining = @($records | Where-Object {
      (Test-Ours $_.launcherPid $_.launcherStart) -or (Test-Ours $_.listenPid $_.listenStart)
    })
  $portHeld = @($stoppedByPort | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue })
  if ($remaining.Count -eq 0 -and $portHeld.Count -eq 0) { break }
  Start-Sleep -Milliseconds 500
} while ((Get-Date) -lt $deadline)

$table = foreach ($r in $records) {
  $stillOurs = (Test-Ours $r.launcherPid $r.launcherStart) -or (Test-Ours $r.listenPid $r.listenStart)
  $holders = @(Get-NetTCPConnection -LocalPort ([int]$r.port) -State Listen -ErrorAction SilentlyContinue |
      ForEach-Object { $_.OwningProcess } | Select-Object -Unique)
  [pscustomobject]@{
    Service = $r.service
    Port    = $r.port
    Stopped = if ($stillOurs) { 'no' } else { 'yes' }
    PortNow = if ($holders.Count -eq 0) { 'free' } else { "in use by PID $($holders -join ',') (not stopped by this script)" }
  }
}
Write-Host ($table | Format-Table -AutoSize | Out-String).TrimEnd()

if (@($table | Where-Object { $_.Stopped -eq 'no' }).Count -gt 0) {
  Write-Host 'stop-all: FAILED: some recorded processes are still running; pids.json kept.'
  exit 1
}

Remove-Item -Force $pidFile
Write-Host 'stop-all: done.'
exit 0
