/* DISTRICT SCHOOL DATA — DEO (Male) Muzaffarabad. Offline-first client.
   Everything entered is saved on the phone first (outbox) and sent when internet is available. */
'use strict';

/* ---------------- storage ---------------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem('sds_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sds_' + k, JSON.stringify(v)); } catch (e) { toast('Phone storage full'); } },
  del(k) { try { localStorage.removeItem('sds_' + k); } catch (e) { } }
};
const S = { operator: LS.get('operator', ''), token: LS.get('token'), user: LS.get('user'), boot: LS.get('boot'), emis: LS.get('emis'), view: 'home', arg: null, stack: [] };

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
  const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action, payload, token: S.token, operator: S.operator }) });
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
    const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'batch', token: S.token, operator: S.operator, items: ob.slice(0, 25) }) });
    const j = await r.json();
    if (j.auth) { signOut(true); return; }
    if (!j.ok) throw new Error(j.error);
    const done = {}, errs = LS.get('errors', []);
    j.results.forEach(x => {
      done[x.client_id] = 1;
      if (!x.ok) { const it = ob.find(o => o.client_id === x.client_id); errs.push({ label: it ? it.label : '', error: x.error, ts: new Date().toISOString() }); }
    });
    LS.set('outbox', outbox().filter(o => !done[o.client_id]));
    if (Object.keys(done).length) { S.dashStale = true; if (S.view === 'home' && $('#dash')) DASH.load($('#dash'), role() !== 'SCHOOL' ? S.emis : ''); }   // figures change after a save
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
window.addEventListener('online', () => SCOPE.refresh(false));
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
  NAV.close();
  if (!S.token) { document.body.classList.remove('wide', 'nav'); $('#side').hidden = true; $('#menu').hidden = true; $('#title').textContent = 'School Data · DEO Muzaffarabad'; $('#back').hidden = true; app.innerHTML = V.login(); bindLogin(); showSync(); return; }
  document.body.classList.add('nav'); $('#side').hidden = false; $('#menu').hidden = false;
  document.body.classList.toggle('wide', ['home', 'reports', 'institutions', 'search', 'review', 'approvals'].includes(S.view));
  $('#back').hidden = !S.stack.length;
  const i = inst();
  const TOP = { building: '', institutions: 'Institutions', search: 'Staff search', approvals: 'Approvals', review: 'Review', reports: 'Reports', settings: 'Settings', about: 'About' };
  $('#title').textContent = TOP[S.view] && role() !== 'SCHOOL' ? TOP[S.view] : S.emis ? (i.name || S.emis) : S.user.name;
  NAV.render();
  if (S.view === 'home' && role() !== 'SCHOOL' && !S.emis) { app.innerHTML = V.picker(); bindPicker(); showSync(); return; }
  app.innerHTML = (V[S.view] || V.home)(S.arg);
  (BIND[S.view] || (() => { }))(S.arg);
  showSync();
}
const BIND = {};
BIND.home = () => { if ($('#dash')) DASH.load($('#dash'), role() !== 'SCHOOL' ? S.emis : ''); };

V.login = () => `
  <div class="card"><h2>Sign in</h2><div class="ur">لاگ ان: ادارے کا EMIS کوڈ اور PIN</div>
  <label>Login code (EMIS code of the institution, or officer code)</label><input id="lc" inputmode="text" autocomplete="username">
  <label>PIN (6 digits)</label><input id="lp" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password">
  <label>Your name and designation (person entering the data)</label><input id="lo" value="${esc(S.operator)}" placeholder="e.g. Asif Khan, Computer Instructor">
  <button class="btn full" id="lb">Sign in</button><div id="lm"></div>
  <p class="muted">PINs are issued by the District Education Office (Male) Muzaffarabad. The first sign-in needs internet; after that, data can be entered offline.</p></div>
  ${DASH.credit().replace(`<br><a href="#" onclick="go('about');return false">About this app</a>`, '')}`;
function bindLogin() {
  $('#lb').onclick = async () => {
    if (!navigator.onLine) { $('#lm').innerHTML = '<div class="msg w">Internet is needed for the first sign-in.</div>'; return; }
    if ($('#lo').value.trim().length < 3) { $('#lm').innerHTML = '<div class="msg w">Please write your name and designation. Every entry is recorded against it.</div>'; return; }
    S.operator = $('#lo').value.trim(); LS.set('operator', S.operator);
    $('#lb').disabled = true;
    try {
      const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'login', payload: { code: $('#lc').value.trim(), pin: $('#lp').value.trim() } }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      S.token = j.token; S.user = j.user; LS.set('token', j.token); LS.set('user', j.user);
      if (j.user.role === 'SCHOOL') { S.emis = j.user.code; LS.set('emis', S.emis); }
      await refreshBoot(); await refreshInst(); sync(); render(); setTimeout(() => SCOPE.refresh(true), 1500);
    } catch (e) { $('#lm').innerHTML = `<div class="msg w">${esc(e.message)}</div>`; $('#lb').disabled = false; }
  };
}

/* officer: choose institution */
V.picker = () => {
  const list = (S.boot && S.boot.institutions) || [];
  const p = S.boot && S.boot.pending;
  return `${errorsCard()}
  <div id="dash"></div>
  <div class="card db-picker"><h2>Open an institution</h2><input id="pf" placeholder="Search by name or EMIS code">
  <div class="list" id="pl">${pickerRows(list, '')}</div></div>
  <button class="btn alt" onclick="go('settings')">Settings / sign out</button>
  ${DASH.credit()}`;
};
function pickerRows(list, q) {
  q = q.toLowerCase();
  return list.filter(i => !q || (i.name + i.emis).toLowerCase().includes(q)).slice(0, 80).map(i =>
    `<div class="it" onclick="pick('${esc(i.emis)}')"><div class="grow"><b>${esc(i.name)}</b><div class="sub">${esc(i.level)} · ${esc(i.emis)} ${i.aeo_circle ? '· ' + esc(i.aeo_circle) : i.halqa ? '· ' + esc(i.halqa) : ''}</div></div>›</div>`).join('')
    || '<p class="muted">No match.</p>';
}
function bindPicker() { DASH.load($('#dash')); $('#pf').oninput = e => { $('#pl').innerHTML = pickerRows(S.boot.institutions, e.target.value); }; }
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
  const ret = (d && d.returned) || [];
  const tReq = ((d && d.transfersOut) || []).filter(t => t.status === 'Awaiting outgoing institution').length;
  return `${errorsCard()}
  ${ret.length ? `<div class="card"><h2>Returned for correction (${ret.length})</h2>${ret.map(x => `<div class="msg w"><b>${esc(x.what)}</b><br>${esc(x.remark || 'No reason given')}<div class="muted">${esc(x.by)} · ${esc(x.on)}</div></div>`).join('')}
  <p class="muted">Correct the entry and save it again; it then goes back for approval.</p></div>` : ''}
  ${tReq ? `<div class="card"><b>${tReq} transfer request(s) for your staff need your confirmation.</b><br><button class="btn" onclick="go('staff')">Open staff</button></div>` : ''}
  ${d ? '' : '<div class="msg w">Data for this institution has not been downloaded yet. Connect to the internet once.</div>'}
  <div id="dash"></div>
  <h2 class="db-entry">Enter and update data <span>EMIS ${esc(S.emis)}${i.halqa ? ', ' + esc(i.halqa) : ''}${i.aeo_circle ? ', ' + esc(i.aeo_circle) : ''}</span></h2>
  <div class="tiles">
    <button class="tile" onclick="go('staff')"><b>Staff</b><small>Employees, service record, transfers</small><div class="ur">عملہ</div></button>
    <button class="tile" onclick="go('posts')"><b>Posts</b><small>Sanctioned vs filled</small><div class="ur">آسامیاں</div></button>
    ${isOffice ? '' : `<button class="tile" onclick="go('enrol')"><b>Enrolment</b><small>Monthly, class-wise</small><div class="ur">داخلہ</div></button>
    <button class="tile" onclick="go('fees')"><b>Fees</b><small>${primaryFees ? 'Entered by AEO' : 'Collection and deposits'}</small><div class="ur">فیس</div></button>
    <button class="tile" onclick="go('results')"><b>Results</b><small>Term, annual, monthly tests</small><div class="ur">نتائج</div></button>
    <button class="tile" onclick="go('building')"><b>Building</b><small>${d && d.facilities ? 'Facilities profile · ' + (d.facilities.status === 'Accepted' ? 'recorded' : String(d.facilities.status).toLowerCase()) : 'Facilities profile not entered yet'}</small><div class="ur">عمارت</div></button>`}
    ${officer ? `<button class="tile" onclick="go('approvals')"><b>Approvals</b><small>${(S.boot && S.boot.pending) || 0} waiting</small><div class="ur">منظوری</div></button>` : ''}
    <button class="tile" onclick="go('settings')"><b>Settings</b><small>Head's details, PIN, sign out</small></button>
  </div>
  <div id="dash2"></div>
  ${DASH.credit()}`;
};

