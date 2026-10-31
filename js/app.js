import { MENU } from './menu.js';

/* =========================================================
   CONFIGURAÇÃO — confirme estes dados com o restaurante
   ========================================================= */
const CONFIG = {
  whatsapp: '5581998165515',
  deliveryFee: 6,          // taxa de entrega em R$
  minOrder: 30,            // pedido mínimo para entrega em R$
  prepMinutes: 45,         // tempo mínimo entre o pedido e a entrega
  // Horários por dia da semana (0 = domingo). null = fechado naquele turno.
  hours: {
    0: { almoco: ['11:00', '15:00'], jantar: null },
    1: { almoco: ['11:00', '15:00'], jantar: null },
    2: { almoco: ['11:00', '15:00'], jantar: ['18:00', '22:00'] },
    3: { almoco: ['11:00', '15:00'], jantar: ['18:00', '22:00'] },
    4: { almoco: ['11:00', '15:00'], jantar: ['18:00', '22:00'] },
    5: { almoco: ['11:00', '15:00'], jantar: ['18:00', '22:00'] },
    6: { almoco: ['11:00', '15:00'], jantar: ['18:00', '22:00'] },
  },
};

const SHIFT_LABEL = { almoco: 'Almoço', jantar: 'Jantar' };
const DAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DAY_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---------- Índice do cardápio ---------- */
const ITEMS = new Map();
for (const cat of MENU) {
  cat.items = cat.items.map(([id, name, desc, price, extra = {}]) => {
    const text = `${name} ${desc}`;
    const tags = [];
    if (/low carb|\bfit\b/i.test(text)) tags.push('Low carb');
    if (/sem glúten/i.test(text)) tags.push('Sem glúten');
    const item = { id, name, desc, price, days: extra.days, tags, cat, search: norm(`${text} ${cat.name}`) };
    ITEMS.set(id, item);
    return item;
  });
}

/* ---------- Horários ---------- */
const at = (date, hhmm) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(date); d.setHours(h, m, 0, 0); return d; };
const hm = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const shortH = (hhmm) => hhmm.replace(':00', 'h').replace(':', 'h');

// Próxima janela de atendimento de um turno (hoje, se ainda dá tempo, ou o próximo dia aberto)
function nextService(shift, now = new Date()) {
  for (let d = 0; d < 8; d++) {
    const day = new Date(now); day.setDate(now.getDate() + d);
    const h = CONFIG.hours[day.getDay()][shift];
    if (!h) continue;
    const start = at(day, h[0]), end = at(day, h[1]);
    if (d === 0 && now > new Date(end - 15 * 60000)) continue;
    return { date: day, start, end, offset: d, openNow: d === 0 && now >= start };
  }
  return null;
}
const dayWord = (svc) => (svc.offset === 0 ? 'hoje' : svc.offset === 1 ? 'amanhã' : DAY_LONG[svc.date.getDay()].toLowerCase());

function statusText() {
  const now = new Date();
  for (const s of ['almoco', 'jantar']) {
    const svc = nextService(s, now);
    if (svc && svc.openNow) return { open: true, text: `Aberto agora, ${SHIFT_LABEL[s].toLowerCase()} até ${shortH(hm(svc.end))}` };
  }
  const opts = ['almoco', 'jantar'].map((s) => [s, nextService(s, now)]).filter(([, v]) => v).sort((a, b) => a[1].start - b[1].start);
  if (!opts.length) return { open: false, text: 'Consulte nossos horários' };
  const [s, svc] = opts[0];
  return { open: false, text: `Fechado agora. ${SHIFT_LABEL[s]} abre ${dayWord(svc)} às ${shortH(hm(svc.start))}` };
}

function defaultShift() {
  const a = nextService('almoco'), j = nextService('jantar');
  if (!j) return 'almoco';
  if (!a) return 'jantar';
  return a.start <= j.start ? 'almoco' : 'jantar';
}

