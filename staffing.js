/* =====================================================================
   STAFFING (v4 part F): receiving a transferred employee under the
   substantive-scale rule with minimum disclosure, surplus attachments
   (DEO approval), Community Teachers, School Management Committee.
   ===================================================================== */

/* ---------- receive a transferred employee ---------- */
V.receive = () => `<div class="card"><h2>Receive transferred employee</h2>
  <p class="muted">Enter the employee's CNIC. Only the name, father's name and present place of posting are shown, with the posts of your institution that this employee can hold. The service record comes here once the transfer is approved.</p>
  <label>CNIC or Personnel No.</label><input id="rq" inputmode="numeric" placeholder="xxxxx-xxxxxxx-x"><button class="btn full" id="rs">Search</button><div id="rr"></div></div>`;
BIND.receive = () => {
  $('#rs').onclick = async () => {
    if (!navigator.onLine) { $('#rr').innerHTML = '<div class="msg w">Searching needs internet.</div>'; return; }
    $('#rr').innerHTML = '<p class="muted">Searching…</p>';
    try {
      const j = await api('transferLookup', { q: $('#rq').value.trim(), to_emis: S.emis });
      if (!j.ok) throw new Error(j.error);
      if (!j.found) { $('#rr').innerHTML = `<div class="msg w">No record found. If the employee comes from outside the district or has never been entered, make a first-time entry.</div><button class="btn" onclick="S.stack.pop();go('emp',{mode:'new'})">First-time entry</button>`; return; }
      const P = j.person;
      const who = `<div class="hist"><b>${esc(P.name)}</b> s/o ${esc(P.father_name)}<div class="sub">Present posting: ${esc(P.station)}</div></div>`;
      if (j.here) { $('#rr').innerHTML = who + '<div class="msg o">Already at this institution.</div>'; return; }
      const attach = `<details class="att"><summary>Attach as surplus (needs the DEO's approval)</summary>
        <p class="muted">For an employee who is surplus and is attached to this institution although it has no post for him, so that his attendance is marked here. He is flagged as surplus.</p>
        <div id="af"><label>Situation *</label><select name="kind">${opts([['with_parent', 'Has a parent institution but is allowed to serve here'], ['no_parent', 'Has no parent institution (e.g. post filled while on long leave)']], '', '— choose —')}</select>
        <div id="asal" hidden><label>Salary paid through *</label><select name="salary_source">${opts(S.boot.meta.salarySources || ['Finance Department special approval', 'Against the salary budget of a vacant post (administrative approval)', 'Other'], '', '— choose —')}</select></div>
        <div class="row"><div><label>Order No.</label><input name="order_no"></div><div><label>Order date</label><input type="date" name="order_date"></div></div>
        <label>Joined here on *</label><input type="date" name="joined_on" value="${today()}"><label>Remarks</label><input name="remark">
        <button class="btn alt full" id="asend">Send to the DEO for approval</button></div></details>`;
      if (j.blocked) { $('#rr').innerHTML = who + `<div class="msg w">No post in your institution can take this employee: his substantive scale is higher than every post in your budget.</div>` + attach; bindAttach(P); return; }
      if (j.open) { $('#rr').innerHTML = who + '<div class="msg w">A transfer of this employee is already in process.</div>'; return; }
      const label = p => `${p.designation} (BPS-${p.bps}) · ${p.filled >= p.sanctioned ? `filled ${p.filled}/${p.sanctioned}` : `${p.sanctioned - p.filled} vacant`}`;
      $('#rr').innerHTML = who + `<div id="cf">
        <label>Post at this institution *</label><select name="post_id">${opts(j.posts.map(p => [p.post_id, label(p)]), '', '— choose —')}</select>
        <div id="cfw"></div>
        <div id="cpl" hidden><label>Basis of holding the post *</label><select name="placement">${opts([['Current charge basis', 'Current charge basis (draws own scale)'], ['Officiating basis', 'Officiating basis (draws the scale of the post)']], '', '— choose —')}</select></div>
        <div class="row"><div><label>Transfer order No. *</label><input name="order_no"></div><div><label>Order date</label><input type="date" name="order_date"></div></div>
        <label>Joined here on *</label><input type="date" name="joined_on" value="${today()}">
        <button class="btn full" id="cs">Send transfer request</button>
        <p class="muted">The outgoing institution must confirm relieving, and the AEO / DDEO / DEO office of both institutions must approve; the record then moves here.</p></div>` + attach;
      const sel = $('#cf').querySelector('[name="post_id"]');
      sel.onchange = () => { const p = j.posts.find(x => x.post_id === sel.value);
        $('#cpl').hidden = !(p && p.basis === 'higher');
        $('#cfw').innerHTML = p && p.filled >= p.sanctioned ? '<div class="msg w">This post is already filled. Continue only if the order posts this employee in place of someone who is leaving.</div>' : p && p.basis === 'same' ? '<p class="muted">Another post of the same scale: recorded as such.</p>' : ''; };
      $('#cs').onclick = () => {
        const c = formData($('#cf')), p = j.posts.find(x => x.post_id === c.post_id);
        if (!p || !c.order_no || !c.joined_on) return toast('Post, order No. and joining date are required');
        c.placement = p.basis === 'own' ? 'Against own post' : p.basis === 'same' ? 'Against another post of the same scale' : c.placement;
        if (!c.placement) return toast('Choose current charge or officiating basis');
        queue('claimEmployee', Object.assign(c, { cnic: P.cnic, to_emis: S.emis, designation: p.designation }), 'Transfer request: ' + P.name);
        const d = D(); d.transfersIn = (d.transfersIn || []).concat([{ name: P.name, from_name: P.station, status: 'Request sent to outgoing institution and officer' }]); saveD(d);
        toast('Request sent. The record moves here after the outgoing institution and both officers approve.'); back();
      };
      bindAttach(P);
    } catch (err) { $('#rr').innerHTML = `<div class="msg w">${esc(err.message)}</div>`; }
  };
  const bindAttach = P => {
    const f = $('#af'); if (!f) return; const q = n => f.querySelector(`[name="${n}"]`);
    q('kind').onchange = () => { $('#asal').hidden = q('kind').value !== 'no_parent'; };
    $('#asend').onclick = () => { const c = formData(f);
      if (!c.kind) return toast('Choose the situation'); if (!c.joined_on) return toast('Date of joining is required'); if (c.kind === 'no_parent' && !c.salary_source) return toast('Say how the salary is paid');
      queue('requestAttachment', Object.assign(c, { q: P.cnic, to_emis: S.emis }), 'Surplus attachment: ' + P.name);
      toast('Sent to the DEO for approval'); back(); };
  };
};

