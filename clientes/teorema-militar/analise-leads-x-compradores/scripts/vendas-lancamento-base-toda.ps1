# Vendas de cada lançamento cruzadas com a BASE TODA (todas as planilhas + ActiveCampaign inteiro, inclusive o migrado).
# Pega todas as vendas do curso no período do lançamento e diz, pra cada comprador, de onde ele era conhecido.
$inv = [Globalization.CultureInfo]::InvariantCulture
$dados = Join-Path $PSScriptRoot '..\dados'
$LEADS = Import-Csv "$dados\leads-unificados.csv" -Delimiter ';' -Encoding UTF8
$HMV = Import-Csv "$dados\hotmart-vendas.csv" -Delimiter ';' -Encoding UTF8
$META = Import-Csv (Join-Path $PSScriptRoot '..\meta-gasto-por-conjunto.csv') -Delimiter ';' -Encoding UTF8
$GOO = @(Import-Csv "$dados\google-ads-gasto-mensal.csv" -Encoding UTF8 | ? { $_.mes -ge '2023-08' })  # mesmo período do Meta
. "$PSScriptRoot\classe.ps1"
function Grupo($x) { switch -wildcard ($x) { 'Frio*' { 'frio' } 'Quente org*' { 'org' } 'Quente pago*' { 'pq' } default { 'semorigem' } } }
$lat = [Text.Encoding]::GetEncoding(28591)
function Fix($s) { if ($s -match 'Ã') { [Text.Encoding]::UTF8.GetString($lat.GetBytes($s)) } else { $s } }
function Num($x) { if (-not $x) { return 0 }; [double]::Parse(("$x" -replace ',', '.'), $inv) }
function Ph($p) { $d = ("$p" -replace '\D', ''); if ($d.Length -ge 10) { $d.Substring($d.Length - 8) } else { '' } }
# cadastros com data (planilhas + Active pós-migração), por e-mail e por telefone
$CAD = @{}; $CADT = @{}; $MIG = @{}; $MIGT = @{}
foreach ($r in $LEADS) {
  $em = "$($r.email)".Trim().ToLower(); $ph = Ph $r.tel
  if ($r.base -eq 'ACTIVE (migrado)') { if ($em) { $MIG[$em] = 1 }; if ($ph) { $MIGT[$ph] = 1 }; continue }
  $x = @{ d = [datetime]$r.data; base = $r.base; pub = (Grupo (Classe $r)) }
  if ($em) { if (-not $CAD[$em]) { $CAD[$em] = New-Object System.Collections.ArrayList }; [void]$CAD[$em].Add($x) }
  if ($ph) { if (-not $CADT[$ph]) { $CADT[$ph] = New-Object System.Collections.ArrayList }; [void]$CADT[$ph].Add($x) } }
# compras (pra saber quem já era aluno)
$COMP = @{}; foreach ($s in $HMV) { $em = $s.email.Trim().ToLower(); if (-not $COMP[$em]) { $COMP[$em] = New-Object System.Collections.ArrayList }; [void]$COMP[$em].Add([datetime]$s.data) }
$LANC = @(
  @{ nome = 'Barro Branco 2023'; base = 'OP.BB23'; re = 'OP\.APMBB\.23'; prod = 'Barro Branco' },
  @{ nome = 'EsPCEx 2024 (feita em 2023)'; base = 'OP.ESPCEX.24'; re = 'OP\.ESPCEX\.(SET\.)?24'; prod = 'Full - EsPCEx' },
  @{ nome = 'Plano EsPCEx 2024'; base = 'PLANO.ESPCEX.24'; re = 'PLANO\.?ESPCEX\.?24'; prod = 'Full - EsPCEx' },
  @{ nome = 'Barro Branco 2024'; base = 'OP.BB24'; re = 'OP\.APMBB\.24'; prod = 'Barro Branco' },
  @{ nome = 'EsPCEx 2025 (feita em 2024)'; base = 'OP.ESPCEX.25'; re = 'OP\.ESPCEX\.25'; prod = 'Full - EsPCEx' },
  @{ nome = 'Barro Branco 2025'; base = 'OP.BB.25'; re = 'OP\.BB\.?25'; prod = 'Barro Branco' },
  @{ nome = 'EsPCEx 2026 (feita em 2025)'; base = 'OP.ESPCEX.26'; re = 'OP\.ESPCEX\.26'; prod = 'Full - EsPCEx' })
