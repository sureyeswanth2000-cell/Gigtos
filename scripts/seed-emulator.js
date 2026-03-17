/**
 * GIGTO – Seed Firebase Emulator with Test Accounts
 * ============================================================
 * This script seeds ALL five role test accounts into the local
 * Firebase Emulator Suite. NO service-account key is required.
 *
 * PREREQUISITES
 * -------------
 *   1. Install Firebase CLI globally (once):
 *        npm install -g firebase-tools
 *
 *   2. Install root-level devDependencies (once, from repo root):
 *        npm install
 *
 * USAGE (run from the repo root)
 * -----
 *   Terminal 1 – start the emulators:
 *        npm run emulator
 *        # or: firebase emulators:start
 *
 *   Terminal 2 – seed the test accounts:
 *        npm run seed:emulator
 *
 *   Terminal 3 – start the React app connected to the emulators:
 *        cd react-app && npm run start:emulator
 *        # or from root: npm run dev  (starts all three together)
 *
 * TEST CREDENTIALS (after running this script)
 * ─────────────────────────────────────────────
 *   USER          Phone 9999900001  /  password  TestUser@123
 *   MASON         Email testmason@gigto.dev  /  TestMason@123
 *   REGION LEAD   Email testregionlead@gigto.dev  /  TestRegLead@123
 *   SUPER ADMIN   Email testsuperadmin@gigto.dev  /  TestSuperAdmin@123
 *   WORKER        Phone 9999900005  /  password  TestWorker@123
 *
 * The script is IDEMPOTENT – safe to re-run; it deletes and re-creates
 * all test accounts to guarantee a clean state.
 *
 * ⚠️  FOR DEVELOPMENT / LOCAL TESTING ONLY.
 * ============================================================
 */

'use strict';

// Point firebase-admin at the local emulators BEFORE requiring the SDK.
// The emulators accept ANY project ID without real credentials.
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'gigto-c0c83' });

const auth = admin.auth();
const db   = admin.firestore();

// ---------------------------------------------------------------------------
// Shared Firestore timestamp helper (works with emulator too)
// ---------------------------------------------------------------------------
const now = () => admin.firestore.FieldValue.serverTimestamp();

