/**
 * scripts/migrate_from_firestore.js
 *
 * One-time migration: Firestore → PostgreSQL (Firebase Data Connect)
 * Gigtos @ 1 Lakh Users
 *
 * Usage:
 *   node scripts/migrate_from_firestore.js
 *
 * Prerequisites:
 *   npm install firebase-admin pg dotenv
 *
 * Environment variables (create a .env file or set in shell):
 *   GOOGLE_APPLICATION_CREDENTIALS  — path to Firebase service account JSON
 *   PG_HOST       — PostgreSQL host (Cloud SQL proxy: 127.0.0.1)
 *   PG_PORT       — PostgreSQL port (default: 5432)
 *   PG_DATABASE   — Database name (gigtos)
 *   PG_USER       — Database user  (gigtos_app_user)
 *   PG_PASSWORD   — Database password
 *
 * Migration order (respects FK constraints):
 *   1.  service_types  (seed data — skip if 004_seed_data.sql ran)
 *   2.  time_slots     (seed data — skip if 004_seed_data.sql ran)
 *   3.  admin_roles    (seed data — skip if 004_seed_data.sql ran)
 *   4.  users          ← Firestore: users
 *   5.  admins         ← Firestore: admins
 *   6.  workers        ← Firestore: gig_workers  (workers_by_phone dropped)
 *   7.  bookings       ← Firestore: bookings
 *   8.  booking_quotes ← Firestore: bookings[].quotes[]
 *   9.  disputes       ← Firestore: bookings[].dispute{}
 *  10.  commissions    ← Firestore: bookings[].commissions{}
 *  11.  cashbacks      ← Firestore: cashbacks
 *  12.  activity_logs  ← Firestore: activity_logs
 *  13.  admin_alerts   ← Firestore: admin_alerts
 *  14.  booking_chat   ← Firestore: bookings/{id}/chat (subcollection)
 *  15.  booking_photos ← Firestore: bookings[].photos[] + requestedPhotos[]
 *  16.  booking_daily_notes ← Firestore: bookings[].dailyNotes[]
 *  17.  booking_sla    ← Firestore: bookings[].sla{}
 */

'use strict';

require('dotenv').config();
const admin = require('firebase-admin');
const { Pool } = require('pg');

// ─── Firebase Init ────────────────────────────────────────────────────────────

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

// ─── PostgreSQL Pool ──────────────────────────────────────────────────────────

const pool = new Pool({
  host:     process.env.PG_HOST     || '127.0.0.1',
  port:     parseInt(process.env.PG_PORT || '5432', 10),
  database: process.env.PG_DATABASE || 'gigtos',
  user:     process.env.PG_USER     || 'gigtos_app_user',
  password: process.env.PG_PASSWORD,
  max:      10,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert Firestore Timestamp → JS Date (or null) */
function toDate(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate();
  if (val instanceof Date) return val;
  return null;
}

/** Batch insert rows into PostgreSQL, skipping duplicates */
async function batchInsert(client, table, columns, rows) {
  if (rows.length === 0) return 0;
  const CHUNK = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const placeholders = chunk.map(
      (_, ri) => `(${columns.map((_, ci) => `$${ri * columns.length + ci + 1}`).join(', ')})`
    ).join(', ');
    const values = chunk.flatMap(r => columns.map(c => r[c] ?? null));
    const sql = `INSERT INTO gigtos_oltp.${table} (${columns.join(', ')})
                 VALUES ${placeholders}
                 ON CONFLICT DO NOTHING`;
    const result = await client.query(sql, values);
    total += result.rowCount;
  }
  return total;
}

/** Fetch all documents from a Firestore collection */
async function fetchCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
}

/** Fetch a subcollection for each document in a parent list */
async function fetchSubcollection(parentCol, subcol) {
  const parents = await db.collection(parentCol).get();
  const results = [];
  await Promise.all(
    parents.docs.map(async parentDoc => {
      const sub = await parentDoc.ref.collection(subcol).get();
      sub.docs.forEach(d => results.push({
        _parentId: parentDoc.id,
        _id: d.id,
        ...d.data(),
      }));
    })
  );
  return results;
}

