/* =====================================================================
   ATTENDANCE (v4 part E)
   Teachers: arrival and departure (both mandatory), marked by the head
   or a designated official; late arrival / early departure measured
   against the Scheme of Studies timings; marking after 11:00 is a late
   entry. Students: by class, everyone present unless tapped.
   Works offline: entries wait in the outbox with the phone's time.
   ===================================================================== */

const ATTC = {
  m() { return (S.boot && S.boot.meta && S.boot.meta.att) || { start: '2026-12-01', cutoff: '11:00', summer: { from: '04-16', to: '10-15', assembly: '08:00', close: '14:00', fri: '11:45', friHSS: '12:00' }, winter: { assembly: '08:30', close: '14:30', fri: '12:15', friHSS: '12:30' }, vacations: [{ from: '06-12', to: '08-13', name: 'Summer vacation' }, { from: '12-26', to: '01-02', name: 'Winter vacation' }], studentVacations: [{ from: '03-01', to: '03-10', name: 'Spring break (students)' }], maxBackDays: 7 }; },
  leaveTypes() { return (S.boot && S.boot.meta && S.boot.meta.leaveTypes) || ['Casual leave', 'Short leave', 'Earned leave', 'Medical leave', 'Study leave', 'Other leave']; },
  inRange(md, r) { return r.from <= r.to ? md >= r.from && md <= r.to : md >= r.from || md <= r.to; },
  timings(date, level) {
    const a = ATTC.m(), md = date.slice(5), t = ATTC.inRange(md, a.summer) ? a.summer : a.winter, fri = new Date(date + 'T12:00:00Z').getUTCDay() === 5;
    return { assembly: t.assembly, close: fri ? (level === 'Higher Secondary' ? t.friHSS : t.fri) : t.close, friday: fri };
  },
  closed(date, students) {
    if (new Date(date + 'T12:00:00Z').getUTCDay() === 0) return 'Sunday';
    const a = ATTC.m(), md = date.slice(5); const v = a.vacations.concat(students ? a.studentVacations : []).find(r => ATTC.inRange(md, r)); return v ? v.name : '';
  },
  now() { const d = new Date(); return today() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); },
  hhmm() { return ATTC.now().slice(11); },
  mins(t) { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; },
  /* local copy of a month: {teachers:[], students:[], daily:[]} kept beside the institution record */
  month(m) { const d = D(); return d && d.att && d.att[m] ? d.att[m] : { teachers: [], students: [], daily: [] }; },
  setMonth(m, v) { const d = D(); if (!d) return; d.att = d.att || {}; d.att[m] = v; const keys = Object.keys(d.att).sort(); while (keys.length > 3) delete d.att[keys.shift()]; saveD(d); },
  async load(m, force) {
    if (!navigator.onLine || !S.emis) return;
    const cur = ATTC.month(m); if (!force && cur.at && Date.now() - cur.at < 5 * 60e3) return;
    try { const j = await api('getAttendance', { emis: S.emis, month: m }); if (j.ok) {
      // keep entries still waiting in the outbox
      const keep = (list, key) => (cur[key] || []).filter(r => r._pending && !list.some(x => x.key === r.key));
      ATTC.setMonth(m, { teachers: j.teachers.concat(keep(j.teachers, 'teachers')), students: j.students.concat(keep(j.students, 'students')), daily: j.daily, at: Date.now() }); } } catch (e) { }
  },
  put(m, kind, row) { const v = ATTC.month(m); v[kind] = (v[kind] || []).filter(r => r.key !== row.key).concat([Object.assign({ _pending: 1 }, row)]); ATTC.setMonth(m, v); },
  /** marked here: own staff not attached elsewhere, surplus staff attached here, Community Teachers */
  staff() { const d = D(); if (!d) return [];
    const emp = d.employees.filter(e => e.record_state !== 'Left' && !(e.attached_to && e.attached_to !== S.emis)).sort((a, b) => Number(b.post_bps || 0) - Number(a.post_bps || 0) || a.name.localeCompare(b.name));
    return emp.concat((d.community || []).filter(c => c.status !== 'Returned' && !String(c.id).startsWith('tmp')).map(c => ({ cnic: 'CT:' + c.id, name: c.name, own_designation: 'Community Teacher', designation: 'Community Teacher', post_bps: 0 }))); },
  classes() { const g = {}; REG.students().forEach(s => { const k = s.class + '|' + (s.section || ''); (g[k] = g[k] || []).push(s); });
    return Object.keys(g).sort((a, b) => CLASSES.indexOf(a.split('|')[0]) - CLASSES.indexOf(b.split('|')[0]) || a.localeCompare(b)).map(k => ({ key: k, cls: k.split('|')[0], sec: k.split('|')[1], kids: g[k] })); }
};

