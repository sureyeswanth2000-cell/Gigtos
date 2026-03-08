import { calculateFinalPrice } from './pricing';

export function submitQuote(booking, { adminId, adminName, basePrice }) {
  if (!booking) throw new Error('Booking is required');
  if (!adminId) throw new Error('adminId is required');

  const quotes = booking.quotes || [];
  if (quotes.some((q) => q.adminId === adminId)) {
    throw new Error('Quote already submitted');
  }

  const pricing = calculateFinalPrice(basePrice);
  const quote = {
    adminId,
    adminName: adminName || 'Admin',
    price: pricing.baseAmount,
    finalPrice: pricing.finalTotal,
    pricing,
  };

  return {
    ...booking,
    quotes: [...quotes, quote],
  };
}

export function acceptQuote(booking, adminId) {
  if (!booking) throw new Error('Booking is required');
  const quote = (booking.quotes || []).find((q) => q.adminId === adminId);
  if (!quote) throw new Error('Quote not found');

  return {
    ...booking,
    status: 'accepted',
    adminId,
    acceptedQuote: quote,
  };
}

export function assignWorker(booking, worker) {
  if (!booking) throw new Error('Booking is required');
  if (!worker?.id || !worker?.name) throw new Error('Worker details missing');

  return {
    ...booking,
    status: 'assigned',
    assignedWorkerId: worker.id,
    workerName: worker.name,
    workerPhone: worker.phone || '',
    assignedWorker: worker.name,
  };
}

export function startWork(booking) {
  if (!booking) throw new Error('Booking is required');
  if (booking.status !== 'assigned') throw new Error('Booking must be assigned first');
  return { ...booking, status: 'in_progress' };
}

export function markFinished(booking) {
  if (!booking) throw new Error('Booking is required');
  if (booking.status !== 'in_progress') throw new Error('Work must be in progress');
  return { ...booking, status: 'awaiting_confirmation' };
}

export function confirmCompletion(booking) {
  if (!booking) throw new Error('Booking is required');
  if (booking.status !== 'awaiting_confirmation') throw new Error('Booking must await confirmation');
  return { ...booking, status: 'completed' };
}
