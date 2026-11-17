/* DASHBOARD — opening page. Each login sees only its own scope (the server enforces this):
   school -> itself; AEO -> its circle; DDEO -> middle schools; DEO office -> the whole district.
   The last figures are kept on the phone, so the page also opens offline. */
'use strict';

const DASH = (() => {
  const nf = n => (n == null || isNaN(n)) ? '–' : Number(n).toLocaleString('en-US');
  const pct = (a, b) => b ? Math.round(a * 1000 / b) / 10 : null;
  const key = emis => 'dash_' + (S.user ? S.user.code : '') + '_' + (emis || '');
  const ORDER = ['ECE', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const LV = { 'Higher Secondary': 'higher secondary', High: 'high', Middle: 'middle', Primary: 'primary', 'Training Institute': 'training' };
  const plural = (n, w) => nf(n) + ' ' + w + (n === 1 ? '' : 's');
  const fmtTime = s => { if (!s) return ''; const [d, t] = s.split(' '); const m = Number(d.slice(5, 7)); return `${Number(d.slice(8))} ${MONTHS[m - 1]} ${d.slice(0, 4)}, ${t || ''}`; };

  /* ---------- small building blocks ---------- */
  const fig = (value, label, note, cls) =>
    `<div class="db-fig ${cls || ''}"><div class="db-num">${value}</div><div class="db-lab">${label}</div>${note ? `<div class="db-note">${note}</div>` : ''}</div>`;

  const sec = (title, side, body, span) =>
    `<section class="db-sec ${span || ''}"><div class="db-sh"><h3>${title}</h3>${side ? `<span class="db-side">${side}</span>` : ''}</div>${body}</section>`;

  const empty = (text, action) => `<div class="db-empty">${text}${action ? ` ${action}` : ''}</div>`;

  /** horizontal bars: rows [{label, value, tip}] scaled to the largest */
  function hbars(rows, opts = {}) {
    const max = Math.max(1, ...rows.map(r => r.value));
    return `<div class="db-hb">${rows.map(r => `<div class="db-hbr" tabindex="0" data-tip="${esc(r.tip || r.label + ': ' + nf(r.value))}">
      <span class="db-hbl">${esc(r.label)}</span><span class="db-hbt"><i class="${opts.cls || ''}" style="width:${Math.max(2, r.value * 100 / max)}%"></i></span>
      <span class="db-hbv">${opts.fmt ? opts.fmt(r.value) : nf(r.value)}</span></div>`).join('')}</div>`;
  }

  /** one stacked bar with a legend: parts [{label, value, cls}] */
  function meter(parts, total) {
    total = total || parts.reduce((s, p) => s + p.value, 0) || 1;
    return `<div class="db-meter">${parts.map(p => p.value ? `<i class="${p.cls}" style="flex:${p.value}" tabindex="0" data-tip="${esc(p.label)}: ${nf(p.value)} (${pct(p.value, total)}%)"></i>` : '').join('')}</div>
      <div class="db-legend">${parts.map(p => `<span><b class="db-sw ${p.cls}"></b>${esc(p.label)} <strong>${nf(p.value)}</strong></span>`).join('')}</div>`;
  }

  /** vertical columns (SVG) for enrolment by class */
  function columns(byClass) {
    const cls = ORDER.filter(c => byClass[c]);
    if (!cls.length) return '';
    const max = Math.max(...cls.map(c => byClass[c]));
    const W = 100 / cls.length;
    return `<div class="db-cols" role="img" aria-label="Enrolment by class">${cls.map(c => {
      const h = Math.max(3, byClass[c] * 100 / max);
      return `<div class="db-col" tabindex="0" data-tip="Class ${c}: ${nf(byClass[c])} students" style="width:${W}%">
        <div class="db-colbar"><i style="height:${h}%"></i></div><span>${c}</span></div>`;
    }).join('')}</div><div class="db-axisnote">Highest: ${nf(max)} students</div>`;
  }

  /* ---------- the page ---------- */
  function render(d) {
    const single = d.single, E = d.enrol, P = d.posts, St = d.staff, R = d.results, F = d.fees, W = d.work;
    const lv = d.institutions.levels || {};
    const levelLine = ['Higher Secondary', 'High', 'Middle', 'Primary', 'Training Institute'].filter(k => lv[k])
      .map(k => `${nf(lv[k])} ${LV[k]}`).join(', ');
    const passRate = pct(R.passed, R.appeared);
    const vacRate = pct(P.vacant, P.sanctioned);
    const ptr = St.teaching ? Math.round(E.total / St.teaching) : null;

    /* hero */
    const heroFigs = single
      ? fig(nf(E.total), 'Students enrolled', E.total ? `${nf(E.boys)} boys, ${nf(E.girls)} girls` : 'Not entered yet')
        + fig(nf(St.total), 'Staff on register', St.total ? `${nf(St.teaching)} teaching` : 'None entered yet')
        + (P.atCircle ? fig('–', 'Vacant posts', 'Sanctioned at AEO circle level')
          : fig(nf(P.vacant), 'Vacant posts', P.sanctioned ? `of ${nf(P.sanctioned)} sanctioned` : '', P.vacant ? 'warn' : ''))
        + fig(passRate == null ? '–' : passRate + '%', 'Pass rate', R.exam ? esc(R.exam) : 'No result entered yet')
      : fig(`${nf(E.reporting)}<small>/${nf(d.institutions.total)}</small>`, 'Institutions reporting', 'Enrolment updated this or last month')
        + fig(nf(E.total), 'Students enrolled', E.census ? `EMIS census: ${nf(E.census)}` : '')
        + fig(nf(St.total), 'Staff on register', `${nf(St.verified)} verified`)
        + fig(nf(P.vacant), 'Vacant posts', P.sanctioned ? `${vacRate}% of ${nf(P.sanctioned)} sanctioned` : '', 'warn');

    const hero = `<section class="db-hero">
      <div class="db-ht"><div><div class="db-org">E&amp;SE Department, Azad Jammu &amp; Kashmir</div>
        <h2>${esc(d.scope)}</h2><div class="db-meta">${single ? esc(inst().level || '') : esc(levelLine)}${d.institutions.offices && !single ? ` and ${plural(d.institutions.offices, 'office')}` : ''}</div></div>
        <button class="db-refresh" onclick="DASH.refresh()" aria-label="Refresh figures">Refresh</button></div>
      <div class="db-figs">${heroFigs}</div>
      <div class="db-stamp">Figures as of ${esc(fmtTime(d.generated))}</div></section>`;

    /* needs attention */
    const att = [];
    if (W.pendingApprovals) att.push(['crit', W.pendingApprovals, 'items waiting for your approval', `<button class="btn" onclick="go('approvals')">Open approvals</button>`]);
    if (W.returned) att.push(['crit', W.returned, 'entries returned for correction', `<button class="btn alt" onclick="window.scrollTo(0,document.body.scrollHeight)">See below</button>`]);
    if (!single && W.notReporting) att.push(['warn', W.notReporting, 'institutions have not updated enrolment this month or last', '']);
    if (single && !E.total) att.push(['warn', 1, 'enrolment for this month is not entered', `<button class="btn alt" onclick="go('enrol')">Enter enrolment</button>`]);
    if (St.total - St.verified) att.push(['info', St.total - St.verified, 'staff records not yet verified', '']);
    if (W.transfers) att.push(['info', W.transfers, 'transfers in process', single ? `<button class="btn alt" onclick="go('staff')">Open staff</button>` : '']);
    if (d.retiring.count) att.push(['info', d.retiring.count, 'employees reach age 60 within 12 months', '']);
    const nr = !single && W.notReportingList.length ? `<div class="db-nr">${W.notReportingList.slice(0, 6).map(i =>
      `<button class="db-chip" onclick="pick('${esc(i.emis)}')">${esc(i.name)}</button>`).join('')}${W.notReporting > 6 ? `<span class="db-more">and ${nf(W.notReporting - 6)} more</span>` : ''}</div>` : '';
    const attention = sec('Needs attention', att.length ? '' : 'All clear',
      att.length ? `<ul class="db-att">${att.map(([lvl, n, t, a]) => `<li class="${lvl}"><span class="db-cnt">${nf(n)}</span><span class="db-att-t">${t}</span>${a}</li>`).join('')}</ul>${nr}`
        : empty('Nothing is waiting. All entries are up to date.'), 'db-s4');

    /* staffing */
    const staffBody = (P.sanctioned ? meter([{ label: 'Filled', value: P.filled, cls: 'v1' }, { label: 'Vacant', value: P.vacant, cls: 'vw' }], P.sanctioned)
      : P.atCircle ? `<p class="db-p">Posts of primary schools are sanctioned at AEO circle level; the AEO's dashboard shows the vacancy position.</p>` : '')
      + `<div class="db-mini">
        ${fig(St.nonRegular ? nf(St.nonRegular) : '0', 'Non-regular', 'Temporary, ad hoc, contract')}
        ${fig(nf(St.outOfTitle), 'Against another post', 'Own title differs from post')}
        ${fig(nf(St.charges), 'Holding charge', 'Additional or current')}
        ${fig(ptr == null ? '–' : '1 : ' + ptr, 'Pupils per teacher', ptr == null ? 'Needs staff and enrolment' : `${nf(St.teaching)} teaching staff`)}
      </div>`
      + (P.topVacant.length ? `<h4>Most vacant posts</h4>${hbars(P.topVacant.map(v => ({ label: v.title, value: v.vacant, tip: `${v.title}: ${v.vacant} vacant` })), { cls: 'vw' })}` : '');
    const staffing = sec('Staff and posts', P.sanctioned ? `${vacRate}% vacant` : '', staffBody, 'db-s8');

    /* students */
    const studentsBody = E.total ? `${columns(E.byClass)}
      <div class="db-split" tabindex="0" data-tip="Boys ${nf(E.boys)}, girls ${nf(E.girls)}"><i class="v1" style="flex:${E.boys || 0.0001}"></i><i class="v2" style="flex:${E.girls || 0.0001}"></i></div>
      <div class="db-legend"><span><b class="db-sw v1"></b>Boys <strong>${nf(E.boys)}</strong></span><span><b class="db-sw v2"></b>Girls <strong>${nf(E.girls)}</strong></span>
      ${E.newAdm ? `<span>New admissions <strong>${nf(E.newAdm)}</strong></span>` : ''}</div>`
      : empty('No enrolment has been entered for the last two months.', single ? `<button class="btn alt" onclick="go('enrol')">Enter enrolment</button>` : '');
    const students = sec('Students by class', E.total ? plural(E.total, 'student') : '', studentsBody, 'db-s6');

    /* fees */
    const feeBody = F.month ? `${hbars([
        { label: 'Expected', value: F.expected, tip: 'Expected from enrolment at notified rates: Rs ' + nf(F.expected) },
        { label: 'Collected', value: F.collected, tip: 'Collected: Rs ' + nf(F.collected) },
        { label: 'Deposited', value: F.deposited, tip: 'Deposited by challan: Rs ' + nf(F.deposited) }], { fmt: v => 'Rs ' + nf(v) })}
      <div class="db-mini db-mini3">
        ${fig(F.expected ? pct(F.collected, F.expected) + '%' : '–', 'Collected of expected')}
        ${fig(F.collected ? pct(F.deposited, F.collected) + '%' : '–', 'Deposited of collected')}
        ${fig('Rs ' + nf(Math.max(0, F.collected - F.deposited)), 'Not yet deposited', '', F.collected - F.deposited > 0 ? 'warn' : '')}
      </div>`
      : empty(single && inst().level === 'Primary' ? 'Primary-school fees are entered by the AEO.' : 'No fee collection has been entered yet.',
        single && inst().level !== 'Primary' ? `<button class="btn alt" onclick="go('fees')">Enter fees</button>` : '');
    const fees = sec('Fees', F.month ? monthLabel(F.month) + (single ? '' : `, ${plural(F.schools, 'institution')}`) : '', feeBody, 'db-s6');

    /* learning outcomes */
    const rc = ORDER.filter(c => R.byClass && R.byClass[c] && R.byClass[c].appeared);
    const T = R.trend || [];
    const prevT = T.length > 1 ? T[T.length - 2] : null, lastT = T.length ? T[T.length - 1] : null;
    const change = prevT && lastT ? Math.round((pct(lastT.passed, lastT.appeared) - pct(prevT.passed, prevT.appeared)) * 10) / 10 : null;
    const arrow = v => v == null ? '–' : (v > 0 ? '▲ +' : v < 0 ? '▼ ' : '') + v + ' pts';
    const G = [['aplus', 'a', 'A+ and A', 'g1'], ['b', 'c', 'B and C', 'g2'], ['d', 'e', 'D and E', 'g3'], ['f', null, 'F (failed)', 'g4']];
    const trendChart = T.length ? `<div class="db-tr" role="img" aria-label="Grade spread by examination">${T.map(t => {
        const tot = t.appeared || 1;
        return `<div class="db-trc" tabindex="0" data-tip="${esc(t.label)}: pass rate ${pct(t.passed, t.appeared)}%, ${nf(t.appeared)} appeared${single ? '' : ' in ' + plural(t.schools, 'institution')}. ${G.map(g => `${g[2]} ${pct((t[g[0]] || 0) + (g[1] ? t[g[1]] || 0 : 0), tot)}%`).join(', ')}">
          <div class="db-trp">${pct(t.passed, t.appeared)}%</div>
          <div class="db-trb">${G.slice().reverse().map(g => { const v = (t[g[0]] || 0) + (g[1] ? t[g[1]] || 0 : 0); return v ? `<i class="${g[3]}" style="flex:${v}"></i>` : ''; }).join('')}</div>
          <span>${esc(t.label)}</span></div>`; }).join('')}</div>
      <div class="db-legend">${G.map(g => `<span><b class="db-sw ${g[3]}"></b>${g[2]}</span>`).join('')}</div>
      ${T.length < 2 ? '<p class="db-p db-small">The trend builds up as monthly tests are entered each month.</p>' : ''}` : '';
    const heat = v => v == null ? '' : v < 40 ? 'h1' : v < 55 ? 'h2' : v < 70 ? 'h3' : v < 85 ? 'h4' : 'h5';
    const Gd = R.grid || { classes: [], rows: [] };
    const gridHtml = Gd.rows.length ? `<div class="db-tw"><table class="db-heat"><thead><tr><th>Subject</th>${Gd.classes.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>
      ${Gd.rows.map(r => `<tr><td>${esc(r.subject)}</td>${r.cells.map((c, k) => c ? `<td class="${heat(c[0])}" tabindex="0" data-tip="${esc(r.subject)}, Class ${Gd.classes[k]}: ${c[0]}% passed (${nf(c[1])} appeared)">${Math.round(c[0])}</td>` : '<td class="h0"></td>').join('')}</tr>`).join('')}
      </tbody></table></div>
      <div class="db-legend db-heatkey"><span><b class="db-sw h1"></b>below 40%</span><span><b class="db-sw h2"></b>40–54</span><span><b class="db-sw h3"></b>55–69</span><span><b class="db-sw h4"></b>70–84</span><span><b class="db-sw h5"></b>85 and above</span></div>` : '';
    const C = R.compare || [];
    const cmp = C.length ? `<h4>${C.some(x => x.gap) ? 'Top 10 and bottom 10 institutions' : 'Institutions ranked'} by latest pass rate</h4>
      <div class="db-tw"><table class="db-t db-rank"><thead><tr><th class="n">Rank</th><th>Institution</th><th>Latest exam</th><th class="n">Pass rate</th><th class="n">Change</th><th class="n">A+ and A</th></tr></thead><tbody>
      ${C.map(x => x.gap ? `<tr class="db-gap"><td colspan="6">${nf(x.gap)} more institutions in between</td></tr>`
        : `<tr onclick="pick('${esc(x.emis)}')" class="db-click"><td class="n">${x.rank}</td><td><b>${esc(x.name)}</b><span>${esc(x.level)}${x.halqa ? ', ' + esc(x.halqa) : ''}</span></td>
          <td>${esc(x.exam)}</td><td class="n"><b>${x.pass}%</b></td><td class="n ${x.change > 0 ? 'db-up' : x.change < 0 ? 'db-down' : ''}">${arrow(x.change)}</td><td class="n">${x.top}%</td></tr>`).join('')}
      </tbody></table></div>` : '';
    const resBody = R.exam ? `<div class="db-mini">
        ${fig(passRate + '%', 'Pass rate', `${nf(R.passed)} of ${nf(R.appeared)} passed`)}
        ${fig(arrow(change), 'Change in pass rate', prevT ? 'Since ' + esc(prevT.label) : 'Needs two examinations', change > 0 ? 'up' : change < 0 ? 'warn' : '')}
        ${fig(pct(R.top, R.appeared) + '%', 'Scored A+ or A', '70% marks and above')}
        ${fig(pct(R.appeared - R.passed, R.appeared) + '%', 'Failed', `${nf(R.appeared - R.passed)} students`, R.appeared - R.passed ? 'warn' : '')}
      </div>
      <div class="db-two">
        <div><h4>Grade spread by examination</h4>${trendChart}</div>
        <div><h4>Pass rate by class, ${esc(R.examLabel || R.exam)}</h4>${hbars(rc.map(c => ({ label: 'Class ' + c, value: pct(R.byClass[c].passed, R.byClass[c].appeared),
          tip: `Class ${c}: ${R.byClass[c].passed} of ${R.byClass[c].appeared} passed` })), { fmt: v => v + '%' })}</div>
      </div>
      ${gridHtml ? `<h4>Pass rate by subject and class, ${esc(R.examLabel || R.exam)}</h4>${gridHtml}` : ''}
      ${cmp}`
      : empty('No exam result has been entered yet. Monthly test and term results entered by schools appear here as trends, subject-wise pass rates' + (single ? '.' : ' and school rankings.'),
        single ? `<button class="btn alt" onclick="go('results')">Enter results</button>` : '');
    const results = sec('Learning outcomes', R.exam ? `Latest: ${esc(R.examLabel || R.exam)}` : '', resBody, 'db-s12');

    /* buildings and facilities */
    const I = d.infra || { entered: 0, total: 0, list: [] };
    let infraBody;
    if (!I.entered) infraBody = empty(single ? 'The building and facilities profile has not been entered yet.' : 'No institution has entered its building and facilities profile yet.',
      single ? `<button class="btn alt" onclick="go('building')">Enter profile</button>` : '');
    else if (single) {
      const f = I.list[0];
      infraBody = `<div class="db-mini">
        ${fig(I.studentsPerRoom == null ? '–' : nf(I.studentsPerRoom), 'Students per usable classroom', I.classroomsUsable ? plural(I.classroomsUsable, 'usable classroom') : 'No usable classroom', I.studentsPerRoom > 40 ? 'warn' : '')}
        ${fig(I.seated == null ? '–' : I.seated + '%', 'Students with a seat', 'Desks and tablet chairs', I.seated != null && I.seated < 60 ? 'warn' : '')}
        ${fig(I.shelterless ? 'Shelterless' : I.dangerous ? 'Dangerous' : I.majorRepair ? 'Major repair' : 'Sound', 'Building', '', I.shelterless || I.dangerous ? 'warn' : 'up')}
        ${fig(I.noWater || I.noToilet || I.noElectricity || I.noWall ? [I.noWater && 'water', I.noToilet && 'toilet', I.noElectricity && 'power', I.noWall && 'wall'].filter(Boolean).join(', ') : 'Complete', 'Basic facilities missing', '', I.noWater || I.noToilet ? 'warn' : 'up')}
      </div>${f ? `<p class="db-p db-small">Flagged: ${esc(f.what)}.</p>` : ''}`;
    } else {
      const probs = [['shelterless', I.shelterless, 'Shelterless'], ['dangerous', I.dangerous, 'Dangerous buildings'], ['noWater', I.noWater, 'No drinking water'], ['noToilet', I.noToilet, 'No usable toilet'],
        ['noElectricity', I.noElectricity, 'No electricity'], ['noWall', I.noWall, 'No boundary wall'], ['noUsableDesks', I.noUsableDesks, 'No furniture']].filter(x => x[1]);
      infraBody = `<div class="db-mini">
        ${fig(`${nf(I.entered)} / ${nf(I.total)}`, 'Profiles entered', pct(I.entered, I.total) + '% of institutions', I.entered < I.total ? 'warn' : 'up')}
        ${fig(I.studentsPerRoom == null ? '–' : nf(I.studentsPerRoom), 'Students per usable classroom', 'Where profiles are entered')}
        ${fig(I.seated == null ? '–' : I.seated + '%', 'Students with a seat', 'Desks and tablet chairs')}
        ${fig(nf(I.rented), 'In rented buildings', '')}
      </div>
      ${probs.length ? hbars(probs.map(x => ({ label: x[2], value: x[1], tip: `${x[2]}: ${plural(x[1], 'institution')}` })), { cls: 'vw' }) : '<p class="db-p">No shortage flagged in the profiles entered so far.</p>'}
      ${I.list.length ? `<div class="db-nr">${I.list.slice(0, 8).map(i => `<button class="db-chip" onclick="pick('${esc(i.emis)}')" title="${esc(i.what)}">${esc(i.name)}</button>`).join('')}</div>` : ''}`;
    }
    const infra = sec('Buildings and facilities', I.entered && !single ? plural(I.entered, 'profile') : '', infraBody, single ? 'db-s12' : 'db-s6');

    /* retirements */
    const ret = d.retiring.count ? `<ul class="db-ret">${d.retiring.next.map(r => `<li><div><b>${esc(r.name)}</b><span>${esc(r.designation)}${single ? '' : ', ' + esc(r.inst)}</span></div><time>${esc(fmtTime(r.date).replace(', ', ''))}</time></li>`).join('')}</ul>
      ${d.retiring.count > d.retiring.next.length ? `<div class="db-more">and ${nf(d.retiring.count - d.retiring.next.length)} more</div>` : ''}`
      : empty('No employee reaches age 60 in the next 12 months.');
    const retire = sec('Reaching age 60', 'next 12 months', ret, 'db-s12 db-retw');

    /* breakdown */
    let table = '';
    if (d.units && d.units.length) {
      const halqa = d.role === 'DEO_OFFICE' || d.role === 'ADMIN';
      const maxS = Math.max(1, ...d.units.map(u => u.students));
      table = sec(halqa ? 'By Halqa' : 'By institution', halqa ? '' : plural(d.units.length, 'institution'),
        `<div class="db-tw"><table class="db-t"><thead><tr><th>${halqa ? 'Halqa' : 'Institution'}</th>${halqa ? '<th class="n">Reporting</th>' : '<th>Updated</th>'}
        <th class="db-tsb">Students</th><th class="n">Staff</th><th class="n">Pupils / teacher</th><th class="n">Vacant posts</th><th class="n">Pass rate</th>${halqa ? '<th class="n">Profiles</th>' : ''}</tr></thead><tbody>
        ${d.units.map(u => `<tr ${u.emis ? `onclick="pick('${esc(u.emis)}')" class="db-click"` : ''}><td><b>${esc(u.name)}</b><span>${esc(u.sub)}</span></td>
          ${halqa ? `<td class="n">${nf(u.reporting)}/${nf(u.institutions)}</td>` : `<td>${u.lastMonth ? `<span class="db-ok">${monthLabel(u.lastMonth)}</span>` : '<span class="db-no">Not updated</span>'}</td>`}
          <td class="db-tsb"><span class="db-tbar"><i style="width:${u.students * 100 / maxS}%"></i></span>${nf(u.students)}</td>
          <td class="n">${nf(u.staff)}</td><td class="n">${u.ptr == null ? '–' : u.ptr}</td><td class="n">${u.vacant == null ? '–' : nf(u.vacant)}</td>
          <td class="n">${u.pass == null ? '–' : u.pass + '%'}</td>${halqa ? `<td class="n">${nf(u.profiles || 0)}${u.problems ? ` <span class="db-no">(${u.problems})</span>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table></div>`, 'db-s12');
    }

    return { hero: `<div class="db">${hero}</div>`, grid: `<div class="db"><div class="db-grid">${attention}${staffing}${results}${students}${fees}${infra}${table}${retire}</div></div>` };
  }

  /* ---------- tooltip (hover on desktop, tap on phones) ---------- */
  let tip;
  function bindTips(root) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'db-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    const show = el => {
      tip.textContent = el.dataset.tip; tip.style.opacity = 1;
      const r = el.getBoundingClientRect(), tw = tip.offsetWidth;
      tip.style.left = Math.min(window.innerWidth - tw - 8, Math.max(8, r.left + r.width / 2 - tw / 2)) + 'px';
      tip.style.top = (r.top + window.scrollY - tip.offsetHeight - 8) + 'px';
    };
    const hide = () => { tip.style.opacity = 0; };
    root.querySelectorAll('[data-tip]').forEach(el => {
      el.addEventListener('pointerenter', () => show(el)); el.addEventListener('pointerleave', hide);
      el.addEventListener('focus', () => show(el)); el.addEventListener('blur', hide);
      el.addEventListener('click', () => show(el));
    });
    window.addEventListener('scroll', hide, { passive: true });
  }

  /* ---------- loading ---------- */
  let target = null;
  /** hero goes into el; the detail grid into #dash2 when the page has one (school home puts data entry in between) */
  function paint(el, d) {
    const r = render(d), el2 = document.getElementById('dash2');
    if (el2) { el.innerHTML = r.hero; el2.innerHTML = r.grid; bindTips(el2); } else { el.innerHTML = r.hero + r.grid; }
    bindTips(el);
  }
  async function load(el, emis, fresh) {
    target = { el, emis };
    const cached = LS.get(key(emis));
    if (cached) paint(el, cached);
    else el.innerHTML = `<div class="db-loading">${navigator.onLine ? 'Loading figures…' : 'Figures appear here after the first connection to the internet.'}</div>`;
    if (!navigator.onLine) return;
    try {
      const stale = fresh || S.dashStale; S.dashStale = false;
      const j = await api('dashboard', Object.assign({ fresh: stale ? 1 : 0 }, emis ? { emis } : {}));
      if (j.ok && j.dash) { LS.set(key(emis), j.dash); if (target && target.el === el && document.body.contains(el)) paint(el, j.dash); }
    } catch (e) { /* keep cached figures */ }
  }
  const credit = () => `<footer class="db-credit">Conceived and developed by Dr. Muhammad Naeem Khwaja, District Education Officer (Male), Muzaffarabad.<br><a href="#" onclick="go('about');return false">About this app</a></footer>`;
  return {
    load, render, credit,
    refresh() { if (!target) return; if (!navigator.onLine) return toast('Refreshing needs internet'); toast('Refreshing figures'); load(target.el, target.emis, true); }
  };
})();
