$inv=[Globalization.CultureInfo]::InvariantCulture
$T='C:\Users\User\.claude\projects\C--CLAUDE-170926\253da796-9b35-4f97-ba28-eb2fff3b18e7\tool-results\'
$arqs=@{ '2023'='mcp-ad9b8a43-d7e1-46b4-ab9b-32e275a1d8cd-ads_get_ad_entities-1790614217736.txt'; '2024'='mcp-ad9b8a43-d7e1-46b4-ab9b-32e275a1d8cd-ads_get_ad_entities-1790614237922.txt'; '2025'='mcp-ad9b8a43-d7e1-46b4-ab9b-32e275a1d8cd-ads_get_ad_entities-1790614242940.txt'; '2026'='mcp-ad9b8a43-d7e1-46b4-ab9b-32e275a1d8cd-ads_get_ad_entities-1790614248823.txt' }
$src = Get-Content "$PSScriptRoot\escola.ps1" -Raw; $i=$src.IndexOf('function Escola'); $j=$src.IndexOf('function Grp'); Invoke-Expression $src.Substring($i,$j-$i)
function Pub($adset,$camp){ $a=" $adset ".ToLower(); $c=" $camp ".ToLower()
  if($a -match '(^|[^a-z])ll([^a-z]|$)|lookalike|interesse|advantage|aberto|pais de|concurseiro|(^|[^a-z])pf([^a-z]|$)|amplo|broad'){ return 'Frio (PF)' }
  if($a -match 'envolvimento|engajamento|leads? active|lista|pageview|page view|checkout|compra|visitante|(^|[^a-z])pq([^a-z]|$)|remarketing|rmkt|seguidores|video view|(^|[^a-z])vv([^a-z]|$)'){ return 'Quente (PQ)' }
  if($c -match '(^|[^a-z])pf([^a-z]|$)'){ return 'Frio (PF)' }
  if($c -match '(^|[^a-z])pq([^a-z]|$)'){ return 'Quente (PQ)' }
  return 'Sem classificação' }
function Tipo($camp){ $c=$camp.ToLower(); if($c -match 'capta|leads?([^a-z]|$)|cadastro|inscri'){'Captação (leads)'} elseif($c -match 'venda|convers|compra|carrinho|remarketing|pp |perp|descoberta|checkout'){'Vendas / perpétuo'} elseif($c -match 'engaj|envolv|video|vv|alcance|seguid|impuls|boost|post'){'Engajamento / conteúdo'} else {'Outros'} }
$all=foreach($ano in ($arqs.Keys|Sort)){ $rows=(Get-Content ($T+$arqs[$ano]) -Raw -Encoding UTF8 | ConvertFrom-Json).ad_entities | ConvertFrom-Json
  foreach($r in $rows){ [pscustomobject]@{ano=$ano; conjunto=$r.name; campanha=$r.campaign_name; gasto=$(if($r.amount_spent -and $r.amount_spent.value){[double]::Parse(("$($r.amount_spent.value)" -replace ",",""),$inv)}else{0}); publico=(Pub $r.name $r.campaign_name); tipo=(Tipo $r.campaign_name); escola=(Escola "$($r.campaign_name)")} } }
$all | Export-Csv 'C:\CLAUDE 170926\clientes\teorema-militar\analise-leads-x-compradores\meta-gasto-por-conjunto.csv' -NoTypeInformation -Encoding UTF8 -Delimiter ';'
"conjuntos: $($all.Count) | total R$ {0:N2}" -f ($all|measure gasto -Sum).Sum
"--- por ano"; $all|Group ano|Sort Name|%{ "  {0} R$ {1,12:N2}" -f $_.Name,($_.Group|measure gasto -Sum).Sum }
"--- por público"; $all|Group publico|Sort Name|%{ "  {0,-18} R$ {1,12:N2} {2:P0}" -f $_.Name,($_.Group|measure gasto -Sum).Sum,(($_.Group|measure gasto -Sum).Sum/($all|measure gasto -Sum).Sum) }
"--- ano x público"; foreach($a in ($all|Group ano|Sort Name)){ $t=($a.Group|measure gasto -Sum).Sum; "  $($a.Name): " + (($a.Group|Group publico|Sort Name|%{ "{0} R$ {1:N0} ({2:P0})" -f $_.Name,($_.Group|measure gasto -Sum).Sum,(($_.Group|measure gasto -Sum).Sum/$t) }) -join ' | ') }
"--- tipo de campanha"; $all|Group tipo|Sort Name|%{ "  {0,-24} R$ {1,12:N2}" -f $_.Name,($_.Group|measure gasto -Sum).Sum }
"--- tipo x público"; $all|Group tipo,publico|Sort Name|%{ "  {0,-44} R$ {1,12:N2}" -f $_.Name,($_.Group|measure gasto -Sum).Sum }
"--- escola (pela campanha)"; $all|Group escola|Sort {-($_.Group|measure gasto -Sum).Sum}|%{ "  {0,-24} R$ {1,12:N2}" -f $_.Name,($_.Group|measure gasto -Sum).Sum }
"--- maiores 'Sem classificação'"; $all|?{$_.publico -eq 'Sem classificação'}|Sort gasto -desc|select -First 15|%{ "  R$ {0,9:N0} | {1} | {2}" -f $_.gasto,$_.conjunto,$_.campanha }