/* ---------- posts ---------- */
V.posts = () => {
  const d = D(); if (!d) return noData();
  const filled = {};
  if (d.ddoFilled) Object.assign(filled, d.ddoFilled);
  else d.employees.forEach(e => { if (e.post_id) filled[e.post_id] = (filled[e.post_id] || 0) + 1; });
  const other = {}, charge = {};
  d.employees.forEach(e => {
    if (outOfTitle(e)) other[e.post_id] = (other[e.post_id] || 0) + 1;
    if (e.charge_type && e.charge_post_id) charge[e.charge_post_id] = (charge[e.charge_post_id] || 0) + 1;
  });
  const rows = d.posts.slice().sort((a, b) => b.bps - a.bps).map(p => {
    const f = filled[p.post_id] || 0, v = p.sanctioned - f;
    const note = [other[p.post_id] ? `${other[p.post_id]} held by other job title` : '', charge[p.post_id] ? `${charge[p.post_id]} under charge` : ''].filter(Boolean).join(' · ');
    return `<tr><td>${esc(p.designation)}${note ? `<div class="muted">${note}</div>` : ''}</td><td>${p.bps}</td><td class="num">${p.sanctioned}</td><td class="num">${f}</td><td class="num">${v > 0 ? `<span class="badge w">${v}</span>` : v < 0 ? `<span class="badge w">+${-v}</span>` : '0'}</td></tr>`;
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
    <div class="sub">${outOfTitle(e) ? esc(e.own_designation) + ' <span class="badge w">' + (e.placement === 'Current charge basis' ? 'current charge' : e.placement === 'Officiating basis' ? 'officiating' : BASES.includes(e.placement) ? 'against' : 'basis not stated') + ': ' + esc(e.designation) + ' post</span>' : esc(e.designation)} · BPS ${esc(e.post_bps)}${e.personal_bps && e.personal_bps !== e.post_bps ? ' (personal ' + esc(e.personal_bps) + ')' : ''} · ${esc(e.service_status)}
    ${e.charge_type ? '<br><span class="badge">' + esc(e.charge_type) + ': ' + esc(e.charge_designation) + '</span>' : ''}</div></div>
    <span class="badge ${e.verified === 'Verified' ? 'o' : 'w'}">${e.verified === 'Verified' ? 'Verified' : 'Unverified'}</span></div>`).join('');
  // requests from other institutions for this institution's staff: confirm relieving or reject
  const out = (d.transfersOut || []).filter(t => t.status === 'Awaiting outgoing institution').map(t =>
    `<div class="it"><div class="grow"><b>${esc(t.name)}</b> · ${esc(t.designation)}<div class="sub">Requested by ${esc(t.to_name)} · order ${esc(t.order_no)}${t.order_date ? ' dt ' + esc(t.order_date) : ''} · joined there ${esc(t.joined_on)}</div>
     <button class="btn" onclick="tresp('${esc(t.id)}','confirm')">Confirm relieving</button><button class="btn warn" onclick="tresp('${esc(t.id)}','reject')">Reject</button></div></div>`).join('');
  // this institution's own requests
  const inc = (d.transfersIn || []).filter(t => t.status !== 'Completed').slice(-10).reverse().map(t =>
    `<div class="it"><div class="grow"><b>${esc(t.name)}</b> from ${esc(t.from_name)}<div class="sub">${esc(t.status)}${t.remark ? ' · ' + esc(t.remark) : ''}</div>
     ${t.id ? `<div class="sub">${t.outgoing_by ? '✓' : '…'} Outgoing institution · ${t.out_approved_by ? '✓' : '…'} Its officer · ${t.approved_by ? '✓' : '…'} Our officer</div>` : ''}</div>
     <span class="badge ${/Rejected/.test(t.status) ? 'w' : ''}">${/Rejected/.test(t.status) ? 'Rejected' : 'In process'}</span></div>`).join('');
  return `<div class="card"><h2>Staff (${d.employees.length})</h2>
  <button class="btn" onclick="go('emp',{mode:'new'})">+ First-time entry</button>
  <button class="btn alt" onclick="go('receive')">Receive transferred employee</button>
  ${pend.length ? `<div class="msg w">${pend.length} staff entr${pend.length > 1 ? 'ies' : 'y'} waiting to be sent.</div>` : ''}
  <div class="list">${list || '<p class="muted">No employee on the register yet. Use “First-time entry” for each employee who is not yet in the database.</p>'}</div></div>
  ${out ? `<div class="card"><h2>Transfer of your staff: please confirm</h2><p class="muted">Another institution has asked for the record of these employees. Confirm the date of relieving, or reject if the employee has not been relieved or is the wrong person.</p><div class="list">${out}</div></div>` : ''}
  ${inc ? `<div class="card"><h2>Incoming transfers</h2><p class="muted">The record comes here after the outgoing institution confirms relieving and the AEO / DDEO / DEO office of both institutions approve.</p><div class="list">${inc}</div></div>` : ''}`;
};
window.tresp = (id, decision) => {
  const d = D(), t = (d.transfersOut || []).find(x => x.id === id);
  let p = { id, decision };
  if (decision === 'confirm') { const dt = prompt('Date of relieving (yyyy-mm-dd):', today()); if (!dt) return; if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) return toast('Write the date as yyyy-mm-dd'); p.relieved_on = dt; }
  else { const r = prompt('Reason for rejecting (the requesting institution will see it):'); if (!r) return; p.remark = r; }
  queue('respondTransfer', p, (decision === 'confirm' ? 'Relieving: ' : 'Reject transfer: ') + (t ? t.name : ''));
  if (t) t.status = decision === 'confirm' ? 'Awaiting officer approval' : 'Rejected by outgoing institution'; saveD(d); render();
};

const DOMICILE = ['Muzaffarabad', 'Jhelum Valley (Hattian Bala)', 'Neelum', 'Bagh', 'Haveli', 'Poonch', 'Sudhnoti', 'Mirpur', 'Kotli', 'Bhimber', 'Refugee 1947 / 1989', 'Other'];
const QUAL = ['Below Matric', 'Matric', 'Intermediate', 'BA / BSc (14 years)', 'BS (16 years)', 'MA / MSc', 'MPhil / MS', 'PhD'];
const PROF = ['None', 'PTC / CT', 'ADE', 'BEd', 'BEd (Hons)', 'MEd', 'Other'];
const STATUS = ['Regular', 'Temporary', 'Ad hoc', 'Contract', 'Stopgap', 'Daily wages'];
const DUTY = ['On duty', 'Attached out to another institution / office', 'Attached in from another institution / office', 'On deputation',
  'On sanctioned leave', 'On study leave', 'Leave preparatory to retirement (LPR)', 'Under suspension', 'Absent without leave'];
const MODE = ['Initial recruitment (PSC)', 'Initial recruitment (testing agency)', 'Initial recruitment (departmental committee)', 'Promotion from BPS-1 (quota)', "Deceased employee's family quota", 'Other'];
const BPS = Array.from({ length: 22 }, (_, k) => String(k + 1));
const PLACEMENTS = ['Against own post', 'Posted against another post', 'Appointed against another post'];
const CHARGES = ['Additional charge', 'Current charge'];
const BASES = ['Current charge basis', 'Officiating basis', 'Against another post of the same scale'];
const BASIS_HELP = { 'Current charge basis': 'Posted by order against a vacant higher post; draws own scale. The post is shown as vacant.', 'Officiating basis': 'Holds the higher post pending the selection board; draws the scale of the post. The post counts as filled.', 'Against another post of the same scale': 'Another job title of the same BPS (e.g. Subject Specialist working as Headmaster).' };
const normT = t => String(t || '').toLowerCase().replace(/[^a-z]/g, '');
const outOfTitle = e => !!e.own_designation && !!e.designation && normT(e.own_designation) !== normT(e.designation);
/** all departmental job titles in AJK (budget books 2026-27, Male and Female); server sends the same list */
const ALL_TITLES = [
  ["Chief Computer Instructror", 20],
  ["Director General CRD", 20],
  ["Director Public Instructions", 20],
  ["Secretary", 20],
  ["Senior Additional Secretary", 20],
  ["Senior Principal", 20],
  ["Additional Secretary", 19],
  ["Director", 19],
  ["Divisional Director", 19],
  ["Head Computer Instructor", 19],
  ["Principal", 19],
  ["Deputy Director", 18],
  ["Deputy Secretary", 18],
  ["District Education Officer", 18],
  ["Principal", 18],
  ["Project Coordinator", 18],
  ["Senior Computer Instructor", 18],
  ["Senior Headmaster", 18],
  ["Senior Headmistress", 18],
  ["Senior Legal Officer", 18],
  ["Senior Sub.Specialist Quality Assurance", 18],
  ["Senior Subject Specialist", 18],
  ["System Analyst", 18],
  ["Assistant Director", 17],
  ["Computer Instructor", 17],
  ["Computer Programmer", 17],
  ["Database Administrator", 17],
  ["Deputy District Education Officer", 17],
  ["Headmaster", 17],
  ["Headmistress", 17],
  ["Lecturer", 17],
  ["Legal Officer", 17],
  ["Network Administrator", 17],
  ["Private Secretary", 17],
  ["Program Officer", 17],
  ["Section Officer", 17],
  ["Subject Specialist", 17],
  ["Subject Specialist Physical Education", 17],
  ["Superintendent", 17],
  ["System Engineer", 17],
  ["Admin. Officer", 16],
  ["Assistant", 16],
  ["Assistant Education Officer", 16],
  ["Assistant Parokar", 16],
  ["Budget Officer", 16],
  ["Computer Operator", 16],
  ["Computer Teacher", 16],
  ["DPE", 16],
  ["Hardware Technician", 16],
  ["Head Clerk", 16],
  ["Librarian", 16],
  ["Personal Assistant", 16],
  ["Registrar", 16],
  ["Senior Scale Stenographer", 16],
  ["Senior Science Teacher", 16],
  ["Senior Teacher", 16],
  ["Senior Teacher Technical", 16],
  ["Elementary Teacher", 14],
  ["Elementary Teacher (Arabic)", 14],
  ["Elementary Teacher (Drawing)", 14],
  ["Elementary Teacher (Drawing/Handicraft)", 14],
  ["Elementary Teacher (Girls Guide)", 14],
  ["Elementary Teacher (Handicraft)", 14],
  ["Elementary Teacher (PET)", 14],
  ["Elementary Teacher (Qari)", 14],
  ["Elementary Teacher (Qaria)", 14],
  ["Elementary Teacher (Science)", 14],
  ["Elementary Teacher (Technical)", 14],
  ["Junior Computer Teacher", 14],
  ["Section Clerk", 14],
  ["Senior Clerk", 14],
  ["Stenographer", 14],
  ["Data Entry Operator", 12],
  ["Girls Guide Trainer", 12],
  ["Junior Clerk", 11],
  ["Computer Assistant", 7],
  ["Laboratory Assistant", 7],
  ["Shop Assistant", 6],
  ["Driver", 5],
  ["Library Assistant", 5],
  ["Machine Operator", 5],
  ["Band Master", 4],
  ["Driver", 4],
  ["Qasid", 2],
  ["Chowkidar", 1],
  ["Cleaner", 1],
  ["Cook", 1],
  ["Cook/Waiter", 1],
  ["Kalra", 1],
  ["Laboratory Attendant", 1],
  ["Laboratory Attendant (Contract)", 1],
  ["Mali", 1],
  ["Mualim-ul-Quran", 1],
  ["Naib Qasid", 1],
  ["Naib Qasid/Kalra", 1],
  ["Shop Attendant", 1],
  ["Sweeper", 1],
  ["Water Carrier", 1],
  ["Water Carrier/Sweeper", 1]
];
/** own-title options as "Title|BPS"; only titles from the list can be chosen */
function titleOpts(sel, selBps) {
  const list = (S.boot && S.boot.meta && S.boot.meta.designations && S.boot.meta.designations.length > 60) ? S.boot.meta.designations : ALL_TITLES;
  const v = sel ? sel + '|' + (selBps || '') : '';
  // grouped by BPS so the long list is easy to scan on a phone
  const groups = {};
  list.forEach(([t, b]) => (groups[b] = groups[b] || []).push([t + '|' + b, `${t} (BPS-${b})`]));
  return '<option value="">— choose —</option>' + Object.keys(groups).sort((a, b) => b - a)
    .map(b => `<optgroup label="BPS-${b}">${opts(groups[b], v)}</optgroup>`).join('');
}
function placementBlock(e, posts) {
  return `<h3>Own job title and post occupied</h3>
  <label>Own job title (substantive designation of the employee) *</label><select name="own_title">${titleOpts(e.own_designation, e.own_bps)}</select>
  <div id="plw" ${outOfTitle(e) ? '' : 'hidden'}><div class="msg w">The post occupied has a different job title. On what basis does the employee hold it?</div>
  <label>Basis of holding the post *</label><select name="placement">${opts(BASES, BASES.includes(e.placement) ? e.placement : '', e.placement && !BASES.includes(e.placement) ? '— basis not stated yet: choose —' : '— choose —')}</select>
  <p class="muted" id="bhelp">${esc(BASIS_HELP[e.placement] || '')}</p>
  <label>Order No. and date of this posting / promotion</label><input name="placement_order" value="${esc(e.placement_order)}"></div>
  <h3>Additional charge of another post (if any)</h3>
  <p class="muted">Duties of another post (vacant, or its holder on long leave) given in addition to the employee's own post — e.g. a Headmaster holding additional charge of a vacant Principal post.</p>
  <label>Holds additional charge of another post?</label><select name="charge_type">${opts(CHARGES, e.charge_type, 'No')}</select>
  <div id="chw" ${e.charge_type ? '' : 'hidden'}>
  <label>Post held under charge</label><select name="charge_post_id">${opts(posts, e.charge_post_id, '— choose —')}</select>
  <div class="row"><div><label>Charge order No. and date</label><input name="charge_order" value="${esc(e.charge_order)}"></div>
  <div><label>Charge held since</label><input type="date" name="charge_from" value="${esc(e.charge_from)}"></div></div></div>`;
}
/** show/hide placement and charge fields as the form changes */
function bindPlacement(root) {
  const q = n => root.querySelector(`[name="${n}"]`), d = D();
  const upd = () => {
    const post = d.posts.find(x => x.post_id === (q('post_id') || {}).value);
    const own = (q('own_title').value || '').split('|')[0];
    root.querySelector('#plw').hidden = !(post && own && normT(own) !== normT(post.designation));
    root.querySelector('#chw').hidden = !q('charge_type').value;
  };
  // a new entry: default own title to the post chosen
  if (q('post_id')) q('post_id').addEventListener('change', () => {
    const post = d.posts.find(x => x.post_id === q('post_id').value);
    if (post && !q('own_title').value) { const v = post.designation + '|' + post.bps; if ([...q('own_title').options].some(o => o.value === v)) q('own_title').value = v; }
    upd();
  });
  ['own_title', 'charge_type'].forEach(n => q(n).addEventListener('change', upd));
  q('placement').addEventListener('change', () => { root.querySelector('#bhelp').textContent = BASIS_HELP[q('placement').value] || ''; });
  upd();
}
function readPlacement(f, post) {
  const [own, ownBps] = (f.own_title || '').split('|'); delete f.own_title;
  f.own_designation = own; f.own_bps = ownBps;
  if (normT(f.own_designation) === normT(post.designation)) { f.placement = PLACEMENTS[0]; f.placement_order = ''; }
  if (!f.charge_type) { f.charge_post_id = ''; f.charge_order = ''; f.charge_from = ''; }
  return f;
}

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
  <label>Father's / husband's name *</label><input name="father_name" value="${esc(e.father_name)}">
  <label>Gender *</label><select name="gender">${opts(['Male', 'Female'], e.gender || 'Male')}</select>
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
  <label>Post occupied (sanctioned post in the institution's budget) *</label><select name="post_id">${opts(posts, e.post_id, '— choose —')}</select>
  <div class="row"><div><label>Personal BPS, if different (upgradation / move-over)</label><select name="personal_bps">${opts(BPS, e.personal_bps, 'Same as post')}</select></div>
  <div><label>Current basic pay (Rs) *</label><input name="basic_pay" value="${esc(e.basic_pay)}" inputmode="numeric"></div></div>
  <div class="row"><div><label>Employment status</label><select name="service_status">${opts(STATUS, e.service_status)}</select></div>
  <div><label>Joined this institution on *</label><input type="date" name="joined_on" value="${esc(e.joined_on)}"></div></div>
  <label>Present duty status</label><select name="duty_status">${opts(DUTY, e.duty_status)}</select>
  <label>Actually working at (only if attached elsewhere)</label><input name="working_at" value="${esc(e.working_at)}">
  ${placementBlock(e, posts)}
  <div id="histbox">${isNew ? histEditor([], []) : `<p class="muted">${navigator.onLine ? 'Loading service history…' : 'Service history can be viewed and edited when online.'}</p>`}</div>
  ${arg.review ? `<div class="decide"><button class="btn" id="es">Save changes</button><button class="btn" style="background:var(--ok)" onclick="decide('approve')">Approve record</button><button class="btn warn" onclick="decide('return')">Return with remarks</button></div>`
    : `<button class="btn full" id="es">${isNew ? 'Save employee' : 'Save changes'}</button>
  ${isNew ? '' : `<button class="btn warn" onclick="go('depart',{cnic:'${esc(e.cnic)}',name:'${esc(e.name)}'})">Record retirement / death / leaving district</button>`}`}
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
  bindPlacement($('#ef'));
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
    const mob = v => !v || /^03\d{2}-?\d{7}$/.test(v.replace(/\s/g, ''));
    if (!mob(f.mobile) || !mob(f.whatsapp)) return toast('Mobile number must be like 03XX-XXXXXXX');
    const yrs = (a, b) => (new Date(b) - new Date(a)) / 31557600000;
    if (yrs(f.dob, today()) < 17 || yrs(f.dob, today()) > 66) return toast('Please check the date of birth');
    if (yrs(f.dob, f.first_appt_date) < 16) return toast('First appointment date is too close to the date of birth');
    if (f.joined_on < f.first_appt_date) return toast('Joining this institution cannot be before the first appointment');
    if (f.joined_on > today() || f.first_appt_date > today()) return toast('Dates cannot be in the future');
    if (!/^\d+$/.test(f.basic_pay) || Number(f.basic_pay) < 10000) return toast('Basic pay should be the monthly amount in rupees');
    const p = d.posts.find(x => x.post_id === f.post_id);
    Object.assign(f, { emis: S.emis, designation: p.designation, post_bps: String(p.bps) });
    if (!f.own_title) return toast('Choose the employee\'s own job title from the list');
    readPlacement(f, p);
    if (outOfTitle(f) && !BASES.includes(f.placement)) return toast('Say on what basis the employee holds this post (current charge, officiating, or same scale)');
    if (f.charge_type && !f.charge_post_id) return toast('Choose the post held under charge');
    if (f.charge_type && f.charge_post_id === f.post_id) return toast('Charge post cannot be the post occupied');
    if (f.charge_post_id) f.charge_designation = (d.posts.find(x => x.post_id === f.charge_post_id) || {}).designation || '';
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
    saveD(d); if (arg.review) toast('Saved'); else back();
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
      $('#rr').innerHTML = `<div class="hist"><b>${esc(e.name)}</b> s/o ${esc(e.father_name)}<div class="sub">${esc(e.own_designation || e.designation)} (own title) · BPS ${esc(e.own_bps || e.post_bps)} · now at ${esc(f.station_name)}</div>
        <div class="sub">Born ${esc(e.dob)} · first appointed ${esc(e.first_appt_date)} as ${esc(e.first_designation)}</div>
        <div class="sub">Promotions: ${f.promotions.map(p => esc(p.to_designation) + ' (' + esc(p.date) + ')').join('; ') || 'none'}</div>
        <div class="sub">Postings: ${f.postings.map(p => esc(p.station_name) + ' ' + esc(p.from_date) + '–' + esc(p.to_date || 'now')).join('; ')}</div></div>
        ${e.emis === S.emis ? '<div class="msg o">Already at this institution.</div>' : `<div id="cf">
        <label>Post occupied at this institution *</label><select name="post_id">${opts(posts, '', '— choose —')}</select>
        <div id="cpl" hidden><div class="msg w">This post has a different job title from the employee's own (${esc(e.own_designation || e.designation)}).</div>
        <label>How placed against this post</label><select name="placement">${opts(PLACEMENTS.slice(1))}</select></div>
        <div class="row"><div><label>Transfer order No. *</label><input name="order_no"></div><div><label>Order date</label><input type="date" name="order_date"></div></div>
        <label>Joined here on *</label><input type="date" name="joined_on" value="${today()}">
        <button class="btn full" id="cs">Send transfer request</button>
        <p class="muted">The outgoing institution must confirm relieving, and the AEO / DDEO / DEO office of both institutions must approve; the record then moves here.</p></div>`}`;
      if ($('#cf')) $('#cf').querySelector('[name="post_id"]').onchange = ev => {
        const p = d.posts.find(x => x.post_id === ev.target.value);
        $('#cpl').hidden = !(p && normT(p.designation) !== normT(e.own_designation || e.designation));
      };
      if ($('#cs')) $('#cs').onclick = () => {
        const c = formData($('#cf'));
        if (!c.post_id || !c.order_no || !c.joined_on) return toast('Post, order No. and joining date are required');
        const p = d.posts.find(x => x.post_id === c.post_id);
        queue('claimEmployee', Object.assign(c, { cnic: e.cnic, to_emis: S.emis, designation: p.designation }), 'Transfer request: ' + e.name);
        d.transfersIn = (d.transfersIn || []).concat([{ name: e.name, from_name: f.station_name, status: 'Request sent to outgoing institution and officer' }]);
        toast('Request sent. The record moves here after the outgoing institution and both officers approve.');
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
V.approvals = () => `<div class="card"><h2>Waiting for approval</h2><div class="list" id="al"><p class="muted">${navigator.onLine ? 'Loading…' : 'Approvals need internet.'}</p></div></div>`;
BIND.approvals = async () => {
  if (!navigator.onLine) return;
  const j = await api('listPending', {});
  const items = j.items || [];
  S.boot.pending = items.length; LS.set('boot', S.boot);
  S.pendingItems = items;
  const KIND = { Enrolment: 'Enrolment', FeeCollection: 'Fees', FeeDeposits: 'Deposit', Results: 'Results', Employees: 'Staff record', Transfers: 'Transfer', Facilities: 'Building' };
  $('#al').innerHTML = items.length ? `<p class="muted">Tap an item to see the full record and decide.</p>` + items.map((x, k) =>
    `<div class="it tap" onclick="openReview(${k})"><div class="grow"><b>${esc(x.inst)}</b> <span class="pill">${KIND[x.sheet] || x.sheet}</span><div class="sub">${esc(x.what)}</div><div class="sub">${esc(x.submitted_on)} · ${esc(x.submitted_by)}</div></div><span class="chev">›</span></div>`).join('')
    : '<p class="muted">Nothing is waiting.</p>';
};
window.openReview = k => { const x = S.pendingItems[k]; go('review', x); };

/* ---------- about ---------- */
V.about = () => `<div class="card about">
  <h2>District School Data System</h2>
  <p>District Education Office (Male) Muzaffarabad, Elementary &amp; Secondary Education Department, Azad Jammu &amp; Kashmir.</p>
  <h3>Purpose</h3>
  <p>One place where schools, Assistant Education Officers, the Deputy District Education Officer and the District Education Office keep staff, posts, enrolment, fees and examination results up to date. Each fact is entered once, by the institution closest to it; vacancy positions, staff statements and performance reports are produced from it, so the same data is not asked for again.</p>
  <h3>Developer</h3>
  <p>Conceived and developed by <b>Dr. Muhammad Naeem Khwaja</b>, District Education Officer (Male), Muzaffarabad, as a personal initiative for the district. Trial launched in November 2026.</p>
  <h3>Ownership of data</h3>
  <p>The system and all data entered in it belong to the District Education Office (Male) Muzaffarabad. Data is visible only to the institution that entered it and the officers who supervise it.</p>
  <h3>Help</h3>
  <p>For PINs, corrections or problems, contact the District Education Office (Male), L Block, District Complex Muzaffarabad, phone 05822-960010.</p>
  <p class="muted">Version: November 2026</p></div>`;

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
  <label>Person entering data on this phone</label><input id="op" value="${esc(S.operator)}"><button class="btn alt" onclick="if($('#op').value.trim().length>2){S.operator=$('#op').value.trim();LS.set('operator',S.operator);toast('Saved')}">Save name</button>
  <button class="btn alt" onclick="sync();refreshInst();refreshBoot();toast('Refreshing')">Refresh now</button>
  <button class="btn warn" onclick="signOut()">Sign out</button>
  <button class="btn alt" onclick="go('about')">About this app</button></div>`;
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



/* =====================================================================
   NAVIGATION SHELL — side menu, one-tap home, offline scope
   ===================================================================== */
const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  office: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/></svg>',
  inst: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10l9-5 9 5-9 5z"/><path d="M7 12v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5M21 10v6"/></svg>',
  staff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4.5-6.2"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/></svg>',
  report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>',
  posts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M8 15h4"/></svg>',
  enrol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14M8 9h8M8 13h8M8 17h5"/></svg>',
  fees: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M9 9.5h5.5a1.75 1.75 0 0 1 0 3.5H9.5M9 13h5.5a1.75 1.75 0 0 1 0 3.5H9M12 7v2.5M12 16.5V19"/></svg>',
  results: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 18l5-6 4 3 7-9"/><path d="M20 6v4h-4"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5M9 11h2M13 11h2"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/></svg>'
};

const NAV = (() => {
  const isOfficer = () => role() && role() !== 'SCHOOL';
  const items = () => {
    const i = inst(), isOffice = i.level === 'Office', primary = i.level === 'Primary' && role() === 'SCHOOL';
    const p = (S.boot && S.boot.pending) || 0;
    if (isOfficer()) return [
      { id: 'dash', label: 'Dashboard', icon: 'home', on: S.view === 'home' && !S.emis, go: () => { S.emis = null; LS.del('emis'); S.stack = []; S.view = 'home'; render(); } },
      { id: 'office', label: 'My office', icon: 'office', on: S.view === 'home' && S.emis === S.user.scope, go: () => pick(S.user.scope) },
      { id: 'institutions', label: 'Institutions', icon: 'inst', on: S.view === 'institutions', go: () => jump('institutions') },
      { id: 'search', label: 'Staff search', icon: 'search', on: S.view === 'search', go: () => jump('search') },
      { id: 'approvals', label: 'Approvals', icon: 'check', count: p, on: S.view === 'approvals' || S.view === 'review', go: () => jump('approvals') },
      { id: 'reports', label: 'Reports', icon: 'report', on: S.view === 'reports', go: () => jump('reports') },
      { sec: S.emis && S.emis !== S.user.scope ? (i.name || S.emis) : '' },
      ...(S.emis && S.emis !== S.user.scope ? [
        { id: 'ihome', label: 'Overview', icon: 'home', on: S.view === 'home' && !!S.emis, go: () => jump('home') },
        { id: 'istaff', label: 'Staff', icon: 'staff', on: S.view === 'staff', go: () => jump('staff') },
        { id: 'iposts', label: 'Posts', icon: 'posts', on: S.view === 'posts', go: () => jump('posts') },
        ...(isOffice ? [] : [
          { id: 'ienrol', label: 'Enrolment', icon: 'enrol', on: S.view === 'enrol', go: () => jump('enrol') },
          { id: 'ifees', label: 'Fees', icon: 'fees', on: S.view === 'fees', go: () => jump('fees') },
          { id: 'iresults', label: 'Results', icon: 'results', on: S.view === 'results', go: () => jump('results') },
          { id: 'ibuilding', label: 'Building', icon: 'building', on: S.view === 'building', go: () => jump('building') }])
      ] : []),
      { sec: '' },
      { id: 'settings', label: 'Settings', icon: 'settings', on: S.view === 'settings', go: () => jump('settings') },
      { id: 'about', label: 'About', icon: 'info', on: S.view === 'about', go: () => jump('about') }
    ];
    return [
      { id: 'home', label: 'My school', icon: 'home', on: S.view === 'home', go: () => jump('home') },
      { id: 'staff', label: 'Staff', icon: 'staff', on: S.view === 'staff' || S.view === 'emp' || S.view === 'receive', go: () => jump('staff') },
      { id: 'posts', label: 'Posts', icon: 'posts', on: S.view === 'posts', go: () => jump('posts') },
      { id: 'enrol', label: 'Enrolment', icon: 'enrol', on: S.view === 'enrol', go: () => jump('enrol') },
      { id: 'fees', label: primary ? 'Fees (by AEO)' : 'Fees', icon: 'fees', on: S.view === 'fees' || S.view === 'deposit', go: () => jump('fees') },
      { id: 'results', label: 'Results', icon: 'results', on: S.view === 'results', go: () => jump('results') },
      { id: 'building', label: 'Building', icon: 'building', on: S.view === 'building', go: () => jump('building') },
      { id: 'reports', label: 'Reports', icon: 'report', on: S.view === 'reports', go: () => jump('reports') },
      { sec: '' },
      { id: 'settings', label: 'Settings', icon: 'settings', on: S.view === 'settings', go: () => jump('settings') },
      { id: 'about', label: 'About', icon: 'info', on: S.view === 'about', go: () => jump('about') }
    ];
  };
  let list = [];
  function render() {
    list = items();
    $('#nav').innerHTML = list.map((it, k) => it.sec !== undefined ? (it.sec ? `<li class="sec">${esc(it.sec)}</li>` : '<li class="sec"></li>')
      : `<li><a class="${it.on ? 'on' : ''}" onclick="NAV.pick(${k})">${ICON[it.icon] || ''}<span>${esc(it.label)}</span>${it.count ? `<span class="ct">${it.count}</span>` : ''}</a></li>`).join('');
    $('#sidefoot').innerHTML = `${esc(S.user.name)}<br>${esc(S.user.code)}${S.operator ? ' · ' + esc(S.operator) : ''}`;
  }
  return {
    render, pick: k => { const it = list[k]; close(); if (it && it.go) it.go(); },
    open() { $('#side').classList.add('open'); $('#scrim').hidden = false; },
    close, toggle() { $('#side').classList.contains('open') ? close() : NAV.open(); }
  };
  function close() { $('#side').classList.remove('open'); $('#scrim').hidden = true; }
})();
/** go to a top-level screen: resets the back stack so Back returns to home */
function jump(view, arg) { S.stack = []; S.view = view; S.arg = arg; try { history.pushState({ v: view }, ''); } catch (e) { } render(); window.scrollTo(0, 0); }
$('#menu').onclick = () => NAV.toggle();
$('#scrim').onclick = () => NAV.close();
$('#title').onclick = () => { if (!S.token) return; if (role() === 'SCHOOL') jump('home'); else { S.emis = null; LS.del('emis'); jump('home'); } };

/* ---------- offline scope store (IndexedDB; falls back to memory) ---------- */
const SCOPE = (() => {
  let db = null, mem = null;
  const open = () => new Promise(res => {
    if (db) return res(db);
    try {
      const r = indexedDB.open('sds', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { db = r.result; res(db); };
      r.onerror = () => res(null);
    } catch (e) { res(null); }
  });
  const key = () => 'scope_' + (S.user ? S.user.code : '');
  async function get() {
    if (mem) return mem;
    const d = await open(); if (!d) return null;
    return new Promise(res => { try { const t = d.transaction('kv').objectStore('kv').get(key()); t.onsuccess = () => { mem = t.result || null; res(mem); }; t.onerror = () => res(null); } catch (e) { res(null); } });
  }
  async function set(v) {
    mem = v; const d = await open(); if (!d) return;
    try { d.transaction('kv', 'readwrite').objectStore('kv').put(v, key()); } catch (e) { }
  }
  async function refresh(force) {
    if (!S.token || role() === 'SCHOOL' || !navigator.onLine) return;
    const cur = await get();
    if (!force && cur && Date.now() - (cur.at || 0) < 6 * 3600e3) return;
    try { const j = await api('downloadScope', {}); if (j.ok) { j.at = Date.now(); await set(j); toast('Offline copy updated'); } } catch (e) { }
  }
  /** build a getInstitution-like record from the offline copy */
  async function institution(emis) {
    const sc = await get(); if (!sc) return null;
    const i = sc.institutions.find(x => x.emis === emis); if (!i) return null;
    return { inst: i, posts: sc.posts.filter(p => p.ddo === i.ddo), employees: sc.employees.filter(e => e.emis === emis),
      ddoFilled: null, enrolment: [], fees: [], deposits: [], results: [], transfersOut: [], transfersIn: [], departures: [], returned: [], offline: true, generated: sc.generated };
  }
  return { get, set, refresh, institution, clear: () => { mem = null; } };
})();
// officers: keep the offline copy fresh; when offline and an institution is not cached, use it
(function () {
  const origRefresh = refreshInst;
  window.refreshInst = async function (silent) {
    if (S.emis && !navigator.onLine && !D() && role() !== 'SCHOOL') { const d = await SCOPE.institution(S.emis); if (d) { saveD(d); render(); } return; }
    return origRefresh(silent);
  };
})();
if (S.token) setTimeout(() => SCOPE.refresh(false), 4000);

/* ---------- institutions (officers) ---------- */
V.institutions = () => `<div class="card"><h2>Institutions</h2>
  <input id="if" placeholder="Search by name or EMIS code"><div class="seg" id="iseg"></div><div id="il"></div></div>`;
BIND.institutions = async () => {
  const all = (S.boot && S.boot.institutions || []).filter(i => i.level !== 'Office');
  const sc = await SCOPE.get(); const fig = (sc && sc.figures) || {};
  const groups = [['Higher Secondary', i => i.level === 'Higher Secondary'], ['High', i => i.level === 'High'], ['Middle', i => i.level === 'Middle']];
  const circles = [...new Set(all.filter(i => i.level === 'Primary').map(i => i.aeo_circle))].sort();
  circles.forEach(c => groups.push([c ? 'Primary · ' + c : 'Primary', i => i.level === 'Primary' && i.aeo_circle === c]));
  const others = all.filter(i => !['Higher Secondary', 'High', 'Middle', 'Primary'].includes(i.level));
  if (others.length) groups.push(['Other', i => others.includes(i)]);
  let sel = LS.get('inst_group', '');
  const open = {};
  const draw = () => {
    const q = $('#if').value.trim().toLowerCase();
    const vis = groups.filter(([n, f]) => all.some(f));
    $('#iseg').innerHTML = `<button class="${sel === '' ? 'on' : ''}" data-g="">All</button>` + vis.map(([n]) => `<button class="${sel === n ? 'on' : ''}" data-g="${esc(n)}">${esc(n.replace('Primary · ', ''))}</button>`).join('');
    $('#iseg').querySelectorAll('button').forEach(b => b.onclick = () => { sel = b.dataset.g; LS.set('inst_group', sel); draw(); });
    const row = i => { const f = fig[i.emis] || {}; return `<div class="it tap" onclick="pick('${esc(i.emis)}')"><div class="grow"><b>${esc(i.name)}</b><div class="sub">${esc(i.emis)}${i.halqa ? ' · ' + esc(i.halqa) : ''}${f.enrol ? ` · ${f.enrol} students (${monthLabel(f.enrolMonth)})` : f.enrolMonth === '' && sc ? ' · <span class="db-no">no enrolment entered</span>' : ''}</div></div><span class="chev">›</span></div>`; };
    $('#il').innerHTML = vis.filter(([n]) => !sel || n === sel).map(([n, f]) => {
      const list = all.filter(i => f(i) && (!q || (i.name + i.emis).toLowerCase().includes(q)));
      if (!list.length) return '';
      const collapsed = !q && !sel && vis.length > 1 && list.length > 12 && !open[n];
      return `<div class="grp tap${collapsed ? '' : ' open'}" onclick="const l=this.nextElementSibling;l.hidden=!l.hidden;this.classList.toggle('open',!l.hidden)"><h3>${esc(n)}</h3><span>${list.length} <i class="chev">›</i></span></div><div class="list" ${collapsed ? 'hidden' : ''}>${list.map(row).join('')}</div>`;
    }).join('') || '<p class="muted">No match.</p>';
  };
  $('#if').oninput = draw; draw();
};

/* ---------- staff search ---------- */
V.search = () => `<div class="card"><h2>Staff search</h2>
  <input id="sq" placeholder="${role() === 'SCHOOL' ? 'Name, CNIC or personnel number' : 'Name, CNIC, personnel number or school'}" autofocus>
  <p class="muted" id="sn">${role() === 'SCHOOL' ? 'Searches the staff of this institution.' : 'Searches all institutions you supervise. Type at least 3 letters.'}</p>
  <div class="list" id="sr"></div></div>`;
BIND.search = () => {
  let t;
  const run = async () => {
    const q = $('#sq').value.trim();
    if (q.length < 3) { $('#sr').innerHTML = ''; return; }
    $('#sn').textContent = 'Searching…';
    let found = [], offline = false;
    if (navigator.onLine) {
      try { const j = await api('searchStaff', role() === 'SCHOOL' ? { q, emis: S.emis } : { q }); if (j.ok) found = j.found; } catch (e) { offline = true; }
    } else offline = true;
    if (offline) {   // offline copy
      const ql = q.toLowerCase(), dg = q.replace(/\D/g, '');
      const sc = await SCOPE.get(); const pool = sc ? sc.employees : ((D() || {}).employees || []);
      const im = {}; (sc ? sc.institutions : [inst()]).forEach(i => { im[i.emis] = i; });
      found = pool.filter(e => e.name.toLowerCase().includes(ql) || (dg.length >= 5 && e.cnic.replace(/\D/g, '').includes(dg)) || (e.personnel_no || '').toLowerCase() === ql || ((im[e.emis] || {}).name || '').toLowerCase().includes(ql))
        .slice(0, 60).map(e => Object.assign({ station: (im[e.emis] || {}).name || e.emis, halqa: (im[e.emis] || {}).halqa || '' }, e));
    }
    $('#sn').textContent = found.length ? `${found.length} found${offline ? ' (offline copy)' : ''}` : 'No match.';
    $('#sr').innerHTML = found.map((e, k) => `<div class="it tap" onclick="openStaff(${k})"><div class="grow"><b>${esc(e.name)}</b> <span class="muted">s/o ${esc(e.father_name || '')}</span>
      <div class="sub">${esc(e.own_designation || e.designation)}${e.own_designation && e.own_designation !== e.designation ? ' · against ' + esc(e.designation) + ' post' : ''} · BPS ${esc(e.post_bps)}</div>
      <div class="sub">${esc(e.station)}${e.halqa ? ' · ' + esc(e.halqa) : ''} · ${esc(e.cnic)}${e.personnel_no ? ' · P.No ' + esc(e.personnel_no) : ''}</div></div>
      <span class="badge ${e.verified === 'Verified' ? 'o' : 'w'}">${e.verified === 'Verified' ? 'Verified' : 'Unverified'}</span><span class="chev">›</span></div>`).join('');
    S.searchFound = found;
  };
  $('#sq').oninput = () => { clearTimeout(t); t = setTimeout(run, 350); };
  $('#sq').focus();
};
/** switch to another institution and make sure its record is loaded (server, or offline copy) */
async function ensureInst(emis) {
  if (emis === S.emis && D()) return true;
  S.emis = emis; LS.set('emis', emis);
  if (D()) { refreshInst(true); return true; }
  toast('Opening…');
  if (navigator.onLine) { try { const j = await api('getInstitution', { emis }); if (j.ok) { saveD(j); return true; } } catch (e) { } }
  const d = await SCOPE.institution(emis); if (d) { saveD(d); return true; }
  toast('This institution is not available offline yet'); return false;
}
window.openStaff = async k => { const e = S.searchFound[k]; if (await ensureInst(e.emis)) go('emp', { cnic: e.cnic }); };

/* ---------- reports ---------- */
const HALQAS = ['Halqa 1', 'Halqa 2', 'Halqa 3', 'Halqa 4', 'Halqa 5'], LEVELS = ['Higher Secondary', 'High', 'Middle', 'Primary'];
V.reports = () => `<div class="card noprint"><h2>Reports</h2><div class="seg" id="rp"></div>
  ${role() !== 'SCHOOL' ? `<div class="row"><div><label>Halqa</label><select id="rh">${opts(HALQAS, LS.get('r_halqa', ''), 'All')}</select></div><div><label>Level</label><select id="rl">${opts(LEVELS, LS.get('r_level', ''), 'All')}</select></div></div>` : ''}
  <p class="muted" id="rnote"></p></div>
  <div class="card"><div class="db-sh rhead"><h3 id="rtitle"></h3><span class="noprint rbtn"><button class="btn alt" onclick="REP.csv()">Download CSV</button><button class="btn alt" onclick="window.print()">Print</button></span></div>
  <div class="rwrap"><table class="rtable" id="rt"></table></div><p class="muted" id="rcount"></p></div>`;
const REP = { cur: null,
  csv() { if (!REP.cur) return; const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const txt = [REP.cur.head].concat(REP.cur.rows).map(r => r.map(q).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv' })); a.download = (REP.cur.title + ' ' + today()).replace(/[^\w\- ]+/g, '') + '.csv'; a.click(); } };
BIND.reports = async () => {
  let list = LS.get('reports_list', null);
  if (navigator.onLine) { try { const j = await api('reportList', {}); if (j.ok) { list = j.reports; LS.set('reports_list', list); } } catch (e) { } }
  if (!list) { $('#rnote').textContent = 'Reports need one connection to the internet first.'; return; }
  let cur = LS.get('r_id', list[0].id);
  const draw = async () => {
    $('#rp').innerHTML = list.map(r => `<button class="${r.id === cur ? 'on' : ''}" data-id="${r.id}">${esc(r.title)}</button>`).join('');
    $('#rp').querySelectorAll('button').forEach(b => b.onclick = () => { cur = b.dataset.id; LS.set('r_id', cur); draw(); });
    const f = { id: cur, halqa: $('#rh') ? $('#rh').value : '', level: $('#rl') ? $('#rl').value : '' };
    LS.set('r_halqa', f.halqa); LS.set('r_level', f.level);
    const ck = 'rep_' + S.user.code + '_' + cur + '_' + f.halqa + '_' + f.level;
    let r = LS.get(ck, null);
    if (navigator.onLine) { $('#rnote').textContent = 'Loading…'; try { const j = await api('report', f); if (j.ok) { r = j; r.at = now_(); try { LS.set(ck, r); } catch (e) { } } } catch (e) { } }
    if (!r) { $('#rnote').textContent = 'Not available offline yet.'; $('#rt').innerHTML = ''; return; }
    REP.cur = r;
    $('#rnote').textContent = r.note + (navigator.onLine ? '' : ` · offline copy from ${r.at}`);
    $('#rtitle').textContent = r.title;
    const num = v => typeof v === 'number';
    $('#rt').innerHTML = `<thead><tr>${r.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${r.rows.slice(0, 1500).map(row => `<tr>${row.map(v => `<td class="${num(v) ? 'num' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    $('#rcount').textContent = `${r.count} rows${r.rows.length > 1500 ? ' (first 1,500 shown; download CSV for all)' : ''}${r.truncated ? ' · narrow the filters for the complete list' : ''}`;
  };
  if ($('#rh')) { $('#rh').onchange = draw; $('#rl').onchange = draw; }
  draw();
};
function now_() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }

/* ---------- review one approval item ---------- */
V.review = x => `<div class="card"><h2>${esc(x.inst)}</h2><p class="muted">${esc(x.what)}<br>Submitted ${esc(x.submitted_on)} by ${esc(x.submitted_by)}</p><div id="rv"><p class="muted">${navigator.onLine ? 'Loading the record…' : 'Reviewing needs internet.'}</p></div></div>`;
BIND.review = async x => {
  if (!navigator.onLine) return;
  if (x.sheet === 'Employees') {        // open the full employee form with decision buttons
    if (!(await ensureInst(x.emis))) return;
    S.view = 'emp'; S.arg = { cnic: x.key, review: x }; render(); return;
  }
  let j; try { j = await api('getReviewItem', { sheet: x.sheet, key: x.key }); } catch (e) { }
  if (!j || !j.ok) { $('#rv').innerHTML = `<div class="msg w">${esc(j ? j.error : 'Could not load')}</div>`; return; }
  const it = j.item; let html = '';
  const tbl = (head, rows) => `<div class="scroll"><table>${head.map(h => `<th>${esc(h)}</th>`).join('')}${rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</table></div>`;
  if (x.sheet === 'Enrolment') {
    const prev = {}; (it.previous || []).forEach(r => { prev[r.class] = Number(r.boys || 0) + Number(r.girls || 0); });
    const rows = it.rows.sort((a, b) => CLASSES.indexOf(a.class) - CLASSES.indexOf(b.class));
    let tb = 0, tg = 0, tp = 0;
    html = tbl(['Class', 'Boys', 'Girls', 'Total', 'New adm.', it.previousMonth ? monthLabel(it.previousMonth) : 'Previous'], rows.map(r => { const t = Number(r.boys || 0) + Number(r.girls || 0); tb += Number(r.boys || 0); tg += Number(r.girls || 0); tp += prev[r.class] || 0; return [r.class, r.boys, r.girls, t, r.new_admissions, prev[r.class] == null ? '–' : prev[r.class]]; })
      .concat([['Total', tb, tg, tb + tg, '', tp || '–']]));
    html = `<h3>Enrolment, ${monthLabel(rows[0].month)}</h3>` + html;
  } else if (x.sheet === 'FeeCollection') {
    html = `<h3>Collection, ${monthLabel(it.rows[0].month)}</h3>` + tbl(['Fee head', 'Expected', 'Collected', 'Short'], it.rows.map(r => [r.fee_head.replace('_', ' '), r.expected, r.collected, Number(r.expected || 0) - Number(r.collected || 0)]))
      + (it.rows[0].remark ? `<p class="muted">Reason given: ${esc(it.rows[0].remark)}</p>` : '')
      + `<h3>Deposits that month</h3>` + (it.deposits.length ? tbl(['Account', 'Challan', 'Date', 'Amount'], it.deposits.map(d => [d.account, d.challan_no, d.challan_date, d.amount])) : '<p class="muted">None recorded.</p>');
  } else if (x.sheet === 'FeeDeposits') {
    const d = it.rows[0];
    html = `<div class="kv2"><b>Account</b><span>${esc(d.account)}</span><b>Challan No.</b><span>${esc(d.challan_no)}</span><b>Date</b><span>${esc(d.challan_date)}</span><b>Amount</b><span>Rs ${esc(d.amount)}</span><b>Bank</b><span>${esc(d.bank_branch)}</span><b>For month</b><span>${monthLabel(d.month)}</span><b>Remarks</b><span>${esc(d.remark)}</span></div>`;
  } else if (x.sheet === 'Results') {
    const r0 = it.rows[0]; const en = it.enrolment && it.enrolment[0];
    html = `<h3>${esc(r0.exam)}, Class ${esc(r0.class)}${r0.group ? ' ' + esc(r0.group) : ''}</h3>${en ? `<p class="muted">Enrolment in this class (${monthLabel(en.month)}): ${Number(en.boys || 0) + Number(en.girls || 0)}</p>` : ''}`
      + tbl(['Subject', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'Appeared', 'Passed', 'Pass %'], it.rows.map(r => [r.subject, r.aplus, r.a, r.b, r.c, r.d, r.e, r.f, r.appeared, r.passed, r.appeared ? Math.round(r.passed * 1000 / r.appeared) / 10 + '%' : '']));
  } else if (x.sheet === 'Transfers') {
    const t = it.transfer, e = it.employee;
    html = `<div class="kv2"><b>Employee</b><span>${esc(t.name)}, ${esc(t.designation)}</span><b>From</b><span>${esc(t.from_name)}</span><b>To</b><span>${esc(t.to_name)} · against ${esc(t.new_designation)} post${t.placement ? ' (' + esc(t.placement) + ')' : ''}</span>
      <b>Order</b><span>${esc(t.order_no)}${t.order_date ? ' dt ' + esc(t.order_date) : ''}</span><b>Joined</b><span>${esc(t.joined_on)}</span><b>Relieved</b><span>${t.relieved_on ? esc(t.relieved_on) + ' (confirmed by ' + esc(t.outgoing_by) + ')' : '<span class="db-no">not yet confirmed by the outgoing institution</span>'}</span>
      <b>Officer approvals</b><span>${t.out_approved_by ? '✓ outgoing side (' + esc(t.out_approved_by) + ')' : '… outgoing side'}<br>${t.approved_by ? '✓ receiving side (' + esc(t.approved_by) + ')' : '… receiving side'}</span></div>`
      + (e ? `<h3>Service record</h3><div class="kv2"><b>CNIC</b><span>${esc(e.employee.cnic)}</span><b>Own title</b><span>${esc(e.employee.own_designation || e.employee.designation)} (BPS-${esc(e.employee.own_bps || e.employee.post_bps)})</span><b>First appointed</b><span>${esc(e.employee.first_appt_date)} as ${esc(e.employee.first_designation)}</span><b>Postings</b><span>${e.postings.map(p => esc(p.station_name) + ' ' + esc(p.from_date) + '–' + esc(p.to_date || 'now')).join('<br>') || '–'}</span></div>` : '');
  }
  if (x.sheet === 'Facilities') {
    const f = it.rows[0];
    html = `<p class="muted">Entered ${esc(f.submitted_on)} by ${esc(f.submitted_by)}. Verify on inspection; open the institution to correct any figure before approving.</p>` + facilitiesSummary(f);
  }
  const verb = x.sheet === 'Transfers' ? 'Reject' : 'Return';
  $('#rv').innerHTML = html + `<div class="decide"><button class="btn" style="background:var(--ok)" onclick="decide('approve')">Approve</button><button class="btn warn" onclick="decide('return')">${verb} with remarks</button><button class="btn alt" onclick="pick('${esc(x.emis)}')">Open institution</button></div>`;
};
window.decide = decision => {
  const x = S.view === 'emp' ? (S.arg && S.arg.review) : S.arg;
  if (!x) return;
  let remark = '';
  if (decision === 'return') { remark = prompt('Remarks (the school will see them):') || ''; if (!remark) return; }
  queue('review', { sheet: x.sheet, key: x.key, decision, remark }, `${decision === 'return' ? 'Returned' : 'Approved'}: ${x.inst}`);
  if (S.pendingItems) { S.pendingItems = S.pendingItems.filter(p => p.key !== x.key); S.boot.pending = S.pendingItems.length; LS.set('boot', S.boot); }
  jump('approvals');
};

/* ---------------- start ---------------- */
render();
if (S.token) { refreshBoot(); refreshInst(true); sync(); }