/* ---------- hub ---------- */
V.attendance = arg => {
  const d = D(); if (!d) return noData();
  const date = (arg && arg.date) || today();
  return `<div class="card"><div class="db-sh rhead"><h3>Attendance</h3></div>
    <div class="row"><div><label>Date</label><input type="date" id="ad" value="${date}"></div><div class="adq"><button class="chip" data-d="0">Today</button><button class="chip" data-d="1">Yesterday</button></div></div>
    <div id="ainfo"></div></div><div id="abody"></div>`;
};
BIND.attendance = arg => {
  const draw = () => {
    const date = $('#ad').value || today(), m = date.slice(0, 7), i = inst(), a = ATTC.m();
    const closedT = ATTC.closed(date), closedS = ATTC.closed(date, true);
    const mo = ATTC.month(m), day = (mo.daily || []).find(r => r.date === date) || {};
    const tm = ATTC.timings(date, i.level);
    const staff = ATTC.staff(), tr = (mo.teachers || []).filter(r => r.date === date && r.status);
    const pres = tr.filter(r => r.status === 'Present'), late = pres.filter(r => Number(r.late_min) > 0).length, nodep = pres.filter(r => !r.departure).length;
    $('#ainfo').innerHTML = closedT ? `<div class="msg">${esc(closedT)}: no attendance is due.</div>`
      : day.closed ? `<div class="msg">Marked as closed: ${esc(day.closed)}. <a href="#" id="reopen">Undo</a></div>`
      : `<p class="muted">Assembly <b>${tm.assembly}</b> · closing <b>${tm.close}</b>${tm.friday ? ' (Friday)' : ''} · mark arrivals by <b>${a.cutoff}</b>${date < a.start ? `<br>Teacher attendance is required from ${dmy(a.start)}; marking before that is practice.` : ''}</p>`;
    const working = !closedT && !day.closed;
    const cls = ATTC.classes(), sr = (mo.students || []).filter(r => r.date === date);
    $('#abody').innerHTML = !working ? `<div class="card"><button class="btn alt" onclick="go('attmonth',{month:'${m}'})">Monthly register</button></div>` : `
      <div class="card"><div class="list">
        <div class="it tap" onclick="go('tatt',{date:'${date}'})"><div class="grow"><b>Teachers and staff</b>
          <div class="sub">${tr.length ? `${tr.length} of ${staff.length} marked · ${pres.length} present${late ? ` · <span class="db-no">${late} late</span>` : ''}${nodep ? ` · ${nodep} departure${nodep > 1 ? 's' : ''} to record` : pres.length ? ' · departures recorded' : ''}` : `${staff.length} to mark`}</div></div>
          <span class="badge ${tr.length === staff.length && !nodep ? 'o' : 'w'}">${tr.length === staff.length && !nodep ? 'Done' : tr.length ? 'In progress' : 'Not marked'}</span><span class="chev">›</span></div>
      </div></div>
      <div class="card"><h3>Students</h3>${closedS ? `<p class="muted">${esc(closedS)}: no student attendance.</p>` : !cls.length ? `<p class="muted">Register the students first; attendance is marked from the register.</p><button class="btn alt" onclick="go('students')">Open Students</button>`
        : `<div class="list">${cls.map(c => { const r = sr.find(x => x.class === c.cls && (x.section || '') === c.sec);
          return `<div class="it tap" onclick="go('satt',{date:'${date}',cls:'${esc(c.key)}'})"><div class="grow"><b>Class ${esc(c.cls)}${c.sec ? '-' + esc(c.sec) : ''}</b><div class="sub">${r ? `${r.present} present · ${r.absent} absent${Number(r.leave) ? ' · ' + r.leave + ' on leave' : ''}` : c.kids.length + ' students'}</div></div>
            <span class="badge ${r ? 'o' : 'w'}">${r ? 'Done' : 'Not marked'}</span><span class="chev">›</span></div>`; }).join('')}</div>`}</div>
      <div class="card"><div class="list">
        <div class="it tap" onclick="go('attmonth',{month:'${m}'})"><div class="grow"><b>Monthly register</b><div class="sub">${monthLabel(m)}: every day for every teacher</div></div><span class="chev">›</span></div>
        <div class="it tap" id="aclose"><div class="grow"><b>School closed on this day</b><div class="sub">Gazetted or local holiday, emergency</div></div><span class="chev">›</span></div>
      </div></div>`;
    const rc = $('#aclose'); if (rc) rc.onclick = () => { const reason = prompt('Why was the school closed? (e.g. gazetted holiday, local holiday, snow, emergency)'); if (!reason) return;
      queue('markClosed', { emis: S.emis, date, reason }, 'Closed ' + dmy(date)); const v = ATTC.month(m); v.daily = (v.daily || []).filter(r => r.date !== date).concat([{ date, closed: reason }]); ATTC.setMonth(m, v); draw(); };
    const ro = $('#reopen'); if (ro) ro.onclick = e => { e.preventDefault(); queue('markClosed', { emis: S.emis, date, reason: '' }, 'Reopened ' + dmy(date)); const v = ATTC.month(m); v.daily = (v.daily || []).filter(r => r.date !== date); ATTC.setMonth(m, v); draw(); };
  };
  document.querySelectorAll('.adq .chip').forEach(b => b.onclick = () => { const d = new Date(); d.setDate(d.getDate() - Number(b.dataset.d)); const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    $('#ad').value = iso; const v = $('#ad').nextElementSibling; if (v && v.classList.contains('dtin')) { v.value = dmy(iso); v.dispatchEvent(new Event('input')); } S.arg = { date: iso }; reload(); });
  $('#ad').addEventListener('change', () => { if ($('#ad').value) { S.arg = { date: $('#ad').value }; reload(); } });
  const reload = () => { draw(); ATTC.load($('#ad').value.slice(0, 7), true).then(() => { if (S.view === 'attendance') draw(); }); };
  REG.refresh(false).then(() => { if (S.view === 'attendance') draw(); });
  reload();
};

