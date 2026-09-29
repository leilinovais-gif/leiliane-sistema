// ================================================================ Relatório gerencial (retrato, beta)
// Relatório simples, em 4 partes: investimento x faturamento ao longo do tempo (e de onde veio cada venda),
// o que cada lançamento vendeu (inclusive de outros cursos), curso individual -> Full e quanto tempo o lead leva pra comprar.
// Não é painel diário: os números ficam em GERENCIAL_DADOS (bloco gerado no computador da Leili por
// clientes/teorema-militar/analise-leads-x-compradores/scripts/atualizar-gerencial.ps1). Refazer a cada 3 ou 6 meses.

function paginaGerencial() {
  const t = HUB.tema;
  const dados = JSON.stringify(GERENCIAL_DADOS).replace(/</g, '\\u003c');
  return PAGINA_GERENCIAL
    .replace('__TEMA__', '--bg:' + COR(t.bg) + '; --card:' + COR(t.card) + '; --line:' + COR(t.line) + '; --accent:' + COR(t.accent) + '; --text-weak:' + COR(t.textWeak) + '; --text:' + COR(t.text) + ';')
    .replace('__DADOS__', () => dados);
}

const PAGINA_GERENCIAL = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Relatório gerencial — Relatórios</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&family=Titillium+Web:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root { __TEMA__
    /* séries: paleta categórica validada (passos do modo escuro), ordem fixa */
    --s-frio:#3987e5; --s-pq:#d95926; --s-org:#199e70; --s-nao:#5f6a5c; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--text); font-family:'Titillium Web',sans-serif; padding:32px 16px 64px; line-height:1.45; }
  .wrap { max-width:1080px; margin:0 auto; }
  h1,h2,.num { font-family:'Big Shoulders Display',sans-serif; font-weight:800; text-transform:uppercase; letter-spacing:0.02em; }
  header { border-bottom:2px solid var(--accent); padding-bottom:20px; margin-bottom:8px; }
  .tag { font-size:12px; letter-spacing:0.15em; color:var(--accent); font-weight:700; text-transform:uppercase; }
  header h1 { font-size:clamp(30px,5vw,50px); line-height:1; margin-top:4px; }
  header p { color:var(--text-weak); margin-top:10px; }
  .parte { font-size:12px; letter-spacing:.15em; color:var(--accent); font-weight:700; text-transform:uppercase; margin:48px 0 2px; }
  .section-title { font-size:24px; padding-left:12px; border-left:4px solid var(--accent); }
  .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; margin-top:14px; }
  .kpi { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:18px; }
  .kpi .label { font-size:12px; color:var(--text-weak); text-transform:uppercase; letter-spacing:0.08em; }
  .kpi .num { font-size:32px; color:var(--text); margin-top:6px; }
  .kpi .sub { font-size:13px; color:var(--text-weak); margin-top:4px; }
  .kpi.destaque { border-color:var(--accent); } .kpi.destaque .num { color:var(--accent); }
  .rolar { overflow-x:auto; border:1px solid var(--line); border-radius:10px; margin-top:12px; }
  table { width:100%; border-collapse:collapse; background:var(--card); font-size:14px; }
  th,td { padding:10px 12px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
  th { background:#000; color:var(--accent); font-size:11px; text-transform:uppercase; letter-spacing:.06em; white-space:nowrap; }
  .c { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .fraco { color:var(--text-weak); font-size:12px; }
  tr.total td { font-weight:700; }
  tr:last-child td { border-bottom:0; }
  .legenda { display:flex; flex-wrap:wrap; gap:6px 16px; margin:14px 0 6px; font-size:13px; color:var(--text-weak); }
  .legenda span { display:inline-flex; align-items:center; gap:6px; }
  .legenda i { width:12px; height:12px; border-radius:3px; display:inline-block; }
  .barras { display:grid; gap:10px; }
  .linha-barra { display:grid; grid-template-columns:70px 1fr 110px; gap:12px; align-items:center; font-size:14px; }
  .linha-barra .rot { font-weight:600; }
  .linha-barra .tot { text-align:right; color:var(--text-weak); font-variant-numeric:tabular-nums; }
  .pilha { display:flex; gap:2px; height:26px; }
  .pilha div { height:100%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; color:#fff; overflow:hidden; white-space:nowrap; }
  .pilha div:first-child { border-radius:4px 0 0 4px; } .pilha div:last-child { border-radius:0 4px 4px 0; }
  .nota { font-size:12px; color:var(--text-weak); margin-top:8px; }
  footer { margin-top:48px; color:var(--text-weak); font-size:12px; border-top:1px solid var(--line); padding-top:14px; }
  #tip { position:fixed; pointer-events:none; background:#000; color:var(--text); border:1px solid var(--line); border-radius:6px; padding:8px 10px; font-size:13px; max-width:280px; z-index:10; display:none; }
  @media (max-width:760px) { .linha-barra { grid-template-columns:48px 1fr 80px; } }
</style>
</head>
<body>
<div class="wrap" id="app"></div>
<div id="tip"></div>
<script>
var D = __DADOS__;
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
function n0(v) { return Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits:0 }); }
function rs(v) { return 'R$ ' + n0(v); }
function rsk(v) { v = Number(v || 0); return v >= 1e6 ? 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits:2 }) + ' mi' : v >= 1e3 ? 'R$ ' + (v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits:0 }) + ' mil' : rs(v); }
function pc(a, b, d) { return b ? (100 * a / b).toLocaleString('pt-BR', { maximumFractionDigits: d == null ? 0 : d }) + '%' : '—'; }
function soma(l, f) { var t = 0; (l || []).forEach(function (x) { t += f(x) || 0; }); return t; }
function mes(d) { var p = String(d).split('-'); return p[1] + '/' + p[0]; }
function fat(o, ks) { return ks.reduce(function (s, k) { return s + ((o[k] && o[k].fat) || 0); }, 0); }