/* ---------- Estado ---------- */
const store = {
  get(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* modo privado */ } },
};
const saved = store.get('naturalle:cart', null);
const state = {
  view: defaultShift(),
  cart: { shift: saved?.shift || null, lines: new Map((saved?.lines || []).filter(([id]) => ITEMS.has(id))) },
  query: '',
  light: false,
  step: 1,
};
const saveCart = () => store.set('naturalle:cart', { shift: state.cart.shift, lines: [...state.cart.lines] });

/* =========================================================
   HERO, NAV E STATUS
   ========================================================= */
const nav = $('.nav');
const onScrollNav = () => nav.classList.toggle('is-solid', window.scrollY > 40);
window.addEventListener('scroll', onScrollNav, { passive: true });
onScrollNav();

function paintStatus() {
  const st = statusText();
  $('[data-status]').classList.toggle('is-open', st.open);
  $('[data-status-text]').textContent = st.text;
}
paintStatus();
setInterval(paintStatus, 60000);

$$('[data-pick-shift]').forEach((a) => a.addEventListener('click', () => setView(a.dataset.pickShift, false)));

// Cena 3D: carregada depois da primeira pintura, só se houver WebGL
function bootScene() {
  const canvas = $('.hero__canvas');
  const gl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
  const lowEnd = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
  if (!gl || lowEnd || navigator.connection?.saveData) { $('.hero').classList.add('no-webgl'); return; }
  import('./scene3d.js')
    .then(({ startScene }) => { if (!startScene(canvas, { reducedMotion: reduced })) $('.hero').classList.add('no-webgl'); })
    .catch(() => $('.hero').classList.add('no-webgl'));
}
if (document.readyState === 'complete') bootScene();
else window.addEventListener('load', () => (window.requestIdleCallback || setTimeout)(bootScene, { timeout: 600 }), { once: true });

/* =========================================================
   MOMENTOS
   ========================================================= */
const MOMENTS = {
  horarios: () => ({
    title: 'Almoço e jantar, com cozinha feita na hora.',
    text: hoursSummary(),
    cta: ['Ver horários completos', '#visite'],
  }),
  happy: () => ({
    title: 'Happy hour para chamar a turma.',
    text: 'Cervejas geladas, soda italiana, vinhos e entradinhas para dividir, como o camarão na manteiga de ervas e o arancini.',
    cta: ['Ver cardápio da noite', '#pedir', 'jantar'],
  }),
  quinta: () => ({
    title: 'Quinta Delas.',
    text: 'Uma noite dedicada a elas, com menu especial servido em etapas. As datas de cada edição saem primeiro no nosso Instagram.',
    cta: ['Acompanhar no Instagram', 'https://www.instagram.com/naturallerestaurante/'],
  }),
  espaco: () => ({
    title: 'Um lugar que abraça quem chega.',
    text: 'Ambiente aconchegante na Av. Presidente Getúlio Vargas, no centro de Carpina. Há mais de dez anos recebendo famílias, amigos e quem precisa de um almoço leve no meio do dia.',
    cta: ['Como chegar', '#visite'],
  }),
  eventos: () => ({
    title: 'Aniversários, confraternizações e encontros.',
    text: 'Reserve o espaço ou monte um menu para o seu grupo. Fale com a gente pelo WhatsApp para ver datas e opções.',
    cta: ['Falar no WhatsApp', waLink('Olá! Gostaria de saber sobre eventos e reservas na Naturalle.')],
  }),
  delivery: () => ({
    title: 'Delivery no almoço e no jantar.',
    text: `Monte seu pedido aqui no site e envie direto para o nosso WhatsApp. Taxa de entrega de ${brl(CONFIG.deliveryFee)} e pedido mínimo de ${brl(CONFIG.minOrder)}. Também dá para retirar no restaurante.`,
    cta: ['Fazer pedido', '#pedir'],
  }),
};

function hoursSummary() {
  const lunchDays = [], dinnerDays = [];
  for (let d = 0; d < 7; d++) {
    if (CONFIG.hours[d].almoco) lunchDays.push(d);
    if (CONFIG.hours[d].jantar) dinnerDays.push(d);
  }
  const range = (days) => (days.length === 7 ? 'todos os dias' : days.map((d) => DAY_SHORT[d]).join(', '));
  const l = CONFIG.hours[lunchDays[0]]?.almoco, j = CONFIG.hours[dinnerDays[0]]?.jantar;
  return `Almoço ${range(lunchDays)}, das ${shortH(l[0])} às ${shortH(l[1])}. Jantar ${range(dinnerDays)}, das ${shortH(j[0])} às ${shortH(j[1])}.`;
}

