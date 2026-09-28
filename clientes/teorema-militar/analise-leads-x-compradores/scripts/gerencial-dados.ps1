# Monta os números do relatório gerencial (retrato). Saída: gerencial.json
$inv=[Globalization.CultureInfo]::InvariantCulture
$LEADS = Import-Csv "$PSScriptRoot\..\dados\leads-unificados.csv" -Delimiter ';' -Encoding UTF8
$HMV = Import-Csv "$PSScriptRoot\..\dados\hotmart-vendas.csv" -Delimiter ';' -Encoding UTF8
$GASTO = Import-Csv 'C:\CLAUDE 170926\clientes\teorema-militar\analise-leads-x-compradores\meta-gasto-por-conjunto.csv' -Delimiter ';' -Encoding UTF8
. "$PSScriptRoot\classe.ps1"
$src = Get-Content "$PSScriptRoot\escola.ps1" -Raw -Encoding UTF8; $i=$src.IndexOf('function Escola'); $j=$src.IndexOf('function Grp'); Invoke-Expression $src.Substring($i,$j-$i)
$HOJE=[datetime]'2026-09-28'
$lat=[Text.Encoding]::GetEncoding(28591)
function Fix($s){ if($s -match 'Ã'){ [Text.Encoding]::UTF8.GetString($lat.GetBytes($s)) } else { $s } }
function Num($x){ if(-not $x){return 0}; [double]::Parse(("$x" -replace ',','.'),$inv) }
function EscolaProd($p){ $e=Escola $p; if($e -eq 'Outros / matérias'){ if($p -match 'Edition|Combo|Geografia|Hist|Ingl|Portug|Reda'){ 'Matérias (cursos avulsos)' } else { 'Outros' } } else { $e } }
function Grupo($x){ switch -wildcard($x){ 'Frio*'{'frio'} 'Quente org*'{'org'} 'Quente pago*'{'pq'} default{'semorigem'} } }
function Plat($r){ $s="$($r.source)".ToLower(); $m="$($r.medium) $($r.campaign)".ToLower()
  if($s -match 'youtube_p|yt_p|pf_yt|yt_ads' -or ($s -match 'youtube|yt' -and $m -match 'paid|ads')){ return 'youtube' }
  if($s -match 'facebook|^fb|meta|instagram|^ig' -and ($m -match 'ads|paid|\d+ -' -or $s -match 'ads|_p[fq]|\.p[fq]')){ return 'meta' }
  if($s -match 'facebook|^fb|meta'){ return 'meta' }
  return 'org' }

# ---- vendas (sem cobrança repetida do mesmo produto em 60 dias)
$SALES=New-Object System.Collections.ArrayList; $seen=@{}
foreach($s in ($HMV|Sort data)){ $em=$s.email.Trim().ToLower(); $dd=[datetime]$s.data; $pr=(Fix $s.produto).Trim(); $k="$em|$pr"
  if($seen[$k] -and ($dd-$seen[$k]).TotalDays -lt 60){continue}; $seen[$k]=$dd
  [void]$SALES.Add([pscustomobject]@{em=$em; dt=$dd; ano=$dd.Year; prod=$pr; esc=(EscolaProd $pr); val=(Num $s.valor)}) }
$PRIM=@{}; foreach($s in $SALES){ if(-not $PRIM.ContainsKey($s.em)){ $PRIM[$s.em]=$s.dt } }
$FV=@{}; foreach($s in $SALES){ if(-not $FV[$s.em]){$FV[$s.em]=New-Object System.Collections.ArrayList}; [void]$FV[$s.em].Add($s) }

# ---- entrada de cada pessoa (primeiro cadastro com data)
$ENT=@{}
foreach($r in $LEADS){ if(-not $r.email -or $r.base -eq 'ACTIVE (migrado)'){continue}; $dd=[datetime]$r.data
  if(-not $ENT[$r.email] -or $dd -lt $ENT[$r.email].d){
    $es= if($r.base -like 'ACTIVE*'){ Escola "$($r.campaign) $($r.term)" } else { Escola $r.base }
    $ENT[$r.email]=[pscustomobject]@{d=$dd; esc=$es; pub=(Grupo (Classe $r)); plat=(Plat $r); lead=$true; base=$r.base} } }
