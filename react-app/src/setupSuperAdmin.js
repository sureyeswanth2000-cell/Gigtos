/**
 * SMART SUPERADMIN SETUP
 * Tries to sign in first, if that fails, creates a new account
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

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

async function setupSuperAdmin() {
  console.log('🚀 SMART SUPERADMIN SETUP');
  console.log('=========================\n');
  
  // Update these with your desired credentials
  const SUPERADMIN_EMAIL = 'Superadmin@gmail.com';
  const SUPERADMIN_PASSWORD = 'admin123';
  const SUPERADMIN_NAME = 'Super Admin';
  
  let uid;
  let isNewAccount = false;
  
  console.log('📧 Email:', SUPERADMIN_EMAIL);
  console.log('🔐 Password:', '*'.repeat(SUPERADMIN_PASSWORD.length));
  
  try {
    // Step 1: Try to sign in with existing Auth account
    console.log('\n🔄 Attempting to sign in with existing account...');
    const userCred = await signInWithEmailAndPassword(auth, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    uid = userCred.user.uid;
    console.log('✅ Signed in successfully!');
    console.log('👤 UID:', uid);
  } catch (signInError) {
    if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') {
      // Step 2: Auth account doesn't exist, create it
      console.log('⚠️  Account not found, creating new Auth account...');
      try {
        const userCred = await createUserWithEmailAndPassword(auth, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
        uid = userCred.user.uid;
        isNewAccount = true;
        console.log('✅ New Auth account created!');
        console.log('👤 UID:', uid);
      } catch (createError) {
        console.error('\n❌ Failed to create Auth account:', createError.message);
        process.exit(1);
      }
    } else {
      console.error('\n❌ Sign-in error:', signInError.message);
      process.exit(1);
    }
  }
  
  // Step 3: Check if Firestore document exists
  console.log('\n📝 Checking Firestore document...');
  const adminDocRef = doc(db, 'admins', uid);
  const adminDoc = await getDoc(adminDocRef);
  
  if (adminDoc.exists()) {
    console.log('✅ Firestore document already exists!');
    console.log('📊 Current data:', adminDoc.data());
    console.log('\n✨ Setup complete! Your account is ready.');
    console.log('🔐 Login credentials:');
    console.log('   Email:', SUPERADMIN_EMAIL);
    console.log('   Password:', SUPERADMIN_PASSWORD);
    console.log('\n🚀 Go to: http://localhost:3000/auth?mode=admin');
    process.exit(0);
  }
  
  // Step 4: Create Firestore document
  console.log('📝 Creating Firestore superadmin document...');
  await setDoc(adminDocRef, {
    email: SUPERADMIN_EMAIL,
    name: SUPERADMIN_NAME,
    role: 'superadmin',
    regionStatus: 'active',
    probationStatus: false,
    regionScore: 100,
    totalDisputes: 0,
    fraudCount: 0,
    avgResolutionTime: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  console.log('✅ Firestore document created successfully!');
  console.log('\n✨ SETUP COMPLETE!');
  console.log('📊 Account Details:');
  console.log('   - Email:', SUPERADMIN_EMAIL);
  console.log('   - Password:', SUPERADMIN_PASSWORD);
  console.log('   - UID:', uid);
  console.log('   - Role: superadmin');
  console.log('   - Status: active');
  console.log('   - New Account:', isNewAccount ? 'Yes' : 'No');
  console.log('\n🚀 Login at: http://localhost:3000/auth?mode=admin');
  console.log('   Use the credentials above to sign in.');
  
  process.exit(0);
}

// Run setup
setupSuperAdmin().catch(error => {
  console.error('\n❌ FATAL ERROR:', error);
  process.exit(1);
});
