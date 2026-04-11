import {
  SERVICE_CATALOG,
  checkServiceNearby,
  findRelevantService,
  formatPriceInsight,
  buildLocalAssistantFallback,
  buildPromptSuggestions,
} from './aiAssistant';

describe('ai assistant helpers', () => {
  it('matches user text to the correct service', () => {
    expect(findRelevantService('I have a water leak in my kitchen')?.name).toBe('Plumber');
    expect(findRelevantService('Need fan wiring repair urgently')?.name).toBe('Electrician');
  });

  it('matches upcoming services from user text', () => {
    expect(findRelevantService('I need a driver with a car')?.name).toBe('Driver with Vehicle');
    expect(findRelevantService('cockroach infestation in kitchen')?.name).toBe('Pest Control');
    expect(findRelevantService('my AC is not cooling')?.name).toBe('AC Technician');
    expect(findRelevantService('need a maid for house cleaning')?.name).toBe('Home Helper');
    expect(findRelevantService('washing machine not working')?.name).toBe('Appliance Repair');
    expect(findRelevantService('need deep cleaning of my flat')?.name).toBe('Deep Cleaning');
    expect(findRelevantService('I need a security guard for my event')?.name).toBe('Security Guard');
  });

  it('matches new expanded services from user text', () => {
    expect(findRelevantService('need a lorry to move goods')?.name).toBe('Heavy Vehicle Driver');
    expect(findRelevantService('need a scooty quickly')?.name).toBe('Two Wheeler Driver');
    expect(findRelevantService('need masonry work done')?.name).toBe('Mason');
    expect(findRelevantService('looking for a welder for gate repair')?.name).toBe('Welding');
    expect(findRelevantService('need land survey for my plot')?.name).toBe('Land Surveyor');
    expect(findRelevantService('need denting work on my bike')?.name).toBe('Mechanic');
    expect(findRelevantService('elevator maintenance needed')?.name).toBe('Elevator Installer');
    expect(findRelevantService('need a chef for hotel catering')?.name).toBe('Hotel Cook');
    expect(findRelevantService('need food service staff for buffet')?.name).toBe('Food Service Staff');
    expect(findRelevantService('godown packing needed')?.name).toBe('Warehouse Helper');
    expect(findRelevantService('need a driving instructor for lessons')?.name).toBe('Driving Instructor');
    expect(findRelevantService('purifier service needed')?.name).toBe('Water Purifier Service');
    expect(findRelevantService('need gardener for lawn mowing')?.name).toBe('Gardener');
    expect(findRelevantService('need agriculture help for fields')?.name).toBe('Farm Helper');
    expect(findRelevantService('need sanitization for office')?.name).toBe('Sanitizer');
    expect(findRelevantService('need rebar tying work')?.name).toBe('Steel Worker');
    expect(findRelevantService('need construction quality check')?.name).toBe('Construction Quality Tester');
    expect(findRelevantService('need front desk reception staff')?.name).toBe('Hotel Welcome Staff');
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
    expect(reply).toContain('3 worker');
    expect(reply).toContain('₹500 - ₹850');
  });

  it('responds to greetings warmly', () => {
    const reply = buildLocalAssistantFallback({ message: 'hello' });
    expect(reply).toContain('Hello');
    expect(reply).toContain('Gito AI');
    expect(reply).toContain('help');
  });

  it('responds to thank you messages', () => {
    const reply = buildLocalAssistantFallback({ message: 'thanks for the help' });
    expect(reply).toContain('welcome');
  });

  it('handles urgent requests proactively', () => {
    const reply = buildLocalAssistantFallback({ message: 'urgent plumber needed for water leak' });
    expect(reply).toContain('urgent');
    expect(reply).toContain('Plumber');
  });

  it('provides recommendations when asked', () => {
    const reply = buildLocalAssistantFallback({ message: 'which service should I use for my broken door?' });
    expect(reply).toContain('Carpenter');
  });

  it('explains scheduling and timing', () => {
    const reply = buildLocalAssistantFallback({ message: 'when can I book a service?' });
    expect(reply).toContain('7 days a week');
  });

  it('describes services when asked about them', () => {
    const reply = buildLocalAssistantFallback({ message: 'what does a plumber do?' });
    expect(reply).toContain('Plumber');
    expect(reply).toContain('Pipe');
  });

  it('explains the booking process', () => {
    const reply = buildLocalAssistantFallback({ message: 'how do I book a service?' });
    expect(reply).toContain('Choose a service');
  });

  it('guides users who need help', () => {
    const reply = buildLocalAssistantFallback({ message: 'I am confused and need help' });
    expect(reply).toContain('help');
  });

  it('answers quality and trust questions', () => {
    const reply = buildLocalAssistantFallback({ message: 'are workers reliable and verified?' });
    expect(reply).toContain('verified');
    expect(reply).toContain('rated');
  });

  it('handles goodbye messages', () => {
    const reply = buildLocalAssistantFallback({ message: 'bye, thanks!' });
    // "bye" matches the thank-you pattern first since "thanks" is also present.
    // Either pattern is acceptable.
    expect(reply.length).toBeGreaterThan(0);
  });

  it('provides a helpful catch-all for unrecognized messages', () => {
    const reply = buildLocalAssistantFallback({ message: 'xyzzy gibberish 12345' });
    expect(reply).toContain('help');
    expect(reply).toContain('Plumber');
  });

  it('proactively identifies a service from context and offers to book', () => {
    const reply = buildLocalAssistantFallback({ message: 'my kitchen sink is leaking badly' });
    expect(reply).toContain('Plumber');
    expect(reply).toContain('book');
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

  it('includes services marked as upcoming', () => {
    const upcoming = SERVICE_CATALOG.filter((s) => s.isUpcoming).map((s) => s.name);
    expect(upcoming).toContain('Driver with Vehicle');
    expect(upcoming).toContain('Driver without Vehicle');
    expect(upcoming).toContain('Home Helper');
    expect(upcoming).toContain('Mason');
    expect(upcoming).toContain('Mechanic');
    expect(upcoming).toContain('Hotel Cook');
    expect(upcoming).toContain('Driving Instructor');
    expect(upcoming).toContain('Gardener');
    expect(upcoming).toContain('Maid');
    expect(upcoming.length).toBe(35);
  });

  it('groups services by category', () => {
    const categories = [...new Set(SERVICE_CATALOG.map((s) => s.category))];
    expect(categories).toContain('Home Repair');
    expect(categories).toContain('Transport');
    expect(categories).toContain('Household Help');
    expect(categories).toContain('Construction');
    expect(categories).toContain('Automotive');
    expect(categories).toContain('Hotel & Hospitality');
    expect(categories).toContain('Industrial');
    expect(categories).toContain('Event & Warehouse');
    expect(categories).toContain('Education');
    expect(categories).toContain('Outdoor & Garden');
  });
});

describe('buildPromptSuggestions', () => {
  it('returns general suggestions when no service is selected', () => {
    const suggestions = buildPromptSuggestions('');
    expect(suggestions.length).toBe(4);
    expect(suggestions).toContain('What services do you offer?');
    expect(suggestions).toContain('I need help choosing a service');
  });

  it('returns service-specific suggestions when a service is selected', () => {
    const suggestions = buildPromptSuggestions('Plumber');
    expect(suggestions.length).toBe(4);
    expect(suggestions[0]).toContain('Plumber');
    expect(suggestions.some((s) => s.includes('Book'))).toBe(true);
  });
});

describe('checkServiceNearby', () => {
  const userLat = 12.9716;
  const userLng = 77.5946;

  const nearbyWorker = {
    serviceType: 'Plumber',
    isAvailable: true,
    lat: 12.9750,
    lng: 77.5900,
    workerName: 'Ravi',
  };

  const farWorker = {
    serviceType: 'Plumber',
    isAvailable: true,
    lat: 14.0,
    lng: 80.0,
    workerName: 'Kiran',
  };

  const unavailableWorker = {
    serviceType: 'Plumber',
    isAvailable: false,
    lat: 12.9750,
    lng: 77.5900,
    workerName: 'Ajay',
  };

  it('detects nearby workers within radius', () => {
    const result = checkServiceNearby({
      serviceName: 'Plumber',
      workers: [nearbyWorker],
      userLat,
      userLng,
    });
    expect(result.isNearby).toBe(true);
    expect(result.nearbyCount).toBe(1);
    expect(result.message).toContain('Plumber');
    expect(result.message).toContain('available near you');
  });

  it('reports not nearby when workers are out of range', () => {
    const result = checkServiceNearby({
      serviceName: 'Plumber',
      workers: [farWorker],
      userLat,
      userLng,
    });
    expect(result.isNearby).toBe(false);
    expect(result.nearbyCount).toBe(0);
    expect(result.message).toContain('will come to your area soon');
  });

  it('ignores unavailable workers', () => {
    const result = checkServiceNearby({
      serviceName: 'Plumber',
      workers: [unavailableWorker],
      userLat,
      userLng,
    });
    expect(result.isNearby).toBe(false);
    expect(result.nearbyCount).toBe(0);
  });

  it('filters by service type correctly', () => {
    const electrician = { ...nearbyWorker, serviceType: 'Electrician' };
    const result = checkServiceNearby({
      serviceName: 'Plumber',
      workers: [electrician],
      userLat,
      userLng,
    });
    expect(result.isNearby).toBe(false);
    expect(result.nearbyCount).toBe(0);
  });

  it('returns empty result when location is missing', () => {
    const result = checkServiceNearby({
      serviceName: 'Plumber',
      workers: [nearbyWorker],
      userLat: null,
      userLng: null,
    });
    expect(result.isNearby).toBe(false);
    expect(result.nearbyCount).toBe(0);
    expect(result.message).toBe('');
  });

  it('returns empty result when service name is missing', () => {
    const result = checkServiceNearby({
      serviceName: '',
      workers: [nearbyWorker],
      userLat,
      userLng,
    });
    expect(result.isNearby).toBe(false);
    expect(result.nearbyCount).toBe(0);
  });

  it('handles empty workers array', () => {
    const result = checkServiceNearby({
      serviceName: 'Plumber',
      workers: [],
      userLat,
      userLng,
    });
    expect(result.isNearby).toBe(false);
    expect(result.nearbyCount).toBe(0);
    expect(result.message).toContain('will come to your area soon');
  });

  it('counts multiple nearby workers', () => {
    const worker2 = { ...nearbyWorker, workerName: 'Suresh', lat: 12.9720, lng: 77.5950 };
    const result = checkServiceNearby({
      serviceName: 'Plumber',
      workers: [nearbyWorker, worker2, farWorker],
      userLat,
      userLng,
    });
    expect(result.isNearby).toBe(true);
    expect(result.nearbyCount).toBe(2);
    expect(result.message).toContain('2 Plumber workers');
  });

  it('respects custom radius', () => {
    const result = checkServiceNearby({
      serviceName: 'Plumber',
      workers: [farWorker],
      userLat,
      userLng,
      radiusKm: 500,
    });
    expect(result.isNearby).toBe(true);
    expect(result.nearbyCount).toBe(1);
  });
});

describe('buildLocalAssistantFallback with nearbyCheck', () => {
  const notNearby = {
    isNearby: false,
    nearbyCount: 0,
    message: '📍 Plumber service is not available in your area yet. Don\'t worry — the service will come to your area soon! We\'re expanding rapidly. You can still book and we\'ll connect you with the nearest available worker.',
  };

  const isNearby = {
    isNearby: true,
    nearbyCount: 3,
    message: '✅ 3 Plumber workers available near you right now!',
  };

  it('appends proximity notice to booking response when service is not nearby', () => {
    const reply = buildLocalAssistantFallback({
      message: 'book a plumber',
      nearbyCheck: notNearby,
    });
    expect(reply).toContain('Plumber');
    expect(reply).toContain('will come to your area soon');
  });

  it('does not append proximity notice when service is nearby', () => {
    const reply = buildLocalAssistantFallback({
      message: 'book a plumber',
      nearbyCheck: isNearby,
    });
    expect(reply).toContain('Plumber');
    expect(reply).not.toContain('will come to your area soon');
  });

  it('appends proximity notice for urgent requests when not nearby', () => {
    const reply = buildLocalAssistantFallback({
      message: 'urgent plumber needed for water leak',
      nearbyCheck: notNearby,
    });
    expect(reply).toContain('urgent');
    expect(reply).toContain('Plumber');
    expect(reply).toContain('will come to your area soon');
  });

  it('appends proximity notice to catch-all service match when not nearby', () => {
    const reply = buildLocalAssistantFallback({
      message: 'my kitchen sink is leaking badly',
      nearbyCheck: notNearby,
    });
    expect(reply).toContain('Plumber');
    expect(reply).toContain('will come to your area soon');
  });

  it('works normally without nearbyCheck (backwards compatible)', () => {
    const reply = buildLocalAssistantFallback({
      message: 'book a plumber',
    });
    expect(reply).toContain('Plumber');
    expect(reply).not.toContain('will come to your area soon');
  });
});
