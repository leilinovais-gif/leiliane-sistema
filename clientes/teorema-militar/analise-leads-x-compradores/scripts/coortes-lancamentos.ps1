# Retorno de cada lançamento na mesma idade: quanto os leads captados naquele lançamento (e o frio à parte) compraram
# até o fim do lançamento e 3 meses, 6 meses, 1 ano e 2 anos depois. Prazo que ainda não chegou fica vazio (não é zero).
$inv = [Globalization.CultureInfo]::InvariantCulture
$dados = Join-Path $PSScriptRoot '..\dados'
$HOJE = [datetime]'2026-09-28'
$LEADS = Import-Csv "$dados\leads-unificados.csv" -Delimiter ';' -Encoding UTF8
$HMV = Import-Csv "$dados\hotmart-vendas.csv" -Delimiter ';' -Encoding UTF8
$META = Import-Csv (Join-Path $PSScriptRoot '..\meta-gasto-por-conjunto.csv') -Delimiter ';' -Encoding UTF8
$GOO = Import-Csv "$dados\google-ads-gasto-mensal.csv" -Encoding UTF8
. "$PSScriptRoot\classe.ps1"
$lat = [Text.Encoding]::GetEncoding(28591)
function Fix($s) { if ($s -match 'Ã') { [Text.Encoding]::UTF8.GetString($lat.GetBytes($s)) } else { $s } }
function Num($x) { if (-not $x) { return 0 }; [double]::Parse(("$x" -replace ',', '.'), $inv) }
function EhFrio($r) { (Classe $r) -like 'Frio*' }
function PubGoogle($c) { $u = " $($c.ToUpper()) "; if ($u -match '[^A-Z]PF[^A-Z]') { 'frio' } else { '' } }
function EhCaptacao($c) { $u = $c.ToUpper(); ($u -match 'CAPTA|CADASTRO|LEADS|DISTRIBUI') -and ($u -notmatch 'CARRINHO|VENDA|LEMBRETE|AQUEC|CONVERS') }
# vendas por e-mail (sem cobrança repetida do mesmo curso em 60 dias)
$VE = @{}; $seen = @{}; $PRIM = @{}
foreach ($s in ($HMV | Sort data)) { $em = $s.email.Trim().ToLower(); $dd = [datetime]$s.data; $pr = Fix $s.produto; $k = "$em|$pr"
  if ($seen[$k] -and ($dd - $seen[$k]).TotalDays -lt 60) { continue }; $seen[$k] = $dd
  if (-not $PRIM.ContainsKey($em)) { $PRIM[$em] = $dd }
  if (-not $VE[$em]) { $VE[$em] = New-Object System.Collections.ArrayList }; [void]$VE[$em].Add(@{ dt = $dd; val = (Num $s.valor) }) }
# primeira entrada de cada pessoa (qualquer base datada); só conta como lead do lançamento quem ENTROU nele e antes de ser aluno
$ENT = @{}
foreach ($r in $LEADS) { if (-not $r.email -or $r.base -like 'ACTIVE*') { continue }; $dd = [datetime]$r.data
  if (-not $ENT[$r.email] -or $dd -lt $ENT[$r.email].d) { $ENT[$r.email] = @{ d = $dd; base = $r.base; frio = (EhFrio $r) } } }
