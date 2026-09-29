# Raio-X de quem comprou e não está em nenhuma base de leads (ago/2023 em diante): o que comprou, por onde chegou ao checkout.
$inv = [Globalization.CultureInfo]::InvariantCulture
$dados = Join-Path $PSScriptRoot '..\dados'
$LEADS = Import-Csv "$dados\leads-unificados.csv" -Delimiter ';' -Encoding UTF8
$HMV = Import-Csv "$dados\hotmart-vendas.csv" -Delimiter ';' -Encoding UTF8
$lat = [Text.Encoding]::GetEncoding(28591)
function Fix($s) { if ($s -match 'Ã') { [Text.Encoding]::UTF8.GetString($lat.GetBytes($s)) } else { $s } }
function Num($x) { if (-not $x) { return 0 }; [double]::Parse(("$x" -replace ',', '.'), $inv) }
function Ph($p) { $d = ("$p" -replace '\D', ''); if ($d.Length -ge 10) { $d.Substring($d.Length - 8) } else { '' } }
$E = @{}; $T = @{}; foreach ($r in $LEADS) { $em = "$($r.email)".Trim().ToLower(); if ($em) { $E[$em] = 1 }; $p = Ph $r.tel; if ($p) { $T[$p] = 1 } }
$PRIM = @{}; foreach ($s in ($HMV | Sort data)) { $em = $s.email.Trim().ToLower(); if (-not $PRIM.ContainsKey($em)) { $PRIM[$em] = [datetime]$s.data } }
function Origem($sck) { $x = "$sck".ToLower()
  if (-not $x -or $x -match '^null') { return 'sem rastreio (link direto, sem sck)' }
  if ($x -match 'whats') { return 'WhatsApp' }; if ($x -match 'yt_live|live') { return 'live do YouTube' }; if ($x -match 'meta\.ads|facebook|fb_|pf|pq') { return 'anúncio' }
  if ($x -match 'bio|stories|ig|instagram') { return 'Instagram' }; if ($x -match 'youtube|yt') { return 'YouTube' }; if ($x -match 'email') { return 'e-mail' }
  if ($x -match 'google|bing|referral') { return 'Google / busca' }; if ($x -match 'direct') { return 'direto' }; if ($x -match 'hotmart') { return 'página da Hotmart' }; return 'outros' }
$nm = @($HMV | ? { [datetime]$_.data -ge [datetime]'2023-08-01' } | ? { $em = $_.email.Trim().ToLower(); -not $E[$em] -and -not ((Ph $_.telefone) -and $T[(Ph $_.telefone)]) })
$tot = ($HMV | ? { [datetime]$_.data -ge [datetime]'2023-08-01' } | % { Num $_.valor } | measure -Sum).Sum
$fnm = ($nm | % { Num $_.valor } | measure -Sum).Sum
"compras de quem não está em base nenhuma: {0} ({1:N0} pessoas) · R$ {2:N0} de R$ {3:N0} ({4:P0})" -f $nm.Count, ($nm | % { $_.email.Trim().ToLower() } | Select -Unique).Count, $fnm, $tot, ($fnm / $tot)
$pri = @($nm | ? { $PRIM[$_.email.Trim().ToLower()] -ge [datetime]$_.data.Substring(0, 10) }); "  primeira compra da pessoa: {0} · recompra: {1}" -f $pri.Count, ($nm.Count - $pri.Count)
'--- por onde chegou ao checkout (sck)'; $nm | Group { Origem $_.sck } | Sort { -($_.Group | % { Num $_.valor } | measure -Sum).Sum } | % { '  {0,-38} {1,5} compras R$ {2,11:N0} {3:P0}' -f $_.Name, $_.Count, ($_.Group | % { Num $_.valor } | measure -Sum).Sum, (($_.Group | % { Num $_.valor } | measure -Sum).Sum / $fnm) }
'--- o que comprou (top 12)'; $nm | Group { (Fix $_.produto) -replace '^Teorema Militar - ', 'TM - ' } | Sort { -($_.Group | % { Num $_.valor } | measure -Sum).Sum } | select -First 12 | % { '  {0,-45} {1,5} R$ {2,11:N0}' -f $_.Name.Substring(0, [math]::Min(45, $_.Name.Length)), $_.Count, ($_.Group | % { Num $_.valor } | measure -Sum).Sum }
'--- por ano'; $nm | Group { $_.data.Substring(0, 4) } | Sort Name | % { '  {0} {1,5} R$ {2,11:N0}' -f $_.Name, $_.Count, ($_.Group | % { Num $_.valor } | measure -Sum).Sum }
