import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db, functionsInstance } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { WorkerLocationProvider, useWorkerLocation } from '../../context/WorkerLocationContext';
import { USER_BUDGET_MARKUP_PERCENT } from '../../utils/aiBudgetSuggestion';
import ActiveStatusButton from '../../components/worker/ActiveStatusButton';
import WorkerFixedRateForm from '../../components/worker/WorkerFixedRateForm';
import WorkerBottomNav from '../../components/worker/WorkerBottomNav';
import WorkerLocationTracker from '../../components/worker/WorkerLocationTracker';
import QuoteModal from '../../components/worker/QuoteModal';
import CompleteJobModal from '../../components/worker/CompleteJobModal';
import StartWorkProofModal from '../../components/worker/StartWorkProofModal';
import GigScoreSpeedometer from '../../components/GigScoreSpeedometer';
import { getDevBypassUserFromSearch, isDevBypassEnabled } from '../../utils/devBypass';
import { getGigScoreFreeAccessProgress } from '../../utils/workerSubscription';
import { GIGTOS_RAZORPAY_PAYMENT_LINK } from '../../config/paymentLinks';
import { formatPayoutHoldDuration, normalizePayoutHoldMinutes } from '../../config/pricingSettings';
import { usePricingSettings } from '../../utils/usePricingSettings';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  listenForWorkerOfferPushMessages,
  registerWorkerOfferPushToken,
} from '../../utils/workerPushNotifications';
import '../../styles/worker-dashboard.css';

const NAV_CARDS = [
  { to: '/worker/open-work', icon: '📋', label: 'Open Work' },
  { to: '/worker/history', icon: '🕐', label: 'History' },
  { to: '/worker/future-work', icon: '📅', label: 'Future Work' },
  { to: '/worker/profile', icon: '👤', label: 'My Profile' },
  { to: '/worker/support', icon: '💬', label: 'Support' },
];

/**
 * Calculate AI suggested quote for workers.
 * Uses USER_BUDGET_MARKUP_PERCENT to reverse the markup applied to user budgets,
 * giving workers the actual market rate (currently 25% less than what users see).
 */
function getAiSuggestedAmount(userBudget) {
  const budget = Number(userBudget);
  if (!budget || budget <= 0) return null;
  return Math.round(budget / (1 + USER_BUDGET_MARKUP_PERCENT / 100));
}

/**
 * Open Google Maps directions to a job's location.
 * Falls back to area-based search if lat/lng not available.
 */
function openDirections(job) {
  if (job.lat && job.lng) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}`, '_blank', 'noopener');
  } else if (job.locationLat && job.locationLng) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${job.locationLat},${job.locationLng}`, '_blank', 'noopener');
  } else if (job.area || job.address) {
    const dest = encodeURIComponent(job.address || job.area);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank', 'noopener');
  }
}

function openPlatformFeePayment() {
  window.open(GIGTOS_RAZORPAY_PAYMENT_LINK, '_blank', 'noopener');
}

/** Workflow step config for live job action buttons */
const WORKFLOW_STEPS = {
  assigned: { next: 'in_progress', label: '▶ Start Work', style: 'btn-primary' },
  in_progress: { next: 'awaiting_confirmation', label: '✅ Mark Complete', style: 'btn-success' },
};

const WORKER_STATUS_ACTIONS = {
  in_progress: 'worker_start_work',
  awaiting_confirmation: 'worker_mark_finished',
  completed: 'worker_confirm_completed',
};

function formatInr(amount) {
  return `₹${Math.max(0, Math.round(Number(amount) || 0)).toLocaleString('en-IN')}`;
}

function getOfferMatchText(offer) {
  const eta = Number(offer.etaMinutes);
  const hasEta = Number.isFinite(eta) && eta > 0;
  const etaText = hasEta
    ? ` - ${Math.round(eta)} min ${['google_maps', 'google_maps_traffic', 'google_maps_cached'].includes(offer.etaSource) ? 'route ETA' : 'approx ETA'}`
    : '';
  if (offer.matchingScope === 'same_area') return `Same-area match${etaText}`;
  if (offer.matchingScope === 'nearby_radius') {
    const distance = Number(offer.distanceKm);
    return Number.isFinite(distance)
      ? `Nearby match - ${distance.toFixed(1)} km${etaText}`
      : `Nearby match - up to ${offer.radiusKm || 15} km`;
  }
  if (offer.matchingScope === 'nearby_city_fallback') {
    return 'Nearby-area match - distance not confirmed';
  }
  return '';
}

function getWorkerWalletSummary(worker) {
  const balance = Number(worker?.walletBalance ?? worker?.availableWalletBalance ?? worker?.earningsBalance ?? 0);
  const platformFeeDue = Number(
    worker?.cashPlatformFeeDue ??
    worker?.pendingPlatformFeeDue ??
    worker?.platformFeeDue ??
    worker?.walletPlatformFeeDue ??
    0
  );
  const dailyJobLimitActive = platformFeeDue >= 100 || worker?.platformFeeRestrictionActive === true;

  return {
    balance,
    platformFeeDue,
    dailyJobLimitActive,
    gigScorePenalty: dailyJobLimitActive ? 5 : 0,
    repaymentState: platformFeeDue > 0 ? 'Due' : 'Clear',
  };
}

