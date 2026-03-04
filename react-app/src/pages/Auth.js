import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithCustomToken, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functionsInstance } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Cloud Function references for secure OTP authentication
const sendOtpFn = httpsCallable(functionsInstance, 'sendOtp');
const verifyOtpFn = httpsCallable(functionsInstance, 'verifyOtp');

function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [userType, setUserType] = useState(searchParams.get('mode') || 'user'); // 'user' or 'admin'
  const [phase, setPhase] = useState(searchParams.get('mode') ? 'login' : 'typeSelect'); // 'typeSelect', 'login', 'signup'
  
  // User (Phone) Fields
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false); // true after sendOtp succeeds
  
  // Common Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI States
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ============= REQUEST OTP (Step 1) =============
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phone || phone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendOtpFn({ phone });
      setOtpSent(true);
      setOtp('');
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ============= VERIFY OTP & SIGN IN (Step 2) =============
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit OTP sent to your phone.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await verifyOtpFn({ phone, otp });
      await signInWithCustomToken(auth, result.data.token);
      navigate('/');
    } catch (err) {
      setError(err.message || 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ============= USER PASSWORD LOGIN (fallback) =============
  const handleUserPasswordLogin = async (e) => {
    e.preventDefault();
    if (!phone || !password) {
      setError('Please enter your phone number and password');
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
      // Authenticate with the password the user typed — never use a stored password
      await signInWithEmailAndPassword(auth, storedEmail, password);
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

      await setDoc(doc(db, 'users_by_phone', phone), {
        uid: uid,
        email: email,
        phone: phone,
        createdAt: new Date()
        // Password is managed by Firebase Auth only — never stored in Firestore
      });

      await setDoc(doc(db, 'users', uid), {
        phone: phone,
        email: email,
        name: '',
        address: '',
        createdAt: new Date()
      });

      navigate('/complete-profile-phone');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============= ADMIN LOGIN (Email + OTP) =============
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!email || !otp) {
      setError('Please enter your email and OTP');
      return;
    }

    // Verify OTP (test OTP: 202020)
    if (otp !== '202020') {
      setError('Invalid OTP. Test OTP: 202020');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Look up admin record by email to get the stored password for Firebase Auth
      const snap = await getDocs(query(collection(db, 'admins'), where('email', '==', email)));
      if (snap.empty) {
        throw new Error('No admin account found for this email');
      }
      const adminData = snap.docs[0].data();
      if (!adminData.password) {
        throw new Error('Admin account not configured correctly. Contact support.');
      }
      await signInWithEmailAndPassword(auth, email, adminData.password);
      navigate('/admin/bookings');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ============= TYPE SELECTION PHASE =============
  if (phase === 'typeSelect') {
    return (
      <div style={{ maxWidth: '500px', margin: '60px auto', padding: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '10px', color: '#333' }}>
          🏠 Welcome to Gigto
        </h1>
        <p style={{ color: '#666', marginBottom: '40px', fontSize: '16px' }}>
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
              border: '2px solid #667eea',
              borderRadius: '12px',
              backgroundColor: '#f0f4ff',
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
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>👤</div>
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
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>👨‍💼</div>
            Manage Services as Admin
            <div style={{ fontSize: '13px', color: '#666', marginTop: '10px', fontWeight: 'normal' }}>
              Login with email & OTP
            </div>
          </button>
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
      border: '1px solid #e0e0e0',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ margin: '0 0 5px 0', fontSize: '24px', color: '#333' }}>
          {userType === 'user' ? '👤 User' : '👨‍💼 Admin'} {phase === 'login' ? 'Login' : 'Sign Up'}
        </h2>
        <p style={{ color: '#666', margin: '5px 0', fontSize: '13px' }}>
          {userType === 'user' ? 'Book services with phone & OTP' : 'Manage your service business'}
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
        <form onSubmit={
          phase === 'signup'
            ? handleUserPhoneSignup
            : otpSent
              ? handleVerifyOtp
              : handleSendOtp
        }>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
              Phone Number:
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setOtpSent(false); setOtp(''); }}
              placeholder="10-digit phone number"
              disabled={otpSent}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
                backgroundColor: otpSent ? '#f5f5f5' : 'white'
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

          {/* OTP step 2: enter the 6-digit code */}
          {phase === 'login' && otpSent && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
                OTP (sent to your phone):
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit OTP"
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #667eea',
                  borderRadius: '6px',
                  fontSize: '18px',
                  letterSpacing: '4px',
                  textAlign: 'center',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#666' }}>
                OTP expires in 5 minutes.{' '}
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtp(''); setError(''); }}
                  style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', textDecoration: 'underline', fontSize: '12px' }}
                >
                  Resend OTP
                </button>
              </div>
            </div>
          )}

          {/* Password field: shown during signup, or as fallback for login */}
          {(phase === 'signup' || (phase === 'login' && !otpSent)) && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px', color: '#333' }}>
                {phase === 'login' ? 'Password (or use OTP above):' : 'Password:'}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={phase === 'login' ? 'Enter password' : 'Minimum 6 characters'}
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

          {/* Primary action button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px',
              backgroundColor: loading ? '#ccc' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '15px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '8px'
            }}
          >
            {loading
              ? '⏳ ' + (phase === 'signup' ? 'Signing up...' : otpSent ? 'Verifying...' : 'Sending OTP...')
              : phase === 'signup'
                ? 'Sign Up'
                : otpSent
                  ? '✅ Verify OTP & Login'
                  : '📱 Send OTP'}
          </button>

          {/* Password login button (only shown on login step 1, as a secondary option) */}
          {phase === 'login' && !otpSent && password && (
            <button
              type="button"
              disabled={loading}
              onClick={handleUserPasswordLogin}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: 'transparent',
                color: '#667eea',
                border: '1px solid #667eea',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: '12px'
              }}
            >
              Login with Password
            </button>
          )}

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
                    setOtpSent(false);
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
              OTP:
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit OTP"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
                letterSpacing: '4px',
                fontWeight: 'bold'
              }}
            />
            <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
              An OTP will be sent to your registered email. (Test OTP: 202020)
            </div>
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
            {loading ? '⏳ Verifying OTP...' : '🔐 Verify OTP & Login'}
          </button>

          <div style={{ textAlign: 'center', fontSize: '12px', color: '#999' }}>
            Admin accounts are created by system administrators only.
          </div>
        </form>
      )}

      {/* Back Button */}
      <button
        onClick={() => {
          setPhase('typeSelect');
          setError('');
          setOtp('');
          setOtpSent(false);
          setPassword('');
          setConfirmPassword('');
          setPhone('');
          setEmail('');
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
        User: Phone 8374532598 — click "Send OTP" to receive code<br/>
        Admin: sri@gmail.com / Sri123
      </div>

    </div>
  );
}

export default Auth;
