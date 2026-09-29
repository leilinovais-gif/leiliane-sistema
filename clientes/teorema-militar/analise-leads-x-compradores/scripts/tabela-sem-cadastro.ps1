# Tabela pra Leili revisar: cada pessoa que comprou (ago/2023 em diante) sem ter se cadastrado antes, com tudo o que se sabe dela.
# Sai em dados/compradores-sem-cadastro.csv (abre no Excel; fica só no computador, tem dado pessoal).
$inv = [Globalization.CultureInfo]::InvariantCulture
$dados = Join-Path $PSScriptRoot '..\dados'
$L = Import-Csv "$dados\leads-unificados.csv" -Delimiter ';' -Encoding UTF8
$H = Import-Csv "$dados\hotmart-vendas.csv" -Delimiter ';' -Encoding UTF8
$AC = Import-Csv "$dados\ac-contatos.csv" -Delimiter ';' -Encoding UTF8
$CT = Import-Csv "$dados\hotmart-compradores-contato.csv" -Delimiter ';' -Encoding UTF8
$lat = [Text.Encoding]::GetEncoding(28591)
function Fix($s) { if ($s -match 'Ã') { [Text.Encoding]::UTF8.GetString($lat.GetBytes($s)) } else { $s } }
function Num($x) { if (-not $x) { return 0 }; [double]::Parse(("$x" -replace ',', '.'), $inv) }
$INICIO = [datetime]'2023-08-01'
# cadastros por e-mail (inclui os ligados por telefone/nome)
$CAD = @{}; foreach ($r in $L) { $em = "$($r.email)".Trim().ToLower(); if (-not $em) { continue }; if (-not $CAD[$em]) { $CAD[$em] = New-Object System.Collections.ArrayList }; [void]$CAD[$em].Add($r) }
$ACE = @{}; foreach ($a in $AC) { $ACE[$a.email.Trim().ToLower()] = $a }
$TEL = @{}; foreach ($c in $CT) { if (-not $TEL[$c.email]) { $TEL[$c.email] = $c } }
$porPessoa = $H | Group { $_.email.Trim().ToLower() }
$saida = foreach ($g in $porPessoa) { $em = $g.Name; $vs = @($g.Group | Sort data); $prim = [datetime]$vs[0].data
  $noPeriodo = @($vs | ? { [datetime]$_.data -ge $INICIO }); if (-not $noPeriodo.Count) { continue }
  $cads = @(); if ($CAD[$em]) { $cads = @($CAD[$em] | ? { $_.base -ne 'ACTIVE (migrado)' } | Sort data) }
  $antes = @($cads | ? { [datetime]$_.data -lt $prim.Date }); if ($antes.Count) { continue }   # era lead antes: não entra na tabela
  $depois = @($cads | ? { [datetime]$_.data -ge $prim.Date }); $mig = $CAD[$em] -and @($CAD[$em] | ? { $_.base -eq 'ACTIVE (migrado)' }).Count
  $sit = if ($depois.Count) { 'entrou na base depois da compra' } elseif ($mig) { 'está no Active antigo, sem data' } else { 'não está em nenhuma base' }
  $a = $ACE[$em]; $ct = $TEL[$em]; $v1 = $noPeriodo[0]
  [pscustomobject]@{ situacao = $sit; email = $em; nome = $v1.nome; celular = $(if ($ct) { $ct.celular } else { '' })
    primeira_compra = $prim.ToString('yyyy-MM-dd'); compras_no_periodo = $noPeriodo.Count; total_no_periodo = [math]::Round(($noPeriodo | % { Num $_.valor } | measure -Sum).Sum, 2)
    produtos = (($noPeriodo | % { (Fix $_.produto) -replace '^(TM|Teorema Militar) - ', '' } | Select -Unique) -join ' | ')
    link_checkout_sck = $v1.sck; primeira_origem_src = $v1.src
    entrou_na_base_em = $(if ($depois.Count) { $depois[0].data } else { '' }); base_de_entrada = $(if ($depois.Count) { $depois[0].base } else { '' })
    utm_da_base = $(if ($depois.Count) { "$($depois[0].source) | $($depois[0].medium) | $($depois[0].campaign)" } else { '' })
    active_tags = $(if ($a) { ($a.tags -replace '@\d{4}-\d{2}-\d{2}', '') } else { '' }); active_utm = $(if ($a) { "$($a.source) | $($a.medium) | $($a.campaign)" } else { '' }) } }
$arq = "$dados\compradores-sem-cadastro.csv"
$saida | Sort total_no_periodo -Descending | Export-Csv $arq -NoTypeInformation -Encoding UTF8 -Delimiter ';'
"pessoas: $(@($saida).Count) | R$ {0:N0}" -f ($saida | measure total_no_periodo -Sum).Sum
$saida | Group situacao | % { "  {0,-36} {1,5} pessoas R$ {2,11:N0}" -f $_.Name, $_.Count, ($_.Group | measure total_no_periodo -Sum).Sum }
"arquivo: $arq"
