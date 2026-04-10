import { suggestBudget, detectComplexity, formatBudgetRange } from './aiBudgetSuggestion';

describe('detectComplexity', () => {
  it('returns high for urgent keywords', () => {
    expect(detectComplexity('This is an urgent plumbing emergency')).toBe('high');
  });

  it('returns low for minor keywords', () => {
    expect(detectComplexity('Small touch-up on wall paint')).toBe('low');
  });

  it('returns medium by default', () => {
    expect(detectComplexity('Fix the kitchen tap')).toBe('medium');
  });

  it('returns medium for empty input', () => {
    expect(detectComplexity('')).toBe('medium');
    expect(detectComplexity()).toBe('medium');
  });
});

describe('suggestBudget', () => {
  it('returns a valid suggestion for known service', () => {
    const result = suggestBudget({ serviceType: 'Plumber', estimatedDays: 1 });
    expect(result).toHaveProperty('suggestedMin');
    expect(result).toHaveProperty('suggestedMax');
    expect(result.suggestedMin).toBeGreaterThan(0);
    expect(result.suggestedMax).toBeGreaterThanOrEqual(result.suggestedMin);
    expect(result.complexity).toBe('medium');
    expect(result.confidence).toBe('moderate');
  });

  it('scales with estimated days', () => {
    const oneDay = suggestBudget({ serviceType: 'Electrician', estimatedDays: 1 });
    const threeDays = suggestBudget({ serviceType: 'Electrician', estimatedDays: 3 });
    expect(threeDays.suggestedMin).toBe(oneDay.suggestedMin * 3);
    expect(threeDays.suggestedMax).toBe(oneDay.suggestedMax * 3);
  });

  it('applies complexity multiplier for high-complexity jobs', () => {
    const normal = suggestBudget({ serviceType: 'Painter', estimatedDays: 1 });
    const urgent = suggestBudget({ serviceType: 'Painter', description: 'Urgent full house renovation', estimatedDays: 1 });
    expect(urgent.suggestedMin).toBeGreaterThan(normal.suggestedMin);
    expect(urgent.complexity).toBe('high');
  });

  it('uses live insight data when provided', () => {
    const result = suggestBudget({
      serviceType: 'Plumber',
      insight: { minQuote: 800, maxQuote: 2000 },
      estimatedDays: 1,
    });
    expect(result.confidence).toBe('high');
    expect(result.perDay.min).toBe(800);
    expect(result.perDay.max).toBe(2000);
  });

  it('handles unknown service type gracefully', () => {
    const result = suggestBudget({ serviceType: 'UnknownService', estimatedDays: 2 });
    expect(result.suggestedMin).toBeGreaterThan(0);
    expect(result.suggestedMax).toBeGreaterThan(0);
  });

  it('treats zero or negative days as 1 day', () => {
    const result = suggestBudget({ serviceType: 'Plumber', estimatedDays: 0 });
    const oneDay = suggestBudget({ serviceType: 'Plumber', estimatedDays: 1 });
    expect(result.suggestedMin).toBe(oneDay.suggestedMin);
  });

  it('returns an explanation string', () => {
    const result = suggestBudget({ serviceType: 'Carpenter', estimatedDays: 2 });
    expect(typeof result.explanation).toBe('string');
    expect(result.explanation.length).toBeGreaterThan(0);
    expect(result.explanation).toContain('Carpenter');
  });
});

describe('formatBudgetRange', () => {
  it('formats a suggestion range', () => {
    const result = formatBudgetRange({ suggestedMin: 500, suggestedMax: 1500 });
    expect(result).toContain('500');
    expect(result).toContain('1,500');
  });

  it('returns fallback for null input', () => {
    expect(formatBudgetRange(null)).toBe('Quote on request');
  });
});
