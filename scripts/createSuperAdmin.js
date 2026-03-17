/**
 * createSuperAdmin.js
 *
 * One-time setup script to bootstrap the first Super Admin in Firebase.
 *
 * Prerequisites:
 *   1. Download your Firebase service account key from:
 *      Firebase Console → Project Settings → Service accounts → Generate new private key
 *      Save it as "serviceAccountKey.json" in this project root (never commit this file).
 *
 *   2. Install dependencies from the project root (already included):
 *      npm install
 *
 * Usage:
 *   node scripts/createSuperAdmin.js \
 *     --serviceAccount=./serviceAccountKey.json \
 *     --email=superadmin@example.com \
 *     --password=YourStrongPassword123 \
 *     --name="Super Admin"
 *
 * What this script does:
 *   1. Creates a Firebase Authentication user with the given email and password.
 *   2. Writes a document to the `admins` Firestore collection with:
 *        {
 *          name:          <provided name>,
 *          email:         <provided email>,
 *          role:          "superadmin",
 *          regionStatus:  "active",
 *          createdAt:     <server timestamp>
 *        }
 *      The document ID is the user's Firebase UID, which is how the app
 *      identifies admins (Auth.js looks up admins/<uid>).
 */

'use strict';

const admin = require('firebase-admin');
const path  = require('path');

// ── Parse command-line arguments ────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (const arg of argv.slice(2)) {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    args[key] = rest.join('=');
  }
  return args;
}

const args = parseArgs(process.argv);

const serviceAccountPath = args.serviceAccount || './serviceAccountKey.json';
const email              = args.email;
const password           = args.password;
const name               = args.name || 'Super Admin';

// ── Validate required arguments ──────────────────────────────────────────────
if (!email || !password) {
  console.error('\n❌  Missing required arguments.\n');
  console.error('Usage:');
  console.error(
    '  node scripts/createSuperAdmin.js \\\n' +
    '    --serviceAccount=./serviceAccountKey.json \\\n' +
    '    --email=superadmin@example.com \\\n' +
    '    --password=YourStrongPassword \\\n' +
    '    --name="Super Admin"\n'
  );
  process.exit(1);
}

if (password.length < 6) {
  console.error('❌  Password must be at least 6 characters.');
  process.exit(1);
}

// ── Initialise Firebase Admin SDK ────────────────────────────────────────────
const serviceAccountFullPath = path.resolve(serviceAccountPath);
let serviceAccount;

try {
  serviceAccount = require(serviceAccountFullPath);
} catch (err) {
  console.error(`\n❌  Could not load service account key from: ${serviceAccountFullPath}`);
  console.error('    Download it from:');
  console.error('    Firebase Console → Project Settings → Service accounts → Generate new private key\n');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ── Main ─────────────────────────────────────────────────────────────────────
async function createSuperAdmin() {
  console.log('\n🚀  Creating Super Admin...\n');

  // Step 1: Create Firebase Auth user
  let userRecord;
  try {
    userRecord = await admin.auth().createUser({ email, password, displayName: name });
    console.log(`✅  Firebase Auth user created:  ${userRecord.uid}`);
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      // User already exists — fetch UID and proceed to ensure the Firestore doc is correct
      userRecord = await admin.auth().getUserByEmail(email);
      console.log(`ℹ️   Firebase Auth user already exists: ${userRecord.uid}`);
    } else {
      throw err;
    }
  }

  const uid = userRecord.uid;

  // Step 2: Write (or overwrite) the admins/<uid> document
  const adminDocRef = db.collection('admins').doc(uid);
  const existing    = await adminDocRef.get();

  if (existing.exists) {
    const currentRole = existing.data().role;
    if (currentRole === 'superadmin') {
      console.log('ℹ️   Admin document already exists with role "superadmin". Nothing to change.\n');
    } else {
      await adminDocRef.update({
        name,
        email,
        role:         'superadmin',
        regionStatus: 'active',
        createdAt:    admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`✅  Existing admin document updated to role "superadmin" (was "${currentRole}").`);
    }
  } else {
    await adminDocRef.set({
      name,
      email,
      role:         'superadmin',
      regionStatus: 'active',
      createdAt:    admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('✅  Firestore admins document created with role "superadmin".');
  }

  console.log('\n🎉  Super Admin setup complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Email : ${email}`);
  console.log(`   UID   : ${uid}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nYou can now log in at /auth (Admin tab) using the email and password above.');
  console.log('The app will detect role "superadmin" and redirect you to /admin/super.\n');
}

createSuperAdmin().catch(err => {
  console.error('\n❌  Error:', err.message || err);
  process.exit(1);
});
