const fs = require('fs');
const path = require('path');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');

const projectRoot = path.resolve(__dirname, '..', '..');
const projectId = 'demo-gigtos-rules';
const bucketName = 'gigtos-user-uploads-gigto-c0c83';

const firestoreRules = fs.readFileSync(path.join(projectRoot, 'firebase.rules'), 'utf8');
const storageRules = fs.readFileSync(path.join(projectRoot, 'storage.rules'), 'utf8');

const testCases = [];

function test(name, fn) {
  testCases.push({ name, fn });
}

function userDb(env, uid) {
  return env.authenticatedContext(uid).firestore();
}

function anonDb(env) {
  return env.unauthenticatedContext().firestore();
}

function userStorage(env, uid) {
  return env.authenticatedContext(uid).storage(`gs://${bucketName}`);
}

function anonStorage(env) {
  return env.unauthenticatedContext().storage(`gs://${bucketName}`);
}

async function seedFirestore(env, dataByPath) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all(
      Object.entries(dataByPath).map(([docPath, data]) => db.doc(docPath).set(data))
    );
  });
}

test('phone lookup indexes are admin-readable only', async (env) => {
  await seedFirestore(env, {
    'admins/admin-1': { role: 'superadmin', email: 'admin@gigtos.local' },
    'users_by_phone/5551234567': { phone: '5551234567', uid: 'alice', email: 'alice@gigtos.local' },
    'workers_by_phone/5557654321': { phone: '5557654321', uid: 'worker-1', email: 'worker@gigtos.local' },
  });

  await assertFails(anonDb(env).doc('users_by_phone/5551234567').get());
  await assertFails(userDb(env, 'alice').doc('users_by_phone/5551234567').get());
  await assertSucceeds(userDb(env, 'admin-1').doc('users_by_phone/5551234567').get());
  await assertFails(userDb(env, 'alice').doc('workers_by_phone/5557654321').get());
  await assertSucceeds(userDb(env, 'admin-1').doc('workers_by_phone/5557654321').get());
});