# lead de verdade = entrou antes da primeira compra (regra da Leili: chegou no dia da compra ou depois = aluno)
foreach($em in @($ENT.Keys)){ if($PRIM.ContainsKey($em) -and $PRIM[$em].Date -le $ENT[$em].d){ $ENT[$em].lead=$false } }
$MIG=@{}; foreach($r in $LEADS){ if($r.base -eq 'ACTIVE (migrado)' -and $r.email){ $MIG[$r.email]=1 } }

# ---- origem de cada venda
foreach($s in $SALES){ $o='nunca'; $en=$ENT[$s.em]; $el=$null; $dias=$null; $pl=''
  if($en -and $en.lead -and $en.d -lt $s.dt.Date){ $o=$en.pub; $el=$en.esc; $dias=[int]($s.dt.Date-$en.d).TotalDays; $pl=$en.plat }
  elseif($PRIM[$s.em] -lt $s.dt.AddDays(-1)){ $o='aluno' }
  elseif($MIG[$s.em]){ $o='active' }
  $s | Add-Member origem $o; $s | Add-Member escLead $el; $s | Add-Member dias $dias; $s | Add-Member plat $pl }
$ORIG='frio','pq','org','semorigem','aluno','active','nunca'
function Divide($lista){ $h=[ordered]@{}; foreach($o in $ORIG){ $g=@($lista|?{$_.origem -eq $o}); $h[$o]=[ordered]@{n=$g.Count; fat=[math]::Round(($g|measure val -Sum).Sum,0)} }; $h }
foreach($x in $GASTO){ $x | Add-Member g (Num $x.gasto); $x | Add-Member esc (Escola $x.campanha) }
function SomaGasto($lista){ [math]::Round(($lista|measure g -Sum).Sum,0) }

$D=[ordered]@{}
$D.geradoEm=$HOJE.ToString('yyyy-MM-dd')
$D.cobertura=[ordered]@{ vendasDesde='2023-01'; metaDesde='2023-08'; leadsPessoas=@($ENT.Values|?{$_.lead}).Count; vendas=$SALES.Count;
  bases='OP.BB23, OP.ESPCEX.24, PLANO.ESPCEX.24, P.VIDA.24, OP.BB24, OP.ESPCEX.25, MAT.BAS.25, OP.BB.25, OP.ESPCEX.26, MAT.BAS.26 e os cadastros de 2026 do ActiveCampaign' }

# 1) por ano
$D.anos=@(foreach($a in 2023..2026){ $g=@($SALES|?{$_.ano -eq $a}); $ga=@($GASTO|?{$_.ano -eq "$a"})
  [ordered]@{ ano=$a; vendas=$g.Count; fat=[math]::Round(($g|measure val -Sum).Sum,0); meta=(SomaGasto $ga); metaFrio=(SomaGasto @($ga|?{$_.publico -eq 'Frio (PF)'})); metaPQ=(SomaGasto @($ga|?{$_.publico -eq 'Quente (PQ)'})); origem=(Divide $g) } })

# 2) por escola (do produto) x ano
$D.escolas=@(foreach($ge in ($SALES|Group esc|Sort { -($_.Group|measure val -Sum).Sum })){ $e=$ge.Name; $gg=@($GASTO|?{$_.esc -eq $e})
  [ordered]@{ escola=$e; vendas=$ge.Count; fat=[math]::Round(($ge.Group|measure val -Sum).Sum,0); meta=(SomaGasto $gg); origem=(Divide $ge.Group)
    anos=@(foreach($a in 2023..2026){ $g=@($ge.Group|?{$_.ano -eq $a}); [ordered]@{ ano=$a; vendas=$g.Count; fat=[math]::Round(($g|measure val -Sum).Sum,0); meta=(SomaGasto @($gg|?{$_.ano -eq "$a"})); origem=(Divide $g) } }) } })
$D.gastoSemEscola=(SomaGasto @($GASTO|?{$_.esc -eq 'Outros / matérias'}))
$D.gastoPorEscola=@($GASTO|Group esc|Sort { -($_.Group|measure g -Sum).Sum }|%{ [ordered]@{ escola=$_.Name; total=(SomaGasto $_.Group); anos=@(foreach($a in 2023..2026){ SomaGasto @($_.Group|?{$_.ano -eq "$a"}) }) } })

