import { calculateFinalPrice } from './pricing';

export function submitQuote(booking, { adminId, adminName, basePrice }) {
  if (!booking) throw new Error('Booking is required');
  if (!adminId) throw new Error('adminId is required');

  const quotes = booking.quotes || [];
  const pricing = calculateFinalPrice(basePrice);
  const quote = {
    adminId,
    adminName: adminName || 'Admin',
    price: pricing.baseAmount,
    finalPrice: pricing.finalTotal,
    pricing,
    updatedAt: new Date(),
  };

  // Check if admin already has a quote
  const existingIdx = quotes.findIndex((q) => q.adminId === adminId);
  let updatedQuotes;
  
  if (existingIdx !== -1) {
    // Update existing quote
    updatedQuotes = [...quotes];
    updatedQuotes[existingIdx] = quote;
  } else {
    // Add new quote
    updatedQuotes = [...quotes, quote];
  }

  return {
    ...booking,
    quotes: updatedQuotes,
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
