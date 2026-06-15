import React, { useEffect, useMemo, useState } from 'react';
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
  FileText,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  Wrench,
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { auth, db, functionsInstance, storage } from '../firebase';
import { detectCurrentLocation } from '../context/LocationContext';
import { SPECIAL_JOBS } from '../config/specialJobs';
import { useToast } from '../context/ToastContext';
import { getAdminRedirectPath, isRegionSuspended } from '../utils/authRouting';
import { getWorkerOnboardingChecklist, getWorkerOnboardingPromise } from '../utils/workerOnboarding';
import { captureFrontendException, addSentryBreadcrumb } from '../utils/sentryMonitoring';
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

const MAX_WORKER_VERIFICATION_FILES = 8;

const getSelectedFiles = (fileList, max = MAX_WORKER_VERIFICATION_FILES) => (
  Array.from(fileList || []).slice(0, max)
);

const getSafeFileName = (file) => (
  (file?.name || 'verification-file').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120)
);

const getUploadProgressKey = (category, index, file) => `${category}_${index}_${getSafeFileName(file)}`;

const getFilePreviewKind = (file) => {
  if (file?.type?.startsWith('image/')) return 'image';
  if (file?.type === 'application/pdf') return 'pdf';
  return 'file';
};

const formatFileSize = (size = 0) => {
  if (!size) return '0 KB';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

function getFriendlyAuthError(err, fallback = 'Sign-in failed. Please try again.') {
  const code = err?.code || '';
  if (code === 'auth/operation-not-allowed') {
    return 'This sign-in method is not enabled in Firebase yet. Use email/password for now, or enable the provider in Firebase Auth.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Popup was blocked. Allow popups for Gigtos or use email/password.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in was closed before completion.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not added in Firebase Auth authorized domains yet.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'Invalid phone/email or password.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'This email already has an account. Please sign in instead.';
  }
  if (code === 'auth/weak-password') {
    return 'Password is too weak. Use at least 6 characters.';
  }
  return err?.message || fallback;
}

function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();

  const [phase, setPhase] = useState(searchParams.get('phase') === 'signup' ? 'signup' : 'login');
  const [userType, setUserType] = useState(searchParams.get('mode') || 'user');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [workerGigTypes, setWorkerGigTypes] = useState([]);
  const [workerArea, setWorkerArea] = useState('');
  const [workerExperienceYears, setWorkerExperienceYears] = useState('');
  const [workerStartingPrice, setWorkerStartingPrice] = useState('');
  const [workerBio, setWorkerBio] = useState('');
  const [workerSubSkills, setWorkerSubSkills] = useState('');
  const [workerCertifications, setWorkerCertifications] = useState('');
  const [workerBankSetupChoice, setWorkerBankSetupChoice] = useState('later');
  const [workerTotalEarnings, setWorkerTotalEarnings] = useState('');
  const [previousPlatformName, setPreviousPlatformName] = useState('');
  const [previousPlatformId, setPreviousPlatformId] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarOtpSent, setAadhaarOtpSent] = useState(false);
  const [aadhaarOtp, setAadhaarOtp] = useState('');
  const [aadhaarOtpVerified, setAadhaarOtpVerified] = useState(false);
  const [workerLanguagePreference, setWorkerLanguagePreference] = useState('en');
  const [profilePhotoFiles, setProfilePhotoFiles] = useState([]);
  const [previousProofFiles, setPreviousProofFiles] = useState([]);
  const [certificateFiles, setCertificateFiles] = useState([]);
  const [workerUploadProgress, setWorkerUploadProgress] = useState({});
  const [workerSubmitted, setWorkerSubmitted] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const workerSignupChecklist = getWorkerOnboardingChecklist({
    language: 'en',
    email,
    phone,
    serviceTypes: workerGigTypes,
    serviceArea: workerArea,
    hasExternalPlatformProof: Boolean(previousPlatformName || previousProofFiles.length),
    hasProfilePhoto: Boolean(profilePhotoFiles.length),
    hasStartingPrice: Boolean(workerStartingPrice),
    acceptedLaunchTerms: true,
    bankSetupChoice: workerBankSetupChoice,
  });
  const workerSignupPromise = getWorkerOnboardingPromise();
  const workerPreviewStepIds = ['auth', 'services', 'area', 'proof', 'promise', 'first_action'];
  const workerPreviewSteps = workerSignupChecklist.steps.filter((step) => workerPreviewStepIds.includes(step.id));
  const workerProofPreviews = useMemo(() => (
    [
      ...profilePhotoFiles.map((file) => ({ category: 'profile_photo', label: 'Profile photo', file })),
      ...previousProofFiles.map((file) => ({ category: 'previous_platform', label: 'Previous proof', file })),
      ...certificateFiles.map((file) => ({ category: 'certificate', label: 'Certificate', file })),
    ]
      .slice(0, MAX_WORKER_VERIFICATION_FILES)
      .map((item, index) => ({
        ...item,
        index,
        kind: getFilePreviewKind(item.file),
        safeName: getSafeFileName(item.file),
        previewUrl: getFilePreviewKind(item.file) === 'image' ? URL.createObjectURL(item.file) : '',
        progressKey: getUploadProgressKey(item.category, index, item.file),
      }))
  ), [profilePhotoFiles, previousProofFiles, certificateFiles]);

  useEffect(() => () => {
    workerProofPreviews.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  }, [workerProofPreviews]);

  const handleAadhaarChange = (value) => {
    setAadhaarNumber(value.replace(/\D/g, '').slice(0, 12));
    setAadhaarOtpSent(false);
    setAadhaarOtp('');
    setAadhaarOtpVerified(false);
  };

  const uploadWorkerVerificationFiles = async (uid) => {
    const files = [
      ...profilePhotoFiles.map((file) => ({ category: 'profile_photo', file })),
      ...previousProofFiles.map((file) => ({ category: 'previous_platform', file })),
      ...certificateFiles.map((file) => ({ category: 'certificate', file })),
    ].filter(item => item.file).slice(0, MAX_WORKER_VERIFICATION_FILES);

    const uploaded = [];
    setWorkerUploadProgress({});
    for (const [index, item] of files.entries()) {
      const safeName = getSafeFileName(item.file);
      const progressKey = getUploadProgressKey(item.category, index, item.file);
      const storagePath = `workers/${uid}/verification/${item.category}/${Date.now()}_${index}_${safeName}`;
      const fileRef = ref(storage, storagePath);
      await new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(fileRef, item.file, { contentType: item.file.type || 'application/octet-stream' });
        uploadTask.on('state_changed', (snapshot) => {
          const percent = snapshot.totalBytes
            ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            : 0;
          setWorkerUploadProgress((current) => ({ ...current, [progressKey]: percent }));
        }, reject, resolve);
      });
      setWorkerUploadProgress((current) => ({ ...current, [progressKey]: 100 }));
      const downloadUrl = await getDownloadURL(fileRef);
      uploaded.push({
        category: item.category,
        storagePath,
        downloadUrl,
        fileName: safeName,
        contentType: item.file.type || '',
        size: item.file.size || 0,
      });
    }
    return uploaded;
  };

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

  const createConsumerFromLogin = async (emailToUse) => {
    const userCred = await createUserWithEmailAndPassword(auth, emailToUse, password);
    await setDoc(doc(db, 'users', userCred.user.uid), {
      email: emailToUse,
      authProvider: 'email_password',
      createdViaLogin: true,
      needsProfileCompletion: true,
      createdAt: new Date(),
    }, { merge: true });
    return userCred;
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    addSentryBreadcrumb('Google login started', { userType });
    try {
      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      addSentryBreadcrumb('Google login success', { uid: userCred.user?.uid ? '[set]' : '[missing]' });
      await finishConsumerLogin(userCred.user);
    } catch (err) {
      // Expected user actions (popup closed, cancelled) are filtered by sentryMonitoring noise rules
      const expectedCodes = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/popup-blocked', 'auth/user-cancelled'];
      if (!expectedCodes.includes(err?.code)) {
        captureFrontendException(err, { source: 'google_login', code: err?.code });
      }
      setError(getFriendlyAuthError(err, 'Google sign-in failed.'));
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
    addSentryBreadcrumb('Unified login started', { userType, isPhone: !identifier.includes('@') });

    try {
      let emailToUse = identifier;
      const cleaned = identifier.replace(/[^\d]/g, '');
      const isPhone = !identifier.includes('@') && cleaned.length >= 10 && /^\d+$/.test(cleaned);

      if (isPhone) {
        const cleanPhone = cleaned.slice(-10);
        const lookupAuthEmailByPhone = httpsCallable(functionsInstance, 'lookupAuthEmailByPhone');
        const lookupResult = await lookupAuthEmailByPhone({ phone: cleanPhone });
        emailToUse = lookupResult.data?.email;
        if (!emailToUse) throw new Error('Phone number not found. If new, please sign up.');
      }

      let userCred;
      try {
        userCred = await signInWithEmailAndPassword(auth, emailToUse, password);
      } catch (loginErr) {
        const canCreateConsumerFromLogin =
          userType === 'user' &&
          identifier.includes('@') &&
          ['auth/user-not-found', 'auth/invalid-credential'].includes(loginErr?.code);
        if (!canCreateConsumerFromLogin) throw loginErr;
        try {
          userCred = await createConsumerFromLogin(emailToUse);
        } catch (createErr) {
          if (createErr?.code === 'auth/email-already-in-use') throw loginErr;
          throw createErr;
        }
        addToast('Account created. Please add your phone number to continue.', 'success');
      }
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
      // Only capture genuinely unexpected errors — bad credentials / not-found are user errors
      const expectedCodes = ['auth/wrong-password', 'auth/invalid-credential', 'auth/user-not-found', 'auth/too-many-requests'];
      if (!expectedCodes.includes(err?.code)) {
        captureFrontendException(err, { source: 'unified_login', code: err?.code });
      }
      setError(getFriendlyAuthError(err));
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
    if (userType === 'worker' && (!workerExperienceYears || !workerStartingPrice || !profilePhotoFiles.length || !previousProofFiles.length)) {
      setError('Add experience, starting price, profile photo, and previous work proof.');
      return;
    }
    if (userType === 'worker' && (aadhaarNumber.length !== 12 || !aadhaarOtpVerified)) {
      setError('Complete mock Aadhaar OTP verification before submitting.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setLoading(true);
    addSentryBreadcrumb('Signup started', { userType });

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const { uid } = userCred.user;

      if (userType === 'worker') {
        const loc = await detectCurrentLocation().catch(() => ({}));
        const documents = await uploadWorkerVerificationFiles(uid);
        const submitWorkerVerification = httpsCallable(functionsInstance, 'submitWorkerVerification');
        await submitWorkerVerification({
          name,
          email,
          phone,
          serviceIds: workerGigTypes,
          gigTypes: workerGigTypes,
          areaName: workerArea,
          city: loc?.city || '',
          experienceYears: workerExperienceYears,
          startingPrice: workerStartingPrice,
          bio: workerBio,
          subSkills: workerSubSkills,
          certifications: workerCertifications,
          bankSetupChoice: workerBankSetupChoice,
          totalEarnings: workerTotalEarnings,
          languagePreference: workerLanguagePreference,
          previousPlatformName,
          previousPlatformId,
          aadhaarNumber,
          aadhaarOtpVerified,
          documents,
        });

        addSentryBreadcrumb('Worker signup complete', { area: workerArea, gigTypes: workerGigTypes.length });
        addToast('Worker verification submitted. Waiting for approval.', 'success');
        setWorkerSubmitted(true);
      } else {
        await setDoc(doc(db, 'users', uid), { email, createdAt: new Date() });
        addSentryBreadcrumb('Consumer signup complete');
        navigate('/complete-profile-phone');
      }
    } catch (err) {
      // Capture unexpected signup failures — email-in-use and weak-password are user errors
      const expectedCodes = ['auth/email-already-in-use', 'auth/weak-password', 'auth/invalid-email'];
      if (!expectedCodes.includes(err?.code)) {
        captureFrontendException(err, { source: 'signup', userType, code: err?.code });
      }
      setError(getFriendlyAuthError(err, 'Account creation failed.'));
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
              <strong>GigScore ready</strong>
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

          {workerSubmitted && (
            <div className="auth-submitted-card" role="status">
              <CheckCircle2 size={24} />
              <h3>Profile submitted for review</h3>
              <p>
                SuperAdmin will check your identity, profile photo, service area, and work proof before activation.
                You can browse Gigtos now, but jobs unlock only after approval.
              </p>
              <div className="auth-submitted-actions">
                <button type="button" className="auth-small-btn" onClick={() => navigate('/workers')}>
                  Worker guide
                </button>
                <button type="button" className="auth-small-btn" onClick={() => setPhase('login')}>
                  Sign in later
                </button>
              </div>
            </div>
          )}

          {!workerSubmitted && (
            <>
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

                    <label className="auth-field">
                      <span>Preferred App Language</span>
                      <div className="auth-input-wrap">
                        <FileText size={18} />
                        <select
                          value={workerLanguagePreference}
                          onChange={(e) => setWorkerLanguagePreference(e.target.value)}
                        >
                          <option value="en">English (EN)</option>
                          <option value="te">Telugu (తె)</option>
                          <option value="hi">Hindi (हिं)</option>
                          <option value="kn">Kannada (ಕ)</option>
                          <option value="ta">Tamil (த)</option>
                        </select>
                      </div>
                    </label>

                    <div className="auth-worker-verification-grid">
                      <label className="auth-field">
                        <span>Experience years</span>
                        <div className="auth-input-wrap">
                          <BriefcaseBusiness size={18} />
                          <input
                            type="number"
                            min="0"
                            max="60"
                            value={workerExperienceYears}
                            onChange={(e) => setWorkerExperienceYears(e.target.value)}
                            placeholder="Example: 3"
                          />
                        </div>
                      </label>

                      <label className="auth-field">
                        <span>Starting price</span>
                        <div className="auth-input-wrap">
                          <Sparkles size={18} />
                          <input
                            type="number"
                            min="1"
                            value={workerStartingPrice}
                            onChange={(e) => setWorkerStartingPrice(e.target.value)}
                            placeholder="INR per job/hour"
                          />
                        </div>
                      </label>
                    </div>

                    <label className="auth-field">
                      <span>Short worker bio</span>
                      <div className="auth-input-wrap auth-input-wrap--textarea">
                        <FileText size={18} />
                        <textarea
                          value={workerBio}
                          onChange={(e) => setWorkerBio(e.target.value.slice(0, 300))}
                          placeholder="Service experience, languages, and preferred work type"
                          rows={3}
                        />
                      </div>
                    </label>

                    <label className="auth-field">
                      <span>Sub-skills / specializations</span>
                      <div className="auth-input-wrap auth-input-wrap--textarea">
                        <FileText size={18} />
                        <textarea
                          value={workerSubSkills}
                          onChange={(e) => setWorkerSubSkills(e.target.value.slice(0, 400))}
                          placeholder="Example: bathroom deep cleaning, utensils, kitchen oil stains"
                          rows={2}
                        />
                      </div>
                    </label>

                    <div className="auth-worker-verification-grid">
                      <label className="auth-field">
                        <span>Certifications / training</span>
                        <div className="auth-input-wrap">
                          <FileText size={18} />
                          <input
                            type="text"
                            value={workerCertifications}
                            onChange={(e) => setWorkerCertifications(e.target.value.slice(0, 250))}
                            placeholder="Optional training or certificates"
                          />
                        </div>
                      </label>

                      <label className="auth-field">
                        <span>Past earnings handled</span>
                        <div className="auth-input-wrap">
                          <BriefcaseBusiness size={18} />
                          <input
                            type="number"
                            min="0"
                            value={workerTotalEarnings}
                            onChange={(e) => setWorkerTotalEarnings(e.target.value)}
                            placeholder="Optional INR total"
                          />
                        </div>
                      </label>
                    </div>

                    <label className="auth-field">
                      <span>Payout setup preference</span>
                      <div className="auth-input-wrap">
                        <FileText size={18} />
                        <select
                          value={workerBankSetupChoice}
                          onChange={(e) => setWorkerBankSetupChoice(e.target.value)}
                        >
                          <option value="later">Add bank/UPI after approval</option>
                          <option value="manual_review">Need help from support</option>
                          <option value="cash_first">Cash/direct UPI jobs first</option>
                        </select>
                      </div>
                    </label>

                    <div className="auth-verification-box">
                      <div className="auth-verification-box__head">
                        <ShieldCheck size={17} />
                        <strong>Identity check</strong>
                        <span>Stored as masked only</span>
                      </div>
                      <label className="auth-field">
                        <span>Aadhaar number</span>
                        <div className="auth-input-wrap">
                          <ShieldCheck size={18} />
                          <input
                            type="text"
                            inputMode="numeric"
                            value={aadhaarNumber}
                            onChange={(e) => handleAadhaarChange(e.target.value)}
                            placeholder="12 digits"
                            autoComplete="off"
                          />
                        </div>
                      </label>
                      <div className="auth-aadhaar-actions">
                        <button
                          type="button"
                          className="auth-small-btn"
                          onClick={() => setAadhaarOtpSent(aadhaarNumber.length === 12)}
                          disabled={aadhaarNumber.length !== 12}
                        >
                          Send mock OTP
                        </button>
                        <div className="auth-input-wrap">
                          <Lock size={18} />
                          <input
                            type="text"
                            inputMode="numeric"
                            value={aadhaarOtp}
                            onChange={(e) => setAadhaarOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder={aadhaarOtpSent ? 'Use 123456' : 'OTP'}
                            disabled={!aadhaarOtpSent}
                          />
                        </div>
                        <button
                          type="button"
                          className="auth-small-btn"
                          onClick={() => setAadhaarOtpVerified(aadhaarOtp === '123456')}
                          disabled={!aadhaarOtpSent || aadhaarOtp.length !== 6}
                        >
                          Verify
                        </button>
                      </div>
                      {aadhaarOtpVerified && <span className="auth-verified-line">Aadhaar mock OTP verified. Raw number is not stored in normal profile data.</span>}
                    </div>

                    <div className="auth-verification-box">
                      <div className="auth-verification-box__head">
                        <Upload size={17} />
                        <strong>Worker proof</strong>
                        <span>Images/PDF accepted</span>
                      </div>

                      <label className="auth-field">
                        <span>Profile photo</span>
                        <input
                          className="auth-file-input"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => setProfilePhotoFiles(getSelectedFiles(e.target.files, 2))}
                        />
                      </label>

                      <label className="auth-field">
                        <span>Previous platform or work proof</span>
                        <input
                          className="auth-file-input"
                          type="file"
                          accept="image/*,application/pdf"
                          multiple
                          onChange={(e) => setPreviousProofFiles(getSelectedFiles(e.target.files, 5))}
                        />
                      </label>

                      <div className="auth-worker-verification-grid">
                        <label className="auth-field">
                          <span>Previous platform</span>
                          <div className="auth-input-wrap">
                            <FileText size={18} />
                            <input
                              type="text"
                              value={previousPlatformName}
                              onChange={(e) => setPreviousPlatformName(e.target.value)}
                              placeholder="Optional"
                            />
                          </div>
                        </label>
                        <label className="auth-field">
                          <span>Platform ID last digits</span>
                          <div className="auth-input-wrap">
                            <FileText size={18} />
                            <input
                              type="text"
                              value={previousPlatformId}
                              onChange={(e) => setPreviousPlatformId(e.target.value.slice(0, 40))}
                              placeholder="Optional"
                            />
                          </div>
                        </label>
                      </div>

                      <label className="auth-field">
                        <span>Certificate optional</span>
                        <input
                          className="auth-file-input"
                          type="file"
                          accept="image/*,application/pdf"
                          multiple
                          onChange={(e) => setCertificateFiles(getSelectedFiles(e.target.files, 5))}
                        />
                      </label>

                      {workerProofPreviews.length > 0 && (
                        <div className="auth-proof-preview" aria-label="Selected verification files">
                          <div className="auth-proof-preview__head">
                            <strong>Selected proofs</strong>
                            <span>{workerProofPreviews.length}/{MAX_WORKER_VERIFICATION_FILES} files</span>
                          </div>
                          <div className="auth-proof-preview__grid">
                            {workerProofPreviews.map((item) => {
                              const progress = workerUploadProgress[item.progressKey];
                              return (
                                <div className="auth-proof-preview__item" key={`${item.progressKey}_${item.file.size}`}>
                                  <div className="auth-proof-preview__thumb">
                                    {item.kind === 'image' ? (
                                      <img src={item.previewUrl} alt="" />
                                    ) : (
                                      <FileText size={20} />
                                    )}
                                  </div>
                                  <div>
                                    <strong>{item.label}</strong>
                                    <span>{item.safeName}</span>
                                    <small>{item.kind.toUpperCase()} · {formatFileSize(item.file.size)}</small>
                                    {typeof progress === 'number' && (
                                      <div className="auth-proof-progress" aria-label={`${item.safeName} upload ${progress}%`}>
                                        <span style={{ width: `${progress}%` }} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
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
              <div className="auth-worker-onboarding" aria-label="Worker first ten minute onboarding checklist">
                <div className="auth-worker-onboarding__head">
                  <span><Sparkles size={15} /> First 10 minutes</span>
                  <strong>{workerSignupChecklist.progressPercent}% ready</strong>
                </div>
                <div className="auth-worker-onboarding__bar" aria-hidden="true">
                  <span style={{ width: `${workerSignupChecklist.progressPercent}%` }} />
                </div>
                <ul>
                  {workerPreviewSteps.map((step) => (
                    <li key={step.id} className={step.done ? 'done' : ''}>
                      <CheckCircle2 size={16} />
                      <div>
                        <strong>{step.title}</strong>
                        <span>{step.detail}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <p>{workerSignupPromise.summary}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="auth-submit-btn">
              {loading ? 'Please wait...' : (phase === 'login' ? 'Continue' : 'Create account')}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
            </>
          )}

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