# 3) por produto
$D.produtos=@(foreach($g in ($SALES|Group prod|Sort { -($_.Group|measure val -Sum).Sum })){ $l=@($g.Group|?{$_.dias -ne $null}); $ds=@($l|%{$_.dias}|Sort)
  [ordered]@{ produto=$g.Name; escola=$g.Group[0].esc; vendas=$g.Count; fat=[math]::Round(($g.Group|measure val -Sum).Sum,0); origem=(Divide $g.Group); medianaDias=$(if($ds.Count){$ds[[int]($ds.Count/2)]}else{$null}) } })

# 4) matriz: onde o lead entrou -> o que comprou
$LEADPES=@($ENT.Keys|?{$ENT[$_].lead})
$vl=@($SALES|?{$_.dias -ne $null})
$D.matriz=@(foreach($g in ($vl|Group escLead|Sort { -($_.Group|measure val -Sum).Sum })){ $nome=$g.Name; $pessoas=@($LEADPES|?{$ENT[$_].esc -eq $nome}).Count
  [ordered]@{ escolaLead=$nome; leads=$pessoas; compradores=@($g.Group|%{$_.em}|Select -Unique).Count; compras=$g.Count; fat=[math]::Round(($g.Group|measure val -Sum).Sum,0)
    porEscolaProduto=@($g.Group|Group esc|Sort { -($_.Group|measure val -Sum).Sum }|%{ [ordered]@{ escola=$_.Name; n=$_.Count; fat=[math]::Round(($_.Group|measure val -Sum).Sum,0) } })
    topProdutos=@($g.Group|Group prod|Sort Count -desc|select -First 12|%{ $ds=@($_.Group|%{$_.dias}|Sort); [ordered]@{ produto=$_.Name; n=$_.Count; frio=@($_.Group|?{$_.origem -eq 'frio'}).Count; fat=[math]::Round(($_.Group|measure val -Sum).Sum,0); medianaDias=$ds[[int]($ds.Count/2)] } }) } })

# 5) tempo até a 1a compra: curva por escola de entrada x público
$PES=@(foreach($em in $LEADPES){ $en=$ENT[$em]; $f=$null; if($PRIM.ContainsKey($em)){ $f=[int]($PRIM[$em].Date-$en.d).TotalDays }
  [pscustomobject]@{em=$em; esc=$en.esc; pub=$en.pub; plat=$en.plat; ano=$en.d.Year; exp=[int]($HOJE-$en.d).TotalDays; dias=$f; base=$en.base} })
function Curva($g){ $c=[ordered]@{}; foreach($H in 30,90,180,365,730){ $el=@($g|?{$_.exp -ge $H}); $c["d$H"]= if($el.Count -ge 100){ [math]::Round(100*@($el|?{$_.dias -ne $null -and $_.dias -le $H}).Count/$el.Count,2) } else { $null }; $c["n$H"]=$el.Count }; $c }
$D.tempo=@(foreach($e in 'EsPCEx','Barro Branco','Matemática Básica','Projeto de Vida','(todas)'){ foreach($pb in 'frio','quente'){
  $g=@($PES|?{ ($e -eq '(todas)' -or $_.esc -eq $e) -and $(if($pb -eq 'frio'){$_.pub -eq 'frio'}else{$_.pub -in 'org','pq'}) })
  $b=@($g|?{$_.dias -ne $null}|%{$_.dias}|Sort)
  [ordered]@{ escola=$e; publico=$pb; leads=$g.Count; compraram=$b.Count; mediana=$(if($b.Count){$b[[int]($b.Count/2)]}else{$null}); p75=$(if($b.Count){$b[[int]($b.Count*3/4)]}else{$null}); depois90=$(if($b.Count){[math]::Round(100*@($b|?{$_ -gt 90}).Count/$b.Count,0)}else{$null}); curva=(Curva $g) } } })

# 6) frio do Meta: gasto x retorno por ano de entrada
$D.frio=@(foreach($a in 2023..2026){ $gastoAno=(SomaGasto @($GASTO|?{$_.ano -eq "$a" -and $_.publico -eq 'Frio (PF)'}))
  $ls=@($PES|?{ $_.ano -eq $a -and $_.pub -eq 'frio' -and $_.plat -eq 'meta' })
  $f90=0;$f365=0;$ft=0;$comp=0
  foreach($p in $ls){ if($FV[$p.em]){ $comp++; $d0=$ENT[$p.em].d; foreach($s in $FV[$p.em]){ $dd=($s.dt.Date-$d0).TotalDays; $ft+=$s.val; if($dd -le 90){$f90+=$s.val}; if($dd -le 365){$f365+=$s.val} } } }
  [ordered]@{ ano=$a; gasto=$gastoAno; leads=$ls.Count; compraram=$comp; fat90=[math]::Round($f90,0); fat365=[math]::Round($f365,0); fatTotal=[math]::Round($ft,0) } })

