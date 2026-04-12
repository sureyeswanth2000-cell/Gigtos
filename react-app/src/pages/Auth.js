import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getAdminRedirectPath, isRegionSuspended } from '../utils/authRouting';
import { detectCurrentLocation } from '../context/LocationContext';
import { SPECIAL_JOBS } from '../config/specialJobs';

// Build signup job type options from SPECIAL_JOBS config for consistency
const SIGNUP_JOB_TYPES = [
  ...SPECIAL_JOBS.map(sj => sj.id),
  'carpentry', 'masonry', 'landscaping', 'other'
].filter((v, i, a) => a.indexOf(v) === i);

function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [userType, setUserType] = useState(searchParams.get('mode') || 'user'); // 'user', 'admin', or 'worker'
  const [phase, setPhase] = useState('login'); // Default to login
  
  // Unified Login Field
  const [identifier, setIdentifier] = useState('');
  
  // User (Phone) Fields
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  
  // Common Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Worker Registration Fields
  const [workerName, setWorkerName] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [workerEmail, setWorkerEmail] = useState('');
  const [workerPassword, setWorkerPassword] = useState('');
  const [workerConfirmPassword, setWorkerConfirmPassword] = useState('');
  const [workerGigTypes, setWorkerGigTypes] = useState([]);
  const [workerArea, setWorkerArea] = useState('');
  
  // UI States
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const resetAllFields = () => {
    setIdentifier('');
    setError('');
    setOtp('');
    setPassword('');
    setConfirmPassword('');
    setPhone('');
    setEmail('');
    setWorkerName('');
    setWorkerPhone('');
    setWorkerEmail('');
    setWorkerPassword('');
    setWorkerConfirmPassword('');
    setWorkerGigTypes([]);
    setWorkerArea('');
  };

  // ============= UNIFIED LOGIN (EMAIL/PHONE + PASSWORD) =============
  const handleUnifiedLogin = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Please enter email/phone and password');
      return;
    }

    setError('');
    setLoading(true);

    try {
      let emailToUse = identifier;
      const isPhone = /^\d+$/.test(identifier.replace(/[^\d]/g, ''));

      if (isPhone) {
        // Find email by phone lookup
        const cleanPhone = identifier.replace(/[^\d]/g, '').slice(-10);
        
        // Search in workers_by_phone
        const workerPhoneDoc = await getDoc(doc(db, 'workers_by_phone', cleanPhone));
        if (workerPhoneDoc.exists()) {
          emailToUse = workerPhoneDoc.data().email;
        } else {
          // Search in users_by_phone
          const userPhoneDoc = await getDoc(doc(db, 'users_by_phone', cleanPhone));
          if (userPhoneDoc.exists()) {
            emailToUse = userPhoneDoc.data().email;
          } else {
            throw new Error('Phone number not found. If you are a new user, please sign up.');
          }
        }
      }

      // Authenticate with Firebase
      const userCred = await signInWithEmailAndPassword(auth, emailToUse, password);
      const uid = userCred.user.uid;

      // 1. Check if Admin (includes SuperAdmin, RegionLead, Mason)
      const adminDoc = await getDoc(doc(db, 'admins', uid));
      if (adminDoc.exists()) {
        const adminData = adminDoc.data();
        if (isRegionSuspended(adminData)) {
          await signOut(auth);
          throw new Error('Your region is currently suspended.');
        }
        navigate(getAdminRedirectPath(adminData));
        return;
      }

      // 2. Check if Worker
      const workerDoc = await getDoc(doc(db, 'worker_auth', uid));
      if (workerDoc.exists()) {
        const workerData = workerDoc.data();
        if (workerData.approvalStatus !== 'approved') {
          await signOut(auth);
          throw new Error('Your worker account is pending approval.');
        }
        navigate('/worker/dashboard');
        return;
      }

      // 3. Default to User (if user record exists)
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        navigate('/');
        return;
      }

      // Fallback
      navigate('/');
    } catch (err) {
      setError(err.message.includes('auth/invalid-credential') ? 'Invalid credentials' : err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============= USER PHONE LOGIN =============
  const handleUserPhoneLogin = async (e) => {
    e.preventDefault();
    if (!phone) {
      setError('Please enter your phone number');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const userDoc = await getDoc(doc(db, 'users_by_phone', phone));
      if (!userDoc.exists()) {
        throw new Error('Phone number not found. Please sign up first.');
      }

      const storedEmail = userDoc.data().email;

      // Use whichever field has the password (form stores it in 'otp' during login)
      const userPassword = otp || password;
      
      if (!userPassword) {
        throw new Error('Please enter your password to login');
      }
      
      await signInWithEmailAndPassword(auth, storedEmail, userPassword);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============= USER PHONE SIGNUP =============
  const handleUserPhoneSignup = async (e) => {
    e.preventDefault();
    if (!phone || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      setError('Please enter a valid phone number (10–15 digits)');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      // ✅ SECURITY FIX: Removed plaintext password storage in Firestore
      // Password is securely managed by Firebase Authentication
      await setDoc(doc(db, 'users_by_phone', phone), {
        uid: uid,
        email: email,
        // password field REMOVED - passwords are managed by Firebase Auth
        phone: phone,
        createdAt: new Date()
      });

      // Detect location once at signup and save it
      let locationData = {};
      try {
        const loc = await detectCurrentLocation();
        locationData = {
          locationLat: loc.lat,
          locationLng: loc.lng,
          locationCity: loc.city || '',
          locationSource: loc.source || 'gps',
          locationDetectedAt: new Date(),
        };
      } catch {
        // Location detection failed — user can set it later from profile
      }

      await setDoc(doc(db, 'users', uid), {
        phone: phone,
        email: email,
        name: '',
        ...locationData,
        createdAt: new Date()
      });

      navigate('/complete-profile-phone');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============= ADMIN LOGIN =============
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      const adminDoc = await getDoc(doc(db, 'admins', uid));
      
      if (!adminDoc.exists()) {
        await signOut(auth);
        throw new Error('This account is not registered as an admin. Please contact SuperAdmin.');
      }

      const adminData = adminDoc.data();
      const role = adminData?.role || 'unknown';

      if (isRegionSuspended(adminData)) {
        await signOut(auth);
        throw new Error('❌ This region has been suspended. Contact SuperAdmin.');
      }

      navigate(getAdminRedirectPath(adminData));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============= WORKER REGISTRATION =============
  const handleWorkerSignup = async (e) => {
    e.preventDefault();
    if (!workerName || !workerPhone || !workerEmail || !workerPassword || !workerConfirmPassword || workerGigTypes.length === 0 || !workerArea) {
      setError('Please fill in all fields and select at least one job type');
      return;
    }

    if (workerPhone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    if (workerPassword !== workerConfirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (workerPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Step 1: Create Firebase Auth user
      const userCred = await createUserWithEmailAndPassword(auth, workerEmail, workerPassword);
      const uid = userCred.user.uid;

      // Step 2: Find region lead for this area - assume area code is used to find region lead
      // For now, workers are created with approvalStatus: 'pending'
      // In a real scenario, you'd match area to region lead

      // Detect location once at signup and save it
      let locationData = {};
      try {
        const loc = await detectCurrentLocation();
        locationData = {
          locationLat: loc.lat,
          locationLng: loc.lng,
          locationCity: loc.city || '',
          locationSource: loc.source || 'gps',
          locationDetectedAt: new Date(),
        };
      } catch {
        // Location detection failed — worker can set it later
      }

      // Step 3: Create worker document
      await setDoc(doc(db, 'gig_workers', uid), {
        name: workerName,
        contact: workerPhone,
        email: workerEmail,
        gigType: workerGigTypes[0],
        gigTypes: workerGigTypes,
        area: workerArea,
        certifications: '',
        bankDetails: '',
        totalEarnings: 0,
        adminId: '', // Will be assigned by region lead on approval
        approvalStatus: 'pending', // New field for approval tracking
        status: 'inactive', // Inactive until approved
        completedJobs: 0,
        rating: 0,
        isTopListed: false,
        isFraud: false,
        ...locationData,
        createdAt: new Date()
      });

      // Keep phone lookup so workers can log in by phone number.
      await setDoc(doc(db, 'workers_by_phone', workerPhone), {
        phone: workerPhone,
        email: workerEmail,
        uid,
        name: workerName,
        gigType: workerGigTypes[0],
        gigTypes: workerGigTypes,
        area: workerArea,
        certifications: '',
        bankDetails: '',
        totalEarnings: 0,
        approvalStatus: 'pending',
        status: 'inactive',
        ...locationData,
        createdAt: new Date()
      }, { merge: true });

      // Worker role marker used by app routing.
      await setDoc(doc(db, 'worker_auth', uid), {
        uid,
        phone: workerPhone,
        email: workerEmail,
        name: workerName,
        gigType: workerGigTypes[0],
        gigTypes: workerGigTypes,
        area: workerArea,
        approvalStatus: 'pending',
        status: 'inactive',
        ...locationData,
        createdAt: new Date()
      }, { merge: true });

      alert('✅ Registration successful! Waiting for region lead approval.');
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============= WORKER LOGIN (PHONE + PASSWORD) =============
  const handleWorkerLogin = async (e) => {
    e.preventDefault();
    if (!phone || !password) {
      setError('Please enter phone number and password');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const workerPhoneDoc = await getDoc(doc(db, 'workers_by_phone', phone));
      if (!workerPhoneDoc.exists()) {
        throw new Error('Worker phone not found. Ask your mason/admin to add your worker profile first.');
      }

      const workerPhoneData = workerPhoneDoc.data();
      if (!workerPhoneData?.email) {
        throw new Error('Your worker account is not activated. Use "Activate existing worker" first.');
      }

      const userCred = await signInWithEmailAndPassword(auth, workerPhoneData.email, password);
      const uid = userCred.user.uid;
      const workerAuthDoc = await getDoc(doc(db, 'worker_auth', uid));

      if (!workerAuthDoc.exists()) {
        await signOut(auth);
        throw new Error('Worker profile missing. Please use activate worker flow.');
      }

      const workerState = workerAuthDoc.data();
      if (workerState?.approvalStatus === 'rejected') {
        await signOut(auth);
        throw new Error('Your worker account was rejected. Contact your region lead.');
      }

      if (workerState?.approvalStatus !== 'approved' || workerState?.status !== 'active') {
        await signOut(auth);
        throw new Error('Your worker account is pending approval. Please contact your region lead.');
      }

      navigate('/worker/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============= ACTIVATE EXISTING MASON-CREATED WORKER =============
  const handleWorkerActivate = async (e) => {
    e.preventDefault();
    if (!phone || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const workerPhoneDoc = await getDoc(doc(db, 'workers_by_phone', phone));
      if (!workerPhoneDoc.exists()) {
        throw new Error('Phone number not found in worker records. Ask your mason/admin to add you first.');
      }

      const workerData = workerPhoneDoc.data();
      if (workerData?.uid && workerData?.email) {
        throw new Error('This worker is already activated. Please login using phone + password.');
      }

      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      await setDoc(doc(db, 'worker_auth', uid), {
        uid,
        phone,
        email,
        name: workerData?.name || '',
        gigType: workerData?.gigType || 'other',
        area: workerData?.area || '',
        certifications: workerData?.certifications || '',
        bankDetails: workerData?.bankDetails || '',
        totalEarnings: Number(workerData?.totalEarnings || 0),
        adminId: workerData?.adminId || '',
        approvalStatus: workerData?.approvalStatus || 'approved',
        status: workerData?.status || 'active',
        activatedAt: new Date(),
        createdAt: workerData?.createdAt || new Date()
      }, { merge: true });

      await updateDoc(doc(db, 'workers_by_phone', phone), {
        uid,
        email,
        activatedAt: new Date()
      });

      navigate('/worker/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  if (phase === 'login') {
    return (
      <div style={{ 
        maxWidth: '450px', 
        margin: '60px auto', 
        padding: '40px 30px', 
        borderRadius: '20px',
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px rgba(31, 38, 135, 0.15)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        textAlign: 'center',
        color: '#1f2937'
      }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', color: '#111827', fontWeight: '800' }}>
          Gigtos Login
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '30px', fontSize: '15px' }}>
          Welcome back! Access your dashboard.
        </p>

        {error && (
          <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: '500' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleUnifiedLogin}>
          <div style={{ marginBottom: '18px', textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151' }}>
              Email or Phone Number
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. name@email.com or 1234567890"
              style={{
                width: '100%',
                padding: '12px 15px',
                border: '1.5px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '15px',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          <div style={{ marginBottom: '25px', textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#374151' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: '12px 15px',
                  border: '1.5px solid #e5e7eb',
                  borderRadius: '10px',
                  fontSize: '15px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#9ca3af' : 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 6px -1px rgba(124, 58, 237, 0.4)',
              transition: 'transform 0.1s'
            }}
            onMouseDown={(e) => e.target.style.transform = 'scale(0.98)'}
            onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
          >
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>

        <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #f3f4f6' }}>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 10px' }}>Don't have an account?</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button 
              onClick={() => setPhase('signup')}
              style={{ background: 'none', border: '1px solid #7c3aed', color: '#7c3aed', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              User Sign Up
            </button>
            <button 
              onClick={() => {
                setPhase('signup');
                setUserType('worker');
              }}
              style={{ background: 'none', border: '1px solid #10b981', color: '#10b981', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              Become a Worker
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============= LOGIN/SIGNUP FORM =============
  return (
    <div style={{
      maxWidth: '420px',
      margin: '40px auto',
      padding: '30px',
      border: '1px solid #d6d8de',
      borderRadius: '16px',
      boxShadow: '0 10px 24px rgba(17,24,39,0.08)',
      fontFamily: 'Inter, sans-serif',
      background: '#fff'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ margin: '0 0 5px 0', fontSize: '28px', color: '#1f2937', fontFamily: 'Manrope, Inter, sans-serif' }}>
          {userType === 'user' ? 'User' : userType === 'admin' ? 'Admin' : 'Worker'} {phase === 'login' ? 'Login' : 'Register/Sign Up'}
        </h2>
        <p style={{ color: '#666', margin: '5px 0', fontSize: '13px' }}>
          {userType === 'user' ? 'Book services with phone & OTP' : userType === 'admin' ? 'Manage your service business' : 'Register and get approved by region lead'}
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{
          padding: '12px 15px',
          marginBottom: '20px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '6px',
          color: '#c00',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span>⚠️</span>
          {error}
        </div>
      )}

      {/* USER PHONE AUTH */}
      {userType === 'user' && (
        <form onSubmit={phase === 'login' ? handleUserPhoneLogin : handleUserPhoneSignup}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              Phone Number:
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit phone number"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {phase === 'signup' && (
            <>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
                  Email:
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </>
          )}

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              {phase === 'login' ? 'OTP or Password:' : 'Password:'}
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={otp || password}
              onChange={(e) => {
                if (phase === 'login') {
                  setOtp(e.target.value);
                  setPassword('');
                } else {
                  setPassword(e.target.value);
                }
              }}
              placeholder={phase === 'login' ? 'Enter your password' : 'Minimum 6 characters'}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {phase === 'signup' && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
                Confirm Password:
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px',
              backgroundColor: loading ? '#ccc' : '#057A31',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '12px'
            }}
          >
            {loading ? '⏳ ' + (phase === 'login' ? 'Logging in...' : 'Signing up...') : (phase === 'login' ? 'Login' : 'Sign Up')}
          </button>

          <div style={{ textAlign: 'center', fontSize: '13px', color: '#666' }}>
            {phase === 'login' ? (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setPhase('signup');
                    setError('');
                    setOtp('');
                    setPassword('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#667eea',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    textDecoration: 'underline'
                  }}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setPhase('login');
                    setError('');
                    setPassword('');
                    setConfirmPassword('');
                    setEmail('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#667eea',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    textDecoration: 'underline'
                  }}
                >
                  Login
                </button>
              </>
            )}
          </div>
        </form>
      )}

      {/* ADMIN AUTH */}
      {userType === 'admin' && (
        <form onSubmit={handleAdminLogin}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              Email:
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              Password:
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px',
              backgroundColor: loading ? '#ccc' : '#764ba2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '12px'
            }}
          >
            {loading ? '⏳ Logging in...' : 'Admin Login'}
          </button>

          <div style={{ textAlign: 'center', fontSize: '12px', color: '#999' }}>
            Admin accounts are created by system administrators only.
          </div>
        </form>
      )}

      {/* WORKER LOGIN */}
      {userType === 'worker' && phase === 'login' && (
        <form onSubmit={handleWorkerLogin}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              Phone Number:
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit phone number"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              Password:
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px',
              backgroundColor: loading ? '#ccc' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '12px'
            }}
          >
            {loading ? '⏳ Logging in...' : 'Worker Login'}
          </button>

          <div style={{ textAlign: 'center', fontSize: '13px', color: '#666' }}>
            No login yet for this phone?{' '}
            <button
              type="button"
              onClick={() => {
                setPhase('activate');
                setError('');
                setPassword('');
                setConfirmPassword('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#0ea5e9',
                cursor: 'pointer',
                fontWeight: 'bold',
                textDecoration: 'underline'
              }}
            >
              Activate existing worker
            </button>
          </div>
        </form>
      )}

      {/* WORKER ACTIVATION (for mason-created worker records) */}
      {userType === 'worker' && phase === 'activate' && (
        <form onSubmit={handleWorkerActivate}>
          <div style={{ marginBottom: '12px', fontSize: '12px', color: '#0f766e', background: '#ecfeff', padding: '8px', borderRadius: '6px' }}>
            Use this if your mason already added your phone number in the system.
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              Worker Phone Number:
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit phone number"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              New Login Email:
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="worker@email.com"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              New Password:
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              Confirm Password:
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px',
              backgroundColor: loading ? '#ccc' : '#0ea5e9',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '12px'
            }}
          >
            {loading ? '⏳ Activating...' : 'Activate Worker Login'}
          </button>
        </form>
      )}

      {/* WORKER REGISTRATION */}
      {userType === 'worker' && phase === 'signup' && (
        <form onSubmit={handleWorkerSignup}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              Full Name:
            </label>
            <input
              type="text"
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              placeholder="Your full name"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              Phone Number:
            </label>
            <input
              type="tel"
              value={workerPhone}
              onChange={(e) => setWorkerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit phone number"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              Email:
            </label>
            <input
              type="email"
              value={workerEmail}
              onChange={(e) => setWorkerEmail(e.target.value)}
              placeholder="your.email@example.com"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              Service Types (select up to 3):
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
              {workerGigTypes.map(t => (
                <span key={t} style={{
                  background: '#10b981', color: 'white', padding: '4px 10px', borderRadius: '16px',
                  fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  {t} <button type="button" onClick={() => setWorkerGigTypes(prev => prev.filter(g => g !== t))}
                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '14px', padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              ))}
            </div>
            <select
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (val && !workerGigTypes.includes(val) && workerGigTypes.length < 3) {
                  setWorkerGigTypes(prev => [...prev, val]);
                }
              }}
              disabled={workerGigTypes.length >= 3}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
                opacity: workerGigTypes.length >= 3 ? 0.5 : 1,
              }}
            >
              <option value="">{workerGigTypes.length >= 3 ? 'Maximum 3 selected' : 'Select service type...'}</option>
              {SIGNUP_JOB_TYPES
                .filter(t => !workerGigTypes.includes(t))
                .map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, ' ')}</option>)}
            </select>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
              {workerGigTypes.length}/3 selected. You can edit these later from your dashboard.
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              Area/Region:
            </label>
            <input
              type="text"
              value={workerArea}
              onChange={(e) => setWorkerArea(e.target.value)}
              placeholder="e.g., North Mumbai, Delhi South"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              Password (min 6 chars):
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={workerPassword}
              onChange={(e) => setWorkerPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              Confirm Password:
            </label>
            <input
              type="password"
              value={workerConfirmPassword}
              onChange={(e) => setWorkerConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px',
              backgroundColor: loading ? '#ccc' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '12px'
            }}
          >
            {loading ? '⏳ Registering...' : 'Register as Worker'}
          </button>

          <div style={{ textAlign: 'center', fontSize: '12px', color: '#999' }}>
            Your registration will be reviewed by region lead for approval.
          </div>
        </form>
      )}

      {/* Back Button */}
      <button
        onClick={() => {
          setPhase(userType === 'worker' ? 'workerSelect' : 'typeSelect');
          resetAllFields();
        }}
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: '#f0f0f0',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '13px',
          color: '#666',
          marginTop: '20px'
        }}
      >
        ← Back to Selection
      </button>

      {/* Test Credentials */}
      <div style={{
        marginTop: '20px',
        padding: '12px',
        backgroundColor: '#e8f5e9',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#2e7d32'
      }}>
        <strong>🧪 Test Credentials:</strong><br/>
        User: Phone 8374532598 / Password: user123<br/>
        Admin: sri@gmail.com / Sri123
      </div>
    </div>
  );
}

export default Auth;
