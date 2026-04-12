export const AB_HERO_CTA = 'hero_cta';
export const AB_JOB_CARD_LAYOUT = 'job_card_layout';

export function getABGroup(testName) {
  const key = `ab_${testName}`;
  try {
    const stored = localStorage.getItem(key);
    if (stored === 'A' || stored === 'B') return stored;
    const group = Math.random() < 0.5 ? 'A' : 'B';
    localStorage.setItem(key, group);
    return group;
  } catch {
    // localStorage unavailable (private browsing / quota exceeded) — return random
    return Math.random() < 0.5 ? 'A' : 'B';
  }
}

export function getHeroCTAText() {
  return getABGroup(AB_HERO_CTA) === 'A' ? 'Book a Service' : 'Find Workers Near You';
}

export function getJobCardLayout() {
  return getABGroup(AB_JOB_CARD_LAYOUT) === 'A' ? 'grid' : 'list';
}
