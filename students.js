/* =====================================================================
   STUDENT REGISTER (v4 part D)
   The school's admission register in the app: every enrolled child,
   admission by form or bulk upload, leaving, transfer-in by SLC number,
   enrolment return derived from the register, printable admission form.
   Children's records are seen only by the school and its officers.
   ===================================================================== */

const LEFT_REASONS = ['Passed out', 'Transferred to another school', 'Migrated', 'Dropped out', 'Expelled', 'Death', 'Other'];
const DROPOUT_REASONS = ['Distance', 'Poverty', 'Child work', 'Marriage', 'Illness', 'Parents unwilling', 'Not known', 'Other'];
const PREV_TYPES = ['Fresh admission (never schooled)', 'From another school', 'Re-admission'];
const RELIGIONS = ['Islam', 'Christianity', 'Hinduism', 'Other'];
const TONGUES = ['Hindko', 'Kashmiri', 'Pahari', 'Gojri', 'Punjabi', 'Pashto', 'Urdu', 'Other'];
const DISABILITIES = ['None', 'Visual', 'Hearing', 'Speech', 'Physical', 'Intellectual', 'Multiple', 'Other'];
const DOCS = ['B-Form copy', "Father's CNIC copy", 'School leaving certificate', 'Previous result card', 'Photographs'];
const IMPORT_COLS = [['adm_no', 'Admission No.*'], ['adm_date', 'Date of admission* (YYYY-MM-DD)'], ['name', 'Student name*'], ['name_ur', 'Name in Urdu'], ['father_name', "Father's name*"], ['father_name_ur', "Father's name in Urdu"],
  ['gender', 'Gender* (Male/Female)'], ['dob', 'Date of birth* (YYYY-MM-DD)'], ['class', 'Class* (ECE, I … XII)'], ['section', 'Section'], ['roll_no', 'Roll No.'], ['bform', 'B-Form No.'], ['father_cnic', "Father's CNIC"], ['mobile', 'Mobile'],
  ['religion', 'Religion'], ['address', 'Address'], ['uc', 'Union council'], ['orphan', 'Orphan (Yes/No)'], ['disability', 'Disability'], ['prev_school', 'Previous school (if any)']];

/* ---------- local register cache (per institution, inside D()) ---------- */
const REG = {
  get() { const d = D(); return d && d.register ? d.register : null; },
  set(r) { const d = D(); if (!d) return; d.register = r; saveD(d); },
  async refresh(force) {
    if (!navigator.onLine || !S.emis) return;
    const cur = REG.get(); if (!force && cur && Date.now() - (cur.at || 0) < 10 * 60e3) return;
    try { const j = await api('getRegister', { emis: S.emis, left: 1 }); if (j.ok) { j.at = Date.now(); REG.set(j); } } catch (e) { }
  },
  students() { const r = REG.get(); return r ? r.students : []; },
  nextAdm() { const n = REG.students().concat((REG.get() || {}).left || []).map(s => parseInt(String(s.adm_no).replace(/\D.*$/, ''), 10)).filter(x => isFinite(x)); return n.length ? String(Math.max.apply(null, n) + 1) : ''; },
  /** apply a local change at once so the list is right before the sync */
  put(s) { const r = REG.get() || { students: [], left: [], exists: true }; const i = r.students.findIndex(x => x.adm_no === s.adm_no); if (i >= 0) r.students[i] = Object.assign(r.students[i], s); else r.students.push(s); r.exists = true; REG.set(r); },
  remove(adm_no, upd) { const r = REG.get(); if (!r) return; const i = r.students.findIndex(x => x.adm_no === adm_no); if (i >= 0) { const s = Object.assign(r.students[i], upd, { status: 'Left' }); r.students.splice(i, 1); (r.left = r.left || []).push(s); REG.set(r); } },
  /** counts for the enrolment return, same rule as the server */
  counts(month) {
    const out = {}; const all = REG.students().concat(((REG.get() || {}).left || []));
    all.forEach(s => {
      if (s.status === 'Left' && s.left_date < month + '-01') return; if (s.adm_date > month + '-31') return;
      const o = out[s.class] = out[s.class] || { class: s.class, boys: 0, girls: 0, new_admissions: 0 };
      o[s.gender === 'Female' ? 'girls' : 'boys']++; if ((s.adm_date || '').slice(0, 7) === month) o.new_admissions++;
    });
    return CLASSES.filter(c => out[c]).map(c => out[c]);
  }
};