/** Look up a PostgreSQL UUID by a lookup map (Firestore UID → PG UUID) */
function pgId(map, firestoreId) {
  return firestoreId ? (map[firestoreId] || null) : null;
}

// ─── Migration Steps ──────────────────────────────────────────────────────────

async function migrateUsers(client) {
  console.log('[4/17] Migrating users...');
  const docs = await fetchCollection('users');
  const rows = docs.map(d => ({
    firebase_uid: d._id,
    name:         d.name || 'Unknown',
    email:        d.email || null,
    phone:        d.phone || d.phoneNumber || '',
    address:      d.address || null,
    created_at:   toDate(d.createdAt) || new Date(),
    updated_at:   toDate(d.updatedAt) || new Date(),
  }));
  const n = await batchInsert(client,
    'users',
    ['firebase_uid','name','email','phone','address','created_at','updated_at'],
    rows
  );
  console.log(`   → ${n} users inserted`);

  // Build firebase_uid → user_id map for FK resolution
  const res = await client.query('SELECT user_id, firebase_uid FROM gigtos_oltp.users');
  return Object.fromEntries(res.rows.map(r => [r.firebase_uid, r.user_id]));
}

async function migrateAdmins(client) {
  console.log('[5/17] Migrating admins...');
  const docs = await fetchCollection('admins');

  // Get role IDs
  const roleRes = await client.query('SELECT id, role_name FROM gigtos_oltp.admin_roles');
  const roleMap = Object.fromEntries(roleRes.rows.map(r => [r.role_name, r.id]));

  const rows = docs.map(d => {
    const roleName = d.role || 'mason';
    return {
      firebase_uid:        d._id,
      name:                d.name || d.email || 'Admin',
      email:               d.email || '',
      role_id:             roleMap[roleName] || roleMap['mason'],
      parent_admin_id:     null, // resolved in second pass after all admins inserted
      area_name:           d.areaName || d.area || null,
      region_score:        d.regionScore ?? 100,
      region_status:       d.regionStatus || 'active',
      probation_status:    d.probationStatus || false,
      fraud_count:         d.fraudCount || 0,
      total_disputes:      d.totalDisputes || 0,
      avg_resolution_time: d.avgResolutionTime || 0,
      approval_status:     d.approvalStatus || 'approved',
      status:              d.status || 'active',
      created_at:          toDate(d.createdAt) || new Date(),
      updated_at:          toDate(d.updatedAt) || new Date(),
    };
  });

  const n = await batchInsert(client,
    'admins',
    ['firebase_uid','name','email','role_id','area_name','region_score',
     'region_status','probation_status','fraud_count','total_disputes',
     'avg_resolution_time','approval_status','status','created_at','updated_at'],
    rows
  );
  console.log(`   → ${n} admins inserted`);

  // Build firebase_uid → admin_id map
  const res = await client.query('SELECT admin_id, firebase_uid FROM gigtos_oltp.admins');
  const adminMap = Object.fromEntries(res.rows.map(r => [r.firebase_uid, r.admin_id]));

  // Second pass: resolve parent_admin_id
  for (const d of docs) {
    if (d.parentAdminId) {
      const parentPgId = adminMap[d.parentAdminId];
      const selfPgId   = adminMap[d._id];
      if (parentPgId && selfPgId) {
        await client.query(
          'UPDATE gigtos_oltp.admins SET parent_admin_id = $1 WHERE admin_id = $2',
          [parentPgId, selfPgId]
        );
      }
    }
  }

  return adminMap;
}

