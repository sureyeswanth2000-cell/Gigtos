import {
  buildWorkerAvailability,
  matchNearbyWorkers,
  createInstantBooking,
  buildNotificationText,
  getWorkerDisplayInfo,
} from './instantBooking';

// ---------- buildWorkerAvailability ----------

describe('buildWorkerAvailability', () => {
  it('creates a valid availability record with pricing', () => {
    const result = buildWorkerAvailability({
      workerId: 'w1',
      workerName: 'Ravi Kumar',
      serviceType: 'Electrician',
      fixedRate: 600,
      rating: 4.5,
      area: 'Adyar',
      lat: 13.0,
      lng: 80.25,
    });

    expect(result.workerId).toBe('w1');
    expect(result.workerName).toBe('Ravi Kumar');
    expect(result.fixedRate).toBe(600);
    // 600 + 15% = 690 + 2% = 703.80
    expect(result.finalPrice).toBe(703.8);
    expect(result.isAvailable).toBe(true);
    expect(result.pricing).toBeDefined();
    expect(result.pricing.platformFeePercent).toBe(15);
  });

  it('throws when workerId is missing', () => {
    expect(() =>
      buildWorkerAvailability({ workerName: 'X', serviceType: 'Plumber', fixedRate: 500 })
    ).toThrow('workerId is required');
  });

  it('throws when workerName is missing', () => {
    expect(() =>
      buildWorkerAvailability({ workerId: 'w1', serviceType: 'Plumber', fixedRate: 500 })
    ).toThrow('workerName is required');
  });

  it('throws when serviceType is missing', () => {
    expect(() =>
      buildWorkerAvailability({ workerId: 'w1', workerName: 'X', fixedRate: 500 })
    ).toThrow('serviceType is required');
  });

  it('throws when fixedRate is invalid', () => {
    expect(() =>
      buildWorkerAvailability({ workerId: 'w1', workerName: 'X', serviceType: 'Plumber', fixedRate: 0 })
    ).toThrow('fixedRate must be a positive number');

    expect(() =>
      buildWorkerAvailability({ workerId: 'w1', workerName: 'X', serviceType: 'Plumber', fixedRate: -100 })
    ).toThrow('fixedRate must be a positive number');
  });
});

// ---------- matchNearbyWorkers ----------

