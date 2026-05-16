import {
  assignWorker,
  confirmCompletion,
  markFinished,
  rateCompletedBooking,
  startWork,
} from '../utils/bookingWorkflow';
import {
  buildWorkerAvailability,
  createInstantBooking,
  matchNearbyWorkers,
} from '../utils/instantBooking';
import { getDevBypassUser, isDevBypassEnabled } from '../utils/devBypass';

describe('basic booking smoke loop', () => {
  it('runs consumer booking to worker completion photo to consumer rating and score event', () => {
    const consumer = {
      uid: 'consumer-bangalore-1',
      name: 'Bangalore Consumer',
      phone: '9000000001',
      address: 'Indiranagar, Bangalore',
      city: 'Bangalore',
      lat: 12.9784,
      lng: 77.6408,
    };

    const worker = buildWorkerAvailability({
      workerId: 'worker-bangalore-1',
      workerName: 'Bangalore Helper',
      serviceType: 'Home Helper',
      fixedRate: 500,
      rating: 4.8,
      area: 'Indiranagar',
      lat: 12.979,
      lng: 77.641,
    });

    const matchedWorkers = matchNearbyWorkers([worker], {
      serviceType: 'Home Helper',
      lat: consumer.lat,
      lng: consumer.lng,
      radiusKm: 10,
    });

    expect(matchedWorkers).toHaveLength(1);
    expect(matchedWorkers[0].distanceKm).toBeLessThan(1);

    const booking = {
      id: 'smoke-booking-1',
      ...createInstantBooking({
        userId: consumer.uid,
        userName: consumer.name,
        userPhone: consumer.phone,
        userAddress: consumer.address,
        userCity: consumer.city,
        worker: matchedWorkers[0],
      }),
    };

    expect(booking.status).toBe('assigned');
    expect(booking.acceptedQuote.finalPrice).toBe(519);
    expect(booking.acceptedQuote.pricing.workerReceives).toBe(500);

    const assigned = assignWorker(booking, {
      id: worker.workerId,
      name: worker.workerName,
      phone: '9000000002',
    });
    const inProgress = startWork(assigned);
    const awaitingConfirmation = markFinished(inProgress, {
      afterPhotoUrls: ['https://example.com/after-cleaning.jpg'],
    });
    const completed = confirmCompletion(awaitingConfirmation);
    const rated = rateCompletedBooking(completed, {
      rating: 5,
      workerOldScore: 500,
      consumerOldScore: 0,
    });

    expect(rated.status).toBe('completed');
    expect(rated.rating).toBe(5);
    expect(rated.scoreEvents).toHaveLength(2);
    expect(rated.scoreEvents[0]).toMatchObject({
      actorRole: 'worker',
      delta: 15,
      newScore: 515,
      status: 'finalized',
    });
    expect(rated.scoreEvents[1]).toMatchObject({
      actorRole: 'consumer',
      delta: 10,
      newScore: 10,
      status: 'finalized',
    });
  });

  it('keeps dev bypass disabled unless explicitly enabled', () => {
    expect(isDevBypassEnabled({ NODE_ENV: 'production', REACT_APP_DEPLOY_ENV: 'production', REACT_APP_ENABLE_DEV_BYPASS: 'true' })).toBe(false);
    expect(isDevBypassEnabled({ NODE_ENV: 'production', REACT_APP_ENABLE_DEV_BYPASS: 'true' })).toBe(true);
    expect(isDevBypassEnabled({ NODE_ENV: 'test', REACT_APP_ENABLE_DEV_BYPASS: 'true' })).toBe(true);
    expect(() => getDevBypassUser('consumer', { NODE_ENV: 'production', REACT_APP_DEPLOY_ENV: 'production', REACT_APP_ENABLE_DEV_BYPASS: 'true' }))
      .toThrow('Dev bypass is disabled');
    expect(getDevBypassUser('worker', { NODE_ENV: 'test', REACT_APP_ENABLE_DEV_BYPASS: 'true' }).role).toBe('worker');
  });
});