/* ---------- list ---------- */
V.students = () => {
  const d = D(); if (!d) return noData();
  const r = REG.get();
  return `<div class="card"><div class="db-sh rhead"><h3>Students</h3><span class="rbtn noprint"><button class="btn" onclick="go('student',{mode:'new'})">+ Admit</button></span></div>
    ${!r || !r.exists ? `<p class="muted">The register is empty. Register every child now on the roll, with the admission numbers from the school's admission register — by uploading a filled sheet (fastest) or one by one.</p>
      <button class="btn alt" onclick="go('simport')">Upload from Excel sheet</button>` : `<p class="muted" id="scount"></p>`}
    <input id="sq" placeholder="Search by name, father's name, admission or roll No."><div class="seg" id="scls"></div></div>
    <div class="list" id="sl"></div>
    <div class="card noprint"><h3>More</h3><div class="list">
      <div class="it tap" onclick="go('slc')"><div class="grow"><b>Receive a student from another school</b><div class="sub">By the leaving certificate number</div></div><span class="chev">›</span></div>
      <div class="it tap" onclick="go('simport')"><div class="grow"><b>Upload students from an Excel sheet</b><div class="sub">For first-time registration of the whole roll</div></div><span class="chev">›</span></div>
      <div class="it tap" onclick="go('sleft')"><div class="grow"><b>Students who left</b><div class="sub">${((r || {}).left || []).length} in the last 3 years</div></div><span class="chev">›</span></div>
      <div class="it tap" onclick="go('sprint',{blank:1})"><div class="grow"><b>Print blank admission form</b><div class="sub">For parents to fill by hand</div></div><span class="chev">›</span></div>
    </div></div>`;
};
BIND.students = () => {
  let cls = LS.get('s_cls_' + S.emis, '');
  const draw = () => {
    const all = REG.students(); const q = ($('#sq').value || '').trim().toLowerCase();
    const classes = CLASSES.filter(c => all.some(s => s.class === c));
    $('#scls').innerHTML = `<button class="${cls === '' ? 'on' : ''}" data-c="">All ${all.length}</button>` + classes.map(c => `<button class="${cls === c ? 'on' : ''}" data-c="${c}">${c} <small>${all.filter(s => s.class === c).length}</small></button>`).join('');
    $('#scls').querySelectorAll('button').forEach(b => b.onclick = () => { cls = b.dataset.c; LS.set('s_cls_' + S.emis, cls); draw(); });
    const list = all.filter(s => (!cls || q || s.class === cls) && (!q || (s.name + ' ' + s.father_name + ' ' + s.adm_no + ' ' + (s.roll_no || '')).toLowerCase().includes(q)));
    if ($('#scount')) $('#scount').textContent = `${all.length} enrolled · ${all.filter(s => s.gender === 'Female').length} girls · ${all.filter(s => s.bform).length} with B-Form`;
    $('#sl').innerHTML = list.slice(0, 400).map(s => `<div class="it tap" onclick="go('student',{mode:'edit',adm_no:'${esc(s.adm_no)}'})"><div class="grow"><b>${esc(s.name)}</b> <span class="muted">s/o ${esc(s.father_name)}</span>
      <div class="sub">Adm. ${esc(s.adm_no)} · Class ${esc(s.class)}${s.section ? '-' + esc(s.section) : ''}${s.roll_no ? ' · Roll ' + esc(s.roll_no) : ''}${s.name_ur ? ' · <span class="ur2">' + esc(s.name_ur) + '</span>' : ''}</div></div>
      ${s._pending ? '<span class="badge w">Sending</span>' : ''}<span class="chev">›</span></div>`).join('') || (all.length ? '<p class="muted">No match.</p>' : '');
  };
  $('#sq').oninput = draw; draw();
  REG.refresh(false).then(() => { if (S.view === 'students') draw(); });
};

