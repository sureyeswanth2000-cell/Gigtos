import {
  SERVICE_CATALOG,
  findRelevantService,
  formatPriceInsight,
  buildLocalAssistantFallback,
} from './aiAssistant';

describe('ai assistant helpers', () => {
  it('matches user text to the correct service', () => {
    expect(findRelevantService('I have a water leak in my kitchen')?.name).toBe('Plumber');
    expect(findRelevantService('Need fan wiring repair urgently')?.name).toBe('Electrician');
  });

  it('formats quote insight ranges clearly', () => {
    expect(formatPriceInsight({ minQuote: 450, maxQuote: 900, averageQuote: 675, quoteCount: 5 })).toBe(
      '₹450 - ₹900 (avg ₹675 from 5 quotes)'
    );
    expect(formatPriceInsight({})).toBe('Quote on request');
  });

  it('builds a useful fallback response for comparison questions', () => {
    const reply = buildLocalAssistantFallback({
      message: 'compare workers for electrician service',
      selectedService: 'Electrician',
      insights: [
        {
          service: 'Electrician',
          availableWorkers: 3,
          averageRating: 4.7,
          minQuote: 500,
          maxQuote: 850,
          averageQuote: 680,
          quoteCount: 6,
        },
      ],
    });

    expect(reply).toContain('Electrician');
    expect(reply).toContain('3 workers');
    expect(reply).toContain('₹500 - ₹850');
  });

  it('keeps the core service catalog available for the assistant', () => {
    expect(SERVICE_CATALOG.map((service) => service.name)).toEqual([
      'Plumber',
      'Electrician',
      'Carpenter',
      'Painter',
    ]);
  });
});
