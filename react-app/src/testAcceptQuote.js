import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

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

async function testAcceptQuote() {
  const userEmail = 'testuser1234567899@gigto.com';
  const userPassword = '101012';
  const bookingId = '3Eb2GnSSTi0nC7FDATmE';
  
  console.log('🧪 Simulating user accepting a quote...');
  console.log('📄 Booking ID:', bookingId);
  
  try {
    // Authenticate as user
    console.log('\n1️⃣ Authenticating as user...');
    const userCred = await signInWithEmailAndPassword(auth, userEmail, userPassword);
    const userId = userCred.user.uid;
    console.log('✅ Authenticated! User UID:', userId);
    
    // Get booking and quotes
    console.log('\n2️⃣ Fetching booking and quotes...');
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingRef);
    
    if (!bookingSnap.exists()) {
      throw new Error('Booking not found');
    }
    
    const booking = bookingSnap.data();
    console.log('📋 Current status:', booking.status);
    console.log('💰 Available quotes:', booking.quotes?.length || 0);
    
    if (!booking.quotes || booking.quotes.length === 0) {
      throw new Error('No quotes available to accept');
    }
    
    // Accept the second quote (Mason Ravi - ₹1200)
    const selectedQuote = booking.quotes[1]; // Index 1 = Mason Ravi
    console.log('\n3️⃣ Accepting quote from:', selectedQuote.adminName);
    console.log('   Price: ₹' + selectedQuote.price);
    console.log('   Admin ID:', selectedQuote.adminId);
    
    await updateDoc(bookingRef, {
      status: 'accepted',
      adminId: selectedQuote.adminId,
      acceptedQuote: selectedQuote,
      updatedAt: new Date()
    });
    
    console.log('\n✅ Quote accepted successfully!');
    console.log('\n📊 Expected behavior:');
    console.log('   ✓ Status changed to: accepted');
    console.log('   ✓ AdminId set to:', selectedQuote.adminId);
    console.log('   ✓ Other masons can NO LONGER see this booking');
    console.log('   ✓ Winning mason (' + selectedQuote.adminName + ') can now assign a gig');
    console.log('\n🔄 Refresh the admin bookings page to see the changes!');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testAcceptQuote();
