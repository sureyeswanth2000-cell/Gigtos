import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getAdminRedirectPath, isRegionSuspended } from '../utils/authRouting';
import { detectCurrentLocation } from '../context/LocationContext';
import { SPECIAL_JOBS } from '../config/specialJobs';

const SIGNUP_JOB_TYPES = [
  ...SPECIAL_JOBS.map(sj => sj.id),
  'carpentry', 'masonry', 'landscaping', 'other'
].filter((v, i, a) => a.indexOf(v) === i);

function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [phase, setPhase] = useState('login'); 
  const [userType, setUserType] = useState(searchParams.get('mode') || 'user'); 
  
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [workerGigTypes, setWorkerGigTypes] = useState([]);
  const [workerArea, setWorkerArea] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleUnifiedLogin = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Please enter email or phone and password');
      return;
    }

    setError('');
    setLoading(true);

    try {
      let emailToUse = identifier;
      const cleaned = identifier.replace(/[^\d]/g, '');
      const isPhone = !identifier.includes('@') && cleaned.length >= 10 && /^\d+$/.test(cleaned);

      if (isPhone) {
        const cleanPhone = identifier.replace(/[^\d]/g, '').slice(-10);
        const workerPhoneDoc = await getDoc(doc(db, 'workers_by_phone', cleanPhone));
        const userPhoneDoc = await getDoc(doc(db, 'users_by_phone', cleanPhone));
        
        if (workerPhoneDoc.exists()) {
          emailToUse = workerPhoneDoc.data().email;
        } else if (userPhoneDoc.exists()) {
          emailToUse = userPhoneDoc.data().email;
        } else {
          throw new Error('Phone number not found. If new, please sign up.');
        }
      }

      const userCred = await signInWithEmailAndPassword(auth, emailToUse, password);
      const uid = userCred.user.uid;

      const adminDoc = await getDoc(doc(db, 'admins', uid));
      if (adminDoc.exists()) {
        const adminData = adminDoc.data();
        if (isRegionSuspended(adminData)) {
          await signOut(auth);
          throw new Error('Your region is suspended.');
        }
        navigate(getAdminRedirectPath(adminData));
        return;
      }

      const workerDoc = await getDoc(doc(db, 'worker_auth', uid));
      if (workerDoc.exists()) {
        const workerData = workerDoc.data();
        if (workerData.approvalStatus !== 'approved') {
          await signOut(auth);
          throw new Error('Worker account pending approval.');
        }
        navigate('/worker/dashboard');
        return;
      }

      navigate('/');
    } catch (err) {
      setError(err.message.includes('auth/invalid-credential') ? 'Invalid credentials' : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) {
      setError('Please fill in password fields');
      return;
    }
    if (userType === 'worker' && (!name || !phone || !workerArea || workerGigTypes.length === 0)) {
      setError('Please fill in all professional details');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      if (userType === 'worker') {
        const loc = await detectCurrentLocation().catch(() => ({}));
        const workerData = {
          uid,
          name,
          email,
          phone,
          gigTypes: workerGigTypes,
          area: workerArea,
          approvalStatus: 'pending',
          status: 'inactive',
          createdAt: new Date(),
          ...loc && { locationLat: loc.lat, locationLng: loc.lng, locationCity: loc.city }
        };
        
        await setDoc(doc(db, 'worker_auth', uid), workerData);
        await setDoc(doc(db, 'gig_workers', uid), workerData);
        await setDoc(doc(db, 'workers_by_phone', phone.replace(/[^\d]/g, '').slice(-10)), { email, uid });
        
        alert('Registration successful! Waiting for approval.');
        navigate('/');
      } else {
        await setDoc(doc(db, 'users', uid), { email, createdAt: new Date() });
        navigate('/complete-profile-phone');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'var(--bg-main)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Dynamic Background Elements */}
      <div style={{ 
        position: 'absolute', 
        top: '10%', 
        left: '10%', 
        width: '300px', 
        height: '300px', 
        background: 'var(--primary-purple)', 
        filter: 'blur(120px)', 
        opacity: 0.15,
        borderRadius: '50%',
        zIndex: 0
      }} />
      <div style={{ 
        position: 'absolute', 
        bottom: '10%', 
        right: '10%', 
        width: '400px', 
        height: '400px', 
        background: 'var(--secondary-green)', 
        filter: 'blur(150px)', 
        opacity: 0.1,
        borderRadius: '50%',
        zIndex: 0
      }} />

      <div style={{ 
        width: '100%',
        maxWidth: '460px', 
        padding: '48px', 
        borderRadius: 'var(--radius-xl)',
        background: 'var(--glass-bg)',
        backdropFilter: 'var(--glass-blur)',
        boxShadow: 'var(--glass-shadow)',
        border: '1px solid var(--glass-border)',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Branding */}
        <div style={{ 
          background: 'var(--primary-purple)', 
          color: 'white', 
          padding: '6px 16px', 
          borderRadius: 'var(--radius-pill)', 
          fontSize: '11px', 
          fontWeight: '900', 
          letterSpacing: '0.1em',
          display: 'inline-block',
          marginBottom: '24px',
          textTransform: 'uppercase'
        }}>
          Premium Platform
        </div>

        <h1 style={{ fontSize: '36px', marginBottom: '8px', color: 'var(--text-main)', fontWeight: '850', letterSpacing: '-0.03em' }}>
          {phase === 'login' ? 'Gigtos' : 'Join Us'}
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '40px', fontSize: '16px', fontWeight: '500' }}>
          {phase === 'login' ? 'The future of gig work is here.' : 'Create your professional profile.'}
        </p>

        {error && (
          <div style={{ 
            backgroundColor: 'var(--error-bg)', 
            color: 'var(--error)', 
            padding: '12px 20px', 
            borderRadius: 'var(--radius-lg)', 
            marginBottom: '32px', 
            fontSize: '14px', 
            fontWeight: '600', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            border: '1px solid var(--error)',
            textAlign: 'left'
          }}>
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={phase === 'login' ? handleUnifiedLogin : handleSignup}>
          {phase === 'login' ? (
            <div style={{ marginBottom: '24px', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: '700', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Email or Phone
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@email.com or phone"
                className="input-field"
                style={{
                  width: '100%', padding: '16px 20px', background: 'var(--bg-soft)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', fontSize: '16px', color: 'var(--text-main)', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box'
                }}
              />
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '24px', textAlign: 'left' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: '700', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Account Type
                </label>
                <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-soft)', padding: '6px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' }}>
                  <button type="button" onClick={() => setUserType('user')} style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-md)', border: 'none', background: userType === 'user' ? 'var(--primary-purple)' : 'transparent', color: userType === 'user' ? 'white' : 'var(--text-muted)', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s' }}>User</button>
                  <button type="button" onClick={() => setUserType('worker')} style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-md)', border: 'none', background: userType === 'worker' ? 'var(--primary-purple)' : 'transparent', color: userType === 'worker' ? 'white' : 'var(--text-muted)', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s' }}>Pro</button>
                </div>
              </div>

              {userType === 'worker' && (
                <div style={{ marginBottom: '24px', textAlign: 'left' }}>
                  <label style={{ display: 'block', marginBottom: '10px', fontWeight: '700', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Full Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" style={{ width: '100%', padding: '16px 20px', background: 'var(--bg-soft)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', fontSize: '16px', color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}

              <div style={{ marginBottom: '24px', textAlign: 'left' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: '700', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" style={{ width: '100%', padding: '16px 20px', background: 'var(--bg-soft)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', fontSize: '16px', color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {userType === 'worker' && (
                <>
                  <div style={{ marginBottom: '24px', textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '10px', fontWeight: '700', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Phone</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" style={{ width: '100%', padding: '16px 20px', background: 'var(--bg-soft)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', fontSize: '16px', color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: '24px', textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '10px', fontWeight: '700', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Operating Area</label>
                    <input type="text" value={workerArea} onChange={(e) => setWorkerArea(e.target.value)} placeholder="e.g. North Mumbai" style={{ width: '100%', padding: '16px 20px', background: 'var(--bg-soft)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', fontSize: '16px', color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: '24px', textAlign: 'left' }}>
                    <label style={{ display: 'block', marginBottom: '10px', fontWeight: '700', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Skill</label>
                    <select onChange={(e) => setWorkerGigTypes([e.target.value])} style={{ width: '100%', padding: '16px 20px', background: 'var(--bg-soft)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', fontSize: '16px', color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box' }}>
                      <option value="">Select...</option>
                      {SIGNUP_JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </>
              )}
            </>
          )}

          <div style={{ marginBottom: '32px', textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: '700', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '16px 20px', background: 'var(--bg-soft)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', fontSize: '16px', color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box' }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--primary-purple)', cursor: 'pointer', fontSize: '11px', fontWeight: '900' }}>
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>

          {phase === 'signup' && (
            <div style={{ marginBottom: '32px', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: '700', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '16px 20px', background: 'var(--bg-soft)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', fontSize: '16px', color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '18px', fontSize: '18px', marginBottom: '28px' }}>
            {loading ? 'Processing...' : (phase === 'login' ? 'Sign In' : 'Create Account')}
          </button>

          <div style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: '500' }}>
            {phase === 'login' ? (
              <>
                New to Gigtos?{' '}
                <span onClick={() => setPhase('signup')} style={{ color: 'var(--primary-purple)', fontWeight: '800', cursor: 'pointer', textDecoration: 'none' }}>Create account</span>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <span onClick={() => setPhase('login')} style={{ color: 'var(--primary-purple)', fontWeight: '800', cursor: 'pointer', textDecoration: 'none' }}>Sign in</span>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default Auth;