const panel = $('[data-moment-panel]');
function showMoment(key, animate = true) {
  const m = MOMENTS[key]();
  const [label, href, shift] = m.cta;
  const ext = href.startsWith('http');
  panel.innerHTML = `<div><h3>${esc(m.title)}</h3><p>${esc(m.text)}</p></div>
    <a class="btn btn--lime" href="${esc(href)}" ${ext ? 'target="_blank" rel="noopener"' : ''} ${shift ? `data-pick-shift="${shift}"` : ''}>${esc(label)}</a>`;
  const pick = panel.querySelector('[data-pick-shift]');
  if (pick) pick.addEventListener('click', () => setView(pick.dataset.pickShift, false));
  $$('[data-moment]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.moment === key)));
  if (animate) { panel.classList.remove('is-swap'); void panel.offsetWidth; panel.classList.add('is-swap'); }
}
$$('[data-moment]').forEach((b) => b.addEventListener('click', () => showMoment(b.dataset.moment)));
showMoment('horarios', false);

/* =========================================================
   CARDÁPIO
   ========================================================= */
const orderEl = $('#pedir');
const board = $('[data-board]');
const catsEl = $('[data-cats]');

const ICON_PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const svcFor = (shift) => nextService(shift) || { date: new Date(), offset: 0 };
const servesOn = (item, shift) => !item.days || item.days.includes(svcFor(shift).date.getDay());

function actionHTML(item) {
  const q = state.cart.lines.get(item.id) || 0;
  const off = !servesOn(item, state.view);
  if (q > 0 && state.cart.shift === state.view) {
    return `<div class="qty" role="group" aria-label="Quantidade de ${esc(item.name)}">
      <button type="button" data-dec="${item.id}" aria-label="Remover um">−</button>
      <output aria-live="polite">${q}</output>
      <button type="button" data-inc="${item.id}" aria-label="Adicionar mais um">+</button></div>`;
  }
  return `<button class="add" type="button" data-add="${item.id}" ${off ? 'disabled' : ''} aria-label="Adicionar ${esc(item.name)} à sacola">${ICON_PLUS}</button>`;
}

function itemHTML(item) {
  const off = !servesOn(item, state.view);
  const dayTag = item.days ? `<span class="tag ${off ? 'tag--off' : ''}">Só ${item.days.map((d) => DAY_SHORT[d]).join(', ')}</span>` : '';
  const tags = item.tags.map((t) => `<span class="tag">${t}</span>`).join('');
  return `<li class="item ${off ? 'is-off' : ''}">
    <span class="item__name">${esc(item.name)}</span>
    ${item.desc ? `<p class="item__desc">${esc(item.desc)}</p>` : ''}
    <div class="item__meta"><span class="price">${brl(item.price)}</span>${dayTag}${tags}</div>
    <div class="item__act" data-act="${item.id}">${actionHTML(item)}</div>
  </li>`;
}

function renderMenu() {
  const q = norm(state.query.trim());
  const cats = MENU.filter((c) => c.shifts.includes(state.view));
  let html = '', nav = '';
  for (const cat of cats) {
    const list = cat.items.filter((i) => (!q || i.search.includes(q)) && (!state.light || i.tags.length));
    if (!list.length) continue;
    nav += `<a class="cat" href="#cat-${cat.id}" data-cat="${cat.id}"><svg aria-hidden="true"><use href="#i-${cat.icon}"/></svg>${esc(cat.name)}</a>`;
    html += `<section class="menu-cat" id="cat-${cat.id}" aria-labelledby="h-${cat.id}">
      <div class="menu-cat__head"><span class="menu-cat__icon"><svg aria-hidden="true"><use href="#i-${cat.icon}"/></svg></span><h3 id="h-${cat.id}">${esc(cat.name)}</h3></div>
      ${cat.note ? `<p class="menu-cat__note">${esc(cat.note)}</p>` : ''}
      <ul class="items">${list.map(itemHTML).join('')}</ul></section>`;
  }
  board.innerHTML = html || `<p class="no-results">Nada encontrado para “${esc(state.query)}”. Tente outro nome ou ingrediente.</p>`;
  catsEl.innerHTML = nav;
  watchCats();
}

function paintShiftCopy() {
  const svc = nextService(state.view);
  const word = $('[data-shift-word]');
  word.textContent = state.view === 'almoco' ? 'almoço' : 'jantar';
  word.classList.remove('is-swap'); void word.offsetWidth; word.classList.add('is-swap');
  $('[data-shift-hours]').textContent = svc
    ? `${svc.openNow ? 'Recebendo pedidos agora' : `Próximo atendimento ${dayWord(svc)}`}, das ${shortH(hm(svc.start))} às ${shortH(hm(svc.end))}.`
    : 'Turno sem atendimento nesta semana.';
  $$('[data-shift-btn]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.shiftBtn === state.view)));
}

function setView(shift, animate = true) {
  if (shift === state.view) return;
  state.view = shift;
  orderEl.dataset.shift = shift;
  paintShiftCopy();
  if (!animate || reduced) { renderMenu(); return; }
  board.classList.remove('is-flip-in');
  board.classList.add('is-flip-out');
  board.addEventListener('animationend', () => {
    renderMenu();
    board.classList.remove('is-flip-out');
    board.classList.add('is-flip-in');
    board.addEventListener('animationend', () => { board.classList.remove('is-flip-in'); watchCats(); }, { once: true });
  }, { once: true });
}
$$('[data-shift-btn]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.shiftBtn)));

let searchT;
$('[data-search]').addEventListener('input', (e) => {
  clearTimeout(searchT);
  searchT = setTimeout(() => { state.query = e.target.value; renderMenu(); }, 120);
});
$('[data-filter-light]').addEventListener('click', (e) => {
  state.light = !state.light;
  e.currentTarget.setAttribute('aria-pressed', String(state.light));
  renderMenu();
});

// Categoria ativa conforme a rolagem
let catObserver;
function watchCats() {
  catObserver?.disconnect();
  catObserver = new IntersectionObserver((entries) => {
    if (board.classList.contains('is-flip-in') || board.classList.contains('is-flip-out')) return;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const id = e.target.id.replace('cat-', '');
      $$('.cat', catsEl).forEach((c) => c.classList.toggle('is-active', c.dataset.cat === id));
      const active = $(`.cat[data-cat="${id}"]`, catsEl);
      if (active) catsEl.scrollTo({ left: active.offsetLeft - 20, behavior: reduced ? 'auto' : 'smooth' });
    }
  }, { rootMargin: '-140px 0px -65% 0px' });
  $$('.menu-cat', board).forEach((s) => catObserver.observe(s));
}

board.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  const inc = e.target.closest('[data-inc]');
  const dec = e.target.closest('[data-dec]');
  if (add) tryAdd(add.dataset.add, add);
  else if (inc) changeQty(inc.dataset.inc, 1, inc);
  else if (dec) changeQty(dec.dataset.dec, -1);
});

