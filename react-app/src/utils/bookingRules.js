export function validateFutureBookingWindow({ requestedAt = new Date(), scheduledAt, maxDays = 14 }) {
  if (!scheduledAt) return { valid: true, reason: 'on_demand' };
  const start = new Date(requestedAt);
  const target = new Date(scheduledAt);
  const diffDays = (target.getTime() - start.getTime()) / 86400000;

  if (diffDays < 0) {
    return { valid: false, reason: 'past_time', message: 'Future booking cannot be in the past.' };
  }
  if (diffDays > maxDays) {
    return { valid: false, reason: 'beyond_2_weeks', message: 'Future booking is limited to the next 2 weeks.' };
  }
  return { valid: true, reason: 'within_window', maxDays };
}

export function getRecurringBookingPriority({ frequency, cleanCompletions = 0, hasOpenIssue = false }) {
  if (!['weekly', 'monthly'].includes(frequency)) {
    return { priority: 'normal', boost: 0, reason: 'not_recurring' };
  }
  if (hasOpenIssue) {
    return { priority: 'hold', boost: 0, reason: 'open_issue_needs_resolution' };
  }
  const baseBoost = frequency === 'weekly' ? 30 : 20;
  const loyaltyBoost = Math.min(Number(cleanCompletions || 0) * 2, 20);
  return {
    priority: 'recurring',
    boost: baseBoost + loyaltyBoost,
    reason: 'recurring_bookings_improve_worker_stability',
  };
}

export function getEmergencyBookingRule({ requestedWithinHours = 4, workerAvailable = false }) {
  const hours = Number(requestedWithinHours || 0);
  return {
    eligible: hours <= 4 && workerAvailable,
    targetHours: 4,
    extraChargeReason: 'emergency_4_hour_arrival_target',
    standbyRequired: true,
  };
}
