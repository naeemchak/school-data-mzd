/* =====================================================================
   BUILDING AND FACILITIES PROFILE (v4 part C)
   One record per institution, entered once by the head, updated when
   something changes, verified by the supervising officer on inspection.
   Field list mirrors SHEETS.Facilities on the server.
   ===================================================================== */

const YN = ['Yes', 'No'];
const FAC = [
  { id: 'A', title: 'Building', hint: 'Where the school runs and what state it is in.', fields: [
    { k: 'building_status', l: 'Building status', t: 'sel', o: ['Own government building', 'Rented', 'Rent-free (private / community)', 'Donated (not yet transferred)', "Running in another school's building", 'Mosque / community hall', 'Tent', 'Shelterless (no building)'], req: 1 },
    { k: 'rent_monthly', l: 'Monthly rent (Rs)', t: 'num', when: d => d.building_status === 'Rented' },
    { k: 'rented_since', l: 'Rented since (year)', t: 'year', when: d => d.building_status === 'Rented' },
    { k: 'host_school', l: 'Host school', t: 'txt', when: d => /another school/.test(d.building_status) },
    { k: 'shelterless_where', l: 'Where are classes held?', t: 'sel', o: ['Open ground', 'Veranda of another building', 'Private house', 'Other'], when: d => /^Shelterless/.test(d.building_status) },
    { k: 'shelterless_since', l: 'Shelterless since (year)', t: 'year', when: d => /^Shelterless/.test(d.building_status) },
    { k: 'built_by', l: 'Built by', t: 'sel', o: ['Government (development scheme)', 'ERRA / SERRA (post-2005 reconstruction)', 'NGO / INGO', 'Community / self-help', 'Philanthropist', 'Other'], when: d => hasBuilding_(d) },
    { k: 'built_by_name', l: 'Name of the NGO / philanthropist', t: 'txt', when: d => /NGO|Philanthropist|Other/.test(d.built_by) && hasBuilding_(d) },
    { k: 'year_built', l: 'Year of construction', t: 'year', when: hasBuilding_ },
    { k: 'blocks', l: 'Number of blocks', t: 'num', when: hasBuilding_ },
    { k: 'construction', l: 'Nature of construction', t: 'sel', o: ['Pakka (RCC / concrete)', 'Semi-pakka', 'Kacha', 'Prefabricated / steel structure'], when: hasBuilding_ },
    { k: 'storeys', l: 'Storeys', t: 'sel', o: ['Single', 'Double', 'Triple'], when: hasBuilding_ },
    { k: 'condition', l: 'Condition of building', t: 'sel', o: ['Good', 'Needs minor repair (school fund)', 'Needs major repair (engineering work)', 'Dangerous / needs reconstruction', 'Under construction'], when: hasBuilding_, req: 1 },
    { k: 'quake_damage', l: 'Earthquake 2005 / later disaster', t: 'sel', o: ['Not affected', 'Reconstructed', 'Reconstruction in progress', 'Damaged, not reconstructed'], when: hasBuilding_ },
    { k: 'civil_work', l: 'Civil work in progress', t: 'sel', o: ['None', 'Additional classrooms', 'Boundary wall', 'Reconstruction', 'Other'] },
    { k: 'civil_work_other', l: 'Describe the work', t: 'txt', when: d => d.civil_work === 'Other' },
    { k: 'occupation', l: 'Illegal occupation of any part', t: 'yn' },
    { k: 'occupation_by', l: 'By whom, since when', t: 'txt', when: d => d.occupation === 'Yes' },
    { k: 'land_total', l: 'Total land (kanal / marla)', t: 'txt' },
    { k: 'land_covered', l: 'Covered area (kanal / marla)', t: 'txt', when: hasBuilding_ },
    { k: 'land_expansion', l: 'Land available for expansion', t: 'yn' },
    { k: 'land_expansion_where', l: 'Where', t: 'txt', when: d => d.land_expansion === 'Yes' },
    { k: 'land_title', l: 'Title of land', t: 'sel', o: ['Transferred to Education Department', 'Not transferred', 'Disputed'] }
  ] },
  { id: 'B', title: 'Rooms', hint: 'Count rooms as they stand today.', when: hasBuilding_, fields: [
    { k: 'classrooms', l: 'Classrooms, total', t: 'num', req: 1 },
    { k: 'classrooms_usable', l: 'of these, usable', t: 'num', req: 1 },
    { k: 'classrooms_major_repair', l: 'needing major repair', t: 'num' },
    { k: 'classrooms_dangerous', l: 'dangerous', t: 'num' },
    { k: 'head_office', l: "Head's office", t: 'yn' }, { k: 'staff_room', l: 'Staff room', t: 'yn' }, { k: 'clerk_office', l: "Clerk's office", t: 'yn' }, { k: 'store', l: 'Store', t: 'yn' },
    { k: 'hall', l: 'Hall / auditorium', t: 'yn' }, { k: 'hall_capacity', l: 'Seating capacity', t: 'num', when: d => d.hall === 'Yes' },
    { k: 'lab', l: 'Science laboratory', t: 'multi', o: ['Combined', 'Physics', 'Chemistry', 'Biology'], lv: ['High', 'Higher Secondary'] },
    { k: 'lab_equipment', l: 'Laboratory equipment', t: 'sel', o: ['Sufficient', 'Deficient', 'None'], when: d => d.lab && d.lab !== 'None' },
    { k: 'computer_lab', l: 'Computer laboratory', t: 'yn' },
    { k: 'computer_lab_functional', l: 'Functional', t: 'yn', when: d => d.computer_lab === 'Yes' },
    { k: 'computer_lab_by', l: 'Established by', t: 'sel', o: ['Government', 'NGO', 'Private firm', 'Community'], when: d => d.computer_lab === 'Yes' },
    { k: 'computers_total', l: 'Computers, total', t: 'num', when: d => d.computer_lab === 'Yes' },
    { k: 'computers_working', l: 'Computers working', t: 'num', when: d => d.computer_lab === 'Yes' },
    { k: 'internet', l: 'Internet', t: 'yn' }, { k: 'internet_type', l: 'Type', t: 'sel', o: ['Broadband / fibre', 'Mobile data', 'Wireless (PTCL / other)'], when: d => d.internet === 'Yes' },
    { k: 'library', l: 'Library', t: 'yn' }, { k: 'library_books', l: 'Number of books', t: 'num', when: d => d.library === 'Yes' },
    { k: 'library_room', l: 'Kept in', t: 'sel', o: ['Separate room', 'Cupboard in another room'], when: d => d.library === 'Yes' },
    { k: 'exam_hall', l: 'Examination hall', t: 'yn', lv: ['High', 'Higher Secondary'] },
    { k: 'workshop', l: 'Technical workshop / home economics room', t: 'yn', lv: ['Middle', 'High', 'Higher Secondary'] },
    { k: 'hostel_capacity', l: 'Hostel capacity (0 if none)', t: 'num', lv: ['High', 'Higher Secondary'] },
    { k: 'residence_units', l: "Teachers' residences (units)", t: 'num' }
  ] },
  { id: 'C', title: 'Basic facilities', hint: 'Water, power, toilets, wall, access.', fields: [
    { k: 'electricity', l: 'Electricity connection', t: 'yn', req: 1 },
    { k: 'electricity_functional', l: 'Supply working', t: 'yn', when: d => d.electricity === 'Yes' },
    { k: 'power_alt', l: 'Alternative power', t: 'sel', o: ['None', 'Solar', 'UPS', 'Generator'] },
    { k: 'water', l: 'Drinking water available', t: 'yn', req: 1 },
    { k: 'water_source', l: 'Source', t: 'sel', o: ['Piped supply', 'Hand pump', 'Well', 'Spring', 'Tanker', 'Nearby house / mosque'], when: d => d.water === 'Yes' },
    { k: 'water_safe', l: 'Safe to drink', t: 'yn', when: d => d.water === 'Yes' },
    { k: 'toilets_total', l: 'Toilets, total', t: 'num', req: 1 }, { k: 'toilets_usable', l: 'usable', t: 'num', req: 1 },
    { k: 'toilets_students', l: 'for students', t: 'num' }, { k: 'toilets_staff', l: 'for staff', t: 'num' },
    { k: 'toilets_girls', l: 'separate for girls', t: 'num', lv: ['Primary'] },
    { k: 'boundary_wall', l: 'Boundary wall', t: 'sel', o: ['None', 'Partial', 'Complete'], req: 1 },
    { k: 'wall_condition', l: 'Wall condition', t: 'sel', o: ['Satisfactory', 'Damaged'], when: d => d.boundary_wall && d.boundary_wall !== 'None' },
    { k: 'playground', l: 'Playground', t: 'yn' }, { k: 'playground_where', l: 'Playground is', t: 'sel', o: ['Within premises', 'Away from school'], when: d => d.playground === 'Yes' },
    { k: 'ramp_entrance', l: 'Ramp at entrance', t: 'yn' }, { k: 'ramp_building', l: 'Ramp inside building', t: 'yn' }, { k: 'ramp_toilets', l: 'Accessible toilet', t: 'yn' },
    { k: 'gas', l: 'Gas connection', t: 'yn' }, { k: 'canteen', l: 'Canteen', t: 'yn' }
  ] },
  { id: 'D', title: 'Furniture', hint: 'For each item: usable, unusable, and how many more are needed.', fields: [
    { k: 'desks', l: 'Student desks / benches (2-seater)', t: 'tri' }, { k: 'tablet_chairs', l: 'Tablet chairs', t: 'tri' }, { k: 'mats', l: 'Jute mats / carpets', t: 'tri' },
    { k: 'teacher_tables', l: 'Teacher tables', t: 'tri' }, { k: 'teacher_chairs', l: 'Teacher chairs', t: 'tri' }, { k: 'office_furniture', l: 'Office furniture (sets)', t: 'tri' },
    { k: 'almirahs', l: 'Almirahs / cupboards', t: 'tri' }, { k: 'boards', l: 'Black / white boards', t: 'tri' }, { k: 'fans', l: 'Fans', t: 'tri' }, { k: 'water_tank', l: 'Water tanks', t: 'tri' }
  ] },
  { id: 'E', title: 'Security and ICT', hint: '', fields: [
    { k: 'chowkidar', l: 'Chowkidar post filled', t: 'yn' }, { k: 'gate', l: 'Main gate', t: 'yn' }, { k: 'barbed_wire', l: 'Barbed wire on wall', t: 'yn' }, { k: 'cctv', l: 'CCTV', t: 'yn' },
    { k: 'biometric', l: 'Biometric attendance device', t: 'yn' }, { k: 'biometric_make', l: 'Make / model', t: 'txt', when: d => d.biometric === 'Yes' }, { k: 'biometric_working', l: 'Working', t: 'yn', when: d => d.biometric === 'Yes' },
    { k: 'multimedia', l: 'Multimedia / projector', t: 'yn' }, { k: 'smart_board', l: 'Smart board', t: 'yn' }
  ] },
  { id: 'F', title: 'Location', hint: 'Capture the position while standing on the school premises.', fields: [
    { k: 'gps', l: 'GPS position', t: 'gps' },
    { k: 'road_km', l: 'Distance to nearest metalled road (km)', t: 'dec' },
    { k: 'nearest_school_km', l: 'Distance to nearest government middle / high school (km)', t: 'dec' },
    { k: 'notes', l: 'Anything else the office should know', t: 'txt' }
  ] }
];
function hasBuilding_(d) { return d.building_status && !/^Shelterless|^Tent/.test(d.building_status); }