/* ---------- admission / edit form ---------- */
V.student = arg => {
  const d = D(); if (!d) return noData();
  const isNew = arg.mode === 'new';
  const s = isNew ? Object.assign({ adm_no: REG.nextAdm(), adm_date: today(), gender: 'Male', religion: 'Islam', nationality: 'Pakistani', prev_type: PREV_TYPES[0], orphan: 'No', disability: 'None', class: '' }, arg.prefill || {})
    : (REG.students().find(x => x.adm_no === arg.adm_no) || ((REG.get() || {}).left || []).find(x => x.adm_no === arg.adm_no));
  if (!s) return '<div class="card"><p class="muted">Student not found in the register on this phone.</p></div>';
  const left = s.status === 'Left';
  const lv = inst().level, classes = classesFor(lv);
  const f = (n, l, extra = '') => `<label>${l}</label><input name="${n}" value="${esc(s[n] || '')}" ${extra}>`;
  const sel = (n, l, o, blank) => `<label>${l}</label><select name="${n}">${opts(o, s[n] || '', blank)}</select>`;
  return `<form id="sf" class="card" autocomplete="off">
    <h2>${isNew ? (arg.prefill ? 'Admit transferred student' : 'New admission') : esc(s.name)}</h2>
    ${left ? `<div class="msg w">Left on ${esc(dmy(s.left_date))} — ${esc(s.left_reason)}${s.left_detail ? ' (' + esc(s.left_detail) + ')' : ''}${s.slc_no ? ' · SLC No. ' + esc(s.slc_no) : ''}. Record is read-only.</div>` : ''}
    <fieldset ${left ? 'disabled' : ''}>
    <h3>Admission</h3>
    <div class="row"><div>${f('adm_no', 'Admission No. *', isNew ? '' : 'readonly')}<small class="muted">${isNew ? 'Continues the school register' : ''}</small></div><div>${f('adm_date', 'Date of admission *', 'type="date"')}</div></div>
    <div class="row"><div>${sel('class', 'Class *', classes, '— choose —')}</div><div>${f('section', 'Section')}</div><div>${f('roll_no', 'Roll No.')}</div></div>
    ${['High', 'Higher Secondary'].includes(lv) ? f('group', 'Group / electives (IX–XII)') : ''}
    <h3>Student</h3>
    ${f('name', 'Name (English) *', 'style="text-transform:uppercase"')}
    <label>نام (اردو)</label><input name="name_ur" class="ur2" dir="rtl" lang="ur" value="${esc(s.name_ur || '')}">
    ${f('father_name', "Father's name (English) *", 'style="text-transform:uppercase"')}
    <label>والد کا نام (اردو)</label><input name="father_name_ur" class="ur2" dir="rtl" lang="ur" value="${esc(s.father_name_ur || '')}">
    <div class="row"><div>${f('dob', 'Date of birth *', 'type="date"')}</div><div>${sel('gender', 'Gender *', ['Male', 'Female'])}</div></div>
    <div class="row"><div>${f('bform', 'B-Form / CRC No.', 'inputmode="numeric" placeholder="xxxxx-xxxxxxx-x"')}</div><div>${sel('religion', 'Religion', RELIGIONS)}</div></div>
    <div class="row"><div>${sel('mother_tongue', 'Mother tongue', TONGUES, '—')}</div><div>${f('nationality', 'Nationality')}</div></div>
    <div class="row"><div>${sel('orphan', 'Orphan', ['No', 'Yes'])}</div><div>${sel('disability', 'Disability', DISABILITIES)}</div></div>
    <h3>Family and contact</h3>
    <div class="row"><div>${f('father_cnic', "Father's / guardian's CNIC", 'inputmode="numeric" placeholder="xxxxx-xxxxxxx-x"')}</div><div>${f('mobile', 'Mobile (WhatsApp)', 'inputmode="tel"')}</div></div>
    <div class="row"><div>${f('guardian_name', 'Guardian (if not father)')}</div><div>${f('guardian_relation', 'Relation')}</div></div>
    <div class="row"><div>${f('occupation', "Father's / guardian's occupation")}</div><div>${f('mother_name', "Mother's name (optional)")}</div></div>
    ${f('address', 'Address (village / mohalla)')}
    <div class="row"><div>${f('uc', 'Union council')}</div><div>${f('distance_km', 'Distance from school (km)', 'type="number" step="0.1" min="0"')}</div></div>
    <h3>Previous schooling</h3>
    ${sel('prev_type', 'Admission type', PREV_TYPES)}
    <div id="prevw" ${s.prev_type === PREV_TYPES[1] ? '' : 'hidden'}>
    <div class="row"><div>${f('prev_school', 'Previous school')}</div><div>${f('prev_emis', 'EMIS code (if government)')}</div></div>
    <div class="row"><div>${f('prev_class_passed', 'Class passed')}</div><div>${f('prev_slc_no', 'SLC No.')}</div><div>${f('prev_slc_date', 'SLC date', 'type="date"')}</div></div></div>
    <h3>Documents received</h3>
    <div class="chips" id="docs">${DOCS.map(x => `<button type="button" class="${(s.docs || '').includes(x) ? 'on' : ''}" data-v="${x}">${x}</button>`).join('')}</div>
    ${f('notes', 'Notes')}
    </fieldset>
    ${left ? '' : `<div class="decide"><button class="btn" id="ss">${isNew ? 'Admit student' : 'Save changes'}</button>${isNew ? '' : `<button class="btn alt" type="button" onclick="go('sprint',{adm_no:'${esc(s.adm_no)}'})">Print</button><button class="btn warn" type="button" onclick="go('withdraw',{adm_no:'${esc(s.adm_no)}'})">Record leaving</button>`}</div>`}
  </form>`;
};
BIND.student = arg => {
  const form = $('#sf'); if (!form) return;
  const q = n => form.querySelector(`[name="${n}"]`);
  q('prev_type').onchange = () => { $('#prevw').hidden = q('prev_type').value !== PREV_TYPES[1]; };
  $('#docs').querySelectorAll('button').forEach(b => b.onclick = () => b.classList.toggle('on'));
  const cnicFmt = v => { const d = v.replace(/\D/g, ''); return d.length === 13 ? d.slice(0, 5) + '-' + d.slice(5, 12) + '-' + d.slice(12) : v.trim(); };
  form.onsubmit = e => {
    e.preventDefault();
    const s = {}; form.querySelectorAll('[name]').forEach(el => { s[el.name] = el.value.trim(); });
    s.docs = [...$('#docs').querySelectorAll('button.on')].map(b => b.dataset.v).join(', ');
    s.name = s.name.toUpperCase().replace(/\s+/g, ' '); s.father_name = s.father_name.toUpperCase().replace(/\s+/g, ' '); s.adm_no = s.adm_no.toUpperCase();
    s.bform = cnicFmt(s.bform); s.father_cnic = cnicFmt(s.father_cnic);
    for (const k of ['adm_no', 'adm_date', 'name', 'father_name', 'dob', 'class']) if (!s[k]) return toast('Please fill: ' + q(k).previousElementSibling.textContent.replace(' *', ''));
    const age = (new Date(s.adm_date) - new Date(s.dob)) / 31557600000;
    if (!(age >= 2.5 && age <= 30)) return toast('Check the date of birth: age at admission would be ' + Math.round(age) + ' years');
    if (s.bform && !/^\d{5}-\d{7}-\d$/.test(s.bform)) return toast('B-Form No. should have 13 digits');
    if (s.father_cnic && !/^\d{5}-\d{7}-\d$/.test(s.father_cnic)) return toast('CNIC should have 13 digits');
    if (s.mobile && !/^0\d{10}$/.test(s.mobile)) return toast('Mobile should be 11 digits starting with 0');
    const isNew = arg.mode === 'new';
    if (isNew) {
      if (REG.students().some(x => x.adm_no === s.adm_no)) return toast('Admission No. ' + s.adm_no + ' is already in the register');
      const dup = REG.students().find(x => x.name === s.name && x.father_name === s.father_name && x.dob === s.dob);
      if (dup && !form.dataset.force) { form.dataset.force = '1'; return toast('Same name, father and date of birth as Adm. ' + dup.adm_no + '. Press again if this is a different child.'); }
    }
    queue('saveStudent', { emis: S.emis, mode: isNew ? 'new' : 'edit', student: s, force: form.dataset.force ? 1 : 0 }, (isNew ? 'Admission: ' : 'Student: ') + s.name);
    REG.put(Object.assign({ status: 'Enrolled', _pending: 1 }, s));
    toast(isNew ? 'Admitted' : 'Saved'); back();
  };
};

