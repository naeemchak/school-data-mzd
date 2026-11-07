/* DISTRICT SCHOOL DATA — DEO (Male) Muzaffarabad. Offline-first client.
   Everything entered is saved on the phone first (outbox) and sent when internet is available. */
'use strict';

/* ---------------- storage ---------------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem('sds_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sds_' + k, JSON.stringify(v)); } catch (e) { toast('Phone storage full'); } },
  del(k) { try { localStorage.removeItem('sds_' + k); } catch (e) { } }
};
const S = { token: LS.get('token'), user: LS.get('user'), boot: LS.get('boot'), emis: LS.get('emis'), view: 'home', arg: null, stack: [] };

/* ---------------- helpers ---------------- */
const $ = s => document.querySelector(s);
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = m => m ? MONTHS[Number(m.slice(5)) - 1] + ' ' + m.slice(0, 4) : '';
function recentMonths(n) { const o = []; const d = new Date(); d.setDate(1); for (let k = 0; k < n; k++) { o.push(d.toISOString().slice(0, 7)); d.setMonth(d.getMonth() - 1); } return o; }
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2600); }
function opts(list, sel, blank) {
  return (blank !== undefined ? `<option value="">${esc(blank)}</option>` : '') +
    list.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(t)}</option>`; }).join('');
}
function formData(root) {
  const o = {}; root.querySelectorAll('[name]').forEach(el => { o[el.name] = el.value.trim(); }); return o;
}
const CLASSES = ['ECE', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
function classesFor(level) {
  const top = { Primary: 'V', Middle: 'VIII', High: 'X', 'Higher Secondary': 'XII' }[level];
  return top ? CLASSES.slice(0, CLASSES.indexOf(top) + 1) : [];
}

/* ---------------- network ---------------- */
async function api(action, payload) {
  const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action, payload, token: S.token }) });
  const j = await r.json();
  if (j.auth) { signOut(true); throw new Error(j.error); }
  return j;
}
const outbox = () => LS.get('outbox', []);
function queue(action, payload, label) {
  const ob = outbox(); ob.push({ client_id: uid(), action, payload, label, ts: new Date().toISOString() }); LS.set('outbox', ob);
  toast(navigator.onLine ? 'Saved. Sending…' : 'Saved on phone. Will be sent when internet is available.');
  showSync(); sync();
}
let syncing = false;
async function sync() {
  const ob = outbox();
  if (syncing || !ob.length || !navigator.onLine || !S.token) { showSync(); return; }
  syncing = true; showSync();
  try {
    const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'batch', token: S.token, items: ob.slice(0, 25) }) });
    const j = await r.json();
    if (j.auth) { signOut(true); return; }
    if (!j.ok) throw new Error(j.error);
    const done = {}, errs = LS.get('errors', []);
    j.results.forEach(x => {
      done[x.client_id] = 1;
      if (!x.ok) { const it = ob.find(o => o.client_id === x.client_id); errs.push({ label: it ? it.label : '', error: x.error, ts: new Date().toISOString() }); }
    });
    LS.set('outbox', outbox().filter(o => !done[o.client_id]));
    LS.set('errors', errs);
    if (j.results.some(x => !x.ok)) toast('Some entries were not accepted. See Home.');
    syncing = false;
    if (outbox().length) return sync();
    await refreshInst(true);
  } catch (e) { /* network trouble: keep everything, retry later */ }
  finally { syncing = false; showSync(); }
}
function showSync() {
  const n = outbox().length, el = $('#sync');
  el.textContent = !S.token ? '' : n ? (navigator.onLine ? (syncing ? 'Sending ' + n + '…' : n + ' to send') : n + ' waiting · offline') : navigator.onLine ? '✓ Up to date' : 'Offline';
}
window.addEventListener('online', () => { showSync(); sync(); });
window.addEventListener('offline', showSync);
setInterval(sync, 60000);

/* ---------------- data ---------------- */
const instKey = e => 'inst_' + e;
const D = () => LS.get(instKey(S.emis), null);
const saveD = d => LS.set(instKey(S.emis), d);
async function refreshInst(silent) {
  if (!S.emis || !navigator.onLine) return;
  try {
    const j = await api('getInstitution', { emis: S.emis });
    if (j.ok) {
      // keep local entries that are still in the outbox on top of server data
      saveD(j); if (!silent || ['staff', 'enrol', 'fees', 'posts', 'home'].includes(S.view)) render();
    }
  } catch (e) { }
}
async function refreshBoot() {
  if (!navigator.onLine) return;
  try { const j = await api('bootstrap', {}); if (j.ok) { S.boot = j; LS.set('boot', j); if (S.view === 'home') render(); } } catch (e) { }
}
const inst = () => (S.boot && S.boot.institutions || []).find(i => i.emis === S.emis) || (D() || {}).inst || {};
const role = () => S.user && S.user.role;

/* ---------------- navigation ---------------- */
function go(view, arg) { S.stack.push([S.view, S.arg]); S.view = view; S.arg = arg; try { history.pushState({ v: view }, ''); } catch (e) { } render(); window.scrollTo(0, 0); }
function back() { const p = S.stack.pop(); if (p) { S.view = p[0]; S.arg = p[1]; } else S.view = 'home'; render(); }
$('#back').onclick = () => history.length > 1 && S.stack.length ? history.back() : back();
window.addEventListener('popstate', back);   // Android back button

function signOut(expired) {
  if (!expired && outbox().length && !confirm(outbox().length + ' entries have not been sent yet. Sign out anyway? They will be lost.')) return;
  ['token', 'user', 'boot', 'emis'].forEach(LS.del);
  if (!expired) LS.set('outbox', []);
  Object.assign(S, { token: null, user: null, boot: null, emis: null, view: 'home', stack: [] });
  if (expired) toast('Please sign in again. Unsent entries are kept.');
  render();
}

/* ---------------- views ---------------- */
const V = {};

function render() {
  const app = $('#app');
  if (!S.token) { $('#title').textContent = 'School Data · DEO Muzaffarabad'; $('#back').hidden = true; app.innerHTML = V.login(); bindLogin(); showSync(); return; }
  $('#back').hidden = S.view === 'home' && !(role() !== 'SCHOOL' && S.emis);
  const i = inst();
  $('#title').textContent = S.emis ? (i.name || S.emis) : S.user.name;
  if (S.view === 'home' && role() !== 'SCHOOL' && !S.emis) { app.innerHTML = V.picker(); bindPicker(); showSync(); return; }
  app.innerHTML = (V[S.view] || V.home)(S.arg);
  (BIND[S.view] || (() => { }))(S.arg);
  showSync();
}
const BIND = {};

V.login = () => `
  <div class="card"><h2>Sign in</h2><div class="ur">لاگ ان: ادارے کا EMIS کوڈ اور PIN</div>
  <label>Login code (EMIS code of the institution, or officer code)</label><input id="lc" inputmode="text" autocomplete="username">
  <label>PIN (6 digits)</label><input id="lp" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password">
  <button class="btn full" id="lb">Sign in</button><div id="lm"></div>
  <p class="muted">PINs are issued by the District Education Office (Male) Muzaffarabad. The first sign-in needs internet; after that, data can be entered offline.</p></div>`;
function bindLogin() {
  $('#lb').onclick = async () => {
    if (!navigator.onLine) { $('#lm').innerHTML = '<div class="msg w">Internet is needed for the first sign-in.</div>'; return; }
    $('#lb').disabled = true;
    try {
      const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'login', payload: { code: $('#lc').value.trim(), pin: $('#lp').value.trim() } }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      S.token = j.token; S.user = j.user; LS.set('token', j.token); LS.set('user', j.user);
      if (j.user.role === 'SCHOOL') { S.emis = j.user.code; LS.set('emis', S.emis); }
      await refreshBoot(); await refreshInst(); sync(); render();
    } catch (e) { $('#lm').innerHTML = `<div class="msg w">${esc(e.message)}</div>`; $('#lb').disabled = false; }
  };
}

/* officer: choose institution */
V.picker = () => {
  const list = (S.boot && S.boot.institutions) || [];
  const p = S.boot && S.boot.pending;
  return `${errorsCard()}
  ${p ? `<div class="card"><b>${p} item(s) waiting for your approval</b><br><button class="btn" onclick="go('approvals')">Open approvals</button></div>` : ''}
  <div class="card"><h2>${esc(S.user.name)}</h2><input id="pf" placeholder="Search by name or EMIS code">
  <div class="list" id="pl">${pickerRows(list, '')}</div></div>
  <button class="btn alt" onclick="go('settings')">Settings / sign out</button>`;
};
function pickerRows(list, q) {
  q = q.toLowerCase();
  return list.filter(i => !q || (i.name + i.emis).toLowerCase().includes(q)).slice(0, 80).map(i =>
    `<div class="it" onclick="pick('${esc(i.emis)}')"><div class="grow"><b>${esc(i.name)}</b><div class="sub">${esc(i.level)} · ${esc(i.emis)} ${i.aeo_circle ? '· ' + esc(i.aeo_circle) : i.halqa ? '· ' + esc(i.halqa) : ''}</div></div>›</div>`).join('')
    || '<p class="muted">No match.</p>';
}
function bindPicker() { $('#pf').oninput = e => { $('#pl').innerHTML = pickerRows(S.boot.institutions, e.target.value); }; }
window.pick = emis => { S.emis = emis; LS.set('emis', emis); S.stack = []; S.view = 'home'; render(); refreshInst(); };

function errorsCard() {
  const e = LS.get('errors', []);
  if (!e.length) return '';
  return `<div class="card"><h2>Entries not accepted</h2>${e.slice(-8).map(x => `<div class="msg w"><b>${esc(x.label)}</b><br>${esc(x.error)}</div>`).join('')}
  <p class="muted">Correct and save these again.</p><button class="btn alt" onclick="LS.set('errors',[]);render()">Dismiss</button></div>`;
}

V.home = () => {
  const i = inst(), d = D();
  const officer = role() !== 'SCHOOL';
  const primaryFees = i.level === 'Primary' && role() === 'SCHOOL';
  const isOffice = i.level === 'Office';
  return `${errorsCard()}
  <div class="card"><b>${esc(i.name || S.emis)}</b><div class="muted">${esc(i.level || '')} · EMIS ${esc(S.emis)} ${i.halqa ? '· ' + esc(i.halqa) : ''} ${i.aeo_circle ? '· ' + esc(i.aeo_circle) : ''}</div>
  ${d ? '' : '<div class="msg w">Data for this institution has not been downloaded yet. Connect to the internet once.</div>'}</div>
  <div class="tiles">
    <button class="tile" onclick="go('staff')"><b>Staff</b><small>Employees, service record, transfers</small><div class="ur">عملہ</div></button>
    <button class="tile" onclick="go('posts')"><b>Posts</b><small>Sanctioned vs filled</small><div class="ur">آسامیاں</div></button>
    ${isOffice ? '' : `<button class="tile" onclick="go('enrol')"><b>Enrolment</b><small>Monthly, class-wise</small><div class="ur">داخلہ</div></button>
    <button class="tile" onclick="go('fees')"><b>Fees</b><small>${primaryFees ? 'Entered by AEO' : 'Collection and deposits'}</small><div class="ur">فیس</div></button>
    <button class="tile" onclick="go('results')"><b>Results</b><small>Term, annual, monthly tests</small><div class="ur">نتائج</div></button>`}
    ${officer ? `<button class="tile" onclick="go('approvals')"><b>Approvals</b><small>${(S.boot && S.boot.pending) || 0} waiting</small><div class="ur">منظوری</div></button>` : ''}
    <button class="tile" onclick="go('settings')"><b>Settings</b><small>Head's details, PIN, sign out</small></button>
  </div>
  ${officer ? `<button class="btn alt full" onclick="S.emis=null;LS.del('emis');S.stack=[];render()">‹ Choose another institution</button>` : ''}`;
};

/* ---------- posts ---------- */
V.posts = () => {
  const d = D(); if (!d) return noData();
  const filled = {};
  if (d.ddoFilled) Object.assign(filled, d.ddoFilled);
  else d.employees.forEach(e => { if (e.post_id) filled[e.post_id] = (filled[e.post_id] || 0) + 1; });
  const rows = d.posts.slice().sort((a, b) => b.bps - a.bps).map(p => {
    const f = filled[p.post_id] || 0, v = p.sanctioned - f;
    return `<tr><td>${esc(p.designation)}</td><td>${p.bps}</td><td class="num">${p.sanctioned}</td><td class="num">${f}</td><td class="num">${v > 0 ? `<span class="badge w">${v}</span>` : v < 0 ? `<span class="badge w">+${-v}</span>` : '0'}</td></tr>`;
  }).join('');
  return `<div class="card"><h2>Sanctioned and filled posts</h2>
  <p class="muted">Sanctioned posts: budget 2026-27 (DDO ${esc(d.inst.ddo)}). Filled posts are counted from the staff register, so this replaces the monthly vacancy return.
  ${d.ddoFilled ? 'Primary-school posts are sanctioned at AEO-circle level; figures are for the whole circle.' : ''}</p>
  <div class="scroll"><table><tr><th>Designation</th><th>BPS</th><th class="num">Sanct.</th><th class="num">Filled</th><th class="num">Vacant</th></tr>${rows}</table></div></div>`;
};
const noData = () => '<div class="card"><div class="msg w">Not downloaded yet. Connect to the internet and open again.</div></div>';

/* ---------- staff ---------- */
V.staff = () => {
  const d = D(); if (!d) return noData();
  const pend = outbox().filter(o => o.payload && (o.payload.employee || o.payload.cnic) && (o.payload.to_emis === S.emis || (o.payload.employee && o.payload.employee.emis === S.emis)));
  const list = d.employees.slice().sort((a, b) => Number(b.post_bps || 0) - Number(a.post_bps || 0)).map(e =>
    `<div class="it" onclick="go('emp',{cnic:'${esc(e.cnic)}'})"><div class="grow"><b>${esc(e.name)}</b>
    <div class="sub">${esc(e.designation)} · BPS ${esc(e.post_bps)}${e.personal_bps && e.personal_bps !== e.post_bps ? ' (personal ' + esc(e.personal_bps) + ')' : ''} · ${esc(e.service_status)}</div></div>
    <span class="badge ${e.verified === 'Verified' ? 'o' : 'w'}">${e.verified === 'Verified' ? 'Verified' : 'Unverified'}</span></div>`).join('');
  const out = (d.transfersOut || []).filter(t => !t.relieved_on).map(t =>
    `<div class="it"><div class="grow"><b>${esc(t.name)}</b><div class="sub">Joined ${esc(t.to_name)} on ${esc(t.joined_on)} · order ${esc(t.order_no)}</div></div>
     <button class="btn alt" onclick="relieve('${esc(t.id)}')">Relieved on…</button></div>`).join('');
  return `<div class="card"><h2>Staff (${d.employees.length})</h2>
  <button class="btn" onclick="go('emp',{mode:'new'})">+ First-time entry</button>
  <button class="btn alt" onclick="go('receive')">Receive transferred employee</button>
  ${pend.length ? `<div class="msg w">${pend.length} staff entr${pend.length > 1 ? 'ies' : 'y'} waiting to be sent.</div>` : ''}
  <div class="list">${list || '<p class="muted">No employee on the register yet. Use “First-time entry” for each employee who is not yet in the database.</p>'}</div></div>
  ${out ? `<div class="card"><h2>Transferred out: confirm relieving date</h2><div class="list">${out}</div></div>` : ''}`;
};
window.relieve = id => {
  const dt = prompt('Date of relieving (yyyy-mm-dd):', today());
  if (!dt) return;
  queue('confirmRelieving', { id, relieved_on: dt }, 'Relieving date');
};

const DOMICILE = ['Muzaffarabad', 'Jhelum Valley (Hattian Bala)', 'Neelum', 'Bagh', 'Haveli', 'Poonch', 'Sudhnoti', 'Mirpur', 'Kotli', 'Bhimber', 'Refugee 1947 / 1989', 'Other'];
const QUAL = ['Below Matric', 'Matric', 'Intermediate', 'BA / BSc (14 years)', 'BS (16 years)', 'MA / MSc', 'MPhil / MS', 'PhD'];
const PROF = ['None', 'PTC / CT', 'ADE', 'BEd', 'BEd (Hons)', 'MEd', 'Other'];
const STATUS = ['Regular', 'Temporary', 'Ad hoc', 'Contract', 'Stopgap', 'Daily wages'];
const DUTY = ['On duty', 'Attached out to another institution / office', 'Attached in from another institution / office', 'On deputation',
  'On sanctioned leave', 'On study leave', 'Leave preparatory to retirement (LPR)', 'Under suspension', 'Absent without leave'];
const MODE = ['Initial recruitment (PSC)', 'Initial recruitment (testing agency)', 'Initial recruitment (departmental committee)', 'Promotion from BPS-1 (quota)', "Deceased employee's family quota", 'Other'];
const BPS = Array.from({ length: 22 }, (_, k) => String(k + 1));

V.emp = arg => {
  const d = D(); if (!d) return noData();
  const isNew = arg.mode === 'new';
  const e = isNew ? { emis: S.emis, joined_on: '', service_status: 'Regular', duty_status: 'On duty' } : (d.employees.find(x => x.cnic === arg.cnic) || {});
  const posts = d.posts.slice().sort((a, b) => b.bps - a.bps).map(p => [p.post_id, `${p.designation} (BPS-${p.bps})`]);
  return `<div class="card" id="ef"><h2>${isNew ? 'First-time entry' : esc(e.name)}</h2>
  ${isNew ? '<p class="muted">Made once in an employee’s career. After this, on transfer the record moves with the employee; nothing is typed again.</p>' : ''}
  <h3>Identity</h3>
  <label>CNIC *</label><input name="cnic" value="${esc(e.cnic)}" ${isNew ? '' : 'readonly'} inputmode="numeric" placeholder="12345-1234567-1">
  <div class="row"><div><label>Personnel No.</label><input name="personnel_no" value="${esc(e.personnel_no)}"></div>
  <div><label>Mobile *</label><input name="mobile" value="${esc(e.mobile)}" inputmode="tel" placeholder="03XX-XXXXXXX"></div></div>
  <label>Full name (as in service record) *</label><input name="name" value="${esc(e.name)}">
  <label>Father's name *</label><input name="father_name" value="${esc(e.father_name)}">
  <div class="row"><div><label>Date of birth (as on SSC certificate) *</label><input type="date" name="dob" value="${esc(e.dob)}"></div>
  <div><label>WhatsApp, if different</label><input name="whatsapp" value="${esc(e.whatsapp)}" inputmode="tel"></div></div>
  <div class="row"><div><label>Domicile</label><select name="domicile">${opts(DOMICILE, e.domicile, '—')}</select></div>
  <div><label>Academic qualification</label><select name="qualification">${opts(QUAL, e.qualification, '—')}</select></div></div>
  <div class="row"><div><label>Professional qualification</label><select name="prof_qualification">${opts(PROF, e.prof_qualification, '—')}</select></div>
  <div><label>Subject of specialisation</label><input name="subject" value="${esc(e.subject)}"></div></div>
  <h3>First appointment in the department</h3>
  <div class="row"><div><label>Date *</label><input type="date" name="first_appt_date" value="${esc(e.first_appt_date)}"></div>
  <div><label>BPS *</label><select name="first_bps">${opts(BPS, e.first_bps, '—')}</select></div></div>
  <label>Designation at first appointment *</label><input name="first_designation" value="${esc(e.first_designation)}" placeholder="e.g. Primary Teacher">
  <label>Mode of first appointment</label><select name="appt_mode">${opts(MODE, e.appt_mode, '—')}</select>
  <h3>Present post</h3>
  <label>Post held (from sanctioned posts) *</label><select name="post_id">${opts(posts, e.post_id, '— choose —')}</select>
  <div class="row"><div><label>Personal BPS, if different (upgradation / move-over)</label><select name="personal_bps">${opts(BPS, e.personal_bps, 'Same as post')}</select></div>
  <div><label>Current basic pay (Rs) *</label><input name="basic_pay" value="${esc(e.basic_pay)}" inputmode="numeric"></div></div>
  <div class="row"><div><label>Employment status</label><select name="service_status">${opts(STATUS, e.service_status)}</select></div>
  <div><label>Joined this institution on *</label><input type="date" name="joined_on" value="${esc(e.joined_on)}"></div></div>
  <label>Present duty status</label><select name="duty_status">${opts(DUTY, e.duty_status)}</select>
  <label>Actually working at (only if attached elsewhere)</label><input name="working_at" value="${esc(e.working_at)}">
  <div id="histbox">${isNew ? histEditor([], []) : `<p class="muted">${navigator.onLine ? 'Loading service history…' : 'Service history can be viewed and edited when online.'}</p>`}</div>
  <button class="btn full" id="es">${isNew ? 'Save employee' : 'Save changes'}</button>
  ${isNew ? '' : `<button class="btn warn" onclick="go('depart',{cnic:'${esc(e.cnic)}',name:'${esc(e.name)}'})">Record retirement / death / leaving district</button>`}
  </div>`;
};
function histEditor(promos, posts) {
  const pr = (x = {}) => `<div class="hist" data-h="p"><div class="row"><div><label>Date of promotion</label><input type="date" data-f="date" value="${esc(x.date)}"></div>
    <div><label>New BPS</label><select data-f="to_bps">${opts(BPS, x.to_bps, '—')}</select></div></div>
    <label>From designation</label><input data-f="from_designation" value="${esc(x.from_designation)}">
    <label>Promoted to (designation)</label><input data-f="to_designation" value="${esc(x.to_designation)}">
    <label>Order No. and date</label><input data-f="order_no" value="${esc(x.order_no)}"></div>`;
  const po = (x = {}) => `<div class="hist" data-h="t"><label>Station (school / office)</label><input data-f="station_name" value="${esc(x.station_name)}"><input type="hidden" data-f="station" value="${esc(x.station)}">
    <label>Designation there</label><input data-f="designation" value="${esc(x.designation)}">
    <div class="row"><div><label>From</label><input type="date" data-f="from_date" value="${esc(x.from_date)}"></div>
    <div><label>To</label><input type="date" data-f="to_date" value="${esc(x.to_date)}"></div></div>
    <label>Order No. and date</label><input data-f="order_no" value="${esc(x.order_no)}"></div>`;
  window._pr = pr; window._po = po;
  return `<h3>Promotions (one block for each)</h3><div id="hp">${promos.map(pr).join('')}</div>
  <button class="btn alt" type="button" onclick="document.getElementById('hp').insertAdjacentHTML('beforeend',_pr())">+ Add promotion</button>
  <h3>Previous postings (transfer history, oldest first)</h3><div id="ht">${posts.map(po).join('')}</div>
  <button class="btn alt" type="button" onclick="document.getElementById('ht').insertAdjacentHTML('beforeend',_po())">+ Add posting</button>
  <p class="muted">The posting at this institution is added automatically from the joining date.</p>`;
}
function readHist(kind) {
  return Array.from(document.querySelectorAll(`[data-h="${kind}"]`)).map(b => {
    const o = {}; b.querySelectorAll('[data-f]').forEach(el => { o[el.dataset.f] = el.value.trim(); }); return o;
  }).filter(o => Object.values(o).some(v => v));
}
BIND.emp = async arg => {
  const isNew = arg.mode === 'new';
  let histLoaded = isNew;
  if (!isNew && navigator.onLine) {
    try {
      const j = await api('searchEmployee', { q: arg.cnic });
      const f = j.found && j.found[0];
      if (f && $('#histbox')) {
        $('#histbox').innerHTML = histEditor(f.promotions, f.postings);
        histLoaded = true;
      }
    } catch (e) { }
  }
  $('#es').onclick = () => {
    const d = D(), f = formData($('#ef'));
    f.cnic = f.cnic.replace(/\D/g, '');
    if (f.cnic.length !== 13) return toast('CNIC must have 13 digits');
    f.cnic = f.cnic.slice(0, 5) + '-' + f.cnic.slice(5, 12) + '-' + f.cnic.slice(12);
    for (const k of ['name', 'father_name', 'dob', 'first_appt_date', 'first_bps', 'first_designation', 'post_id', 'basic_pay', 'joined_on', 'mobile'])
      if (!f[k]) return toast('Please fill: ' + ($(`[name="${k}"]`).previousElementSibling || {}).textContent);
    if (isNew && d.employees.some(x => x.cnic === f.cnic)) return toast('This CNIC is already on your register');
    const p = d.posts.find(x => x.post_id === f.post_id);
    Object.assign(f, { emis: S.emis, designation: p.designation, post_bps: String(p.bps) });
    if (!f.personal_bps) f.personal_bps = '';
    const payload = { mode: isNew ? 'new' : 'update', employee: f };
    if (histLoaded) {
      payload.promotions = readHist('p');
      const posts = readHist('t').filter(x => x.station !== S.emis);
      posts.push({ station: S.emis, station_name: inst().name, designation: f.designation, from_date: f.joined_on, to_date: '', order_no: '' });
      payload.postings = posts;
    }
    queue('saveEmployee', payload, 'Employee: ' + f.name);
    // show at once in the list
    const ex = d.employees.findIndex(x => x.cnic === f.cnic);
    if (ex >= 0) d.employees[ex] = Object.assign(d.employees[ex], f); else d.employees.push(Object.assign({ verified: 'Pending' }, f));
    saveD(d); back();
  };
};

V.depart = arg => `<div class="card" id="df"><h2>${esc(arg.name)} is leaving</h2>
  <label>Reason</label><select name="reason">${opts(['Retired', 'Died', 'Resigned', 'Transferred outside District Muzaffarabad', 'Transferred to another department',
    'Removed / terminated / term expired'])}</select>
  <label>Effective date</label><input type="date" name="date" value="${today()}">
  <label>Order No. and date</label><input name="order_no"><label>Remarks</label><input name="remark">
  <p class="muted">For a transfer within the district, nothing is needed here: the receiving head brings the record across.</p>
  <button class="btn warn full" id="ds">Confirm</button></div>`;
BIND.depart = arg => {
  $('#ds').onclick = () => {
    const f = formData($('#df')); f.cnic = arg.cnic;
    queue('recordDeparture', f, 'Departure: ' + arg.name);
    const d = D(); d.employees = d.employees.filter(x => x.cnic !== arg.cnic); saveD(d);
    S.stack.pop(); back();
  };
};

V.receive = () => `<div class="card"><h2>Receive transferred employee</h2>
  <p class="muted">Search by the employee's CNIC or personnel number. If found, the service record comes with the employee and only the transfer order and joining date are needed.</p>
  <label>CNIC or Personnel No.</label><input id="rq" inputmode="numeric"><button class="btn full" id="rs">Search</button><div id="rr"></div></div>`;
BIND.receive = () => {
  $('#rs').onclick = async () => {
    if (!navigator.onLine) { $('#rr').innerHTML = '<div class="msg w">Searching needs internet.</div>'; return; }
    $('#rr').innerHTML = '<p class="muted">Searching…</p>';
    try {
      const j = await api('searchEmployee', { q: $('#rq').value.trim() });
      if (!j.ok) throw new Error(j.error);
      if (!j.found.length) { $('#rr').innerHTML = `<div class="msg w">No record found. If the employee comes from outside the district or has never been entered, make a first-time entry.</div><button class="btn" onclick="S.stack.pop();go('emp',{mode:'new'})">First-time entry</button>`; return; }
      const f = j.found[0], e = f.employee, d = D();
      const posts = d.posts.slice().sort((a, b) => b.bps - a.bps).map(p => [p.post_id, `${p.designation} (BPS-${p.bps})`]);
      $('#rr').innerHTML = `<div class="hist"><b>${esc(e.name)}</b> s/o ${esc(e.father_name)}<div class="sub">${esc(e.designation)} · BPS ${esc(e.post_bps)} · now at ${esc(f.station_name)}</div>
        <div class="sub">Born ${esc(e.dob)} · first appointed ${esc(e.first_appt_date)} as ${esc(e.first_designation)}</div>
        <div class="sub">Promotions: ${f.promotions.map(p => esc(p.to_designation) + ' (' + esc(p.date) + ')').join('; ') || 'none'}</div>
        <div class="sub">Postings: ${f.postings.map(p => esc(p.station_name) + ' ' + esc(p.from_date) + '–' + esc(p.to_date || 'now')).join('; ')}</div></div>
        ${e.emis === S.emis ? '<div class="msg o">Already at this institution.</div>' : `<div id="cf">
        <label>Post at this institution *</label><select name="post_id">${opts(posts, '', '— choose —')}</select>
        <div class="row"><div><label>Transfer order No. *</label><input name="order_no"></div><div><label>Order date</label><input type="date" name="order_date"></div></div>
        <label>Joined here on *</label><input type="date" name="joined_on" value="${today()}">
        <button class="btn full" id="cs">Bring record to this institution</button></div>`}`;
      if ($('#cs')) $('#cs').onclick = () => {
        const c = formData($('#cf'));
        if (!c.post_id || !c.order_no || !c.joined_on) return toast('Post, order No. and joining date are required');
        const p = d.posts.find(x => x.post_id === c.post_id);
        queue('claimEmployee', Object.assign(c, { cnic: e.cnic, to_emis: S.emis, designation: p.designation }), 'Transfer in: ' + e.name);
        d.employees.push(Object.assign({}, e, { emis: S.emis, post_id: c.post_id, designation: p.designation, post_bps: String(p.bps), joined_on: c.joined_on }));
        saveD(d); back();
      };
    } catch (err) { $('#rr').innerHTML = `<div class="msg w">${esc(err.message)}</div>`; }
  };
};

/* ---------- enrolment ---------- */
V.enrol = () => {
  const d = D(); if (!d) return noData();
  const cls = classesFor(d.inst.level);
  const months = recentMonths(3);
  return `<div class="card" id="nf"><h2>Monthly enrolment</h2><div class="ur">ماہانہ داخلہ</div>
  <label>Month</label><select id="nm">${opts(months.map(m => [m, monthLabel(m)]), months[0])}</select>
  <p class="muted">Figures are filled in from the last month entered. If nothing changed, just press Save. “New admissions” are students admitted during the month; they are used to work out admission fee.</p>
  <div class="scroll"><table id="nt"></table></div><button class="btn full" id="ns">Save enrolment</button></div>`;
};
BIND.enrol = () => {
  const d = D(), cls = classesFor(d.inst.level);
  const draw = () => {
    const m = $('#nm').value;
    let src = d.enrolment.filter(r => r.month === m);
    const prefilled = !src.length;
    if (!src.length) { const prev = d.enrolment.map(r => r.month).filter(x => x < m).sort().pop(); src = d.enrolment.filter(r => r.month === prev).map(r => Object.assign({}, r, { new_admissions: 0 })); }
    const g = c => src.find(r => r.class === c) || {};
    const st = (d.enrolment.find(r => r.month === m) || {}).status;
    $('#nt').innerHTML = `<tr><th>Class</th><th>Boys</th><th>Girls</th><th>New adm.</th></tr>` + cls.map(c =>
      `<tr><td>${c}</td><td><input data-c="${c}" data-k="boys" value="${esc(g(c).boys || 0)}" inputmode="numeric"></td>
      <td><input data-c="${c}" data-k="girls" value="${esc(g(c).girls || 0)}" inputmode="numeric"></td>
      <td><input data-c="${c}" data-k="new_admissions" value="${esc(g(c).new_admissions || 0)}" inputmode="numeric"></td></tr>`).join('') +
      `<tr><td colspan="4" class="muted">${st ? 'Status: ' + esc(st) : prefilled ? 'Not yet entered for this month' : ''}</td></tr>`;
  };
  $('#nm').onchange = draw; draw();
  $('#ns').onclick = () => {
    const m = $('#nm').value, rows = cls.map(c => {
      const o = { class: c }; document.querySelectorAll(`[data-c="${c}"]`).forEach(el => { o[el.dataset.k] = Number(el.value) || 0; }); return o;
    });
    queue('saveEnrolment', { emis: S.emis, month: m, rows }, 'Enrolment ' + monthLabel(m));
    d.enrolment = d.enrolment.filter(r => r.month !== m).concat(rows.map(r => Object.assign({ month: m, status: 'Not sent yet' }, r)));
    saveD(d); back();
  };
};

/* ---------- fees ---------- */
const HEADS = [['tuition', 'Tuition fee'], ['admission', 'Admission fee'], ['annual_fund', 'School annual fund'], ['scout_fund', 'Scout fund']];
function expected(d, m) {
  const meta = S.boot.meta, rows = d.enrolment.filter(r => r.month === m);
  const ex = { tuition: 0, admission: 0, annual_fund: 0, scout_fund: 0 };
  rows.forEach(r => {
    const i = CLASSES.indexOf(r.class), lv = i <= 5 ? 'Primary' : i <= 8 ? 'Middle' : i <= 10 ? 'High' : 'Inter', f = meta.fees[lv];
    const n = Number(r.boys || 0) + Number(r.girls || 0), a = Number(r.new_admissions || 0);
    ex.tuition += n * f.tuition; ex.admission += a * f.admission;
    ex.annual_fund += (m.slice(5) === meta.sessionStart ? n : a) * f.annual_fund;
    if (i >= 3) ex.scout_fund += n * (i >= 11 ? meta.scout.inter : meta.scout.low);
  });
  return { ex, has: rows.length > 0 };
}
V.fees = () => {
  const d = D(); if (!d) return noData();
  if (d.inst.level === 'Primary' && role() === 'SCHOOL') return '<div class="card"><h2>Fees</h2><p>Primary-school fees are collected, deposited and entered by the AEO.</p></div>';
  const months = recentMonths(3);
  const deps = d.deposits.slice().reverse().map(x => `<div class="it"><div class="grow"><b>Rs ${esc(x.amount)}</b> · ${esc(x.account)}<div class="sub">Challan ${esc(x.challan_no)}, ${esc(x.challan_date)} · for ${monthLabel(x.month)} · ${esc(x.status)}</div></div></div>`).join('');
  return `<div class="card" id="ff"><h2>Fee collection</h2><div class="ur">فیس کی وصولی</div>
  <label>Month</label><select id="fm">${opts(months.map(m => [m, monthLabel(m)]), months[0])}</select>
  <div id="fx"></div><button class="btn full" id="fs">Save collection</button></div>
  <div class="card"><h2>Deposits (challans)</h2><div id="fd"></div><button class="btn" onclick="go('deposit')">+ Add challan</button><div class="list">${deps || '<p class="muted">No deposit recorded.</p>'}</div></div>`;
};
BIND.fees = () => {
  const d = D(); if (!$('#fm')) return;
  const draw = () => {
    const m = $('#fm').value, { ex, has } = expected(d, m), saved = d.fees.filter(r => r.month === m);
    const col = h => { const r = saved.find(x => x.fee_head === h); return r ? r.collected : ex[h]; };
    const sc = Number(col('scout_fund'));
    $('#fx').innerHTML = (has ? '' : `<div class="msg w">Enrolment for ${monthLabel(m)} is not entered yet; expected amounts need it. <a href="#" onclick="go('enrol');return false">Enter enrolment</a></div>`) +
      `<table><tr><th>Fee head</th><th class="num">Expected</th><th>Collected (Rs)</th></tr>${HEADS.map(([h, t]) =>
        `<tr><td>${t}</td><td class="num">${ex[h]}</td><td><input data-h="${h}" value="${esc(col(h))}" inputmode="numeric"></td></tr>`).join('')}</table>
      <label>Reason if collection is less than expected</label><input id="frm" value="${esc((saved[0] || {}).remark || '')}">
      <p class="muted">Expected = enrolment × notified rates (no exemptions). Deposit due: A/C 101 Rs ${Number(col('tuition')) + Number(col('admission')) + Number(col('annual_fund'))};
      scout fund: school Rs ${Math.round(sc * .4)}, DEO / District Scouts Commissioner Rs ${Math.round(sc * .1)}, provincial Rs ${Math.round(sc * .5)}.</p>`;
  };
  $('#fm').onchange = draw; draw();
  $('#fs').onclick = () => {
    const m = $('#fm').value, rows = HEADS.map(([h]) => ({ fee_head: h, collected: Number($(`[data-h="${h}"]`).value) || 0 }));
    const { ex } = expected(d, m);
    const short = rows.some(r => r.collected < ex[r.fee_head]);
    if (short && !$('#frm').value.trim()) return toast('Collection is less than expected: please give the reason');
    queue('saveFees', { emis: S.emis, month: m, rows, remark: $('#frm').value.trim() }, 'Fees ' + monthLabel(m));
    d.fees = d.fees.filter(r => r.month !== m).concat(rows.map(r => Object.assign({ month: m, remark: $('#frm').value.trim() }, r)));
    saveD(d); toast('Saved');
  };
};
V.deposit = () => {
  const months = recentMonths(3);
  return `<div class="card" id="pf2"><h2>Add deposit challan</h2>
  <label>Fees of month</label><select name="month">${opts(months.map(m => [m, monthLabel(m)]), months[0])}</select>
  <label>Deposited into</label><select name="account">${opts(S.boot.meta.accounts)}</select>
  <div class="row"><div><label>Challan No. *</label><input name="challan_no"></div><div><label>Challan date *</label><input type="date" name="challan_date" value="${today()}"></div></div>
  <div class="row"><div><label>Amount (Rs) *</label><input name="amount" inputmode="numeric"></div><div><label>Bank and branch</label><input name="bank_branch"></div></div>
  <label>Remarks</label><input name="remark"><button class="btn full" id="ps">Save challan</button></div>`;
};
BIND.deposit = () => {
  $('#ps').onclick = () => {
    const f = formData($('#pf2'));
    if (!f.challan_no || !f.challan_date || !Number(f.amount)) return toast('Challan No., date and amount are required');
    f.emis = S.emis; f.id = uid();
    queue('saveDeposit', { deposit: f }, 'Challan ' + f.challan_no);
    const d = D(); d.deposits.push(Object.assign({ status: 'Not sent yet' }, f)); saveD(d); back();
  };
};

/* ---------- results ---------- */
function sessionOf(date) { const y = date.getFullYear(), m = date.getMonth() + 1; return m >= 3 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`; }
function examList() {
  const now = new Date(), cur = sessionOf(now), prevD = new Date(now); prevD.setFullYear(now.getFullYear() - 1);
  const out = [];
  [cur, sessionOf(prevD)].forEach(s => {
    out.push([`${s} Term-1`, `${s} · Term-1 examination`], [`${s} Term-2 (Annual)`, `${s} · Term-2 (annual) examination`]);
  });
  recentMonths(6).forEach(m => out.push([`Monthly test ${m}`, `Monthly test · ${monthLabel(m)}`]));
  return out;
}
V.results = () => {
  const d = D(); if (!d) return noData();
  const cls = classesFor(d.inst.level).filter(c => c !== 'ECE');
  const done = d.results.map(r => `<span class="badge ${r.status === 'Submitted' ? 'w' : 'o'}">${esc(r.exam)} · ${esc(r.class)}${r.group ? ' ' + esc(r.group) : ''}</span>`).join(' ');
  return `<div class="card" id="rf"><h2>Exam results (class-wise)</h2><div class="ur">نتائج</div>
  <label>Examination</label><select id="rx">${opts(examList())}</select><label>Class</label><select id="rc">${opts(cls)}</select>
  <div id="rgw"></div>
  <p class="muted">For each subject, enter how many students fell in each band of marks: A+ 80% and above, A 70–79, B 60–69, C 50–59, D 40–49, E 33–39, F below 33.
  “Appeared” and “passed” are worked out automatically. In the OVERALL row, put passed students by aggregate percentage, and in F the number declared failed.</p>
  <div id="rt"></div>
  <label>Add an elective / optional subject taught in this class</label><select id="re"></select>
  <button class="btn full" id="rs">Save results</button>
  <h3>Already entered</h3><div>${done || '<span class="muted">None yet</span>'}</div></div>`;
};
BIND.results = () => {
  if (!$('#rx')) return;
  let extra = [];
  const B = ['aplus', 'a', 'b', 'c', 'd', 'e', 'f'], BL = ['A+', 'A', 'B', 'C', 'D', 'E', 'F'];
  const scheme = () => SCHEME.forClass($('#rc').value);
  const group = () => ($('#rg') && $('#rg').value) || '';
  const drawGroup = () => {
    const s = scheme(); extra = [];
    $('#rgw').innerHTML = s && s.groups.length > 1 ? `<label>Group</label><select id="rg">${opts(s.groups)}</select>` : '';
    if ($('#rg')) $('#rg').onchange = () => { extra = []; draw(); };
    draw();
  };
  const draw = async () => {
    const s = scheme(); if (!s) { $('#rt').innerHTML = ''; return; }
    const g = s.get(group());
    let saved = [];
    if (navigator.onLine) { try { const j = await api('getResults', { emis: S.emis, exam: $('#rx').value, class: $('#rc').value, group: group() }); saved = j.rows || []; } catch (e) { } }
    saved.forEach(r => { if (!g.fixed.some(f => f[0] === r.subject) && !g.grades.includes(r.subject) && r.subject !== 'OVERALL' && !extra.some(x => x[0] === r.subject)) extra.push([r.subject, r.max_marks]); });
    const val = (sub, b) => { const r = saved.find(x => x.subject === sub); return r ? r[b] : ''; };
    const markRow = ([sub, max]) => `<div class="sb" data-s="${esc(sub)}" data-m="${max || ''}" data-mode="marks"><b>${esc(sub === 'OVERALL' ? 'OVERALL (whole class)' : sub)}</b>${max ? ` <span class="muted">/ ${max}</span>` : ''}
      <div class="bands">${B.map((b, k) => `<div><span>${BL[k]}</span><input data-b="${b}" value="${esc(val(sub, b))}" inputmode="numeric"></div>`).join('')}</div></div>`;
    const gradeRow = sub => `<div class="sb" data-s="${esc(sub)}" data-mode="grade"><b>${esc(sub)}</b> <span class="muted">(graded A–D)</span>
      <div class="bands">${['a', 'b', 'c', 'd'].map((b, k) => `<div><span>${'ABCD'[k]}</span><input data-b="${b}" value="${esc(val(sub, b))}" inputmode="numeric"></div>`).join('')}</div></div>`;
    $('#rt').innerHTML = markRow(['OVERALL', '']) + g.fixed.map(markRow).join('') + extra.map(markRow).join('') + g.grades.map(gradeRow).join('');
    $('#re').innerHTML = opts(g.electives.filter(x => !extra.some(e => e[0] === x)), '', g.electives.length ? '— choose to add —' : 'None for this class');
    $('#re').onchange = () => { if ($('#re').value) { extra.push([$('#re').value, g.electiveMax]); draw(); } };
  };
  $('#rc').onchange = drawGroup; $('#rx').onchange = draw; drawGroup();
  $('#rs').onclick = () => {
    const rows = Array.from(document.querySelectorAll('#rt [data-s]')).map(tr => {
      const o = { subject: tr.dataset.s, mode: tr.dataset.mode, max_marks: tr.dataset.m || '' };
      tr.querySelectorAll('[data-b]').forEach(el => { o[el.dataset.b] = Number(el.value) || 0; }); return o;
    }).filter(o => B.some(b => o[b]));
    if (!rows.length) return toast('Nothing entered');
    const ov = rows.find(r => r.subject === 'OVERALL');
    if (!ov) return toast('Please fill the OVERALL row');
    const total = B.reduce((s, b) => s + ov[b], 0);
    const bad = rows.filter(r => r.mode === 'marks' && r.subject !== 'OVERALL' && B.reduce((s, b) => s + r[b], 0) > total);
    if (bad.length && !confirm(`In ${bad.map(b => b.subject).join(', ')} more students are entered than in OVERALL (${total}). Save anyway?`)) return;
    const p = { emis: S.emis, exam: $('#rx').value, class: $('#rc').value, group: group(), rows };
    queue('saveResults', p, `Results ${p.exam} Class ${p.class}`);
    const d = D(); d.results = d.results.filter(r => !(r.exam === p.exam && r.class === p.class && r.group === p.group)).concat([{ exam: p.exam, class: p.class, group: p.group, status: 'Not sent yet' }]);
    saveD(d); back();
  };
};