// ---------------------------------------------------------------------------
// Test account definitions – one per role
// ---------------------------------------------------------------------------
const ACCOUNTS = [
  // ── 1. USER ──────────────────────────────────────────────────────────────
  {
    label      : 'USER',
    email      : 'testuser@gigto.dev',
    password   : 'TestUser@123',
    displayName: 'Test User',
    phone      : '9999900001',
    loginInfo  : 'Auth screen → "Book Services as a User" | Phone: 9999900001 | Password: TestUser@123',
    dashboard  : '/',
    writes: (uid) => [
      {
        col: 'users', id: uid,
        data: { phone: '9999900001', email: 'testuser@gigto.dev', name: 'Test User', address: '123 Test Street, Test City', createdAt: now() },
      },
      {
        col: 'users_by_phone', id: '9999900001',
        data: { email: 'testuser@gigto.dev' },
      },
    ],
  },

  // ── 2. MASON ─────────────────────────────────────────────────────────────
  {
    label      : 'MASON',
    email      : 'testmason@gigto.dev',
    password   : 'TestMason@123',
    displayName: 'Test Mason',
    loginInfo  : 'Auth screen → "Manage Services as Admin" | Email: testmason@gigto.dev | Password: TestMason@123',
    dashboard  : '/admin/bookings',
    writes: (uid) => [
      {
        col: 'admins', id: uid,
        data: { uid, email: 'testmason@gigto.dev', name: 'Test Mason', role: 'mason', areaName: 'Test Area', status: 'active', createdAt: now() },
      },
    ],
  },

  // ── 3. REGION LEAD ───────────────────────────────────────────────────────
  {
    label      : 'REGION LEAD',
    email      : 'testregionlead@gigto.dev',
    password   : 'TestRegLead@123',
    displayName: 'Test Region Lead',
    loginInfo  : 'Auth screen → "Manage Services as Admin" | Email: testregionlead@gigto.dev | Password: TestRegLead@123',
    dashboard  : '/admin/region-lead',
    writes: (uid) => [
      {
        col: 'admins', id: uid,
        data: { uid, email: 'testregionlead@gigto.dev', name: 'Test Region Lead', role: 'regionLead', areaName: 'Test Region', status: 'active', createdAt: now() },
      },
    ],
  },

  // ── 4. SUPER ADMIN ───────────────────────────────────────────────────────
  {
    label      : 'SUPER ADMIN',
    email      : 'testsuperadmin@gigto.dev',
    password   : 'TestSuperAdmin@123',
    displayName: 'Test Super Admin',
    loginInfo  : 'Auth screen → "Manage Services as Admin" | Email: testsuperadmin@gigto.dev | Password: TestSuperAdmin@123',
    dashboard  : '/admin/super',
    writes: (uid) => [
      {
        col: 'admins', id: uid,
        data: { uid, email: 'testsuperadmin@gigto.dev', name: 'Test Super Admin', role: 'superadmin', status: 'active', createdAt: now() },
      },
    ],
  },

  // ── 5. WORKER ────────────────────────────────────────────────────────────
  {
    label      : 'WORKER',
    email      : 'testworker@gigto.dev',
    password   : 'TestWorker@123',
    displayName: 'Test Worker',
    phone      : '9999900005',
    loginInfo  : 'Auth screen → "Register as Worker" → "Login (Phone + Password)" | Phone: 9999900005 | Password: TestWorker@123',
    dashboard  : '/worker/dashboard',
    writes: (uid) => [
      {
        col: 'gig_workers', id: uid,
        data: {
          name: 'Test Worker', contact: '9999900005', email: 'testworker@gigto.dev',
          gigType: 'plumber', area: 'Test Area', certifications: '', bankDetails: '',
          totalEarnings: 0, adminId: '', approvalStatus: 'approved', status: 'active',
          completedJobs: 0, rating: 0, isTopListed: false, isFraud: false, createdAt: now(),
        },
      },
      {
        col: 'workers_by_phone', id: '9999900005',
        data: {
          phone: '9999900005', email: 'testworker@gigto.dev', uid,
          name: 'Test Worker', gigType: 'plumber', area: 'Test Area',
          certifications: '', bankDetails: '', totalEarnings: 0,
          approvalStatus: 'approved', status: 'active', activatedAt: now(), createdAt: now(),
        },
      },
      {
        col: 'worker_auth', id: uid,
        data: {
          uid, phone: '9999900005', email: 'testworker@gigto.dev', name: 'Test Worker',
          gigType: 'plumber', area: 'Test Area', certifications: '', bankDetails: '',
          totalEarnings: 0, adminId: '', approvalStatus: 'approved', status: 'active',
          activatedAt: now(), createdAt: now(),
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function deleteIfExists(email) {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.deleteUser(user.uid);
    console.log(`  🗑  Deleted old account: ${email}`);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
  }
}

async function seedAccount(account) {
  console.log(`\n📋 Seeding [${account.label}] – ${account.email}`);

  await deleteIfExists(account.email);

  const record = await auth.createUser({
    email        : account.email,
    password     : account.password,
    displayName  : account.displayName,
    emailVerified: true,
  });
  console.log(`  ✅ Auth user created | uid: ${record.uid}`);

  for (const w of account.writes(record.uid)) {
    await db.collection(w.col).doc(w.id).set(w.data, { merge: true });
    console.log(`  📄 Firestore: ${w.col}/${w.id}`);
  }

  return { ...account, uid: record.uid };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n' + '='.repeat(62));
  console.log(' GIGTO – Seed Emulator Test Accounts');
  console.log('='.repeat(62));
  console.log(' ⚠️  Emulator only – no cloud data is modified\n');

  const results = [];
  for (const account of ACCOUNTS) {
    results.push(await seedAccount(account));
  }

  console.log('\n' + '='.repeat(62));
  console.log(' ✅ ALL TEST ACCOUNTS SEEDED');
  console.log('='.repeat(62));
  for (const r of results) {
    console.log(`\n  🔑 [${r.label}]`);
    console.log(`     ${r.loginInfo}`);
    console.log(`     Dashboard → ${r.dashboard}`);
  }
  console.log('\n' + '='.repeat(62));
  console.log(' Open http://localhost:3000/Gigtos/auth to log in.');
  console.log(' Emulator UI: http://localhost:4000');
  console.log('='.repeat(62) + '\n');
}

main().catch((err) => {
  if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
    console.error('\n❌ Could not connect to the Firebase Emulators.');
    console.error('   Make sure the emulators are running first:');
    console.error('   $ firebase emulators:start\n');
  } else {
    console.error('\n❌ Seed failed:', err.message || err);
  }
  process.exit(1);
});