/* ---------- leaving ---------- */
V.withdraw = arg => {
  const s = REG.students().find(x => x.adm_no === arg.adm_no); if (!s) return '<div class="card"><p class="muted">Not found.</p></div>';
  return `<form id="wf" class="card"><h2>Record leaving</h2><p class="muted"><b>${esc(s.name)}</b> s/o ${esc(s.father_name)} · Adm. ${esc(s.adm_no)} · Class ${esc(s.class)}</p>
    <label>Date of leaving *</label><input name="left_date" type="date" value="${today()}" required>
    <label>Reason *</label><select name="left_reason">${opts(LEFT_REASONS, '', '— choose —')}</select>
    <div id="wdrop" hidden><label>Dropout reason *</label><select name="dropout">${opts(DROPOUT_REASONS, '', '— choose —')}</select></div>
    <div id="wschool" hidden><label>Name of the school joined (if known)</label><input name="left_to_school"></div>
    <div id="wother" hidden><label>Details</label><input name="left_other"></div>
    <label class="chk"><input type="checkbox" name="issue_slc"> Issue school leaving certificate (gives the next SLC number)</label>
    <div class="decide"><button class="btn warn">Record leaving</button></div></form>`;
};
BIND.withdraw = arg => {
  const f = $('#wf'), q = n => f.querySelector(`[name="${n}"]`);
  q('left_reason').onchange = () => { const v = q('left_reason').value; $('#wdrop').hidden = v !== 'Dropped out'; $('#wschool').hidden = v !== 'Transferred to another school'; $('#wother').hidden = !['Other', 'Migrated', 'Expelled'].includes(v); if (v === 'Transferred to another school') q('issue_slc').checked = true; };
  f.onsubmit = e => {
    e.preventDefault();
    const reason = q('left_reason').value; if (!reason) return toast('Choose the reason');
    const detail = reason === 'Dropped out' ? q('dropout').value : reason === 'Transferred to another school' ? q('left_to_school').value : q('left_other').value;
    if (reason === 'Dropped out' && !detail) return toast('Choose the dropout reason');
    const p = { emis: S.emis, adm_no: arg.adm_no, left_date: q('left_date').value, left_reason: reason, left_detail: detail, left_to_school: reason === 'Transferred to another school' ? detail : '', issue_slc: q('issue_slc').checked ? 1 : 0 };
    queue('withdrawStudent', p, 'Left: ' + arg.adm_no);
    REG.remove(arg.adm_no, { left_date: p.left_date, left_reason: reason, left_detail: detail, slc_no: p.issue_slc ? 'pending' : '' });
    toast(p.issue_slc ? 'Recorded. The SLC number appears after sending.' : 'Recorded'); S.stack.pop(); back();
  };
};