describe('matchNearbyWorkers', () => {
  const workers = [
    { workerId: 'w1', workerName: 'A', serviceType: 'Electrician', fixedRate: 600, isAvailable: true, lat: 13.01, lng: 80.25, rating: 4 },
    { workerId: 'w2', workerName: 'B', serviceType: 'Electrician', fixedRate: 500, isAvailable: true, lat: 13.05, lng: 80.28, rating: 3.5 },
    { workerId: 'w3', workerName: 'C', serviceType: 'Plumber', fixedRate: 400, isAvailable: true, lat: 13.02, lng: 80.26, rating: 5 },
    { workerId: 'w4', workerName: 'D', serviceType: 'Electrician', fixedRate: 700, isAvailable: false, lat: 13.00, lng: 80.25, rating: 4 },
    { workerId: 'w5', workerName: 'E', serviceType: 'Electrician', fixedRate: 550, isAvailable: true, lat: 15.00, lng: 82.00, rating: 4 }, // far away
  ];

  it('returns only matching service-type workers within radius sorted by distance', () => {
    const result = matchNearbyWorkers(workers, {
      serviceType: 'Electrician',
      lat: 13.0,
      lng: 80.25,
      radiusKm: 20,
    });

    expect(result).toHaveLength(2);
    expect(result[0].workerId).toBe('w1'); // closest
    expect(result[1].workerId).toBe('w2');
    expect(result[0].distanceKm).toBeDefined();
    expect(result[0].distanceKm).toBeLessThan(result[1].distanceKm);
  });

  it('excludes unavailable workers', () => {
    const result = matchNearbyWorkers(workers, {
      serviceType: 'Electrician',
      lat: 13.0,
      lng: 80.25,
    });
    const ids = result.map((w) => w.workerId);
    expect(ids).not.toContain('w4');
  });

  it('excludes workers beyond radius', () => {
    const result = matchNearbyWorkers(workers, {
      serviceType: 'Electrician',
      lat: 13.0,
      lng: 80.25,
      radiusKm: 5,
    });
    const ids = result.map((w) => w.workerId);
    expect(ids).not.toContain('w5');
  });

  it('returns empty for non-matching service type', () => {
    const result = matchNearbyWorkers(workers, {
      serviceType: 'Carpenter',
      lat: 13.0,
      lng: 80.25,
    });
    expect(result).toHaveLength(0);
  });

  it('returns empty when workers is not an array', () => {
    expect(matchNearbyWorkers(null, { serviceType: 'X', lat: 0, lng: 0 })).toEqual([]);
  });

  it('is case-insensitive on serviceType', () => {
    const result = matchNearbyWorkers(workers, {
      serviceType: 'electrician',
      lat: 13.0,
      lng: 80.25,
    });
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------- createInstantBooking ----------

describe('createInstantBooking', () => {
  const mockWorker = {
    workerId: 'w1',
    workerName: 'Ravi Kumar',
    serviceType: 'Electrician',
    fixedRate: 600,
  };

  it('creates a booking with assigned status and correct pricing', () => {
    const booking = createInstantBooking({
      userId: 'u1',
      userName: 'Sravani',
      userPhone: '9876543210',
      userAddress: '123 Main St',
      userCity: 'Chennai',
      worker: mockWorker,
    });

    expect(booking.status).toBe('assigned');
    expect(booking.bookingType).toBe('instant');
    expect(booking.assignedWorkerId).toBe('w1');
    expect(booking.workerName).toBe('Ravi Kumar');
    expect(booking.fixedRate).toBe(600);
    expect(booking.acceptedQuote.price).toBe(600);
    // 600 * 1.15 = 690 * 1.02 = 703.80
    expect(booking.acceptedQuote.finalPrice).toBe(703.8);
    expect(booking.serviceType).toBe('Electrician');
    expect(booking.isScheduled).toBe(false);
    expect(booking.userId).toBe('u1');
  });

  it('throws when userId is missing', () => {
    expect(() =>
      createInstantBooking({ worker: mockWorker })
    ).toThrow('userId is required');
  });

  it('throws when worker is missing', () => {
    expect(() =>
      createInstantBooking({ userId: 'u1' })
    ).toThrow('worker is required');
  });

  it('throws when worker has no workerId', () => {
    expect(() =>
      createInstantBooking({ userId: 'u1', worker: { workerName: 'X', fixedRate: 500 } })
    ).toThrow('worker must have workerId and workerName');
  });

  it('throws when worker has invalid fixedRate', () => {
    expect(() =>
      createInstantBooking({ userId: 'u1', worker: { workerId: 'w1', workerName: 'X', fixedRate: 0 } })
    ).toThrow('worker must have a valid fixedRate');
  });
});

// ---------- buildNotificationText ----------

describe('buildNotificationText', () => {
  it('returns a formatted notification string', () => {
    const text = buildNotificationText({
      serviceType: 'Electrician',
      fixedRate: 600,
    });
    expect(text).toContain('Electrician');
    expect(text).toContain('600');
    expect(text).toContain('⚡');
  });

  it('returns empty string for null worker', () => {
    expect(buildNotificationText(null)).toBe('');
  });
});

// ---------- getWorkerDisplayInfo ----------

describe('getWorkerDisplayInfo', () => {
  it('returns display data without phone number', () => {
    const info = getWorkerDisplayInfo({
      workerId: 'w1',
      workerName: 'Ravi Kumar',
      serviceType: 'Plumber',
      fixedRate: 500,
      rating: 4.5,
      area: 'Adyar',
      phone: '9876543210',  // should be excluded
      distanceKm: 3.2,
    });

    expect(info.workerName).toBe('Ravi Kumar');
    expect(info.fixedRate).toBe(500);
    expect(info.finalPrice).toBe(586.5); // 500 * 1.15 * 1.02
    expect(info.rating).toBe(4.5);
    expect(info.distanceKm).toBe(3.2);
    // Phone must NOT be present
    expect(info.phone).toBeUndefined();
  });

  it('returns null for null worker', () => {
    expect(getWorkerDisplayInfo(null)).toBeNull();
  });
});