$LANC = @(
  @{ nome = 'Barro Branco 2023'; base = 'OP.BB23'; re = 'OP\.APMBB\.23' },
  @{ nome = 'EsPCEx 2024 (feita em 2023)'; base = 'OP.ESPCEX.24'; re = 'OP\.ESPCEX\.(SET\.)?24' },
  @{ nome = 'Plano EsPCEx 2024'; base = 'PLANO.ESPCEX.24'; re = 'PLANO\.?ESPCEX\.?24' },
  @{ nome = 'Projeto de Vida 2024'; base = 'P.VIDA.24'; re = 'P\.VIDA\.24' },
  @{ nome = 'Barro Branco 2024'; base = 'OP.BB24'; re = 'OP\.APMBB\.24' },
  @{ nome = 'EsPCEx 2025 (feita em 2024)'; base = 'OP.ESPCEX.25'; re = 'OP\.ESPCEX\.25' },
  @{ nome = 'Matemática Básica 2025'; base = 'MAT.BAS.25'; re = 'MAT\.BAS\.25' },
  @{ nome = 'Barro Branco 2025'; base = 'OP.BB.25'; re = 'OP\.BB\.?25' },
  @{ nome = 'EsPCEx 2026 (feita em 2025)'; base = 'OP.ESPCEX.26'; re = 'OP\.ESPCEX\.26' },
  @{ nome = 'Matemática Básica 2026'; base = 'MAT.BAS.26'; re = 'MAT\.BAS\.26|DMB\.26' })
$PRAZOS = @(@{ k = 'fim'; d = 0 }, @{ k = 'd90'; d = 90 }, @{ k = 'd180'; d = 180 }, @{ k = 'd365'; d = 365 }, @{ k = 'd730'; d = 730 })
$saida = foreach ($L in $LANC) {
  $rows = @($LEADS | ? { $_.base -eq $L.base })
  $ds = @($rows | % { [datetime]$_.data } | Sort); $ini = $ds[[int]($ds.Count * 0.02)]; $fim = $ds[[int]($ds.Count * 0.98)].AddDays(21)
  $pess = @($ENT.Keys | ? { $ENT[$_].base -eq $L.base -and -not ($PRIM.ContainsKey($_) -and $PRIM[$_].Date -le $ENT[$_].d) })
  $gm = @($META | ? { $_.campanha -match $L.re }); $gg = @($GOO | ? { $_.campanha -match $L.re })
  $invTot = ($gm | % { Num $_.gasto } | measure -Sum).Sum + ($gg | % { Num $_.gasto } | measure -Sum).Sum
  $invFrio = (@($gm | ? { $_.publico -eq 'Frio (PF)' -and (EhCaptacao $_.campanha) }) | % { Num $_.gasto } | measure -Sum).Sum + (@($gg | ? { (PubGoogle $_.campanha) -eq 'frio' -and (EhCaptacao $_.campanha) }) | % { Num $_.gasto } | measure -Sum).Sum
  $todos = [ordered]@{}; $frios = [ordered]@{}
  foreach ($P in $PRAZOS) { $lim = $fim.AddDays($P.d)
    if ($lim -gt $HOJE) { $todos[$P.k] = $null; $frios[$P.k] = $null; continue }
    $t = 0; $f = 0
    foreach ($em in $pess) { if (-not $VE[$em]) { continue }; foreach ($s in $VE[$em]) { if ($s.dt.Date -gt $ENT[$em].d -and $s.dt -le $lim) { $t += $s.val; if ($ENT[$em].frio) { $f += $s.val } } } }
    $todos[$P.k] = [math]::Round($t, 0); $frios[$P.k] = [math]::Round($f, 0) }
  # até hoje (pra quem ainda não fechou os prazos)
  $th = 0; $fh = 0; foreach ($em in $pess) { if (-not $VE[$em]) { continue }; foreach ($s in $VE[$em]) { if ($s.dt.Date -gt $ENT[$em].d) { $th += $s.val; if ($ENT[$em].frio) { $fh += $s.val } } } }
  [ordered]@{ nome = $L.nome; inicio = $ini.ToString('yyyy-MM-dd'); fim = $fim.ToString('yyyy-MM-dd'); investimento = [math]::Round($invTot, 0); investimentoFrio = [math]::Round($invFrio, 0)
    leads = $pess.Count; leadsFrios = @($pess | ? { $ENT[$_].frio }).Count; vendasLeads = $todos; vendasLeadsFrios = $frios; ateHoje = [math]::Round($th, 0); ateHojeFrios = [math]::Round($fh, 0) }
}
$saida | ConvertTo-Json -Depth 5 | Set-Content "$dados\coortes-lancamentos.json" -Encoding UTF8
function F($v) { if ($v -eq $null) { '   ainda não' } else { '{0,11:N0}' -f $v } }
'LANÇAMENTO                        INVEST    |  LEADS: fim     +90d     +6m      +1a      +2a    hoje  | FRIO invest | frio fim  +90d  +6m  +1a  +2a hoje'
foreach ($s in $saida) { $a = $s.vendasLeads; $b = $s.vendasLeadsFrios
  '{0,-30} {1,9:N0} | {2}{3}{4}{5}{6} {7,9:N0} | {8,9:N0} | {9}{10}{11}{12}{13} {14,9:N0}' -f $s.nome, $s.investimento, (F $a.fim), (F $a.d90), (F $a.d180), (F $a.d365), (F $a.d730), $s.ateHoje, $s.investimentoFrio, (F $b.fim), (F $b.d90), (F $b.d180), (F $b.d365), (F $b.d730), $s.ateHojeFrios }