V.sleft = () => { const l = ((REG.get() || {}).left || []).slice().sort((a, b) => b.left_date < a.left_date ? -1 : 1);
  return `<div class="card"><h2>Students who left</h2>${l.length ? `<div class="list">${l.map(s => `<div class="it tap" onclick="go('student',{mode:'edit',adm_no:'${esc(s.adm_no)}'})"><div class="grow"><b>${esc(s.name)}</b> <span class="muted">s/o ${esc(s.father_name)}</span><div class="sub">Adm. ${esc(s.adm_no)} · left class ${esc(s.left_class || s.class)} on ${esc(dmy(s.left_date))} · ${esc(s.left_reason)}${s.left_detail ? ' (' + esc(s.left_detail) + ')' : ''}${s.slc_no ? ' · SLC ' + esc(s.slc_no) : ''}</div></div><span class="chev">›</span></div>`).join('')}</div>` : '<p class="muted">None recorded.</p>'}</div>`; };

/* ---------- receive by SLC ---------- */
V.slc = () => `<div class="card"><h2>Receive a student</h2><p class="muted">For a child coming from another government school in the district that uses this register. Enter that school and the leaving certificate number; the record is copied and only the class and admission number are needed.</p>
  <label>Previous school</label><select id="slcs">${opts((S.boot.directory || S.boot.institutions || []).filter(i => i.level !== 'Office' && i.emis !== S.emis).map(i => [i.emis, i.name + ' (' + i.emis + ')']), '', '— choose —')}</select>
  <label>SLC No.</label><input id="slcn" inputmode="numeric">
  <button class="btn" id="slcb">Find</button><p class="muted" id="slcm"></p>
  <p class="muted">If the previous school is not on the list or is private, use <b>+ Admit</b> and fill the previous-schooling section by hand.</p></div>`;
BIND.slc = () => { $('#slcb').onclick = async () => {
  if (!navigator.onLine) return toast('Needs internet'); const prev_emis = $('#slcs').value, slc_no = $('#slcn').value.trim(); if (!prev_emis || !slc_no) return toast('Choose the school and enter the SLC number');
  $('#slcm').textContent = 'Looking up…';
  try { const j = await api('findBySlc', { prev_emis, slc_no }); if (!j.ok) { $('#slcm').textContent = j.error; return; }
    const pre = Object.assign({}, j.student); delete pre.left_class; delete pre.left_date; delete pre.left_reason; delete pre.slc_no; delete pre.slc_date;
    pre.class = CLASSES[Math.min(CLASSES.length - 1, CLASSES.indexOf(j.student.left_class) + 1)] || ''; pre.adm_date = today();
    S.stack.pop(); go('student', { mode: 'new', prefill: pre });
  } catch (e) { $('#slcm').textContent = 'Could not reach the server'; } }; };

