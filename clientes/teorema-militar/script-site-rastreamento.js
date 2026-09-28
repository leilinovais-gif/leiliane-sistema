(function () {
  var MAX_SCK = 200;
  var params = new URLSearchParams(window.location.search);
  var referrer = document.referrer;

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/+^])/g, '\\$1') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : undefined;
  }
  function setCookie(name, value, days) {
    var d = new Date(); d.setTime(d.getTime() + days * 86400000);
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + d.toUTCString() + '; path=/; SameSite=Lax';
  }

  var chaves = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'];
  var atuais = {};
  chaves.forEach(function (k) { var v = params.get(k); if (v) atuais[k] = v; });
  // Links antigos vieram com a fonte quebrada pelo script antigo do GTM: aninhada ("direct/?utm_source=ig") ou repetida
  // ("utm_source=direct&utm_source=ig"). Resgata a fonte de verdade; "direct" só vale se não houver outra.
  var fonteEscolhida = '';
  params.getAll('utm_source').forEach(function (s) {
    var m = /utm_source=([^&?\/]+)/.exec(s);
    var limpa = m ? m[1] : s.split(/[\/?&]/)[0];
    if (limpa && (!fonteEscolhida || fonteEscolhida.toLowerCase() === 'direct')) fonteEscolhida = limpa;
  });
  if (fonteEscolhida) atuais.utm_source = fonteEscolhida; else delete atuais.utm_source;
  var fonte = (atuais.utm_source || '').toLowerCase();
  var medio = (atuais.utm_medium || '').toLowerCase();
  var temUtm = !!fonte && fonte !== 'direct' && fonte !== 'referral' && fonte !== window.location.hostname && medio !== 'referral';
  if (!temUtm) atuais = {};

  function montaSck(u) {
    var s = [u.utm_source || '', u.utm_medium || '', u.utm_campaign || '', u.utm_term || '', u.utm_content || '', u.utm_id || ''].join('|');
    return s.length > MAX_SCK ? s.substring(0, MAX_SCK) : s;
  }

  if (!getCookie('marca_first_touch')) {
    var primeira = atuais;
    if (!temUtm) {
      var host = '';
      try { host = referrer ? new URL(referrer).hostname : ''; } catch (e) {}
      primeira = (host && host !== window.location.hostname)
        ? { utm_source: 'referral', utm_medium: host }
        : { utm_source: 'direct' };
    }
    setCookie('marca_first_touch', montaSck(primeira), 180);
  }
  if (temUtm) {
    setCookie('marca_last_touch', montaSck(atuais), 180);
  } else if (!getCookie('marca_last_touch')) {
    setCookie('marca_last_touch', getCookie('marca_first_touch'), 180);
  }

  function aplica(el) {
    try {
      var h = el.getAttribute('href');
      if (!h || h.charAt(0) === '#' || /^(mailto|tel|javascript):/i.test(h)) return;
      var u = new URL(el.href);
      if (u.hostname === window.location.hostname) return;
      var sp = u.searchParams;
      var email = getCookie('marca_email'), phone = getCookie('marca_phone'), name = getCookie('marca_name');
      var user = getCookie('marca_user') || sessionStorage.getItem('marca_user');
      if (phone && phone.length > 2) phone = phone.substring(2);
      sp.set('sck', getCookie('marca_last_touch') || '');
      sp.set('src', getCookie('marca_first_touch') || '');
      if (email) sp.set('email', email);
      if (phone) sp.set('phonenumber', phone);
      if (name) sp.set('name', name);
      if (user) sp.set('xcod', user);
      el.href = u.toString();
    } catch (e) { console.error('Erro ao marcar link:', el.href, e); }
  }
  function marcaTodos() { document.querySelectorAll('a[href]').forEach(aplica); }
  function noEvento(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (a) aplica(a);
  }
  ['mousedown', 'touchstart', 'click'].forEach(function (ev) { document.addEventListener(ev, noEvento, true); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', marcaTodos); else marcaTodos();

  // Trilha do lead: avisa o Worker a cada origem nova (histórico) e, quando o visitante já se cadastrou, quem ele é.
  try {
    var visitante = getCookie('marca_user') || '';
    var emailTrilha = (getCookie('marca_email') || '').toLowerCase();
    var refHost = '';
    try { refHost = referrer ? new URL(referrer).hostname : ''; } catch (e) {}
    var toque = null;
    if (temUtm) {
      toque = { fonte: atuais.utm_source || '', meio: atuais.utm_medium || '', campanha: atuais.utm_campaign || '', term: atuais.utm_term || '', content: atuais.utm_content || '', utm_id: atuais.utm_id || '' };
    } else if (refHost && refHost !== window.location.hostname) {
      toque = { fonte: 'referral', meio: refHost };
    } else if (!refHost) {
      toque = { fonte: 'direct' };
    }
    var assin = toque ? [toque.fonte, toque.meio || '', toque.campanha || '', toque.term || '', toque.content || ''].join('|') : '';
    if (toque) {
      var ult = null;
      try { ult = JSON.parse(localStorage.getItem('marca_toque') || 'null'); } catch (e) {}
      if (ult && ult.a === assin && Date.now() - ult.t < 30 * 60000) toque = null;
    }
    var identificar = false;
    try { identificar = !!emailTrilha && localStorage.getItem('marca_ident') !== emailTrilha; } catch (e) {}
    if (visitante && (toque || identificar)) {
      var corpo = { v: visitante };
      if (toque) { toque.pagina = window.location.pathname; toque.ref = refHost; corpo.t = toque; }
      if (emailTrilha) corpo.e = emailTrilha;
      var texto = JSON.stringify(corpo);
      var enviado = false;
      try { enviado = navigator.sendBeacon ? navigator.sendBeacon('/api/visita', new Blob([texto], { type: 'text/plain;charset=UTF-8' })) : false; } catch (e) {}
      if (!enviado) { try { fetch('/api/visita', { method: 'POST', body: texto, keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }).catch(function () {}); } catch (e) {} }
      try {
        if (toque) localStorage.setItem('marca_toque', JSON.stringify({ a: assin, t: Date.now() }));
        if (identificar) localStorage.setItem('marca_ident', emailTrilha);
      } catch (e) {}
    }
  } catch (e) {}
})();
