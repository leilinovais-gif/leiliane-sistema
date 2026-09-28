// ================================================================ Relatório gerencial (retrato, beta)
// Investimento, leads e vendas de 2023 até a data do retrato: de onde veio o faturamento, por escola e por curso,
// o que cada captação vendeu, quanto tempo o lead leva pra comprar e se o público frio se paga.
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
    /* séries (paleta categórica validada, passos do modo escuro, ordem fixa) */
    --s-frio:#3987e5; --s-pq:#d95926; --s-org:#199e70; --s-aluno:#c98500; --s-nao:#5f6a5c;
    --s-esp:#3987e5; --s-bb:#d95926; --s-mat:#199e70; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--text); font-family:'Titillium Web',sans-serif; padding:32px 16px 64px; line-height:1.45; }
  .wrap { max-width:1080px; margin:0 auto; }
  h1,h2,.num { font-family:'Big Shoulders Display',sans-serif; font-weight:800; text-transform:uppercase; letter-spacing:0.02em; }
  header { border-bottom:2px solid var(--accent); padding-bottom:20px; margin-bottom:22px; }
  .tag { font-size:12px; letter-spacing:0.15em; color:var(--accent); font-weight:700; text-transform:uppercase; }
  header h1 { font-size:clamp(30px,5vw,50px); line-height:1; margin-top:4px; }
  header p { color:var(--text-weak); margin-top:10px; max-width:760px; }
  .section-title { font-size:22px; margin:40px 0 6px; padding-left:12px; border-left:4px solid var(--accent); }
  .lede { color:var(--text-weak); margin:0 0 14px 16px; max-width:820px; font-size:15px; }
  .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; }
  .kpi { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:18px; }
  .kpi .label { font-size:12px; color:var(--text-weak); text-transform:uppercase; letter-spacing:0.08em; }
  .kpi .num { font-size:32px; color:var(--text); margin-top:6px; }
  .kpi .sub { font-size:13px; color:var(--text-weak); margin-top:4px; }
  .kpi.destaque { border-color:var(--accent); } .kpi.destaque .num { color:var(--accent); }
  .concl { list-style:none; display:grid; gap:10px; margin-top:14px; }
  .concl li { background:var(--card); border:1px solid var(--line); border-left:4px solid var(--accent); border-radius:8px; padding:14px 16px; }
  .concl b { color:var(--text); }
  .rolar { overflow-x:auto; border:1px solid var(--line); border-radius:10px; margin-top:12px; }
  table { width:100%; border-collapse:collapse; background:var(--card); font-size:14px; }
  th,td { padding:10px 12px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
  th { background:#000; color:var(--accent); font-size:11px; text-transform:uppercase; letter-spacing:.06em; white-space:nowrap; }
  .c { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .fraco { color:var(--text-weak); }
  tr.total td { font-weight:700; }
  tr:last-child td { border-bottom:0; }
  .note { font-size:13px; color:var(--text-weak); background:var(--card); border-left:3px solid var(--accent); padding:12px 16px; border-radius:4px; margin-top:12px; }
  .legenda { display:flex; flex-wrap:wrap; gap:6px 16px; margin:10px 0 4px; font-size:13px; color:var(--text-weak); }
  .legenda span { display:inline-flex; align-items:center; gap:6px; }
  .legenda i { width:12px; height:12px; border-radius:3px; display:inline-block; }
  .barras { display:grid; gap:10px; margin-top:8px; }
  .linha-barra { display:grid; grid-template-columns:90px 1fr 120px; gap:12px; align-items:center; font-size:14px; }
  .linha-barra .rot { color:var(--text); font-weight:600; }
  .linha-barra .tot { text-align:right; color:var(--text-weak); font-variant-numeric:tabular-nums; }
  .pilha { display:flex; gap:2px; height:26px; }
  .pilha div { height:100%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; color:#fff; overflow:hidden; white-space:nowrap; cursor:default; }
  .pilha div:first-child { border-radius:4px 0 0 4px; } .pilha div:last-child { border-radius:0 4px 4px 0; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(310px,1fr)); gap:12px; margin-top:12px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px; }
  .card h3 { font-family:'Big Shoulders Display',sans-serif; text-transform:uppercase; font-size:22px; }
  .card .meta { color:var(--text-weak); font-size:13px; margin:2px 0 10px; }
  .mini { display:grid; grid-template-columns:1fr 60px; gap:4px 10px; font-size:13px; align-items:center; }
  .mini .b { height:10px; border-radius:0 4px 4px 0; background:var(--text-weak); opacity:.8; }
  .graficos { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:12px; }
  @media (max-width:760px) { .graficos { grid-template-columns:1fr; } .linha-barra { grid-template-columns:60px 1fr 90px; } }
  .graf { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 14px 8px; }
  .graf h4 { font-size:14px; color:var(--text); margin-bottom:6px; }
  .graf svg { width:100%; height:auto; display:block; }
  .graf text { fill:var(--text-weak); font-size:11px; font-family:'Titillium Web',sans-serif; }
  .graf .rotulo { fill:var(--text); font-weight:700; font-size:12px; }
  details { margin-top:10px; }
  summary { cursor:pointer; color:var(--accent); font-weight:600; font-size:14px; }
  #tip { position:fixed; pointer-events:none; background:#000; color:var(--text); border:1px solid var(--line); border-radius:6px; padding:8px 10px; font-size:13px; max-width:280px; z-index:10; display:none; line-height:1.35; }
  .resposta { font-size:clamp(18px,2.4vw,22px); line-height:1.45; background:var(--card); border:1px solid var(--accent); border-radius:12px; padding:20px 22px; margin:0 0 16px; }
  .resposta b { color:var(--accent); }
  b.bom { color:#4ADE80; } b.ruim { color:#F87171; }
  .divisor { margin:56px 0 0; border-top:1px dashed var(--line); text-align:center; } .divisor span { position:relative; top:-12px; background:var(--bg); padding:0 12px; color:var(--text-weak); font-size:13px; text-transform:uppercase; letter-spacing:.1em; }
  .rodape { font-size:12px; color:var(--text-weak); margin-top:10px; }
  footer { margin-top:44px; color:var(--text-weak); font-size:13px; border-top:1px solid var(--line); padding-top:16px; }
</style>
</head>
<body>
<div class="wrap" id="app"></div>
<div id="tip"></div>
<script>
var D = __DADOS__;
var ORIG = [
  { k:'frio', nome:'Lead de anúncio · público frio', cor:'var(--s-frio)' },
  { k:'pq', nome:'Lead de anúncio · público quente', cor:'var(--s-pq)' },
  { k:'org', nome:'Lead orgânico ou sem origem', cor:'var(--s-org)' },
  { k:'aluno', nome:'Já era aluno', cor:'var(--s-aluno)' },
  { k:'nao', nome:'Não achado como lead', cor:'var(--s-nao)' }
];
function grupos(o) { // junta as origens finas nos 5 grupos do relatório
  function s(ks, c) { var t = 0; ks.forEach(function (k) { t += (o[k] && o[k][c]) || 0; }); return t; }
  return { frio:{n:s(['frio'],'n'),fat:s(['frio'],'fat')}, pq:{n:s(['pq'],'n'),fat:s(['pq'],'fat')}, org:{n:s(['org','semorigem'],'n'),fat:s(['org','semorigem'],'fat')},
           aluno:{n:s(['aluno'],'n'),fat:s(['aluno'],'fat')}, nao:{n:s(['active','nunca'],'n'),fat:s(['active','nunca'],'fat')} };
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
function n0(v) { return Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits:0 }); }
function rs(v) { return 'R$ ' + n0(v); }
function rsk(v) { v = Number(v || 0); return v >= 1e6 ? 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits:2 }) + ' mi' : v >= 1e3 ? 'R$ ' + (v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits:0 }) + ' mil' : rs(v); }
function pc(a, b, d) { return b ? (100 * a / b).toLocaleString('pt-BR', { maximumFractionDigits: d == null ? 0 : d }) + '%' : '—'; }
function x2(a, b) { return b ? (a / b).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 }) + 'x' : '—'; }
function soma(lista, f) { var t = 0; lista.forEach(function (x) { t += f(x) || 0; }); return t; }
function r1(a, b) { return b ? 'R$ ' + (a / b).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 }) : '—'; }
function dataBR(s) { var p = String(s).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

function legenda(itens) { return '<div class="legenda">' + itens.map(function (i) { return '<span><i style="background:' + i.cor + '"></i>' + esc(i.nome) + '</span>'; }).join('') + '</div>'; }
function pilha(o, total, rotulo, direita) {
  var g = grupos(o);
  return '<div class="linha-barra"><div class="rot">' + esc(rotulo) + '</div><div class="pilha">' + ORIG.map(function (s) {
    var v = g[s.k].fat; if (!v) return ''; var p = 100 * v / total;
    return '<div style="flex:' + v + ';background:' + s.cor + '" data-tip="<b>' + esc(rotulo) + ' · ' + esc(s.nome) + '</b><br>' + rs(v) + ' (' + pc(v, total, 1) + ')<br>' + n0(g[s.k].n) + ' vendas">' + (p >= 8 ? Math.round(p) + '%' : '') + '</div>';
  }).join('') + '</div><div class="tot">' + esc(direita) + '</div></div>';
}

// gráfico de linhas: % dos leads que já compraram até X dias (só leads que já tiveram esse tempo na base)
function curvas(titulo, series) {
  var X = [30, 90, 180, 365, 730], W = 500, H = 240, L = 40, R = 150, T = 12, B = 30;
  var ymax = 0; series.forEach(function (s) { X.forEach(function (d) { var v = s.c['d' + d]; if (v != null && v > ymax) ymax = v; }); });
  ymax = Math.max(2, Math.ceil(ymax / 2) * 2);
  function px(i) { return L + i * (W - L - R) / (X.length - 1); }
  function py(v) { return T + (H - T - B) * (1 - v / ymax); }
  var g = '';
  for (var k = 0; k <= 4; k++) { var v = ymax * k / 4, y = py(v); g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="var(--line)" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + v.toLocaleString('pt-BR', { maximumFractionDigits:1 }) + '%</text>'; }
  var nomes = ['30 dias', '90 dias', '6 meses', '1 ano', '2 anos'];
  X.forEach(function (d, i) { g += '<text x="' + px(i) + '" y="' + (H - 10) + '" text-anchor="middle">' + nomes[i] + '</text>'; });
  var rotY = [];
  series.forEach(function (s) {
    var pts = []; X.forEach(function (d, i) { var v = s.c['d' + d]; if (v != null) pts.push([px(i), py(v), v, nomes[i], s.c['n' + d]]); });
    if (!pts.length) return;
    g += '<polyline fill="none" stroke="' + s.cor + '" stroke-width="2" stroke-linejoin="round" points="' + pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '"/>';
    pts.forEach(function (p) { g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="' + s.cor + '" stroke="var(--card)" stroke-width="2"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="12" fill="transparent" data-tip="<b>' + esc(s.nome) + ' · ' + p[3] + '</b><br>' + p[2].toLocaleString('pt-BR', { maximumFractionDigits:2 }) + '% já tinham comprado<br>(' + n0(p[4]) + ' leads com esse tempo de base)"/>'; });
    var u = pts[pts.length - 1]; rotY.push({ y:u[1], x:u[0], t:s.nome + ' ' + u[2].toLocaleString('pt-BR', { maximumFractionDigits:1 }) + '%' });
  });
  rotY.sort(function (a, b) { return a.y - b.y; }); for (var r = 1; r < rotY.length; r++) if (rotY[r].y - rotY[r - 1].y < 14) rotY[r].y = rotY[r - 1].y + 14;
  rotY.forEach(function (r) { g += '<text class="rotulo" x="' + (r.x + 8) + '" y="' + (r.y + 4) + '">' + esc(r.t) + '</text>'; });
  return '<div class="graf"><h4>' + esc(titulo) + '</h4>' + legenda(series.map(function (s) { return { nome:s.nome, cor:s.cor }; })) + '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(titulo) + '">' + g + '</svg></div>';
}

function montar() {
  var anos = D.anos, fatTot = soma(anos, function (a) { return a.fat; }), metaTot = soma(anos, function (a) { return a.meta; });
  var oTot = {}; ['frio','pq','org','semorigem','aluno','active','nunca'].forEach(function (k) { oTot[k] = { n:soma(anos, function (a) { return a.origem[k].n; }), fat:soma(anos, function (a) { return a.origem[k].fat; }) }; });
  var gT = grupos(oTot), anuncio = gT.frio.fat + gT.pq.fat, deLead = anuncio + gT.org.fat;
  var fr = D.frio, frG = soma(fr, function (f) { return f.gasto; }), frT = soma(fr, function (f) { return f.fatTotal; });
  var h = '';
  var C = D.coortes || [], TIPOS = D.invTipos || [];
  var PZ = [['fim', 'Até o fim do lançamento'], ['d90', '3 meses depois'], ['d180', '6 meses depois'], ['d365', '1 ano depois'], ['d730', '2 anos depois']];
  function vx(v, i) { return i ? (v / i).toLocaleString('pt-BR', { minimumFractionDigits:1, maximumFractionDigits:1 }) + 'x' : '—'; }
  function celula(v, i) { return v == null ? '<td class="c fraco" title="esse prazo ainda não chegou">ainda não</td>' : '<td class="c">' + rs(v) + '<br><span class="' + (v >= i ? 'bom' : 'ruim') + '">' + vx(v, i) + '</span></td>'; }
  function grade(titulo, lede, campoInv, campoLeads, campoV, campoHoje) {
    var s = '<h2 class="section-title">' + titulo + '</h2><p class="lede">' + lede + '</p><div class="rolar"><table><thead><tr><th>Lançamento</th><th class="c">Investido</th><th class="c">Leads</th>' +
      PZ.map(function (p) { return '<th class="c">' + p[1] + '</th>'; }).join('') + '<th class="c">Até hoje</th></tr></thead><tbody>';
    s += C.map(function (c) { return '<tr><td><b>' + esc(c.nome) + '</b></td><td class="c">' + rs(c[campoInv]) + '</td><td class="c">' + n0(c[campoLeads]) + '</td>' +
      PZ.map(function (p) { return celula(c[campoV][p[0]], c[campoInv]); }).join('') + celula(c[campoHoje], c[campoInv]) + '</tr>'; }).join('');
    // total de cada coluna: só os lançamentos que já chegaram naquele prazo
    s += '<tr class="total"><td>Total</td><td class="c">' + rs(soma(C, function (c) { return c[campoInv]; })) + '</td><td class="c">' + n0(soma(C, function (c) { return c[campoLeads]; })) + '</td>' +
      PZ.map(function (p) { var ok = C.filter(function (c) { return c[campoV][p[0]] != null; }); var v = soma(ok, function (c) { return c[campoV][p[0]]; }), i = soma(ok, function (c) { return c[campoInv]; });
        return '<td class="c">' + rs(v) + '<br><span class="fraco">' + vx(v, i) + ' · ' + ok.length + ' lanç.</span></td>'; }).join('') +
      (function () { var v = soma(C, function (c) { return c[campoHoje]; }), i = soma(C, function (c) { return c[campoInv]; }); return '<td class="c">' + rs(v) + '<br><span class="fraco">' + vx(v, i) + '</span></td>'; })() + '</tr>';
    return s + '</tbody></table></div>';
  }
  var invTotal = soma(TIPOS, function (x) { return x.meta + x.google; });
  var invLanc = soma(C, function (c) { return c.investimento; }), vendLanc = soma(C, function (c) { return c.ateHoje; });
  var fimD = dataBR(D.geradoEm).slice(3);
  h += '<header><div class="tag">Relatório gerencial · beta · retrato de ' + dataBR(D.geradoEm) + '</div><h1>Tráfego pago:<br>quanto investimos e quanto voltou</h1>' +
    '<p>Jan/2023 a ' + fimD + ' · anúncios do Meta e do Google (YouTube) · vendas da Hotmart</p></header>';
  h += '<div class="kpi-grid">' +
    '<div class="kpi"><div class="label">Investido em anúncios</div><div class="num">' + rsk(invTotal) + '</div><div class="sub">Meta (desde ago/2023) + Google (desde jan/2023)</div></div>' +
    '<div class="kpi"><div class="label">Investido nos lançamentos rastreados</div><div class="num">' + rsk(invLanc) + '</div><div class="sub">' + C.length + ' lançamentos com planilha de leads</div></div>' +
    '<div class="kpi"><div class="label">Vendas dos leads desses lançamentos</div><div class="num">' + rsk(vendLanc) + '</div><div class="sub">até hoje, qualquer curso</div></div>' +
    '<div class="kpi destaque"><div class="label">Cada R$ 1 investido virou</div><div class="num">' + r1(vendLanc, invLanc) + '</div><div class="sub">em vendas, até hoje</div></div>' +
    '</div>';
  h += grade('Lançamento por lançamento', 'Quanto os leads captados em cada lançamento compraram, contando do cadastro. Embaixo de cada valor: quantas vezes o investimento.', 'investimento', 'leads', 'vendasLeads', 'ateHoje');
  // quando o dinheiro volta: média dos lançamentos que já têm 2 anos
  var mad = C.filter(function (c) { return c.vendasLeads.d730 != null; }), base2 = soma(mad, function (c) { return c.vendasLeads.d730; });
  h += '<h2 class="section-title">Quando o dinheiro volta</h2><p class="lede">Do que um lançamento vende em 2 anos, quanto já voltou em cada prazo (média dos ' + mad.length + ' lançamentos que já fizeram 2 anos).</p><div class="kpi-grid">' +
    PZ.map(function (p) { return '<div class="kpi' + (p[0] === 'd365' ? ' destaque' : '') + '"><div class="label">' + p[1] + '</div><div class="num">' + pc(soma(mad, function (c) { return c.vendasLeads[p[0]]; }), base2) + '</div></div>'; }).join('') + '</div>';
  h += grade('Só o público frio', 'O mesmo, olhando só o investimento em público frio e os leads frios de cada lançamento.', 'investimentoFrio', 'leadsFrios', 'vendasLeadsFrios', 'ateHojeFrios');
  h += '<h2 class="section-title">Onde foi todo o investimento</h2><div class="rolar"><table><thead><tr><th>Tipo</th><th class="c">2023</th><th class="c">2024</th><th class="c">2025</th><th class="c">2026</th><th class="c">Total</th><th>Retorno rastreado</th></tr></thead><tbody>' +
    TIPOS.map(function (x) { var lanc = x.tipo.indexOf('planilha de leads (') >= 0; return '<tr><td>' + esc(x.tipo) + '</td>' + x.anos.map(function (v) { return '<td class="c">' + (v ? rs(v) : '—') + '</td>'; }).join('') + '<td class="c"><b>' + rs(x.meta + x.google) + '</b></td><td class="fraco">' + (lanc ? '<b class="bom">sim, na tabela acima</b>' : 'não dá pra ligar pessoa a pessoa') + '</td></tr>'; }).join('') +
    '<tr class="total"><td>Total</td>' + [0, 1, 2, 3].map(function (k) { return '<td class="c">' + rs(soma(TIPOS, function (x) { return x.anos[k]; })) + '</td>'; }).join('') + '<td class="c">' + rs(invTotal) + '</td><td></td></tr></tbody></table></div>';
  h += '<p class="rodape">Vendas brutas da Hotmart (antes de taxa e imposto), de quem se cadastrou na captação do lançamento e comprou depois, em qualquer curso. Quem viu o anúncio e comprou sem se cadastrar não entra: o retorno real é maior.</p>';
  if (D.conclusoes && D.conclusoes.length) h += '<details><summary>Leituras dos dados</summary><ul class="concl">' + D.conclusoes.map(function (c) { return '<li>' + c + '</li>'; }).join('') + '</ul></details>';
  h += '<div class="divisor"><span>Detalhes, pra quem quiser aprofundar</span></div>';  // 2. de onde veio o faturamento
  h += '<h2 class="section-title">De onde veio o faturamento</h2><p class="lede">Cada venda foi ligada à pessoa que comprou. Se ela já estava na nossa base de leads antes da compra, a venda conta pela forma como ela entrou (anúncio frio, anúncio quente ou orgânico). Se não estava, ou já era aluno, ou não foi achada em nenhuma base.</p>' +
    legenda(ORIG) + '<div class="barras">' + anos.map(function (a) { return pilha(a.origem, a.fat, String(a.ano), rsk(a.fat)); }).join('') + pilha(oTot, fatTot, 'Total', rsk(fatTot)) + '</div>' +
    '<div class="rolar"><table><thead><tr><th>Ano</th><th class="c">Investido Meta</th>' + ORIG.map(function (s) { return '<th class="c">' + esc(s.nome) + '</th>'; }).join('') + '<th class="c">Total</th></tr></thead><tbody>' +
    anos.concat([{ ano:'Total', fat:fatTot, meta:metaTot, origem:oTot }]).map(function (a) { var g = grupos(a.origem); return '<tr' + (a.ano === 'Total' ? ' class="total"' : '') + '><td>' + a.ano + '</td><td class="c">' + rs(a.meta) + '</td>' + ORIG.map(function (s) { return '<td class="c">' + rs(g[s.k].fat) + '<br><span class="fraco">' + pc(g[s.k].fat, a.fat) + '</span></td>'; }).join('') + '<td class="c">' + rs(a.fat) + '</td></tr>'; }).join('') +
    '</tbody></table></div>' +
    '<div class="note">"Não achado como lead" junta quem comprou sem nunca se cadastrar (entrou direto pelo YouTube, Instagram, Google, indicação), quem se cadastrou com outro e-mail e quem só aparece no ActiveCampaign antigo, sem data. Em 2023 ele é maior porque as bases de leads começam em ago/2023; e escolas sem planilha de leads antes de 2026 (ESA, EFOMM, AFA...) aparecem quase inteiras aqui.</div>';

  // 3. por escola
  var escolas = D.escolas.filter(function (e) { return e.vendas >= 50; });
  h += '<h2 class="section-title">Por escola</h2><p class="lede">Escola do curso vendido. O investimento é o do Meta, somado pelo nome da campanha (operação, ultimato, perpétuo). Campanhas institucionais e de várias escolas (' + rsk(D.gastoSemEscola) + ') não entram em nenhuma linha.</p>' +
    '<div class="rolar"><table><thead><tr><th>Escola</th><th class="c">Investido Meta</th><th class="c">Vendas</th><th class="c">Faturamento</th><th class="c">De lead de anúncio</th><th class="c">De lead orgânico</th><th class="c">Já era aluno</th><th class="c">Não achado como lead</th></tr></thead><tbody>' +
    escolas.map(function (e) { var g = grupos(e.origem); return '<tr><td><b>' + esc(e.escola) + '</b></td><td class="c">' + (e.meta ? rs(e.meta) : '<span class="fraco">—</span>') + '</td><td class="c">' + n0(e.vendas) + '</td><td class="c">' + rs(e.fat) + '</td><td class="c">' + rs(g.frio.fat + g.pq.fat) + '<br><span class="fraco">' + pc(g.frio.fat + g.pq.fat, e.fat) + ' · frio ' + rsk(g.frio.fat) + '</span></td><td class="c">' + rs(g.org.fat) + '<br><span class="fraco">' + pc(g.org.fat, e.fat) + '</span></td><td class="c">' + rs(g.aluno.fat) + '<br><span class="fraco">' + pc(g.aluno.fat, e.fat) + '</span></td><td class="c">' + rs(g.nao.fat) + '<br><span class="fraco">' + pc(g.nao.fat, e.fat) + '</span></td></tr>'; }).join('') +
    '</tbody></table></div>' +
    '<details><summary>Ver cada escola ano a ano</summary><div class="rolar"><table><thead><tr><th>Escola</th><th>Ano</th><th class="c">Investido Meta</th><th class="c">Vendas</th><th class="c">Faturamento</th><th class="c">De lead de anúncio</th><th class="c">De lead orgânico</th><th class="c">Já era aluno</th><th class="c">Não achado</th></tr></thead><tbody>' +
    escolas.map(function (e) { return e.anos.map(function (a, i) { var g = grupos(a.origem); return '<tr><td>' + (i ? '' : '<b>' + esc(e.escola) + '</b>') + '</td><td>' + a.ano + '</td><td class="c">' + (a.meta ? rs(a.meta) : '—') + '</td><td class="c">' + n0(a.vendas) + '</td><td class="c">' + rs(a.fat) + '</td><td class="c">' + rs(g.frio.fat + g.pq.fat) + '</td><td class="c">' + rs(g.org.fat) + '</td><td class="c">' + rs(g.aluno.fat) + '</td><td class="c">' + rs(g.nao.fat) + '</td></tr>'; }).join(''); }).join('') +
    '</tbody></table></div></details>' +
    (D.gastoPorEscola ? '<details><summary>Ver o investimento do Meta por escola e ano</summary><div class="rolar"><table><thead><tr><th>Escola (pela campanha)</th><th class="c">2023</th><th class="c">2024</th><th class="c">2025</th><th class="c">2026</th><th class="c">Total</th></tr></thead><tbody>' +
      D.gastoPorEscola.map(function (g) { return '<tr><td>' + esc(g.escola === 'Outros / matérias' ? 'Institucional / várias escolas' : g.escola) + '</td>' + g.anos.map(function (v) { return '<td class="c">' + (v ? rs(v) : '—') + '</td>'; }).join('') + '<td class="c"><b>' + rs(g.total) + '</b></td></tr>'; }).join('') + '</tbody></table></div></details>' : '');

  // 4. captou X, vendeu o quê
  h += '<h2 class="section-title">Captou onde, vendeu o quê</h2><p class="lede">Escola em que a pessoa entrou como lead (o evento ou a captação) e o que ela comprou depois, em qualquer data. Conta cada curso comprado uma vez por pessoa.</p><div class="cards">' +
    D.matriz.filter(function (m) { return m.compras >= 20; }).map(function (m) {
      var max = Math.max.apply(null, m.porEscolaProduto.map(function (x) { return x.n; }));
      return '<div class="card"><h3>' + esc(m.escolaLead) + '</h3><div class="meta">' + n0(m.leads) + ' leads · ' + n0(m.compradores) + ' compraram (' + pc(m.compradores, m.leads, 1) + ') · ' + rsk(m.fat) + '</div>' +
        '<div class="mini">' + m.porEscolaProduto.slice(0, 7).map(function (x) { return '<div><div style="display:flex;justify-content:space-between;gap:8px"><span>' + esc(x.escola) + '</span><span class="fraco">' + rsk(x.fat) + '</span></div><div class="b" style="width:' + Math.max(2, 100 * x.n / max) + '%" data-tip="<b>' + esc(m.escolaLead) + ' → ' + esc(x.escola) + '</b><br>' + n0(x.n) + ' compras · ' + rs(x.fat) + '"></div></div><div class="c">' + n0(x.n) + '</div>'; }).join('') + '</div>' +
        '<details><summary>Cursos mais comprados</summary><div class="rolar"><table><thead><tr><th>Curso</th><th class="c">Compras</th><th class="c">De frios</th><th class="c">Mediana até comprar</th></tr></thead><tbody>' +
        m.topProdutos.map(function (p) { return '<tr><td>' + esc(p.produto) + '</td><td class="c">' + n0(p.n) + '</td><td class="c">' + n0(p.frio) + '</td><td class="c">' + n0(p.medianaDias) + ' dias</td></tr>'; }).join('') + '</tbody></table></div></details></div>';
    }).join('') + '</div>';

  // 5. tempo
  function tp(e, p) { return D.tempo.filter(function (t) { return t.escola === e && t.publico === p; })[0]; }
  var cores = { 'EsPCEx':'var(--s-esp)', 'Barro Branco':'var(--s-bb)', 'Matemática Básica':'var(--s-mat)' };
  function ser(p) { return ['EsPCEx', 'Barro Branco', 'Matemática Básica'].map(function (e) { var t = tp(e, p); return t ? { nome:e, cor:cores[e], c:t.curva } : null; }).filter(Boolean); }
  h += '<h2 class="section-title">Quanto tempo o lead leva pra comprar</h2><p class="lede">Percentual dos leads que já tinham comprado alguma coisa X dias depois de entrar na base. Cada ponto só usa leads que já estão na base há pelo menos aquele tempo, pra não misturar lead novo com antigo.</p>' +
    '<div class="graficos">' + curvas('Lead de público frio', ser('frio')) + curvas('Lead de público quente (anúncio quente + orgânico)', ser('quente')) + '</div>' +
    '<div class="rolar"><table><thead><tr><th>Escola onde entrou</th><th>Público</th><th class="c">Leads</th><th class="c">Compraram</th><th class="c">Metade comprou em até</th><th class="c">3 em 4 compraram em até</th><th class="c">Compraram depois de 90 dias</th><th class="c">Em 2 anos</th></tr></thead><tbody>' +
    D.tempo.map(function (t) { return '<tr' + (t.escola === '(todas)' ? ' class="total"' : '') + '><td>' + esc(t.escola === '(todas)' ? 'Todas' : t.escola) + '</td><td>' + (t.publico === 'frio' ? 'Frio' : 'Quente') + '</td><td class="c">' + n0(t.leads) + '</td><td class="c">' + n0(t.compraram) + '</td><td class="c">' + (t.mediana == null ? '—' : n0(t.mediana) + ' dias') + '</td><td class="c">' + (t.p75 == null ? '—' : n0(t.p75) + ' dias') + '</td><td class="c">' + (t.depois90 == null ? '—' : t.depois90 + '%') + '</td><td class="c">' + (t.curva.d730 == null ? '<span class="fraco">cedo</span>' : t.curva.d730.toLocaleString('pt-BR') + '%') + '</td></tr>'; }).join('') +
    '</tbody></table></div>';

  // 7. leads por ano e 2027
  var L = D.leads, maxL = Math.max.apply(null, L.map(function (l) { return l.total; }));
  function pl(a, p) { return D.porLead12m.filter(function (x) { return x.ano === a && x.publico === p; })[0] || { porLead:0, fat12m:0, leads:0 }; }
  var l25 = L.filter(function (l) { return l.ano === 2025; })[0], l26 = L.filter(function (l) { return l.ano === 2026; })[0];
  var q25 = l25.pq + l25.org, q26 = l26.pq + l26.org;
  var real25 = pl(2025, 'frio').fat12m + pl(2025, 'quente').fat12m;
  var est26 = l26.frio * pl(2025, 'frio').porLead + q26 * pl(2025, 'quente').porLead;
  h += '<h2 class="section-title">Leads captados por ano e o que isso indica pra 2027</h2><p class="lede">Pessoas que entraram na base pela primeira vez em cada ano, pelo público de entrada. 2026 vai até ' + dataBR(D.geradoEm) + ' (a captação da EsPCEx 27 ainda está em andamento).</p>' +
    legenda([{ nome:'Frio', cor:'var(--s-frio)' }, { nome:'Quente (anúncio)', cor:'var(--s-pq)' }, { nome:'Orgânico', cor:'var(--s-org)' }, { nome:'Sem origem', cor:'var(--s-nao)' }]) +
    '<div class="barras">' + L.map(function (l) {
      var partes = [['frio', 'Frio', 'var(--s-frio)'], ['pq', 'Quente (anúncio)', 'var(--s-pq)'], ['org', 'Orgânico', 'var(--s-org)'], ['semorigem', 'Sem origem', 'var(--s-nao)']];
      return '<div class="linha-barra"><div class="rot">' + l.ano + '</div><div class="pilha" style="width:' + (100 * l.total / maxL) + '%">' + partes.map(function (p) { var v = l[p[0]]; if (!v) return ''; return '<div style="flex:' + v + ';background:' + p[2] + '" data-tip="<b>' + l.ano + ' · ' + p[1] + '</b><br>' + n0(v) + ' leads (' + pc(v, l.total) + ')">' + (v / l.total >= .12 ? n0(v) : '') + '</div>'; }).join('') + '</div><div class="tot">' + n0(l.total) + ' leads</div></div>';
    }).join('') + '</div>' +
    '<div class="rolar"><table><thead><tr><th>Ano em que entrou</th><th class="c">Leads frios</th><th class="c">Leads quentes</th><th class="c">Faturamento por lead frio em 12 meses</th><th class="c">Por lead quente em 12 meses</th><th>Escolas com mais leads</th></tr></thead><tbody>' +
    L.map(function (l) { var f = pl(l.ano, 'frio'), q = pl(l.ano, 'quente'); return '<tr><td>' + l.ano + '</td><td class="c">' + n0(l.frio) + '</td><td class="c">' + n0(l.pq + l.org) + '</td><td class="c">' + (f.leads ? 'R$ ' + f.porLead.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 }) : '<span class="fraco">cedo</span>') + '</td><td class="c">' + (q.leads ? 'R$ ' + q.porLead.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 }) : '<span class="fraco">cedo</span>') + '</td><td class="fraco">' + l.porEscola.slice(0, 4).map(function (e) { return esc(e.escola === 'Outros / matérias' ? 'outras campanhas' : e.escola) + ' ' + n0(e.n); }).join(' · ') + '</td></tr>'; }).join('') +
    '</tbody></table></div>' +
    '<div class="kpi-grid" style="margin-top:12px"><div class="kpi"><div class="label">Leads frios 2025 → 2026</div><div class="num">' + n0(l25.frio) + ' → ' + n0(l26.frio) + '</div><div class="sub">' + pc(l26.frio - l25.frio, l25.frio) + '</div></div>' +
    '<div class="kpi"><div class="label">Leads quentes 2025 → 2026</div><div class="num">' + n0(q25) + ' → ' + n0(q26) + '</div><div class="sub">' + (q26 >= q25 ? '+' : '') + pc(q26 - q25, q25) + '</div></div>' +
    '<div class="kpi destaque"><div class="label">Vendas esperadas dos leads de 2026 (12 meses)</div><div class="num">' + rsk(est26) + '</div><div class="sub">contra ' + rsk(real25) + ' dos leads de 2025 (' + (est26 >= real25 ? '+' : '') + pc(est26 - real25, real25) + ')</div></div></div>' +
    '<div class="note">Estimativa simples: leads de 2026 × o quanto cada lead de 2025 (frio e quente, separados) comprou nos 12 meses seguintes. Como o lead quente compra 8 vezes mais que o frio, a queda de leads frios pesa pouco; o que decide 2027 é manter o volume de leads quentes.</div>';

  // 8. cursos
  h += '<h2 class="section-title">Todos os cursos</h2><p class="lede">Cada curso da Hotmart, com o quanto das vendas veio de quem já era lead. "Mediana até comprar" é o tempo entre entrar na base e comprar aquele curso, só pra quem era lead.</p>' +
    '<div class="rolar"><table><thead><tr><th>Curso</th><th>Escola</th><th class="c">Vendas</th><th class="c">Faturamento</th><th class="c">De lead de anúncio</th><th class="c">De lead orgânico</th><th class="c">Já era aluno</th><th class="c">Não achado</th><th class="c">Mediana até comprar</th></tr></thead><tbody>' +
    D.produtos.filter(function (p) { return p.vendas >= 5; }).map(function (p) { var g = grupos(p.origem); return '<tr><td>' + esc(p.produto) + '</td><td class="fraco">' + esc(p.escola) + '</td><td class="c">' + n0(p.vendas) + '</td><td class="c">' + rs(p.fat) + '</td><td class="c">' + pc(g.frio.fat + g.pq.fat, p.fat) + '</td><td class="c">' + pc(g.org.fat, p.fat) + '</td><td class="c">' + pc(g.aluno.fat, p.fat) + '</td><td class="c">' + pc(g.nao.fat, p.fat) + '</td><td class="c">' + (p.medianaDias == null ? '—' : n0(p.medianaDias) + ' dias') + '</td></tr>'; }).join('') +
    '</tbody></table></div>';

  h += '<footer><b>Como foi feito.</b> Vendas: todas as vendas aprovadas da Hotmart desde jan/2023 (' + n0(D.cobertura.vendas) + ', sem contar cobrança repetida do mesmo curso). Leads: ' + esc(D.cobertura.bases) + ' (' + n0(D.cobertura.leadsPessoas) + ' pessoas). ' +
    'A pessoa é ligada pela primeira vez que entrou na base; quem entrou no mesmo dia da compra ou depois conta como aluno, não como lead. Frio e quente vêm do nome do público no anúncio (UTM). Investimento: Meta, conta Teorema Militar MKT, desde ago/2023 (o Meta não guarda mais que isso). ' +
    '<b>Ainda fora:</b> Google Ads (YouTube), planilhas de leads antigas de ESA, EFOMM e AFA e as operações de 2022.</footer>';
  document.getElementById('app').innerHTML = h;
}
montar();

// dica ao passar o mouse (ou tocar) nas barras e pontos
(function () {
  var tip = document.getElementById('tip');
  function mostrar(e) { var el = e.target.closest ? e.target.closest('[data-tip]') : null; if (!el) { tip.style.display = 'none'; return; }
    tip.innerHTML = el.getAttribute('data-tip'); tip.style.display = 'block';
    var x = (e.clientX || 0) + 14, y = (e.clientY || 0) + 14; if (x + tip.offsetWidth > window.innerWidth - 8) x = window.innerWidth - tip.offsetWidth - 8; if (y + tip.offsetHeight > window.innerHeight - 8) y = e.clientY - tip.offsetHeight - 10;
    tip.style.left = x + 'px'; tip.style.top = y + 'px'; }
  document.addEventListener('mousemove', mostrar); document.addEventListener('click', mostrar);
  document.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
})();
</script>
</body>
</html>`;
