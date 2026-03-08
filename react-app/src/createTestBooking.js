import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDMJvNKvgwfEvymuLaXhGQwJr-Id4yExYU",
  authDomain: "gigto-c0c83.firebaseapp.com",
  projectId: "gigto-c0c83",
  storageBucket: "gigto-c0c83.firebasestorage.app",
  messagingSenderId: "190454381677",
  appId: "1:190454381677:web:458b1638c984ababcdd364",
  measurementId: "G-3WQKM1M1F9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createTestBooking() {
  const email = 'testuser1234567899@gigto.com';
  const password = '101012';
  const phone = '1234567899';
  
  console.log('🔧 Creating test booking...');
  console.log('📧 Email:', email);
  console.log('📱 Phone:', phone);
  
  try {
    // Authenticate first
    console.log('\n1️⃣ Authenticating as test user...');
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const userId = userCred.user.uid;
    console.log('✅ Authenticated! UID:', userId);
    
    // Create booking
    console.log('\n2️⃣ Creating booking...');
    const bookingData = {
      userId: userId,
      customerName: 'Test User',
      phone: phone,
      email: email,
      serviceType: 'Plumber',
      address: '123 Test Street, Test City, Test State 12345',
      description: 'Test booking - Need to fix leaking pipe in kitchen',
      preferredDate: new Date(),
      preferredTime: '10:00 AM',
      status: 'pending',
      quotes: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await addDoc(collection(db, 'bookings'), bookingData);
    console.log('✅ Test booking created successfully!');
    console.log('📄 Booking ID:', docRef.id);
    console.log('\n📋 Booking details:');
    console.log('   Service: Plumber');
    console.log('   Status: pending');
    console.log('   Address:', bookingData.address);
    console.log('\n✨ You can now see this booking in MyBookings tab!');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

createTestBooking();
