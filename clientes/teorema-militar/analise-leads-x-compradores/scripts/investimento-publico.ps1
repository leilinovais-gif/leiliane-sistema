# Investimento em anúncio (Meta + Google) por público e por ano: frio, quente e sem público definido.
# Meta: pelo nome do conjunto (meta-gasto-por-conjunto.csv, coluna publico). Google: PF/PQ no nome da campanha.
$inv = [Globalization.CultureInfo]::InvariantCulture
$dados = Join-Path $PSScriptRoot '..\dados'
$META = Import-Csv (Join-Path $PSScriptRoot '..\meta-gasto-por-conjunto.csv') -Delimiter ';' -Encoding UTF8
$GOO = @(Import-Csv "$dados\google-ads-gasto-mensal.csv" -Encoding UTF8 | ? { $_.mes -ge '2023-08' })  # mesmo período do Meta
function Num($x) { if (-not $x) { return 0 }; [double]::Parse(("$x" -replace ',', '.'), $inv) }
$T = @{}
function Soma($pub, $ano, $plat, $v) { $k = "$pub"; if (-not $T[$k]) { $T[$k] = @{ meta = @{}; google = @{} } }; $T[$k][$plat][$ano] = [double]$T[$k][$plat][$ano] + $v }
foreach ($x in $META) { $p = switch ($x.publico) { 'Frio (PF)' { 'frio' } 'Quente (PQ)' { 'quente' } default { 'sem' } }; Soma $p $x.ano 'meta' (Num $x.gasto) }
foreach ($x in $GOO) { $u = " $($x.campanha.ToUpper()) "; $p = if ($u -match '[^A-Z]PF[^A-Z]') { 'frio' } elseif ($u -match '[^A-Z]PQ[^A-Z]') { 'quente' } else { 'sem' }; Soma $p $x.mes.Substring(0, 4) 'google' (Num $x.gasto) }
$out = foreach ($p in 'frio', 'quente', 'sem') { $m = $T[$p].meta; $g = $T[$p].google
  [ordered]@{ publico = $p; meta = @(foreach ($a in 2023..2026) { [math]::Round([double]$m["$a"], 0) }); google = @(foreach ($a in 2023..2026) { [math]::Round([double]$g["$a"], 0) }) } }
$out | ConvertTo-Json -Depth 4 | Set-Content "$dados\investimento-publico.json" -Encoding UTF8
foreach ($o in $out) { $tm = ($o.meta | measure -Sum).Sum; $tg = ($o.google | measure -Sum).Sum; '{0,-7} Meta {1,9:N0} Google {2,8:N0} total {3,9:N0} | por ano {4}' -f $o.publico, $tm, $tg, ($tm + $tg), ((0..3 | % { '{0:N0}' -f ($o.meta[$_] + $o.google[$_]) }) -join ' / ') }

# separa captação (gera lead) de venda (remarketing, carrinho, perpétuo, conversão, lembrete) dentro de cada público
function EhCaptacao($c) { $u = $c.ToUpper(); ($u -match 'CAPTA|CADASTRO|LEADS|DISTRIBUI') -and ($u -notmatch 'CARRINHO|VENDA|LEMBRETE|AQUEC|CONVERS') }
$S = @{}
foreach ($x in $META) { $p = switch ($x.publico) { 'Frio (PF)' { 'frio' } 'Quente (PQ)' { 'quente' } default { 'sem' } }; $k = $p + '|' + $(if (EhCaptacao $x.campanha) { 'captacao' } else { 'venda' }); $S[$k] = [double]$S[$k] + (Num $x.gasto) }
foreach ($x in $GOO) { $u = " $($x.campanha.ToUpper()) "; $p = if ($u -match '[^A-Z]PF[^A-Z]') { 'frio' } elseif ($u -match '[^A-Z]PQ[^A-Z]') { 'quente' } else { 'sem' }; $k = $p + '|' + $(if (EhCaptacao $x.campanha) { 'captacao' } else { 'venda' }); $S[$k] = [double]$S[$k] + (Num $x.gasto) }
$tipo = [ordered]@{}; foreach ($k in ($S.Keys | Sort)) { $tipo[$k] = [math]::Round($S[$k], 0) }
$tipo | ConvertTo-Json | Set-Content "$dados\investimento-publico-tipo.json" -Encoding UTF8
''; foreach ($k in $tipo.Keys) { '{0,-18} {1,10:N0}' -f $k, $tipo[$k] }