function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getWorkerEarningAmount(booking) {
  return Number(
    booking?.acceptedQuote?.pricing?.workerReceives ??
    booking?.fixedRate ??
    booking?.acceptedQuote?.price ??
    booking?.settlement?.workerEarnings ??
    0
  );
}

function getPayoutReadiness(booking, payoutHoldMinutesValue = 120) {
  const payoutHoldMinutes = normalizePayoutHoldMinutes(booking?.workerPayoutHoldMinutes ?? payoutHoldMinutesValue);
  const completedAt = toDate(booking?.completedAt) || toDate(booking?.statusUpdatedAt) || toDate(booking?.updatedAt);
  const explicitEligibleAt = toDate(booking?.workerPayoutEligibleAt);
  const eligibleAt = explicitEligibleAt || (completedAt ? new Date(completedAt.getTime() + (payoutHoldMinutes * 60 * 1000)) : null);
  const now = new Date();
  const openDispute = ['open', 'pending', 'escalated'].includes((booking?.dispute?.status || '').toLowerCase());
  const paid = ['paid', 'captured', 'success', 'successful'].includes((booking?.paymentStatus || '').toLowerCase());
  const payoutStatus = (booking?.workerPayoutStatus || '').toLowerCase();
  const alreadyRequested = ['pending', 'payout_requested', 'queued', 'queued_for_manual_review', 'processing', 'held_for_dispute', 'manual_hold', 'field_operator_hold', 'blocked_by_dispute', 'paid', 'processed'].includes(payoutStatus);
  const eligible = booking?.status === 'completed' && paid && !openDispute && !alreadyRequested && eligibleAt && now >= eligibleAt;
  return { eligible, eligibleAt, openDispute, paid, alreadyRequested };
}

