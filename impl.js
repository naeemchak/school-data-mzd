/* =====================================================================
   IMPLEMENTATION INDEX (v4 part G) and certificates
   Schools see their score and a checklist; each missing item opens the
   screen where it is done. Officers see their area: average, colours,
   every institution's score, approvals waiting more than 3 days, and
   (DEO office) printable certificates for the fully implemented.
   ===================================================================== */

const IMPLC = {
  band: s => s >= 90 ? 'green' : s >= 60 ? 'amber' : 'red',
  word: b => b === 'green' ? 'Fully implemented' : b === 'amber' ? 'In progress' : 'Behind',
  ring(score, size) { const r = 52, c = 2 * Math.PI * r, b = IMPLC.band(score);
    return `<svg class="iring ${b}" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="Index ${score} of 100"><circle cx="60" cy="60" r="${r}" class="trk"/><circle cx="60" cy="60" r="${r}" class="val" stroke-dasharray="${c * score / 100} ${c}" transform="rotate(-90 60 60)"/><text x="60" y="66" text-anchor="middle">${score}</text></svg>`; },
  bar(label, v, max) { return `<div class="ibar"><span>${label}</span><div><i style="width:${Math.round(v * 100 / max)}%"></i></div><b>${Math.round(v)}<small>/${max}</small></b></div>`; }
};

V.impl = () => `<div id="ib"><div class="card"><p class="muted">${navigator.onLine ? 'Working out the index…' : 'The index needs internet.'}</p></div></div>`;
BIND.impl = async () => {
  const officer = role() !== 'SCHOOL', one = !!S.emis && !(officer && S.emis === S.user.scope), key = 'impl_' + (one ? S.emis : S.user.code);
  if (!navigator.onLine) { const c = LS.get(key, null); if (c) paint(c); return; }
  let j; try { j = await api('implementation', one ? { emis: S.emis } : {}); } catch (e) { }
  if (!j || !j.ok) { $('#ib').innerHTML = `<div class="card"><div class="msg w">${esc(j ? j.error : 'Could not reach the server')}</div></div>`; return; }
  j.one_ = one; try { LS.set(key, j); } catch (e) { }
  paint(j);
  function paint(j) {
    const daysNote = j.days.length ? `Daily part: the last ${j.days.length} working day${j.days.length > 1 ? 's' : ''} (${dmy(j.days[0])} to ${dmy(j.days[j.days.length - 1])}).` : `Daily attendance counts from ${dmy(j.start)}.`;
    if (j.one_ || role() === 'SCHOOL') {
      const x = j.one || (j.institutions || [])[0]; if (!x) { $('#ib').innerHTML = '<div class="card"><p class="muted">Not available for this office.</p></div>'; return; }
      const parts = ['Setup', 'Monthly', 'Daily'];
      $('#ib').innerHTML = `<div class="card ihero"><div>${IMPLC.ring(x.score, 132)}</div><div class="grow"><h2>${esc(x.name)}</h2><p class="iword ${x.band}">${IMPLC.word(x.band)}</p>
          ${IMPLC.bar('Setup', x.setup, 40)}${IMPLC.bar('Monthly', x.monthly, 20)}${IMPLC.bar('Daily', x.daily, 40)}
          <p class="muted">90 or more is fully implemented. ${daysNote} Updated ${esc(dmy(j.generated))}.</p></div></div>
        ${parts.map(pt => `<div class="card"><h3>${pt}</h3><div class="list">${x.items.filter(it => it.part === pt).map(it => `<div class="it ${it.done ? '' : 'tap'}" ${it.done ? '' : `onclick="IMPLGO('${it.fix}')"`}>
          <span class="ick ${it.done ? 'on' : it.score > 0 ? 'half' : ''}">${it.done ? '✓' : ''}</span><div class="grow"><b>${esc(it.label)}</b><div class="sub">${esc(it.detail)}</div></div>
          <span class="ipts">${it.score}<small>/${it.weight}</small></span>${it.done ? '' : '<span class="chev">›</span>'}</div>`).join('')}</div>
          ${pt === 'Setup' && role() === 'SCHOOL' ? `<p class="muted">When every member of staff is on the register, confirm it: <button class="btn alt" id="cfs">Staff register is complete</button></p>` : ''}</div>`).join('')}`;
      const c = $('#cfs'); if (c) c.onclick = () => { if (!confirm('Confirm that every member of staff serving here is entered in the app?')) return; queue('confirmStaff', { emis: S.emis }, 'Staff register confirmed'); toast('Confirmed. The index updates within 10 minutes.'); };
      return;
    }
    const s = j.summary, list = j.institutions.slice().sort((a, b) => b.score - a.score);
    const halqas = [...new Set(list.map(x => x.halqa).filter(Boolean))].sort(), levels = [...new Set(list.map(x => x.level))];
    let hq = LS.get('ih', ''), lv = LS.get('il', ''), band = LS.get('iband', '');
    const draw = () => {
      const f = list.filter(x => (!hq || x.halqa === hq) && (!lv || x.level === lv) && (!band || x.band === band));
      $('#ib').innerHTML = `<div class="card ihero"><div>${IMPLC.ring(s.avg, 132)}</div><div class="grow"><h2>Implementation in ${role() === 'AEO' ? 'your circle' : role() === 'DDEO' ? 'middle schools' : 'the district'}</h2>
          <div class="ichips"><button class="ich green ${band === 'green' ? 'on' : ''}" data-b="green"><b>${s.green}</b>fully implemented</button><button class="ich amber ${band === 'amber' ? 'on' : ''}" data-b="amber"><b>${s.amber}</b>in progress</button><button class="ich red ${band === 'red' ? 'on' : ''}" data-b="red"><b>${s.red}</b>behind</button></div>
          <p class="muted">Average index of ${s.count} institutions. ${s.approvalsOver3Days ? `<b class="db-no">${s.approvalsOver3Days} approval${s.approvalsOver3Days > 1 ? 's' : ''} waiting more than 3 days.</b>` : 'No approval waiting more than 3 days.'} ${daysNote}</p>
          ${['DEO_OFFICE', 'ADMIN'].includes(role()) ? `<button class="btn alt" onclick="go('cert',{})">Print certificates (${s.green})</button>` : ''}</div></div>
        <div class="card"><div class="row"><div><label>Halqa</label><select id="ihq">${opts(halqas, hq, 'All')}</select></div><div><label>Level</label><select id="ilv">${opts(levels, lv, 'All')}</select></div></div>
          <div class="list">${f.slice(0, 600).map(x => `<div class="it tap" onclick="pick('${esc(x.emis)}');setTimeout(()=>go('impl'),50)"><span class="isc ${x.band}">${x.score}</span><div class="grow"><b>${esc(x.name)}</b>
            <div class="sub">${esc(x.halqa || '')} · ${esc(x.level)} · setup ${Math.round(x.setup)}/40 · monthly ${Math.round(x.monthly)}/20 · daily ${Math.round(x.daily)}/40</div>
            ${x.items.length ? `<div class="sub">To do: ${esc(x.items.slice(0, 3).map(i => i.label).join('; '))}${x.items.length > 3 ? '…' : ''}</div>` : ''}</div><span class="chev">›</span></div>`).join('') || '<p class="muted">None.</p>'}</div></div>`;
      document.querySelectorAll('.ich').forEach(b => b.onclick = () => { band = band === b.dataset.b ? '' : b.dataset.b; LS.set('iband', band); draw(); });
      $('#ihq').onchange = e => { hq = e.target.value; LS.set('ih', hq); draw(); }; $('#ilv').onchange = e => { lv = e.target.value; LS.set('il', lv); draw(); };
    };
    draw();
  }
};
window.IMPLGO = v => go(v === 'settings' ? 'settings' : v);

