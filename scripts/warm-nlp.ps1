<#
.SYNOPSIS
  Re-warm the running nlp-engine: one parse of a synthetic fixture, timed.

.DESCRIPTION
  start-all.ps1 already warms nlp-engine once at startup (R-38). That does not help
  after the stack has sat idle for hours: on 2026-11-15 the nlp-engine process had
  ~730 MB of its ~1.2 GB paged out, with about 1.2 GB of RAM free, and the first parses
  after the idle period took 6.9 s, 32.4 s and 55.0 s (warm parses take 0.1 to 2.3 s).
  core gives a parse 30 s, so a cold parse at apply returns parser_unavailable.

  Run this before a demo or an e2e run when the stack has been idle. It sends the same
  request as start-all's warm-up (fixture tests\fixtures\f3_support_nogithub.pdf, with a
  job description so the sentence model runs too), up to three times, and prints each
  time. It touches no database row and no stored file. It exits 1 if no parse answers 200.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\warm-nlp.ps1
#>
[CmdletBinding()]
param([int]$Tries = 3)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'nlp-warm.lib.ps1')

$fixture = Join-Path $repo 'tests\fixtures\f3_support_nogithub.pdf'
$ok = $false
for ($i = 1; $i -le $Tries; $i++) {
  $warm = Invoke-WarmParse 'http://127.0.0.1:8000/parse' $fixture 120000
  $codeText = if ($warm.Code) { "HTTP $($warm.Code)" } else { 'no answer' }
  Write-Host "warm-nlp: parse $i answered $codeText in $($warm.Seconds) s"
  if ($warm.Code -eq 200) {
    $ok = $true
    # One fast answer means the models are resident again.
    if ($warm.Seconds -lt 3) { break }
  }
}
# CreateJob's "skills found in the description" calls /skills/extract (core allows 10 s).
# On 2026-11-15 it timed out once in an e2e run while the machine was paging; warm it too.
try {
  $w = [System.Diagnostics.Stopwatch]::StartNew()
  $r = Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'http://127.0.0.1:8000/skills/extract' `
    -ContentType 'application/json' -Body '{"text":"IT support analyst: Linux, SQL, ServiceNow, Jira."}' -TimeoutSec 60
  Write-Host "warm-nlp: skills/extract answered HTTP $($r.StatusCode) in $([math]::Round($w.Elapsed.TotalSeconds, 1)) s"
} catch {
  Write-Host "warm-nlp: skills/extract did not answer 200: $($_.Exception.Message)"
  $ok = $false
}
if (-not $ok) {
  Write-Host 'warm-nlp: FAILED: no parse answered 200. Is nlp-engine running on :8000? See tests\.out\start-all\nlp-engine.err.log'
  exit 1
}
exit 0