/* =========================================================
   SACOLA
   ========================================================= */
let pendingAdd = null;
function tryAdd(id, from) {
  const cart = state.cart;
  if (cart.lines.size && cart.shift && cart.shift !== state.view) {
    pendingAdd = { id, from };
    $('[data-confirm-text]').textContent = `Sua sacola já tem itens do ${SHIFT_LABEL[cart.shift].toLowerCase()}. Para pedir o ${SHIFT_LABEL[state.view].toLowerCase()}, a sacola atual será esvaziada.`;
    $('[data-confirm]').hidden = false;
    $('[data-confirm-yes]').focus();
    return;
  }
  cart.shift = state.view;
  changeQty(id, 1, from);
}
$('[data-confirm-no]').addEventListener('click', () => { $('[data-confirm]').hidden = true; pendingAdd = null; });
$('[data-confirm-yes]').addEventListener('click', () => {
  $('[data-confirm]').hidden = true;
  state.cart.lines.clear();
  state.cart.shift = state.view;
  if (pendingAdd) changeQty(pendingAdd.id, 1, pendingAdd.from);
  pendingAdd = null;
  renderMenu();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('[data-confirm]').hidden) $('[data-confirm-no]').click(); });

function changeQty(id, delta, from) {
  const lines = state.cart.lines;
  const q = Math.max(0, (lines.get(id) || 0) + delta);
  if (q) lines.set(id, q); else lines.delete(id);
  if (!lines.size) state.cart.shift = null;
  saveCart();
  const slot = $(`[data-act="${id}"]`, board);
  if (slot) slot.innerHTML = actionHTML(ITEMS.get(id));
  paintCart();
  if (delta > 0 && from) flyToBag(from);
  if (delta > 0 && !drawer.classList.contains('is-open')) toast(`${ITEMS.get(id).name} na sacola`);
}