/* ---------- Community Teachers ---------- */
V.ct = arg => {
  const d = D(); const t = (d.community || []).find(x => x.id === arg.id) || { gender: 'Male', from_date: today(), paid_by: '' };
  return `<form id="ctf" class="card"><h2>${arg.id ? esc(t.name) : 'Community Teacher'}</h2>
    <p class="muted">A teacher engaged by the community or the School Management Committee where government teachers are short. Not a civil servant; not counted against any post. Can be given periods in the timetable and marked in attendance.</p>
    ${t.status === 'Returned' ? `<div class="msg w">Returned: ${esc(t.remark)}</div>` : ''}
    <label>Name *</label><input name="name" value="${esc(t.name || '')}" style="text-transform:uppercase"><label>Father's name *</label><input name="father_name" value="${esc(t.father_name || '')}" style="text-transform:uppercase">
    <div class="row"><div><label>CNIC</label><input name="cnic" inputmode="numeric" value="${esc(t.cnic || '')}"></div><div><label>Mobile</label><input name="mobile" inputmode="tel" value="${esc(t.mobile || '')}"></div></div>
    <div class="row"><div><label>Gender</label><select name="gender">${opts(['Male', 'Female'], t.gender)}</select></div><div><label>Qualification</label><input name="qualification" value="${esc(t.qualification || '')}"></div></div>
    <label>Subject(s) taught</label><input name="subject" value="${esc(t.subject || '')}">
    <div class="row"><div><label>Paid by</label><select name="paid_by">${opts(S.boot.meta.communityPaidBy || ['School Management Committee', 'Community', 'NGO', 'Philanthropist', 'Other'], t.paid_by, '— choose —')}</select></div><div><label>Name of NGO / person (if any)</label><input name="paid_by_name" value="${esc(t.paid_by_name || '')}"></div></div>
    <div class="row"><div><label>Monthly honorarium (Rs)</label><input name="honorarium" inputmode="numeric" value="${esc(t.honorarium || '')}"></div><div><label>Serving since *</label><input type="date" name="from_date" value="${esc(t.from_date || '')}"></div></div>
    <div class="decide"><button class="btn">Save</button>${arg.id ? '<button class="btn warn" type="button" id="ctl">Record leaving</button>' : ''}</div></form>`;
};
BIND.ct = arg => {
  $('#ctf').onsubmit = e => { e.preventDefault(); const t = formData($('#ctf')); t.id = arg.id || '';
    if (!t.name || !t.father_name || !t.from_date) return toast("Name, father's name and the date are required");
    queue('saveCommunityTeacher', { emis: S.emis, teacher: t }, 'Community Teacher: ' + t.name);
    const d = D(); d.community = d.community || []; const i = d.community.findIndex(x => x.id === arg.id);
    const row = Object.assign({ id: arg.id || 'tmp' + Date.now(), status: 'Submitted', state: 'Serving' }, t, { name: t.name.toUpperCase(), father_name: t.father_name.toUpperCase() });
    if (i >= 0) d.community[i] = row; else d.community.push(row); saveD(d); toast('Saved'); back(); };
  const l = $('#ctl'); if (l) l.onclick = () => { if (!confirm('Record that this teacher no longer serves here?')) return;
    queue('leaveCommunityTeacher', { id: arg.id, to_date: today() }, 'Community Teacher left'); const d = D(); d.community = (d.community || []).filter(x => x.id !== arg.id); saveD(d); back(); };
};

