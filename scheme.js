/* Subjects for result entry — DCRD Revised Scheme of Studies (Pre-I to XII), March 2025, NCP 2022-23.
   [subject, max marks]; GRADE areas are recorded as A/B/C/D counts. */
const SCHEME = (() => {
  const G1 = ['Foundational skills & character building', 'Library / additional reading', 'Physical training'];
  const G2 = ['Personal growth & responsible citizenship', 'Co-curricular activities'];
  const G3 = ['Good citizenship & character building', 'Co-curricular activities'];
  const I_III = [['Urdu', 100], ['English', 100], ['Mathematics', 100], ['Islamiat / Religious Education', 50], ['General Knowledge', 100], ['Nazra Quran & Tajweed / Ethics', 50]];
  const IV_V = [['Urdu', 100], ['English', 100], ['Mathematics', 100], ['Islamiat / Religious Education', 50], ['Science', 100], ['Social Studies', 50], ['Nazra Quran / Ethics', 50]];
  const VI_VIII = [['Urdu', 100], ['English', 100], ['Mathematics', 100], ['Islamiat / Religious Education', 50], ['Science', 100], ['Geography', 50],
    ['History', 50], ['Computer Education', 50], ['Understanding the Holy Quran / Ethics', 75]];
  const OPT_VI_VIII = ['Arabic', 'Drawing', 'Health & Physical Education', 'Home Economics', 'Agriculture', 'Electricity', 'Woodwork', 'Metalwork', 'Calligraphy'];
  const core910 = cls => [['Urdu', 75], ['English', 75], cls === 'IX' ? ['Islamiat / Religious Education', 100] : ['Pakistan Studies', 100], ['Understanding the Holy Quran / Ethics', 50]];
  const ELECT_910 = ['Civics', 'Home Economics', 'Agriculture', 'Physiology & Hygiene', 'History of Pakistan', 'Arabic', 'Chinese', 'Punjabi', 'Kashmiri', 'Gojri',
    'Computer Science & IT', 'Geography', 'Food & Nutrition', 'Textile & Clothing', 'Advance Islamic Studies', 'Islamic History', 'Business Administration/Studies',
    'Environmental Studies', 'Urdu Literature', 'Education', 'Physical Education', 'Economics', 'English Literature', 'History of Civilizations',
    'Commercial Geography', 'Kashmiriat', 'Psychology', 'History of Kashmir', 'Art, Model Drawing, Fine Arts', 'Computer Graphics & Animation', 'Statistics'];
  const TRADES_910 = ['Fashion Designing', 'Dress Making', 'Beautician & Cosmetology', 'Aesthetic Science & Health', 'Introduction to Plumbing/Solar Water Heater',
    'Technical Drawing & Plumbing Design', 'Basic HVACR', 'Applied HVACR', 'Applied Electrician', 'Domestic Electrician', 'Graphic Designing', 'Media Production',
    'Hospitality & Hotel Management', 'Tourism Management', 'Fundamentals of IOT', 'Cloud Computing', 'Professional Cooking & Chef', 'Culinary Arts & Food Science',
    'Welding (Gas & Basic ARC)', 'Welding (Advanced ARC)', 'Woodworking Techniques & Practices', 'Wood Design & Manufacturing'];
  const core1112 = cls => [['Urdu', 100], ['English', 100], cls === 'XI' ? ['Islamiat / Religious Education', 50] : ['Pakistan Studies', 50], ['Understanding the Holy Quran / Ethics', 50]];
  const ELECT_1112 = ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Statistics', 'Computer Science', 'Economics', 'Civics', 'Islamic History', 'Islamic Studies',
    'Health & Physical Education', 'History of Pakistan', 'Computer Graphics & Animation', 'Library Science', 'History of Kashmir', 'History of Modern World',
    'Geography', 'Psychology', 'Agriculture', 'Law & Judicial System', 'Philosophy', 'English Literature', 'Home Economics', 'History of Muslim India', 'Arabic',
    'Urdu (Elective)', 'Education', 'Art, Model Drawing & Fine Arts', 'Sociology', 'Clothing & Textile', 'Islamic Culture', 'Kashmir Studies (Kashmiriat)',
    'Archeology', 'Environmental Studies', 'Persian', 'Principles of Commerce', 'Principles of Economics', 'Business Mathematics', 'Principles of Accounting-I',
    'Business Statistics', 'Banking / Computer Studies', 'Commercial Geography', 'Principles of Accounting-II', 'Journalism', 'Film & Broadcasting',
    'Media & Communication'];
  const TRADES_1112 = TRADES_910.concat(['Foundation of Exercises & Sport Science', 'Fitness & Sports Training', 'Road & Bridge Construction Technology',
    'Construction Materials, Testing & Surveying', 'Advertising', 'Computer Application', 'Marketing', 'Event Management', 'Entrepreneurship', 'HRM',
    'Computer Hardware', 'Automation & Robotics Technology']);
  const AHS = ['Medical Laboratory Science', 'Dental Hygiene Science', 'Operation Theatre Science', 'Medical Imaging & Ultrasound Science', 'Physiotherapy Science',
    'Optometry Science', 'Cardiac Care Science', 'Nursing', 'Dispensing & Pharmacy Science', 'Public Health', 'Emergency Technology', 'Midwifery',
    'Anesthesia Technology', 'Endoscopy Technology', 'Dialysis Technology', 'Respiratory Therapy', 'Neurophysiology', 'CSSD Technician', 'Dental Technology'];

  /** returns {groups:[...], subjects(group)->{fixed:[[s,max]], electives:[names], electiveMax, grades:[...]}} */
  function forClass(cls) {
    if (['I', 'II', 'III'].includes(cls)) return { groups: [''], get: () => ({ fixed: I_III, electives: [], grades: G1 }) };
    if (['IV', 'V'].includes(cls)) return { groups: [''], get: () => ({ fixed: IV_V, electives: [], grades: G1 }) };
    if (['VI', 'VII', 'VIII'].includes(cls)) return { groups: [''], get: () => ({ fixed: VI_VIII, electives: OPT_VI_VIII, electiveMax: 75, electiveReq: 1, grades: G2 }) };
    if (['IX', 'X'].includes(cls)) return {
      groups: ['Science', 'General (Humanities)', 'Matric Tech'],
      get: g => g === 'Science'
        ? { fixed: core910(cls).concat([['Mathematics', 75], ['Physics', 75], ['Chemistry', 75], ['Biology', 75], ['Computer Education & IT', 75]]), electives: [], grades: G3 }
        : g === 'Matric Tech'
          ? { fixed: core910(cls).concat([['General Mathematics', 75], ['General Science', 75]]), electives: TRADES_910, electiveMax: 75, grades: G3 }
          : { fixed: core910(cls).concat([['General Mathematics', 75], ['General Science', 75]]), electives: ELECT_910, electiveMax: 75, grades: G3 }
    };
    if (['XI', 'XII'].includes(cls)) return {
      groups: ['General Education', 'Inter-Tech', 'Allied Health Science'],
      get: g => g === 'Inter-Tech'
        ? { fixed: core1112(cls), electives: TRADES_1112, electiveMax: 75, grades: G3 }
        : g === 'Allied Health Science'
          ? { fixed: core1112(cls).concat([['Applied Science', 75], ['Basic Medical Science', 75]]), electives: AHS, electiveMax: 150, grades: G3 }
          : { fixed: core1112(cls), electives: ELECT_1112, electiveMax: 100, grades: G3 }
    };
    return null;   // ECE: formative assessment only
  }
  /* periods per week, DCRD Scheme of Studies 2025 (summer zone); 8 periods a day, 5 on Friday = 45 slots */
  const P = {
    I_III: { 'Urdu': 7, 'English': 7, 'Mathematics': 6, 'Islamiat / Religious Education': 4, 'General Knowledge': 5, 'Nazra Quran & Tajweed / Ethics': 4,
      'Foundational skills & character building': 3, 'Library / additional reading': 2, 'Physical training': 2 },
    IV_V: { 'Urdu': 6, 'English': 6, 'Mathematics': 7, 'Islamiat / Religious Education': 4, 'Science': 7, 'Social Studies': 4, 'Nazra Quran / Ethics': 4,
      'Foundational skills & character building': 3, 'Library / additional reading': 2, 'Physical training': 2 },
    VI_VIII: { 'Urdu': 5, 'English': 5, 'Mathematics': 6, 'Islamiat / Religious Education': 3, 'Science': 6, 'Geography': 3, 'History': 3, 'Computer Education': 3,
      'Understanding the Holy Quran / Ethics': 4, '*elective': 3, 'Personal growth & responsible citizenship': 2, 'Co-curricular activities': 2 },
    IX_X: { 'Urdu': 5, 'English': 5, 'Islamiat / Religious Education': 5, 'Pakistan Studies': 5, 'Understanding the Holy Quran / Ethics': 3, 'Mathematics': 6, 'Physics': 6, 'Chemistry': 6,
      'Biology': 6, 'Computer Education & IT': 6, 'General Mathematics': 6, 'General Science': 6, '*elective': 6, 'Good citizenship & character building': 2, 'Co-curricular activities': 1 },
    XI_XII: { 'Urdu': 6, 'English': 6, 'Islamiat / Religious Education': 3, 'Pakistan Studies': 3, 'Understanding the Holy Quran / Ethics': 5, 'Applied Science': 6, 'Basic Medical Science': 6,
      '*elective': 6, 'Good citizenship & character building': 1, 'Co-curricular activities': 1 }
  };
  const band = c => ['I', 'II', 'III'].includes(c) ? 'I_III' : ['IV', 'V'].includes(c) ? 'IV_V' : ['VI', 'VII', 'VIII'].includes(c) ? 'VI_VIII' : ['IX', 'X'].includes(c) ? 'IX_X' : ['XI', 'XII'].includes(c) ? 'XI_XII' : '';
  /** subjects taught in a class-section with the scheme's periods: [{subject, periods, kind:'core'|'elective'|'grade'}] */
  function timetableSubjects(cls, group, electives) {
    if (cls === 'ECE') return [{ subject: 'ECE activities (class teacher)', periods: 40, kind: 'core' }];
    const f = forClass(cls); if (!f) return [];
    const g = f.get(group || f.groups[0]), pb = P[band(cls)] || {};
    const out = g.fixed.map(([s]) => ({ subject: s, periods: pb[s] || 0, kind: 'core' }));
    (electives || []).forEach(s => out.push({ subject: s, periods: pb['*elective'] || 0, kind: 'elective' }));
    g.grades.forEach(s => out.push({ subject: s, periods: pb[s] || 0, kind: 'grade' }));
    if (['IX', 'X'].includes(cls) && (group || f.groups[0]) === 'Science') { const c = out.find(x => x.subject === 'Computer Education & IT'); if (c) { c.periods = 0; c.alt = 'Biology'; } }
    // Science / Computer in IX-X are alternatives: students take one; both are listed so each section can drop the one it does not teach
    return out;
  }
  /** how many electives a section of this class and group takes */
  function electiveCount(cls, group) { if (['VI', 'VII', 'VIII'].includes(cls)) return 1; if (['IX', 'X'].includes(cls)) return group === 'Science' ? 0 : 2; if (['XI', 'XII'].includes(cls)) return group === 'General Education' || !group ? 3 : 2; return 0; }
  return { forClass, timetableSubjects, electiveCount };
})();
