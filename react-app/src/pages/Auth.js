import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  Wrench,
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { detectCurrentLocation } from '../context/LocationContext';
import { SPECIAL_JOBS } from '../config/specialJobs';
import { useToast } from '../context/ToastContext';
import { getAdminRedirectPath, isRegionSuspended } from '../utils/authRouting';
import './Auth.css';

const SIGNUP_JOB_TYPES = [
  ...SPECIAL_JOBS.map((job) => job.id),
  'carpentry',
  'masonry',
  'landscaping',
  'other',
].filter((value, index, all) => all.indexOf(value) === index);

const JOB_TYPE_LABELS = {
  maid: 'Maid service',
  cleaning: 'Cleaning',
  electrician: 'Electrician',
  plumber: 'Plumber',
  carpentry: 'Carpentry',
  masonry: 'Masonry',
  landscaping: 'Garden work',
  other: 'Other skilled work',
};

const formatJobType = (type) => (
  JOB_TYPE_LABELS[type]
  || type
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
);

function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();

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

  const finishConsumerLogin = async (firebaseUser) => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const existing = await getDoc(userRef);
    if (!existing.exists()) {
      await setDoc(userRef, {
        email: firebaseUser.email || '',
        name: firebaseUser.displayName || '',
        phone: firebaseUser.phoneNumber || '',
        authProvider: 'google',
        createdAt: new Date(),
      });
    }
    navigate(firebaseUser.phoneNumber ? '/' : '/complete-profile-phone');
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      await finishConsumerLogin(userCred.user);
    } catch (err) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUnifiedLogin = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Please enter phone/email and password');
      return;
    }

    setError('');
    setLoading(true);

    try {
      let emailToUse = identifier;
      const cleaned = identifier.replace(/[^\d]/g, '');
      const isPhone = !identifier.includes('@') && cleaned.length >= 10 && /^\d+$/.test(cleaned);

      if (isPhone) {
        const cleanPhone = cleaned.slice(-10);
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
      const { uid } = userCred.user;

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
      const { uid } = userCred.user;

      if (userType === 'worker') {
        const loc = await detectCurrentLocation().catch(() => ({}));
        const workerData = {
          uid,
          name,
          email,
          phone,
          gigTypes: workerGigTypes,
          locationArea: workerArea,
          approvalStatus: 'pending',
          status: 'inactive',
          createdAt: new Date(),
          ...(loc && { locationLat: loc.lat, locationLng: loc.lng, locationCity: loc.city }),
        };

        await setDoc(doc(db, 'worker_auth', uid), workerData);
        await setDoc(doc(db, 'gig_workers', uid), workerData);
        await setDoc(doc(db, 'workers_by_phone', phone.replace(/[^\d]/g, '').slice(-10)), { email, uid });

        addToast('Registration successful! Waiting for approval.', 'success');
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
    <main className="auth-page">
      <section className="auth-visual-panel" aria-label="Gigtos trust summary">
        <div className="auth-visual-content">
          <span className="auth-kicker"><ShieldCheck size={16} /> Verified marketplace</span>
          <h1>Simple login for real local services.</h1>
          <p>
            Consumers book faster. Workers join with a clean professional profile.
            Gigtos keeps the path short, clear, and built for trust.
          </p>

          <div className="auth-trust-grid" aria-label="Trust signals">
            <div>
              <CheckCircle2 size={18} />
              <strong>Google or phone/email</strong>
              <span>Fast access without confusing steps.</span>
            </div>
            <div>
              <Wrench size={18} />
              <strong>Worker verification path</strong>
              <span>Skill, area, phone, and approval status.</span>
            </div>
            <div>
              <Sparkles size={18} />
              <strong>SocioScore ready</strong>
              <span>Trust signals can grow without changing login.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-panel" aria-label="Gigtos sign in">
        <div className="auth-card">
          <div className="auth-brand-row">
            <div>
              <span className="auth-brand">Gigtos</span>
              <p>{phase === 'login' ? 'Welcome back' : 'Create your account'}</p>
            </div>
            <span className="auth-mode-chip">{phase === 'login' ? 'Secure access' : 'New profile'}</span>
          </div>

          <div className="auth-heading">
            <h2>{phase === 'login' ? 'Sign in' : 'Join Gigtos'}</h2>
            <p>
              {phase === 'login'
                ? 'Use Google, phone, or email to continue.'
                : 'Choose consumer or worker and fill the required details.'}
            </p>
          </div>

          <div className="auth-segment" role="tablist" aria-label="Account type">
            <button
              type="button"
              className={userType === 'user' ? 'active' : ''}
              onClick={() => setUserType('user')}
            >
              <User size={16} /> Consumer
            </button>
            <button
              type="button"
              className={userType === 'worker' ? 'active' : ''}
              onClick={() => setUserType('worker')}
            >
              <BriefcaseBusiness size={16} /> Worker
            </button>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <ShieldCheck size={16} />
              <span>{error}</span>
            </div>
          )}

          {phase === 'login' && userType === 'user' && (
            <div className="auth-provider-stack">
              <button
                type="button"
                className="auth-google-btn"
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                <span aria-hidden="true">G</span>
                Continue with Google
              </button>
              <div className="auth-divider">
                <span />
                <strong>or use phone/email</strong>
                <span />
              </div>
            </div>
          )}

          <form className="auth-form" onSubmit={phase === 'login' ? handleUnifiedLogin : handleSignup}>
            {phase === 'login' ? (
              <label className="auth-field">
                <span>{userType === 'worker' ? 'Worker phone or email' : 'Phone number or email'}</span>
                <div className="auth-input-wrap">
                  <Phone size={18} />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="10-digit phone or name@email.com"
                    autoComplete="username"
                  />
                </div>
              </label>
            ) : (
              <>
                {userType === 'worker' && (
                  <label className="auth-field">
                    <span>Full name</span>
                    <div className="auth-input-wrap">
                      <User size={18} />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your professional name"
                        autoComplete="name"
                      />
                    </div>
                  </label>
                )}

                <label className="auth-field">
                  <span>Email address</span>
                  <div className="auth-input-wrap">
                    <Mail size={18} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@email.com"
                      autoComplete="email"
                    />
                  </div>
                </label>

                {userType === 'worker' && (
                  <>
                    <label className="auth-field">
                      <span>Phone number</span>
                      <div className="auth-input-wrap">
                        <Phone size={18} />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          autoComplete="tel"
                        />
                      </div>
                    </label>

                    <label className="auth-field">
                      <span>Operating area</span>
                      <div className="auth-input-wrap">
                        <MapPin size={18} />
                        <input
                          type="text"
                          value={workerArea}
                          onChange={(e) => setWorkerArea(e.target.value)}
                          placeholder="Example: HSR Layout, Bengaluru"
                        />
                      </div>
                    </label>

                    <label className="auth-field">
                      <span>Main skill</span>
                      <div className="auth-input-wrap">
                        <Wrench size={18} />
                        <select
                          value={workerGigTypes[0] || ''}
                          onChange={(e) => setWorkerGigTypes(e.target.value ? [e.target.value] : [])}
                        >
                          <option value="">Select your primary service</option>
                          {SIGNUP_JOB_TYPES.map((type) => (
                            <option key={type} value={type}>{formatJobType(type)}</option>
                          ))}
                        </select>
                      </div>
                    </label>
                  </>
                )}
              </>
            )}

            <label className="auth-field">
              <span>Password</span>
              <div className="auth-input-wrap">
                <Lock size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete={phase === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="auth-icon-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {phase === 'signup' && (
              <label className="auth-field">
                <span>Confirm password</span>
                <div className="auth-input-wrap">
                  <Lock size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    autoComplete="new-password"
                  />
                </div>
              </label>
            )}

            {phase === 'signup' && userType === 'worker' && (
              <div className="auth-note">
                First 30 days are free during launch. Verified UC, Pivot, or similar proof can unlock one-year free access. You can keep using other apps too.
              </div>
            )}

            <button type="submit" disabled={loading} className="auth-submit-btn">
              {loading ? 'Please wait...' : (phase === 'login' ? 'Continue' : 'Create account')}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="auth-switch">
            {phase === 'login' ? (
              <>
                New to Gigtos?
                <button type="button" onClick={() => setPhase('signup')}>Create account</button>
              </>
            ) : (
              <>
                Already have an account?
                <button type="button" onClick={() => setPhase('login')}>Sign in</button>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default Auth;
