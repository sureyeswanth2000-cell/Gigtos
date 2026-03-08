import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

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

async function createTestUser() {
  const phone = '1234567899';
  const email = 'testuser1234567899@gigto.com';
  const password = '101012';
  
  console.log('🔧 Creating test user...');
  console.log('📱 Phone:', phone);
  console.log('📧 Email:', email);
  console.log('🔑 Password:', password);
  
  try {
    let uid;
    
    // Try to sign in first (in case account exists)
    try {
      console.log('\n1️⃣ Trying to sign in with existing account...');
      const signInResult = await signInWithEmailAndPassword(auth, email, password);
      uid = signInResult.user.uid;
      console.log('✅ Account exists! UID:', uid);
    } catch (signInError) {
      console.log('⚠️ Account does not exist, creating new one...');
      
      // Create new account
      const createResult = await createUserWithEmailAndPassword(auth, email, password);
      uid = createResult.user.uid;
      console.log('✅ Firebase Auth account created! UID:', uid);
    }
    
    // Create/Update Firestore documents
    console.log('\n2️⃣ Creating Firestore documents...');
    
    // Create users_by_phone document
    await setDoc(doc(db, 'users_by_phone', phone), {
      uid: uid,
      email: email,
      phone: phone,
      createdAt: new Date()
    });
    console.log('✅ users_by_phone document created');
    
    // Create users document
    await setDoc(doc(db, 'users', uid), {
      phone: phone,
      email: email,
      name: 'Test User',
      address: 'Test Address, Test City',
      createdAt: new Date()
    });
    console.log('✅ users document created');
    
    console.log('\n✅ Test user setup complete!');
    console.log('\n🔐 Login credentials:');
    console.log('   Phone: ' + phone);
    console.log('   Password: ' + password);
    console.log('\n📱 You can now login with these credentials in the app');
    console.log('   UID: ' + uid);
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

createTestUser();
