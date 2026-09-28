# Carga inicial das vendas da Hotmart pro relatório (Visão geral).
# Lê a Hotmart daqui (o Cloudflare não consegue) e manda pro relatório, mês a mês, desde 2021.
# Rodar uma vez (pode rodar de novo sem duplicar). Depois disso o script do Google Ads mantém tudo em dia, de hora em hora.
# Chaves: vêm do .env (na raiz do projeto); nada é impresso na tela.
param(
  [string]$Desde = '2021-01',
  [string]$Url = 'https://relatorio-espcex27.teoremacloudflare.workers.dev'
)
$ErrorActionPreference = 'Stop'
$envArq = Join-Path $PSScriptRoot '..\..\..\.env'
$e = @{}
Get-Content $envArq | ForEach-Object { if ($_ -match '^(HOTMART_CLIENT_ID|HOTMART_CLIENT_SECRET|HOTMART_BASIC_TOKEN|GOOGLE_INGEST_KEY)=(.*)$') { $e[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'") } }
foreach ($k in 'HOTMART_CLIENT_ID', 'HOTMART_CLIENT_SECRET', 'HOTMART_BASIC_TOKEN', 'GOOGLE_INGEST_KEY') { if (-not $e[$k]) { throw "Falta $k no .env" } }
$basico = $e['HOTMART_BASIC_TOKEN']; if ($basico -notmatch '^Basic ') { $basico = 'Basic ' + $basico }
$tk = Invoke-RestMethod -Method Post -Uri ("https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials&client_id=" + $e['HOTMART_CLIENT_ID'] + "&client_secret=" + $e['HOTMART_CLIENT_SECRET']) -Headers @{ Authorization = $basico }
$h = @{ Authorization = ('Bearer ' + $tk.access_token) }
$chave = @{ 'X-Report-Key' = $e['GOOGLE_INGEST_KEY'] }

function Ms([datetime]$d) { [long]([DateTimeOffset]::new([datetime]::SpecifyKind($d, 'Utc'))).ToUnixTimeMilliseconds() }
function Enxuga($i) {
  $c = $i.purchase
  @{ buyer = @{ email = $i.buyer.email }; product = @{ id = $i.product.id; name = $i.product.name };
     purchase = @{ transaction = $c.transaction; approved_date = $c.approved_date; order_date = $c.order_date; price = $c.price;
                   hotmart_fee = @{ total = $c.hotmart_fee.total }; recurrency_number = $c.recurrency_number; tracking = @{ source_sck = $c.tracking.source_sck } } }
}
function Ler($ini, $fim, $status) {
  $todas = @(); $pg = $null; $n = 0
  do {
    $u = "https://developers.hotmart.com/payments/api/v1/sales/history?start_date=$ini&end_date=$fim&max_results=200" + (($status | ForEach-Object { "&transaction_status=$_" }) -join '')
    if ($pg) { $u += '&page_token=' + [uri]::EscapeDataString($pg) }
    $r = Invoke-RestMethod -Uri $u -Headers $h
    $todas += @($r.items); $pg = $r.page_info.next_page_token; $n++
  } while ($pg -and $n -lt 40)
  return $todas
}
function Enviar($itens, $reembolsadas) {
  $json = @{ itens = @($itens); reembolsadas = @($reembolsadas) } | ConvertTo-Json -Depth 8 -Compress
  Invoke-RestMethod -Method Post -Uri "$Url/api/hotmart-vendas" -Headers $chave -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json))
}

$a = [int]$Desde.Substring(0, 4); $m = [int]$Desde.Substring(5, 2)
$hoje = [datetime]::UtcNow
$total = 0
while ($true) {
  $ini = [datetime]::new($a, $m, 1, 3, 0, 0, [DateTimeKind]::Utc)
  if ($ini -gt $hoje) { break }
  $fim = $ini.AddMonths(1).AddMilliseconds(-1)
  $itens = Ler (Ms $ini) (Ms $fim) @('APPROVED', 'COMPLETE')
  $enviadas = 0
  for ($k = 0; $k -lt $itens.Count; $k += 100) {
    $lote = $itens[$k..([math]::Min($k + 99, $itens.Count - 1))] | ForEach-Object { Enxuga $_ }
    $r = Enviar $lote @()
    $enviadas += $r.salvas
  }
  $total += $enviadas
  ('{0}-{1:D2}: {2} vendas' -f $a, $m, $enviadas)
  $m++; if ($m -gt 12) { $m = 1; $a++ }
}
# reembolsos dos últimos 90 dias (venda que já foi reembolsada não deve contar)
$agora = [long]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
$reemb = Ler ($agora - 90 * 86400000) $agora @('REFUNDED', 'CHARGEBACK') | ForEach-Object { $_.purchase.transaction } | Where-Object { $_ }
if ($reemb) { $null = Enviar @() @($reemb | Select-Object -First 500) }
"Pronto: $total vendas enviadas."