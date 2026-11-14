import { educationLine } from './education';

// R-30 follow-up: both stored shapes of an education entry read as one line, never JSON.
describe('educationLine', () => {
  const full = {
    institution: 'Example Institute of Technology, Pune',
    degree: 'Bachelor of Technology in Computer Engineering',
    dates: '2021 – 2025',
    graduation_year: 2025,
    grade: 'CGPA: 8.72/10',
    honours: 'Honours in Artificial Intelligence',
    text: 'Example Institute of Technology, Pune · Bachelor of Technology in Computer Engineering · 2021 - 2025 | CGPA: 8.72/10 · Honours in Artificial Intelligence',
  };

  test('an object (nlp-engine 2.1.0) gives degree, institution, dates, grade and honours', () => {
    expect(educationLine(full)).toBe(
      'Bachelor of Technology in Computer Engineering · Example Institute of Technology, Pune · 2021 – 2025 · CGPA: 8.72/10 · Honours in Artificial Intelligence',
    );
  });

  test('missing parts are left out; the graduation year stands in for missing dates', () => {
    expect(educationLine({ ...full, dates: null, grade: null, honours: null })).toBe(
      'Bachelor of Technology in Computer Engineering · Example Institute of Technology, Pune · 2025',
    );
    expect(educationLine({ degree: 'B.Sc. Physics', institution: null, dates: null, graduation_year: null, grade: '85%', honours: null, text: 'B.Sc. Physics 85%' }))
      .toBe('B.Sc. Physics · 85%');
  });

  test('an object with neither degree nor institution shows the parser\'s text of the entry', () => {
    expect(educationLine({ institution: null, degree: null, dates: '2019', graduation_year: 2019, grade: null, honours: null, text: 'Diploma, 2019' }))
      .toBe('Diploma, 2019');
  });

  test('an old string entry (parsed before 2.1.0) is shown as it is', () => {
    expect(educationLine('B.Tech in Computer Science - Example Institute of Technology (2018 - 2022)'))
      .toBe('B.Tech in Computer Science - Example Institute of Technology (2018 - 2022)');
  });

  test('nothing readable gives null, never JSON', () => {
    for (const v of [null, undefined, '', '   ', 42, [], {}, { degree: { nested: true }, text: '' }]) {
      expect(educationLine(v)).toBeNull();
    }
  });
});
