# Confere o sck e o src das vendas recentes da Hotmart (so leitura).
# Uso: powershell -ExecutionPolicy Bypass -File conferir-vendas-sck.ps1 -Desde 2026-09-25
# Chaves vem do .env na raiz do projeto; nada secreto e impresso.
param([string]$Desde = '2026-09-25')
$ErrorActionPreference = 'Stop'
$envArq = Join-Path $PSScriptRoot '..\..\.env'
$e = @{}
Get-Content $envArq | ForEach-Object { if ($_ -match '^(HOTMART_CLIENT_ID|HOTMART_CLIENT_SECRET|HOTMART_BASIC_TOKEN)=(.*)$') { $e[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'") } }
foreach ($k in 'HOTMART_CLIENT_ID', 'HOTMART_CLIENT_SECRET', 'HOTMART_BASIC_TOKEN') { if (-not $e[$k]) { throw "Falta $k no .env" } }
$basico = $e['HOTMART_BASIC_TOKEN']; if ($basico -notmatch '^Basic ') { $basico = 'Basic ' + $basico }
$tk = Invoke-RestMethod -Method Post -Uri ("https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials&client_id=" + $e['HOTMART_CLIENT_ID'] + "&client_secret=" + $e['HOTMART_CLIENT_SECRET']) -Headers @{ Authorization = $basico }
$h = @{ Authorization = ('Bearer ' + $tk.access_token) }
$ini = [long]([DateTimeOffset]([datetime]::Parse($Desde))).ToUnixTimeMilliseconds()
$fim = [long]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$todas = @(); $pg = $null; $n = 0
do {
  $u = "https://developers.hotmart.com/payments/api/v1/sales/history?start_date=$ini&end_date=$fim&max_results=200&transaction_status=APPROVED&transaction_status=COMPLETE"
  if ($pg) { $u += '&page_token=' + [uri]::EscapeDataString($pg) }
  $r = Invoke-RestMethod -Uri $u -Headers $h
  $todas += @($r.items); $pg = $r.page_info.next_page_token; $n++
} while ($pg -and $n -lt 20)

$v = @($todas | ForEach-Object {
  $t = $_.purchase.tracking
  $sck = "" + $t.source_sck; $src = "" + $t.source; $xc = "" + $t.external_code
  [pscustomobject]@{
    data = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$_.purchase.approved_date).ToLocalTime().ToString('dd/MM HH:mm')
    transacao = $_.purchase.transaction
    fonte = if ($sck.Length -gt 0) { ($sck -split '\|')[0] } else { '(vazio)' }
    sck = $sck; len_sck = $sck.Length; src = $src; xcod = $xc
  }
})
"Periodo: desde $Desde ate agora. Vendas aprovadas: $($v.Count)"
if ($v.Count -eq 0) { return }
"--- resumo ---"
"sck vazio: " + @($v | Where-Object { $_.len_sck -eq 0 }).Count
"sck direct: " + @($v | Where-Object { $_.fonte -eq 'direct' }).Count
"sck meta.ads/facebook: " + @($v | Where-Object { $_.fonte -match 'meta\.ads|facebook|pp\.dmb' }).Count
"sck yt_ads: " + @($v | Where-Object { $_.fonte -eq 'yt_ads' }).Count
"sck formato velho (host|referral, script antigo do GTM): " + @($v | Where-Object { $_.sck -match '^[^|]+\.[a-z]+\|referral' }).Count
"sck acima de 30 caracteres: " + @($v | Where-Object { $_.len_sck -gt 30 }).Count + " (maior: " + ($v | Measure-Object len_sck -Maximum).Maximum + ")"
"sck com underline: " + @($v | Where-Object { $_.sck -match '_' }).Count
"src preenchido: " + @($v | Where-Object { $_.src }).Count
"xcod preenchido (passou pelo site): " + @($v | Where-Object { $_.xcod }).Count
"--- vendas por dia (pra comparar com o evento purchase do GA4) ---"
$v | Group-Object { $_.data.Substring(0, 5) } | Sort-Object { [datetime]::ParseExact($_.Name + '/2026', 'dd/MM/yyyy', $null) } | ForEach-Object { "{0}: {1} vendas" -f $_.Name, $_.Count }
"--- vendas ---"
$v | Sort-Object data | Format-Table data, transacao, len_sck, src, sck -AutoSize -Wrap | Out-String -Width 250