function getJobWorkLocation(job = {}) {
  const lat = Number(job.lat ?? job.locationLat ?? job.consumerLat ?? job.userLocationLat);
  const lng = Number(job.lng ?? job.locationLng ?? job.consumerLng ?? job.userLocationLng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function LiveJobActionButton({ job, step, isUpdating, onUpdate }) {
  const workerLocation = useWorkerLocation();

  const handleClick = async () => {
    const ok = await onUpdate(job, step.next);
    if (ok && step.next === 'in_progress' && workerLocation && !workerLocation.tracking) {
      workerLocation.startTracking(getJobWorkLocation(job), job.id);
    }
  };

  return (
    <button
      className={step.style}
      disabled={isUpdating}
      onClick={handleClick}
      style={{ width: '100%', marginTop: 10, padding: 10, fontSize: 14 }}
    >
      {isUpdating ? 'Updating...' : step.label}
    </button>
  );
}

export default function WorkerDashboard() {
  const { t } = useLanguage();
  const pricingSettings = usePricingSettings();
  const payoutHoldMinutes = normalizePayoutHoldMinutes(pricingSettings.payoutHoldMinutes);
  const payoutHoldLabel = formatPayoutHoldDuration(payoutHoldMinutes);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [worker, setWorker] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [liveJobs, setLiveJobs] = useState([]);
  const [futureJobs, setFutureJobs] = useState([]);
  const [nearbyJobs, setNearbyJobs] = useState([]);
  const [queueOffers, setQueueOffers] = useState([]);
  const [payoutJobs, setPayoutJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [startProofJob, setStartProofJob] = useState(null);
  const [completingJob, setCompletingJob] = useState(null);
  const [updatingJobId, setUpdatingJobId] = useState(null);
  const [offerActionId, setOfferActionId] = useState(null);
  const [pushStatus, setPushStatus] = useState('idle');
  const [withdrawing, setWithdrawing] = useState(false);
  const [sendingSos, setSendingSos] = useState(false);
  const { addToast } = useToast();
  const navigate = useNavigate();
  const devWorker = useMemo(
    () => (isDevBypassEnabled() ? getDevBypassUserFromSearch() : null),
    []
  );

  useEffect(() => {
    if (devWorker?.role === 'worker') {
      const baseJob = {
        id: 'dev-live-job-1',
        title: 'Home Helper',
        serviceType: 'Home Helper',
        area: 'Indiranagar',
        customerName: 'Dev Consumer',
        status: 'assigned',
        budget: 700,
      };
      setWorker({
        ...devWorker,
        uid: devWorker.uid,
        rating: 4.8,
        locationLat: devWorker.lat,
        locationLng: devWorker.lng,
        walletBalance: 1240,
        cashPlatformFeeDue: 120,
        platformFeeRestrictionActive: true,
      });
      setLiveJobs([baseJob]);
      setFutureJobs([{ ...baseJob, id: 'dev-future-job-1', status: 'confirmed', scheduledAt: Date.now() + 86400000 }]);
      setNearbyJobs([{ ...baseJob, id: 'dev-open-job-1', status: 'open' }]);
      setQueueOffers([{
        id: 'dev-offer-1',
        serviceId: 'home_helper',
        city: devWorker.city || 'Bangalore',
        areaId: devWorker.area || 'indiranagar',
        workerReceivable: 700,
        demandLevel: 'normal',
        rank: 1,
        bargainStatus: 'pending',
        expiresAt: Date.now() + 90000,
      }]);
      setPayoutJobs([{
        ...baseJob,
        id: 'dev-paid-job-1',
        status: 'completed',
        paymentStatus: 'paid',
        completedAt: Date.now() - (3 * 60 * 60 * 1000),
        fixedRate: 700,
      }]);
      setLoading(false);
      setJobsLoading(false);
      return undefined;
    }

    let jobUnsubscribes = [];
    const clearJobSubscriptions = () => {
      jobUnsubscribes.forEach((unsubscribe) => unsubscribe());
      jobUnsubscribes = [];
    };

    const subscribeMergedBookings = (queries, setter, filter = () => true) => {
      const latest = queries.map(() => []);
      const emit = () => {
        const merged = new Map();
        latest.flat().forEach((item) => {
          if (filter(item)) merged.set(item.id, item);
        });
        setter(Array.from(merged.values()));
      };
      return queries.map((bookingQuery, index) => onSnapshot(bookingQuery, (snap) => {
        latest[index] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        emit();
      }, () => {
        latest[index] = [];
        emit();
      }));
    };

    const unsub = onAuthStateChanged(auth, async (u) => {
      clearJobSubscriptions();
      if (!u) { navigate('/auth'); return; }
      try {
        const workerRef = doc(db, 'worker_auth', u.uid);
        const snap = await getDoc(workerRef);
        if (!snap.exists()) {
          setError('Worker account not found.');
          setLoading(false);
          return;
        }
        setWorker({ ...snap.data(), uid: u.uid });
        const workerUnsubscribe = onSnapshot(workerRef, (workerSnap) => {
          if (workerSnap.exists()) setWorker({ ...workerSnap.data(), uid: u.uid });
        });

        jobUnsubscribes = [
          workerUnsubscribe,
          ...subscribeMergedBookings([
            query(collection(db, 'bookings'), where('assignedWorkerId', '==', u.uid), where('status', 'in', ['assigned', 'in_progress'])),
            query(collection(db, 'bookings'), where('workerId', '==', u.uid), where('status', 'in', ['assigned', 'in_progress'])),
          ], setLiveJobs),
          ...subscribeMergedBookings([
            query(collection(db, 'bookings'), where('assignedWorkerId', '==', u.uid), where('status', 'in', ['pending', 'confirmed', 'scheduled'])),
            query(collection(db, 'bookings'), where('workerId', '==', u.uid), where('status', 'in', ['pending', 'confirmed', 'scheduled'])),
          ], setFutureJobs),
          ...subscribeMergedBookings([
            query(collection(db, 'bookings'), where('assignedWorkerId', '==', u.uid), where('status', '==', 'completed')),
            query(collection(db, 'bookings'), where('workerId', '==', u.uid), where('status', '==', 'completed')),
          ], setPayoutJobs),
        ];

        // Real-time listener: open jobs (available to any worker)
        const unsubOpen = onSnapshot(
          query(collection(db, 'bookings'), where('status', '==', 'open')),
          (openSnap) => setNearbyJobs(openSnap.docs.map(d => ({ id: d.id, ...d.data() }))),
          () => setNearbyJobs([])
        );
        jobUnsubscribes.push(unsubOpen);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setJobsLoading(false);
      }
    });
    return () => {
      clearJobSubscriptions();
      unsub();
    };
  }, [navigate, devWorker]);

  useEffect(() => {
    if (!worker?.uid || devWorker?.role === 'worker') return undefined;
    const offerQuery = query(
      collection(db, 'smart_queue_offers'),
      where('workerId', '==', worker.uid),
      where('status', '==', 'offered')
    );
    const unsubscribe = onSnapshot(offerQuery, (snap) => {
      const offers = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDate(a.expiresAt)?.getTime() || 0) - (toDate(b.expiresAt)?.getTime() || 0));
      setQueueOffers(offers);
    }, () => {
      setQueueOffers([]);
    });
    return unsubscribe;
  }, [worker?.uid, devWorker]);

  useEffect(() => {
    if (!worker?.uid || devWorker?.role === 'worker') return undefined;
    let cancelled = false;
    if (typeof window !== 'undefined' && window.Notification?.permission === 'granted') {
      registerWorkerOfferPushToken()
        .then(result => {
          if (!cancelled) setPushStatus(result.status);
        })
        .catch(() => {
          if (!cancelled) setPushStatus('error');
        });
    }
    return () => { cancelled = true; };
  }, [worker?.uid, devWorker]);

  const handleStatusChange = useCallback((active) => {
    setIsActive(active);
  }, []);

  const showToast = useCallback((msg, type = '') => {
    addToast(msg, type || 'success');
  }, [addToast]);

  useEffect(() => {
    if (!worker?.uid || devWorker?.role === 'worker') return undefined;
    let unsubscribe = () => {};
    let mounted = true;
    listenForWorkerOfferPushMessages(() => {
      if (mounted) showToast('New Smart Queue offer received. Open job offers to accept or skip.', 'success');
    }).then(cleanup => {
      unsubscribe = cleanup || (() => {});
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [worker?.uid, devWorker, showToast]);

  const enableOfferNotifications = useCallback(async () => {
    if (devWorker?.uid) {
      setPushStatus('registered');
      showToast('Job offer alerts are enabled for this demo session.', 'success');
      return false;
    }
    setPushStatus('requesting');
    try {
      const result = await registerWorkerOfferPushToken();
      setPushStatus(result.status);
      showToast(result.message, result.status === 'registered' ? 'success' : 'warning');
    } catch (err) {
      setPushStatus('error');
      showToast(err.message || 'Could not enable job offer alerts.', 'error');
    }
  }, [devWorker?.uid, showToast]);

  const handleSendQuote = async ({ price, message, jobId }) => {
    if (devWorker?.uid) {
      await new Promise(resolve => setTimeout(resolve, 350));
      setNearbyJobs(prev => prev.filter(job => job.id !== jobId));
      showToast("Quote sent. You'll be notified if accepted.", 'success');
      return;
    }
    await httpsCallable(functionsInstance, 'submitQuote')({
      bookingId: jobId,
      price: Number(price),
      finalPrice: Number(price),
      message: message || '',
    });
    setNearbyJobs(prev => prev.filter(job => job.id !== jobId));
    showToast("✅ Quote sent! You'll be notified if accepted.", 'success');
  };

  const handleQueueOfferResponse = useCallback(async (offer, response) => {
    setOfferActionId(offer.id);
    try {
      if (devWorker?.uid) {
        await new Promise(resolve => setTimeout(resolve, 350));
        setQueueOffers(prev => prev.filter(item => item.id !== offer.id));
        showToast(response === 'accept' ? 'Offer accepted. Booking assigned.' : 'Offer skipped. We will check another worker.', 'success');
        return;
      }
      await httpsCallable(functionsInstance, 'respondToSmartQueueOffer')({
        offerId: offer.id,
        response,
        rejectReason: response === 'reject' ? 'worker_declined_from_dashboard' : '',
      });
      showToast(response === 'accept' ? 'Offer accepted. Booking assigned.' : 'Offer skipped. Queue moved forward.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not update offer. Please try again.', 'error');
      return false;
    } finally {
      setOfferActionId(null);
    }
  }, [devWorker?.uid, showToast]);

  /** Update a live job's status (Start → In Progress → Complete) */
  const handleSos = useCallback(async () => {
    if (sendingSos) return;
    const activeBooking = liveJobs[0] || null;
    const reason = window.prompt('SOS reason for operator/superadmin?', 'Emergency help needed during worker duty.');
    if (!reason) return;
    setSendingSos(true);
    try {
      const sendIncident = async (coords = null) => {
        if (devWorker?.uid) {
          await new Promise(resolve => setTimeout(resolve, 400));
          return { data: { incidentId: 'dev-sos-incident' } };
        }
        return httpsCallable(functionsInstance, 'createSosIncident')({
          role: 'worker',
          bookingId: activeBooking?.id || null,
          reason,
          lat: coords?.latitude || null,
          lng: coords?.longitude || null,
        });
      };

      let result = null;
      if (navigator.geolocation) {
        result = await new Promise(resolve => {
          navigator.geolocation.getCurrentPosition(
            position => resolve(sendIncident(position.coords)),
            () => resolve(sendIncident(null)),
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
          );
        });
      } else {
        result = await sendIncident(null);
      }
      showToast(`SOS sent. Incident ${result?.data?.incidentId || 'created'} is open.`, 'success');
    } catch (err) {
      showToast(err.message || 'SOS failed. Call local emergency help if you are in danger.', 'error');
    } finally {
      setSendingSos(false);
    }
  }, [devWorker?.uid, liveJobs, sendingSos, showToast]);

  const handleWithdraw = useCallback(async () => {
    const eligibleJobs = payoutJobs.filter(job => getPayoutReadiness(job, payoutHoldMinutes).eligible);
    if (!eligibleJobs.length) {
      showToast(`Withdrawal opens ${payoutHoldLabel} after paid work completion if no dispute is raised.`, 'error');
      return;
    }
    if (!worker?.payoutBankAccountMasked?.accountNumberLast4 && !worker?.payoutBankAccount?.accountNumber) {
      showToast('Add payout bank details in My Profile before withdrawing.', 'error');
      return;
    }

    setWithdrawing(true);
    try {
      if (devWorker?.uid) {
        await new Promise(resolve => setTimeout(resolve, 500));
        showToast('Dev withdrawal request created.', 'success');
      } else {
        const result = await httpsCallable(functionsInstance, 'requestWorkerWithdrawal')({});
        const total = result?.data?.totalAmount || eligibleJobs.reduce((sum, job) => sum + getWorkerEarningAmount(job), 0);
        showToast(`Withdrawal requested for ${formatInr(total)} by IMPS.`, 'success');
        setPayoutJobs(prev => prev.map(job => (
          getPayoutReadiness(job, payoutHoldMinutes).eligible
            ? { ...job, workerPayoutStatus: 'payout_requested' }
            : job
        )));
      }
    } catch (err) {
      showToast(err.message || 'Withdrawal request failed.', 'error');
    } finally {
      setWithdrawing(false);
    }
  }, [devWorker?.uid, payoutHoldLabel, payoutHoldMinutes, payoutJobs, showToast, worker?.payoutBankAccount?.accountNumber, worker?.payoutBankAccountMasked?.accountNumberLast4]);

  const handleJobStatusUpdate = useCallback(async (job, nextStatus) => {
    if (nextStatus === 'in_progress') {
      setStartProofJob(job);
      return false;
    }
    if (nextStatus === 'awaiting_confirmation') {
      setCompletingJob(job);
      return;
    }

    setUpdatingJobId(job.id);
    try {
      if (!devWorker?.uid) {
        const backendAction = WORKER_STATUS_ACTIONS[nextStatus];
        if (!backendAction) throw new Error(`Unsupported worker status transition: ${nextStatus}`);
        await httpsCallable(functionsInstance, 'updateBookingStatus')({
          bookingId: job.id,
          action: backendAction,
          extraArgs: {},
        });
      }
      if (nextStatus === 'completed') {
        // Move from live to neither (completed)
        setLiveJobs(prev => prev.filter(j => j.id !== job.id));
        showToast('🎉 Job completed! Great work.', 'success');
      } else {
        // Update status in local state
        setLiveJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: nextStatus } : j));
        showToast('▶ Work started! Keep it up.', 'success');
      }
      return true;
    } catch {
      showToast('❌ Failed to update status. Try again.', 'error');
    } finally {
      setUpdatingJobId(null);
    }
  }, [devWorker?.uid, showToast]);

  const handleStartProofCompleted = useCallback((job) => {
    setStartProofJob(null);
    setLiveJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'in_progress' } : j));
    showToast('Work started with arrival proof. Keep location sharing on.', 'success');
  }, [showToast]);

  if (loading) {
    return (
      <div className="worker-page">
        <div className="worker-container">
          <div className="worker-header-section">
            <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%', marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 140, height: 20, marginBottom: 6 }} />
            <div className="skeleton" style={{ width: 100, height: 14 }} />
          </div>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 14, marginBottom: 12 }} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="worker-page">
        <div className="worker-container">
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>😔</div>
            <p style={{ color: '#b91c1c' }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const initials = (worker?.name || 'W').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const isPending = worker?.approvalStatus !== 'approved';
  const walletSummary = getWorkerWalletSummary(worker);
  const eligiblePayoutJobs = payoutJobs.filter(job => getPayoutReadiness(job, payoutHoldMinutes).eligible);
  const lockedPayoutJobs = payoutJobs.filter(job => !getPayoutReadiness(job, payoutHoldMinutes).eligible);
  const withdrawableAmount = eligiblePayoutJobs.reduce((sum, job) => sum + getWorkerEarningAmount(job), 0);
  const nextEligibleAt = lockedPayoutJobs
    .map(job => getPayoutReadiness(job, payoutHoldMinutes).eligibleAt)
    .filter(Boolean)
    .sort((a, b) => a - b)[0] || null;
  const freeAccessProgress = getGigScoreFreeAccessProgress({
    joinedAt: worker?.joinedAt?.toDate?.() || worker?.joinedAt || worker?.createdAt?.toDate?.() || worker?.createdAt || new Date(),
    gigScore: worker?.gigScore,
    socioScore: worker?.socioScore,
    alreadyExtended: worker?.gigScoreFreeAccessAutoExtended,
  });

  return (
    <WorkerLocationProvider>
    <div className="worker-page">
      <div className="worker-container">

        {/* ─── CLEAN HEADER ─── */}
        <div className="worker-header-section" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, padding: '20px 20px 24px' }}>
          <div className="worker-avatar" style={{ width: 48, height: 48, fontSize: 20, marginBottom: 0, flexShrink: 0 }}>{initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{worker?.name || 'Worker'}</div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
              📍 {worker?.area || 'Unknown Area'}
            </div>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: isActive ? '#34D399' : '#FCD34D',
                boxShadow: isActive ? '0 0 0 3px rgba(52,211,153,0.3)' : '0 0 0 3px rgba(252,211,77,0.3)'
              }} />
              <span style={{ fontSize: 12, opacity: 0.9 }}>
                {isActive ? 'Active' : 'Offline'}
              </span>
            </div>
          </div>
          {/* Quick map access */}
          <Link
            to="/worker/map"
            style={{
              background: 'rgba(255,255,255,0.25)', borderRadius: 12, padding: '8px 12px',
              color: '#fff', textDecoration: 'none', fontSize: 20, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Open Map"
          >
            🗺️
          </Link>
        </div>

        {isPending && (
          <div className="worker-card" style={{ background: '#FFF7ED', border: '1px solid #FED7AA', marginBottom: 14 }}>
            <div style={{ color: '#C2410C', fontWeight: 600, fontSize: 14 }}>
              ⏳ Approval Pending
            </div>
            <p style={{ color: '#9A3412', fontSize: 13, margin: '4px 0 0' }}>
              Your account is pending approval by your region lead. Some features may be limited.
            </p>
          </div>
        )}

        <div className="worker-command-strip" aria-label="Worker quick actions">
          <button type="button" onClick={() => setIsActive(prev => !prev)}>
            <strong>{isActive ? 'Online' : 'Go Online'}</strong>
            <span>{isActive ? 'Accepting nearby work' : 'Start receiving jobs'}</span>
          </button>
          <Link to="/worker/open-work">
            <strong>{nearbyJobs.length}</strong>
            <span>Open jobs</span>
          </Link>
          <Link to="/worker/future-work">
            <strong>{futureJobs.length}</strong>
            <span>Upcoming</span>
          </Link>
        </div>

        <section className="worker-sos-card" aria-label="Emergency SOS">
          <div>
            <strong>{t('emergencySos')}</strong>
            <span>{t('emergencySosDesc')}</span>
          </div>
          <button type="button" onClick={handleSos} disabled={sendingSos}>
            {sendingSos ? t('sending') : t('sendSos')}
          </button>
        </section>

        <GigScoreSpeedometer
          score={worker?.gigScore ?? worker?.socioScore ?? 500}
          role="worker"
          guildScore={worker?.guildScore || null}
          events={worker?.gigScoreEvents || worker?.scoreEvents || []}
        />

        <section className="worker-wallet-card" aria-label="GigScore free access">
          <div className="worker-wallet-head">
            <div>
              <span className="worker-wallet-kicker">{t('launchAccess')}</span>
              <h2>{t('gigScoreUnlock')}</h2>
            </div>
            <span className={`worker-wallet-status ${freeAccessProgress.unlocked ? 'clear' : 'due'}`}>
              {freeAccessProgress.unlocked ? t('unlocked') : `${freeAccessProgress.pointsNeeded} ${t('ptsLeft')}`}
            </span>
          </div>
          <p className={freeAccessProgress.unlocked ? 'worker-wallet-note' : 'worker-wallet-warning'}>
            {freeAccessProgress.message}
          </p>
          {!freeAccessProgress.unlocked && (
            <div className="worker-wallet-actions">
              <span>
                {t('keepJobsClean')}
              </span>
            </div>
          )}
        </section>

        {/* ─── Active Status ─── */}
        <section className={`worker-wallet-card ${walletSummary.dailyJobLimitActive ? 'restricted' : ''}`} aria-label="Worker wallet">
          <div className="worker-wallet-head">
            <div>
              <span className="worker-wallet-kicker">{t('walletAndDues')}</span>
              <h2>{t('platformFeeHealth')}</h2>
            </div>
            <span className={`worker-wallet-status ${walletSummary.platformFeeDue > 0 ? 'due' : 'clear'}`}>
              {walletSummary.repaymentState === 'Clear' ? t('clear') : walletSummary.repaymentState === 'Due' ? t('due') : walletSummary.repaymentState}
            </span>
          </div>

          <div className="worker-wallet-grid">
            <div>
              <span>{t('availableBalance')}</span>
              <strong>{formatInr(walletSummary.balance)}</strong>
            </div>
            <div>
              <span>{t('cashPlatformFeeDue')}</span>
              <strong>{formatInr(walletSummary.platformFeeDue)}</strong>
            </div>
            <div>
              <span>{t('jobAccessState')}</span>
              <strong>{walletSummary.dailyJobLimitActive ? t('limited') : t('normal')}</strong>
            </div>
          </div>

          {walletSummary.dailyJobLimitActive ? (
            <p className="worker-wallet-warning">
              {t('duesWarning')}
            </p>
          ) : (
            <p className="worker-wallet-note">
              {t('walletHealthy')}
            </p>
          )}

          <div className="worker-wallet-actions">
            <button
              type="button"
              onClick={() => {
                openPlatformFeePayment();
                addToast('Razorpay payment page opened. Admin will confirm repayment after payment.', 'success');
              }}
              disabled={walletSummary.platformFeeDue <= 0}
            >
              {t('payPlatformFee')}
            </button>
            <span>
              {t('recoveryNote')}
            </span>
          </div>
        </section>

        <section className="worker-wallet-card" aria-label="Worker payout withdrawal">
          <div className="worker-wallet-head">
            <div>
              <span className="worker-wallet-kicker">{t('workerPayout')}</span>
              <h2>{t('withdrawEarnings')}</h2>
            </div>
            <span className={`worker-wallet-status ${withdrawableAmount > 0 ? 'clear' : 'due'}`}>
              {withdrawableAmount > 0 ? t('ready') : t('waiting')}
            </span>
          </div>

          <div className="worker-wallet-grid">
            <div>
              <span>{t('readyForImps')}</span>
              <strong>{formatInr(withdrawableAmount)}</strong>
            </div>
            <div>
              <span>{t('eligibleJobs')}</span>
              <strong>{eligiblePayoutJobs.length}</strong>
            </div>
            <div>
              <span>{t('nextRelease')}</span>
              <strong>{nextEligibleAt ? nextEligibleAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : t('none')}</strong>
            </div>
          </div>

          <p className={withdrawableAmount > 0 ? 'worker-wallet-note' : 'worker-wallet-warning'}>
            {t('payoutHoldNote')}
          </p>

          <div className="worker-wallet-actions">
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={withdrawing || withdrawableAmount <= 0}
            >
              {withdrawing ? t('requesting') : t('withdrawByImps')}
            </button>
            <span>
              {t('bankAccountNote')}
            </span>
          </div>
        </section>

        <ActiveStatusButton
          onStatusChange={handleStatusChange}
          workerData={worker}
          devMode={Boolean(devWorker?.uid)}
        />

        <section className="worker-push-alerts" aria-label="Job offer alerts">
          <div>
            <strong>{t('jobOfferAlerts')}</strong>
            <span>
              {pushStatus === 'registered'
                ? t('alertsEnabled')
                : pushStatus === 'missing_vapid_key'
                  ? t('alertsWaiting')
                  : pushStatus === 'permission_denied'
                    ? t('alertsBlocked')
                    : t('alertsPrompt')}
            </span>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={enableOfferNotifications}
            disabled={pushStatus === 'requesting' || pushStatus === 'registered'}
          >
            {pushStatus === 'requesting' ? 'Enabling...' : pushStatus === 'registered' ? 'Enabled' : 'Enable alerts'}
          </button>
        </section>

        {queueOffers.length > 0 && (
          <section className="worker-queue-offers" aria-label="Smart Queue offers">
            <div className="worker-wallet-head">
              <div>
                <span className="worker-wallet-kicker">Smart Queue</span>
                <h2>New job offers</h2>
              </div>
              <span className="worker-wallet-status clear">{queueOffers.length}</span>
            </div>
            {queueOffers.map((offer) => {
              const expiry = toDate(offer.expiresAt);
              const busy = offerActionId === offer.id;
              const matchText = getOfferMatchText(offer);
              return (
                <div className="worker-queue-offer" key={offer.id}>
                  <div>
                    <strong>{String(offer.serviceId || 'Service').replace(/_/g, ' ')}</strong>
                    {offer.bargainStatus === 'pending' && (
                      <div style={{ margin: '4px 0 6px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 8px', fontSize: 11, fontWeight: 900, borderRadius: 8, background: 'rgba(252,211,77,0.25)', color: '#FCD34D', border: '1px dashed rgba(252,211,77,0.4)' }}>
                          🏷️ Proposes Discount Offer
                        </span>
                      </div>
                    )}
                    <span>{offer.areaId || 'Nearby area'}{offer.city ? `, ${offer.city}` : ''}</span>
                    {matchText && <span>{matchText}</span>}
                    <small>
                      Worker receives {formatInr(offer.workerReceivable || offer.finalConsumerPrice || 0)}
                      {offer.demandLevel ? ` · ${offer.demandLevel} demand` : ''}
                      {expiry ? ` · expires ${expiry.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </small>
                  </div>
                  <div className="worker-queue-actions">
                    <button type="button" className="btn-secondary" disabled={busy} onClick={() => handleQueueOfferResponse(offer, 'reject')}>
                      Skip
                    </button>
                    <button type="button" className="btn-primary" disabled={busy} onClick={() => handleQueueOfferResponse(offer, 'accept')}>
                      {busy ? 'Updating...' : 'Accept'}
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ═══ 1. IN-PROGRESS SERVICES — with workflow buttons ═══ */}
        {!jobsLoading && liveJobs.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <h3 className="section-title" style={{ fontSize: 16 }}>🔧 In-Progress Services</h3>
            {liveJobs.map(job => {
              const step = WORKFLOW_STEPS[job.status];
              const isUpdating = updatingJobId === job.id;
              return (
                <div key={job.id} className="worker-card live-job-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1F1144' }}>
                        {job.title || job.serviceType || 'Service'}
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
                        {job.area && <span>📍 {job.area}</span>}
                        {job.customerName && <span> · 👤 {job.customerName}</span>}
                      </div>
                    </div>
                    {/* Navigate icon */}
                    {(job.lat || job.locationLat || job.area) && (
                      <button
                        onClick={() => openDirections(job)}
                        title="Navigate"
                        className="icon-btn-navigate"
                      >
                        🧭
                      </button>
                    )}
                  </div>

                  {/* Workflow progress bar */}
                  <div className="workflow-progress">
                    <div className={`workflow-step ${job.status === 'assigned' || job.status === 'in_progress' ? 'done' : ''}`}>
                      <div className="workflow-dot" />
                      <span>Assigned</span>
                    </div>
                    <div className="workflow-line" />
                    <div className={`workflow-step ${job.status === 'in_progress' ? 'done' : ''}`}>
                      <div className="workflow-dot" />
                      <span>In Progress</span>
                    </div>
                    <div className="workflow-line" />
                    <div className="workflow-step">
                      <div className="workflow-dot" />
                      <span>Complete</span>
                    </div>
                  </div>

                  {/* Action button */}
                  {step && (
                    <LiveJobActionButton
                      job={job}
                      step={step}
                      isUpdating={isUpdating}
                      onUpdate={handleJobStatusUpdate}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ 2. UPCOMING WORK ═══ */}
        {!jobsLoading && futureJobs.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 className="section-title" style={{ margin: 0, fontSize: 16 }}>📅 Upcoming</h3>
              <Link to="/worker/future-work" style={{ fontSize: 12, color: '#7C3AED', textDecoration: 'none', fontWeight: 600 }}>
                View All →
              </Link>
            </div>
            {futureJobs.slice(0, 3).map(job => {
              const schedDate = job.scheduledAt ? new Date(job.scheduledAt) : null;
              return (
                <div key={job.id} className="worker-card" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1F1144', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {job.title || job.serviceType || 'Service'}
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        {schedDate
                          ? `${schedDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${schedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                          : 'Date TBD'
                        }
                        {job.area && ` · 📍 ${job.area}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {(job.lat || job.locationLat || job.area) && (
                        <button onClick={() => openDirections(job)} title="Navigate" className="icon-btn-navigate">
                          🧭
                        </button>
                      )}
                      <span style={{
                        background: job.status === 'confirmed' ? '#D1FAE5' : '#FEF3C7',
                        color: job.status === 'confirmed' ? '#065F46' : '#92400E',
                        padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700
                      }}>
                        {job.status === 'confirmed' ? '✅' : '⏳'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ 3. AVAILABLE SERVICES — nearby open jobs ═══ */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 className="section-title" style={{ margin: 0, fontSize: 16 }}>💼 Available Services</h3>
            <Link to="/worker/open-work" style={{ fontSize: 12, color: '#7C3AED', textDecoration: 'none', fontWeight: 600 }}>
              See All →
            </Link>
          </div>

          {jobsLoading ? (
            [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 14, marginBottom: 10 }} />)
          ) : nearbyJobs.length > 0 ? (
            nearbyJobs.slice(0, 5).map(job => {
              const aiAmount = getAiSuggestedAmount(job.budget || job.estimatedBudget || job.amount);
              return (
                <div key={job.id} className="worker-card" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1F1144' }}>
                        {job.title || job.serviceType || 'Service'}
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        {job.area && <span>📍 {job.area}</span>}
                      </div>
                      {/* AI Suggested Amount — 25% less than user's budget */}
                      <div style={{ fontSize: 13, marginTop: 5 }}>
                        {aiAmount ? (
                          <span style={{ color: '#7C3AED', fontWeight: 700 }}>
                            🤖 AI suggests ₹{aiAmount.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span style={{ color: '#9CA3AF' }}>🤖 Quote on request</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, marginLeft: 10 }}>
                      <button
                        className="btn-primary"
                        style={{ padding: '8px 14px', fontSize: 12, minWidth: 'auto', width: 'auto', whiteSpace: 'nowrap' }}
                        onClick={() => setSelectedJob(job)}
                      >
                        Send Quote
                      </button>
                      {(job.lat || job.locationLat || job.area) && (
                        <button onClick={() => openDirections(job)} className="icon-btn-navigate" style={{ alignSelf: 'center' }}>
                          🧭
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: '#6B7280' }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>📭</div>
              <div style={{ fontSize: 13 }}>No open services around you right now</div>
            </div>
          )}
        </div>

        {/* Worker Location Tracker */}
        <WorkerLocationTracker />

        {/* Fixed Day Rate */}
        <WorkerFixedRateForm workerData={worker} />

        {/* Quick Access */}
        <h3 className="section-title" style={{ fontSize: 16 }}>⚡ Quick Access</h3>
        <div className="nav-cards-grid">
          {NAV_CARDS.map(card => (
            <Link key={card.to} to={card.to} className="nav-card">
              <span className="nav-card-icon">{card.icon}</span>
              <span className="nav-card-label">{card.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Quote Modal */}
      {selectedJob && (
        <QuoteModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onSubmit={handleSendQuote}
        />
      )}

      {startProofJob && (
        <StartWorkProofModal
          job={startProofJob}
          onClose={() => setStartProofJob(null)}
          onStarted={() => handleStartProofCompleted(startProofJob)}
        />
      )}

      {completingJob && (
        <CompleteJobModal
          job={completingJob}
          onClose={() => setCompletingJob(null)}
          onCompleted={() => {
            setLiveJobs(prev => prev.filter(j => j.id !== completingJob.id));
            setCompletingJob(null);
            showToast('Completion photo uploaded. Waiting for consumer confirmation.', 'success');
          }}
        />
      )}

      <WorkerBottomNav />
    </div>
    </WorkerLocationProvider>
  );
}