const B = {   // state of the open form
  data: {}, sec: 'A', gps: null,
  visible(f, d) { if (f.lv && !f.lv.includes(inst().level)) return false; return !f.when || f.when(d); },
  sections() { return FAC.filter(s => !s.when || s.when(B.data)); },
  done(s) {   // every required field answered, and at least one field of the section touched
    const d = B.data, vis = s.fields.filter(f => f.t !== 'gps' && B.visible(f, d));
    const has = f => f.t === 'tri' ? ['u', 'x', 'r'].some(x => d[f.k + '_' + x]) : !!d[f.k];
    return vis.every(f => !f.req || has(f)) && (vis.some(has) || (s.id === 'F' && !!B.gps));
  },
  missing() { const d = B.data, out = []; B.sections().forEach(s => s.fields.forEach(f => { if (f.req && B.visible(f, d) && !d[f.k]) out.push(f.l); })); return out; }
};

V.building = () => {
  const d = D(); if (!d) return noData();
  const f = d.facilities || {};
  B.data = {}; Object.keys(f).forEach(k => { if (f[k] !== '' && f[k] != null) B.data[k] = String(f[k]); });
  B.gps = f.gps_lat ? { lat: f.gps_lat, lng: f.gps_lng, acc: f.gps_acc, at: f.gps_at } : null;
  const st = f.status;
  const badge = !st ? '' : `<span class="pill ${st === 'Approved' || st === 'Accepted' ? 'ok' : st === 'Returned' ? 'bad' : ''}">${st === 'Accepted' ? 'Recorded' : st}</span>`;
  return `<div class="card noprint"><div class="db-sh rhead"><h3>Building and facilities ${badge}</h3></div>
    ${!st ? '<p class="muted">Entered once, then updated only when something changes. The supervising officer verifies it on inspection.</p>'
      : `<p class="muted">Last updated ${esc(f.updated_on)} by ${esc(f.submitted_by)}${f.reviewed_by ? ' · ' + (st === 'Returned' ? 'returned' : 'verified') + ' by ' + esc(f.reviewed_by) + ' on ' + esc(f.reviewed_on) : ''}${f.remark ? '<br><b>Remarks:</b> ' + esc(f.remark) : ''}</p>`}
    <div class="seg fsec" id="fsec"></div></div>
    <div id="fbody"></div>
    <div class="decide noprint"><button class="btn" id="fsave">Save profile</button><button class="btn alt" id="fnext">Next section ›</button></div>`;
};

