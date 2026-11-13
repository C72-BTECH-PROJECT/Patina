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
  current  = this repo, ports NLP 8000 / backend core 5001 (127.0.0.1) / gateway 5000 (I-0080:
             the gateway is the public entry on 5000, core sits behind it on 5001).
             The backend suite talks to core directly (BACKEND_BASE_URL = core): its black-box
             tests assert core's own answers, which the gateway's deny-by-default would mask.
  gateway  = (current only, R-01) starts core and the gateway, then runs every
             tests\gateway\*.test.mjs: the offline ones (in-process app, stub upstreams) and
             live-*.test.mjs against the started gateway (GATEWAY_BASE_URL). Writes nothing.
  Every port the run needs must be free before it starts; the script refuses to test a process
  it did not start, and stops everything it started.
  -Live adds tests\backend\live-analyze.test.mjs (current only since R-10: upload, apply,
  score-again), which writes to the shared Supabase project (scoped to the t0001_ test
  accounts; see tests\README.md).
  backend (current only, T-0014): explainability + github-evidence-client unit tests and the
             assessment route-guard smoke (T-0023) always; -Live adds live-analyze-github.test.mjs,
             which binds a github-evidence stub on :8001, and assessment-evaluate-live.test.mjs.
  docs    = tests\docs\check-trackers.mjs (T-0008): CHECKLIST/AUDIT/CLAUDE.md drift check.
             Read-only, starts no services, always checks the current repo's files.
  github   = tests\github (T-0011): the github-evidence service against recorded and synthetic
             GitHub responses only. Own venv (github-evidence\venv), own pytest call, no services
             started, and pytest-socket blocks every non-loopback connection. Skipped for baseline.
  assessment = tests\assessment (T-0029): assessment-service in process (TestClient, no port, no LLM):
             docs off, 127.0.0.1:8002 bind. Own venv (assessment-service\.venv), own pytest call.
             Skipped for baseline.
  backend (T-0029): migration-guards, signup-profile and grading-claim (offline) always; -Live adds
             live-resume-authz, live-answer-key-access, live-evaluate-once (needs :8002),
             live-evaluate-release (runs only with :8002 down) and live-signup-role (needs M1 applied).
  backend (T-0031): upload-limits, applicant-identity, assessment-service-client and backend-cruft
             (offline) always; -Live adds live-applicants (needs applicant_emails pushed) and
             live-upload-gates.
  Logs go to tests\.out\ (git-ignored).
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet('baseline', 'current')][string]$Target,
  [ValidateSet('nlp', 'backend', 'gateway', 'frontend', 'docs', 'github', 'assessment')][string[]]$Suites = @('nlp', 'backend', 'gateway', 'frontend', 'docs', 'github', 'assessment'),
  [switch]$Live
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$tests = $PSScriptRoot
$out = Join-Path $tests '.out'
New-Item -ItemType Directory -Force $out | Out-Null

if ($Target -eq 'baseline') {
  $tree = Join-Path (Split-Path -Parent $repo) 'patina-baseline'
  $nlpPort = 8100; $bePort = 5100; $gwPort = $null
} else {
  $tree = $repo
  $nlpPort = 8000; $bePort = 5001; $gwPort = 5000
}
if (-not (Test-Path $tree)) { throw "Tree not found: $tree (create it with: git worktree add ../patina-baseline 32905c1)" }

$python = Join-Path $repo 'nlp-engine\venv\Scripts\python.exe'
$nlpUrl = "http://127.0.0.1:$nlpPort"
# Core binds 127.0.0.1 (R-02); the literal address avoids a localhost -> ::1 miss.
$beUrl = "http://127.0.0.1:$bePort"
$gwUrl = if ($gwPort) { "http://127.0.0.1:$gwPort" } else { $null }
$started = @()
$results = [ordered]@{}

function Assert-PortFree([int]$port, [string]$what) {
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
    throw "Port $port ($what) is already in use. Stop that process first: the harness only tests processes it started."
  }
}

