export function createBadMatchRecord({
  consumerId,
  workerId,
  bookingId,
  rating,
  reason = 'verified_1_star',
  createdAt = new Date(),
}) {
  if (!consumerId) throw new Error('consumerId is required');
  if (!workerId) throw new Error('workerId is required');
  if (Number(rating) !== 1) throw new Error('bad-match block requires verified 1-star rating');

  return {
    id: `${consumerId}_${workerId}_${bookingId || createdAt.getTime()}`,
    consumerId,
    workerId,
    bookingId: bookingId || null,
    reason,
    rating: Number(rating),
    active: true,
    createdAt,
    removedAt: null,
    removedBy: null,
    removalReason: null,
  };
}

export function shouldHideWorkerForConsumer({ consumerId, workerId, badMatches = [] }) {
  return badMatches.some(
    (match) => match.consumerId === consumerId && match.workerId === workerId && match.active !== false
  );
}

export function removeBadMatchRecord(record, { removedBy, removalReason, removedAt = new Date() }) {
  if (!removedBy) throw new Error('removedBy is required');
  if (!removalReason) throw new Error('removalReason is required');
  return {
    ...record,
    active: false,
    removedBy,
    removalReason,
    removedAt,
  };
}