/* ---------- approvals ---------- */
V.approvals = () => `<div class="card"><h2>Waiting for approval</h2><div id="al"><p class="muted">${navigator.onLine ? 'Loading…' : 'Approvals need internet.'}</p></div></div>`;
BIND.approvals = async () => {
  if (!navigator.onLine) return;
  const j = await api('listPending', {});
  const items = j.items || [];
  S.boot.pending = items.length; LS.set('boot', S.boot);
  $('#al').innerHTML = items.length ? items.map((x, k) => `<div class="it"><div class="grow"><b>${esc(x.inst)}</b><div class="sub">${esc(x.what)} · ${esc(x.submitted_on)}</div>
    <button class="btn" onclick="rev(${k},'approve')">Approve</button><button class="btn warn" onclick="rev(${k},'return')">Return</button>
    <button class="btn alt" onclick="pick('${esc(x.emis)}')">Open school</button></div></div>`).join('') : '<p class="muted">Nothing is waiting.</p>';
  window.rev = (k, decision) => {
    const x = items[k]; let remark = '';
    if (decision === 'return') { remark = prompt('Reason for returning (the school will see it):') || ''; if (!remark) return; }
    queue('review', { sheet: x.sheet, key: x.key, decision, remark }, `${decision === 'return' ? 'Return' : 'Approve'}: ${x.inst}`);
    items.splice(k, 1); S.boot.pending = items.length; LS.set('boot', S.boot); BIND.approvals();
  };
};

