export function buildVerificationQueue(workers = []) {
  return workers
    .filter(worker => ['pending', 'needs_review', 'rejected_docs'].includes(worker.verificationStatus || worker.approvalStatus))
    .map(worker => ({
      id: worker.id || worker.uid,
      name: worker.name || worker.displayName || 'Worker',
      service: worker.gigType || worker.serviceType || (worker.gigTypes || [])[0] || 'General service',
      area: worker.area || worker.locationArea || worker.city || 'Area missing',
      status: worker.verificationStatus || worker.approvalStatus || 'pending',
      risk: worker.externalPlatformProof ? 'Normal' : 'Needs ID proof',
      nextAction: worker.externalPlatformProof ? 'Review proof' : 'Ask for UC/Pivot/identity proof',
    }));
}

export function buildDisputeQueue(bookings = []) {
  return bookings
    .filter(booking => booking.dispute?.status === 'open' || booking.issueStatus === 'open')
    .map(booking => ({
      id: booking.id,
      service: booking.serviceType || booking.title || 'Service',
      consumer: booking.customerName || booking.consumerName || 'Consumer',
      worker: booking.workerName || booking.assignedWorker || 'Worker not assigned',
      status: booking.dispute?.status || booking.issueStatus || 'open',
      workerPayoutStatus: booking.workerPayoutStatus || '',
      priority: booking.dispute?.severity || booking.issueSeverity || 'Normal',
      nextAction: 'Review photos, chat, and timeline',
      raw: booking,
    }));
}

export function buildQualityQueue(workers = [], bookings = []) {
  const issueCounts = bookings.reduce((acc, booking) => {
    const workerId = booking.workerId || booking.assignedWorkerId;
    if (!workerId) return acc;
    if (booking.rating === 1 || booking.dispute?.status || booking.issueStatus) {
      acc[workerId] = (acc[workerId] || 0) + 1;
    }
    return acc;
  }, {});

  return workers
    .filter(worker => (issueCounts[worker.id || worker.uid] || 0) > 0 || Number(worker.gigScore ?? worker.socioScore ?? 500) < 400)
    .map(worker => ({
      id: worker.id || worker.uid,
      name: worker.name || worker.displayName || 'Worker',
      service: worker.gigType || worker.serviceType || 'General service',
      issueCount: issueCounts[worker.id || worker.uid] || 0,
      score: Number(worker.gigScore ?? worker.socioScore ?? 500),
      nextAction: 'Add quality note or request retraining photos',
    }));
}

export function buildSupportQueue(tickets = []) {
  return tickets
    .filter(ticket => !['closed', 'resolved'].includes(ticket.status))
    .map(ticket => ({
      id: ticket.id,
      role: ticket.role || 'consumer',
      title: ticket.title || ticket.subject || ticket.issueType || 'Support issue',
      priority: ticket.priority || 'Normal',
      status: ticket.status || 'open',
      nextAction: ticket.nextAction || (ticket.category === 'travel_watchdog' ? 'Review route evidence' : 'Reply or escalate'),
      category: ticket.category || '',
      bookingId: ticket.bookingId || '',
      workerId: ticket.workerId || '',
      raw: ticket,
    }));
}

export function buildTravelReviewQueue(bookings = [], tickets = []) {
  const ticketByBookingId = new Map(
    tickets
      .filter(ticket => ticket.category === 'travel_watchdog' && !['closed', 'resolved'].includes(ticket.status))
      .map(ticket => [ticket.bookingId, ticket])
  );
  const bookingRows = bookings
    .filter(booking => (
      !['resolved', 'dismissed', 'closed'].includes(booking.travelWatchdogResolutionStatus) &&
      (booking.travelWatchdogStatus || booking.noShowCandidate || booking.supportReviewRequired)
    ))
    .map(booking => {
      const ticket = ticketByBookingId.get(booking.id);
      return {
        id: booking.id,
        bookingId: booking.id,
        service: booking.serviceType || booking.title || 'Service',
        consumer: booking.customerName || booking.consumerName || booking.name || 'Consumer',
        worker: booking.workerName || booking.assignedWorker || booking.workerId || 'Worker',
        level: booking.travelWatchdogStatus || (booking.noShowCandidate ? 'timeout_review' : 'support_review'),
        priority: booking.noShowCandidate ? 'High' : 'Medium',
        status: ticket?.status || 'review_needed',
        elapsedMinutes: booking.travelWatchdogEvidence?.elapsedMinutes ?? '',
        staleSeconds: booking.travelWatchdogEvidence?.staleSeconds ?? '',
        nextAction: booking.noShowCandidate ? 'Call worker and consumer before score action' : 'Check ETA, call worker, update consumer',
        raw: booking,
        ticket,
      };
    });
  const ticketOnlyRows = [...ticketByBookingId.values()]
    .filter(ticket => !bookingRows.some(row => row.bookingId === ticket.bookingId))
    .map(ticket => ({
      id: ticket.id,
      bookingId: ticket.bookingId || '',
      service: ticket.evidence?.service || 'Service',
      consumer: ticket.userId || 'Consumer',
      worker: ticket.workerId || 'Worker',
      level: ticket.evidence?.level || 'support_review',
      priority: ticket.priority || 'Medium',
      status: ticket.status || 'open',
      elapsedMinutes: ticket.evidence?.elapsedMinutes ?? '',
      staleSeconds: ticket.evidence?.staleSeconds ?? '',
      nextAction: 'Review route evidence and contact parties',
      raw: ticket,
      ticket,
    }));
  return [...bookingRows, ...ticketOnlyRows];
}

