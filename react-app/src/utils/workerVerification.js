export function createExternalPlatformProof({
  workerId,
  platformName,
  externalId,
  reviewedBy = null,
  status = 'pending',
  submittedAt = new Date(),
}) {
  if (!workerId) throw new Error('workerId is required');
  if (!platformName) throw new Error('platformName is required');
  if (!externalId) throw new Error('externalId is required');

  const visible = String(externalId).slice(-4);

  return {
    workerId,
    platformName,
    maskedId: `****${visible}`,
    verificationStatus: status,
    reviewedBy,
    reviewedAt: reviewedBy ? submittedAt : null,
    submittedAt,
    freeAccessUntil: null,
    audit: [
      {
        action: 'submitted',
        at: submittedAt,
        actorId: workerId,
        status,
      },
    ],
  };
}

export function approveExternalPlatformProof(proof, { reviewedBy, reviewedAt = new Date(), freeAccessUntil }) {
  if (!reviewedBy) throw new Error('reviewedBy is required');
  return {
    ...proof,
    verificationStatus: 'approved',
    reviewedBy,
    reviewedAt,
    freeAccessUntil,
    audit: [
      ...(proof.audit || []),
      {
        action: 'approved',
        at: reviewedAt,
        actorId: reviewedBy,
        status: 'approved',
      },
    ],
  };
}