# 7) leads por ano de entrada
$D.leads=@(foreach($a in 2023..2026){ $g=@($PES|?{$_.ano -eq $a})
  [ordered]@{ ano=$a; total=$g.Count; frio=@($g|?{$_.pub -eq 'frio'}).Count; pq=@($g|?{$_.pub -eq 'pq'}).Count; org=@($g|?{$_.pub -eq 'org'}).Count; semorigem=@($g|?{$_.pub -eq 'semorigem'}).Count
    porEscola=@($g|Group esc|Sort Count -desc|%{ [ordered]@{ escola=$_.Name; n=$_.Count; frio=@($_.Group|?{$_.pub -eq 'frio'}).Count; quente=@($_.Group|?{$_.pub -in 'org','pq'}).Count } }) } })

# 8) faturamento por lead nos 12 meses seguintes à entrada (base da projeção), por ano e público
$D.porLead12m=@(foreach($a in 2023..2025){ foreach($pb in 'frio','quente','todos'){ $ls=@($PES|?{ $_.ano -eq $a -and $(if($pb -eq 'todos'){$true}elseif($pb -eq 'frio'){$_.pub -eq 'frio'}else{$_.pub -in 'org','pq'}) }); $f=0
  foreach($p in $ls){ if($FV[$p.em]){ $d0=$ENT[$p.em].d; foreach($s in $FV[$p.em]){ $dd=($s.dt.Date-$d0).TotalDays; if($dd -gt 0 -and $dd -le 365){$f+=$s.val} } } }
  [ordered]@{ ano=$a; publico=$pb; leads=$ls.Count; fat12m=[math]::Round($f,0); porLead=[math]::Round($f/[math]::Max(1,$ls.Count),2) } } })

# 9) maturação: quanto do faturamento de 2 anos acontece em cada prazo (leads com 2+ anos de base) e projeção de cada turma pra 2 anos
# Projeção de um lead que ainda não fez 2 anos = o que ele já comprou (até 730 dias) + o que um lead maduro do mesmo público comprou entre a idade dele e 730 dias.
function RecAte($p, $dmax) { $t = 0; if ($FV[$p.em]) { $d0 = $ENT[$p.em].d; foreach ($s in $FV[$p.em]) { $dd = ($s.dt.Date - $d0).TotalDays; if ($dd -gt 0 -and $dd -le $dmax) { $t += $s.val } } }; $t }
function GrupoPub($p, $pb) { if ($pb -eq 'frio') { $p.pub -eq 'frio' } elseif ($pb -eq 'frioMeta') { $p.pub -eq 'frio' -and $p.plat -eq 'meta' } elseif ($pb -eq 'quente') { $p.pub -in 'org', 'pq' } else { $true } }
$D.maturacao = @(foreach ($pb in 'frio', 'quente', 'todos') {
  $mad = @($PES | ? { $_.exp -ge 730 -and (GrupoPub $_ $pb) })
  $tot = 0; foreach ($p in $mad) { $tot += (RecAte $p 730) }
  $c = [ordered]@{ publico = $pb; leadsMaduros = $mad.Count; porLead2anos = [math]::Round($tot / [math]::Max(1, $mad.Count), 2) }
  foreach ($H in 30, 90, 180, 365) { $x = 0; foreach ($p in $mad) { $x += (RecAte $p $H) }; $c["ate$H"] = [math]::Round(100 * $x / [math]::Max(1, $tot), 0) }
  $c })
# curva média acumulada por lead maduro (faturamento até o dia d), pra projetar
$CUR = @{}
foreach ($pb in 'frioMeta', 'frio', 'quente', 'todos') { $mad = @($PES | ? { $_.exp -ge 730 -and (GrupoPub $_ $pb) }); $arr = New-Object 'double[]' 731
  foreach ($p in $mad) { if ($FV[$p.em]) { $d0 = $ENT[$p.em].d; foreach ($s in $FV[$p.em]) { $dd = [int]($s.dt.Date - $d0).TotalDays; if ($dd -gt 0 -and $dd -le 730) { $arr[$dd] += $s.val } } } }
  for ($k = 1; $k -le 730; $k++) { $arr[$k] += $arr[$k - 1] }; for ($k = 0; $k -le 730; $k++) { $arr[$k] = $arr[$k] / [math]::Max(1, $mad.Count) }; $CUR[$pb] = $arr }
