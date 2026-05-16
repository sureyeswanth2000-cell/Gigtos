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
      priority: booking.dispute?.severity || booking.issueSeverity || 'Normal',
      nextAction: 'Review photos, chat, and timeline',
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
    .filter(worker => (issueCounts[worker.id || worker.uid] || 0) > 0 || Number(worker.socioScore || 500) < 450)
    .map(worker => ({
      id: worker.id || worker.uid,
      name: worker.name || worker.displayName || 'Worker',
      service: worker.gigType || worker.serviceType || 'General service',
      issueCount: issueCounts[worker.id || worker.uid] || 0,
      score: Number(worker.socioScore || 500),
      nextAction: 'Add quality note or request retraining photos',
    }));
}

export function buildSupportQueue(tickets = []) {
  return tickets
    .filter(ticket => !['closed', 'resolved'].includes(ticket.status))
    .map(ticket => ({
      id: ticket.id,
      role: ticket.role || 'consumer',
      title: ticket.title || ticket.issueType || 'Support issue',
      priority: ticket.priority || 'Normal',
      status: ticket.status || 'open',
      nextAction: ticket.nextAction || 'Reply or escalate',
    }));
}

export function buildOperatorConsoleSnapshot({ workers = [], bookings = [], tickets = [] } = {}) {
  const verificationQueue = buildVerificationQueue(workers);
  const disputeQueue = buildDisputeQueue(bookings);
  const qualityQueue = buildQualityQueue(workers, bookings);
  const supportQueue = buildSupportQueue(tickets);

  return {
    verificationQueue,
    disputeQueue,
    qualityQueue,
    supportQueue,
    totals: {
      verification: verificationQueue.length,
      disputes: disputeQueue.length,
      quality: qualityQueue.length,
      support: supportQueue.length,
    },
  };
}