$CLS = 'deste', 'outra', 'active', 'aluno', 'nao'
$saida = foreach ($L in $LANC) {
  $ds = @($LEADS | ? { $_.base -eq $L.base } | % { [datetime]$_.data } | Sort); $ini = $ds[[int]($ds.Count * 0.02)]; $fim = $ds[[int]($ds.Count * 0.98)].AddDays(21)
  $vs = @($HMV | ? { $d = [datetime]$_.data; $d -ge $ini -and $d -le $fim.AddDays(1) -and (Fix $_.produto) -match [regex]::Escape($L.prod) })
  $acc = @{}; foreach ($c in $CLS) { $acc[$c] = @{ n = 0; fat = 0.0 } }; $org = @{}; foreach ($c in 'frio', 'pq', 'org', 'semorigem', 'naoLead') { $org[$c] = 0.0 }
  foreach ($s in $vs) { $em = $s.email.Trim().ToLower(); $dv = [datetime]$s.data; $ph = Ph $s.telefone
    $cads = @(); if ($CAD[$em]) { $cads += @($CAD[$em]) } elseif ($ph -and $CADT[$ph]) { $cads += @($CADT[$ph]) }
    $antes = @($cads | ? { $_.d -lt $dv.Date })
    $jaAluno = $COMP[$em] -and @($COMP[$em] | ? { $_ -lt $dv.AddDays(-1) }).Count -gt 0
    $c = if (@($antes | ? { $_.base -eq $L.base }).Count) { 'deste' } elseif ($antes.Count) { 'outra' } elseif ($jaAluno) { 'aluno' } elseif ($MIG[$em] -or ($ph -and $MIGT[$ph])) { 'active' } else { 'nao' }
    $acc[$c].n++; $acc[$c].fat += (Num $s.valor)
    $ult = @($antes | Sort { $_.d }); $ko = if ($ult.Count) { $ult[-1].pub } else { 'naoLead' }; $org[$ko] += (Num $s.valor) }
  $invest = (@($META | ? { $_.campanha -match $L.re }) | % { Num $_.gasto } | measure -Sum).Sum + (@($GOO | ? { $_.campanha -match $L.re }) | % { Num $_.gasto } | measure -Sum).Sum
  $o = [ordered]@{ nome = $L.nome; de = $ini.ToString('yyyy-MM-dd'); ate = $fim.ToString('yyyy-MM-dd'); investimento = [math]::Round($invest, 0); vendas = $vs.Count; faturamento = [math]::Round((($vs | % { Num $_.valor }) | measure -Sum).Sum, 0) }
  foreach ($c in $CLS) { $o[$c] = [ordered]@{ n = $acc[$c].n; fat = [math]::Round($acc[$c].fat, 0) } }
  $o['origem'] = [ordered]@{ frio = [math]::Round($org.frio, 0); pq = [math]::Round($org.pq, 0); org = [math]::Round($org.org, 0); semorigem = [math]::Round($org.semorigem, 0); naoLead = [math]::Round($org.naoLead, 0) }
  # cursos individuais (tudo que não é Full) vendidos no mesmo período, e quanto disso foi pra gente que já era lead
  $vi = @($HMV | ? { $d = [datetime]$_.data; $d -ge $ini -and $d -le $fim.AddDays(1) -and (Fix $_.produto) -notmatch '(?i)\bfull\b' })
  $nl = 0; $fl = 0.0; foreach ($s in $vi) { $em = $s.email.Trim().ToLower(); $dv = [datetime]$s.data; $cads = @(); if ($CAD[$em]) { $cads = @($CAD[$em]) }; if (@($cads | ? { $_.d -lt $dv.Date }).Count) { $nl++; $fl += (Num $s.valor) } }
  $o['individuais'] = [ordered]@{ n = $vi.Count; fat = [math]::Round((($vi | % { Num $_.valor }) | measure -Sum).Sum, 0); nLeads = $nl; fatLeads = [math]::Round($fl, 0) }
  $o }
$saida | ConvertTo-Json -Depth 4 | Set-Content "$dados\vendas-lancamento-base-toda.json" -Encoding UTF8
'LANÇAMENTO                      INVEST   VENDAS  FATURAMENTO  R$1->  | deste lanç. | outra captação | Active antigo | já aluno | não mapeado'
foreach ($s in $saida) { '{0,-30} {1,8:N0} {2,6} {3,11:N0} {4,6:N2} | {5,4} {6,9:N0} | {7,4} {8,9:N0} | {9,4} {10,8:N0} | {11,4} {12,8:N0} | {13,4} {14,9:N0}' -f $s.nome, $s.investimento, $s.vendas, $s.faturamento, ($s.faturamento / [math]::Max(1, $s.investimento)), $s.deste.n, $s.deste.fat, $s.outra.n, $s.outra.fat, $s.active.n, $s.active.fat, $s.aluno.n, $s.aluno.fat, $s.nao.n, $s.nao.fat }
