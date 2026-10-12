<#
.SYNOPSIS
  Run the T-0001 black-box harness against the baseline worktree or the
  current working tree.

.EXAMPLE
  powershell -File tests\run-suite.ps1 -Target baseline
  powershell -File tests\run-suite.ps1 -Target baseline -Suites nlp
  powershell -File tests\run-suite.ps1 -Target baseline -Suites backend -Live

.NOTES
  baseline = ..\patina-baseline (git worktree at 32905c1), ports NLP 8100 / backend 5100.
             Ports come from the worktree's copied backend\.env (PORT, NLP_PARSE_URL),
             because backend\Config\supabase.js loads .env with override:true.
  current  = this repo, ports NLP 8000 / backend 5000 (HEAD hardcodes both).
  -Live adds tests\backend\live-analyze.test.mjs, which writes to the shared
  Supabase project (scoped to the t0001_ test accounts; see tests\README.md).
  Logs go to tests\.out\ (git-ignored).
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet('baseline', 'current')][string]$Target,
  [ValidateSet('nlp', 'backend', 'frontend')][string[]]$Suites = @('nlp', 'backend', 'frontend'),
  [switch]$Live
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$tests = $PSScriptRoot
$out = Join-Path $tests '.out'
New-Item -ItemType Directory -Force $out | Out-Null

if ($Target -eq 'baseline') {
  $tree = Join-Path (Split-Path -Parent $repo) 'patina-baseline'
  $nlpPort = 8100; $bePort = 5100
} else {
  $tree = $repo
  $nlpPort = 8000; $bePort = 5000
}
if (-not (Test-Path $tree)) { throw "Tree not found: $tree (create it with: git worktree add ../patina-baseline 32905c1)" }

$python = Join-Path $repo 'nlp-engine\venv\Scripts\python.exe'
$nlpUrl = "http://127.0.0.1:$nlpPort"
$beUrl = "http://localhost:$bePort"
$started = @()
$results = [ordered]@{}

function Wait-Http([string]$url, [int]$timeoutSec) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -eq 200) { return $true }
    } catch { Start-Sleep -Seconds 2 }
  }
  return $false
}

function Stop-Tree($proc) {
  if ($proc -and -not $proc.HasExited) { & taskkill.exe /PID $proc.Id /T /F | Out-Null }
}

$needNlp = ($Suites -contains 'nlp') -or ($Suites -contains 'backend')
$needBackend = $Suites -contains 'backend'

try {
  if ($needNlp) {
    Write-Host "== starting NLP ($Target) on $nlpPort"
    # Deterministic set ordering (see ISSUES I-0015) and no model downloads.
    $env:PYTHONHASHSEED = '0'; $env:HF_HUB_OFFLINE = '1'; $env:TRANSFORMERS_OFFLINE = '1'
    $p = Start-Process -FilePath $python -PassThru -WindowStyle Hidden `
      -WorkingDirectory (Join-Path $tree 'nlp-engine') `
      -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', "$nlpPort") `
      -RedirectStandardOutput (Join-Path $out "$Target-nlp.out.log") `
      -RedirectStandardError (Join-Path $out "$Target-nlp.err.log")
    $started += $p
    if (-not (Wait-Http "$nlpUrl/" 240)) { throw "NLP did not become healthy on $nlpUrl (see tests\.out\$Target-nlp.err.log)" }
  }

  if ($needBackend) {
    Write-Host "== starting backend ($Target) on $bePort"
    $p = Start-Process -FilePath 'node' -PassThru -WindowStyle Hidden `
      -WorkingDirectory (Join-Path $tree 'backend') -ArgumentList @('index.js') `
      -RedirectStandardOutput (Join-Path $out "$Target-backend.out.log") `
      -RedirectStandardError (Join-Path $out "$Target-backend.err.log")
    $started += $p
    if (-not (Wait-Http "$beUrl/api/health" 60)) { throw "Backend did not become healthy on $beUrl (see tests\.out\$Target-backend.*.log)" }
  }

  if ($Suites -contains 'nlp') {
    Write-Host "== NLP suite"
    $env:NLP_BASE_URL = $nlpUrl; $env:SNAPSHOT_LABEL = $Target
    & $python -m pytest (Join-Path $tests 'nlp') -v -p no:cacheprovider 2>&1 | Tee-Object (Join-Path $out "$Target-pytest.log")
    $results['nlp'] = $LASTEXITCODE
  }

  if ($Suites -contains 'backend') {
    Write-Host "== backend suite"
    $env:BACKEND_BASE_URL = $beUrl
    $files = @((Join-Path $tests 'backend\smoke.test.mjs'))
    if ($Live) {
      $files += (Join-Path $tests 'backend\live-analyze.test.mjs')
      # Cross-user authorization tests (T-0004..T-0007); they skip if the second accounts are not in tests\.env.
      foreach ($f in 'live-shortlist-authz', 'live-notifications-authz') {
        $files += (Join-Path $tests "backend\$f.test.mjs")
      }
    }
    & node --test --test-concurrency=1 @files 2>&1 | Tee-Object (Join-Path $out "$Target-backend-tests.log")
    $results['backend'] = $LASTEXITCODE
  }

  if ($Suites -contains 'frontend') {
    Write-Host "== frontend build (CI=true)"
    $env:CI = 'true'
    Push-Location (Join-Path $tree 'frontend')
    try {
      & cmd.exe /c "npm run build 2>&1" | Tee-Object (Join-Path $out "$Target-frontend-build.log")
      $results['frontend'] = $LASTEXITCODE
    } finally { Pop-Location; Remove-Item Env:CI }
  }
} finally {
  foreach ($p in $started) { Stop-Tree $p }
}

Write-Host "`n== summary ($Target): exit codes (0 = pass)"
$results.GetEnumerator() | ForEach-Object { Write-Host ("  {0,-9} {1}" -f $_.Key, $_.Value) }
if ($results.Values | Where-Object { $_ -ne 0 }) { exit 1 } else { exit 0 }