# Projeção proporcional: cada turma segue o próprio ritmo. Se aos N dias um lead maduro já tinha feito F% do faturamento de 2 anos,
# a turma é projetada como realizado × leads ÷ soma(F de cada lead). Turma que já passou de 2 anos fica igual ao realizado.
function Projeta($lista, $pb) { $real = 0; $sf = 0; foreach ($p in $lista) { $real += (RecAte $p 730); $e = [math]::Min(730, [math]::Max(0, $p.exp)); $sf += ($CUR[$pb][$e] / [math]::Max(0.01, $CUR[$pb][730])) }
  @{ real = $real; proj = $(if ($sf -gt 0) { $real * $lista.Count / $sf } else { $real }) } }
$D.turmas = @(foreach ($a in 2023..2026) { foreach ($pb in 'frio', 'quente', 'todos') { $ls = @($PES | ? { $_.ano -eq $a -and (GrupoPub $_ $pb) }); $r = Projeta $ls $pb
  [ordered]@{ ano = $a; publico = $pb; leads = $ls.Count; idadeMedia = [int](($ls | measure exp -Average).Average); realizado = [math]::Round($r.real, 0); projecao2anos = [math]::Round($r.proj, 0) } } })
foreach ($f in $D.frio) { $ls = @($PES | ? { $_.ano -eq $f.ano -and $_.pub -eq 'frio' -and $_.plat -eq 'meta' }); $r = Projeta $ls 'frioMeta'; $f['realizado2anos'] = [math]::Round($r.real, 0); $f['projecao2anos'] = [math]::Round($r.proj, 0) }

# 10) por lançamento: investimento em captação (Meta + Google/YouTube) x o que os leads daquele lançamento compraram em 2 anos
# Só entram lançamentos em que temos as duas pontas: o gasto (pelo nome da campanha) e a planilha de leads (pela base de entrada).
$GOO = @(Import-Csv "$PSScriptRoot\..\dados\google-ads-gasto-mensal.csv" -Encoding UTF8 | % { [pscustomobject]@{ ano = $_.mes.Substring(0, 4); campanha = $_.campanha; g = [double]::Parse($_.gasto, $inv) } })
function EhCaptacao($c) { $u = $c.ToUpper(); ($u -match 'CAPTA|CADASTRO|LEADS|DISTRIBUI') -and ($u -notmatch 'CARRINHO|VENDA|LEMBRETE|AQUEC|CONVERS') }
function PubGoogle($c) { $u = " $($c.ToUpper()) "; if ($u -match '[^A-Z]PF[^A-Z]') { 'frio' } elseif ($u -match '[^A-Z]PQ[^A-Z]') { 'quente' } else { '' } }
function PubMeta($x) { if ($x.publico -eq 'Frio (PF)') { 'frio' } elseif ($x.publico -eq 'Quente (PQ)') { 'quente' } else { '' } }
$LANC = @(
  @{ nome = 'Barro Branco 2023 (OP.BB23)'; escola = 'Barro Branco'; base = 'OP.BB23'; re = 'OP\.APMBB\.23' },
  @{ nome = 'EsPCEx 2024 (feita em 2023)'; escola = 'EsPCEx'; base = 'OP.ESPCEX.24'; re = 'OP\.ESPCEX\.(SET\.)?24' },
  @{ nome = 'Plano EsPCEx 2024'; escola = 'EsPCEx'; base = 'PLANO.ESPCEX.24'; re = 'PLANO\.?ESPCEX\.?24' },
  @{ nome = 'Projeto de Vida 2024'; escola = 'Projeto de Vida'; base = 'P.VIDA.24'; re = 'P\.VIDA\.24' },
  @{ nome = 'Barro Branco 2024'; escola = 'Barro Branco'; base = 'OP.BB24'; re = 'OP\.APMBB\.24' },
  @{ nome = 'EsPCEx 2025 (feita em 2024)'; escola = 'EsPCEx'; base = 'OP.ESPCEX.25'; re = 'OP\.ESPCEX\.25' },
  @{ nome = 'Matemática Básica 2025'; escola = 'Matemática Básica'; base = 'MAT.BAS.25'; re = 'MAT\.BAS\.25' },
  @{ nome = 'Barro Branco 2025'; escola = 'Barro Branco'; base = 'OP.BB.25'; re = 'OP\.BB\.?25' },
  @{ nome = 'EsPCEx 2026 (feita em 2025)'; escola = 'EsPCEx'; base = 'OP.ESPCEX.26'; re = 'OP\.ESPCEX\.26' },
  @{ nome = 'Matemática Básica 2026'; escola = 'Matemática Básica'; base = 'MAT.BAS.26'; re = 'MAT\.BAS\.26|DMB\.26' },
  @{ nome = 'Captações de 2026 (MEGAs, BB 26, ESA 27, EsPCEx 27...)'; escola = 'Várias'; base = 'ACTIVE (2026)'; re = 'MEGA\.|OP\.ESA\.27|OP\.BB\.26|OP\.ESPCEX\.27|JCM\.26|TRIPLICE\.27' })
