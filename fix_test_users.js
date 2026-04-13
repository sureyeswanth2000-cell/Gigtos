const admin = require('firebase-admin');

// Initialize with local emulator or service account if available
// For the purpose of this script, we assume a local environment with GOOGLE_APPLICATION_CREDENTIALS or emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({
  projectId: 'sureyeswanth2000-cell'
});

const db = admin.firestore();
const auth = admin.auth();

async function fixUser(phone, email, password, name, role = 'user') {
  console.log(`Checking user: ${phone}...`);
  try {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch {
      console.log(`Creating Auth user for ${email}...`);
      userRecord = await auth.createUser({
        email,
        password,
        phoneNumber: phone.startsWith('+') ? phone : `+91${phone}`,
        displayName: name
      });
    }

    const uid = userRecord.uid;

    if (role === 'user') {
      console.log(`Updating users_by_phone for ${phone}...`);
      await db.collection('users_by_phone').doc(phone).set({
        phone,
        email,
        uid,
        name,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ User ${phone} ready.`);
    } else if (role === 'worker') {
      console.log(`Updating worker mapping for ${phone}...`);
      await db.collection('workers_by_phone').doc(phone).set({
        phone,
        email,
        uid,
        name,
        approvalStatus: 'approved',
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      await db.collection('worker_auth').doc(uid).set({
        uid, phone, email, name, status: 'active', approvalStatus: 'approved'
      });
      console.log(`✅ Worker ${phone} ready.`);
    }
  } catch (e) {
    console.error(`Error fixing ${phone}:`, e.message);
  }
}

async function run() {
  // Fix the test user that failed
  await fixUser('1234567895', '1234567895@gigtos.test', '101010', 'Test User');
  
  // Ensure the worker is also fully set up
  await fixUser('1234567891', 'worker1@gigtos.test', '101010', 'Gig6', 'worker');

  console.log('Done.');
  process.exit(0);
}

run();
