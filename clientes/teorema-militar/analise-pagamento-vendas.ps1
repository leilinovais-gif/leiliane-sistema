$ErrorActionPreference = 'Stop'
$envArq = 'C:\CLAUDE 170926\.env'
$e = @{}
Get-Content $envArq | ForEach-Object { if ($_ -match '^(HOTMART_CLIENT_ID|HOTMART_CLIENT_SECRET|HOTMART_BASIC_TOKEN)=(.*)$') { $e[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'") } }
$basico = $e['HOTMART_BASIC_TOKEN']; if ($basico -notmatch '^Basic ') { $basico = 'Basic ' + $basico }
$tk = Invoke-RestMethod -Method Post -Uri ("https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials&client_id=" + $e['HOTMART_CLIENT_ID'] + "&client_secret=" + $e['HOTMART_CLIENT_SECRET']) -Headers @{ Authorization = $basico }
$h = @{ Authorization = ('Bearer ' + $tk.access_token) }
$agora = [long]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()); $ini = $agora - 28L * 86400000
$todas = @(); $pg = $null; $n = 0
do {
  $u = "https://developers.hotmart.com/payments/api/v1/sales/history?start_date=$ini&end_date=$agora&max_results=200&transaction_status=APPROVED&transaction_status=COMPLETE"
  if ($pg) { $u += '&page_token=' + [uri]::EscapeDataString($pg) }
  $r = Invoke-RestMethod -Uri $u -Headers $h
  $todas += @($r.items); $pg = $r.page_info.next_page_token; $n++
} while ($pg -and $n -lt 20)
$v = @($todas | ForEach-Object {
  $p = $_.purchase
  $ord = [long]$p.order_date; $apr = [long]$p.approved_date
  [pscustomobject]@{
    pagamento = "" + $p.payment.type
    parcelas = [int]$p.payment.installments_number
    xcod = [bool]("" + $p.tracking.external_code)
    src = [bool]("" + $p.tracking.source)
    horas_ate_aprovar = if ($ord -gt 0 -and $apr -gt 0) { [math]::Round(($apr - $ord) / 3600000, 1) } else { -1 }
    recorrencia = [int]$p.recurrency_number
  }
})
"Vendas aprovadas (28 dias): $($v.Count)"
"--- por forma de pagamento ---"
$v | Group-Object pagamento | Sort-Object Count -Descending | ForEach-Object {
  $g = $_.Group
  "{0,-14} {1,4} vendas | com xcod: {2,3} | aprovacao acima de 72h: {3,3} | acima de 24h: {4,3}" -f $_.Name, $_.Count, @($g | Where-Object { $_.xcod }).Count, @($g | Where-Object { $_.horas_ate_aprovar -gt 72 }).Count, @($g | Where-Object { $_.horas_ate_aprovar -gt 24 }).Count
}
"--- geral ---"
"com xcod (passou pelo site): " + @($v | Where-Object { $_.xcod }).Count
"sem xcod: " + @($v | Where-Object { -not $_.xcod }).Count
"aprovacao demorou mais de 72h: " + @($v | Where-Object { $_.horas_ate_aprovar -gt 72 }).Count
"aprovacao demorou mais de 24h: " + @($v | Where-Object { $_.horas_ate_aprovar -gt 24 }).Count
"renovacao/recorrencia acima de 1: " + @($v | Where-Object { $_.recorrencia -gt 1 }).Count
"com xcod E aprovadas em ate 1h: " + @($v | Where-Object { $_.xcod -and $_.horas_ate_aprovar -ge 0 -and $_.horas_ate_aprovar -le 1 }).Count
