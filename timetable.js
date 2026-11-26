/* =====================================================================
   TIMETABLE (v4 part F)
   1. Subjects and teachers: for each class-section the subjects of the
      Scheme of Studies with their weekly periods; the head picks the
      teacher (staff, surplus staff attached here, Community Teachers),
      may plan fewer periods where teachers are short, and may combine
      classes taught together (multigrade).
   2. Weekly timetable: 8 periods (5 on Friday), drafted by the app from
      the assignments and adjusted by swapping two cells.
   3. Teachers: weekly load and each teacher's timetable.
   4. Results by teacher: the latest exam linked to who taught the class.
   ===================================================================== */

const TTD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], TTP = { Mon: 8, Tue: 8, Wed: 8, Thu: 8, Fri: 5, Sat: 8 }, TT_SLOTS = 45;
const TT = {
  get() { const d = D(); return (d && d.tt) || { sections: [], assignments: [], history: [], grid: [] }; },
  set(v) { const d = D(); if (!d) return; d.tt = v; saveD(d); },
  async load(force) {
    if (!navigator.onLine || !S.emis) return;
    const cur = TT.get(); if (!force && (cur.at && Date.now() - cur.at < 10 * 60e3 || cur._dirty)) return;
    try { const j = await api('getTimetable', { emis: S.emis }); if (j.ok) TT.set({ sections: j.sections, assignments: j.assignments, history: j.history, grid: j.grid, at: Date.now() }); } catch (e) { }
  },
  /** teachers who can be given periods */
  teachers() {
    const d = D(); if (!d) return [];
    const emp = d.employees.filter(e => e.record_state !== 'Left' && !(e.attached_to && e.attached_to !== S.emis))
      .map(e => ({ id: e.cnic, name: e.name, title: e.own_designation || e.designation, kind: e.surplus ? 'Surplus' : 'Staff' }));
    const ct = (d.community || []).filter(c => (c.kind || 'Community Teacher') !== 'Contingent paid').map(c => ({ id: 'CT:' + c.id, name: c.name, title: (c.kind || 'Community Teacher') === 'Community Teacher' ? 'Community Teacher' : (c.job || c.kind), kind: 'Community' }));   // contingent paid staff are not given periods
    const teach = /teacher|specialist|instructor|headmaster|principal|qari|mualim|moalim|lecturer/i;
    return emp.filter(t => teach.test(t.title)).concat(ct, emp.filter(t => !teach.test(t.title)));
  },
  tname(id) { const t = TT.teachers().find(x => x.id === id); return t ? t.name : ''; },
  /** class-sections: saved sections, then the register's, then the latest enrolment's */
  sections() {
    const g = {}; const add = (c, s) => { if (CLASSES.includes(c)) g[c + '|' + (s || '')] = g[c + '|' + (s || '')] || { class: c, section: s || '', group: '', electives: [] }; };
    TT.get().sections.forEach(s => { add(s.class, s.section); Object.assign(g[s.class + '|' + (s.section || '')], { group: s.group || '', electives: typeof s.electives === 'string' ? JSON.parse(s.electives || '[]') : (s.electives || []) }); });
    if (typeof REG !== 'undefined') REG.students().forEach(st => add(st.class, st.section || ''));
    const d = D(); if (d) { const lm = d.enrolment.map(r => r.month).sort().pop(); d.enrolment.filter(r => r.month === lm && Number(r.boys || 0) + Number(r.girls || 0) > 0).forEach(r => { if (!Object.keys(g).some(k => k.startsWith(r.class + '|'))) add(r.class, ''); }); }
    return Object.keys(g).sort((a, b) => CLASSES.indexOf(a.split('|')[0]) - CLASSES.indexOf(b.split('|')[0]) || a.localeCompare(b)).map(k => Object.assign({ key: k }, g[k]));
  },
  label(sec) { return sec.class + (sec.section ? '-' + sec.section : ''); },
  keyLabel(k) { const [c, s] = k.split('|'); return c + (s ? '-' + s : ''); },
  /** the subject rows of a section with planned periods and teachers (assignment if saved, scheme otherwise) */
  rows(sec) {
    const sub = SCHEME.timetableSubjects(sec.class, sec.group, sec.electives);
    const as = TT.get().assignments.filter(a => a.class === sec.class && (a.section || '') === sec.section);
    const out = sub.map(s => { const a = as.find(x => x.subject === s.subject);
      return { subject: s.subject, scheme: s.periods, kind: s.kind, periods: a ? Number(a.periods) : s.periods, teacher_id: a ? a.teacher_id : '', combine: a ? a.combine || '' : '' }; });
    as.filter(a => !out.some(o => o.subject === a.subject)).forEach(a => out.push({ subject: a.subject, scheme: 0, kind: 'extra', periods: Number(a.periods), teacher_id: a.teacher_id, combine: a.combine || '' }));
    return out;
  },
  /** periods actually placed in the grid per section+subject */
  placed() { const c = {}; TT.get().grid.forEach(g => { const k = g.class + '|' + (g.section || '') + '|' + g.subject; c[k] = (c[k] || 0) + 1; }); return c; },
  compliance(sec, rows, placed) {
    const sch = rows.reduce((a, r) => a + r.scheme, 0); if (!sch) return null;
    const got = rows.reduce((a, r) => a + Math.min(r.scheme, placed ? (placed[sec.key + '|' + r.subject] || 0) : r.teacher_id ? r.periods : 0), 0);
    return Math.round(got * 100 / sch);
  },
  /** period clock times from the Scheme of Studies (assembly 30 min, attendance 10, periods 35, recess 30 after the 5th) */
  times(day) {
    const i = inst(), date = today(), t = ATTC.timings(date, i.level); const st = ATTC.mins(t.assembly) + 40, out = [];
    let m = st; for (let p = 1; p <= TTP[day]; p++) { if (p === 6) m += 30; out.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')); m += 35; }
    return out;
  },
  short(s) { return ({ 'Islamiat / Religious Education': 'Islamiat', 'Nazra Quran & Tajweed / Ethics': 'Nazra', 'Nazra Quran / Ethics': 'Nazra', 'Understanding the Holy Quran / Ethics': 'Quran',
    'Foundational skills & character building': 'Found. skills', 'Library / additional reading': 'Library', 'Physical training': 'PT', 'Personal growth & responsible citizenship': 'Citizenship',
    'Co-curricular activities': 'Co-curr.', 'Good citizenship & character building': 'Citizenship', 'General Knowledge': 'G.K.', 'Computer Education & IT': 'Computer', 'Computer Education': 'Computer',
    'General Mathematics': 'Gen. Maths', 'General Science': 'Gen. Science', 'Mathematics': 'Maths', 'Pakistan Studies': 'Pak. St.', 'Social Studies': 'Soc. St.', 'ECE activities (class teacher)': 'ECE' })[s] || s; },
  initials(n) { return String(n || '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 3); },
  /** draft a grid from the assignments: each lesson spread over the week, core subjects early, activities late; no teacher in two places */
  draft() {
    const secs = TT.sections(), grid = {}, busy = {}, units = {};
    secs.forEach(sec => TT.rows(sec).forEach(r => { if (!r.periods) return;
      const k = r.combine ? 'C:' + r.combine + ':' + r.subject : sec.key + '|' + r.subject;
      const u = units[k] = units[k] || { secs: [], subject: r.subject, teacher: r.teacher_id, periods: 0, kind: r.kind, combine: r.combine };
      u.secs.push(sec.key); u.periods = Math.max(u.periods, r.periods); if (!u.teacher) u.teacher = r.teacher_id; }));
    const load = {}; Object.values(units).forEach(u => { if (u.teacher) load[u.teacher] = (load[u.teacher] || 0) + u.periods; });
    const list = Object.values(units).sort((a, b) => (load[b.teacher] || 0) - (load[a.teacher] || 0) || b.periods - a.periods || b.secs.length - a.secs.length);
    const free = (u, d, p) => u.secs.every(s => !grid[d + '|' + p + '|' + s]) && (!u.teacher || !busy[d + '|' + p + '|' + u.teacher]);
    const put = (u, d, p) => { u.secs.forEach(s => { const [c, sc] = s.split('|'); grid[d + '|' + p + '|' + s] = { day: d, period: p, class: c, section: sc, subject: u.subject, teacher_id: u.teacher || '', combine: u.secs.length > 1 ? u.combine : '' }; }); if (u.teacher) busy[d + '|' + p + '|' + u.teacher] = 1; };
    const unplaced = [];
    list.forEach(u => {
      let need = u.periods; const perDay = {};
      for (const cap of [1, 2, 3]) {
        if (!need) break;
        let progress = true;
        while (need && progress) {
          progress = false;
          const days = TTD.slice().sort((a, b) => (perDay[a] || 0) - (perDay[b] || 0) || TTD.indexOf(a) - TTD.indexOf(b));
          for (const d of days) {
            if (!need) break; if ((perDay[d] || 0) >= cap) continue;
            const ps = Array.from({ length: TTP[d] }, (_, i) => i + 1); if (u.kind === 'grade') ps.reverse();
            const p = ps.find(p => free(u, d, p)); if (!p) continue;
            put(u, d, p); perDay[d] = (perDay[d] || 0) + 1; need--; progress = true;
          }
        }
      }
      if (need) unplaced.push({ unit: u, left: need });
    });
    return { grid: Object.values(grid), unplaced };
  },
  /** clash check: teacher in two places in one slot (combined lessons excepted) */
  clashes(grid) {
    const at = {}, bad = new Set();
    grid.forEach(g => { if (!g.teacher_id) return; const k = g.day + '|' + g.period + '|' + g.teacher_id, who = g.combine || (g.class + '|' + (g.section || ''));
      if (at[k] && at[k] !== who) bad.add(k); else at[k] = who; });
    return bad;
  },
  save(label) {
    const v = TT.get(); const secs = TT.sections();
    const assignments = []; secs.forEach(sec => TT.rows(sec).forEach(r => { if (r.periods || r.teacher_id) assignments.push({ class: sec.class, section: sec.section, subject: r.subject, teacher_id: r.teacher_id, teacher_name: TT.tname(r.teacher_id), periods: r.periods, combine: r.combine }); }));
    const pl = TT.placed(), cs = secs.map(sec => TT.compliance(sec, TT.rows(sec), v.grid.length ? pl : null)).filter(x => x != null);
    queue('saveTimetable', { emis: S.emis, date: today(), compliance: cs.length ? Math.round(cs.reduce((a, b) => a + b, 0) / cs.length) : null, sections: secs.map(s => ({ class: s.class, section: s.section, group: s.group, electives: s.electives })), assignments, grid: v.grid }, label || 'Timetable');
    v._dirty = false; TT.set(v);
  }
};

/* ---------- hub ---------- */
V.timetable = arg => `<div class="card noprint"><div class="db-sh rhead"><h3>Timetable</h3><span class="rbtn"><button class="btn alt" id="ttpr">Print</button></span></div>
  <div class="seg" id="ttt">${[['assign', 'Subjects and teachers'], ['grid', 'Weekly timetable'], ['teachers', 'Teachers'], ['results', 'Results by teacher']].map(([k, l]) => `<button data-t="${k}" class="${(arg && arg.tab || 'assign') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
  <p class="muted" id="ttnote"></p></div><div id="ttb"></div>`;
BIND.timetable = arg => {
  let tab = (arg && arg.tab) || LS.get('tt_tab', 'assign'), secKey = LS.get('tt_sec_' + S.emis, '');
  const draw = () => {
    document.querySelectorAll('#ttt button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    const secs = TT.sections();
    if (!secs.length) { $('#ttb').innerHTML = `<div class="card"><p class="muted">No classes yet. Enter enrolment or register the students first, or add a class here.</p>${addSecForm()}</div>`; bindAdd(); return; }
    if (!secs.some(s => s.key === secKey)) secKey = secs[0].key;
    const gone = TT.get().assignments.filter(a => a.teacher_id && !TT.teachers().some(t => t.id === a.teacher_id));
    $('#ttnote').innerHTML = (TT.get()._dirty ? '<b>Changes not saved yet.</b> ' : '') + (gone.length ? `<span class="db-no">${gone.length} lesson${gone.length > 1 ? 's' : ''} of teachers who have left: to be reassigned.</span>` : '');
    ({ assign: drawAssign, grid: drawGrid, teachers: drawTeachers, results: drawResults })[tab](secs);
  };
  const chips = secs => `<div class="seg" id="tts">${secs.map(s => `<button data-k="${esc(s.key)}" class="${s.key === secKey ? 'on' : ''}">${esc(TT.label(s))}</button>`).join('')}<button data-k="+">+ Section</button></div>`;
  const bindChips = () => document.querySelectorAll('#tts button').forEach(b => b.onclick = () => { if (b.dataset.k === '+') { $('#addsec').hidden = false; return; } secKey = b.dataset.k; LS.set('tt_sec_' + S.emis, secKey); draw(); });
  const addSecForm = () => `<div id="addsec" ${TT.sections().length ? 'hidden' : ''}><div class="row"><div><label>Class</label><select id="asc">${opts(CLASSES, '', '—')}</select></div><div><label>Section (optional)</label><input id="ass" maxlength="3" placeholder="A"></div><div><label>&nbsp;</label><button class="btn alt" id="asb">Add</button></div></div></div>`;
  const bindAdd = () => { const b = $('#asb'); if (b) b.onclick = () => { const c = $('#asc').value, sc = $('#ass').value.trim().toUpperCase(); if (!c) return toast('Choose the class');
    const v = TT.get(); if (!v.sections.some(s => s.class === c && (s.section || '') === sc)) v.sections.push({ class: c, section: sc, group: '', electives: [] }); v._dirty = true; TT.set(v); secKey = c + '|' + sc; draw(); }; };

  /* ---- 1. subjects and teachers ---- */
  const drawAssign = secs => {
    const sec = secs.find(s => s.key === secKey), rows = TT.rows(sec), teachers = TT.teachers();
    const f = SCHEME.forClass(sec.class), ne = SCHEME.electiveCount(sec.class, sec.group || (f && f.groups[0]));
    const g = f ? f.get(sec.group || f.groups[0]) : null;
    const planned = rows.reduce((a, r) => a + (r.periods || 0), 0), sch = rows.reduce((a, r) => a + r.scheme, 0), comp = TT.compliance(sec, rows);
    const others = secs.filter(s => s.key !== sec.key);
    $('#ttb').innerHTML = `<div class="card">${chips(secs)}${addSecForm()}
      ${f && f.groups.length > 1 ? `<div class="row"><div><label>Subject group</label><select id="tgrp">${opts(f.groups, sec.group || f.groups[0])}</select></div></div>` : ''}
      ${ne && g && g.electives.length ? `<label>Elective subject${ne > 1 ? 's' : ''} taught (choose ${ne})</label><div class="chips" id="tel">${g.electives.map(e => `<button type="button" class="${sec.electives.includes(e) ? 'on' : ''}" data-v="${esc(e)}">${esc(e)}</button>`).join('')}</div>` : ''}
      <p class="muted">Scheme of Studies: <b>${sch}</b> periods a week · planned <b>${planned}</b> of ${TT_SLOTS} slots${comp != null ? ` · teachers assigned for <b>${comp}%</b> of the scheme` : ''}${planned > TT_SLOTS ? ' · <span class="db-no">more periods than the week has</span>' : ''}</p></div>
      <div class="card"><div class="ttrows">${rows.map((r, k) => { const gone = r.teacher_id && !teachers.some(t => t.id === r.teacher_id);
        return `<div class="ttr${r.periods < r.scheme ? ' short' : ''}" data-k="${k}"><div class="ttsub"><b>${esc(r.subject)}</b><span>scheme ${r.scheme || '–'}${r.kind === 'grade' ? ' · graded' : ''}</span></div>
          <input class="ttper" type="number" min="0" max="45" inputmode="numeric" value="${r.periods}" title="Periods a week">
          <select class="ttt">${opts(teachers.map(t => [t.id, t.name + ' · ' + t.title + (t.kind === 'Community' ? ' (community)' : t.kind === 'Surplus' ? ' (surplus)' : '')]), r.teacher_id, gone ? '— left: reassign —' : '— not assigned —')}</select>
          <select class="ttc" title="Taught together with">${opts([['', 'Taught alone']].concat(others.map(o => [o.key, 'With ' + TT.label(o)])), (r.combine || '').split(',').find(x => x && x !== sec.key) || '')}</select></div>`; }).join('')}</div>
      <div class="decide"><button class="btn" id="tsv">Save subjects and teachers</button></div></div>`;
    bindChips(); bindAdd();
    const v = TT.get();
    const setSec = (patch) => { let s = v.sections.find(x => x.class === sec.class && (x.section || '') === sec.section); if (!s) { s = { class: sec.class, section: sec.section, group: '', electives: [] }; v.sections.push(s); }
      Object.assign(s, patch); v._dirty = true; TT.set(v); draw(); };
    if ($('#tgrp')) $('#tgrp').onchange = e => setSec({ group: e.target.value, electives: [] });
    if ($('#tel')) $('#tel').querySelectorAll('button').forEach(b => b.onclick = () => { const cur = sec.electives.slice(); const i = cur.indexOf(b.dataset.v);
      if (i >= 0) cur.splice(i, 1); else { if (cur.length >= ne) return toast('Choose ' + ne + ' only'); cur.push(b.dataset.v); } setSec({ electives: cur }); });
    // edits go to the assignment list at once (saved with the button)
    const upd = (r, patch) => {
      const a = v.assignments.find(x => x.class === sec.class && (x.section || '') === sec.section && x.subject === r.subject);
      const base = a || { class: sec.class, section: sec.section, subject: r.subject, teacher_id: r.teacher_id, periods: r.periods, combine: r.combine };
      Object.assign(base, patch); if (!a) v.assignments.push(base); v._dirty = true; TT.set(v); return base;
    };
    document.querySelectorAll('.ttr').forEach(el => { const r = rows[Number(el.dataset.k)];
      el.querySelector('.ttper').onchange = e => { upd(r, { periods: Math.max(0, Math.min(45, Number(e.target.value) || 0)) }); draw(); };
      el.querySelector('.ttt').onchange = e => { const a = upd(r, { teacher_id: e.target.value, teacher_name: TT.tname(e.target.value) });
        if (a.combine) v.assignments.filter(x => x.combine === a.combine && x.subject === a.subject).forEach(x => { x.teacher_id = a.teacher_id; x.teacher_name = a.teacher_name; }); TT.set(v); draw(); };
      el.querySelector('.ttc').onchange = e => { const other = e.target.value;
        // leaving a combination: clear it everywhere for this subject
        if (r.combine) v.assignments.filter(x => x.combine === r.combine && x.subject === r.subject).forEach(x => { x.combine = ''; });
        if (other) { const code = [sec.key, other].sort().join(','), [oc, os] = other.split('|');
          upd(r, { combine: code });
          let b = v.assignments.find(x => x.class === oc && (x.section || '') === os && x.subject === r.subject);
          if (!b) { b = { class: oc, section: os, subject: r.subject, periods: r.periods, teacher_id: '', combine: '' }; v.assignments.push(b); }
          b.combine = code; if (r.teacher_id) { b.teacher_id = r.teacher_id; b.teacher_name = TT.tname(r.teacher_id); } b.periods = Math.max(Number(b.periods || 0), r.periods); }
        else upd(r, { combine: '' });
        v._dirty = true; TT.set(v); draw(); };
    });
    $('#tsv').onclick = () => { TT.save('Timetable: subjects and teachers'); toast('Saved'); draw(); };
  };

  /* ---- 2. weekly grid ---- */
  let pick = null;
  const drawGrid = secs => {
    const sec = secs.find(s => s.key === secKey), v = TT.get(), cell = {}; v.grid.filter(g => g.class === sec.class && (g.section || '') === sec.section).forEach(g => { cell[g.day + '|' + g.period] = g; });
    const bad = TT.clashes(v.grid), rows = TT.rows(sec), placed = TT.placed(), comp = TT.compliance(sec, rows, placed), times = TT.times('Mon');
    const left = rows.filter(r => r.periods > (placed[sec.key + '|' + r.subject] || 0)).map(r => `${esc(TT.short(r.subject))} ${r.periods - (placed[sec.key + '|' + r.subject] || 0)}`);
    $('#ttb').innerHTML = `<div class="card">${chips(secs)}${addSecForm()}
      <p class="muted">${v.grid.length ? `Placed <b>${Object.keys(cell).length}</b> of ${TT_SLOTS} periods${comp != null ? ` · Scheme of Studies followed <b>${comp}%</b>` : ''}${left.length ? ` · still to place: ${left.join(', ')}` : ''}` : 'No timetable yet. Draft one from the subjects and teachers, then adjust.'}<br>Tap a period, then another to swap them. Tap the same period twice to change or clear it.</p>
      <div class="tbar"><button class="btn alt" id="tdr">${v.grid.length ? 'Draft again from assignments' : 'Draft timetable'}</button><button class="btn" id="tgs">Save timetable</button></div></div>
      <div class="card"><div class="rwrap"><table class="ttg"><thead><tr><th></th>${TTD.map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>
      ${[1, 2, 3, 4, 5, 6, 7, 8].map(p => `${p === 6 ? `<tr class="rec"><td colspan="7">Recess</td></tr>` : ''}<tr><th>${p}<small>${times[p - 1] || ''}</small></th>${TTD.map(d => { if (p > TTP[d]) return '<td class="na"></td>';
        const g = cell[d + '|' + p], cl = g && g.teacher_id && bad.has(d + '|' + p + '|' + g.teacher_id), on = pick === d + '|' + p;
        return `<td class="tc${g ? '' : ' empty'}${cl ? ' clash' : ''}${on ? ' pick' : ''}${g && g.combine ? ' comb' : ''}" data-s="${d}|${p}">${g ? `<b>${esc(TT.short(g.subject))}</b><small>${esc(TT.initials(TT.tname(g.teacher_id)) || '—')}${g.combine ? ' · ' + esc(g.combine.split(',').filter(x => x !== sec.key).map(TT.keyLabel).join('+')) : ''}</small>` : ''}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div><div id="tced"></div></div>`;
    bindChips(); bindAdd();
    $('#tdr').onclick = () => { if (v.grid.length && !confirm('Replace the whole timetable with a new draft?')) return; const r = TT.draft(); v.grid = r.grid; v._dirty = true; TT.set(v);
      toast(r.unplaced.length ? `Drafted. ${r.unplaced.reduce((a, u) => a + u.left, 0)} periods could not be placed (teacher or slot shortage).` : 'Drafted. Check and adjust, then save.'); draw(); };
    $('#tgs').onclick = () => { if (TT.clashes(v.grid).size) return toast('Some teachers are in two classes at once (shown in red). Fix them first.'); TT.save('Timetable'); toast('Saved'); draw(); };
    document.querySelectorAll('.ttg td.tc').forEach(td => td.onclick = () => {
      const s = td.dataset.s;
      if (!pick) { pick = s; draw(); return; }
      if (pick === s) { pick = null; editCell(sec, s); return; }
      swap(sec, pick, s); pick = null; draw();
    });
  };
  const sectionsOf = g => g && g.combine ? g.combine.split(',') : null;
  const swap = (sec, a, b) => {
    const v = TT.get(); const [da, pa] = a.split('|'), [db, pb] = b.split('|');
    const find = (k, d, p) => v.grid.find(g => g.class + '|' + (g.section || '') === k && g.day === d && String(g.period) === String(p));
    const ga = find(sec.key, da, pa), gb = find(sec.key, db, pb);
    const keys = new Set([sec.key].concat(sectionsOf(ga) || [], sectionsOf(gb) || []));     // combined lessons move in every class of the combination
    const moves = [];
    keys.forEach(k => { const x = find(k, da, pa), y = find(k, db, pb); if (x) moves.push([x, db, pb]); if (y) moves.push([y, da, pa]); });
    const before = JSON.stringify(v.grid);
    moves.forEach(([g, d, p]) => { g.day = d; g.period = Number(p); });
    if (TT.clashes(v.grid).size > TT.clashes(JSON.parse(before)).size) { v.grid = JSON.parse(before); TT.set(v); return toast('That move puts a teacher in two classes at once.'); }
    v._dirty = true; TT.set(v);
  };
  const editCell = (sec, s) => {
    const [d, p] = s.split('|'), v = TT.get(), rows = TT.rows(sec).filter(r => r.periods), cur = v.grid.find(g => g.class === sec.class && (g.section || '') === sec.section && g.day === d && String(g.period) === p);
    $('#tced').innerHTML = `<div class="tced"><b>${d}, period ${p}</b><select id="tcs">${opts(rows.map(r => [r.subject, r.subject + (r.teacher_id ? ' · ' + TT.tname(r.teacher_id) : '')]), cur ? cur.subject : '', '— free period —')}</select><button class="btn" id="tcok">Set</button></div>`;
    $('#tcok').onclick = () => { const subj = $('#tcs').value; v.grid = v.grid.filter(g => g !== cur);
      if (subj) { const r = rows.find(x => x.subject === subj); v.grid.push({ day: d, period: Number(p), class: sec.class, section: sec.section, subject: subj, teacher_id: r.teacher_id || '', combine: '' }); }
      v._dirty = true; TT.set(v); draw(); };
  };

  /* ---- 3. teachers ---- */
  const drawTeachers = () => {
    const v = TT.get(), ts = TT.teachers(), times = TT.times('Mon');
    const load = {}, placedN = {};
    TT.sections().forEach(sec => TT.rows(sec).forEach(r => { if (r.teacher_id) { const k = r.combine ? r.teacher_id + '|' + r.combine + '|' + r.subject : r.teacher_id + '|' + sec.key + '|' + r.subject; (load[r.teacher_id] = load[r.teacher_id] || {})[k] = r.periods; } }));
    const seen = {}; v.grid.forEach(g => { if (!g.teacher_id) return; const k = g.day + '|' + g.period + '|' + g.teacher_id; if (seen[k]) return; seen[k] = 1; placedN[g.teacher_id] = (placedN[g.teacher_id] || 0) + 1; });
    const sel = LS.get('tt_t_' + S.emis, ts[0] ? ts[0].id : '');
    const mine = v.grid.filter(g => g.teacher_id === sel), at = {}; mine.forEach(g => { const k = g.day + '|' + g.period; at[k] = at[k] ? at[k] + '+' + TT.label(g) : TT.label(g) + ' ' + TT.short(g.subject); });
    $('#ttb').innerHTML = `<div class="card"><table class="ptab"><tr><th>Teacher</th><th class="num">Periods assigned</th><th class="num">In timetable</th></tr>
      ${ts.map(t => { const a = Object.values(load[t.id] || {}).reduce((x, y) => x + y, 0); return `<tr class="tap${t.id === sel ? ' tot' : ''}" data-t="${esc(t.id)}"><td>${esc(t.name)}<small class="muted"> · ${esc(t.title)}</small></td><td class="num">${a}</td><td class="num">${placedN[t.id] || 0}</td></tr>`; }).join('')}</table></div>
      ${sel ? `<div class="card"><h3>${esc(TT.tname(sel))}</h3><div class="rwrap"><table class="ttg"><thead><tr><th></th>${TTD.map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>
        ${[1, 2, 3, 4, 5, 6, 7, 8].map(p => `<tr><th>${p}<small>${times[p - 1] || ''}</small></th>${TTD.map(d => p > TTP[d] ? '<td class="na"></td>' : `<td class="tc${at[d + '|' + p] ? '' : ' empty'}">${at[d + '|' + p] ? `<b>${esc(at[d + '|' + p])}</b>` : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>` : ''}`;
    document.querySelectorAll('tr[data-t]').forEach(tr => tr.onclick = () => { LS.set('tt_t_' + S.emis, tr.dataset.t); draw(); });
  };

  /* ---- 4. results by teacher ---- */
  const examMonth = x => { let m = String(x).match(/(\d{4})-(\d{2})$/); if (m) return m[1] + '-' + m[2]; m = String(x).match(/^(\d{4})-\d{2} Term-(\d)/); if (m) return m[2] === '1' ? m[1] + '-09' : (Number(m[1]) + 1) + '-02'; return '0000-00'; };
  const drawResults = () => {
    const d = D(), res = (d.results || []).filter(r => r.subject !== 'OVERALL'); const v = TT.get(), all = v.assignments.concat(v.history || []);
    if (!res.length) { $('#ttb').innerHTML = '<div class="card"><p class="muted">No results entered yet.</p></div>'; return; }
    const exams = [...new Set(res.map(r => r.exam))].sort((a, b) => examMonth(a) < examMonth(b) ? 1 : -1);
    const ex = LS.get('tt_ex_' + S.emis, exams[0]); const e = exams.includes(ex) ? ex : exams[0], when = examMonth(e) + '-28';
    const by = {};
    res.filter(r => r.exam === e).forEach(r => {
      const who = all.filter(a => a.class === r.class && a.subject === r.subject && a.teacher_id && (a.from_date || '0000') <= when && (!a.to_date || a.to_date >= when));
      const names = [...new Set(who.map(a => a.teacher_name || TT.tname(a.teacher_id)))]; const key = names.join(', ') || 'Not assigned';
      (by[key] = by[key] || []).push(r);
    });
    $('#ttb').innerHTML = `<div class="card"><label>Exam</label><select id="tre">${opts(exams, e)}</select><p class="muted">Each subject's result is linked to the teacher who taught that class when the exam was held.</p></div>
      ${Object.keys(by).sort().map(t => { const list = by[t], app = list.reduce((a, r) => a + Number(r.appeared || 0), 0), pass = list.reduce((a, r) => a + Number(r.passed || 0), 0);
        return `<div class="card"><div class="db-sh rhead"><h3>${esc(t)}</h3><span class="pill ${app && pass / app < .5 ? 'bad' : 'ok'}">${app ? Math.round(pass * 100 / app) : '–'}% passed</span></div>
          <table class="ptab"><tr><th>Class</th><th>Subject</th><th class="num">Appeared</th><th class="num">Passed</th><th class="num">A+ / A</th><th class="num">F</th></tr>
          ${list.map(r => `<tr><td>${esc(r.class)}${r.group ? ' ' + esc(r.group) : ''}</td><td>${esc(r.subject)}</td><td class="num">${r.appeared}</td><td class="num">${r.passed}</td><td class="num">${Number(r.aplus || 0) + Number(r.a || 0)}</td><td class="num">${r.f}</td></tr>`).join('')}</table></div>`; }).join('')}`;
    $('#tre').onchange = ev => { LS.set('tt_ex_' + S.emis, ev.target.value); draw(); };
  };

  document.querySelectorAll('#ttt button').forEach(b => b.onclick = () => { tab = b.dataset.t; LS.set('tt_tab', tab); pick = null; draw(); });
  $('#ttpr').onclick = () => go('ttprint', { kind: tab === 'teachers' ? 'teachers' : 'classes' });
  draw();
  TT.load(false).then(() => { if (S.view === 'timetable') draw(); });
  if (typeof REG !== 'undefined') REG.refresh(false).then(() => { if (S.view === 'timetable') draw(); });
};

/* ---------- printing: every class, or every teacher, one block each ---------- */
V.ttprint = arg => {
  const v = TT.get(), i = inst(), times = TT.times('Mon');
  const table = (title, at) => `<section class="ttpage"><h3>${esc(i.name)} · ${esc(title)}</h3><table class="ttg"><thead><tr><th></th>${TTD.map(d => `<th>${d}</th>`).join('')}</tr></thead><tbody>
    ${[1, 2, 3, 4, 5, 6, 7, 8].map(p => `${p === 6 ? `<tr class="rec"><td colspan="7">Recess</td></tr>` : ''}<tr><th>${p}<small>${times[p - 1]}</small></th>${TTD.map(d => p > TTP[d] ? '<td class="na"></td>' : `<td class="tc">${at(d, p) || ''}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`;
  const blocks = arg.kind === 'teachers'
    ? TT.teachers().filter(t => v.grid.some(g => g.teacher_id === t.id)).map(t => table(t.name + ' (' + t.title + ')', (d, p) => [...new Set(v.grid.filter(g => g.teacher_id === t.id && g.day === d && Number(g.period) === p).map(g => TT.label(g) + ' ' + TT.short(g.subject)))].join(' + ')))
    : TT.sections().map(sec => table('Class ' + TT.label(sec), (d, p) => { const g = v.grid.find(x => x.class === sec.class && (x.section || '') === sec.section && x.day === d && Number(x.period) === p); return g ? `<b>${esc(TT.short(g.subject))}</b><small>${esc(TT.tname(g.teacher_id))}</small>` : ''; }));
  return `<div class="card noprint"><button class="btn" onclick="window.print()">Print</button> <span class="muted">${arg.kind === 'teachers' ? 'Each teacher\'s timetable' : 'Each class timetable'}, A4 landscape</span></div><div class="ttprint">${blocks.join('') || '<p class="muted">No timetable yet.</p>'}</div>`;
};
BIND.ttprint = () => { };