/* ---------- teachers ---------- */
V.tatt = arg => {
  const i = inst(), tm = ATTC.timings(arg.date, i.level);
  return `<div class="card noprint"><h2>Teachers and staff</h2><p class="muted">${DT.words(arg.date)} · assembly ${tm.assembly} · closing ${tm.close}<br><b>P</b> present · <b>A</b> absent without leave · <b>L</b> leave · <b>D</b> on duty elsewhere</p>
    <div class="tbar"><button class="btn alt" id="allin">All unmarked present, arrived now</button><button class="btn alt" id="allout">All present left now</button></div></div>
    <div id="tl"></div>
    <div class="decide"><button class="btn" id="tsave">Save attendance</button></div>`;
};
BIND.tatt = arg => {
  const date = arg.date, m = date.slice(0, 7), i = inst(), tm = ATTC.timings(date, i.level);
  const saved = {}; (ATTC.month(m).teachers || []).filter(r => r.date === date).forEach(r => { saved[r.cnic] = r; });
  const st = {}; ATTC.staff().forEach(e => { const r = saved[e.cnic] || {}; st[e.cnic] = { status: r.status || '', leave_type: r.leave_type || '', arrival: r.arrival || '', departure: r.departure || '', remark: r.remark || '' }; });
  const LBL = [['Present', 'P'], ['Absent', 'A'], ['Leave', 'L'], ['On duty', 'D']];
  const flags = s => { if (s.status !== 'Present') return '';
    const lm = ATTC.mins(s.arrival) !== null ? ATTC.mins(s.arrival) - ATTC.mins(tm.assembly) : 0, em = ATTC.mins(s.departure) !== null ? ATTC.mins(tm.close) - ATTC.mins(s.departure) : 0;
    return [lm > 0 ? lm + ' min late' : '', em > 0 ? 'left ' + em + ' min before closing' : ''].filter(Boolean).join(' · '); };
  const draw = () => {
    $('#tl').innerHTML = ATTC.staff().map(e => { const s = st[e.cnic];
      return `<div class="card trow" data-c="${esc(e.cnic)}"><div class="trh"><div><b>${esc(e.name)}</b><div class="sub">${esc(e.own_designation || e.designation)}</div></div>
        <div class="seg4">${LBL.map(([v, l]) => `<button type="button" class="${s.status === v ? 'on s' + l : ''}" data-v="${v}" title="${v}">${l}</button>`).join('')}</div></div>
        ${s.status === 'Present' ? `<div class="tt"><label>Arrived<input class="tm" data-k="arrival" value="${esc(s.arrival)}" inputmode="numeric" placeholder="hh:mm"></label><button type="button" class="chip" data-now="arrival">Now</button>
          <label>Left<input class="tm" data-k="departure" value="${esc(s.departure)}" inputmode="numeric" placeholder="hh:mm"></label><button type="button" class="chip" data-now="departure">Now</button></div>
          <div class="tflag">${flags(s)}</div>` : ''}
        ${s.status === 'Leave' ? `<select data-k="leave_type">${opts(ATTC.leaveTypes(), s.leave_type, '— kind of leave —')}</select>` : ''}
        ${s.status && s.status !== 'Present' ? `<input data-k="remark" value="${esc(s.remark)}" placeholder="Remarks (optional)">` : ''}</div>`; }).join('') || '<div class="card"><p class="muted">No staff in the register.</p></div>';
    document.querySelectorAll('.trow').forEach(row => { const c = row.dataset.c, s = st[c];
      row.querySelectorAll('.seg4 button').forEach(b => b.onclick = () => { s.status = s.status === b.dataset.v ? '' : b.dataset.v; if (s.status === 'Present' && !s.arrival) s.arrival = ATTC.hhmm(); draw(); });
      row.querySelectorAll('[data-now]').forEach(b => b.onclick = () => { s[b.dataset.now] = ATTC.hhmm(); draw(); });
      row.querySelectorAll('select[data-k],input[data-k]:not(.tm)').forEach(el => el.onchange = () => { s[el.dataset.k] = el.value; });
      // typing a time updates the flag in place (no redraw, so the next tap is never lost)
      row.querySelectorAll('input.tm').forEach(el => { el.oninput = () => { const g = el.value.replace(/\D/g, '').slice(0, 4); el.value = g.length > 2 ? g.slice(0, 2) + ':' + g.slice(2) : g; s[el.dataset.k] = el.value;
        const f = row.querySelector('.tflag'); if (f) f.textContent = flags(s); }; });
    });
  };
  $('#allin').onclick = () => { const t = ATTC.hhmm(); Object.values(st).forEach(s => { if (!s.status) { s.status = 'Present'; s.arrival = t; } }); draw(); };
  $('#allout').onclick = () => { const t = ATTC.hhmm(); Object.values(st).forEach(s => { if (s.status === 'Present' && !s.departure) s.departure = t; }); draw(); };
  $('#tsave').onclick = () => {
    const rows = [], staff = ATTC.staff();
    for (const e of staff) { const s = st[e.cnic], o = saved[e.cnic] || {};
      if (!s.status) continue;
      if (s.status === 'Present' && ATTC.mins(s.arrival) === null) return toast('Arrival time for ' + e.name);
      if (s.departure && ATTC.mins(s.departure) === null) return toast('Departure time for ' + e.name + ' should be hh:mm');
      if (s.status === 'Present' && s.departure && ATTC.mins(s.departure) <= ATTC.mins(s.arrival)) return toast('Departure must be after arrival: ' + e.name);
      if (s.status === 'Leave' && !s.leave_type) return toast('Kind of leave for ' + e.name);
      if (['status', 'leave_type', 'arrival', 'departure', 'remark'].some(k => (s[k] || '') !== (o[k] || ''))) rows.push(Object.assign({ cnic: e.cnic }, s, s.status === 'Present' ? {} : { arrival: '', departure: '' }));
    }
    if (!rows.length) return toast('Nothing new to save');
    const device_time = ATTC.now();
    queue('saveTeacherAttendance', { emis: S.emis, date, device_time, rows }, 'Teacher attendance ' + dmy(date));
    rows.forEach(r => { const e = staff.find(x => x.cnic === r.cnic), o = saved[r.cnic] || {};
      ATTC.put(m, 'teachers', Object.assign({}, o, r, { key: date + '|' + r.cnic, date, name: e.name, late_min: r.status === 'Present' ? String(Math.max(0, ATTC.mins(r.arrival) - ATTC.mins(tm.assembly))) : '', early_min: r.status === 'Present' && r.departure ? String(Math.max(0, ATTC.mins(tm.close) - ATTC.mins(r.departure))) : '', marked_device: o.marked_device || device_time })); });
    const unmarked = staff.filter(e => !st[e.cnic].status).length, nodep = staff.filter(e => st[e.cnic].status === 'Present' && !st[e.cnic].departure).length;
    toast(unmarked ? `Saved. ${unmarked} still unmarked.` : nodep ? 'Saved. Record departures before closing.' : 'Saved. Attendance complete for the day.'); back();
  };
  draw();
};

