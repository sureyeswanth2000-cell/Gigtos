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

  it('matches future services from user text', () => {
    expect(findRelevantService('I need a driver with a car')?.name).toBe('Driver with Vehicle');
    expect(findRelevantService('cockroach infestation in kitchen')?.name).toBe('Pest Control');
    expect(findRelevantService('my AC is not cooling')?.name).toBe('AC Technician');
    expect(findRelevantService('need a maid for house cleaning')?.name).toBe('Home Helper');
    expect(findRelevantService('washing machine not working')?.name).toBe('Appliance Repair');
    expect(findRelevantService('need deep cleaning of my flat')?.name).toBe('Deep Cleaning');
    expect(findRelevantService('I need a security guard for my event')?.name).toBe('Security Guard');
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
    const coreServices = SERVICE_CATALOG.filter((s) => !s.isUpcoming).map((s) => s.name);
    expect(coreServices).toEqual([
      'Plumber',
      'Electrician',
      'Carpenter',
      'Painter',
    ]);
  });

  it('includes future services marked as upcoming', () => {
    const upcoming = SERVICE_CATALOG.filter((s) => s.isUpcoming).map((s) => s.name);
    expect(upcoming).toContain('Driver with Vehicle');
    expect(upcoming).toContain('Driver without Vehicle');
    expect(upcoming).toContain('Home Helper');
    expect(upcoming.length).toBeGreaterThanOrEqual(8);
  });

  it('groups services by category', () => {
    const categories = [...new Set(SERVICE_CATALOG.map((s) => s.category))];
    expect(categories).toContain('Home Repair');
    expect(categories).toContain('Transport');
    expect(categories).toContain('Household Help');
  });
});