async function migrateWorkers(client, adminMap) {
  console.log('[6/17] Migrating workers (gig_workers)...');
  const docs = await fetchCollection('gig_workers');

  // Get service type IDs
  const stRes = await client.query('SELECT id, name FROM gigtos_oltp.service_types');
  const stMap = Object.fromEntries(stRes.rows.map(r => [r.name.toLowerCase(), r.id]));

  const rows = docs.map(d => {
    const gigType = (d.gigType || d.serviceType || 'plumber').toLowerCase();
    return {
      name:            d.name || 'Worker',
      phone:           d.contact || d.phone || '',
      email:           d.email || null,
      area:            d.area || '',
      service_type_id: stMap[gigType] || stMap['plumber'] || 1,
      certifications:  d.certifications || null,
      bank_details:    d.bankDetails ? JSON.stringify(d.bankDetails) : null,
      total_earnings:  d.totalEarnings || 0,
      status:          d.status || 'active',
      approval_status: d.approvalStatus || 'pending',
      is_available:    d.isAvailable !== false,
      is_fraud:        d.isFraud || false,
      rating:          d.rating || 0,
      completed_jobs:  d.completedJobs || 0,
      is_top_listed:   d.isTopListed || false,
      admin_id:        pgId(adminMap, d.adminId),
      created_at:      toDate(d.createdAt) || new Date(),
      updated_at:      toDate(d.updatedAt) || new Date(),
    };
  }).filter(r => r.admin_id && r.phone); // skip workers without a valid admin or phone

  const n = await batchInsert(client,
    'workers',
    ['name','phone','email','area','service_type_id','certifications','bank_details',
     'total_earnings','status','approval_status','is_available','is_fraud','rating',
     'completed_jobs','is_top_listed','admin_id','created_at','updated_at'],
    rows
  );
  console.log(`   → ${n} workers inserted`);

  const res = await client.query('SELECT worker_id, phone FROM gigtos_oltp.workers');
  return Object.fromEntries(res.rows.map(r => [r.phone, r.worker_id]));
}

async function migrateBookings(client, userMap, adminMap, workerMap) {
  console.log('[7/17] Migrating bookings...');
  const docs = await fetchCollection('bookings');

  const stRes = await client.query('SELECT id, name FROM gigtos_oltp.service_types');
  const stMap = Object.fromEntries(stRes.rows.map(r => [r.name.toLowerCase(), r.id]));

  const validStatuses = new Set([
    'pending','scheduled','quoted','accepted','assigned',
    'in_progress','awaiting_confirmation','completed','cancelled'
  ]);
  const validEscrow = new Set([
    'pending','pending_acceptance','held','released','refunded'
  ]);

  const rows = docs.map(d => {
    const gigType = (d.gigType || d.serviceType || 'plumber').toLowerCase();
    const status  = validStatuses.has(d.status) ? d.status : 'pending';
    const escrow  = validEscrow.has(d.escrowStatus) ? d.escrowStatus : 'pending';

    // Resolve worker from workerMap (by phone) or assignedWorkerId
    let workerId = null;
    if (d.assignedWorkerId && workerMap[d.assignedWorkerId]) {
      workerId = workerMap[d.assignedWorkerId];
    } else if (d.workerPhone && workerMap[d.workerPhone]) {
      workerId = workerMap[d.workerPhone];
    }

    return {
      booking_id:               d._id,
      user_id:                  pgId(userMap, d.userId),
      service_type_id:          stMap[gigType] || 1,
      issue_title:              d.issueTitle || d.title || 'Service Request',
      job_details:              d.jobDetails || d.description || null,
      status,
      scheduled_date:           toDate(d.scheduledDate),
      estimated_days:           d.estimatedDays || 1,
      completed_work_days:      d.completedWorkDays || 0,
      is_multi_day:             d.isMultiDay || false,
      started_at:               toDate(d.startedAt),
      finished_at:              toDate(d.finishedAt),
      admin_id:                 pgId(adminMap, d.adminId),
      assigned_worker_id:       workerId,
      escrow_status:            escrow,
      is_commission_processed:  d.isCommissionProcessed || false,
      rating:                   d.rating || null,
      created_at:               toDate(d.createdAt) || new Date(),
      updated_at:               toDate(d.updatedAt) || new Date(),
    };
  }).filter(r => r.user_id); // skip bookings without a valid user

  const n = await batchInsert(client,
    'bookings',
    ['booking_id','user_id','service_type_id','issue_title','job_details','status',
     'scheduled_date','estimated_days','completed_work_days','is_multi_day',
     'started_at','finished_at','admin_id','assigned_worker_id','escrow_status',
     'is_commission_processed','rating','created_at','updated_at'],
    rows
  );
  console.log(`   → ${n} bookings inserted`);

  // Build Firestore doc ID → PG booking_id map
  const res = await client.query('SELECT booking_id FROM gigtos_oltp.bookings');
  return new Set(res.rows.map(r => r.booking_id));
}

