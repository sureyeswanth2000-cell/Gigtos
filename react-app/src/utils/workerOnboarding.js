import { getLaunchAccessPlan, WORKER_FREEDOM_PROMISE } from './workerSubscription';

export const WORKER_FIRST_TEN_MINUTE_STEPS = [
  {
    id: 'language',
    title: 'Choose language',
    detail: 'Start in English, Telugu, Hindi, Tamil, or Kannada when localization is available.',
    phase: 'account',
  },
  {
    id: 'auth',
    title: 'Enter phone and create login',
    detail: 'Phone and email keep booking, payout, and support records tied to one worker.',
    phase: 'account',
  },
  {
    id: 'services',
    title: 'Choose worker type and services',
    detail: 'Pick the main service first; more services can be added after verification.',
    phase: 'profile',
  },
  {
    id: 'area',
    title: 'Choose service area and 10 km base',
    detail: 'Gigtos uses area and radius to show nearby work without forcing long travel.',
    phase: 'profile',
  },
  {
    id: 'proof',
    title: 'Add previous platform proof',
    detail: 'UC, Pivot, or similar ID can unlock launch free access after review.',
    phase: 'verification',
  },
  {
    id: 'photo',
    title: 'Add profile photo',
    detail: 'A clear photo improves consumer trust and helps future verification checks.',
    phase: 'verification',
  },
  {
    id: 'pricing',
    title: 'Add starting price',
    detail: 'Workers set their price; Gigtos shows a suggested fair range by service and area.',
    phase: 'pricing',
  },
  {
    id: 'promise',
    title: 'Confirm no commission model',
    detail: 'Workers keep job earnings. Launch access is free first, then subscription based.',
    phase: 'trust',
  },
  {
    id: 'gig_score',
    title: 'Understand GigScore speedometer',
    detail: 'Workers start at 450 and become ready at 500 after required profile proof. Recovery and streak paths are explained before work starts.',
    phase: 'trust',
  },
  {
    id: 'bank',
    title: 'Bank setup now or later',
    detail: 'Payout details can be added later; cash platform fees must stay clear in wallet.',
    phase: 'payments',
  },
  {
    id: 'first_action',
    title: 'Finish verification or turn available',
    detail: 'Approved workers can turn on availability; pending workers wait for review.',
    phase: 'activation',
  },
];

const stepDoneRules = {
  language: ({ language }) => Boolean(language),
  auth: ({ hasLogin, phone, email }) => Boolean(hasLogin && (phone || email)),
  services: ({ serviceTypes = [] }) => serviceTypes.length > 0,
  area: ({ serviceArea }) => Boolean(serviceArea),
  proof: ({ hasExternalPlatformProof }) => Boolean(hasExternalPlatformProof),
  photo: ({ hasProfilePhoto }) => Boolean(hasProfilePhoto),
  pricing: ({ hasStartingPrice }) => Boolean(hasStartingPrice),
  promise: ({ acceptedLaunchTerms }) => Boolean(acceptedLaunchTerms),
  gig_score: ({ sawGigScoreIntro, sawSocioScoreIntro }) => Boolean(sawGigScoreIntro || sawSocioScoreIntro),
  bank: ({ bankSetupChoice }) => Boolean(bankSetupChoice),
  first_action: ({ approvalStatus, availabilityEnabled }) =>
    approvalStatus === 'approved' || Boolean(availabilityEnabled),
};

export function getWorkerOnboardingChecklist(profile = {}) {
  const steps = WORKER_FIRST_TEN_MINUTE_STEPS.map((step) => ({
    ...step,
    done: Boolean(stepDoneRules[step.id]?.(profile)),
  }));

  const completedCount = steps.filter((step) => step.done).length;
  const currentStep = steps.find((step) => !step.done) || steps[steps.length - 1];

  return {
    steps,
    completedCount,
    totalCount: steps.length,
    progressPercent: Math.round((completedCount / steps.length) * 100),
    currentStep,
  };
}

export function getWorkerOnboardingPromise({ hasVerifiedExternalPlatform = false } = {}) {
  const access = getLaunchAccessPlan({ hasVerifiedExternalPlatform });

  return {
    noCommission: true,
    workerKeepsJobEarnings: true,
    access,
    freedomPromise: WORKER_FREEDOM_PROMISE,
    summary: hasVerifiedExternalPlatform
      ? 'Verified previous-platform workers can unlock launch free access, aim for 600 GigScore, and keep using other apps.'
      : 'New workers get first 30 days free during launch, keep job earnings, and can continue using other apps.',
  };
}
