import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getAdminRedirectPath, isRegionSuspended } from '../utils/authRouting';
import { detectCurrentLocation } from '../context/LocationContext';

function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [userType, setUserType] = useState(searchParams.get('mode') || 'user'); // 'user', 'admin', or 'worker'
  const [phase, setPhase] = useState('typeSelect'); // 'typeSelect', 'login', 'signup'
  
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
  const [workerGigType, setWorkerGigType] = useState('');
  const [workerArea, setWorkerArea] = useState('');
  
  // UI States
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const resetAllFields = () => {
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
    setWorkerGigType('');
    setWorkerArea('');
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

    if (phone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
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
        address: '',
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
    if (!workerName || !workerPhone || !workerEmail || !workerPassword || !workerConfirmPassword || !workerGigType || !workerArea) {
      setError('Please fill in all fields');
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
        gigType: workerGigType,
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
        gigType: workerGigType,
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
        gigType: workerGigType,
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
  if (phase === 'typeSelect') {
    return (
      <div style={{ maxWidth: '560px', margin: '50px auto', padding: '30px 20px 70px', textAlign: 'center', color: '#1f2937' }}>
        <h1 style={{ fontSize: '40px', marginBottom: '8px', color: '#1f2937', fontFamily: 'Manrope, Inter, sans-serif' }}>
          Welcome to Gigto
        </h1>
        <p style={{ color: '#4b5563', marginBottom: '30px', fontSize: '16px' }}>
          Choose how you'd like to access the platform
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <button
            onClick={() => {
              setUserType('user');
              setPhase('login');
              setError('');
            }}
            style={{
              padding: '40px',
              border: '2px solid #764ba2',
              borderRadius: '12px',
              backgroundColor: '#f8f7fb',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#333',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#e8f0ff';
              e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#f0f4ff';
              e.target.style.boxShadow = 'none';
            }}
          >
            <div style={{ fontSize: '34px', marginBottom: '10px' }}>User</div>
            Book Services as a User
            <div style={{ fontSize: '13px', color: '#666', marginTop: '10px', fontWeight: 'normal' }}>
              Login with phone number & OTP
            </div>
          </button>

          <button
            onClick={() => {
              setUserType('admin');
              setPhase('login');
              setError('');
            }}
            style={{
              padding: '40px',
              border: '2px solid #764ba2',
              borderRadius: '12px',
              backgroundColor: '#f8f0ff',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#333',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#faf0ff';
              e.target.style.boxShadow = '0 4px 12px rgba(118, 75, 162, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#f8f0ff';
              e.target.style.boxShadow = 'none';
            }}
          >
            <div style={{ fontSize: '34px', marginBottom: '10px' }}>Admin</div>
            Manage Services as Admin
            <div style={{ fontSize: '13px', color: '#666', marginTop: '10px', fontWeight: 'normal' }}>
              Login with email & password
            </div>
          </button>

          <button
            onClick={() => {
              setUserType('worker');
              setPhase('workerSelect');
              resetAllFields();
            }}
            style={{
              padding: '40px',
              border: '2px solid #10b981',
              borderRadius: '12px',
              backgroundColor: '#f0fdf4',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#333',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#e6fdf0';
              e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#f0fdf4';
              e.target.style.boxShadow = 'none';
            }}
          >
            <div style={{ fontSize: '34px', marginBottom: '10px' }}>Worker</div>
            Register as Worker
            <div style={{ fontSize: '13px', color: '#666', marginTop: '10px', fontWeight: 'normal' }}>
              Get approved by region lead
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (userType === 'worker' && phase === 'workerSelect') {
    return (
      <div style={{ maxWidth: '540px', margin: '50px auto', padding: '24px 16px 70px', textAlign: 'center', color: '#1f2937' }}>
        <h2 style={{ marginBottom: '8px', fontSize: '32px', fontFamily: 'Manrope, Inter, sans-serif' }}>Worker Access</h2>
        <p style={{ color: '#666', marginBottom: '24px' }}>Choose how you want to continue</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <button
            onClick={() => {
              setPhase('login');
              setError('');
            }}
            style={{
              padding: '18px',
              border: '2px solid #10b981',
              borderRadius: '10px',
              background: '#ecfdf5',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Login (Phone + Password)
          </button>

          <button
            onClick={() => {
              setPhase('activate');
              setError('');
            }}
            style={{
              padding: '18px',
              border: '2px solid #0ea5e9',
              borderRadius: '10px',
              background: '#f0f9ff',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Activate Existing Worker (Already Added By Mason)
          </button>

          <button
            onClick={() => {
              setPhase('signup');
              setError('');
            }}
            style={{
              padding: '18px',
              border: '2px solid #10b981',
              borderRadius: '10px',
              background: '#f0fdf4',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Register New Worker
          </button>
        </div>

        <button
          onClick={() => {
            setUserType('user');
            setPhase('typeSelect');
            resetAllFields();
          }}
          style={{
            marginTop: '20px',
            width: '100%',
            padding: '10px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          ← Back
        </button>
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
              Service Type:
            </label>
            <select
              value={workerGigType}
              onChange={(e) => setWorkerGigType(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            >
              <option value="">Select service type...</option>
              <option value="plumbing">Plumbing</option>
              <option value="electrical">Electrical</option>
              <option value="carpentry">Carpentry</option>
              <option value="painting">Painting</option>
              <option value="masonry">Masonry</option>
              <option value="cleaning">Cleaning</option>
              <option value="landscaping">Landscaping</option>
              <option value="other">Other</option>
            </select>
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
