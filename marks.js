/* =====================================================================
   MARKS OF EACH STUDENT · CLASS RESULT · RESULT CARD (v4H)
   Entry per class (section, group) and subject: one subject at a time on
   a phone, or the whole class as a grid on a laptop. Subjects and maximum
   marks from the DCRD Scheme of Studies 2025 (scheme.js). Works offline:
   marks are kept on the phone and sent when there is internet. The
   district's class summary is worked out from these marks on the server.
   Rules: pass mark RESULT_RULES.pass_pct in every subject (33% now);
   the head may promote on trial with one or two subjects failed;
   position in class from Class VI.
   ===================================================================== */
const MK = {
  rules() { return (S.boot.meta && S.boot.meta.resultRules) || { pass_pct: 33, trial_max_fails: 2, position_from: 'VI' }; },
  ctx() { return LS.get('mk_ctx_' + S.emis, {}); },
  setCtx(c) { LS.set('mk_ctx_' + S.emis, c); },
  key(c) { return [c.exam, c.class, c.section || '', c.group || ''].join('|'); },
  data(c) { return LS.get('mk_' + S.emis + '|' + MK.key(c), null); },
  saveData(c, d) { try { LS.set('mk_' + S.emis + '|' + MK.key(c), d); } catch (e) { toast('Phone storage is full; marks are still sent'); } },
  async load(c) {
    let d = MK.data(c);
    if (navigator.onLine) { try { const j = await api('getMarks', { emis: S.emis, exam: c.exam, class: c.class, section: c.section || '', group: c.group || '' }); if (j.ok) {
      // keep marks typed on this phone that have not reached the server yet
      const pend = outbox().filter(o => o.action === 'saveMarks' && o.payload.emis === S.emis && MK.key(o.payload) === MK.key(c));
      pend.forEach(o => o.payload.rows.forEach(r => MK.put(j, c.exam, o.payload, r.adm_no, r.v)));
      d = j; MK.saveData(c, d); } } catch (e) { } }
    if (!d) { const st = REG.students().filter(s => s.class === c.class && (s.section || '') === (c.section || '')); d = { exam: c.exam, term1: /Term-2/.test(c.exam) ? c.exam.replace(/Term-2.*$/, 'Term-1') : '', students: st, marks: [], decisions: [], att: {}, offline: true }; }
    return d;
  },
  put(d, exam, p, adm, v) {
    const k = [exam, p.class, p.section || '', p.group || '', adm, p.subject].join('|'); let r = d.marks.find(x => x.key === k);
    if (!r) { r = { key: k, exam, class: p.class, section: p.section || '', group: p.group || '', adm_no: adm, subject: p.subject }; d.marks.push(r); }
    Object.assign(r, { max: String(p.max || ''), kind: p.kind, obtained: String(v == null ? '' : v).toUpperCase() });
  },
  /** subjects for the class and group: [{s, max, kind}] fixed + electives added + graded areas */
  subjects(c, d) {
    const sc = SCHEME.forClass(c.class); if (!sc) return [];
    const g = sc.get(c.group || sc.groups[0]);
    const extra = LS.get('mkx_' + S.emis + '|' + c.class + '|' + (c.group || ''), []);
    (d ? d.marks : []).forEach(m => { if (m.kind !== 'grade' && !g.fixed.some(f => f[0] === m.subject) && !extra.some(e => e[0] === m.subject)) extra.push([m.subject, Number(m.max) || g.electiveMax || 100]); });
    return g.fixed.map(([s, max]) => ({ s, max, kind: 'marks' })).concat(extra.map(([s, max]) => ({ s, max, kind: 'marks', elective: true })), g.grades.map(s => ({ s, max: '', kind: 'grade' })));
  },
  electives(c) { const sc = SCHEME.forClass(c.class); if (!sc) return { list: [], max: 0 }; const g = sc.get(c.group || sc.groups[0]); return { list: g.electives || [], max: g.electiveMax || 100 }; },
  students(c, d) {
    let st = (d && d.students && d.students.length ? d.students : REG.students()).filter(s => s.class === c.class && (s.section || '') === (c.section || '') || (d && d.marks.some(m => m.adm_no === s.adm_no && m.exam === c.exam)));
    const sc = SCHEME.forClass(c.class);
    if (c.group && sc && sc.groups.length > 1) {   // register "group" is free text: match on the first word of the scheme group
      const w = c.group.split(/[\s(-]/)[0].toLowerCase(), hit = st.filter(s => String(s.group || '').toLowerCase().includes(w));
      if (hit.length && !c.allGroups) st = hit.concat(st.filter(s => !hit.includes(s) && d && d.marks.some(m => m.adm_no === s.adm_no && m.exam === c.exam)));
    }
    return st.slice().sort((a, b) => (Number(a.roll_no) || 9999) - (Number(b.roll_no) || 9999) || a.name.localeCompare(b.name));
  },
  val(d, exam, adm, sub) { const m = d.marks.find(x => x.exam === exam && x.adm_no === adm && x.subject === sub); return m ? m.obtained : ''; },
  gradeOf(p) { const pass = MK.rules().pass_pct; return p >= 80 ? 'A+' : p >= 70 ? 'A' : p >= 60 ? 'B' : p >= 50 ? 'C' : p >= 40 ? 'D' : p >= pass ? 'E' : 'F'; },
  /** each student's result for exam c.exam */
  results(c, d) {
    const subs = MK.subjects(c, d).filter(x => x.kind === 'marks'), pass = MK.rules().pass_pct, annual = /Term-2/.test(c.exam);
    const dec = {}; (d.decisions || []).forEach(x => { dec[x.adm_no] = x; });
    const out = MK.students(c, d).map(s => {
      let got = 0, max = 0, fails = 0, missing = 0; const failed = [];
      subs.forEach(x => { const v = MK.val(d, c.exam, s.adm_no, x.s);
        if (v === '') { if (!x.elective) missing++; return; }
        max += Number(x.max); if (v === 'A') { fails++; failed.push(x.s); return; }
        got += Number(v); if (Number(v) * 100 / Number(x.max) < pass) { fails++; failed.push(x.s); } });
      const pct = max ? Math.round(got * 1000 / max) / 10 : null, dx = dec[s.adm_no] || {};
      const trialOk = fails > 0 && fails <= MK.rules().trial_max_fails && annual;
      const result = !max ? '' : !fails ? (annual ? 'Promoted' : 'Pass') : trialOk && dx.decision === 'Promoted on trial' ? 'Promoted on trial' : annual ? 'Not promoted' : 'Fail';
      return { s, got, max, pct, grade: pct == null ? '' : fails ? 'F' : MK.gradeOf(pct), fails, failed, missing, trialOk, result, decision: dx.decision || '', remark: dx.remark || '',
        att_days: dx.att_days || (d.att && d.att[s.adm_no] ? String(d.att[s.adm_no].days) : ''), att_present: dx.att_present || (d.att && d.att[s.adm_no] ? String(d.att[s.adm_no].present) : ''), attFromApp: !dx.att_days && !!(d.att && d.att[s.adm_no]) };
    });
    if (CLASSES.indexOf(c.class) >= CLASSES.indexOf(MK.rules().position_from)) {
      const ranked = out.filter(r => r.max && !r.fails).sort((a, b) => b.pct - a.pct); let pos = 0, prev = null;
      ranked.forEach((r, k) => { if (r.pct !== prev) { pos = k + 1; prev = r.pct; } r.position = pos; });
    }
    return out;
  },
  ord(n) { return n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th'); },
  title(c) { return c.exam.replace(/^(\d{4}-\d{2}) /, '') + (c.exam.match(/^\d{4}-\d{2}/) ? ' ' + c.exam.slice(0, 7) : ''); }
};

/* ---------- the hub: choose exam, class, section, group; subjects with progress ---------- */
V.marks = () => {
  const d0 = D(); if (!d0) return noData();
  if (!REG.students().length) return '<div class="card"><h2>Marks of each student</h2><p>Register the students first (Students). Marks are entered against the student register.</p></div>';
  const c = MK.ctx(), cls = classesFor(d0.inst.level).filter(x => x !== 'ECE');
  const exams = examList();
  return `<div class="card"><h2>Marks of each student</h2><div class="ur">طلبہ کے نمبر</div>
    <p class="muted">Subjects and maximum marks follow the Scheme of Studies 2025. Pass mark ${MK.rules().pass_pct}% in every subject. The class summary for the district is worked out from these marks.</p>
    <div class="row"><div><label>Examination</label><select id="mx">${opts(exams, c.exam || exams[0][0])}</select></div><div><label>Class</label><select id="mc">${opts(cls, c.class || cls[0])}</select></div></div>
    <div class="row"><div id="msw"></div><div id="mgw"></div></div>
    <div id="mlist"><p class="muted">Loading…</p></div></div>`;
};
BIND.marks = () => {
  if (!$('#mx')) return;
  const cur = () => { const c = { exam: $('#mx').value, class: $('#mc').value, section: $('#ms') ? $('#ms').value : '', group: $('#mg') ? $('#mg').value : '' }; MK.setCtx(c); return c; };
  const selectors = () => {
    const cl = $('#mc').value, secs = [...new Set(REG.students().filter(s => s.class === cl).map(s => s.section || ''))].sort(), sc = SCHEME.forClass(cl), c0 = MK.ctx();
    $('#msw').innerHTML = secs.length > 1 ? `<label>Section</label><select id="ms">${opts(secs.map(s => [s, s || '(none)']), secs.includes(c0.section) ? c0.section : secs[0])}</select>` : `<input type="hidden" id="ms" value="${esc(secs[0] || '')}">`;
    $('#mgw').innerHTML = sc && sc.groups.length > 1 ? `<label>Group</label><select id="mg">${opts(sc.groups, sc.groups.includes(c0.group) ? c0.group : sc.groups[0])}</select>` : '';
    ['ms', 'mg'].forEach(id => { const el = $('#' + id); if (el) el.onchange = draw; });
  };
  const draw = async () => {
    const c = cur(); $('#mlist').innerHTML = '<p class="muted">Loading…</p>';
    const d = await MK.load(c), subs = MK.subjects(c, d), st = MK.students(c, d), el = MK.electives(c);
    const done = x => st.filter(s => MK.val(d, c.exam, s.adm_no, x.s) !== '').length;
    $('#mlist').innerHTML = `<p class="muted">${st.length} students${d.offline ? ' · offline: showing what is on this phone' : ''}</p>
      <div class="list">${subs.map((x, k) => { const n = done(x); return `<div class="it tap" onclick="go('mksub',{k:${k}})"><div class="grow"><b>${esc(x.s)}</b><div class="sub">${x.kind === 'grade' ? 'graded A–D' : 'out of ' + x.max}${x.elective ? ' · elective' : ''}</div></div><span class="badge ${n === st.length && n ? 'o' : n ? 'w' : ''}">${n}/${st.length}</span><span class="chev">›</span></div>`; }).join('')}</div>
      ${el.list.length ? `<label>Add an elective / optional subject of this class</label><select id="mel">${opts(el.list.filter(x => !subs.some(s => s.s === x)), '', '— choose to add —')}</select>` : ''}
      <div class="decide"><button class="btn" onclick="go('mresult')">Class result & result cards</button><button class="btn alt wideonly" onclick="go('mkgrid')">Enter as a grid</button></div>`;
    const m = $('#mel'); if (m) m.onchange = () => { if (!m.value) return; const k = 'mkx_' + S.emis + '|' + c.class + '|' + (c.group || ''); const x = LS.get(k, []); x.push([m.value, el.max]); LS.set(k, x); draw(); };
  };
  $('#mx').onchange = draw; $('#mc').onchange = () => { selectors(); draw(); };
  selectors(); draw();
};

/* ---------- one subject: a column of students (phone) ---------- */
V.mksub = arg => `<div class="card"><h2 id="mkt">Marks</h2><p class="muted" id="mkn"></p><div id="mkl"><p class="muted">Loading…</p></div>
  <div class="decide"><button class="btn" id="mksv">Save marks</button></div></div>`;
BIND.mksub = async arg => {
  const c = MK.ctx(), d = await MK.load(c), x = MK.subjects(c, d)[arg.k]; if (!x) return back();
  const st = MK.students(c, d);
  $('#mkt').textContent = x.s; $('#mkn').textContent = `${MK.title(c)} · Class ${c.class}${c.section ? '-' + c.section : ''}${c.group ? ' · ' + c.group : ''} · ${x.kind === 'grade' ? 'grade A, B, C or D' : 'out of ' + x.max + ' · A for absent'}`;
  $('#mkl').innerHTML = `<div class="mkrows">${st.map(s => `<div class="mkr"><span class="mkroll">${esc(s.roll_no || '')}</span><span class="grow"><b>${esc(s.name)}</b><small>${esc(s.adm_no)}</small></span>
    ${x.kind === 'grade' ? `<select data-a="${esc(s.adm_no)}">${opts(['', 'A', 'B', 'C', 'D'], MK.val(d, c.exam, s.adm_no, x.s))}</select>` : `<input data-a="${esc(s.adm_no)}" value="${esc(MK.val(d, c.exam, s.adm_no, x.s))}" inputmode="decimal" autocomplete="off" maxlength="5">`}</div>`).join('')}</div>`;
  const ins = [...$('#mkl').querySelectorAll('[data-a]')];
  ins.forEach((el, k) => { el.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); (ins[k + 1] || $('#mksv')).focus(); } };
    el.oninput = () => { const v = el.value.trim().toUpperCase(); el.classList.toggle('bad', x.kind === 'marks' && v !== '' && v !== 'A' && !(Number(v) >= 0 && Number(v) <= x.max)); }; });
  $('#mksv').onclick = () => {
    const rows = []; let bad = '';
    ins.forEach(el => { const v = el.value.trim().toUpperCase(), old = MK.val(d, c.exam, el.dataset.a, x.s);
      if (x.kind === 'marks' && v && v !== 'A' && !(Number(v) >= 0 && Number(v) <= x.max)) bad = bad || el.closest('.mkr').querySelector('b').textContent;
      if (v !== old) rows.push({ adm_no: el.dataset.a, v }); });
    if (bad) return toast(`${bad}: marks must be 0 to ${x.max}, or A for absent`);
    if (!rows.length) return back();
    const p = { emis: S.emis, exam: c.exam, class: c.class, section: c.section || '', group: c.group || '', subject: x.s, max: x.max, kind: x.kind, rows };
    queue('saveMarks', p, `Marks ${x.s} · Class ${c.class}`);
    rows.forEach(r => MK.put(d, c.exam, p, r.adm_no, r.v)); MK.saveData(c, d); toast('Saved'); back();
  };
};