BIND.building = () => {
  const draw = () => {
    const secs = B.sections(); if (!secs.find(s => s.id === B.sec)) B.sec = secs[0].id;
    $('#fsec').innerHTML = secs.map(s => `<button class="${s.id === B.sec ? 'on' : ''} ${B.done(s) ? 'done' : ''}" data-s="${s.id}">${B.done(s) ? '✓ ' : ''}${esc(s.title)}</button>`).join('');
    $('#fsec').querySelectorAll('button').forEach(b => b.onclick = () => { B.sec = b.dataset.s; draw(); window.scrollTo(0, 0); });
    const s = secs.find(x => x.id === B.sec), d = B.data;
    $('#fbody').innerHTML = `<div class="card"><h2>${esc(s.title)}</h2>${s.hint ? `<p class="muted">${esc(s.hint)}</p>` : ''}
      ${s.fields.filter(f => B.visible(f, d)).map(fld).join('')}</div>`;
    $('#fnext').style.display = secs.indexOf(s) === secs.length - 1 ? 'none' : '';
    $('#fnext').onclick = () => { B.sec = secs[secs.indexOf(s) + 1].id; draw(); window.scrollTo(0, 0); };
    bindFields();
  };
  const fld = f => {
    const d = B.data, v = d[f.k] || '';
    if (f.t === 'sel') return `<label>${esc(f.l)}${f.req ? ' *' : ''}</label><select data-k="${f.k}">${opts(f.o, v, '— choose —')}</select>`;
    if (f.t === 'yn') return `<div class="ynrow"><span>${esc(f.l)}${f.req ? ' *' : ''}</span><div class="yn" data-k="${f.k}">${YN.map(o => `<button type="button" class="${v === o ? 'on' : ''}" data-v="${o}">${o}</button>`).join('')}</div></div>`;
    if (f.t === 'num') return `<label>${esc(f.l)}${f.req ? ' *' : ''}</label><input type="number" inputmode="numeric" min="0" step="1" data-k="${f.k}" value="${esc(v)}">`;
    if (f.t === 'dec') return `<label>${esc(f.l)}</label><input type="number" inputmode="decimal" min="0" step="0.1" data-k="${f.k}" value="${esc(v)}">`;
    if (f.t === 'year') return `<label>${esc(f.l)}</label><input type="number" inputmode="numeric" min="1900" max="2100" data-k="${f.k}" value="${esc(v)}" placeholder="e.g. 2008">`;
    if (f.t === 'txt') return `<label>${esc(f.l)}</label><input data-k="${f.k}" value="${esc(v)}" maxlength="200">`;
    if (f.t === 'multi') { const set = v.split(',').map(x => x.trim()); return `<label>${esc(f.l)}</label><div class="chips" data-k="${f.k}"><button type="button" class="${v === 'None' ? 'on' : ''}" data-v="None">None</button>${f.o.map(o => `<button type="button" class="${set.includes(o) ? 'on' : ''}" data-v="${o}">${o}</button>`).join('')}</div>`; }
    if (f.t === 'tri') return `<div class="tri"><label>${esc(f.l)}</label><div class="tri3">${[['u', 'usable'], ['x', 'unusable'], ['r', 'more needed']].map(([s, l]) => `<div><input type="number" inputmode="numeric" min="0" data-k="${f.k}_${s}" value="${esc(d[f.k + '_' + s] || '')}" placeholder="0"><small>${l}</small></div>`).join('')}</div></div>`;
    if (f.t === 'gps') return `<div class="gps" id="gps">${gpsHtml()}</div>`;
    return '';
  };
  const gpsHtml = () => B.gps ? `<div class="gps-ok"><b>${Number(B.gps.lat).toFixed(5)}, ${Number(B.gps.lng).toFixed(5)}</b><div class="sub">accuracy ± ${Math.round(B.gps.acc || 0)} m · ${esc(B.gps.at)}</div>
      <a class="sub" href="https://maps.google.com/?q=${B.gps.lat},${B.gps.lng}" target="_blank" rel="noopener">Open in Maps</a></div><button class="btn alt" type="button" id="gpsb">Capture again</button>`
    : `<p class="muted">No position recorded yet.</p><button class="btn" type="button" id="gpsb">Capture GPS position</button>`;
  const bindFields = () => {
    const root = $('#fbody');
    root.querySelectorAll('select[data-k],input[data-k]').forEach(el => {
      el.onchange = el.oninput = () => { if (el.value === '') delete B.data[el.dataset.k]; else B.data[el.dataset.k] = el.value; if (el.tagName === 'SELECT') draw(); };
    });
    root.querySelectorAll('.yn').forEach(g => g.querySelectorAll('button').forEach(b => b.onclick = () => { B.data[g.dataset.k] = b.dataset.v; draw(); }));
    root.querySelectorAll('.chips').forEach(g => g.querySelectorAll('button').forEach(b => b.onclick = () => {
      const k = g.dataset.k, cur = (B.data[k] || '').split(',').map(x => x.trim()).filter(x => x && x !== 'None');
      if (b.dataset.v === 'None') B.data[k] = 'None'; else { const i = cur.indexOf(b.dataset.v); if (i >= 0) cur.splice(i, 1); else cur.push(b.dataset.v); B.data[k] = cur.join(', '); }
      draw();
    }));
    const gb = $('#gpsb'); if (gb) gb.onclick = captureGps;
  };
  const captureGps = () => {
    if (!navigator.geolocation) return toast('This phone cannot give a position');
    const gb = $('#gpsb'); gb.disabled = true; gb.textContent = 'Finding position…';
    navigator.geolocation.getCurrentPosition(pos => {
      B.gps = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, at: new Date().toISOString().slice(0, 16).replace('T', ' ') };
      $('#gps').innerHTML = gpsHtml(); $('#gpsb').onclick = captureGps;
      if (pos.coords.accuracy > 50) toast('Accuracy is low (± ' + Math.round(pos.coords.accuracy) + ' m). Stand in the open and capture again.');
    }, err => { gb.disabled = false; gb.textContent = 'Capture GPS position'; toast(err.code === 1 ? 'Location permission was refused. Allow it in the phone settings for this site.' : 'Position not found. Move to the open and try again.'); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  };
  $('#fsave').onclick = () => {
    const miss = B.missing();
    if (miss.length) { toast('Still needed: ' + miss.slice(0, 3).join(', ') + (miss.length > 3 ? '…' : '')); const s = B.sections().find(x => !B.done(x)); if (s) { B.sec = s.id; draw(); } return; }
    if (Number(B.data.classrooms_usable || 0) > Number(B.data.classrooms || 0)) { B.sec = 'B'; draw(); return toast('Usable classrooms cannot exceed the total'); }
    const data = {}; FAC.forEach(s => s.fields.forEach(f => { if (f.t === 'tri') ['u', 'x', 'r'].forEach(x => { data[f.k + '_' + x] = B.data[f.k + '_' + x] || ''; }); else if (f.t !== 'gps') data[f.k] = B.visible(f, B.data) && (!s.when || s.when(B.data)) ? (B.data[f.k] || '') : ''; }));
    queue('saveFacilities', { emis: S.emis, data, gps: B.gps }, 'Building profile: ' + (inst().name || S.emis));
    const d = D(); d.facilities = Object.assign({}, d.facilities || {}, data, B.gps ? { gps_lat: B.gps.lat, gps_lng: B.gps.lng, gps_acc: B.gps.acc, gps_at: B.gps.at } : {}, { status: role() !== 'SCHOOL' ? 'Approved' : inst().approver === 'DEO' ? 'Accepted' : 'Submitted', updated_on: today(), submitted_by: S.operator || '' });
    saveD(d); toast('Profile saved'); if (S.arg && S.arg.review) return; back();
  };
  draw();
};

/* read-only rendering for the review screen and printing */
function facilitiesSummary(f) {
  const d = {}; Object.keys(f).forEach(k => { if (f[k] !== '' && f[k] != null) d[k] = String(f[k]); });
  return FAC.filter(s => !s.when || s.when(d)).map(s => {
    const rows = s.fields.filter(x => x.t !== 'gps' && (!x.when || x.when(d))).map(x => {
      if (x.t === 'tri') { const u = d[x.k + '_u'], xx = d[x.k + '_x'], r = d[x.k + '_r']; return (u || xx || r) ? `<b>${esc(x.l)}</b><span>${u || 0} usable · ${xx || 0} unusable · ${r || 0} needed</span>` : ''; }
      return d[x.k] ? `<b>${esc(x.l)}</b><span>${esc(d[x.k])}</span>` : '';
    }).filter(Boolean);
    if (s.id === 'F' && d.gps_lat) rows.unshift(`<b>GPS</b><span>${Number(d.gps_lat).toFixed(5)}, ${Number(d.gps_lng).toFixed(5)} (± ${Math.round(d.gps_acc || 0)} m, ${esc(d.gps_at)})<br><a href="https://maps.google.com/?q=${d.gps_lat},${d.gps_lng}" target="_blank" rel="noopener">Open in Maps</a></span>`);
    return rows.length ? `<h3>${esc(s.title)}</h3><div class="kv2">${rows.join('')}</div>` : '';
  }).join('');
}
