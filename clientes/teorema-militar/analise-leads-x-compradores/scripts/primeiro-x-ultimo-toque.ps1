# Compara as duas formas de dar crédito à venda (ago/2023 em diante):
#  primeiro toque = pelo primeiro cadastro da pessoa; último toque = pelo último cadastro antes da compra.
$inv = [Globalization.CultureInfo]::InvariantCulture
$dados = Join-Path $PSScriptRoot '..\dados'
$LEADS = Import-Csv "$dados\leads-unificados.csv" -Delimiter ';' -Encoding UTF8
$HMV = Import-Csv "$dados\hotmart-vendas.csv" -Delimiter ';' -Encoding UTF8
. "$PSScriptRoot\classe.ps1"
$lat = [Text.Encoding]::GetEncoding(28591)
function Fix($s) { if ($s -match 'Ã') { [Text.Encoding]::UTF8.GetString($lat.GetBytes($s)) } else { $s } }
function Num($x) { if (-not $x) { return 0 }; [double]::Parse(("$x" -replace ',', '.'), $inv) }
function Grupo($x) { switch -wildcard ($x) { 'Frio*' { 'frio' } 'Quente org*' { 'org' } 'Quente pago*' { 'pq' } default { 'semorigem' } } }
$INICIO = [datetime]'2023-08-01'
$CAD = @{}
foreach ($r in $LEADS) { if (-not $r.email -or $r.base -eq 'ACTIVE (migrado)') { continue }; $em = $r.email.Trim().ToLower()
  if (-not $CAD[$em]) { $CAD[$em] = New-Object System.Collections.ArrayList }; [void]$CAD[$em].Add([pscustomobject]@{ d = [datetime]$r.data; pub = (Grupo (Classe $r)) }) }
$PRIM = @{}; foreach ($s in ($HMV | Sort data)) { $em = $s.email.Trim().ToLower(); if (-not $PRIM.ContainsKey($em)) { $PRIM[$em] = [datetime]$s.data } }
$P = @{}; $U = @{}; $tot = 0
foreach ($s in $HMV) { $dv = [datetime]$s.data; if ($dv -lt $INICIO) { continue }; $em = $s.email.Trim().ToLower(); $v = Num $s.valor; $tot += $v
  $c = @(); if ($CAD[$em]) { $c = @($CAD[$em] | ? { $_.d -lt $dv.Date } | Sort d) }
  $lead = $c.Count -and $c[0].d -lt $PRIM[$em].Date   # regra: lead antes da primeira compra
  $kp = if ($lead) { if ($c[0].d -lt $INICIO) { 'antigo' } else { $c[0].pub } } else { 'naoLead' }
  $ku = if ($c.Count) { $c[-1].pub } else { 'naoLead' }      # último cadastro antes desta compra (mesmo que já fosse aluno)
  $P[$kp] = [double]$P[$kp] + $v; $U[$ku] = [double]$U[$ku] + $v }
"faturamento ago/2023 em diante: R$ {0:N0}" -f $tot
'{0,-12} {1,14} {2,14}' -f 'origem', 'primeiro toque', 'último toque'
foreach ($k in 'frio', 'pq', 'org', 'semorigem', 'antigo', 'naoLead') { '{0,-12} {1,14:N0} {2,14:N0}' -f $k, [double]$P[$k], [double]$U[$k] }
