/**
 * AI Budget Suggestion Utility
 * Reviews user-created work requests and suggests budget ranges for workers.
 * Uses service category data, estimated days, and market insights to generate recommendations.
 */

import { SERVICE_CATALOG } from './aiAssistant';

/**
 * Base rate ranges per service category (₹ per day).
 * These are used as fallback when live insight data is unavailable.
 */
const BASE_RATE_RANGES = {
  'Plumber':        { min: 500, max: 1500 },
  'Electrician':    { min: 500, max: 1800 },
  'Carpenter':      { min: 600, max: 2000 },
  'Painter':        { min: 400, max: 1200 },
  'Driver with Vehicle': { min: 800, max: 2500 },
  'Driver without Vehicle': { min: 500, max: 1500 },
  'Home Helper':    { min: 300, max: 800 },
  'AC Technician':  { min: 600, max: 2000 },
  'Pest Control':   { min: 800, max: 3000 },
  'Appliance Repair': { min: 500, max: 2000 },
  'Deep Cleaning':  { min: 600, max: 2500 },
  'Security Guard': { min: 500, max: 1200 },
  'Mason':          { min: 600, max: 1800 },
  'Construction Helper': { min: 400, max: 1000 },
  'Mechanic':       { min: 500, max: 2500 },
  'Gardener':       { min: 300, max: 900 },
  'Maid':           { min: 300, max: 700 },
};

/** Default rate range when service is not found */
const DEFAULT_RATE = { min: 400, max: 1500 };

/**
 * User-facing budget markup percentage.
 * Budget shown to users is inflated by this amount so that when the actual
 * worker quote comes in lower, users perceive they are getting a good deal.
 * E.g. worker rate ₹1,000 → user sees ₹1,250 suggested budget.
 */
export const USER_BUDGET_MARKUP_PERCENT = 25;

/**
 * Complexity multipliers based on job description keywords.
 */
const COMPLEXITY_KEYWORDS = {
  high: ['urgent', 'emergency', 'full house', 'commercial', 'industrial', 'multi-story', 'complete', 'overhaul', 'renovation'],
  medium: ['repair', 'installation', 'replacement', 'scheduled', 'maintenance', 'service'],
  low: ['check', 'inspect', 'minor', 'small', 'touch-up', 'basic', 'simple'],
};

/**
 * Detect complexity level from job description text.
 * @param {string} description
 * @returns {'high' | 'medium' | 'low'}
 */
export function detectComplexity(description = '') {
  const lower = description.toLowerCase();

  if (COMPLEXITY_KEYWORDS.high.some((kw) => lower.includes(kw))) return 'high';
  if (COMPLEXITY_KEYWORDS.low.some((kw) => lower.includes(kw))) return 'low';
  return 'medium';
}

const COMPLEXITY_MULTIPLIER = { high: 1.4, medium: 1.0, low: 0.75 };

/**
 * Generate an AI budget suggestion for a work request.
 *
 * @param {object} params
 * @param {string} params.serviceType - Service type name (e.g. 'Plumber')
 * @param {string} [params.description] - Job description text
 * @param {number} [params.estimatedDays=1] - Estimated work days
 * @param {object} [params.insight] - Live market insight (minQuote, maxQuote, averageQuote)
 * @returns {{ suggestedMin: number, suggestedMax: number, perDay: { min: number, max: number }, complexity: string, confidence: string, explanation: string }}
 */
export function suggestBudget({ serviceType, description = '', estimatedDays = 1, insight = null }) {
  const service = SERVICE_CATALOG.find(
    (s) => s.name.toLowerCase() === (serviceType || '').toLowerCase()
  );
  const serviceName = service?.name || serviceType || 'Service';

  // Use live insight data if available, else use base rates
  let baseMin;
  let baseMax;

  if (insight && Number(insight.minQuote) > 0 && Number(insight.maxQuote) > 0) {
    baseMin = Math.min(Number(insight.minQuote), Number(insight.maxQuote));
    baseMax = Math.max(Number(insight.minQuote), Number(insight.maxQuote));
  } else {
    const rates = BASE_RATE_RANGES[serviceName] || DEFAULT_RATE;
    baseMin = rates.min;
    baseMax = rates.max;
  }

  const complexity = detectComplexity(description);
  const multiplier = COMPLEXITY_MULTIPLIER[complexity];
  const days = Math.max(1, Math.round(Number(estimatedDays) || 1));

  const perDayMin = Math.round(baseMin * multiplier);
  const perDayMax = Math.round(baseMax * multiplier);
  const suggestedMin = perDayMin * days;
  const suggestedMax = perDayMax * days;

  const confidence = insight ? 'high' : 'moderate';

  const explanation = `Based on ${serviceName} rates${insight ? ' from recent quotes' : ' (market estimates)'}, ` +
    `${complexity} complexity work for ${days} day${days > 1 ? 's' : ''}: ` +
    `₹${suggestedMin.toLocaleString('en-IN')} – ₹${suggestedMax.toLocaleString('en-IN')}.`;

  return {
    suggestedMin,
    suggestedMax,
    perDay: { min: perDayMin, max: perDayMax },
    complexity,
    confidence,
    explanation,
  };
}

/**
 * Generate an AI budget suggestion for user-facing display.
 *
 * Applies a markup (USER_BUDGET_MARKUP_PERCENT) so that the range shown to
 * users/customers is higher than the actual worker rates. When the real quote
 * arrives at the lower worker rate, users perceive a better deal.
 *
 * Workers continue to see the original (un-marked-up) rates via suggestBudget().
 *
 * @param {object} params - Same params as suggestBudget()
 * @returns {object} Same shape as suggestBudget() but with inflated amounts
 */
export function suggestBudgetForUser(params) {
  const base = suggestBudget(params);
  const markup = 1 + USER_BUDGET_MARKUP_PERCENT / 100;

  return {
    ...base,
    suggestedMin: Math.round(base.suggestedMin * markup),
    suggestedMax: Math.round(base.suggestedMax * markup),
    perDay: {
      min: Math.round(base.perDay.min * markup),
      max: Math.round(base.perDay.max * markup),
    },
    explanation:
      `Based on ${params.serviceType || 'Service'} rates${params.insight ? ' from recent quotes' : ' (market estimates)'}, ` +
      `${base.complexity} complexity work for ${Math.max(1, Math.round(Number(params.estimatedDays) || 1))} day${(Math.max(1, Math.round(Number(params.estimatedDays) || 1))) > 1 ? 's' : ''}: ` +
      `₹${Math.round(base.suggestedMin * markup).toLocaleString('en-IN')} – ₹${Math.round(base.suggestedMax * markup).toLocaleString('en-IN')}.`,
  };
}

/**
 * Format a budget suggestion as a short display string.
 * @param {{ suggestedMin: number, suggestedMax: number }} suggestion
 * @returns {string}
 */
export function formatBudgetRange(suggestion) {
  if (!suggestion) return 'Quote on request';
  return `₹${suggestion.suggestedMin.toLocaleString('en-IN')} – ₹${suggestion.suggestedMax.toLocaleString('en-IN')}`;
}