# Start a child with extra environment variables visible to it only (restored afterwards), so
# e.g. the gateway's PORT=5000 never leaks into core.
function Start-Child([string]$file, [string[]]$argv, [string]$cwd, [string]$log, [hashtable]$vars = @{}) {
  $saved = @{}
  foreach ($k in $vars.Keys) { $saved[$k] = [Environment]::GetEnvironmentVariable($k, 'Process'); [Environment]::SetEnvironmentVariable($k, [string]$vars[$k], 'Process') }
  try {
    return Start-Process -FilePath $file -PassThru -WindowStyle Hidden -WorkingDirectory $cwd -ArgumentList $argv `
      -RedirectStandardOutput (Join-Path $out "$log.out.log") -RedirectStandardError (Join-Path $out "$log.err.log")
  } finally {
    foreach ($k in $saved.Keys) { [Environment]::SetEnvironmentVariable($k, $saved[$k], 'Process') }
  }
}

# Healthy only if the URL answers 200 AND the process we started is still running: if the port
# was taken between Assert-PortFree and the start, our child exits (EADDRINUSE) and a 200 would
# come from someone else's process.
function Wait-Http([string]$url, [int]$timeoutSec, $proc = $null) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    if ($proc -and $proc.HasExited) { return $false }
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -eq 200) {
        Start-Sleep -Seconds 1
        return -not ($proc -and $proc.HasExited)
      }
    } catch { Start-Sleep -Seconds 2 }
  }
  return $false
}

function Stop-Tree($proc) {
  if ($proc -and -not $proc.HasExited) { & taskkill.exe /PID $proc.Id /T /F | Out-Null }
}

$needNlp = ($Suites -contains 'nlp') -or ($Suites -contains 'backend')
# The gateway suite needs core behind the gateway (baseline has no gateway: suite skipped).
$runGateway = ($Suites -contains 'gateway') -and ($Target -eq 'current')
$needBackend = ($Suites -contains 'backend') -or $runGateway

if ($needNlp) { Assert-PortFree $nlpPort 'NLP' }
if ($needBackend) { Assert-PortFree $bePort 'backend core' }
if ($runGateway) { Assert-PortFree $gwPort 'gateway' }

try {
  if ($needNlp) {
    Write-Host "== starting NLP ($Target) on $nlpPort"
    # Deterministic set ordering (see ISSUES I-0015) and no model downloads.
    $env:PYTHONHASHSEED = '0'; $env:HF_HUB_OFFLINE = '1'; $env:TRANSFORMERS_OFFLINE = '1'
    $p = Start-Child $python @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', "$nlpPort") `
      (Join-Path $tree 'nlp-engine') "$Target-nlp"
    $started += $p
    if (-not (Wait-Http "$nlpUrl/" 240 $p)) { throw "NLP did not become healthy on $nlpUrl, or exited (port taken?) (see tests\.out\$Target-nlp.err.log)" }
  }

  if ($needBackend) {
    Write-Host "== starting backend core ($Target) on $bePort"
    # PORT is explicit for current (core's own default is also 5001). For baseline the copied
    # backend\.env sets PORT and wins (override:true), so passing it changes nothing there.
    # R-04: core refuses to start without a SESSION_SECRET of >= 32 characters. The harness
    # gives core a clearly fake, test-only one (the process environment wins over backend\.env,
    # backend\Config\supabase.js), so the suites do not depend on the owner's secret.
    # R-11: ASSESSMENT_PREPARE_ON_APPLY=false so live apply tests spend no LLM generation (status
    # and start still prepare lazily). It holds unless backend\.env itself sets that name.
    $p = Start-Child 'node' @('index.js') (Join-Path $tree 'backend') "$Target-backend" @{ PORT = "$bePort"; SESSION_SECRET = 'test-only-session-secret-not-for-real-use-0000'; ASSESSMENT_PREPARE_ON_APPLY = 'false' }
    $started += $p
    if (-not (Wait-Http "$beUrl/api/health" 60 $p)) { throw "Backend core did not become healthy on $beUrl/api/health, or exited (port taken?) (see tests\.out\$Target-backend.*.log)" }
  }

  if ($runGateway) {
    Write-Host "== starting gateway on $gwPort (core at $beUrl)"
    $p = Start-Child 'node' @('index.js') (Join-Path $tree 'gateway') "$Target-gateway" @{ PORT = "$gwPort"; CORE_URL = $beUrl }
    $started += $p
    # Gateway /health answers 200 only when it can reach core (gateway\health.js).
    if (-not (Wait-Http "$gwUrl/health" 60 $p)) { throw "Gateway did not become healthy on $gwUrl/health, or exited (port taken?) (see tests\.out\$Target-gateway.*.log)" }
  }

  if ($Suites -contains 'nlp') {
    Write-Host "== NLP suite"
    $env:NLP_BASE_URL = $nlpUrl; $env:SNAPSHOT_LABEL = $Target
    & $python -m pytest (Join-Path $tests 'nlp') -v -p no:cacheprovider 2>&1 | Tee-Object (Join-Path $out "$Target-pytest.log")
    $results['nlp'] = $LASTEXITCODE
  }

  if ($Suites -contains 'backend') {
    Write-Host "== backend suite (core direct: $beUrl)"
    $env:BACKEND_BASE_URL = $beUrl; $env:CORE_BASE_URL = $beUrl
    # R-10: smoke.test.mjs expects 401 for the removed POST /api/analyze on baseline, 404 on current.
    $env:HARNESS_TARGET = $Target
    $files = @((Join-Path $tests 'backend\smoke.test.mjs'))
    # Offline unit tests (T-0014): explainability layer and the github-evidence client against a
    # local stub. They import this repo's backend modules, so they mean nothing for baseline.
    if ($Target -eq 'current') {
      foreach ($f in 'explainability', 'github-evidence-client', 'migration-guards', 'signup-profile', 'grading-claim', 'upload-limits', 'applicant-identity', 'assessment-service-client', 'backend-cruft', 'error-contract', 'auth-session', 'resume-pipeline', 'score-on-apply', 'assessment-orchestration', 'assessment-time-reset', 'apply-scoring-throws', 'recruiter-applications') {
        $files += (Join-Path $tests "backend\$f.test.mjs")
      }
      # T-0024/T-0025 route guards (T-0023): no session, no assessment service, no LLM. Baseline has no route.
      $files += (Join-Path $tests 'backend\assessment-generate.smoke.mjs')
    }
    if ($Live) {
      # R-10: live-analyze* now exercise upload, apply and score-again (POST /api/analyze is
      # removed), which the baseline worktree does not have, so they run for current only.
      if ($Target -eq 'current') { $files += (Join-Path $tests 'backend\live-analyze.test.mjs') }
      # T-0014: scoring with a github-evidence stub on :8001 (needs :8001 free). Not in baseline.
      if ($Target -eq 'current') { $files += (Join-Path $tests 'backend\live-analyze-github.test.mjs') }
      # T-0025 evaluate input guards (no LLM call, no writes). Not in baseline.
      if ($Target -eq 'current') { $files += (Join-Path $tests 'backend\assessment-evaluate-live.test.mjs') }
      # Cross-user authorization tests (T-0004..T-0007); they skip if the second accounts are not in tests\.env.
      foreach ($f in 'live-shortlist-authz', 'live-notifications-authz', 'live-auth-failclosed') {
        $files += (Join-Path $tests "backend\$f.test.mjs")
      }
      # R-10: its setup now uploads and applies (scored on apply); baseline does not score on apply.
      if ($Target -eq 'current') { $files += (Join-Path $tests 'backend\live-analysis-isolation.test.mjs') }
      # T-0029 security batch (B1). Not in baseline. They skip without their accounts or services.
      if ($Target -eq 'current') {
        foreach ($f in 'live-resume-authz', 'live-answer-key-access', 'live-evaluate-once', 'live-evaluate-release', 'live-signup-role', 'live-applicants', 'live-upload-gates') {
          $files += (Join-Path $tests "backend\$f.test.mjs")
        }
      }
    }
    # R-11: apply-scoring-throws uses node:test module mocks, which need this flag.
    & node --test --test-concurrency=1 --experimental-test-module-mocks @files 2>&1 | Tee-Object (Join-Path $out "$Target-backend-tests.log")
    $results['backend'] = $LASTEXITCODE
  }

  if ($Suites -contains 'gateway') {
    Write-Host "== gateway suite (offline + live against $gwUrl)"
    if (-not $runGateway) {
      Write-Host "skipped (no gateway in $Target)"
      $results['gateway'] = 0
    } else {
      $env:GATEWAY_BASE_URL = $gwUrl; $env:CORE_BASE_URL = $beUrl
      $gwFiles = @(Get-ChildItem (Join-Path $tests 'gateway') -Filter '*.test.mjs' | Sort-Object Name | ForEach-Object { $_.FullName })
      & node --test --test-concurrency=1 @gwFiles 2>&1 | Tee-Object (Join-Path $out "$Target-gateway-tests.log")
      $results['gateway'] = $LASTEXITCODE
    }
  }

  if ($Suites -contains 'docs') {
    Write-Host "== docs suite (tracker drift check)"
    # cmd.exe merges stderr so PowerShell 5.1 does not raise NativeCommandError on the script's problem list.
    $docsScript = Join-Path $tests 'docs\check-trackers.mjs'
    & cmd.exe /c "node `"$docsScript`" 2>&1" | Tee-Object (Join-Path $out "$Target-docs.log")
    $results['docs'] = $LASTEXITCODE
  }

  if ($Suites -contains 'github') {
    Write-Host "== github suite (recorded responses only)"
    if (-not (Test-Path (Join-Path $tree 'github-evidence'))) {
      Write-Host "skipped (no github-evidence in $Target)"
      $results['github'] = 0
    } else {
      $ghPython = Join-Path $repo 'github-evidence\venv\Scripts\python.exe'
      if (-not (Test-Path $ghPython)) { throw "github-evidence venv missing: python -m venv github-evidence\venv; github-evidence\venv\Scripts\python -m pip install -r github-evidence\requirements-dev.txt" }
      # Loopback stays open (the Windows event loop needs a socket pair); any other connect raises.
      # Run through cmd.exe: it merges stderr (PowerShell 5.1 would raise NativeCommandError on pytest
      # warnings) and leaves the comma in --allow-hosts alone (PowerShell would split it into an array).
      $ghTests = Join-Path $tests 'github'
      & cmd.exe /c "`"$ghPython`" -m pytest `"$ghTests`" -v -p no:cacheprovider --allow-hosts=127.0.0.1,::1 2>&1" | Tee-Object (Join-Path $out "$Target-github.log")
      $results['github'] = $LASTEXITCODE
    }
  }

  if ($Suites -contains 'assessment') {
    Write-Host "== assessment suite (in process, no LLM)"
    if (-not (Test-Path (Join-Path $tree 'assessment-service'))) {
      Write-Host "skipped (no assessment-service in $Target)"
      $results['assessment'] = 0
    } else {
      $asPython = Join-Path $repo 'assessment-service\.venv\Scripts\python.exe'
      if (-not (Test-Path $asPython)) { throw "assessment-service venv missing: python -m venv assessment-service\.venv; assessment-service\.venv\Scripts\python -m pip install -r assessment-service\requirements-dev.txt" }
      $asTests = Join-Path $tests 'assessment'
      & cmd.exe /c "`"$asPython`" -m pytest `"$asTests`" -v -p no:cacheprovider 2>&1" | Tee-Object (Join-Path $out "$Target-assessment.log")
      $results['assessment'] = $LASTEXITCODE
    }
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
