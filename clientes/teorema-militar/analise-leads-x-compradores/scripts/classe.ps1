function Classe($r){
  $s="$($r.source)".ToLower().Trim(); $m="$($r.medium)".ToLower().Trim(); $aud=("$($r.medium) $($r.term) $($r.campaign)").ToLower()
  if(($s -eq '' -or $s -eq 'sem origem') -and ($m -eq '' -or $m -eq 'sem origem')){ return 'Sem origem' }
  $pago = ($s -match 'ads|paid|facebook|^fb|meta|yt_p|youtube_p|pf_|site_source') -or ($m -match '^ads$|paid|cpc|^\d+\s*[-+]') -or ($aud -match '(^|[^a-z])p[fq]([^a-z]|$)')
  if(-not $pago){ return 'Quente orgânico' }
  if($aud -match '(^|[^a-z])ll([^a-z]|$)|lookalike|interesse|advantage|aberto|pais de|concurseiro'){ return 'Frio (PF)' }
  if($aud -match 'envolvimento|engajamento|leads? active|lista lead|pageview|page view|checkout|compra|visitante'){ return 'Quente pago (PQ)' }
  $all=("$s $aud")
  if($all -match '(^|[^a-z])pf([^a-z]|$)'){ return 'Frio (PF)' }
  if($all -match '(^|[^a-z])pq([^a-z]|$)'){ return 'Quente pago (PQ)' }
  return 'Pago sem público'
}