async function migrateBookingQuotes(client, adminMap) {
  console.log('[8/17] Migrating booking_quotes...');
  const bookingDocs = await fetchCollection('bookings');
  const rows = [];

  for (const b of bookingDocs) {
    const quotes = b.quotes || [];
    for (const q of quotes) {
      rows.push({
        booking_id:  b._id,
        admin_id:    pgId(adminMap, q.adminId || q.submittedBy),
        price:       q.price || q.amount || 0,
        is_accepted: q.isAccepted || false,
        created_at:  toDate(q.createdAt) || new Date(),
      });
    }
  }

  const validRows = rows.filter(r => r.admin_id);
  const n = await batchInsert(client,
    'booking_quotes',
    ['booking_id','admin_id','price','is_accepted','created_at'],
    validRows
  );
  console.log(`   → ${n} booking quotes inserted`);
}

async function migrateDisputes(client, userMap, adminMap) {
  console.log('[9/17] Migrating disputes...');
  const bookingDocs = await fetchCollection('bookings');
  const rows = [];

  for (const b of bookingDocs) {
    const d = b.dispute;
    if (!d) continue;

    rows.push({
      booking_id:          b._id,
      status:              d.status === 'resolved' ? 'resolved' : 'open',
      reason:              d.reason || null,
      raised_at:           toDate(d.raisedAt) || new Date(),
      raised_by:           pgId(userMap, d.raisedBy || b.userId),
      auto_triggered:      d.autoTriggered || false,
      escalation_status:   d.escalationStatus || false,
      escalated_at:        toDate(d.escalatedAt),
      decision:            d.decision || null,
      resolution_time:     toDate(d.resolutionTime),
      resolved_by:         pgId(adminMap, d.resolvedBy),
      superadmin_override: d.superadminOverride || false,
      region_call_time:    toDate(d.regionCallTime),
      call_notes:          d.callNotes || null,
      visit_time:          toDate(d.visitTime),
    });
  }

  const validRows = rows.filter(r => r.raised_by);
  const n = await batchInsert(client,
    'disputes',
    ['booking_id','status','reason','raised_at','raised_by','auto_triggered',
     'escalation_status','escalated_at','decision','resolution_time','resolved_by',
     'superadmin_override','region_call_time','call_notes','visit_time'],
    validRows
  );
  console.log(`   → ${n} disputes inserted`);
}

async function migrateCommissions(client) {
  console.log('[10/17] Migrating commissions...');
  const bookingDocs = await fetchCollection('bookings');
  const rows = [];

  for (const b of bookingDocs) {
    const c = b.commissions || b.commission;
    if (!c) continue;
    rows.push({
      booking_id:             b._id,
      total_visiting_charge:  c.totalVisitingCharge || 150,
      worker_share:           c.workerShare || 80,
      local_admin_share:      c.localAdminShare || 20,
      gigto_share:            c.gigtoShare || 50,
      calculated_at:          toDate(c.calculatedAt) || new Date(),
    });
  }

  const n = await batchInsert(client,
    'commissions',
    ['booking_id','total_visiting_charge','worker_share','local_admin_share',
     'gigto_share','calculated_at'],
    rows
  );
  console.log(`   → ${n} commissions inserted`);
}