function fieldToMillis(value) {
  if (!value) return 0;
  if (value.toDate) return value.toDate().getTime();
  if (value.seconds) return value.seconds * 1000;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatHistoryTime(value) {
  const millis = fieldToMillis(value);
  if (!millis) return '';
  return new Date(millis).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function buildTravelResolvedHistoryQueue(bookings = [], tickets = []) {
  const rowsByKey = new Map();

  bookings
    .filter(booking => (
      ['resolved', 'dismissed', 'closed'].includes(booking.travelWatchdogResolutionStatus) ||
      booking.travelWatchdogResolutionDecision ||
      booking.travelWatchdogResolvedAt
    ))
    .forEach(booking => {
      const key = booking.id || booking.bookingId;
      if (!key) return;
      rowsByKey.set(key, {
        id: key,
        bookingId: key,
        service: booking.serviceType || booking.title || 'Service',
        consumer: booking.customerName || booking.consumerName || booking.name || 'Consumer',
        worker: booking.workerName || booking.assignedWorker || booking.workerId || 'Worker',
        decision: booking.travelWatchdogResolutionDecision || 'resolved',
        status: booking.travelWatchdogResolutionStatus || 'resolved',
        reason: booking.travelWatchdogResolutionReason || 'Resolution reason not stored',
        payoutDecision: booking.travelWatchdogPayoutDecision || 'no_payout_change',
        scoreDecision: booking.travelWatchdogScoreDecision || 'no_score_change',
        gigScoreReviewEventId: booking.travelWatchdogGigScoreReviewEventId || '',
        resolvedAt: formatHistoryTime(booking.travelWatchdogResolvedAt),
        resolvedAtMs: fieldToMillis(booking.travelWatchdogResolvedAt),
        resolvedBy: booking.travelWatchdogResolvedBy || '',
        level: booking.travelWatchdogStatus || (booking.noShowCandidate ? 'timeout_review' : 'support_review'),
        raw: booking,
      });
    });

  tickets
    .filter(ticket => ticket.category === 'travel_watchdog' && ['closed', 'resolved'].includes(ticket.status))
    .forEach(ticket => {
      const key = ticket.bookingId || ticket.id;
      if (!key) return;
      const existing = rowsByKey.get(key) || {};
      rowsByKey.set(key, {
        id: existing.id || key,
        bookingId: existing.bookingId || ticket.bookingId || '',
        service: existing.service || ticket.evidence?.service || 'Service',
        consumer: existing.consumer || ticket.userId || 'Consumer',
        worker: existing.worker || ticket.workerId || 'Worker',
        decision: existing.decision || ticket.resolutionDecision || 'resolved',
        status: existing.status || (ticket.status === 'closed' ? 'dismissed' : 'resolved'),
        reason: existing.reason || ticket.resolution || 'Resolution reason not stored',
        payoutDecision: existing.payoutDecision || ticket.payoutDecision || 'no_payout_change',
        scoreDecision: existing.scoreDecision || ticket.scoreDecision || 'no_score_change',
        gigScoreReviewEventId: existing.gigScoreReviewEventId || '',
        resolvedAt: existing.resolvedAt || formatHistoryTime(ticket.resolvedAt),
        resolvedAtMs: existing.resolvedAtMs || fieldToMillis(ticket.resolvedAt),
        resolvedBy: existing.resolvedBy || ticket.resolvedBy || '',
        level: existing.level || ticket.evidence?.level || 'support_review',
        raw: existing.raw || ticket,
        ticket,
      });
    });

  return [...rowsByKey.values()]
    .sort((a, b) => (b.resolvedAtMs || 0) - (a.resolvedAtMs || 0));
}

export function buildOperatorConsoleSnapshot({ workers = [], bookings = [], tickets = [] } = {}) {
  const verificationQueue = buildVerificationQueue(workers);
  const disputeQueue = buildDisputeQueue(bookings);
  const qualityQueue = buildQualityQueue(workers, bookings);
  const supportQueue = buildSupportQueue(tickets);
  const travelReviewQueue = buildTravelReviewQueue(bookings, tickets);
  const travelResolvedHistoryQueue = buildTravelResolvedHistoryQueue(bookings, tickets);

  return {
    verificationQueue,
    disputeQueue,
    qualityQueue,
    supportQueue,
    travelReviewQueue,
    travelResolvedHistoryQueue,
    totals: {
      verification: verificationQueue.length,
      disputes: disputeQueue.length,
      quality: qualityQueue.length,
      support: supportQueue.length,
      travel: travelReviewQueue.length,
    },
  };
}