/* ---------- the whole class as a grid (laptop) ---------- */
V.mkgrid = () => `<div class="card"><h2>Marks · whole class</h2><p class="muted" id="mgn"></p><div class="rwrap"><table class="rtable mkgrid" id="mgt"><tbody><tr><td class="muted">Loading…</td></tr></tbody></table></div>
  <div class="decide"><button class="btn" id="mgsv">Save all marks</button></div></div>`;
BIND.mkgrid = async () => {
  const c = MK.ctx(), d = await MK.load(c), subs = MK.subjects(c, d), st = MK.students(c, d);
  $('#mgn').textContent = `${MK.title(c)} · Class ${c.class}${c.section ? '-' + c.section : ''}${c.group ? ' · ' + c.group : ''} · A for absent; graded areas A–D. Tab or Enter moves to the next box.`;
  $('#mgt').innerHTML = `<thead><tr><th>Roll</th><th>Student</th>${subs.map(x => `<th title="${esc(x.s)}">${esc(x.s.length > 14 ? x.s.slice(0, 13) + '…' : x.s)}<br><small>${x.kind === 'grade' ? 'A–D' : '/' + x.max}</small></th>`).join('')}</tr></thead><tbody>
    ${st.map(s => `<tr><td>${esc(s.roll_no || '')}</td><td><b>${esc(s.name)}</b></td>${subs.map((x, j) => `<td><input data-a="${esc(s.adm_no)}" data-j="${j}" value="${esc(MK.val(d, c.exam, s.adm_no, x.s))}" maxlength="5" autocomplete="off"></td>`).join('')}</tr>`).join('')}</tbody>`;
  const ins = [...$('#mgt').querySelectorAll('input')];
  ins.forEach((el, k) => { el.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); (ins[k + 1] || $('#mgsv')).focus(); } };
    el.oninput = () => { const x = subs[el.dataset.j], v = el.value.trim().toUpperCase(); el.classList.toggle('bad', v !== '' && (x.kind === 'grade' ? !['A', 'B', 'C', 'D'].includes(v) : v !== 'A' && !(Number(v) >= 0 && Number(v) <= x.max))); }; });
  $('#mgsv').onclick = () => {
    if ($('#mgt').querySelector('input.bad')) return toast('Correct the boxes marked in red first');
    let n = 0;
    subs.forEach((x, j) => { const rows = ins.filter(el => Number(el.dataset.j) === j).map(el => ({ adm_no: el.dataset.a, v: el.value.trim().toUpperCase() })).filter(r => r.v !== MK.val(d, c.exam, r.adm_no, x.s));
      if (!rows.length) return; n++;
      const p = { emis: S.emis, exam: c.exam, class: c.class, section: c.section || '', group: c.group || '', subject: x.s, max: x.max, kind: x.kind, rows };
      queue('saveMarks', p, `Marks ${x.s} · Class ${c.class}`); rows.forEach(r => MK.put(d, c.exam, p, r.adm_no, r.v)); });
    MK.saveData(c, d); toast(n ? `Saved ${n} subject${n > 1 ? 's' : ''}` : 'Nothing changed'); back();
  };
};

