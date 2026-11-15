# Shared by scripts\start-all.ps1 and scripts\warm-nlp.ps1 (dot-sourced). Moved out of
# start-all.ps1 unchanged on 2026-11-15, so the warm-up can be repeated after the stack idles.

# R-38: one real parse through nlp-engine before the stack is reported up: a synthetic
# fixture with a job description, so text extraction, spaCy and the sentence model all
# run once. nlp-engine loads its models while importing, before it listens (its GET /
# cannot answer earlier), but the batch-7 live pass saw the first upload after a start
# get 503 parser_unavailable; this makes "up" mean "a parse has answered 200".
# Returns @{ Code = <HTTP status, 0 for no answer>; Seconds = <elapsed> }.
function Invoke-WarmParse([string]$url, [string]$file, [int]$timeoutMs) {
  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  $code = 0
  try {
    $boundary = [Guid]::NewGuid().ToString('N')
    $enc = [System.Text.Encoding]::UTF8
    $ms = New-Object System.IO.MemoryStream
    $parts = @(
      "--$boundary`r`nContent-Disposition: form-data; name=`"jd`"`r`n`r`nIT support analyst: Linux, SQL, ServiceNow, Jira.`r`n",
      "--$boundary`r`nContent-Disposition: form-data; name=`"required_skills`"`r`n`r`n[`"linux`",`"sql`"]`r`n",
      "--$boundary`r`nContent-Disposition: form-data; name=`"resume`"; filename=`"warmup.pdf`"`r`nContent-Type: application/pdf`r`n`r`n"
    )
    foreach ($text in $parts) { $b = $enc.GetBytes($text); $ms.Write($b, 0, $b.Length) }
    $fileBytes = [System.IO.File]::ReadAllBytes($file)
    $ms.Write($fileBytes, 0, $fileBytes.Length)
    $b = $enc.GetBytes("`r`n--$boundary--`r`n"); $ms.Write($b, 0, $b.Length)
    $body = $ms.ToArray()

    $req = [System.Net.HttpWebRequest]::Create($url)
    $req.Method = 'POST'
    $req.Proxy = $null
    $req.Timeout = $timeoutMs
    $req.ReadWriteTimeout = $timeoutMs
    $req.ContentType = "multipart/form-data; boundary=$boundary"
    $req.Headers.Add('X-Request-ID', 'start-all-warm-up')
    $req.ContentLength = $body.Length
    $stream = $req.GetRequestStream()
    $stream.Write($body, 0, $body.Length)
    $stream.Close()
    $resp = $req.GetResponse()
    $code = [int]$resp.StatusCode
    $resp.Close()
  } catch [System.Net.WebException] {
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode; $_.Exception.Response.Close() }
  } catch {
    $code = 0
  }
  return @{ Code = $code; Seconds = [math]::Round($watch.Elapsed.TotalSeconds, 1) }
}
