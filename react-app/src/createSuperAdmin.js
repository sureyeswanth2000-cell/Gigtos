/**
 * CREATE NEW SUPERADMIN ACCOUNT
 * This creates both Firebase Auth account and Firestore document
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
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

async function createSuperAdmin() {
  console.log('🚀 CREATING NEW SUPERADMIN ACCOUNT');
  console.log('===================================\n');
  
  // Update these with your desired credentials
  const SUPERADMIN_EMAIL = 'Super@admin.com';
  const SUPERADMIN_PASSWORD = 'admin123';  // Must be at least 6 characters
  const SUPERADMIN_NAME = 'Super Admin';
  
  try {
    console.log('📧 Email:', SUPERADMIN_EMAIL);
    console.log('🔐 Password:', '*'.repeat(SUPERADMIN_PASSWORD.length));
    console.log('📝 Creating Firebase Auth account...');
    
    // Create Firebase Auth account
    const userCred = await createUserWithEmailAndPassword(auth, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    const uid = userCred.user.uid;
    
    console.log('✅ Auth account created!');
    console.log('👤 UID:', uid);
    console.log('📝 Creating Firestore document...\n');
    
    // Create superadmin document in Firestore
    await setDoc(doc(db, 'admins', uid), {
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
    
    console.log('✅ SUCCESS! Superadmin account created successfully');
    console.log('📊 Account Details:');
    console.log('   - Email:', SUPERADMIN_EMAIL);
    console.log('   - Password:', SUPERADMIN_PASSWORD);
    console.log('   - UID:', uid);
    console.log('   - Role: superadmin');
    console.log('   - Status: active');
    console.log('\n🚀 You can now login at: http://localhost:3000/auth?mode=admin');
    console.log('   Use the credentials above to sign in.');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    
    if (error.code === 'auth/email-already-in-use') {
      console.error('\n💡 This email is already registered!');
      console.error('   The Auth account exists but Firestore document might be missing.');
      console.error('   Run the recreateSuperAdmin.js script instead with correct password.');
    } else if (error.code === 'auth/weak-password') {
      console.error('\n💡 Password must be at least 6 characters long.');
    } else {
      console.error('\nPossible reasons:');
      console.error('1. Network/Firebase connection issue');
      console.error('2. Invalid email format');
      console.error('3. Firebase project configuration issue');
    }
    
    process.exit(1);
  }
}

// Run the creation
createSuperAdmin();
