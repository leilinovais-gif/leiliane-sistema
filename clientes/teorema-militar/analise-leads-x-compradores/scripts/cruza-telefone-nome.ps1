# Acha o lead de quem comprou com um e-mail diferente do cadastro: por telefone (8 últimos dígitos) e por nome completo único.
# Pra cada comprador achado, acrescenta em leads-unificados.csv cópias dos cadastros do lead com o e-mail da compra
# (base e data originais), marcadas em "nome" com o prefixo [ligado por telefone] ou [ligado por nome]. Rodar de novo refaz do zero.
$dados = Join-Path $PSScriptRoot '..\dados'
$arq = "$dados\leads-unificados.csv"
$L = @(Import-Csv $arq -Delimiter ';' -Encoding UTF8 | ? { "$($_.nome)" -notmatch '^\[ligado por' })
$CT = Import-Csv "$dados\hotmart-compradores-contato.csv" -Delimiter ';' -Encoding UTF8
function Ph($p) { $d = ("$p" -replace '\D', ''); if ($d.Length -ge 10) { $d.Substring($d.Length - 8) } else { '' } }
function Nm($n) { $s = "$n".Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', ''; $s = ($s.ToLower() -replace '[^a-z ]', ' ' -replace '\s+', ' ').Trim(); if (($s -split ' ').Count -ge 2) { $s } else { '' } }
# índices da base de leads
$porEmail = @{}; $porTel = @{}; $porNome = @{}
foreach ($r in $L) { $em = "$($r.email)".Trim().ToLower(); if ($em) { $porEmail[$em] = 1 }
  $p = Ph $r.tel; if ($p) { if (-not $porTel[$p]) { $porTel[$p] = New-Object System.Collections.ArrayList }; [void]$porTel[$p].Add($r) }
  $n = Nm $r.nome; if ($n -and $em) { if (-not $porNome[$n]) { $porNome[$n] = @{} }; $porNome[$n][$em] = 1 } }
$regsPorEmail = $L | ? { $_.email } | Group { $_.email.Trim().ToLower() } -AsHashTable -AsString
# compradores (um por e-mail), e quantos compradores distintos têm cada nome
$comp = @{}; foreach ($c in $CT) { if (-not $comp[$c.email]) { $comp[$c.email] = $c } }
$nomeComp = @{}; foreach ($c in $comp.Values) { $n = Nm $c.nome; if ($n) { $nomeComp[$n] = [int]$nomeComp[$n] + 1 } }
$novos = New-Object System.Collections.ArrayList; $nTel = 0; $nNome = 0
foreach ($em in $comp.Keys) { if ($porEmail[$em]) { continue }; $c = $comp[$em]; $regs = $null; $como = ''
  foreach ($t in @($c.celular, $c.telefone)) { $p = Ph $t; if ($p -and $porTel[$p]) { $regs = @($porTel[$p]); $como = '[ligado por telefone]'; break } }
  if (-not $regs) { $n = Nm $c.nome; if ($n -and $porNome[$n] -and $porNome[$n].Count -eq 1 -and $nomeComp[$n] -eq 1) { $le = @($porNome[$n].Keys)[0]; $regs = @($regsPorEmail[$le]); $como = '[ligado por nome]' } }
  if (-not $regs) { continue }
  if ($como -like '*telefone*') { $nTel++ } else { $nNome++ }
  foreach ($r in $regs) { [void]$novos.Add([pscustomobject]@{ base = $r.base; email = $em; tel = $r.tel; nome = "$como $($r.nome)"; source = $r.source; medium = $r.medium; campaign = $r.campaign; content = $r.content; term = $r.term; data = $r.data }) } }
@($L) + @($novos) | Export-Csv $arq -NoTypeInformation -Encoding UTF8 -Delimiter ';'
"compradores com e-mail que não bate com nenhum lead: $(@($comp.Keys | ? { -not $porEmail[$_] }).Count)"
"  achados pelo telefone: $nTel | pelo nome completo: $nNome | cadastros ligados: $($novos.Count)"
