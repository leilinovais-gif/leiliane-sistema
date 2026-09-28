# Carga inicial dos contatos do ActiveCampaign pro relatório (Visão geral: origem da venda).
# Lê todos os contatos daqui e manda pro relatório só o necessário: o e-mail vira um código (hash) lá e a origem (UTM) já é classificada.
# Rodar uma vez (pode rodar de novo sem duplicar). Depois disso o próprio relatório atualiza os contatos novos.
param([string]$Url = 'https://relatorio-espcex27.teoremacloudflare.workers.dev')
$ErrorActionPreference = 'Stop'
$envArq = Join-Path $PSScriptRoot '..\..\..\.env'
$e = @{}
Get-Content $envArq | ForEach-Object { if ($_ -match '^(ACTIVECAMPAIGN_API_URL|ACTIVECAMPAIGN_API_KEY|GOOGLE_INGEST_KEY)=(.*)$') { $e[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'") } }
foreach ($k in 'ACTIVECAMPAIGN_API_URL', 'ACTIVECAMPAIGN_API_KEY', 'GOOGLE_INGEST_KEY') { if (-not $e[$k]) { throw "Falta $k no .env" } }
$ac = $e['ACTIVECAMPAIGN_API_URL'].TrimEnd('/')
$h = @{ 'Api-Token' = $e['ACTIVECAMPAIGN_API_KEY'] }
$chave = @{ 'X-Report-Key' = $e['GOOGLE_INGEST_KEY'] }
# campos personalizados: 27 source, 28 content, 29 medium, 30 campaign, 31 term
$total = [int](Invoke-RestMethod "$ac/api/3/contacts?limit=1" -Headers $h).meta.total
"Contatos no ActiveCampaign: $total"
$lote = @(); $enviados = 0; $pagina = 0
function Enviar($lista) {
  $json = @{ contatos = @($lista) } | ConvertTo-Json -Depth 5 -Compress
  $r = Invoke-RestMethod -Method Post -Uri "$Url/api/ac-contatos" -Headers $chave -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json))
  return $r.salvos
}
for ($off = 0; $off -lt $total; $off += 100) {
  $r = Invoke-RestMethod "$ac/api/3/contacts?limit=100&offset=$off&include=fieldValues" -Headers $h
  $porContato = @{}
  foreach ($fv in @($r.fieldValues)) { if (-not $porContato.ContainsKey($fv.contact)) { $porContato[$fv.contact] = @{} }; $porContato[$fv.contact][[string]$fv.field] = $fv.value }
  foreach ($c in @($r.contacts)) {
    $v = $porContato[$c.id]; if (-not $v) { $v = @{} }
    $lote += @{ email = $c.email; source = $v['27']; content = $v['28']; medium = $v['29']; campaign = $v['30']; term = $v['31']; cadastro = $c.cdate }
  }
  if ($lote.Count -ge 200) { $enviados += (Enviar $lote); $lote = @() }
  $pagina++
  if ($pagina % 20 -eq 0) { "{0} de {1} contatos lidos ({2} enviados)" -f [math]::Min($off + 100, $total), $total, $enviados }
  Start-Sleep -Milliseconds 220
}
if ($lote.Count -gt 0) { $enviados += (Enviar $lote) }
"Pronto: $enviados contatos enviados."