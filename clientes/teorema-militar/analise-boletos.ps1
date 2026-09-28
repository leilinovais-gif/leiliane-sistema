$ErrorActionPreference = 'Stop'
$envArq = 'C:\CLAUDE 170926\.env'
$e = @{}
Get-Content $envArq | ForEach-Object { if ($_ -match '^(HOTMART_CLIENT_ID|HOTMART_CLIENT_SECRET|HOTMART_BASIC_TOKEN)=(.*)$') { $e[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'") } }
$basico = $e['HOTMART_BASIC_TOKEN']; if ($basico -notmatch '^Basic ') { $basico = 'Basic ' + $basico }
$tk = Invoke-RestMethod -Method Post -Uri ("https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials&client_id=" + $e['HOTMART_CLIENT_ID'] + "&client_secret=" + $e['HOTMART_CLIENT_SECRET']) -Headers @{ Authorization = $basico }
$h = @{ Authorization = ('Bearer ' + $tk.access_token) }
$agora = [long]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()); $ini = $agora - 28L * 86400000
function Puxa($status, $inicio) {
  $todas = @(); $pg = $null; $n = 0
  do {
    $u = "https://developers.hotmart.com/payments/api/v1/sales/history?start_date=$inicio&end_date=$agora&max_results=200"
    foreach ($s in $status) { $u += "&transaction_status=$s" }
    if ($pg) { $u += '&page_token=' + [uri]::EscapeDataString($pg) }
    $r = Invoke-RestMethod -Uri $u -Headers $h
    $todas += @($r.items); $pg = $r.page_info.next_page_token; $n++
  } while ($pg -and $n -lt 20)
  return $todas
}
function Linha($i) {
  $p = $i.purchase
  [pscustomobject]@{
    status = "" + $p.status; pagamento = "" + $p.payment.type
    email = ("" + $i.buyer.email).ToLower().Trim(); produto = "" + $i.product.id
    pedido = [long]$p.order_date; aprovada = [long]$p.approved_date; valor = [double]$p.price.value
  }
}
$pend = @()
foreach ($st in 'PRINTED_BILLET', 'EXPIRED', 'WAITING_PAYMENT', 'CANCELLED', 'DELAYED', 'OVERDUE') {
  try { $x = @(Puxa @($st) $ini | ForEach-Object { Linha $_ }); "{0,-16} {1,4} transacoes" -f $st, $x.Count; $pend += $x } catch { "{0,-16} erro: {1}" -f $st, $_.Exception.Message }
}
$pagas = @(Puxa @('APPROVED', 'COMPLETE') ($ini - 3L * 86400000) | ForEach-Object { Linha $_ })
"pagas na janela (com 3 dias de folga): $($pagas.Count)"
"--- so boleto (pagamento = BILLET) ---"
$bol = @($pend | Where-Object { $_.pagamento -eq 'BILLET' })
"transacoes de boleto nao pagas: " + $bol.Count
$bolBuyers = $bol | Group-Object { $_.email + '|' + $_.produto }
"compradores unicos (email + produto): " + $bolBuyers.Count
$recup = 0; $recupBoleto = 0; $recupOutro = 0; $valorPerdido = 0.0
foreach ($g in $bolBuyers) {
  $pri = ($g.Group | Sort-Object pedido | Select-Object -First 1)
  $pago = @($pagas | Where-Object { $_.email -eq $pri.email -and $_.produto -eq $pri.produto -and $_.aprovada -ge $pri.pedido })
  if ($pago.Count -gt 0) { $recup++; if (@($pago | Where-Object { $_.pagamento -eq 'BILLET' }).Count -gt 0) { $recupBoleto++ } else { $recupOutro++ } }
  else { $valorPerdido += $pri.valor }
}
"gerou boleto e pagou depois (mesmo email e produto): $recup  (de novo por boleto: $recupBoleto | por Pix/cartao/outro: $recupOutro)"
"gerou boleto e NAO pagou por nenhum meio: " + ($bolBuyers.Count - $recup)
"valor dos boletos sem pagamento (soma do primeiro boleto de cada um): " + [math]::Round($valorPerdido, 2)
"--- por status dos nao pagos (todas as formas) ---"
$pend | Group-Object status, pagamento | Sort-Object Count -Descending | ForEach-Object { "{0,-30} {1}" -f $_.Name, $_.Count }