/* ---------- School Management Committee ---------- */
function headOf() { const d = D(), i = inst(); if (i.head_name) return i.head_name;
  const h = (d.employees || []).filter(e => /principal|headmaster|head teacher|head master|incharge|in charge/i.test(e.designation)).sort((a, b) => Number(b.post_bps) - Number(a.post_bps))[0];
  return h ? h.name : ''; }
V.smc = () => {
  const d = D(); if (!d) return noData();
  const smc = d.smc || { members: [], meetings: [] }, act = smc.members.filter(m => m.state !== 'Former');
  const chair = act.find(m => m.role === 'Chairperson'), mem = act.filter(m => m.role !== 'Chairperson');
  const row = m => `<div class="it tap" onclick="go('smcm',{id:'${esc(m.id)}'})"><div class="grow"><b>${esc(m.name)}</b><div class="sub">${esc(m.role)} · ${esc(m.category)}${m.mobile ? ' · ' + esc(m.mobile) : ''}${m.term_to ? ' · term to ' + esc(dmy(m.term_to)) : ''}</div></div><span class="chev">›</span></div>`;
  return `<div class="card"><h2>School Management Committee</h2>
    <div class="list">
      ${chair ? row(chair) : `<div class="it tap" onclick="go('smcm',{role:'Chairperson'})"><div class="grow"><b>Chairperson</b><div class="sub">Not entered</div></div><span class="chev">›</span></div>`}
      <div class="it"><div class="grow"><b>${esc(headOf() || 'Head of institution')}</b><div class="sub">Secretary · head of institution (always)</div></div></div>
      ${mem.map(row).join('')}
    </div><button class="btn" onclick="go('smcm',{role:'Member'})">+ Add member</button></div>
    <div class="card"><div class="db-sh rhead"><h3>Meetings</h3><span class="rbtn"><button class="btn alt" onclick="go('smcmeet',{})">+ Record meeting</button></span></div>
    ${smc.meetings.length ? `<div class="list">${smc.meetings.map(m => `<div class="it tap" onclick="go('smcmeet',{id:'${esc(m.id)}'})"><div class="grow"><b>${esc(dmy(m.date))}</b><div class="sub">${esc(m.present)} present · ${esc(String(m.decisions).slice(0, 90))}${String(m.decisions).length > 90 ? '…' : ''}</div></div><span class="chev">›</span></div>`).join('')}</div>` : '<p class="muted">No meeting recorded.</p>'}</div>`;
};
V.smcm = arg => { const d = D(), m = ((d.smc || {}).members || []).find(x => x.id === arg.id) || { role: arg.role || 'Member', category: '', gender: 'Male' };
  return `<form id="smf" class="card"><h2>${arg.id ? esc(m.name) : m.role === 'Chairperson' ? 'Chairperson' : 'New member'}</h2>
    <label>Name *</label><input name="name" value="${esc(m.name || '')}">
    <div class="row"><div><label>Role</label><select name="role">${opts(S.boot.meta.smcRoles || ['Chairperson', 'Member'], m.role)}</select></div><div><label>Category *</label><select name="category">${opts(S.boot.meta.smcCategories || ['Parent', 'Teacher', 'Community notable', 'Local representative', 'Other'], m.category, '— choose —')}</select></div></div>
    <div class="row"><div><label>Gender</label><select name="gender">${opts(['Male', 'Female'], m.gender)}</select></div><div><label>Occupation</label><input name="occupation" value="${esc(m.occupation || '')}"></div></div>
    <div class="row"><div><label>CNIC</label><input name="cnic" inputmode="numeric" value="${esc(m.cnic || '')}"></div><div><label>Mobile</label><input name="mobile" inputmode="tel" value="${esc(m.mobile || '')}"></div></div>
    <div class="row"><div><label>Term from</label><input type="date" name="term_from" value="${esc(m.term_from || '')}"></div><div><label>Term to</label><input type="date" name="term_to" value="${esc(m.term_to || '')}"></div></div>
    <p class="muted">The head of institution is always the Secretary and is not entered here.</p>
    <div class="decide"><button class="btn">Save</button>${arg.id ? '<button class="btn warn" type="button" id="smx">No longer a member</button>' : ''}</div></form>`; };
