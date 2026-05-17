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

export function getExperiencedWorkerBadge({
  externalPlatformProofs = [],
  legalCopyApproved = false,
} = {}) {
  const approvedProof = externalPlatformProofs.find((proof) => proof?.verificationStatus === 'approved');

  if (!approvedProof) {
    return {
      visible: false,
      label: '',
      description: '',
      reason: 'no_approved_previous_platform_proof',
    };
  }

  return {
    visible: true,
    type: 'verified_previous_platform_experience',
    label: 'Verified previous platform experience',
    description: legalCopyApproved && approvedProof.platformName
      ? `Experience proof reviewed from ${approvedProof.platformName}.`
      : 'Experience proof reviewed by Gigtos. Platform names are hidden until legal copy is approved.',
    maskedId: approvedProof.maskedId,
    sourcePlatformName: legalCopyApproved ? approvedProof.platformName : null,
  };
}
