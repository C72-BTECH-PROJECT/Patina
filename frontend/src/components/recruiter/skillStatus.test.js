import { skillStatusView } from './ScoreBreakdown';

describe('skillStatusView: the skill-evidence status badge', () => {
  test('known statuses keep their category', () => {
    expect(skillStatusView('matched').label).toBe('Evidenced');
    expect(skillStatusView('missing').label).toBe('Not found');
    expect(skillStatusView('claimed_only').label).toBe('Claimed only');
  });

  test('an unknown status is shown as unknown with its raw value, never as a real category', () => {
    const v = skillStatusView('partially_verified');
    expect(v.label).toBe('Unknown status: partially verified');
    expect(v.variant).toBe('outline');
    for (const raw of [undefined, null, '', 'constructor', 'toString']) {
      const view = skillStatusView(raw);
      expect(['Evidenced', 'Not found', 'Claimed only']).not.toContain(view.label);
      expect(view.label).toMatch(/^Unknown status/);
    }
  });
});
