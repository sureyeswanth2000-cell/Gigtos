import {
  submitQuote,
  acceptQuote,
  assignWorker,
  startWork,
  markFinished,
  confirmCompletion,
} from './bookingWorkflow';

describe('booking workflow integration', () => {
  it('runs end-to-end lifecycle with pricing, assignment, and completion', () => {
    const baseBooking = {
      id: 'b1',
      userId: 'u1',
      serviceType: 'Plumber',
      status: 'pending',
      quotes: [],
    };

    const quoted = submitQuote(baseBooking, {
      adminId: 'a1',
      adminName: 'Mason One',
      basePrice: 1000,
    });

    expect(quoted.quotes).toHaveLength(1);
    expect(quoted.quotes[0].price).toBe(1000);
    expect(quoted.quotes[0].finalPrice).toBe(1173);

    const accepted = acceptQuote(quoted, 'a1');
    expect(accepted.status).toBe('accepted');
    expect(accepted.acceptedQuote.finalPrice).toBe(1173);

    const assigned = assignWorker(accepted, {
      id: 'w1',
      name: 'Worker One',
      phone: '9999999999',
    });
    expect(assigned.status).toBe('assigned');
    expect(assigned.assignedWorkerId).toBe('w1');

    const started = startWork(assigned);
    expect(started.status).toBe('in_progress');

    const awaiting = markFinished(started);
    expect(awaiting.status).toBe('awaiting_confirmation');

    const completed = confirmCompletion(awaiting);
    expect(completed.status).toBe('completed');
  });

  it('updates existing quote from same admin', () => {
    const booking = {
      id: 'b2',
      status: 'pending',
      quotes: [{ adminId: 'a1', price: 500, finalPrice: 586.5 }],
    };

    const updated = submitQuote(booking, {
      adminId: 'a1',
      adminName: 'Mason One',
      basePrice: 600,
    });

    expect(updated.quotes).toHaveLength(1);
    expect(updated.quotes[0].adminId).toBe('a1');
    expect(updated.quotes[0].price).toBe(600);
    expect(updated.quotes[0].finalPrice).toBe(703.8);
  });

  it('enforces valid status order', () => {
    expect(() => startWork({ status: 'pending' })).toThrow('Booking must be assigned first');
    expect(() => markFinished({ status: 'assigned' })).toThrow('Work must be in progress');
    expect(() => confirmCompletion({ status: 'assigned' })).toThrow('Booking must await confirmation');
  });
});