/* ---------- certificates ---------- */
V.cert = () => `<div class="card noprint"><h2>Certificates of appreciation</h2>
  <p class="muted">One certificate for each fully implemented institution (index 90 or more), addressed to its head. Print on A4 landscape, then sign.</p>
  <div class="row"><div><label>Implemented by</label><input type="date" id="cdt" value="2026-12-01"></div><div><label>Halqa</label><select id="chq"><option value="">All</option></select></div></div>
  <label>Signature blocks</label><div class="chips" id="csig">${['District Education Officer (Male) Muzaffarabad', 'Secretary Elementary & Secondary Education', 'Minister for Elementary & Secondary Education'].map((x, k) => `<button type="button" class="on" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>
  <button class="btn" onclick="window.print()">Print</button> <span class="muted" id="ccount"></span></div><div id="certs"></div>`;
BIND.cert = async () => {
  let j = LS.get('impl_' + S.user.code, null);
  if (!j || !j.institutions) { try { j = await api('implementation', {}); } catch (e) { j = null; } }
  if (!j || !j.institutions) { $('#certs').innerHTML = '<div class="card"><div class="msg w">Open the Implementation screen once while online, then come back.</div></div>'; return; }
  const greens = (j.institutions || []).filter(x => x.band === 'green');
  const hs = [...new Set(greens.map(x => x.halqa).filter(Boolean))].sort(); $('#chq').innerHTML = opts(hs, '', 'All');
  const draw = () => {
    const hq = $('#chq').value, dt = $('#cdt').value, sig = [...document.querySelectorAll('#csig button.on')].map(b => b.dataset.v), list = greens.filter(x => !hq || x.halqa === hq);
    $('#ccount').textContent = list.length + ' certificate' + (list.length === 1 ? '' : 's');
    $('#certs').innerHTML = list.map(x => `<section class="certp"><div class="cfr"><div class="cin">
        <div class="cseal">AJK<br>E&amp;SE</div>
        <div class="cgov">Azad Government of the State of Jammu &amp; Kashmir<br>Elementary &amp; Secondary Education Department</div>
        <h1>Certificate of Appreciation</h1>
        <p class="cby">is awarded to</p><p class="cname">${esc(x.head || 'The Head')}</p><p class="cof">Head, ${esc(x.name)}${x.halqa ? ', ' + esc(x.halqa) : ''}</p>
        <p class="ctext">in recognition of the complete implementation of the District School Data System by ${esc(DT.words(dt))}: staff and student registers, building profile, timetable, School Management Committee, monthly returns and daily attendance of teachers and students, with an implementation index of <b>${x.score}</b> out of 100.</p>
        <div class="csig">${sig.map(s => `<div><span></span>${esc(s)}</div>`).join('')}</div>
        <p class="cfoot">District Education Office (Male) Muzaffarabad · EMIS ${esc(x.emis)}</p></div></div></section>`).join('') || '<div class="card"><p class="muted">No institution has reached 90 yet.</p></div>';
  };
  $('#chq').onchange = draw; $('#cdt').addEventListener('change', draw);
  document.querySelectorAll('#csig button').forEach(b => b.onclick = () => { b.classList.toggle('on'); draw(); });
  draw();
};