/* ---------- class result: totals, result, position, decisions; cards ---------- */
V.mresult = () => `<div class="card"><h2>Class result</h2><p class="muted" id="mrn"></p><div class="rwrap"><table class="rtable" id="mrt"><tbody><tr><td class="muted">Loading…</td></tr></tbody></table></div>
  <p class="muted" id="mrh"></p>
  <div class="decide"><button class="btn" id="mrsv">Save decisions and remarks</button><button class="btn alt" id="mrcards">Result cards (PDF)</button><button class="btn alt" id="mrsheet">Class result sheet (PDF)</button></div></div>`;
BIND.mresult = async () => {
  const c = MK.ctx(), d = await MK.load(c), R = MK.results(c, d), annual = /Term-2/.test(c.exam), posOn = CLASSES.indexOf(c.class) >= CLASSES.indexOf(MK.rules().position_from);
  $('#mrn').textContent = `${MK.title(c)} · Class ${c.class}${c.section ? '-' + c.section : ''}${c.group ? ' · ' + c.group : ''} · pass mark ${MK.rules().pass_pct}% in every subject${posOn ? '' : ' · no position below Class ' + MK.rules().position_from}`;
  $('#mrt').innerHTML = `<thead><tr><th>Roll</th><th>Student</th><th class="num">Total</th><th class="num">%</th><th>Grade</th><th>Failed in</th><th>Result</th>${posOn ? '<th class="num">Position</th>' : ''}<th>Days / present</th><th>Remarks</th><th></th></tr></thead><tbody>
    ${R.map((r, k) => `<tr data-k="${k}"><td>${esc(r.s.roll_no || '')}</td><td><b>${esc(r.s.name)}</b>${r.missing ? `<div class="sub warn">${r.missing} subject${r.missing > 1 ? 's' : ''} not entered</div>` : ''}</td>
      <td class="num">${r.max ? fmtN(r.got) + ' / ' + fmtN(r.max) : '–'}</td><td class="num">${r.pct == null ? '–' : r.pct}</td><td>${esc(r.grade)}</td><td>${esc(r.failed.join(', '))}</td>
      <td>${r.trialOk ? `<select data-f="decision">${opts([['', 'Not promoted'], ['Promoted on trial', 'Promoted on trial']], r.decision)}</select>` : `<b class="${/Not|Fail/.test(r.result) ? 'cb' : ''}">${esc(r.result)}</b>`}</td>
      ${posOn ? `<td class="num">${r.position ? MK.ord(r.position) : ''}</td>` : ''}
      <td class="nowrap"><input data-f="att_days" value="${esc(r.att_days)}" size="3" inputmode="numeric" ${r.attFromApp ? 'title="From daily attendance"' : ''}> / <input data-f="att_present" value="${esc(r.att_present)}" size="3" inputmode="decimal"></td>
      <td><input data-f="remark" value="${esc(r.remark)}" maxlength="200"></td><td><button class="btn alt sm" data-card="${k}">Card</button></td></tr>`).join('')}</tbody>`;
  $('#mrh').textContent = annual ? `Promoted on trial: allowed by the head when one or ${MK.rules().trial_max_fails === 2 ? 'two' : MK.rules().trial_max_fails} subjects are failed. Attendance comes from the daily attendance where it was marked; type it where it was not.` : 'Promotion decisions are made on the Term-2 (annual) result.';
  const collect = () => [...$('#mrt').querySelectorAll('tbody tr')].map(tr => { const r = R[tr.dataset.k], o = { adm_no: r.s.adm_no }; tr.querySelectorAll('[data-f]').forEach(el => { o[el.dataset.f] = el.value.trim(); }); if (!('decision' in o)) o.decision = ''; return o; });
  const apply = rows => { rows.forEach(o => { let x = (d.decisions || []).find(z => z.adm_no === o.adm_no); if (!x) { x = { adm_no: o.adm_no }; d.decisions = (d.decisions || []).concat([x]); } Object.assign(x, o); }); MK.saveData(c, d); };
  $('#mrsv').onclick = () => { const rows = collect(); if (rows.some(o => o.att_days && o.att_present && Number(o.att_present) > Number(o.att_days))) return toast('Days present cannot be more than school days');
    queue('saveResultDecisions', { emis: S.emis, exam: c.exam, class: c.class, section: c.section || '', group: c.group || '', rows }, `Result decisions · Class ${c.class}`); apply(rows); toast('Saved'); BIND.mresult(); };
  const fresh = () => { apply(collect()); return MK.results(c, d); };
  $('#mrcards').onclick = () => MKP.cards(c, d, fresh());
  $('#mrsheet').onclick = () => MKP.sheet(c, d, fresh());
  $('#mrt').querySelectorAll('[data-card]').forEach(b => b.onclick = () => { const all = fresh(); MKP.cards(c, d, [all[b.dataset.card]], all); });
};

