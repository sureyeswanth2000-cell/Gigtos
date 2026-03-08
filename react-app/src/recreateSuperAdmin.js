/**
 * RECREATE SUPERADMIN ACCOUNT IN FIRESTORE
 * Run this script after signing in to restore your superadmin document
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
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

async function recreateSuperAdmin() {
  console.log('🔐 SUPERADMIN ACCOUNT RECREATION TOOL');
  console.log('=====================================\n');
  
  // IMPORTANT: Update these with your actual superadmin credentials
  const SUPERADMIN_EMAIL = 'Super@gmail.com';  // ⬅️ CHANGE THIS
  const SUPERADMIN_PASSWORD = 'admin123';         // ⬅️ CHANGE THIS
  const SUPERADMIN_NAME = 'Super Admin';               // ⬅️ CHANGE THIS (optional)
  
  if (SUPERADMIN_EMAIL === 'your-email@example.com') {
    console.error('❌ ERROR: Please edit this script and update SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD');
    console.error('   Open: react-app/src/recreateSuperAdmin.js');
    console.error('   Update lines 23-25 with your actual credentials');
    process.exit(1);
  }
  
  try {
    console.log('📧 Email:', SUPERADMIN_EMAIL);
    console.log('🔄 Signing in...');
    
    // Sign in with existing Auth credentials
    const userCred = await signInWithEmailAndPassword(auth, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    const uid = userCred.user.uid;
    
    console.log('✅ Sign-in successful!');
    console.log('👤 UID:', uid);
    console.log('📝 Creating Firestore document...\n');
    
    // Recreate superadmin document in Firestore
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
    
    console.log('✅ SUCCESS! Superadmin account recreated in Firestore');
    console.log('📊 Account Details:');
    console.log('   - Email:', SUPERADMIN_EMAIL);
    console.log('   - UID:', uid);
    console.log('   - Role: superadmin');
    console.log('   - Status: active');
    console.log('\n🚀 You can now login to the admin panel!');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nPossible reasons:');
    console.error('1. Incorrect email or password');
    console.error('2. Firebase Auth account doesn\'t exist');
    console.error('3. Network/Firebase connection issue');
    console.error('\nIf your Auth account was also deleted, you\'ll need to:');
    console.error('1. Create a new account using the Auth page');
    console.error('2. Then run this script with the new credentials');
    process.exit(1);
  }
}

// Run the recreation
recreateSuperAdmin();
