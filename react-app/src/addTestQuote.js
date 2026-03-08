import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';

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

async function addTestQuote() {
  const superadminEmail = 'Superadmin@gmail.com';
  const superadminPassword = 'admin123';
  const bookingId = '3Eb2GnSSTi0nC7FDATmE';
  
  console.log('🔧 Adding test quotes to booking...');
  console.log('📄 Booking ID:', bookingId);
  
  try {
    // Authenticate as superadmin to have permissions
    console.log('\n1️⃣ Authenticating as superadmin...');
    const userCred = await signInWithEmailAndPassword(auth, superadminEmail, superadminPassword);
    const adminId = userCred.user.uid;
    console.log('✅ Authenticated! Admin UID:', adminId);
    
    // Get admin info
    const adminDoc = await getDoc(doc(db, 'admins', adminId));
    const adminName = adminDoc.exists() ? (adminDoc.data().name || 'SuperAdmin') : 'SuperAdmin';
    console.log('👤 Admin name:', adminName);
    
    // Add multiple test quotes
    console.log('\n2️⃣ Adding test quotes...');
    
    const quote1 = {
      adminId: adminId,
      adminName: adminName,
      price: 1500,
      createdAt: new Date()
    };
    
    const quote2 = {
      adminId: 'mason1_fake_id',
      adminName: 'Mason Ravi',
      price: 1200,
      createdAt: new Date()
    };
    
    const quote3 = {
      adminId: 'mason2_fake_id',
      adminName: 'Mason Kumar',
      price: 1800,
      createdAt: new Date()
    };
    
    const bookingRef = doc(db, 'bookings', bookingId);
    await updateDoc(bookingRef, {
      quotes: [quote1, quote2, quote3],
      updatedAt: new Date()
    });
    
    console.log('✅ Test quotes added successfully!');
    console.log('\n📋 Quotes added:');
    console.log('   1. ' + adminName + ' - ₹1500');
    console.log('   2. Mason Ravi - ₹1200');
    console.log('   3. Mason Kumar - ₹1800');
    console.log('\n✨ User can now see these quotes in MyBookings tab!');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

addTestQuote();