/* ---------- students of one class ---------- */
V.satt = arg => { const [c, sec] = arg.cls.split('|');
  return `<div class="card noprint"><h2>Class ${esc(c)}${sec ? '-' + esc(sec) : ''}</h2><p class="muted">${DT.words(arg.date)} · everyone is present unless tapped. Tap once for <b>absent</b>, twice for <b>leave</b>.</p><p id="scnt" class="muted"></p></div>
    <div class="list sgrid" id="sg"></div><div class="decide"><button class="btn" id="ssv">Save class</button></div>`; };
BIND.satt = arg => {
  const date = arg.date, m = date.slice(0, 7), [c, sec] = arg.cls.split('|');
  const kids = REG.students().filter(s => s.class === c && (s.section || '') === sec && s.adm_date <= date).sort((a, b) => Number(a.roll_no || 9999) - Number(b.roll_no || 9999) || a.name.localeCompare(b.name));
  const ex = (ATTC.month(m).students || []).find(r => r.date === date && r.class === c && (r.section || '') === sec) || {};
  const mark = {}; (ex.absent_list || '').split(' ').filter(Boolean).forEach(a => { mark[a] = 'A'; }); (ex.leave_list || '').split(' ').filter(Boolean).forEach(a => { mark[a] = 'L'; });
  const draw = () => {
    $('#sg').innerHTML = kids.map(s => `<div class="it tap sk ${mark[s.adm_no] ? 'k' + mark[s.adm_no] : ''}" data-a="${esc(s.adm_no)}"><span class="roll">${esc(s.roll_no || '')}</span><div class="grow"><b>${esc(s.name)}</b><div class="sub">s/o ${esc(s.father_name)} · Adm. ${esc(s.adm_no)}</div></div><span class="kst">${mark[s.adm_no] === 'A' ? 'Absent' : mark[s.adm_no] === 'L' ? 'Leave' : 'Present'}</span></div>`).join('');
    const a = Object.values(mark).filter(x => x === 'A').length, l = Object.values(mark).filter(x => x === 'L').length;
    $('#scnt').textContent = `${kids.length - a - l} present · ${a} absent · ${l} on leave · ${kids.length} in class`;
    document.querySelectorAll('.sk').forEach(el => el.onclick = () => { const k = el.dataset.a; mark[k] = !mark[k] ? 'A' : mark[k] === 'A' ? 'L' : undefined; if (!mark[k]) delete mark[k]; draw(); });
  };
  $('#ssv').onclick = () => {
    const absent = Object.keys(mark).filter(k => mark[k] === 'A'), leave = Object.keys(mark).filter(k => mark[k] === 'L'), device_time = ATTC.now();
    queue('saveStudentAttendance', { emis: S.emis, date, class: c, section: sec, absent, leave, device_time }, `Class ${c}${sec ? '-' + sec : ''} attendance ${dmy(date)}`);
    ATTC.put(m, 'students', { key: date + '|' + c + '|' + sec, date, class: c, section: sec, enrolled: String(kids.length), present: String(kids.length - absent.length - leave.length), absent: String(absent.length), leave: String(leave.length), absent_list: absent.join(' '), leave_list: leave.join(' '), marked_device: ex.marked_device || device_time });
    toast('Saved'); back();
  };
  draw();
};