async function migrateCashbacks(client, userMap) {
  console.log('[11/17] Migrating cashbacks...');
  const docs = await fetchCollection('cashbacks');
  const rows = docs.map(d => ({
    user_id:    pgId(userMap, d.userId),
    booking_id: d.bookingId,
    amount:     d.amount || 9,
    status:     d.status || 'active',
    issued_at:  toDate(d.issuedAt) || new Date(),
    expires_at: toDate(d.expiryDate || d.expiresAt) || new Date(Date.now() + 15 * 86400000),
  })).filter(r => r.user_id && r.booking_id);

  const n = await batchInsert(client,
    'cashbacks',
    ['user_id','booking_id','amount','status','issued_at','expires_at'],
    rows
  );
  console.log(`   → ${n} cashbacks inserted`);
}

async function migrateActivityLogs(client) {
  console.log('[12/17] Migrating activity_logs...');
  const docs = await fetchCollection('activity_logs');
  const rows = docs.map(d => ({
    booking_id:  d.bookingId,
    actor_id:    d.actorId || null,
    actor_role:  d.actorRole || 'system',
    action:      d.action || 'unknown',
    from_status: d.fromStatus || null,
    to_status:   d.toStatus || null,
    reason:      d.reason || null,
    rating:      d.rating || null,
    amount:      d.amount || null,
    worker_id:   d.workerId || null,
    admin_id:    d.adminId || null,
    price:       d.price || null,
    decision:    d.decision || null,
    created_at:  toDate(d.timestamp || d.createdAt) || new Date(),
  })).filter(r => r.booking_id);

  const n = await batchInsert(client,
    'activity_logs',
    ['booking_id','actor_id','actor_role','action','from_status','to_status',
     'reason','rating','amount','worker_id','admin_id','price','decision','created_at'],
    rows
  );
  console.log(`   → ${n} activity logs inserted`);
}

async function migrateAdminAlerts(client, adminMap) {
  console.log('[13/17] Migrating admin_alerts...');
  const docs = await fetchCollection('admin_alerts');
  const rows = docs.map(d => ({
    admin_id:   pgId(adminMap, d.adminId),
    booking_id: d.bookingId || null,
    type:       d.type || 'notification',
    status:     d.status || 'open',
    title:      d.title || null,
    message:    d.message || null,
    created_at: toDate(d.createdAt) || new Date(),
  })).filter(r => r.admin_id);

  const n = await batchInsert(client,
    'admin_alerts',
    ['admin_id','booking_id','type','status','title','message','created_at'],
    rows
  );
  console.log(`   → ${n} admin alerts inserted`);
}

async function migrateBookingChat(client) {
  console.log('[14/17] Migrating booking_chat subcollections...');
  const messages = await fetchSubcollection('bookings', 'chat');
  const rows = messages.map(m => ({
    booking_id:  m._parentId,
    sender_id:   m.senderId || m.userId || m.adminId,
    sender_role: m.senderRole || (m.adminId ? 'admin' : 'user'),
    message:     m.message || m.text || '',
    created_at:  toDate(m.createdAt || m.timestamp) || new Date(),
  })).filter(r => r.booking_id && r.sender_id && r.message);

  const n = await batchInsert(client,
    'booking_chat',
    ['booking_id','sender_id','sender_role','message','created_at'],
    rows
  );
  console.log(`   → ${n} chat messages inserted`);
}

