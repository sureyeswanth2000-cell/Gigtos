// seed_emulator.js
// Usage: Requires Firebase Emulator running on localhost:8080 (Firestore) and localhost:9099 (Auth)
// Then run: node seed_emulator.js

const admin = require('firebase-admin');

// Set emulator environment variables for this process
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'http://localhost:9099';

// Initialize admin SDK for emulator (projectId must match firebase.json)
admin.initializeApp({ projectId: 'gigto-c0c83' });

const firestore = admin.firestore();
const auth = admin.auth();

async function run(){
  try{
    console.log('Seeding emulator data...');

    // Create admin user
    const adminUser = await auth.createUser({
      email: 'admin@example.com',
      emailVerified: false,
      password: 'password',
      displayName: 'Admin User'
    });
    console.log('Created admin user:', adminUser.uid);

    // Create normal user
    const user = await auth.createUser({
      email: 'user@example.com',
      emailVerified: false,
      password: 'password',
      displayName: 'Test User'
    });
    console.log('Created normal user:', user.uid);

    // Create admins doc
    await firestore.doc('admins/' + adminUser.uid).set({ role: 'admin', status: 'active', email: adminUser.email });
    console.log('Admin doc created');

    // Create user profile
    await firestore.doc('users/' + user.uid).set({ name: 'Test User', phone: '+911234567890', address: 'Test Address', createdAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log('User doc created');

    // Create a worker owned by admin
    const workerRef = await firestore.collection('gig_workers').add({
      name: 'Ramesh', contact: '9876543210', gigType: 'Plumber', status: 'active', adminId: adminUser.uid, createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Worker created:', workerRef.id);

    // Create a booking by user
    const bookingRef = await firestore.collection('bookings').add({
      userId: user.uid,
      serviceType: 'Plumber',
      customerName: 'Test User',
      address: 'Test Address',
      phone: '+911234567890',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Booking created:', bookingRef.id);

    console.log('Seeding complete.');

  }catch(e){
    console.error('Seeding error:', e);
  }
}

run();
