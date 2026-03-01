/**
 * Gigto – create test accounts in Firebase production
 * Run:  node seed_test_accounts.js
 * Requires: firebase-admin + service account env var, OR you can use Firebase Console directly.
 *
 * This script creates:
 *  1. Test User:  testuser@gigto.com / Test@123  (phone: 9999999999)
 *  2. Test Admin: testadmin@gigto.com / Admin@123 (role: admin, status: active)
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

// Use application default credentials (run: gcloud auth application-default login)
// OR set GOOGLE_APPLICATION_CREDENTIALS env variable to your service account JSON.
initializeApp({ credential: require('firebase-admin').credential.applicationDefault() });

const auth = getAuth();
const db = getFirestore();

async function createTestUser() {
    const phone = '9999999999';
    const email = 'testuser@gigto.com';
    const pass = 'Test@123';

    let uid;
    try {
        const existing = await auth.getUserByEmail(email);
        uid = existing.uid;
        console.log('✅ Test user already exists:', uid);
    } catch {
        const cred = await auth.createUser({ email, password: pass });
        uid = cred.uid;
        console.log('✅ Created test user:', uid);
    }

    // users_by_phone document
    await db.doc(`users_by_phone/${phone}`).set({
        uid, email, password: pass, phone, createdAt: new Date()
    }, { merge: true });

    // users document
    await db.doc(`users/${uid}`).set({
        phone, email, name: 'Test User', address: 'Plot 12, Kavali, AP 524201', createdAt: new Date()
    }, { merge: true });

    console.log('✅ Test user Firestore records set.');
    return uid;
}

async function createTestAdmin() {
    const email = 'testadmin@gigto.com';
    const pass = 'Admin@123';

    let uid;
    try {
        const existing = await auth.getUserByEmail(email);
        uid = existing.uid;
        console.log('✅ Test admin already exists:', uid);
    } catch {
        const cred = await auth.createUser({ email, password: pass });
        uid = cred.uid;
        console.log('✅ Created test admin:', uid);
    }

    await db.doc(`admins/${uid}`).set({
        email, role: 'admin', status: 'active', createdAt: new Date()
    }, { merge: true });

    console.log('✅ Test admin Firestore record set.');
    return uid;
}

(async () => {
    try {
        await createTestUser();
        await createTestAdmin();
        console.log('\n🎉 Done! Test credentials:');
        console.log('  User:  Phone 9999999999 / OTP 101010  (or email testuser@gigto.com / Test@123)');
        console.log('  Admin: testadmin@gigto.com / Admin@123');
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
    process.exit(0);
})();