BIND.smcm = arg => {
  const put = (m, remove) => { const d = D(); d.smc = d.smc || { members: [], meetings: [] }; const i = d.smc.members.findIndex(x => x.id === m.id);
    if (remove) { if (i >= 0) d.smc.members[i].state = 'Former'; } else if (i >= 0) d.smc.members[i] = Object.assign(d.smc.members[i], m); else d.smc.members.push(Object.assign({ state: 'Serving' }, m)); saveD(d); };
  $('#smf').onsubmit = e => { e.preventDefault(); const m = formData($('#smf')); m.id = arg.id || 'tmp' + Date.now();
    if (!m.name || !m.category) return toast('Name and category are required');
    const d = D(); if (m.role === 'Chairperson' && ((d.smc || {}).members || []).some(x => x.role === 'Chairperson' && x.state !== 'Former' && x.id !== m.id)) return toast('The committee already has a Chairperson. Mark the present one as no longer a member first.');
    queue('saveSMCMember', { emis: S.emis, member: Object.assign({}, m, { id: arg.id || '' }) }, 'SMC member: ' + m.name); put(m); toast('Saved'); back(); };
  const x = $('#smx'); if (x) x.onclick = () => { queue('saveSMCMember', { emis: S.emis, member: { id: arg.id }, remove: 1 }, 'SMC member removed'); put({ id: arg.id }, true); back(); };
};
V.smcmeet = arg => { const d = D(), m = ((d.smc || {}).meetings || []).find(x => x.id === arg.id) || { date: today() };
  return `<form id="mmf" class="card"><h2>${arg.id ? 'Meeting of ' + esc(dmy(m.date)) : 'Record a meeting'}</h2>
    <div class="row"><div><label>Date *</label><input type="date" name="date" value="${esc(m.date || '')}"></div><div><label>Members present</label><input name="present" type="number" min="0" inputmode="numeric" value="${esc(m.present || '')}"></div></div>
    <label>Names of those present</label><input name="present_names" value="${esc(m.present_names || '')}">
    <label>Agenda</label><textarea name="agenda" rows="3">${esc(m.agenda || '')}</textarea>
    <label>Decisions *</label><textarea name="decisions" rows="5">${esc(m.decisions || '')}</textarea>
    <label>Next meeting</label><input type="date" name="next_date" value="${esc(m.next_date || '')}">
    <div class="decide"><button class="btn">Save</button></div></form>`; };
BIND.smcmeet = arg => { $('#mmf').onsubmit = e => { e.preventDefault(); const m = formData($('#mmf')); if (!m.date || !m.decisions) return toast('Date and decisions are required');
  queue('saveSMCMeeting', { emis: S.emis, meeting: Object.assign({}, m, { id: arg.id || '' }) }, 'SMC meeting ' + dmy(m.date));
  const d = D(); d.smc = d.smc || { members: [], meetings: [] }; const i = d.smc.meetings.findIndex(x => x.id === arg.id); const row = Object.assign({ id: arg.id || 'tmp' + Date.now() }, m);
  if (i >= 0) d.smc.meetings[i] = row; else d.smc.meetings.unshift(row); saveD(d); toast('Saved'); back(); }; };