async function migrateBookingPhotos(client) {
  console.log('[15/17] Migrating booking_photos...');
  const bookingDocs = await fetchCollection('bookings');
  const rows = [];

  for (const b of bookingDocs) {
    // Submitted photos
    for (const p of (b.photos || [])) {
      rows.push({
        booking_id:   b._id,
        label:        p.label || null,
        url:          p.url || p,
        photo_type:   'submitted',
        uploaded_by:  p.uploadedBy || null,
        uploaded_at:  toDate(p.uploadedAt) || new Date(),
      });
    }
    // Requested photos
    for (const p of (b.requestedPhotos || [])) {
      rows.push({
        booking_id:   b._id,
        label:        p.label || p,
        url:          p.url || '',
        photo_type:   'requested',
        uploaded_by:  null,
        uploaded_at:  toDate(b.createdAt) || new Date(),
      });
    }
  }

  const validRows = rows.filter(r => r.url);
  const n = await batchInsert(client,
    'booking_photos',
    ['booking_id','label','url','photo_type','uploaded_by','uploaded_at'],
    validRows
  );
  console.log(`   → ${n} booking photos inserted`);
}

async function migrateBookingDailyNotes(client, adminMap) {
  console.log('[16/17] Migrating booking_daily_notes...');
  const bookingDocs = await fetchCollection('bookings');
  const rows = [];

  for (const b of bookingDocs) {
    for (const n of (b.dailyNotes || [])) {
      rows.push({
        booking_id: b._id,
        note_date:  toDate(n.date || n.noteDate) || new Date(),
        note:       n.note || n.text || '',
        added_by:   pgId(adminMap, n.addedBy || b.adminId),
        created_at: toDate(n.createdAt) || new Date(),
      });
    }
  }

  const validRows = rows.filter(r => r.added_by && r.note);
  const n = await batchInsert(client,
    'booking_daily_notes',
    ['booking_id','note_date','note','added_by','created_at'],
    validRows
  );
  console.log(`   → ${n} daily notes inserted`);
}

async function migrateBookingSla(client, adminMap) {
  console.log('[17/17] Migrating booking_sla...');
  const bookingDocs = await fetchCollection('bookings');
  const rows = [];

  for (const b of bookingDocs) {
    const s = b.sla;
    if (!s) continue;
    rows.push({
      booking_id:       b._id,
      breached:         s.breached || false,
      notified:         s.notified || false,
      breached_at:      toDate(s.breachedAt),
      status_at_breach: s.statusAtBreach || null,
      region_lead_id:   pgId(adminMap, s.regionLeadId || b.adminId),
    });
  }

  const n = await batchInsert(client,
    'booking_sla',
    ['booking_id','breached','notified','breached_at','status_at_breach','region_lead_id'],
    rows
  );
  console.log(`   → ${n} SLA records inserted`);
}

// ─── Validation ───────────────────────────────────────────────────────────────

async function validateMigration(client) {
  console.log('\n=== Post-Migration Validation ===');
  const tables = [
    'users','admins','workers','bookings','booking_quotes',
    'disputes','commissions','cashbacks','activity_logs',
    'admin_alerts','booking_chat','booking_photos',
    'booking_daily_notes','booking_sla',
  ];
  for (const t of tables) {
    const res = await client.query(
      `SELECT COUNT(*) AS cnt FROM gigtos_oltp.${t}`
    );
    console.log(`  ${t.padEnd(25)} → ${res.rows[0].cnt} rows`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Gigtos: Firestore → PostgreSQL Migration        ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('[1-3/17] Seed data assumed applied via 004_seed_data.sql\n');

    const userMap  = await migrateUsers(client);
    const adminMap = await migrateAdmins(client);
    const workerMap = await migrateWorkers(client, adminMap);

    await migrateBookings(client, userMap, adminMap, workerMap);
    await migrateBookingQuotes(client, adminMap);
    await migrateDisputes(client, userMap, adminMap);
    await migrateCommissions(client);
    await migrateCashbacks(client, userMap);
    await migrateActivityLogs(client);
    await migrateAdminAlerts(client, adminMap);
    await migrateBookingChat(client);
    await migrateBookingPhotos(client);
    await migrateBookingDailyNotes(client, adminMap);
    await migrateBookingSla(client, adminMap);

    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully.');

    await validateMigration(client);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed — transaction rolled back.');
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

main();
