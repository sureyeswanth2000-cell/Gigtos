import {
  buildAssignmentCandidate,
  buildLiveTrackingEvent,
  buildOperatorQualityNote,
  buildSupportTicket,
  buildWorkerAvailabilitySnapshot,
  buildWorkerWalletDueEntry,
} from './backendContracts';
import { buildOperatorConsoleSnapshot } from './operatorQueues';

describe('backend contract scaffolds', () => {
  it('builds assignment and availability payloads with stable IDs', () => {
    const availability = buildWorkerAvailabilitySnapshot({
      workerId: 'w1',
      serviceTypes: ['Kitchen Help'],
      city: 'Bangalore',
      area: 'Indiranagar',
      isReadyToday: true,
    });

    const candidate = buildAssignmentCandidate({
      booking: { id: 'b1', serviceType: 'Kitchen Help' },
      worker: { id: 'w1', name: 'Worker', socioScore: 720, tier: 'Gold', isReadyToday: true },
      distanceKm: 3,
      score: 92,
    });

    expect(availability.workerId).toBe('w1');
    expect(candidate.bookingId).toBe('b1');
    expect(candidate.rankingInputs.tier).toBe('Gold');
  });

  it('builds live tracking, support, wallet, and quality-note payloads', () => {
    expect(buildLiveTrackingEvent({
      bookingId: 'b1',
      workerId: 'w1',
      consumerId: 'c1',
      eventType: 'worker.arrived',
    })).toMatchObject({ bookingId: 'b1', eventType: 'worker.arrived', retentionClass: 'short_lived' });

    expect(buildSupportTicket({
      actorId: 'c1',
      role: 'consumer',
      issueType: 'payment',
      title: 'Payment pending',
    })).toMatchObject({ status: 'open', priority: 'Normal' });

    expect(buildWorkerWalletDueEntry({
      workerId: 'w1',
      bookingId: 'b1',
      platformFee: 19,
    })).toMatchObject({ amount: -19, status: 'due' });

    expect(buildOperatorQualityNote({
      operatorId: 'op1',
      targetType: 'worker',
      targetId: 'w1',
      note: 'Completion photo unclear',
      severity: 'High',
    })).toMatchObject({ requiresSuperadminReview: true });
  });

  it('derives operator queues for verification, disputes, quality, and support', () => {
    const snapshot = buildOperatorConsoleSnapshot({
      workers: [
        { id: 'w1', name: 'Pending Worker', approvalStatus: 'pending' },
        { id: 'w2', name: 'Low Score Worker', approvalStatus: 'approved', socioScore: 420 },
      ],
      bookings: [
        { id: 'b1', serviceType: 'Cleaning', workerId: 'w2', dispute: { status: 'open' } },
      ],
      tickets: [
        { id: 't1', title: 'Need help', status: 'open' },
      ],
    });

    expect(snapshot.totals).toEqual({ verification: 1, disputes: 1, quality: 1, support: 1 });
  });
});