// Folha que voa em arco 3D até a sacola
const LEAF_SVG = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 34C4 18 16 6 34 6c0 18-12 30-28 28z" fill="#9bcb3c"/><path d="M8 32 26 14" stroke="#0e3b1e" stroke-width="2" stroke-linecap="round"/></svg>';
function flyToBag(from) {
  if (reduced) return bumpBag();
  const mobileBar = getComputedStyle($('[data-bag-bar]')).display !== 'none';
  const a = from.getBoundingClientRect(), b = $('.bag-btn').getBoundingClientRect();
  const x0 = a.left + a.width / 2 - 15, y0 = a.top + a.height / 2 - 15;
  // no celular a folha cai na barra da sacola (que pode ainda estar entrando na tela)
  const x1 = mobileBar ? window.innerWidth / 2 - 15 : b.left + b.width / 2 - 15;
  const y1 = mobileBar ? window.innerHeight - 56 : b.top + b.height / 2 - 15;
  const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 140;
  const el = document.createElement('div');
  el.className = 'flyer';
  el.innerHTML = LEAF_SVG;
  document.body.appendChild(el);
  el.animate([
    { transform: `translate3d(${x0}px,${y0}px,0) rotateX(0) rotateY(0) scale(.6)`, opacity: 0 },
    { transform: `translate3d(${(x0 + mx) / 2}px,${(y0 + my) / 2 - 30}px,80px) rotateX(120deg) rotateY(80deg) scale(1.5)`, opacity: 1, offset: .25 },
    { transform: `translate3d(${mx}px,${my}px,120px) rotateX(260deg) rotateY(200deg) scale(1.3)`, offset: .55 },
    { transform: `translate3d(${x1}px,${y1}px,0) rotateX(400deg) rotateY(360deg) scale(.4)`, opacity: .9 },
  ], { duration: 820, easing: 'cubic-bezier(.45,0,.2,1)' }).onfinish = () => { el.remove(); bumpBag(); };
}
function bumpBag() {
  $$('.bag-btn, [data-bag-bar]').forEach((el) => { el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump'); });
}

const cartCount = () => [...state.cart.lines.values()].reduce((a, b) => a + b, 0);
const subtotal = () => [...state.cart.lines].reduce((s, [id, q]) => s + ITEMS.get(id).price * q, 0);
const mode = () => $('[data-f="mode"]:checked').value;
const fee = () => (mode() === 'entrega' && state.cart.lines.size ? CONFIG.deliveryFee : 0);

function unavailableLines() {
  if (!state.cart.shift) return [];
  return [...state.cart.lines.keys()].filter((id) => !servesOn(ITEMS.get(id), state.cart.shift));
}

function paintCart() {
  const n = cartCount();
  $$('[data-cart-count]').forEach((el) => (el.textContent = n));
  $('[data-bar-count]').parentElement.innerHTML = `<b data-bar-count>${n}</b> ${n === 1 ? 'item' : 'itens'}`;
  $('[data-bar-total]').textContent = brl(subtotal());
  const bar = $('[data-bag-bar]');
  bar.hidden = false;
  bar.classList.toggle('is-on', n > 0 && !drawer.classList.contains('is-open'));
  bar.setAttribute('aria-hidden', String(n === 0));
  bar.tabIndex = n ? 0 : -1;

  const list = $('[data-cart-list]');
  const off = unavailableLines();
  list.innerHTML = [...state.cart.lines].map(([id, q]) => {
    const it = ITEMS.get(id);
    return `<li class="cart-item">
      <span class="cart-item__name">${esc(it.name)}</span>
      <span class="cart-item__price">${brl(it.price * q)}</span>
      <div class="qty" role="group" aria-label="Quantidade de ${esc(it.name)}">
        <button type="button" data-cdec="${id}" aria-label="Remover um">−</button><output>${q}</output>
        <button type="button" data-cinc="${id}" aria-label="Adicionar mais um">+</button></div>
      ${off.includes(id) ? `<p class="cart-item__warn">Não servido ${dayWord(svcFor(state.cart.shift))}. Remova este item para continuar.</p>` : ''}
    </li>`;
  }).join('');
  $('[data-cart-empty]').hidden = n > 0;
  $('[data-f="obs"]').closest('.field').hidden = n === 0;
  const svc = state.cart.shift && nextService(state.cart.shift);
  $('[data-cart-shift]').textContent = svc ? `Pedido de ${SHIFT_LABEL[state.cart.shift].toLowerCase()} para ${dayWord(svc)}` : '';

  $('[data-subtotal]').textContent = brl(subtotal());
  $('[data-fee]').textContent = fee() ? brl(fee()) : 'Grátis';
  $('[data-fee-row]').hidden = mode() !== 'entrega';
  $('[data-total]').textContent = brl(subtotal() + fee());
  $('[data-next]').disabled = n === 0 && state.step === 1;
}

$('[data-cart-list]').addEventListener('click', (e) => {
  const inc = e.target.closest('[data-cinc]'), dec = e.target.closest('[data-cdec]');
  if (inc) changeQty(inc.dataset.cinc, 1);
  if (dec) changeQty(dec.dataset.cdec, -1);
});

/* ---------- Gaveta e etapas ---------- */
const drawer = $('[data-drawer]');
const panelEl = $('.drawer__panel');
let lastFocus;
function openCart() {
  lastFocus = document.activeElement;
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  document.documentElement.style.overflow = 'hidden';
  goStep(state.step === 4 ? 1 : state.step, false);
  paintCart();
  setTimeout(() => panelEl.focus(), 50);
}
function closeCart() {
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  document.documentElement.style.overflow = '';
  paintCart();
  lastFocus?.focus?.();
}
$$('[data-open-cart]').forEach((b) => b.addEventListener('click', openCart));
drawer.addEventListener('click', (e) => { if (e.target.closest('[data-close-cart]')) closeCart(); });
document.addEventListener('keydown', (e) => {
  if (!drawer.classList.contains('is-open')) return;
  if (e.key === 'Escape' && $('[data-confirm]').hidden) closeCart();
  if (e.key === 'Tab') { // mantém o foco dentro da gaveta
    const f = $$('button:not([disabled]):not([hidden]), input, select, textarea, a[href]', panelEl).filter((el) => el.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
  }
});

const STEP_TITLES = { 1: 'Sua sacola', 2: 'Entrega', 3: 'Pagamento', 4: 'Pronto' };
function goStep(n, animate = true) {
  const back = n < state.step;
  state.step = n;
  $$('[data-step]').forEach((s) => {
    const on = Number(s.dataset.step) === n;
    s.classList.toggle('is-on', on);
    s.classList.toggle('is-back', on && back && animate);
  });
  $$('[data-step-dot]').forEach((d) => d.classList.toggle('is-on', Number(d.dataset.stepDot) <= Math.min(n, 3)));
  $('[data-step-title]').textContent = STEP_TITLES[n];
  $('[data-back]').hidden = n === 1 || n === 4;
  $('[data-drawer-foot]').hidden = n === 4;
  $('[data-next]').innerHTML = n === 3 ? '<svg class="ico"><use href="#i-wa"/></svg>Enviar pedido pelo WhatsApp' : 'Continuar';
  $('[data-error]').textContent = '';
  if (n === 2) fillWhen();
  if (n === 3) paintSummary();
  $('.drawer__body').scrollTop = 0;
  paintCart();
}

function fillWhen() {
  const sel = $('[data-f="when"]');
  const shift = state.cart.shift || state.view;
  const svc = nextService(shift);
  if (!svc) { sel.innerHTML = '<option value="">Sem horários disponíveis</option>'; return; }
  const now = new Date();
  const opts = [];
  if (svc.openNow) opts.push(['O quanto antes', `O quanto antes (cerca de ${CONFIG.prepMinutes} min)`]);
  let t = new Date(Math.max(svc.start, now.getTime() + CONFIG.prepMinutes * 60000));
  t.setMinutes(Math.ceil(t.getMinutes() / 30) * 30, 0, 0);
  const label = dayWord(svc);
  for (; t <= new Date(svc.end - 15 * 60000); t = new Date(t.getTime() + 30 * 60000)) {
    const v = `${label[0].toUpperCase() + label.slice(1)}, ${hm(t)}`;
    opts.push([v, v]);
  }
  const prev = sel.value;
  sel.innerHTML = opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  if (opts.some(([v]) => v === prev)) sel.value = prev;
}

// Dados do cliente lembrados para o próximo pedido
const FIELDS = ['name', 'phone', 'street', 'hood', 'extra', 'ref'];
const remembered = store.get('naturalle:client', {});
FIELDS.forEach((f) => { if (remembered[f]) $(`[data-f="${f}"]`).value = remembered[f]; });
const val = (f) => $(`[data-f="${f}"]`).value.trim();

$('[data-f="phone"]').addEventListener('input', (e) => {
  const d = e.target.value.replace(/\D/g, '').slice(0, 11);
  e.target.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
});
$$('[data-f="mode"]').forEach((r) => r.addEventListener('change', () => { $('[data-addr]').hidden = mode() !== 'entrega'; paintCart(); }));
$$('[data-f="pay"]').forEach((r) => r.addEventListener('change', () => { $('[data-change]').hidden = $('[data-f="pay"]:checked').value !== 'Dinheiro'; }));

function validate(step) {
  $$('.field.has-error').forEach((f) => f.classList.remove('has-error'));
  if (step === 1) {
    if (!state.cart.lines.size) return 'Adicione pelo menos um prato à sacola.';
    if (unavailableLines().length) return 'Há itens que não são servidos no dia do pedido. Remova-os para continuar.';
    if (!nextService(state.cart.shift)) return 'Esse turno não tem atendimento nesta semana.';
  }
  if (step === 2) {
    const need = ['name', 'phone', ...(mode() === 'entrega' ? ['street', 'hood'] : [])];
    const miss = need.filter((f) => !val(f));
    if (val('phone') && val('phone').replace(/\D/g, '').length < 10) miss.push('phone');
    if (miss.length) {
      miss.forEach((f) => $(`[data-f="${f}"]`).closest('.field').classList.add('has-error'));
      $(`[data-f="${miss[0]}"]`).focus();
      return miss.includes('phone') && val('phone') ? 'Confira o número de WhatsApp com DDD.' : 'Preencha os campos destacados.';
    }
    if (mode() === 'entrega' && subtotal() < CONFIG.minOrder) return `O pedido mínimo para entrega é ${brl(CONFIG.minOrder)}. Adicione mais itens ou escolha retirar no local.`;
    if (!$('[data-f="when"]').value) return 'Escolha o horário do pedido.';
  }
  return '';
}

function paintSummary() {
  const addr = mode() === 'entrega' ? `${esc(val('street'))}, ${esc(val('hood'))}${val('extra') ? `, ${esc(val('extra'))}` : ''}` : 'Retirada no restaurante';
  $('[data-summary]').innerHTML = `<h4>Resumo</h4>
    <p><b>${SHIFT_LABEL[state.cart.shift]}</b>, ${esc($('[data-f="when"]').value)}</p>
    <p>${esc(val('name'))}, ${esc(val('phone'))}</p>
    <p>${addr}</p>`;
}

function buildMessage() {
  const pay = $('[data-f="pay"]:checked').value;
  const lines = [...state.cart.lines].map(([id, q]) => `• ${q}x ${ITEMS.get(id).name} (${brl(ITEMS.get(id).price * q)})`);
  const out = [
    `*Novo pedido pelo site Naturalle*`,
    ``,
    `*Turno:* ${SHIFT_LABEL[state.cart.shift]}`,
    `*Quando:* ${$('[data-f="when"]').value}`,
    `*Tipo:* ${mode() === 'entrega' ? 'Entrega' : 'Retirada no local'}`,
    ``,
    `*Itens*`,
    ...lines,
  ];
  if (val('obs')) out.push(``, `*Observação:* ${val('obs')}`);
  out.push(``, `Subtotal: ${brl(subtotal())}`);
  if (mode() === 'entrega') out.push(`Entrega: ${brl(fee())}`);
  out.push(`*Total: ${brl(subtotal() + fee())}*`, ``, `*Cliente:* ${val('name')}`, `*WhatsApp:* ${val('phone')}`);
  if (mode() === 'entrega') {
    out.push(`*Endereço:* ${val('street')}, ${val('hood')}${val('extra') ? `, ${val('extra')}` : ''}`);
    if (val('ref')) out.push(`*Referência:* ${val('ref')}`);
  }
  out.push(`*Pagamento:* ${pay}${pay === 'Dinheiro' && val('change') ? ` (troco para R$ ${val('change')})` : ''}`);
  return out.join('\n');
}

function waLink(text) { return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`; }

$('[data-next]').addEventListener('click', () => {
  const err = validate(state.step);
  $('[data-error]').textContent = err;
  if (err) return;
  if (state.step < 3) return goStep(state.step + 1);
  const client = {}; FIELDS.forEach((f) => (client[f] = val(f)));
  store.set('naturalle:client', client);
  window.open(waLink(buildMessage()), '_blank', 'noopener');
  goStep(4);
});
$('[data-back]').addEventListener('click', () => goStep(state.step - 1));
$('[data-new-order]').addEventListener('click', () => {
  state.cart.lines.clear(); state.cart.shift = null; saveCart();
  $('[data-f="obs"]').value = '';
  goStep(1, false); closeCart(); renderMenu();
});

/* ---------- Aviso ---------- */
let toastT;
function toast(msg) {
  const t = $('[data-toast]');
  t.textContent = msg; t.classList.add('is-on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('is-on'), 1800);
}

/* =========================================================
   VISITE
   ========================================================= */
function paintHours() {
  const today = new Date().getDay();
  const order = [1, 2, 3, 4, 5, 6, 0];
  $('[data-hours]').innerHTML = order.map((d) => {
    const h = CONFIG.hours[d];
    const parts = [h.almoco && `Almoço ${shortH(h.almoco[0])} às ${shortH(h.almoco[1])}`, h.jantar && `Jantar ${shortH(h.jantar[0])} às ${shortH(h.jantar[1])}`].filter(Boolean);
    const cls = d === today ? ' class="is-today"' : '';
    return `<dt${cls}>${DAY_LONG[d]}</dt><dd${cls}>${parts.join(', ') || 'Fechado'}</dd>`;
  }).join('');
}
paintHours();
$('[data-wa-link]').href = waLink('Olá, Naturalle!');
$('[data-map-load]').addEventListener('click', (e) => {
  const f = document.createElement('iframe');
  f.title = 'Mapa da Naturalle em Carpina';
  f.loading = 'lazy';
  f.referrerPolicy = 'no-referrer-when-downgrade';
  f.src = 'https://www.google.com/maps?q=Av.+Pres.+Get%C3%BAlio+Vargas,+413,+Carpina+-+PE,+55815-105&output=embed';
  $('[data-map]').appendChild(f);
  e.currentTarget.remove();
});

/* ---------- Início ---------- */
orderEl.dataset.shift = state.view;
paintShiftCopy();
renderMenu();
paintCart();