/* ---------- PDFs: result card (A4 portrait, one student a page) and class result sheet ---------- */
const MKP = {
  head(doc, c, d0, y, title) {
    const ins = d0.inst, W = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80);
    doc.text('Azad Government of the State of Jammu & Kashmir · Elementary & Secondary Education Department', W / 2, y, { align: 'center' }); doc.setTextColor(0);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(PDFK.t(ins.name), W / 2, y + 7, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text(PDFK.t(`EMIS ${S.emis}${ins.halqa ? ' · ' + ins.halqa : ''} · District Muzaffarabad${ins.head_mobile ? ' · ' + ins.head_mobile : ''}`), W / 2, y + 12, { align: 'center' });
    doc.setFillColor(15, 74, 50); doc.rect(14, y + 15, W - 28, 8, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
    doc.text(PDFK.t(title + ' · ' + MK.title(c)), W / 2, y + 20.3, { align: 'center' }); doc.setTextColor(0); doc.setFont('helvetica', 'normal');
    return y + 28;
  },
  async cards(c, d, list, all) {
    try {
      toast('Making the result cards…');
      const doc = await PDFK.doc(false), W = doc.internal.pageSize.getWidth(), d0 = D(), subs = MK.subjects(c, d), ms = subs.filter(x => x.kind === 'marks'), gs = subs.filter(x => x.kind === 'grade');
      const t1 = d.term1 && d.marks.some(m => m.exam === d.term1), annual = /Term-2/.test(c.exam), posOn = CLASSES.indexOf(c.class) >= CLASSES.indexOf(MK.rules().position_from);
      const rows = list.filter(r => r.max);
      if (!rows.length) return toast('No marks entered yet');
      rows.forEach((r, n) => {
        if (n) doc.addPage();
        let y = MKP.head(doc, c, d0, 14, 'RESULT CARD');
        // student
        const s = r.s, L = 14, M = W / 2 + 4;
        const kv = (l, v, x, yy, ur) => { doc.setFontSize(8); doc.setTextColor(100); doc.text(l, x, yy); doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(PDFK.t(v || '–'), x + 26, yy); doc.setFont('helvetica', 'normal'); if (ur) PDFK.ur(doc, ur, W / 2 - 2, yy - 1, 11, 'right'); };
        kv('Student', s.name, L, y, s.name_ur); kv('Class', c.class + (s.section ? '-' + s.section : '') + (c.group ? ' (' + c.group + ')' : ''), M, y);
        kv("Father's name", s.father_name, L, y + 7, s.father_name_ur); kv('Roll No.', s.roll_no, M, y + 7);
        kv('Date of birth', dmy(s.dob), L, y + 14); kv('Admission No.', s.adm_no, M, y + 14);
        y += 21;
        // subjects
        const cols = [{ h: 'Subject', w: 70 }, { h: 'Maximum', w: 20, align: 'right' }].concat(t1 && annual ? [{ h: 'Term-1', w: 22, align: 'right' }, { h: 'Term-2 (Annual)', w: 26, align: 'right' }] : [{ h: 'Marks obtained', w: 30, align: 'right' }], [{ h: '%', w: 18, align: 'right' }, { h: 'Grade', w: 16, align: 'right' }]);
        const tw = cols.reduce((a, x) => a + x.w, 0), k = (W - 28) / tw; cols.forEach(x => { x.w *= k; });
        const body = ms.filter(x => MK.val(d, c.exam, s.adm_no, x.s) !== '' || !x.elective).map(x => { const v = MK.val(d, c.exam, s.adm_no, x.s), p = v === '' || v === 'A' ? null : Math.round(Number(v) * 1000 / x.max) / 10;
          const row = [x.s, x.max]; if (t1 && annual) { const v1 = MK.val(d, d.term1, s.adm_no, x.s); row.push(v1 === 'A' ? 'Absent' : v1 === '' ? '–' : v1); }
          row.push(v === 'A' ? 'Absent' : v === '' ? '–' : v, p == null ? '–' : p, v === 'A' ? 'F' : p == null ? '–' : MK.gradeOf(p)); return row; });
        const ri = t1 && annual ? 3 : 2;
        body.push(['Total', r.max].concat(t1 && annual ? [MKP.t1total(d, s, ms)] : [], [fmtN(r.got), r.pct == null ? '–' : r.pct, r.grade || '–']));
        y = PDFK.table(doc, { x: 14, y, cols, rows: body, fs: 9.5, pad: 1.4, bold: (x, i) => i === body.length - 1, shade: (x, i) => { const g = x[x.length - 1]; return i < body.length - 1 && g === 'F' ? [253, 236, 234] : null; } }) + 4;
        if (gs.length) { doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('Graded areas', 14, y); doc.setFont('helvetica', 'normal'); y += 1.5;
          y = PDFK.table(doc, { x: 14, y, cols: [{ h: 'Area', w: (W - 28) * 0.8 }, { h: 'Grade', w: (W - 28) * 0.2, align: 'right' }], rows: gs.map(x => [x.s, MK.val(d, c.exam, s.adm_no, x.s) || '–']), fs: 9, pad: 1.2 }) + 4; }
        // summary boxes
        const box = (l, v, x, w) => { doc.setDrawColor(150); doc.roundedRect(x, y, w, 15, 1.5, 1.5); doc.setFontSize(7.5); doc.setTextColor(100); doc.text(l, x + w / 2, y + 5, { align: 'center' }); doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(PDFK.t(String(v)), x + w / 2, y + 11.5, { align: 'center' }); doc.setFont('helvetica', 'normal'); };
        const items = [['Marks', `${fmtN(r.got)} / ${fmtN(r.max)}`], ['Percentage', r.pct == null ? '–' : r.pct + '%'], ['Grade', r.grade || '–']].concat(posOn ? [['Position', r.position ? MK.ord(r.position) : '–']] : [], [['Result', r.result || '–']]);
        const bw = (W - 28 - (items.length - 1) * 3) / items.length; items.forEach(([l, v], j) => box(l, v, 14 + j * (bw + 3), bw)); y += 21;
        const pres = r.att_days ? `${r.att_present || 0} of ${r.att_days} days (${Math.round(Number(r.att_present || 0) * 100 / Number(r.att_days))}%)` : '–';
        doc.setFontSize(9); doc.setTextColor(100); doc.text('Attendance', 14, y); doc.setTextColor(0); doc.text(PDFK.t(pres), 40, y);
        doc.setTextColor(100); doc.text('Remarks', 14, y + 7); doc.setTextColor(0); doc.text(doc.splitTextToSize(PDFK.t(r.remark || '______________________________________________________________'), W - 54), 40, y + 7);
        // signatures
        const sy = 262; doc.setDrawColor(90); [['Class teacher', 14], ['Head of institution', 80], ['Parent / guardian', 146]].forEach(([l, x]) => { doc.line(x, sy, x + 50, sy); doc.setFontSize(8.5); doc.text(l, x + 25, sy + 4, { align: 'center' }); });
        doc.setFontSize(8); doc.text(`Date of issue: ${dmy(today())}`, 14, sy + 12);
        doc.setFontSize(6.8); doc.setTextColor(110);
        doc.text(doc.splitTextToSize(PDFK.t(`Grades: A+ 80% and above · A 70–79 · B 60–69 · C 50–59 · D 40–49 · E ${MK.rules().pass_pct}–39 · F below ${MK.rules().pass_pct}% (fail). Pass in every subject needed${annual ? '; promotion on trial with one or two subjects failed is at the head\'s discretion' : ''}. Subjects and maximum marks: DCRD Scheme of Studies 2025. Issued from the District School Data System; seal of the institution applied by hand.`), W - 28), 14, 281); doc.setTextColor(0);
      });
      await PDFK.save(doc, `Result cards ${c.class}${c.section ? '-' + c.section : ''} ${MK.title(c)}${rows.length === 1 ? ' ' + rows[0].s.name : ''}`);
    } catch (e) { toast(e.message || String(e)); }
  },
  t1total(d, s, ms) { let g = 0; ms.forEach(x => { const v = MK.val(d, d.term1, s.adm_no, x.s); if (v !== '' && v !== 'A') g += Number(v); }); return fmtN(g); },
  async sheet(c, d, R) {
    try {
      const rows = R.filter(r => r.max); if (!rows.length) return toast('No marks entered yet');
      const doc = await PDFK.doc(true), W = doc.internal.pageSize.getWidth(), ms = MK.subjects(c, d).filter(x => x.kind === 'marks' && rows.some(r => MK.val(d, c.exam, r.s.adm_no, x.s) !== ''));
      const posOn = CLASSES.indexOf(c.class) >= CLASSES.indexOf(MK.rules().position_from);
      let y = MKP.head(doc, c, D(), 10, 'CLASS RESULT SHEET · Class ' + c.class + (c.section ? '-' + c.section : '') + (c.group ? ' (' + c.group + ')' : ''));
      const head = ['Roll', 'Adm. No.', 'Student'].concat(ms.map(x => x.s + ' /' + x.max), ['Total', '%', 'Grade', 'Result'], posOn ? ['Pos.'] : []);
      const body = rows.map(r => [r.s.roll_no || '', r.s.adm_no, r.s.name].concat(ms.map(x => { const v = MK.val(d, c.exam, r.s.adm_no, x.s); return v === '' ? '–' : v; }), [fmtN(r.got) + '/' + fmtN(r.max), r.pct, r.grade, r.result], posOn ? [r.position || ''] : []));
      const fixed = [9, 14, 42], rest = W - 20 - fixed.reduce((a, b) => a + b, 0), tail = [16, 10, 10, 24].concat(posOn ? [9] : []), sw = Math.max(9, (rest - tail.reduce((a, b) => a + b, 0)) / Math.max(1, ms.length));
      const cols = head.map((h, j) => ({ h, w: j < 3 ? fixed[j] : j < 3 + ms.length ? sw : tail[j - 3 - ms.length], align: j >= 3 && h !== 'Result' && h !== 'Grade' ? 'right' : 'left' }));
      const pass = rows.filter(r => !r.fails).length;
      PDFK.table(doc, { x: 10, y, cols, rows: body, fs: ms.length > 9 ? 6.5 : 7.5, top: 10 });
      PDFK.footer(doc, `${rows.length} students · passed ${pass} (${Math.round(pass * 100 / rows.length)}%) · pass mark ${MK.rules().pass_pct}% in every subject · ${dmy(today())}`);
      await PDFK.save(doc, `Result sheet ${c.class}${c.section ? '-' + c.section : ''} ${MK.title(c)}`);
    } catch (e) { toast(e.message || String(e)); }
  }
};