test('booking owners can create safe bookings but cannot set protected fields', async (env) => {
  const alice = userDb(env, 'alice');

  await assertSucceeds(alice.doc('bookings/booking-safe').set({
    userId: 'alice',
    customerName: 'Alice',
    phone: '5551234567',
    address: 'Test area',
    serviceType: 'Kitchen Help',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  await assertFails(alice.doc('bookings/booking-with-admin').set({
    userId: 'alice',
    customerName: 'Alice',
    phone: '5551234567',
    address: 'Test area',
    serviceType: 'Kitchen Help',
    status: 'pending',
    adminId: 'admin-1',
    createdAt: new Date(),
  }));

  await assertFails(alice.doc('bookings/booking-safe').update({
    status: 'cancelled',
    statusUpdatedAt: new Date(),
    updatedAt: new Date(),
  }));

  await assertFails(alice.doc('bookings/booking-safe').update({
    adminId: 'admin-1',
    amount: 9999,
  }));
});

test('bookings, dispute analysis, and GigScore events stay scoped to participants', async (env) => {
  await seedFirestore(env, {
    'admins/admin-1': { role: 'superadmin', email: 'admin@gigtos.local' },
    'bookings/private-booking': {
      userId: 'alice',
      adminId: 'admin-1',
      assignedWorkerId: 'worker-1',
      status: 'accepted',
      serviceType: 'Cleaning',
    },
    'bookings/private-booking/dispute_analysis/analysis-1': {
      summary: 'manual review required',
    },
    'gigscore_events/event-1': {
      actorId: 'alice',
      actorRole: 'consumer',
      delta: -20,
      status: 'pending',
    },
  });

  await assertSucceeds(userDb(env, 'alice').doc('bookings/private-booking').get());
  await assertSucceeds(userDb(env, 'worker-1').doc('bookings/private-booking/dispute_analysis/analysis-1').get());
  await assertSucceeds(userDb(env, 'admin-1').doc('gigscore_events/event-1').get());
  await assertFails(userDb(env, 'bob').doc('bookings/private-booking').get());
  await assertFails(userDb(env, 'bob').doc('bookings/private-booking/dispute_analysis/analysis-1').get());
  await assertFails(userDb(env, 'bob').doc('gigscore_events/event-1').get());
  await assertFails(userDb(env, 'alice').doc('gigscore_events/event-client-write').set({
    actorId: 'alice',
    actorRole: 'consumer',
    delta: 100,
    status: 'finalized',
  }));
});

test('support tickets and ride requests enforce ownership and allowed state changes', async (env) => {
  await assertSucceeds(userDb(env, 'alice').doc('support_tickets/ticket-1').set({
    createdBy: 'alice',
    userId: 'alice',
    workerId: 'worker-1',
    bookingId: 'booking-1',
    role: 'consumer',
    category: 'booking',
    subject: 'Need help',
    message: 'Please check this booking.',
    status: 'open',
    priority: 'normal',
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  await assertFails(userDb(env, 'alice').doc('support_tickets/ticket-spoof').set({
    createdBy: 'bob',
    userId: 'bob',
    status: 'open',
    subject: 'Spoofed',
    message: 'Nope',
    createdAt: new Date(),
  }));

  await assertSucceeds(userDb(env, 'alice').doc('rideRequests/ride-1').set({
    userId: 'alice',
    driverType: 'auto',
    pickup: 'A',
    drop: 'B',
    status: 'pending',
    createdAt: new Date(),
    price: 120,
    distanceKm: 3,
    durationMin: 12,
  }));

  await assertFails(userDb(env, 'alice').doc('rideRequests/ride-bad').set({
    userId: 'alice',
    driverType: 'helicopter',
    pickup: 'A',
    drop: 'B',
    status: 'pending',
    createdAt: new Date(),
  }));

  await assertSucceeds(userDb(env, 'driver-1').doc('rideRequests/ride-1').update({
    status: 'accepted',
    driverId: 'driver-1',
    acceptedAt: new Date(),
  }));

  await assertFails(userDb(env, 'driver-2').doc('rideRequests/ride-1').update({
    price: 9999,
  }));
});

test('superadmin-sensitive mutations must go through callable functions', async (env) => {
  await seedFirestore(env, {
    'admins/super-1': { role: 'superadmin', email: 'super@gigtos.local' },
    'admins/region-1': { role: 'regionLead', regionStatus: 'active' },
    'admins/mason-1': { role: 'mason', parentAdminId: 'region-1' },
    'gig_workers/worker-1': {
      adminId: 'mason-1',
      status: 'active',
      isFraud: false,
      approvalStatus: 'approved',
    },
    'platform_settings/copper_monitoring': {
      threshold: 400,
    },
  });

  await assertFails(userDb(env, 'super-1').doc('admins/region-1').update({
    regionStatus: 'suspended',
  }));
  await assertFails(userDb(env, 'super-1').doc('admins/mason-1').update({
    parentAdminId: null,
  }));
  await assertFails(userDb(env, 'super-1').doc('gig_workers/worker-1').update({
    isFraud: true,
    status: 'inactive',
  }));
  await assertFails(userDb(env, 'super-1').doc('platform_settings/copper_monitoring').set({
    threshold: 450,
  }, { merge: true }));
  await assertSucceeds(userDb(env, 'super-1').doc('platform_settings/copper_monitoring').get());
});

test('admin worker operations must go through callable functions', async (env) => {
  await seedFirestore(env, {
    'admins/region-1': { role: 'regionLead', areaName: 'Chennai' },
    'admins/super-1': { role: 'superadmin' },
    'admins/mason-1': { role: 'mason', parentAdminId: 'region-1' },
    'gig_workers/worker-1': {
      adminId: 'mason-1',
      status: 'active',
      approvalStatus: 'approved',
      contact: '5551112222',
    },
    'gig_workers/pending-1': {
      adminId: '',
      status: 'inactive',
      approvalStatus: 'pending',
      area: 'Chennai',
      contact: '5553334444',
    },
    'worker_verification_submissions/pending-1': {
      workerId: 'pending-1',
      reviewStatus: 'pending',
      aadhaarMasked: 'XXXX-XXXX-1234',
      rawIdentityStored: false,
      documents: [{ category: 'profile_photo', storagePath: 'workers/pending-1/verification/profile_photo/a.jpg' }],
    },
  });

  await assertFails(userDb(env, 'mason-1').doc('gig_workers/direct-created').set({
    adminId: 'mason-1',
    status: 'active',
    approvalStatus: 'approved',
    contact: '5559998888',
  }));
  await assertFails(userDb(env, 'mason-1').doc('gig_workers/worker-1').update({
    status: 'inactive',
  }));
  await assertFails(userDb(env, 'region-1').doc('gig_workers/pending-1').update({
    approvalStatus: 'approved',
    adminId: 'mason-1',
    status: 'active',
  }));
  await assertFails(userDb(env, 'region-1').doc('admins/new-mason').set({
    role: 'mason',
    parentAdminId: 'region-1',
  }));
  await assertFails(userDb(env, 'mason-1').doc('workers_by_phone/5551112222').set({
    phone: '5551112222',
    uid: 'worker-1',
  }));
  await assertSucceeds(userDb(env, 'pending-1').doc('worker_verification_submissions/pending-1').get());
  await assertSucceeds(userDb(env, 'super-1').doc('worker_verification_submissions/pending-1').get());
  await assertFails(userDb(env, 'bob').doc('worker_verification_submissions/pending-1').get());
  await assertFails(userDb(env, 'pending-1').doc('worker_verification_submissions/pending-1').set({
    reviewStatus: 'approved',
  }, { merge: true }));

  await assertSucceeds(userDb(env, 'worker-new').doc('gig_workers/worker-new').set({
    adminId: '',
    status: 'inactive',
    approvalStatus: 'pending',
    contact: '5550001111',
  }));
  await assertSucceeds(userDb(env, 'worker-new').doc('workers_by_phone/5550001111').set({
    phone: '5550001111',
    uid: 'worker-new',
    email: 'worker-new@gigtos.local',
  }));
});

test('worker payout bank details stay backend-only', async (env) => {
  await seedFirestore(env, {
    'worker_auth/worker-1': {
      uid: 'worker-1',
      status: 'active',
      approvalStatus: 'approved',
      payoutBankAccountMasked: {
        accountNumberMasked: '****1234',
        accountNumberLast4: '1234',
      },
    },
    'worker_payout_accounts/worker-1': {
      workerId: 'worker-1',
      bankAccount: {
        accountHolderName: 'Worker One',
        accountNumber: '123456789012',
        ifsc: 'HDFC0123456',
        bankName: 'HDFC',
      },
    },
  });

  await assertSucceeds(userDb(env, 'worker-1').doc('worker_auth/worker-1').get());
  await assertFails(userDb(env, 'worker-1').doc('worker_auth/worker-1').update({
    payoutBankAccount: {
      accountHolderName: 'Worker One',
      accountNumber: '123456789012',
      ifsc: 'HDFC0123456',
      bankName: 'HDFC',
    },
  }));
  await assertFails(userDb(env, 'worker-1').doc('worker_payout_accounts/worker-1').get());
  await assertFails(userDb(env, 'worker-1').doc('worker_payout_accounts/worker-1').set({
    workerId: 'worker-1',
  }));
});

test('SOS incidents are backend-written and scoped to actor or admins', async (env) => {
  await seedFirestore(env, {
    'admins/admin-1': { role: 'superadmin', email: 'admin@gigtos.local' },
    'sos_incidents/sos-1': {
      actorId: 'worker-1',
      actorRole: 'worker',
      status: 'open',
      severity: 'high',
    },
  });

  await assertSucceeds(userDb(env, 'worker-1').doc('sos_incidents/sos-1').get());
  await assertSucceeds(userDb(env, 'admin-1').doc('sos_incidents/sos-1').get());
  await assertFails(userDb(env, 'bob').doc('sos_incidents/sos-1').get());
  await assertFails(userDb(env, 'worker-1').doc('sos_incidents/sos-client').set({
    actorId: 'worker-1',
    status: 'open',
  }));
});

test('MVP pricing and queue collections are backend-owned and scoped for reads', async (env) => {
  await seedFirestore(env, {
    'admins/admin-1': { role: 'superadmin', email: 'admin@gigtos.local' },
    'service_price_rules/hyderabad_kukatpally_bathroom_cleaning': {
      city: 'Hyderabad',
      areaId: 'hyderabad_kukatpally',
      serviceId: 'bathroom_cleaning',
      minPrice: 249,
      normalPrice: 349,
      highPrice: 399,
      peakPrice: 499,
      enabled: true,
    },
    'area_demand_snapshots/hyderabad_kukatpally_bathroom_cleaning_2026052710': {
      city: 'Hyderabad',
      areaId: 'hyderabad_kukatpally',
      serviceId: 'bathroom_cleaning',
      demandLevel: 'normal',
      computedAt: new Date(),
    },
    'worker_open_sessions/session-1': {
      workerId: 'worker-1',
      city: 'Hyderabad',
      areaIds: ['hyderabad_kukatpally'],
      serviceIds: ['bathroom_cleaning'],
      areaServiceKeys: ['hyderabad_kukatpally__bathroom_cleaning'],
      status: 'open',
      expiresAt: new Date(Date.now() + 600000),
    },
    'price_quotes/quote-1': {
      userId: 'alice',
      workerId: 'worker-1',
      serviceId: 'bathroom_cleaning',
      city: 'Hyderabad',
      areaId: 'hyderabad_kukatpally',
      finalConsumerPrice: 349,
      workerReceivable: 349,
      status: 'active',
      priceLockedUntil: new Date(Date.now() + 600000),
    },
    'smart_queue_offers/offer-1': {
      bookingId: 'booking-1',
      workerId: 'worker-1',
      city: 'Hyderabad',
      areaId: 'hyderabad_kukatpally',
      serviceId: 'bathroom_cleaning',
      status: 'offered',
      rank: 1,
    },
    'booking_assignment_states/booking-1': {
      bookingId: 'booking-1',
      quoteId: 'quote-1',
      userId: 'alice',
      currentWorkerId: 'worker-1',
      city: 'Hyderabad',
      areaId: 'hyderabad_kukatpally',
      serviceId: 'bathroom_cleaning',
      status: 'offered',
      updatedAt: new Date(),
    },
    'bookings/booking-1': {
      userId: 'alice',
      assignedWorkerId: 'worker-1',
      status: 'in_progress',
      serviceType: 'bathroom_cleaning',
    },
    'booking_live_tracking/booking-1': {
      bookingId: 'booking-1',
      workerId: 'worker-1',
      lat: 17.49,
      lng: 78.39,
      routeStatus: 'en_route',
      locationStatus: 'tracking',
      isActive: true,
      retentionClass: 'active_job_exact_location',
      exactLocationExpiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      expectedTravelMinutes: 10,
      watchdogLevel: 'worker_warning',
      watchdogMessage: 'Travel is taking longer than expected.',
      timestampMs: Date.now(),
      updatedAt: new Date(),
    },
    'travel_watchdog_events/booking-1_worker_warning': {
      bookingId: 'booking-1',
      workerId: 'worker-1',
      level: 'worker_warning',
      noAutoGigScorePenalty: true,
      createdAt: new Date(),
    },
    'demand_refresh_queue/refresh-1': {
      aggregationKey: 'hyderabad__hyderabad_kukatpally__bathroom_cleaning',
      status: 'queued',
      priority: 'high',
    },
    'consumer_ai_memories/alice': {
      uid: 'alice',
      memoryMode: 'summary_only',
    },
    'consumer_ai_memories/alice/items/memory-1': {
      uid: 'alice',
      summary: 'Service preference: Bathroom cleaning.',
      retentionClass: 'summary_only',
    },
    'consumer_ai_audits/audit-1': {
      uid: 'alice',
      messageHash: 'hash',
      tools: ['service_suggestion'],
      createdAt: new Date(),
    },
    'sentry_issue_summaries/frontend_123': {
      source: 'sentry',
      projectSlug: 'frontend',
      issueId: '123',
      title: 'React render failed',
      severity: 'high',
      rawPayloadStored: false,
      updatedAt: new Date(),
    },
    'ai_incident_summaries/sentry_frontend_123': {
      source: 'sentry',
      sourceId: 'frontend_123',
      workflowId: 'sentry_abc123',
      title: 'React render failed',
      severity: 'high',
      aiSummaryAllowed: true,
      rawPayloadStored: false,
      updatedAt: new Date(),
    },
    'jira_issue_handoffs/sentry_frontend_123': {
      source: 'sentry',
      sourceId: 'frontend_123',
      workflowId: 'sentry_abc123',
      title: 'React render failed',
      severity: 'high',
      status: 'pending_configuration',
      rawPayloadStored: false,
      updatedAt: new Date(),
    },
  });

  await assertSucceeds(userDb(env, 'admin-1').doc('service_price_rules/hyderabad_kukatpally_bathroom_cleaning').get());
  await assertFails(userDb(env, 'alice').doc('service_price_rules/hyderabad_kukatpally_bathroom_cleaning').get());
  await assertSucceeds(userDb(env, 'admin-1').doc('area_demand_snapshots/hyderabad_kukatpally_bathroom_cleaning_2026052710').get());
  await assertFails(userDb(env, 'alice').doc('area_demand_snapshots/hyderabad_kukatpally_bathroom_cleaning_2026052710').get());

  await assertSucceeds(userDb(env, 'worker-1').doc('worker_open_sessions/session-1').get());
  await assertFails(userDb(env, 'alice').doc('worker_open_sessions/session-1').get());
  await assertSucceeds(userDb(env, 'alice').doc('price_quotes/quote-1').get());
  await assertSucceeds(userDb(env, 'worker-1').doc('price_quotes/quote-1').get());
  await assertFails(userDb(env, 'bob').doc('price_quotes/quote-1').get());
  await assertSucceeds(userDb(env, 'worker-1').doc('smart_queue_offers/offer-1').get());
  await assertFails(userDb(env, 'alice').doc('smart_queue_offers/offer-1').get());
  await assertSucceeds(userDb(env, 'alice').doc('booking_assignment_states/booking-1').get());
  await assertSucceeds(userDb(env, 'worker-1').doc('booking_assignment_states/booking-1').get());
  await assertSucceeds(userDb(env, 'admin-1').doc('booking_assignment_states/booking-1').get());
  await assertFails(userDb(env, 'bob').doc('booking_assignment_states/booking-1').get());
  await assertSucceeds(userDb(env, 'alice').doc('booking_live_tracking/booking-1').get());
  await assertSucceeds(userDb(env, 'worker-1').doc('booking_live_tracking/booking-1').get());
  await assertFails(userDb(env, 'bob').doc('booking_live_tracking/booking-1').get());
  await assertSucceeds(userDb(env, 'admin-1').doc('travel_watchdog_events/booking-1_worker_warning').get());
  await assertFails(userDb(env, 'worker-1').doc('travel_watchdog_events/booking-1_worker_warning').get());
  await assertSucceeds(userDb(env, 'admin-1').doc('consumer_ai_memories/alice').get());
  await assertSucceeds(userDb(env, 'admin-1').doc('consumer_ai_memories/alice/items/memory-1').get());
  await assertSucceeds(userDb(env, 'admin-1').doc('consumer_ai_audits/audit-1').get());
  await assertSucceeds(userDb(env, 'admin-1').doc('sentry_issue_summaries/frontend_123').get());
  await assertSucceeds(userDb(env, 'admin-1').doc('ai_incident_summaries/sentry_frontend_123').get());
  await assertSucceeds(userDb(env, 'admin-1').doc('jira_issue_handoffs/sentry_frontend_123').get());
  await assertFails(userDb(env, 'alice').doc('consumer_ai_memories/alice').get());
  await assertFails(userDb(env, 'alice').doc('consumer_ai_memories/alice/items/memory-1').get());
  await assertFails(userDb(env, 'alice').doc('consumer_ai_audits/audit-1').get());
  await assertFails(userDb(env, 'alice').doc('sentry_issue_summaries/frontend_123').get());
  await assertFails(userDb(env, 'alice').doc('ai_incident_summaries/sentry_frontend_123').get());
  await assertFails(userDb(env, 'alice').doc('jira_issue_handoffs/sentry_frontend_123').get());

  await assertFails(userDb(env, 'admin-1').doc('service_price_rules/hyderabad_kukatpally_bathroom_cleaning').set({ enabled: false }, { merge: true }));
  await assertFails(userDb(env, 'alice').doc('price_quotes/client-quote').set({ userId: 'alice', finalConsumerPrice: 1 }));
  await assertFails(userDb(env, 'worker-1').doc('worker_open_sessions/session-2').set({ workerId: 'worker-1', status: 'open' }));
  await assertFails(userDb(env, 'alice').doc('consumer_ai_memories/alice/items/client-memory').set({ uid: 'alice', summary: 'raw memory' }));
  await assertFails(userDb(env, 'alice').doc('consumer_ai_audits/client-audit').set({ uid: 'alice', messagePreview: 'raw prompt' }));
  await assertFails(userDb(env, 'admin-1').doc('sentry_issue_summaries/frontend_123').set({ severity: 'low' }, { merge: true }));
  await assertFails(userDb(env, 'admin-1').doc('ai_incident_summaries/sentry_frontend_123').set({ severity: 'low' }, { merge: true }));
  await assertFails(userDb(env, 'admin-1').doc('jira_issue_handoffs/sentry_frontend_123').set({ status: 'closed' }, { merge: true }));
  await assertFails(userDb(env, 'alice').doc('booking_assignment_states/booking-client').set({ userId: 'alice', status: 'searching' }));
  await assertSucceeds(userDb(env, 'worker-1').doc('booking_live_tracking/booking-1').set({
    bookingId: 'booking-1',
    workerId: 'worker-1',
    lat: 17.5,
    lng: 78.4,
    accuracyM: 20,
    speedMps: 4,
    heading: 90,
    distanceRemainingKm: 2.1,
    etaMinutes: 6,
    etaSource: 'haversine_fallback',
    routeStatus: 'en_route',
    locationStatus: 'tracking',
    isActive: true,
    retentionClass: 'active_job_exact_location',
    exactLocationExpiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    timestampMs: Date.now(),
    lastLocationAt: new Date(),
    updatedAt: new Date(),
  }, { merge: true }));
  await assertSucceeds(userDb(env, 'worker-1').doc('worker_location_sessions/session-summary-1').set({
    workerId: 'worker-1',
    bookingId: 'booking-1',
    reachTime: null,
    leftTime: null,
    durationMinutes: null,
    locationStatus: 'tracking',
    retentionClass: 'summary_only',
    lastLocationAt: null,
    startedAt: new Date(),
    updatedAt: new Date(),
  }));
  await assertFails(userDb(env, 'worker-1').doc('worker_location_sessions/session-exact-1').set({
    workerId: 'worker-1',
    bookingId: 'booking-1',
    workLocationLat: 17.49,
    workLocationLng: 78.39,
    locationStatus: 'tracking',
    startedAt: new Date(),
    updatedAt: new Date(),
  }));
  await assertFails(userDb(env, 'worker-1').doc('worker_location_sessions/session-summary-1').set({
    lastLat: 17.5,
    lastLng: 78.4,
  }, { merge: true }));
  await assertFails(userDb(env, 'alice').doc('booking_live_tracking/booking-1').set({
    bookingId: 'booking-1',
    workerId: 'worker-1',
    lat: 1,
    lng: 1,
  }, { merge: true }));
  await assertFails(userDb(env, 'bob').doc('booking_live_tracking/booking-1').set({
    bookingId: 'booking-1',
    workerId: 'bob',
    lat: 1,
    lng: 1,
  }, { merge: true }));
  await assertFails(userDb(env, 'admin-1').doc('demand_refresh_queue/refresh-1').get());
});

test('storage upload paths enforce owner, content type, and no listing', async (env) => {
  const alice = userStorage(env, 'alice');
  const bob = userStorage(env, 'bob');

  await assertSucceeds(
    alice.ref('bookings/requested/alice/photo.png').put(new Uint8Array([1, 2, 3]), {
      contentType: 'image/png',
    })
  );

  await assertFails(
    bob.ref('bookings/requested/alice/bob.png').put(new Uint8Array([1, 2, 3]), {
      contentType: 'image/png',
    })
  );

  await assertFails(
    alice.ref('bookings/requested/alice/not-image.txt').put(new Uint8Array([1, 2, 3]), {
      contentType: 'text/plain',
    })
  );

  await assertSucceeds(alice.ref('bookings/requested/alice/photo.png').getDownloadURL());
  await assertFails(bob.ref('bookings/requested/alice/photo.png').getDownloadURL());
  await assertFails(alice.ref('bookings/requested/alice').listAll());
  await assertSucceeds(alice.ref('workers/alice/verification/profile_photo/profile.jpg').put(new Uint8Array([1, 2, 3]), {
    contentType: 'image/jpeg',
  }));
  await assertSucceeds(alice.ref('workers/alice/verification/previous_platform/proof.pdf').put(new Uint8Array([1, 2, 3]), {
    contentType: 'application/pdf',
  }));
  await assertFails(bob.ref('workers/alice/verification/profile_photo/bob.jpg').put(new Uint8Array([1, 2, 3]), {
    contentType: 'image/jpeg',
  }));
  await assertFails(alice.ref('workers/alice/verification/profile_photo/script.js').put(new Uint8Array([1, 2, 3]), {
    contentType: 'application/javascript',
  }));
  await assertFails(bob.ref('workers/alice/verification/profile_photo/profile.jpg').getDownloadURL());
  await assertFails(alice.ref('workers/alice/verification/profile_photo').listAll());
  await assertFails(anonStorage(env).ref('workerLicenses/alice/license.png').put(new Uint8Array([1]), {
    contentType: 'image/png',
  }));
});

async function main() {
  const env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: firestoreRules },
    storage: { rules: storageRules },
  });

  let failed = 0;
  try {
    for (const { name, fn } of testCases) {
      await env.clearFirestore();
      await env.clearStorage();
      try {
        await fn(env);
        console.log(`PASS ${name}`);
      } catch (err) {
        failed += 1;
        console.error(`FAIL ${name}`);
        console.error(err && err.stack ? err.stack : err);
      }
    }
  } finally {
    await env.cleanup();
  }

  if (failed > 0) {
    throw new Error(`${failed} Firebase rules test(s) failed`);
  }

  console.log(`PASS Firebase rules unit tests (${testCases.length} cases)`);
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