/* ---------- settings ---------- */
V.settings = () => {
  const i = inst(), isInst = i.level && i.level !== 'Office';
  return `${isInst ? `<div class="card" id="hf"><h2>Head of institution</h2>
  <label>Name of head / in-charge</label><input name="head_name" value="${esc(i.head_name)}">
  <label>Mobile</label><input name="head_mobile" value="${esc(i.head_mobile)}" inputmode="tel"><button class="btn" id="hs">Save</button></div>` : ''}
  <div class="card"><h2>Change PIN</h2><label>Current PIN</label><input id="p0" type="password" inputmode="numeric">
  <label>New 6-digit PIN</label><input id="p1" type="password" inputmode="numeric" maxlength="6"><button class="btn" id="pc">Change PIN</button>
  <p class="muted">Keep the PIN with the head. On handing over charge, the new head should change it.</p></div>
  <div class="card"><h2>This phone</h2><p class="muted">Signed in as ${esc(S.user.code)} (${esc(S.user.role)}). Waiting to send: ${outbox().length}.</p>
  <button class="btn alt" onclick="sync();refreshInst();refreshBoot();toast('Refreshing')">Refresh now</button>
  <button class="btn warn" onclick="signOut()">Sign out</button></div>`;
};
BIND.settings = () => {
  if ($('#hs')) $('#hs').onclick = () => {
    const f = formData($('#hf')); f.emis = S.emis;
    queue('updateHead', f, 'Head details');
    const b = S.boot.institutions.find(x => x.emis === S.emis); if (b) Object.assign(b, f); LS.set('boot', S.boot);
  };
  $('#pc').onclick = async () => {
    if (!navigator.onLine) return toast('Changing the PIN needs internet');
    const j = await api('changePin', { old: $('#p0').value, pin: $('#p1').value });
    if (!j.ok) return toast(j.error);
    toast('PIN changed. Please sign in with the new PIN.'); signOut(true);
  };
};

/* ---------------- start ---------------- */
render();
if (S.token) { refreshBoot(); refreshInst(true); sync(); }