function montar() {
  var h = '', ate = mes(D.geradoEm);
  // grupos de origem de cada venda (pela forma como o comprador entrou na base antes da primeira compra)
  var G = [
    { nome:'Lead frio', cor:'var(--s-frio)', ks:['frio', 'semorigem', 'antigo', 'active', 'whats'] },
    { nome:'Lead quente', cor:'var(--s-pq)', ks:['pq'] },
    { nome:'Lead orgânico', cor:'var(--s-org)', ks:['org'] },
    { nome:'Sem cadastro antes da compra', cor:'var(--s-nao)', ks:['fora', 'aluno', 'nunca'] }
  ];
  var anos = D.anos || [], fatT = soma(anos, function (a) { return a.fat; }), invT = soma(anos, function (a) { return (a.meta || 0) + (a.google || 0); });
  var oT = {}; ['frio','pq','org','semorigem','antigo','active','whats','fora','aluno','nunca'].forEach(function (k) { oT[k] = { fat:soma(anos, function (a) { return a.origem[k] ? a.origem[k].fat : 0; }) }; });

  h += '<header><div class="tag">Relatório gerencial · retrato de ' + esc(D.geradoEm.split('-').reverse().join('/')) + '</div><h1>Investimento, vendas<br>e de onde vêm os alunos</h1>' +
    '<p>Ago/2023 a ' + ate + ' · anúncios do Meta e do Google · vendas da Hotmart</p></header>';

  // ---------- 1. investimento x faturamento
  h += '<div class="parte">Parte 1</div><h2 class="section-title">Quanto investimos e quanto faturamos</h2>';
  h += '<div class="kpi-grid"><div class="kpi"><div class="label">Investimos em anúncios</div><div class="num">' + rsk(invT) + '</div></div>' +
    '<div class="kpi destaque"><div class="label">Faturamos</div><div class="num">' + rsk(fatT) + '</div><div class="sub">cada R$ 1 investido: R$ ' + (fatT / invT).toLocaleString('pt-BR', { maximumFractionDigits:2 }) + '</div></div>' +
    '<div class="kpi"><div class="label">Vendas que ligamos a uma origem</div><div class="num">' + pc(fatT - fat(oT, G[3].ks), fatT) + '</div><div class="sub">' + rsk(fatT - fat(oT, G[3].ks)) + ' de quem já estava na base antes de comprar</div></div></div>';
  h += '<div class="legenda">' + G.map(function (g) { return '<span><i style="background:' + g.cor + '"></i>' + esc(g.nome) + '</span>'; }).join('') + '</div><div class="barras">' +
    anos.concat([{ ano:'Total', fat:fatT, origem:oT }]).map(function (a) {
      return '<div class="linha-barra"><div class="rot">' + a.ano + '</div><div class="pilha">' + G.map(function (g) { var v = fat(a.origem, g.ks), p = 100 * v / a.fat; if (!v) return '';
        return '<div style="flex:' + v + ';background:' + g.cor + '" data-tip="<b>' + a.ano + ' · ' + esc(g.nome) + '</b><br>' + rs(v) + ' (' + pc(v, a.fat) + ')">' + (p >= 8 ? Math.round(p) + '%' : '') + '</div>'; }).join('') + '</div><div class="tot">' + rsk(a.fat) + '</div></div>';
    }).join('') + '</div>';
  h += '<div class="rolar"><table><thead><tr><th>Ano</th><th class="c">Investimos</th><th class="c">Faturamos</th>' + G.map(function (g) { return '<th class="c">' + esc(g.nome) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    anos.concat([{ ano:'Total', fat:fatT, origem:oT, _inv:invT }]).map(function (a) { var inv = a._inv != null ? a._inv : (a.meta || 0) + (a.google || 0);
      return '<tr' + (a.ano === 'Total' ? ' class="total"' : '') + '><td>' + a.ano + (a.ano === 2023 ? '<br><span class="fraco">ago a dez</span>' : '') + (a.ano === 2026 ? '<br><span class="fraco">até ' + ate + '</span>' : '') + '</td><td class="c">' + rs(inv) + '</td><td class="c">' + rs(a.fat) + '</td>' +
        G.map(function (g) { var v = fat(a.origem, g.ks); return '<td class="c">' + rs(v) + '<br><span class="fraco">' + pc(v, a.fat) + '</span></td>'; }).join('') + '</tr>'; }).join('') +
    '</tbody></table></div>';
  // origem do lead x último clique, pelos canais
  var CN = D.canais || { origemLead:[], ultimoClique:[], estimativa:[], semLeitura:0 };
  function tabCanal(titulo, sub, lista) { var t = soma(lista, function (x) { return x.fat; });
    return '<div><h3 style="font-size:16px;margin:24px 0 2px">' + esc(titulo) + '</h3><p class="nota" style="margin:0">' + esc(sub) + '</p><div class="rolar"><table><thead><tr><th>Canal</th><th class="c">Faturamento</th><th class="c">%</th></tr></thead><tbody>' +
      lista.map(function (x) { return '<tr><td>' + esc(x.canal) + '</td><td class="c">' + rs(x.fat) + '</td><td class="c">' + pc(x.fat, t) + '</td></tr>'; }).join('') +
      '<tr class="total"><td>Total</td><td class="c">' + rs(t) + '</td><td class="c">' + pc(t, fatT) + ' do faturamento</td></tr></tbody></table></div></div>'; }
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">' +
    tabCanal('Origem do lead', 'Onde a pessoa entrou na base antes de comprar (primeiro contato). Só quem era lead.', CN.origemLead) +
    tabCanal('Último clique', 'O link usado na hora da compra. Todas as vendas.', CN.ultimoClique) + '</div>' +
    '<p class="nota">"Link sem rastreio": link de grupo, suporte, bio ou página sem identificação. O rastreio foi corrigido em set/2026.</p>';  // ---------- 2. captou num lançamento, vendeu o quê
  var EX = D.extra || [], CO = D.coortes || [];
  var CUR = ['EsPCEx', 'Barro Branco', 'ESA', 'Matérias avulsas'];
  h += '<div class="parte">Parte 2</div><h2 class="section-title">Captou num lançamento, vendeu o quê</h2>' +
    '<div class="rolar"><table><thead><tr><th>Lançamento onde o lead entrou</th><th class="c">Leads</th>' + CUR.map(function (k) { return '<th class="c">' + esc(k) + '</th>'; }).join('') + '<th class="c">Outros cursos</th><th class="c">Total</th></tr></thead><tbody>' +
    EX.map(function (x) { var pcs = x.porCurso || [], tot = soma(pcs, function (p) { return p.fat; }); function v(k) { var r = pcs.filter(function (p) { return p.escola === k; })[0]; return r ? r.fat : 0; }
      var co = CO.filter(function (c) { return c.nome === x.nome; })[0] || {}, out = tot - soma(CUR, v);
      return '<tr><td><b>' + esc(x.nome) + '</b></td><td class="c">' + n0(co.leads) + '</td>' + CUR.map(function (k) { var val = v(k); return '<td class="c">' + (val ? rs(val) + '<br><span class="fraco">' + pc(val, tot) + '</span>' : '—') + '</td>'; }).join('') +
        '<td class="c">' + rs(out) + '<br><span class="fraco">' + pc(out, tot) + '</span></td><td class="c"><b>' + rs(tot) + '</b></td></tr>'; }).join('') +
    '</tbody></table></div><p class="nota">Tudo o que os leads de cada lançamento compraram depois de se cadastrar, até hoje, em qualquer curso.</p>';

  // ---------- 4. quanto tempo o lead leva pra comprar
  var TP = D.tempo || [];
  function tp(e, p) { return TP.filter(function (t) { return t.escola === e && t.publico === p; })[0] || {}; }
  var tf = tp('(todas)', 'frio'), tq = tp('(todas)', 'quente');
  h += '<div class="parte">Parte 3</div><h2 class="section-title">Quanto tempo o lead leva pra comprar</h2>' +
    '<div class="kpi-grid"><div class="kpi"><div class="label">Lead frio</div><div class="num">' + n0(tf.mediana) + ' dias</div><div class="sub">metade compra até aqui · 1 em 4 leva mais de ' + Math.round((tf.p75 || 0) / 30) + ' meses</div></div>' +
    '<div class="kpi"><div class="label">Lead quente</div><div class="num">' + n0(tq.mediana) + ' dias</div><div class="sub">metade compra até aqui · 1 em 4 leva mais de ' + Math.round((tq.p75 || 0) / 30) + ' meses</div></div></div>' +
    '<div class="rolar"><table><thead><tr><th>Escola onde entrou</th><th>Lead</th><th class="c">Compraram</th><th class="c">Metade comprou em até</th><th class="c">3 em 4 compraram em até</th><th class="c">Compraram depois de 3 meses</th></tr></thead><tbody>' +
    ['EsPCEx', 'Barro Branco', 'Matemática Básica', '(todas)'].map(function (e) { return ['frio', 'quente'].map(function (p) { var t = tp(e, p); if (!t.leads) return '';
      return '<tr' + (e === '(todas)' ? ' class="total"' : '') + '><td>' + esc(e === '(todas)' ? 'Todas' : e) + '</td><td>' + (p === 'frio' ? 'Frio' : 'Quente') + '</td><td class="c">' + n0(t.compraram) + ' <span class="fraco">de ' + n0(t.leads) + '</span></td><td class="c">' + n0(t.mediana) + ' dias</td><td class="c">' + n0(t.p75) + ' dias</td><td class="c">' + (t.depois90 == null ? '—' : t.depois90 + '%') + '</td></tr>'; }).join(''); }).join('') +
    '</tbody></table></div>';

  // ---------- estimativa: cada venda pelo canal (origem do lead; se não tiver, último clique); o que não tem nenhum dos dois vai na proporção dos que têm
  var ES = CN.estimativa || [], esT = soma(ES, function (x) { return x.fat; }), semL = CN.semLeitura || 0;
  h += '<div class="parte">Parte 4</div><h2 class="section-title">Estimativa: de onde vieram todas as vendas</h2>' +
    '<div class="rolar"><table><thead><tr><th>Canal</th><th class="c">Com leitura</th><th class="c">% de quem tem leitura</th><th class="c">Estimado dos sem leitura</th><th class="c">Total estimado</th><th class="c">% do faturamento</th></tr></thead><tbody>' +
    ES.map(function (x) { var s = esT ? x.fat / esT : 0, e = semL * s; return '<tr><td><b>' + esc(x.canal) + '</b></td><td class="c">' + rs(x.fat) + '</td><td class="c">' + pc(x.fat, esT) + '</td><td class="c">' + rs(e) + '</td><td class="c"><b>' + rs(x.fat + e) + '</b></td><td class="c">' + pc(x.fat + e, fatT) + '</td></tr>'; }).join('') +
    '<tr class="total"><td>Total</td><td class="c">' + rs(esT) + '<br><span class="fraco">' + pc(esT, fatT) + ' com leitura</span></td><td class="c">100%</td><td class="c">' + rs(semL) + '<br><span class="fraco">' + pc(semL, fatT) + ' sem leitura</span></td><td class="c">' + rs(esT + semL) + '</td><td class="c">100%</td></tr>' +
    '</tbody></table></div><p class="nota">Cada venda recebe um canal pela origem do lead; se não era lead, pelo link usado na compra. O que não tem nenhuma das duas leituras foi distribuído na mesma proporção dos que têm. É estimativa, não medição.</p>';  // ---------- 3. individual -> Full
  var U = D.upgrade;
  if (U) {
    h += '<div class="parte">Parte 5</div><h2 class="section-title">Quem compra o individual depois compra o Full</h2>' +
      '<div class="kpi-grid"><div class="kpi"><div class="label">Começaram por um curso individual</div><div class="num">' + n0(U.pessoasIndividual) + '</div><div class="sub">desde ' + esc(mes(U.desde + '-01')) + '</div></div>' +
      '<div class="kpi destaque"><div class="label">Depois compraram um Full</div><div class="num">' + pc(U.migraram, U.pessoasIndividual, 1) + '</div><div class="sub">' + n0(U.migraram) + ' pessoas · ' + rsk(U.fatFullDepois) + ' em Fulls</div></div>' +
      '<div class="kpi"><div class="label">Tempo até o Full</div><div class="num">' + Math.round(U.mediana / 30) + ' meses</div><div class="sub">metade compra em até ' + n0(U.mediana) + ' dias</div></div></div>' +
      '<div class="rolar"><table><thead><tr><th>Curso de entrada</th><th class="c">Pessoas</th><th class="c">Compraram Full</th><th class="c">Tempo (metade)</th><th>Pra quais Fulls</th></tr></thead><tbody>' +
      U.porProduto.slice(0, 10).map(function (p) { return '<tr><td>' + esc(p.produto) + '</td><td class="c">' + n0(p.pessoas) + '</td><td class="c">' + n0(p.migraram) + ' <span class="fraco">(' + pc(p.migraram, p.pessoas) + ')</span></td><td class="c">' + (p.mediana == null ? '—' : n0(p.mediana) + ' dias') + '</td><td class="fraco">' + p.destinos.map(function (d) { return esc(d.full.replace(/^TM - Full - /, '').replace(/^TM FULL /, '')) + ' ' + d.n; }).join(' · ') + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
  }

  h += '<footer>Vendas brutas da Hotmart (antes de taxa e imposto), sem cobranças repetidas. Cada comprador foi procurado em toda a base de leads (planilhas das captações, base antiga e ActiveCampaign) por e-mail, telefone e nome completo. "Veio de anúncio" / "do orgânico" = como a pessoa entrou na base antes da primeira compra; recompras contam pela mesma origem. Quem entrou na base no dia da compra ou depois conta como sem cadastro antes da compra; quem comprou pelo link de um grupo de WhatsApp conta como lead (estava no grupo). Lead sem origem registrada conta como frio (a revisar).</footer>';
  document.getElementById('app').innerHTML = h;
}
montar();
(function () {
  var tip = document.getElementById('tip');
  function mostrar(e) { var el = e.target.closest ? e.target.closest('[data-tip]') : null; if (!el) { tip.style.display = 'none'; return; }
    tip.innerHTML = el.getAttribute('data-tip'); tip.style.display = 'block';
    var x = e.clientX + 14, y = e.clientY + 14; if (x + tip.offsetWidth > window.innerWidth - 8) x = window.innerWidth - tip.offsetWidth - 8; if (y + tip.offsetHeight > window.innerHeight - 8) y = e.clientY - tip.offsetHeight - 10;
    tip.style.left = x + 'px'; tip.style.top = y + 'px'; }
  document.addEventListener('mousemove', mostrar); document.addEventListener('click', mostrar);
})();
</script>
</body>
</html>`;