# investimento total por tipo (Meta + Google), pra mostrar onde foi cada real
$reLanc = ($LANC | % { $_.re }) -join '|'
function Tipo($c) { $u = $c.ToUpper()
  if ($u -match $reLanc) { return 'Lançamentos com planilha de leads (os da tabela)' }
  if ($u -match 'INSTAGRAM POST|PUBLICA.{1,3}O DO INSTAGRAM|POST DO INSTAGRAM') { return 'Impulsionamento de posts' }
  if ($u -match 'ULT\.|ULTIMATO') { return 'Ultimatos' }
  if ($u -match '(^|[^A-Z])PP[ .\-]|PERP|DESCOBERTA|RELACIONAMENTO|REMARKETING') { return 'Perpétuo' }
  if ($u -match 'MEGA\.|OP\.ESA\.27|OP\.BB\.26|OP\.ESPCEX\.27|JCM\.26|TRIPLICE\.27') { return 'Captações de 2026 (ainda recentes)' }
  return 'Outros eventos e captações (sem planilha de leads)' }
$tipos = @{}
foreach ($x in $META) { $t = Tipo $x.campanha; $a = $x.ano; if (-not $tipos[$t]) { $tipos[$t] = @{ meta = 0; google = 0; anos = @{} } }; $v = Num $x.gasto; $tipos[$t].meta += $v; $tipos[$t].anos[$a] = [double]$tipos[$t].anos[$a] + $v }
foreach ($x in $GOO) { $t = Tipo $x.campanha; $a = $x.mes.Substring(0, 4); if (-not $tipos[$t]) { $tipos[$t] = @{ meta = 0; google = 0; anos = @{} } }; $v = Num $x.gasto; $tipos[$t].google += $v; $tipos[$t].anos[$a] = [double]$tipos[$t].anos[$a] + $v }
$outT = @(foreach ($k in ($tipos.Keys | Sort { -($tipos[$_].meta + $tipos[$_].google) })) { [ordered]@{ tipo = $k; meta = [math]::Round($tipos[$k].meta, 0); google = [math]::Round($tipos[$k].google, 0); anos = @(foreach ($a in 2023..2026) { [math]::Round([double]$tipos[$k].anos["$a"], 0) }) } })
$outT | ConvertTo-Json -Depth 4 | Set-Content "$dados\investimento-tipos.json" -Encoding UTF8
''; 'INVESTIMENTO POR TIPO'; foreach ($t in $outT) { '{0,-52} Meta {1,9:N0} Google {2,8:N0} total {3,9:N0} | {4}' -f $t.tipo, $t.meta, $t.google, ($t.meta + $t.google), (($t.anos | % { '{0:N0}' -f $_ }) -join ' / ') }