$D.lancamentos = @(foreach ($L in $LANC) {
  $gm = @($GASTO | ? { $_.campanha -match $L.re -and (EhCaptacao $_.campanha) }); $gg = @($GOO | ? { $_.campanha -match $L.re -and (EhCaptacao $_.campanha) })
  $investe = [ordered]@{ frioMeta = [math]::Round((@($gm | ? { (PubMeta $_) -eq 'frio' }) | measure g -Sum).Sum, 0); frioGoogle = [math]::Round((@($gg | ? { (PubGoogle $_.campanha) -eq 'frio' }) | measure g -Sum).Sum, 0)
    quenteMeta = [math]::Round((@($gm | ? { (PubMeta $_) -eq 'quente' }) | measure g -Sum).Sum, 0); quenteGoogle = [math]::Round((@($gg | ? { (PubGoogle $_.campanha) -eq 'quente' }) | measure g -Sum).Sum, 0)
    outrosCaptacao = [math]::Round((@($gm | ? { -not (PubMeta $_) }) | measure g -Sum).Sum + (@($gg | ? { -not (PubGoogle $_.campanha) }) | measure g -Sum).Sum, 0) }
  $lf = @($PES | ? { $_.base -eq $L.base -and $_.pub -eq 'frio' }); $lq = @($PES | ? { $_.base -eq $L.base -and $_.pub -eq 'pq' }); $lo = @($PES | ? { $_.base -eq $L.base -and $_.pub -in 'org', 'semorigem' })
  $pf = Projeta $lf 'frio'; $pq = Projeta $lq 'quente'
  [ordered]@{ nome = $L.nome; escola = $L.escola; base = $L.base; ano = $(if ($lf.Count) { ($lf | Group ano | Sort Count -desc)[0].Name } else { '' }); idadeDias = [int](($lf | measure exp -Average).Average)
    invest = $investe; leadsFrio = $lf.Count; leadsQuente = $lq.Count; leadsOrg = $lo.Count
    frioComprou = @($lf | ? { $_.dias -ne $null -and $_.dias -le 730 }).Count; frioRealizado = [math]::Round($pf.real, 0); frioProjecao = [math]::Round($pf.proj, 0)
    quenteComprou = @($lq | ? { $_.dias -ne $null -and $_.dias -le 730 }).Count; quenteRealizado = [math]::Round($pq.real, 0); quenteProjecao = [math]::Round($pq.proj, 0) } })
$D.google = [ordered]@{ total = [math]::Round(($GOO | measure g -Sum).Sum, 0); desde = '2023-01'; anos = @(foreach ($a in 2023..2026) { [math]::Round((@($GOO | ? { $_.ano -eq "$a" }) | measure g -Sum).Sum, 0) }) }
foreach ($x in $D.anos) { $x['google'] = [math]::Round((@($GOO | ? { $_.ano -eq "$($x.ano)" }) | measure g -Sum).Sum, 0) }

$D | ConvertTo-Json -Depth 10 -Compress | Set-Content "$PSScriptRoot\..\dados\gerencial.json" -Encoding UTF8
"ok: $((Get-Item "$PSScriptRoot\..\dados\gerencial.json").Length) bytes"