/* ---------- bulk upload ---------- */
V.simport = () => `<div class="card"><h2>Upload students</h2>
  <ol class="steps"><li>Download the sheet and open it in Excel or Google Sheets.</li><li>Fill one row per enrolled child, copying the admission number from the register. Dates as <b>YYYY-MM-DD</b>; class as ECE, I, II … X. Urdu names may be typed in the Urdu columns.</li><li>Save as <b>CSV UTF-8</b> (or keep .xlsx) and choose the file here. Rows with mistakes are listed; the rest are saved.</li></ol>
  <button class="btn alt" onclick="STU.template()">Download the sheet</button>
  <label>Choose the filled file</label><input type="file" id="sfile" accept=".csv,.xlsx,.xls">
  <div id="sprev"></div></div>`;
BIND.simport = () => {
  $('#sfile').onchange = async () => {
    const file = $('#sfile').files[0]; if (!file) return;
    let rows;
    try { rows = /\.xlsx?$/i.test(file.name) ? await STU.readXlsx(file) : STU.parseCsv(await file.text()); } catch (e) { return toast('Could not read the file: ' + e.message); }
    const have = {}; REG.students().forEach(s => { have[s.adm_no] = 1; });
    const probs = rows.map((r, k) => { const m = []; ['adm_no', 'adm_date', 'name', 'father_name', 'gender', 'dob', 'class'].forEach(c => { if (!r[c]) m.push(c.replace('_', ' ')); }); if (r.adm_no && have[String(r.adm_no).toUpperCase()]) m.push('already in register'); return m.length ? { row: k + 2, adm_no: r.adm_no, name: r.name, error: m.join(', ') } : null; }).filter(Boolean);
    $('#sprev').innerHTML = `<p><b>${rows.length}</b> rows read${probs.length ? `, <b>${probs.length}</b> with problems` : ''}.</p>
      ${probs.length ? `<div class="scroll"><table><tr><th>Row</th><th>Adm.</th><th>Name</th><th>Problem</th></tr>${probs.slice(0, 30).map(p => `<tr><td>${p.row}</td><td>${esc(p.adm_no)}</td><td>${esc(p.name)}</td><td>${esc(p.error)}</td></tr>`).join('')}</table></div>` : ''}
      <button class="btn" id="sgo" ${navigator.onLine ? '' : 'disabled'}>Save ${rows.length - probs.length} students</button>${navigator.onLine ? '' : '<p class="muted">Uploading needs internet.</p>'}<p class="muted" id="smsg"></p>`;
    const bad = new Set(probs.map(p => p.row)); const good = rows.filter((r, k) => !bad.has(k + 2)).map((r, k) => Object.assign({ _row: k + 2 }, r));
    $('#sgo').onclick = async () => {
      $('#sgo').disabled = true; let added = 0; const errors = [];
      for (let i = 0; i < good.length; i += 150) {
        $('#smsg').textContent = `Saving ${Math.min(i + 150, good.length)} of ${good.length}…`;
        try { const j = await api('importStudents', { emis: S.emis, rows: good.slice(i, i + 150) }); if (!j.ok) { errors.push({ row: '', error: j.error }); break; } added += j.added; errors.push(...j.errors); }
        catch (e) { errors.push({ row: '', error: 'Connection lost; try again — saved rows are not repeated' }); break; }
      }
      $('#smsg').innerHTML = `<b>${added}</b> students saved.` + (errors.length ? ` ${errors.length} not saved:<div class="scroll"><table>${errors.slice(0, 50).map(e => `<tr><td>${e.row}</td><td>${esc(e.adm_no || '')}</td><td>${esc(e.name || '')}</td><td>${esc(e.error)}</td></tr>`).join('')}</table></div>` : '');
      await REG.refresh(true); S.dashStale = true;
    };
  };
};
const STU = {
  template() {
    const head = IMPORT_COLS.map(c => c[1]); const ex = ['EXAMPLE – delete this row', '2024-04-01', 'MUHAMMAD AHMAD', 'محمد احمد', 'ABDUL RASHID', 'عبدالرشید', 'Male', '2018-03-15', 'I', 'A', '1', '34601-1234567-1', '34601-7654321-1', '03001234567', 'Islam', 'Mohallah …, village …', '', 'No', 'None', ''];
    const q = v => '"' + String(v).replace(/"/g, '""') + '"';
    const csv = '﻿' + [head.map(q).join(','), ex.map(q).join(',')].join('\r\n') + '\r\n';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'Students_' + S.emis + '.csv'; a.click();
  },
  mapHead(h) { const k = String(h || '').trim().toLowerCase(); const hit = IMPORT_COLS.find(c => c[1].toLowerCase() === k || c[0] === k || c[1].toLowerCase().split('*')[0].trim() === k.split('*')[0].split('(')[0].trim()); return hit ? hit[0] : null; },
  parseCsv(text) {
    const lines = []; let row = [], cell = '', q = false; text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) { const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); lines.push(row); row = []; cell = ''; } else cell += ch; }
    if (cell || row.length) { row.push(cell); lines.push(row); }
    return STU.rowsFrom(lines);
  },
  rowsFrom(lines) {
    const head = (lines[0] || []).map(STU.mapHead); if (!head.includes('adm_no') || !head.includes('name')) throw new Error('the first row must be the headings from the downloaded sheet');
    return lines.slice(1).filter(r => r.some(v => String(v).trim()) && !/^EXAMPLE/i.test(String(r[head.indexOf('adm_no')] || ''))).map(r => { const o = {}; head.forEach((k, j) => { if (k) o[k] = STU.cell(r[j], k); }); return o; });
  },
  cell(v, k) { if (v instanceof Date) return v.toISOString().slice(0, 10); v = String(v == null ? '' : v).trim(); if ((k === 'dob' || k === 'adm_date') && /^\d{1,2}[-\/.]\d{1,2}[-\/.]\d{4}$/.test(v)) { const p = v.split(/[-\/.]/); return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`; } if (k === 'class') v = v.toUpperCase().replace(/^CLASS\s*/, '').replace(/^0+(\d)/, '$1'); if (k === 'class' && /^\d+$/.test(v)) v = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][Number(v)] || v; if (k === 'class' && /^(ECE|KG|PREP|NURSERY|KACHI|PRE)/i.test(v)) v = 'ECE'; return v; },
  async readXlsx(file) {
    if (!window.XLSX) { await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = res; s.onerror = () => rej(new Error('could not load the Excel reader; save the file as CSV UTF-8 instead')); document.head.appendChild(s); }); }
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]]; const lines = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
    return STU.rowsFrom(lines);
  }
};

/* ---------- printable admission form / record ---------- */
V.sprint = arg => {
  const i = inst(); const s = arg.blank ? {} : (REG.students().find(x => x.adm_no === arg.adm_no) || {});
  const v = k => esc(dmy(s[k] || '')); const tick = (on, l) => `<span><i class="${on ? 'on' : ''}"></i>${l}</span>`;
  return `<div class="noprint card"><button class="btn" onclick="window.print()">Print</button> <span class="muted">A4 portrait. ${arg.blank ? 'Blank form for parents.' : 'Record as entered in the register.'}</span></div>
  <section class="page form pf">
    <div class="lh"><div class="seal">AJK<br>E&amp;SE</div><div class="c"><div class="gov">Azad Government of the State of Jammu &amp; Kashmir · Elementary &amp; Secondary Education Department</div><h1>${esc(i.name)}</h1><div class="sub">EMIS ${esc(i.emis)}${i.halqa ? ' · ' + esc(i.halqa) : ''}</div></div><div class="seal" style="border-radius:2mm;font-size:8pt">Photo</div></div>
    <div class="doc"><h2>ADMISSION FORM <span class="ur" style="font-weight:700">داخلہ فارم</span></h2><div class="ex">Admission No. <b>${v('adm_no') || '________'}</b> · Date of admission <b>${v('adm_date') || '__-__-____'}</b></div></div>
    <div class="sec"><span>1. Student</span><span class="ur">طالب علم کے کوائف</span></div>
    <div class="row c2"><div class="f"><span>Name (English)</span><b>${v('name')}</b></div><div class="f"><span class="ur">نام (اردو)</span><b class="ur">${v('name_ur')}</b></div></div>
    <div class="row c2"><div class="f"><span>Father's name (English)</span><b>${v('father_name')}</b></div><div class="f"><span class="ur">والد کا نام (اردو)</span><b class="ur">${v('father_name_ur')}</b></div></div>
    <div class="row c3"><div class="f"><span>Date of birth</span><b>${v('dob')}</b></div><div class="f"><span>B-Form / CRC No.</span><b>${v('bform')}</b></div><div class="f"><span>Gender</span><b>${v('gender')}</b></div></div>
    <div class="row c3"><div class="f"><span>Religion</span><b>${v('religion')}</b></div><div class="f"><span>Mother tongue</span><b>${v('mother_tongue')}</b></div><div class="f"><span>Nationality</span><b>${v('nationality')}</b></div></div>
    <div class="row c2"><div class="tick"><span>Orphan:</span>${tick(s.orphan === 'Yes', 'Yes')}${tick(s.orphan === 'No', 'No')}</div><div class="tick"><span>Disability:</span>${tick(s.disability === 'None', 'None')}${tick(s.disability && s.disability !== 'None', 'Yes: ' + (s.disability && s.disability !== 'None' ? v('disability') : '__________'))}</div></div>
    <div class="sec"><span>2. Family and contact</span><span class="ur">خاندان اور رابطہ</span></div>
    <div class="row c2"><div class="f"><span>Father's / guardian's CNIC</span><b>${v('father_cnic')}</b></div><div class="f"><span>Guardian and relation (if not father)</span><b>${v('guardian_name')}${s.guardian_relation ? ' (' + v('guardian_relation') + ')' : ''}</b></div></div>
    <div class="row c2"><div class="f"><span>Occupation</span><b>${v('occupation')}</b></div><div class="f"><span>Mobile No. (WhatsApp)</span><b>${v('mobile')}</b></div></div>
    <div class="row"><div class="f"><span>Home address (village / mohalla, union council)</span><b>${v('address')}${s.uc ? ', UC ' + v('uc') : ''}</b></div></div>
    <div class="row c2"><div class="f"><span>Distance from school (km)</span><b>${v('distance_km')}</b></div><div class="f"><span>Mother's name (optional)</span><b>${v('mother_name')}</b></div></div>
    <div class="sec"><span>3. Previous schooling</span><span class="ur">سابقہ تعلیم</span></div>
    <div class="row"><div class="tick">${PREV_TYPES.map(t => tick(s.prev_type === t, t)).join('')}</div></div>
    <div class="row c21"><div class="f"><span>Name of previous school</span><b>${v('prev_school')}</b></div><div class="f"><span>EMIS code (if government)</span><b>${v('prev_emis')}</b></div></div>
    <div class="row c3"><div class="f"><span>Class passed</span><b>${v('prev_class_passed')}</b></div><div class="f"><span>SLC No.</span><b>${v('prev_slc_no')}</b></div><div class="f"><span>SLC date</span><b>${v('prev_slc_date')}</b></div></div>
    <div class="sec"><span>4. Admission</span><span class="ur">داخلہ</span></div>
    <div class="row c3"><div class="f"><span>Class</span><b>${v('class')}</b></div><div class="f"><span>Group / electives (IX–XII)</span><b>${v('group')}</b></div><div class="f"><span>Section / Roll No.</span><b>${v('section')}${s.roll_no ? ' / ' + v('roll_no') : ''}</b></div></div>
    <div class="row"><div class="tick"><span>Documents:</span>${DOCS.map(x => tick((s.docs || '').includes(x), x)).join('')}</div></div>
    <div class="sec"><span>5. Declaration of parent / guardian</span><span class="ur">اقرار نامہ</span></div>
    <div class="note">I certify that the date of birth and other particulars given above are correct. I undertake that my child will follow the rules of the school. I consent to the school keeping my child's record in its register, including the digital register of the District Education Office, for school and departmental purposes only.</div>
    <div class="note ur" style="font-size:11pt">میں تصدیق کرتا/کرتی ہوں کہ درج بالا کوائف درست ہیں۔ میں سکول کے قواعد کی پابندی کا اقرار کرتا/کرتی ہوں اور سکول کو اپنے بچے کا ریکارڈ ضلعی ڈیجیٹل رجسٹر میں محفوظ رکھنے کی اجازت دیتا/دیتی ہوں۔</div>
    <div class="sig"><div>Signature / thumb of parent</div><div>Date</div><div>Head of institution</div></div>
    <div class="foot"><span>Entered in the admission register and the District School Data System${s.created_by ? ' by ' + esc(s.created_by) + ' on ' + esc(dmy((s.created_on || '').slice(0, 10))) : ''}</span><span>${esc(i.name)}</span></div>
  </section>`;
};
BIND.sprint = () => { };