/* ---------- monthly register ---------- */
V.attmonth = arg => `<div class="card noprint"><div class="db-sh rhead"><h3>Monthly register</h3><span class="rbtn"><button class="btn alt" onclick="window.print()">Print</button></span></div>
  <label>Month</label><select id="amm">${opts([0, 1, 2].map(k => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k); const m = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); return [m, monthLabel(m)]; }), arg.month)}</select>
  <p class="muted">P present (<span class="kL0">P</span> late) · A absent · L leave · D on duty · grey: Sunday, vacation or closed.</p></div>
  <div class="card"><h3 class="ponly">${esc(inst().name)} · attendance register</h3><div class="rwrap" id="amg"></div></div>`;
BIND.attmonth = arg => {
  const draw = () => {
    const m = $('#amm').value, mo = ATTC.month(m), y = Number(m.slice(0, 4)), mm = Number(m.slice(5)), n = new Date(y, mm, 0).getDate();
    const days = Array.from({ length: n }, (_, k) => `${m}-${String(k + 1).padStart(2, '0')}`);
    const closed = {}; days.forEach(d => { closed[d] = ATTC.closed(d) || ((mo.daily || []).find(r => r.date === d && r.closed) || {}).closed || ''; });
    const by = {}; (mo.teachers || []).forEach(r => { by[r.cnic + '|' + r.date] = r; });
    const code = r => !r || !r.status ? '' : r.status === 'Present' ? 'P' : r.status === 'Absent' ? 'A' : r.status === 'Leave' ? 'L' : 'D';
    const staff = ATTC.staff();
    const srows = days.map(d => { const list = (mo.students || []).filter(r => r.date === d); return list.length ? [list.reduce((a, r) => a + Number(r.present || 0), 0), list.reduce((a, r) => a + Number(r.enrolled || 0), 0)] : null; });
    $('#amg').innerHTML = `<table class="amt"><thead><tr><th>Name</th>${days.map(d => `<th class="${closed[d] ? 'cl' : ''}" title="${esc(closed[d])}">${Number(d.slice(8))}</th>`).join('')}<th>P</th><th>Late</th><th>A</th><th>L</th></tr></thead><tbody>
      ${staff.map(e => { let p = 0, l = 0, a = 0, lv = 0;
        const cells = days.map(d => { const r = by[e.cnic + '|' + d], c = code(r); if (c === 'P') { p++; if (Number(r.late_min) > 0) l++; } if (c === 'A') a++; if (c === 'L') lv++;
          return `<td class="${closed[d] ? 'cl' : ''} k${c}${c === 'P' && Number(r.late_min) > 0 ? ' lt' : ''}" title="${r ? esc(r.status + (r.arrival ? ' ' + r.arrival + (r.departure ? '–' + r.departure : '') : '') + (r.leave_type ? ' · ' + r.leave_type : '')) : ''}">${closed[d] ? '' : c}</td>`; }).join('');
        return `<tr><td class="nm">${esc(e.name)}<small>${esc(e.own_designation || e.designation)}</small></td>${cells}<td class="n">${p}</td><td class="n">${l}</td><td class="n">${a}</td><td class="n">${lv}</td></tr>`; }).join('')}
      ${srows.some(Boolean) ? `<tr class="stud"><td class="nm">Students present</td>${srows.map((x, k) => `<td class="${closed[days[k]] ? 'cl' : ''}">${x ? Math.round(x[0] * 100 / (x[1] || 1)) + '%' : ''}</td>`).join('')}<td colspan="4"></td></tr>` : ''}
      </tbody></table>`;
  };
  $('#amm').onchange = () => { draw(); ATTC.load($('#amm').value, true).then(() => { if (S.view === 'attmonth') draw(); }); };
  draw(); ATTC.load($('#amm').value, true).then(() => { if (S.view === 'attmonth') draw(); });
};
