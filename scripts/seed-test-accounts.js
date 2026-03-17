/**
 * GIGTO – Seed Test Accounts
 * ============================================================
 * Creates one Firebase Auth + Firestore account for every role
 * so the whole team can test every part of the platform.
 *
 * PREREQUISITES
 * -------------
 *   1. Install deps once (from the repo root):
 *        npm install --save-dev firebase-admin
 *   2. Download a Firebase service-account key from
 *        Firebase Console → Project Settings → Service accounts
 *        → Generate new private key
 *   3. Set the path to that key file:
 *        export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
 *
 * USAGE
 *   node scripts/seed-test-accounts.js
 *
 * The script is IDEMPOTENT – it deletes any existing test
 * accounts first, then re-creates them fresh.
 *
 * ⚠️  FOR DEVELOPMENT / TESTING ONLY.
 *     Never run against a production Firebase project.
 * ============================================================
 */

'use strict';

const admin = require('firebase-admin');

// ---------------------------------------------------------------------------
// Firebase init
// ---------------------------------------------------------------------------
admin.initializeApp();
const auth = admin.auth();
const db   = admin.firestore();

// ---------------------------------------------------------------------------
// Test-account definitions
// ---------------------------------------------------------------------------
const TEST_ACCOUNTS = [
  // ── 1. USER ──────────────────────────────────────────────
  {
    role        : 'user',
    displayName : 'Test User',
    email       : 'testuser@gigto.dev',
    password    : 'TestUser@123',
    phone       : '9999900001',
    /** Returns the Firestore writes needed after account creation. */
    firestoreWrites: (uid) => [
      {
        collection: 'users',
        docId: uid,
        data: {
          phone    : '9999900001',
          email    : 'testuser@gigto.dev',
          name     : 'Test User',
          address  : '123 Test Street, Test City',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      {
        collection: 'users_by_phone',
        docId: '9999900001',
        data: {
          email: 'testuser@gigto.dev',
        },
      },
    ],
    loginInstructions: [
      'Go to /auth → "Book Services as a User"',
      'Phone: 9999900001',
      'Password: TestUser@123',
    ],
  },

  // ── 2. MASON ─────────────────────────────────────────────
  {
    role        : 'mason',
    displayName : 'Test Mason',
    email       : 'testmason@gigto.dev',
    password    : 'TestMason@123',
    firestoreWrites: (uid) => [
      {
        collection: 'admins',
        docId: uid,
        data: {
          uid      : uid,
          email    : 'testmason@gigto.dev',
          name     : 'Test Mason',
          role     : 'mason',
          areaName : 'Test Area',
          status   : 'active',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
    ],
    loginInstructions: [
      'Go to /auth → "Manage Services as Admin"',
      'Email: testmason@gigto.dev',
      'Password: TestMason@123',
      'Dashboard: /admin/bookings',
    ],
  },

  // ── 3. REGION LEAD ───────────────────────────────────────
  {
    role        : 'regionLead',
    displayName : 'Test Region Lead',
    email       : 'testregionlead@gigto.dev',
    password    : 'TestRegLead@123',
    firestoreWrites: (uid) => [
      {
        collection: 'admins',
        docId: uid,
        data: {
          uid      : uid,
          email    : 'testregionlead@gigto.dev',
          name     : 'Test Region Lead',
          role     : 'regionLead',
          areaName : 'Test Region',
          status   : 'active',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
    ],
    loginInstructions: [
      'Go to /auth → "Manage Services as Admin"',
      'Email: testregionlead@gigto.dev',
      'Password: TestRegLead@123',
      'Dashboard: /admin/region-lead',
    ],
  },

  // ── 4. SUPER ADMIN ───────────────────────────────────────
  {
    role        : 'superadmin',
    displayName : 'Test Super Admin',
    email       : 'testsuperadmin@gigto.dev',
    password    : 'TestSuperAdmin@123',
    firestoreWrites: (uid) => [
      {
        collection: 'admins',
        docId: uid,
        data: {
          uid      : uid,
          email    : 'testsuperadmin@gigto.dev',
          name     : 'Test Super Admin',
          role     : 'superadmin',
          status   : 'active',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
    ],
    loginInstructions: [
      'Go to /auth → "Manage Services as Admin"',
      'Email: testsuperadmin@gigto.dev',
      'Password: TestSuperAdmin@123',
      'Dashboard: /admin/super',
    ],
  },

  // ── 5. WORKER ────────────────────────────────────────────
  {
    role        : 'worker',
    displayName : 'Test Worker',
    email       : 'testworker@gigto.dev',
    password    : 'TestWorker@123',
    phone       : '9999900005',
    firestoreWrites: (uid) => [
      {
        collection: 'gig_workers',
        docId: uid,
        data: {
          name          : 'Test Worker',
          contact       : '9999900005',
          email         : 'testworker@gigto.dev',
          gigType       : 'plumber',
          area          : 'Test Area',
          certifications: '',
          bankDetails   : '',
          totalEarnings : 0,
          adminId       : '',
          approvalStatus: 'approved',
          status        : 'active',
          completedJobs : 0,
          rating        : 0,
          isTopListed   : false,
          isFraud       : false,
          createdAt     : admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      {
        collection: 'workers_by_phone',
        docId: '9999900005',
        data: {
          phone         : '9999900005',
          email         : 'testworker@gigto.dev',
          uid           : uid,
          name          : 'Test Worker',
          gigType       : 'plumber',
          area          : 'Test Area',
          certifications: '',
          bankDetails   : '',
          totalEarnings : 0,
          approvalStatus: 'approved',
          status        : 'active',
          createdAt     : admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      {
        collection: 'worker_auth',
        docId: uid,
        data: {
          uid           : uid,
          phone         : '9999900005',
          email         : 'testworker@gigto.dev',
          name          : 'Test Worker',
          gigType       : 'plumber',
          area          : 'Test Area',
          certifications: '',
          bankDetails   : '',
          totalEarnings : 0,
          adminId       : '',
          approvalStatus: 'approved',
          status        : 'active',
          activatedAt   : admin.firestore.FieldValue.serverTimestamp(),
          createdAt     : admin.firestore.FieldValue.serverTimestamp(),
        },
      },
    ],
    loginInstructions: [
      'Go to /auth → "Register as Worker" → "Login (Phone + Password)"',
      'Phone: 9999900005',
      'Password: TestWorker@123',
      'Dashboard: /worker/dashboard',
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function deleteIfExists(email) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.deleteUser(existing.uid);
    console.log(`  🗑  Deleted existing account: ${email}`);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
  }
}

async function seedAccount(account) {
  console.log(`\n📋 Seeding [${account.role}] – ${account.email}`);

  // 1. Remove any existing account with this email
  await deleteIfExists(account.email);

  // 2. Create Firebase Auth user
  const userRecord = await auth.createUser({
    email       : account.email,
    password    : account.password,
    displayName : account.displayName,
    emailVerified: true,
  });
  console.log(`  ✅ Auth user created: uid=${userRecord.uid}`);

  // 3. Write Firestore documents
  const writes = account.firestoreWrites(userRecord.uid);
  for (const write of writes) {
    await db.collection(write.collection).doc(write.docId).set(write.data, { merge: true });
    console.log(`  📄 Firestore: ${write.collection}/${write.docId}`);
  }

  return { ...account, uid: userRecord.uid };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(60));
  console.log(' GIGTO – Seed Test Accounts');
  console.log('='.repeat(60));
  console.log('⚠️  FOR DEVELOPMENT / TESTING ONLY\n');

  const results = [];
  for (const account of TEST_ACCOUNTS) {
    const result = await seedAccount(account);
    results.push(result);
  }

  // Print summary table
  console.log('\n' + '='.repeat(60));
  console.log(' ✅ ALL TEST ACCOUNTS CREATED');
  console.log('='.repeat(60));
  for (const r of results) {
    console.log(`\n🔑 [${r.role.toUpperCase()}]`);
    for (const line of r.loginInstructions) {
      console.log(`   ${line}`);
    }
  }
  console.log('\n' + '='.repeat(60));
  console.log(' See TEST_ACCOUNTS.md for the full credential table.');
  console.log('='.repeat(60) + '\n');
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
