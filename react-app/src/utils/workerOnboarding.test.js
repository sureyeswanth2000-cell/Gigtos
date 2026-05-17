import {
  getWorkerOnboardingChecklist,
  getWorkerOnboardingPromise,
  WORKER_FIRST_TEN_MINUTE_STEPS,
} from './workerOnboarding';

describe('worker onboarding funnel', () => {
  test('keeps the first ten minute checklist in a clear ordered flow', () => {
    expect(WORKER_FIRST_TEN_MINUTE_STEPS.map((step) => step.id)).toEqual([
      'language',
      'auth',
      'services',
      'area',
      'proof',
      'photo',
      'pricing',
      'promise',
      'socio_score',
      'bank',
      'first_action',
    ]);
  });

  test('calculates checklist progress from worker profile signals', () => {
    const checklist = getWorkerOnboardingChecklist({
      language: 'en',
      phone: '+919876543210',
      serviceTypes: ['maid'],
      serviceArea: 'HSR Layout',
      acceptedLaunchTerms: true,
    });

    expect(checklist.completedCount).toBe(5);
    expect(checklist.totalCount).toBe(11);
    expect(checklist.progressPercent).toBe(45);
    expect(checklist.currentStep.id).toBe('proof');
  });

  test('states no commission launch promise and previous-platform access', () => {
    const regular = getWorkerOnboardingPromise();
    expect(regular.noCommission).toBe(true);
    expect(regular.workerKeepsJobEarnings).toBe(true);
    expect(regular.access.freeDays).toBe(30);
    expect(regular.summary).toContain('first 30 days free');

    const verified = getWorkerOnboardingPromise({ hasVerifiedExternalPlatform: true });
    expect(verified.access.freeDays).toBe(365);
    expect(verified.summary).toContain('one-year free access');
    expect(verified.freedomPromise).toContain('No exclusivity');
  });
});
