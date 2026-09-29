# Acrescenta a base histórica do Supabase (2022 a 25/09/2025, com data) no fim de leads-unificados.csv, como base 'SUPABASE'.
# As planilhas vêm antes no arquivo: em data igual, vale a planilha (que diz o lançamento).
$dados = Join-Path $PSScriptRoot '..\dados'
$arq = "$dados\leads-unificados.csv"
$L = @(Import-Csv $arq -Delimiter ';' -Encoding UTF8 | ? { $_.base -ne 'SUPABASE' })
$S = Import-Csv "$dados\supabase-leads.csv" -Delimiter ';' -Encoding UTF8
$novos = foreach ($x in $S) { $em = "$($x.email)".Trim().ToLower(); if ($em -notmatch '@' -and -not $x.telefone) { continue }
  $camp = if ($x.utm_campaign) { $x.utm_campaign } else { ("$($x.tags)" -split '[,;|]')[0].Trim() }
  [pscustomobject]@{ base = 'SUPABASE'; email = $(if ($em -match '@') { $em } else { '' }); tel = $x.telefone; nome = $x.nome; source = $x.utm_source; medium = $x.utm_medium; campaign = $camp; content = $x.utm_content; term = $x.utm_term; data = ([datetime]$x.data).ToString('yyyy-MM-dd') } }
@($L) + @($novos) | Export-Csv $arq -NoTypeInformation -Encoding UTF8 -Delimiter ';'
"planilhas + Active: $($L.Count) | Supabase: $(@($novos).Count) | total: $($L.Count + @($novos).Count)"
