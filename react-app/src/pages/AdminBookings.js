/**
 * ADMIN BOOKINGS PANEL - CORE WORKFLOW MANAGEMENT
 * 
 * This page allows Region Leads and SuperAdmins to:
 * 1. Assign workers to pending requests
 * 2. Track real-time progress (Start work, Mark finished)
 * 3. Manage Disputes with a 24h escalation timer
 * 4. Log site visits and customer calls for resolution
 * 5. Track daily job progress with notes and photos
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  collection, onSnapshot, doc, getDoc, updateDoc,
  query, where, orderBy, serverTimestamp
} from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functionsInstance } from '../firebase';
import { calculateFinalPrice } from '../utils/pricing';
import { submitQuote as buildBookingWithQuote } from '../utils/bookingWorkflow';

// Status colors to give admins quick visual cues about the load
const STATUS_COLORS = {
  pending: '#ff9800',                // Orange: Waiting for Region Lead attention
  scheduled: '#0ea5e9',              // Sky blue: Future dated jobs
  assigned: '#2196f3',               // Blue: Worker assigned, travel/prep phase
  in_progress: '#9c27b0',            // Purple: Work currently happening on site
  awaiting_confirmation: '#f44336',  // Red: Finished by worker, waiting for customer OK
  completed: '#4caf50',              // Green: Job closed successfully
  cancelled: '#757575',              // Gray: Job terminated
  quoted: '#6366f1',                 // Indigo: Price sent to user
  accepted: '#ec4899',               // Pink: User agreed to price
};

// All statuses that require active attention from admins
const ACTIVE_STATUSES = ['pending', 'scheduled', 'quoted', 'accepted', 'assigned', 'in_progress', 'awaiting_confirmation'];
const USE_FREE_PLAN_MODE = true;

const QUOTE_PRESETS = {
  plumber: [
    { key: 'leak', label: 'Leak Fix', amount: 500 },
    { key: 'tap', label: 'Tap/Fitting Replace', amount: 700 },
    { key: 'line', label: 'Pipeline Work', amount: 1200 },
  ],
  electrician: [
    { key: 'switch', label: 'Switch/Board Repair', amount: 600 },
    { key: 'wiring', label: 'Wiring Fix', amount: 1400 },
    { key: 'fixture', label: 'Fixture Installation', amount: 900 },
  ],
  carpenter: [
    { key: 'door', label: 'Door Repair', amount: 800 },
    { key: 'furniture', label: 'Furniture Repair', amount: 1300 },
    { key: 'modular', label: 'Modular Work', amount: 1800 },
  ],
  painter: [
    { key: 'patch', label: 'Patch Work', amount: 700 },
    { key: 'single_room', label: 'Single Room Paint', amount: 2500 },
    { key: 'full_home', label: 'Full Home Paint', amount: 9000 },
  ],
};

const normalizeServiceType = (type) => {
  if (!type) return '';
  return type.trim().toLowerCase()
    .replace(/electrican/i, 'electrician')
    .replace(/plummer/i, 'plumber')
    .replace(/carpanter/i, 'carpenter');
};

const getStatusTimestamp = (booking) => {
  const statusAt = booking?.statusUpdatedAt || booking?.updatedAt || booking?.createdAt;
  if (!statusAt) return null;
  return statusAt.toDate ? statusAt.toDate() : new Date(statusAt);
};

const getStatusAgeHours = (booking) => {
  const ts = getStatusTimestamp(booking);
  if (!ts) return 0;
  return (Date.now() - ts.getTime()) / (1000 * 60 * 60);
};

export default function AdminBookings() {
  /* ──────────────────────────────────────────────────────────────────────────
     STATE MANAGEMENT
     ────────────────────────────────────────────────────────────────────────── */
  const [bookings, setBookings] = useState([]);        // Real-time stream of all bookings
  const [workers, setWorkers] = useState([]);          // Real-time stream of region's workers
  const [filter, setFilter] = useState('active');      // Current view filter
  const [noteId, setNoteId] = useState(null);          // ID of booking currently being "noted"
  const [noteText, setNoteText] = useState('');        // Temporary note content
  const [uploading, setUploading] = useState({});      // Loading states for photo uploads
  const [logMap, setLogMap] = useState({});            // Cache for activity log history
  const [openLog, setOpenLog] = useState(null);        // ID of booking whose log is expanded
  const [callLogId, setCallLogId] = useState(null);    // ID for call logging modal
  const [callNotes, setCallNotes] = useState('');      // Notes from the customer phone call
  const [disputeDecisions, setDisputeDecisions] = useState({}); // Tracking selected resolution types
  const [quotes, setQuotes] = useState({});            // Temporary quote prices being entered
  const [quotePresets, setQuotePresets] = useState({});
  const [quoteAddons, setQuoteAddons] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [workerFilter, setWorkerFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDelayedOnly, setShowDelayedOnly] = useState(false);
  const [autoAssigningBookingIds, setAutoAssigningBookingIds] = useState({});
  const fileInputRefs = useRef({});                    // Dynamic refs for hidden file inputs
  const [isSuperAdmin, setIsSuperAdmin] = useState(false); // Role check for permissions
  const [adminRole, setAdminRole] = useState('admin'); // admin/mason/regionLead/superadmin
  const [childAdminIds, setChildAdminIds] = useState([]); // For regionLead area monitoring
  const [readError, setReadError] = useState('');      // Firestore read errors for troubleshooting
  const [isIndependentWorker, setIsIndependentWorker] = useState(false); // Independent worker check (no adminId)

  const uid = auth.currentUser?.uid;

  /* ──────────────────────────────────────────────────────────────────────────
     ROLE CHECK - Determine if current user is SuperAdmin
     ────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!uid) return;
    let unsubChildren = () => {};
    const checkRole = async () => {
      const adminDoc = await getDoc(doc(db, 'admins', uid));
      if (adminDoc.exists()) {
        const role = adminDoc.data()?.role || 'admin';
        setAdminRole(role);
        setIsSuperAdmin(role === 'superadmin');

        // Check if this is an independent worker (role='worker' with no adminId in gig_workers)
        if (role === 'worker') {
          const workerDoc = await getDoc(doc(db, 'gig_workers', uid));
          if (workerDoc.exists()) {
            const workerData = workerDoc.data();
            const hasNoAdmin = !workerData.adminId || workerData.adminId === '' || workerData.adminId === null;
            setIsIndependentWorker(hasNoAdmin);
          }
        }

        if (role === 'regionLead') {
          unsubChildren = onSnapshot(
            query(collection(db, 'admins'), where('parentAdminId', '==', uid)),
            snap => {
              setChildAdminIds(snap.docs.map(d => d.id));
            },
            (err) => {
              setChildAdminIds([]);
            }
          );
        } else {
          setChildAdminIds([]);
        }
      } else {
        /* admin document not found */
      }
    };
    checkRole().catch(() => { /* checkRole error */ });
    return () => unsubChildren();
  }, [uid]);

  /* ──────────────────────────────────────────────────────────────────────────
     REAL-TIME LISTENERS
     ────────────────────────────────────────────────────────────────────────── */

  // Listen to bookings with rule-safe queries.
  // Regular admins read open bookings + their assigned bookings; SuperAdmin reads all.
  useEffect(() => {
    if (!uid) return;

    setReadError('');
    if (isSuperAdmin) {
      const unsubAll = onSnapshot(
        query(collection(db, 'bookings'), orderBy('createdAt', 'desc')),
        snap => {
          setReadError('');
          setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        },
        (err) => {
          setReadError(err?.message || 'Unable to load bookings.');
        }
      );
      return unsubAll;
    }

    let openDocs = [];
    let myDocs = [];

    const mergeAndSet = () => {
      let merged = [...openDocs, ...myDocs];
      
      // GOVERNANCE RULE: Masons only see bookings matching their gig types
      if (adminRole === 'admin' || adminRole === 'mason') {
        const gigTypes = [...new Set(workers.map(w => w.gigType).filter(Boolean))];
        
        if (gigTypes.length > 0) {
          // Normalize both booking service types and gig types for comparison
          const normalizeType = (type) => {
            if (!type) return '';
            return type.trim().toLowerCase()
              .replace(/electrican/i, 'electrician')
              .replace(/plummer/i, 'plumber')
              .replace(/carpanter/i, 'carpenter');
          };
          
          const normalizedGigTypes = gigTypes.map(normalizeType);
          
          merged = merged.filter(b => {
            const isMyBooking = b.adminId === uid;
            const matchesGigType = normalizedGigTypes.includes(normalizeType(b.serviceType));
            const shouldShow = isMyBooking || matchesGigType;
            
            if (!shouldShow && b.status === 'pending') {
              // filtered out: not in mason gig types
            }
            
            return shouldShow;
          });
        } else {
          merged = merged.filter(b => b.adminId === uid);
        }
      }
      
      const byId = new Map();
      merged.forEach(item => byId.set(item.id, item));
      const unique = Array.from(byId.values());
      unique.sort((a, b) => {
        const aTs = a?.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTs = b?.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTs - aTs;
      });
      setBookings(unique);
    };

    const unsubOpen = onSnapshot(
      query(collection(db, 'bookings'), where('status', 'in', ['pending', 'scheduled', 'quoted'])),
      snap => {
        setReadError('');
        openDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        mergeAndSet();
      },
      (err) => {
        setReadError(err?.message || 'Unable to load open bookings.');
      }
    );

    const unsubMine = onSnapshot(
      query(collection(db, 'bookings'), where('adminId', '==', uid)),
      snap => {
        setReadError('');
        myDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        mergeAndSet();
      },
      (err) => {
        setReadError(err?.message || 'Unable to load your bookings.');
      }
    );

    const unsubsChildren = [];
    if (adminRole === 'regionLead' && childAdminIds.length > 0) {
      childAdminIds.forEach((childId) => {
        const unsubChild = onSnapshot(
          query(collection(db, 'bookings'), where('adminId', '==', childId)),
          snap => {
            const childDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            myDocs = [...myDocs.filter(b => b.adminId !== childId), ...childDocs];
            mergeAndSet();
          },
          (err) => {
            /* error loading child admin bookings */
          }
        );
        unsubsChildren.push(unsubChild);
      });
    } else if (adminRole === 'regionLead') {
      /* region lead has no child admins assigned */
    }

    return () => {
      unsubOpen();
      unsubMine();
      unsubsChildren.forEach(fn => fn());
    };
  }, [uid, isSuperAdmin, adminRole, childAdminIds]);

  // Listen to workers - admin only sees their own workers (unless SuperAdmin)
  useEffect(() => {
    if (!uid) return;
    const handleApprovedWorkers = (allWorkers) => {
      const approvedWorkers = allWorkers.filter(w => !w.approvalStatus || w.approvalStatus === 'approved');

      setWorkers(approvedWorkers);

      if (isSuperAdmin) {
        /* superadmin sees all workers */
      } else if (adminRole === 'regionLead') {
        /* region lead sees area workers */
      } else {
        const gigTypes = [...new Set(approvedWorkers.map(w => w.gigType).filter(Boolean))];
        /* mason gig types loaded */
      }
    };

    const handleWorkerError = () => {
      /* workers query error handled silently */
    };

    if (isSuperAdmin) {
      const unsub = onSnapshot(
        query(collection(db, 'gig_workers')),
        snap => handleApprovedWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        handleWorkerError
      );
      return unsub;
    }

    if (adminRole === 'regionLead') {
      if (childAdminIds.length === 0) {
        setWorkers([]);
        return () => {};
      }

      const byAdminId = {};
      const mergeWorkers = () => {
        handleApprovedWorkers(Object.values(byAdminId).flat());
      };

      const unsubs = childAdminIds.map((childId) => onSnapshot(
        query(collection(db, 'gig_workers'), where('adminId', '==', childId)),
        (snap) => {
          byAdminId[childId] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          mergeWorkers();
        },
        handleWorkerError
      ));

      return () => unsubs.forEach((fn) => fn());
    }

    const unsub = onSnapshot(
      query(collection(db, 'gig_workers'), where('adminId', '==', uid)),
      snap => handleApprovedWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      handleWorkerError
    );
    return unsub;
  }, [uid, isSuperAdmin, adminRole, childAdminIds]);

  /* ──────────────────────────────────────────────────────────────────────────
     CORE ACTIONS & LOGIC
     ────────────────────────────────────────────────────────────────────────── */

  /**
   * Fetches the activity history for a specific booking.
   * Redirects/Displays: Expanded log view in the UI card.
   */
  const openActivityLog = (bookingId) => {
    setOpenLog(bookingId);
    if (logMap[bookingId]) return;
    const unsub = onSnapshot(
      query(
        collection(db, 'activity_logs'),
        where('bookingId', '==', bookingId),
        orderBy('timestamp', 'desc')
      ),
      snap => {
        const entries = snap.docs.map(d => d.data());
        setLogMap(prev => ({ ...prev, [bookingId]: entries }));
      }
    );
    return unsub;
  };

  /**
   * Universal Backend Caller
   */
  const runSparkFallback = async (method, data) => {
    if (!uid) throw new Error('Not authenticated');

    if (method === 'submitQuote') {
      const { bookingId, price } = data;
      const bookingRef = doc(db, 'bookings', bookingId);
      const snap = await getDoc(bookingRef);
      if (!snap.exists()) throw new Error('Booking not found');
      const booking = snap.data();

      const adminDoc = await getDoc(doc(db, 'admins', uid));
      const adminName = adminDoc.exists() ? (adminDoc.data().name || adminDoc.data().email || 'Admin') : 'Admin';
      const bookingWithQuote = buildBookingWithQuote(booking, {
        adminId: uid,
        adminName,
        basePrice: Number(price),
      });
      const latestQuote = bookingWithQuote.quotes[bookingWithQuote.quotes.length - 1];
      latestQuote.createdAt = new Date();

      // Don't change status to 'quoted' - keep it open for other masons to submit quotes
      // Status will only change when user accepts a quote
      await updateDoc(bookingRef, {
        quotes: bookingWithQuote.quotes,
        // status remains 'pending' or 'scheduled' so other masons can still see and quote
        updatedAt: new Date(),
      });
      return;
    }

    if (method === 'updateBookingStatus') {
      const { bookingId, action, extraArgs = {} } = data;
      const bookingRef = doc(db, 'bookings', bookingId);
      const snap = await getDoc(bookingRef);
      if (!snap.exists()) throw new Error('Booking not found');
      const booking = snap.data();

      const base = { updatedAt: new Date() };

      if (action === 'admin_assign_worker') {
        const { workerId, workerName, workerPhone } = extraArgs;
        await updateDoc(bookingRef, {
          ...base,
          status: 'assigned',
          statusUpdatedAt: new Date(),
          adminId: uid,
          assignedWorkerId: workerId,
          workerName,
          workerPhone,
          assignedWorker: workerName,
        });
        return;
      }

      if (action === 'admin_start_work') {
        await updateDoc(bookingRef, {
          ...base,
          status: 'in_progress',
          statusUpdatedAt: new Date(),
          startedAt: new Date(),
          adminId: booking.adminId || uid,
        });
        return;
      }

      if (action === 'admin_mark_finished') {
        const estimatedDays = Number(booking.estimatedDays || 1);
        const completedWorkDays = Number(booking.completedWorkDays || 0);
        const nextCompletedDays = completedWorkDays + 1;
        const remainingWorkDays = Math.max(estimatedDays - nextCompletedDays, 0);

        if (remainingWorkDays > 0) {
          await updateDoc(bookingRef, {
            ...base,
            status: 'in_progress',
            completedWorkDays: nextCompletedDays,
            remainingWorkDays,
            statusUpdatedAt: new Date(),
            adminId: booking.adminId || uid,
          });
        } else {
          await updateDoc(bookingRef, {
            ...base,
            status: 'awaiting_confirmation',
            completedWorkDays: nextCompletedDays,
            remainingWorkDays: 0,
            statusUpdatedAt: new Date(),
            finishedAt: new Date(),
            adminId: booking.adminId || uid,
          });
        }
        return;
      }

      if (action === 'admin_cancelled') {
        await updateDoc(bookingRef, { ...base, status: 'cancelled', statusUpdatedAt: new Date(), adminId: booking.adminId || uid });
        return;
      }

      if (action === 'admin_reopen_booking') {
        await updateDoc(bookingRef, {
          ...base,
          status: 'pending',
          statusUpdatedAt: new Date(),
          adminId: null,
          assignedWorkerId: null,
          workerName: null,
          workerPhone: null,
          assignedWorker: null,
          acceptedQuote: null,
        });
        return;
      }

      if (action === 'admin_resolve_dispute') {
        await updateDoc(bookingRef, {
          ...base,
          'dispute.status': 'resolved',
          'dispute.decision': extraArgs.decision,
          'dispute.resolvedBy': uid,
          'dispute.resolutionTime': new Date(),
          adminId: booking.adminId || uid,
        });
        return;
      }

      if (action === 'admin_log_call') {
        await updateDoc(bookingRef, {
          ...base,
          'dispute.regionCallTime': new Date(),
          'dispute.callNotes': extraArgs.callNotes || '',
          adminId: booking.adminId || uid,
        });
        return;
      }

      if (action === 'admin_log_visit') {
        await updateDoc(bookingRef, {
          ...base,
          'dispute.visitTime': new Date(),
          adminId: booking.adminId || uid,
        });
        return;
      }

      if (action === 'admin_add_note') {
        const existing = booking.dailyNotes || [];
        const next = [...existing, { date: new Date().toLocaleDateString('en-IN'), note: extraArgs.note || '' }];
        await updateDoc(bookingRef, { ...base, dailyNotes: next, adminId: booking.adminId || uid });
        return;
      }

      if (action === 'admin_upload_photo') {
        const existing = booking.photos || [];
        const next = [...existing, { label: extraArgs.label, url: extraArgs.url, uploadedAt: new Date() }];
        await updateDoc(bookingRef, { ...base, photos: next, adminId: booking.adminId || uid });
        return;
      }
    }

    throw new Error(`Spark fallback not implemented for ${method}`);
  };

  const callBackend = async (method, data) => {
    if (USE_FREE_PLAN_MODE) {
      try {
        await runSparkFallback(method, data);
      } catch (fallbackErr) {
        alert('Action failed: ' + fallbackErr.message);
      }
      return;
    }

    try {
      const func = httpsCallable(functionsInstance, method);
      await func(data);
    } catch (e) {
      // Spark plan cannot deploy callable functions that require Cloud Build.
      try {
        await runSparkFallback(method, data);
      } catch (fallbackErr) {
        alert('Action failed: ' + (fallbackErr.message || e.message));
      }
    }
  };

  const getRecommendedWorker = (booking, availableWorkers) => {
    if (!availableWorkers || availableWorkers.length === 0) return null;
    const desiredType = normalizeServiceType(booking.serviceType);

    const ranked = [...availableWorkers].map((w) => {
      const ratingScore = Number(w.rating || 0) * 100;
      const utilizationPenalty = Number(w.completedJobs || 0);
      const serviceBonus = normalizeServiceType(w.gigType) === desiredType ? 25 : 0;
      return { worker: w, score: ratingScore + serviceBonus - utilizationPenalty };
    }).sort((a, b) => b.score - a.score);

    return ranked[0]?.worker || null;
  };

  useEffect(() => {
    if (!uid) return;
    const editableRoles = ['admin', 'mason', 'superadmin'];
    if (!editableRoles.includes(adminRole)) return;

    const acceptedMine = bookings.filter((b) => b.status === 'accepted' && b.adminId === uid && !b.assignedWorkerId);
    acceptedMine.forEach((b) => {
      if (autoAssigningBookingIds[b.id]) return;
      const busyWorkerIds = bookings
        .filter((bk) => ['assigned', 'in_progress'].includes(bk.status) && bk.id !== b.id)
        .map((bk) => bk.assignedWorkerId);

      const availableWorkers = workers.filter((w) => {
        const matchesService = normalizeServiceType(w.gigType) === normalizeServiceType(b.serviceType);
        return w.status === 'active' && !w.isFraud && !busyWorkerIds.includes(w.id) && matchesService;
      });

      const pick = getRecommendedWorker(b, availableWorkers);
      if (!pick) return;

      setAutoAssigningBookingIds((prev) => ({ ...prev, [b.id]: true }));
      assignWorker(b, pick.id)
        .catch(() => { /* auto-assignment failed */ })
        .finally(() => {
          setAutoAssigningBookingIds((prev) => {
            const next = { ...prev };
            delete next[b.id];
            return next;
          });
        });
    });
  }, [bookings, workers, uid, adminRole]);

  /**
   * Action: Assing a specific worker to a pending request.
   * Transitions: pending -> assigned.
   */
  const assignWorker = async (b, workerId) => {
    if (!workerId) return;
    const worker = workers.find(w => w.id === workerId);
    
    if (!worker) {
      alert('Worker not found');
      return;
    }
    
    const workerPhone = worker.contact || worker.phone || '';
    
    if (!workerPhone) {
      alert('⚠️ Worker has no phone number. Please update worker details first.');
      return;
    }
    
    await callBackend('updateBookingStatus', {
      bookingId: b.id,
      action: 'admin_assign_worker',
      extraArgs: { workerId, workerName: worker.name, workerPhone }
    });
  };

  /**
   * Action: Signal that work has started at the site.
   * Transitions: assigned -> in_progress.
   */
  const startWork = async (b) => {
    await callBackend('updateBookingStatus', { bookingId: b.id, action: 'admin_start_work' });
  };

  /**
   * Action: Worker has finished; service enters consumer-confirmation phase.
   * Transitions: in_progress -> awaiting_confirmation.
   */
  const markFinished = async (b) => {
    await callBackend('updateBookingStatus', { bookingId: b.id, action: 'admin_mark_finished' });
  };

  /**
   * Action: Cancels or Reopens a booking.
   * LOGIC: If job was active, it returns to 'pending' to be re-assigned.
   */
  const cancelBooking = async (b) => {
    if (['assigned', 'in_progress', 'awaiting_confirmation'].includes(b.status)) {
      await callBackend('updateBookingStatus', { bookingId: b.id, action: 'admin_reopen_booking' });
    } else {
      await callBackend('updateBookingStatus', { bookingId: b.id, action: 'admin_cancelled' });
    }
  };

  /**
   * Action: Closes a dispute with a final decision.
   * LOGIC: Impacts escrow release (handled by backend triggers).
   */
  const resolveDispute = async (b) => {
    const decision = disputeDecisions[b.id];
    if (!decision) {
      alert('Select a decision type first.');
      return;
    }
    await callBackend('updateBookingStatus', { bookingId: b.id, action: 'admin_resolve_dispute', extraArgs: { decision } });
    setDisputeDecisions(prev => { const n = { ...prev }; delete n[b.id]; return n; });
    alert('Dispute resolved: ' + decision);
  };

  /**
   * Action: Record notes from a verification call with the customer.
   * Governance: Required for 1-star auto-disputes.
   */
  const submitCallLog = async (bookingId) => {
    if (!callNotes.trim()) return;
    await callBackend('updateBookingStatus', { bookingId, action: 'admin_log_call', extraArgs: { callNotes: callNotes.trim() } });
    setCallLogId(null);
    setCallNotes('');
  };

  /**
   * Action: Record a physical visit to the dispute site.
   */
  const submitVisitLog = async (bookingId) => {
    await callBackend('updateBookingStatus', { bookingId, action: 'admin_log_visit' });
  };

  /**
   * Action: Add text notes to the job's progress timeline.
   */
  const submitNote = async (bookingId) => {
    if (!noteText.trim()) return;
    await callBackend('updateBookingStatus', { bookingId, action: 'admin_add_note', extraArgs: { note: noteText.trim() } });
    setNoteId(null);
    setNoteText('');
  };

  /**
   * Action: Upload Before/Progress/After photos to Firebase Storage.
   */
  const uploadPhoto = async (bookingId, label, file) => {
    if (!file) return;
    setUploading(prev => ({ ...prev, [bookingId]: true }));
    try {
      const storage = getStorage();
      const path = `bookings/${bookingId}/${label}_${Date.now()}`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);

      await callBackend('updateBookingStatus', { bookingId, action: 'admin_upload_photo', extraArgs: { label, url } });
    } catch (e) {
      alert('Upload failed.');
    } finally {
      setUploading(prev => ({ ...prev, [bookingId]: false }));
    }
  };

  /**
   * Helper: Calculate remaining time before a dispute is auto-escalated.
   * Governance: Region Leads have 24 hours to resolve disputes before penalty.
   */
  const getEscalationInfo = (dispute) => {
    if (!dispute?.raisedAt || dispute.status !== 'open') return null;
    const raisedAt = dispute.raisedAt.toDate ? dispute.raisedAt.toDate() : new Date(dispute.raisedAt);
    const now = new Date();
    const hoursElapsed = (now - raisedAt) / (1000 * 60 * 60);
    const hoursRemaining = 24 - hoursElapsed;
    return {
      hoursElapsed: Math.round(hoursElapsed * 10) / 10,
      hoursRemaining: Math.max(0, Math.round(hoursRemaining * 10) / 10),
      isOverdue: hoursElapsed >= 24,
      isEscalated: dispute.escalationStatus === true,
    };
  };

  /**
   * Action: Admin sets a price quote for the job.
   * Logic: Appends to a "quotes" array so multiple admins can bid.
   * Pricing: Automatically adds 15% platform fee + 2% payment charges to base amount.
   */
  const setPriceQuote = async (bookingId) => {
    const enteredBase = Number(quotes[bookingId] || 0);
    const addonAmount = Number(quoteAddons[bookingId] || 0);
    const basePrice = enteredBase + addonAmount;
    if (!basePrice || isNaN(basePrice) || basePrice <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    // Calculate final price with platform fee (15%) and payment charges (2%)
    const pricing = calculateFinalPrice(basePrice);
    const confirmMsg = `Submit quote with following breakdown?\n\nBase Amount: ₹${pricing.baseAmount}\nPlatform Fee (15%): ₹${pricing.platformFee}\nPayment Charges (2%): ₹${pricing.paymentCharge}\n\n════════════════════\nFinal Total for Customer: ₹${pricing.finalTotal}\n\nYou will receive: ₹${pricing.baseAmount}`;
    
    if (!window.confirm(confirmMsg)) {
      return;
    }

    // Store both base price and final price in quote
    await callBackend('submitQuote', { 
      bookingId, 
      price: Number(basePrice),
      finalPrice: Number(pricing.finalTotal),
      pricing: pricing
    });
    
    setQuotes(prev => { const n = { ...prev }; delete n[bookingId]; return n; });
    setQuoteAddons(prev => { const n = { ...prev }; delete n[bookingId]; return n; });
    setQuotePresets(prev => { const n = { ...prev }; delete n[bookingId]; return n; });
    alert('Quote sent! User will be notified with final price: ₹' + pricing.finalTotal);
  };

  /* ──────────────────────────────────────────────────────────────────────────
     UI RENDER LOGIC
     ────────────────────────────────────────────────────────────────────────── */
  const shown = bookings.filter(b => {
    if (filter === 'active') return ACTIVE_STATUSES.includes(b.status);
    if (filter === 'completed') return b.status === 'completed';
    if (filter === 'cancelled') return b.status === 'cancelled';
    if (filter === 'disputes') return b.dispute?.status === 'open';
    if (filter === 'quoted') return b.status === 'quoted' || (b.quotes?.length > 0 && b.status === 'pending');
    if (filter === 'escalated') return b.dispute?.escalationStatus === true && b.dispute?.status === 'open';
    if (filter === 'delayed') return getStatusAgeHours(b) >= 24 || b.sla?.breached;
    return true;
  }).filter((b) => {
    const text = searchTerm.trim().toLowerCase();
    if (!text) return true;
    const searchableFields = [
      b.id,
      b.customerName,
      b.address,
      b.serviceType,
      b.workerName,
      b.assignedWorker,
      b.status,
      ...(adminRole === 'mason' ? [] : [b.phone]),
    ];
    return searchableFields.some((value) => (value || '').toString().toLowerCase().includes(text));
  }).filter((b) => {
    if (serviceFilter === 'all') return true;
    return normalizeServiceType(b.serviceType) === normalizeServiceType(serviceFilter);
  }).filter((b) => {
    if (workerFilter === 'all') return true;
    return (b.assignedWorkerId || '') === workerFilter;
  }).filter((b) => {
    if (!showDelayedOnly) return true;
    return getStatusAgeHours(b) >= 24 || b.sla?.breached;
  }).filter((b) => {
    if (!dateFrom && !dateTo) return true;
    const dt = getStatusTimestamp(b);
    if (!dt) return false;
    const fromOk = !dateFrom || dt >= new Date(`${dateFrom}T00:00:00`);
    const toOk = !dateTo || dt <= new Date(`${dateTo}T23:59:59`);
    return fromOk && toOk;
  });

  const uniqueServices = Array.from(new Set(bookings.map((b) => b.serviceType).filter(Boolean)));

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ fontSize: '24px', marginBottom: '20px', color: '#333' }}>📋 Booking Management</h2>

      {readError && (
        <div style={{
          background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca',
          borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '13px'
        }}>
          {readError}
        </div>
      )}

      {adminRole === 'regionLead' && (
        <div style={{
          background: '#f0f9ff', color: '#0369a1', border: '2px solid #0ea5e9',
          borderRadius: '8px', padding: '12px', marginBottom: '14px', fontSize: '12px', fontWeight: 'bold'
        }}>
          🌐 Region Lead Dashboard | Child Admins: {childAdminIds.length || '❌ NONE ASSIGNED'} | Bookings Loaded: {bookings.length}
        </div>
      )}

      {/* FILTER BUTTONS: Redirects the view state but not the URL */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { key: 'active', label: 'Active', color: '#f59e0b' },
          { key: 'completed', label: 'Completed', color: '#10b981' },
          { key: 'cancelled', label: 'Cancelled', color: '#6b7280' },
          { key: 'disputes', label: '🚨 Disputes', color: '#dc2626' },
          { key: 'quoted', label: '💰 Quoted', color: '#6366f1' },
          { key: 'escalated', label: '⏰ Escalated', color: '#7c3aed' },
          { key: 'delayed', label: '🕒 Delayed >24h', color: '#ef4444' },
          { key: 'all', label: 'All', color: '#667eea' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            style={{
              padding: '8px 16px', background: filter === tab.key ? tab.color : '#f3f4f6',
              color: filter === tab.key ? 'white' : '#333', border: 'none', borderRadius: '20px', cursor: 'pointer',
              fontWeight: 'bold', fontSize: '13px'
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', marginBottom: '16px' }}>
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={adminRole === 'mason' ? 'Search by booking, customer, address...' : 'Search by booking, customer, phone, address...'}
          style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '8px' }}
        />
        <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '8px' }}>
          <option value="all">All Services</option>
          {uniqueServices.map((svc) => <option key={svc} value={svc}>{svc}</option>)}
        </select>
        <select value={workerFilter} onChange={(e) => setWorkerFilter(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '8px' }}>
          <option value="all">All Workers</option>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
      </div>

      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '13px' }}>
        <input type="checkbox" checked={showDelayedOnly} onChange={(e) => setShowDelayedOnly(e.target.checked)} />
        Show only delayed bookings (&gt;24h in same status)
      </label>

      {shown.map(b => {
        // LOGIC: Filter workers based on gig type AND availability for this booking ID
        const busyWorkerIds = bookings.filter(bk => ['assigned', 'in_progress'].includes(bk.status) && bk.id !== b.id).map(bk => bk.assignedWorkerId);
        
        const bookingServiceType = normalizeServiceType(b.serviceType);
        const availableWorkers = workers.filter(w => {
          const workerGigType = normalizeServiceType(w.gigType);
          const isMatch = w.status === 'active' && !busyWorkerIds.includes(w.id) && !w.isFraud && bookingServiceType === workerGigType;
          return isMatch;
        });
        
        const escalation = getEscalationInfo(b.dispute);

        return (
          <div key={b.id} style={{
            background: 'white', border: `2px solid ${b.dispute?.escalationStatus ? '#7c3aed' : STATUS_COLORS[b.status] || '#ddd'}`,
            borderRadius: '12px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            {/* BOOKING HEADER & MAP LINK */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                  {['pending', 'scheduled', 'quoted'].includes(b.status)
                    ? `${b.serviceType} — 📍 Work Available at this location`
                    : `${b.serviceType} — ${b.customerName}`}
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  {['pending', 'scheduled', 'quoted'].includes(b.status) ? (
                    <>
                      📍 Location:
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`}
                        target="_blank" rel="noreferrer" style={{ color: '#2196f3', textDecoration: 'none', marginLeft: '4px' }}>
                        {b.address} ↗
                      </a>
                    </>
                  ) : adminRole === 'mason' ? (
                    <>
                      📍 Location:
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`}
                        target="_blank" rel="noreferrer" style={{ color: '#2196f3', textDecoration: 'none', marginLeft: '4px' }}>
                        {b.address} ↗
                      </a>
                    </>
                  ) : (
                    <>
                      📞 {b.phone} | 📍
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`}
                        target="_blank" rel="noreferrer" style={{ color: '#2196f3', textDecoration: 'none', marginLeft: '4px' }}>
                        {b.address} ↗
                      </a>
                    </>
                  )}
                </div>
                {Number(b.estimatedDays || 1) > 1 && (
                  <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '4px' }}>
                    Multi-day job: {Number(b.completedWorkDays || 0)}/{Number(b.estimatedDays || 1)} days completed, {Number(b.remainingWorkDays || b.estimatedDays || 1)} day(s) left
                  </div>
                )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ padding: '4px 10px', background: STATUS_COLORS[b.status], color: 'white', borderRadius: '20px', fontSize: '10px', fontWeight: 'bold' }}>
                {b.status.toUpperCase()}
              </span>
            </div>
          </div>

            {/* USER REQUESTED PHOTOS */}
            {b.requestedPhotos?.length > 0 && (
              <div style={{ marginBottom: '12px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>📸 User Requested Photos:</div>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {b.requestedPhotos.map((p, i) => (
                    <a key={p.url || i} href={p.url} target="_blank" rel="noreferrer">
                      <img src={p.url} alt={`User request photo ${i + 1}`} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* ESCALATION TIMER: Informs admin of urgency */}
            {escalation && !escalation.isEscalated && (
              <div style={{ padding: '8px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>
                ⏱️ Dispute resolution window: <strong>{escalation.hoursRemaining}h left</strong> before penalty.
              </div>
            )}

            {/* ACTION BUTTONS: Drive the backend triggers */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {/* Show quote UI for bookings that haven't been accepted yet - includes 'pending', 'scheduled', and 'quoted' statuses */}
              {(b.status === 'pending' || b.status === 'scheduled' || b.status === 'quoted') && (adminRole === 'admin' || adminRole === 'mason' || (adminRole === 'worker' && isIndependentWorker)) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>💰 Submit Bid</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select
                      value={quotePresets[b.id] || ''}
                      onChange={(e) => {
                        const presetKey = e.target.value;
                        setQuotePresets(prev => ({ ...prev, [b.id]: presetKey }));
                        const presets = QUOTE_PRESETS[normalizeServiceType(b.serviceType)] || [];
                        const selected = presets.find((p) => p.key === presetKey);
                        if (selected) {
                          setQuotes(prev => ({ ...prev, [b.id]: selected.amount }));
                        }
                      }}
                      disabled={b.quotes?.some(q => q.adminId === uid)}
                      style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="">Select preset (optional)</option>
                      {(QUOTE_PRESETS[normalizeServiceType(b.serviceType)] || []).map((preset) => (
                        <option key={preset.key} value={preset.key}>{preset.label} (Rs.{preset.amount})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Addon Rs"
                      value={quoteAddons[b.id] || ''}
                      onChange={e => setQuoteAddons(prev => ({ ...prev, [b.id]: e.target.value }))}
                      style={{ width: '120px', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="number"
                      placeholder="Your Quote ₹"
                      value={quotes[b.id] || ''}
                      onChange={e => setQuotes(prev => ({ ...prev, [b.id]: e.target.value }))}
                      style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                    <button
                      onClick={() => setPriceQuote(b.id)}
                      style={{
                        background: '#6366f1',
                        color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px',
                        fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                      }}
                    >
                      {b.quotes?.some(q => q.adminId === uid) ? 'Update Quote' : 'Send Quote'}
                    </button>
                  </div>
                  {b.quotes?.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {b.quotes.length} bid(s) already received for this job.
                    </div>
                  )}
                  {/* Show the mason's own submitted quote */}
                  {b.quotes?.find(q => q.adminId === uid) && (
                    <div style={{ marginTop: '8px', padding: '8px', background: '#dbeafe', borderRadius: '6px', border: '1px solid #3b82f6' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e40af' }}>✅ Your Submitted Quote</div>
                      <div style={{ fontSize: '13px', color: '#1e3a8a', marginTop: '4px' }}>
                        ₹{b.quotes.find(q => q.adminId === uid).price}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                        Submitted: {b.quotes.find(q => q.adminId === uid).createdAt?.toDate?.().toLocaleString() || 'Just now'}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* WORKER ASSIGNMENT: Show for accepted bookings so mason can assign a gig to complete the job */}
              {b.status === 'accepted' && (adminRole === 'admin' || adminRole === 'mason' || adminRole === 'superadmin') && (
                <div style={{ width: '100%', padding: '12px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #10b981' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#065f46', marginBottom: '8px' }}>
                    🤝 Quote Accepted - Auto-picked worker (editable before Start Work)
                  </div>
                  <div style={{ fontSize: '12px', color: '#059669', marginBottom: '8px' }}>
                    Accepted Price: ₹{b.acceptedQuote?.finalPrice || b.acceptedQuote?.price} | Customer: {b.customerName}
                  </div>
                  {autoAssigningBookingIds[b.id] && (
                    <div style={{ fontSize: '12px', color: '#0f766e', marginBottom: '8px' }}>
                      Auto-picking best worker based on rating and availability...
                    </div>
                  )}
                  {availableWorkers.length > 0 ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        onChange={(e) => assignWorker(b, e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '4px',
                          border: '1px solid #10b981',
                          fontSize: '13px'
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>Select a gig to assign...</option>
                        {availableWorkers.map(w => (
                          <option key={w.id} value={w.id}>
                            {w.name} - {w.gigType} ({w.contact || w.phone || 'No phone'})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const pick = getRecommendedWorker(b, availableWorkers);
                          if (pick) assignWorker(b, pick.id);
                        }}
                        style={{
                          background: '#0ea5e9',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '8px 10px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        Auto Pick
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#dc2626', padding: '8px', background: '#fef2f2', borderRadius: '4px' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        ⚠️ No available gigs for {b.serviceType}
                      </div>
                      <div style={{ fontSize: '11px', color: '#7f1d1d', marginTop: '4px', lineHeight: '1.6' }}>
                        <strong>Debug Info:</strong>
                        <br />
                        • Total workers in state: {workers.length}
                        <br />
                        • Your workers (adminId={uid?.substring(0, 8)}...): {workers.filter(w => w.adminId === uid).length}
                        <br />
                        • Your gig types & status: {workers.filter(w => w.adminId === uid).map(w => `${w.gigType}(${w.status})`).join(', ') || 'None'}
                        <br />
                        • Booking needs: {b.serviceType} → normalized: "{normalizeServiceType(b.serviceType)}"
                        <br />
                        • Active gigs: {workers.filter(w => w.status === 'active' && w.adminId === uid).length}
                        <br />
                        📋 <strong>Open console (F12) to see detailed matching info!</strong>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {b.status === 'assigned' && <button onClick={() => startWork(b)} style={{ background: '#9c27b0', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px' }}>Start Work</button>}
              {b.status === 'in_progress' && (
                <button onClick={() => markFinished(b)} style={{ background: '#4caf50', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px' }}>
                  {Number(b.remainingWorkDays || b.estimatedDays || 1) > 1 ? 'Mark Day Complete' : 'Mark Finished'}
                </button>
              )}

              {/* DISPUTE SUB-PANEL */}
              {b.dispute?.status === 'open' && (
                <div style={{ width: '100%', marginTop: '10px', padding: '10px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#dc2626' }}>🚨 Dispute Management</div>
                  <div style={{ fontSize: '11px', margin: '4px 0' }}>Reason: {b.dispute.reason}</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button onClick={() => setCallLogId(b.id)} style={{ padding: '4px 8px', fontSize: '11px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px' }}>Log Call</button>
                    <button onClick={() => submitVisitLog(b.id)} style={{ padding: '4px 8px', fontSize: '11px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px' }}>Log Visit</button>
                    <select onChange={e => setDisputeDecisions(prev => ({ ...prev, [b.id]: e.target.value }))} style={{ fontSize: '11px' }}>
                      <option value="">Select Result…</option>
                      <option value="worker_fault">Worker Fault</option>
                      <option value="user_fault">User Fault</option>
                      <option value="shared_fault">Shared Fault</option>
                    </select>
                    <button onClick={() => resolveDispute(b)} style={{ padding: '4px 8px', fontSize: '11px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px' }}>Resolve</button>
                  </div>
                </div>
              )}

              {/* WORKER PHOTO UPLOAD SECTION */}
              {['assigned', 'in_progress'].includes(b.status) && (
                <div style={{ width: '100%', marginTop: '10px', padding: '10px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #0ea5e9' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0369a1', marginBottom: '8px' }}>📸 Submit Work Photos</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="file"
                      accept="image/*"
                      ref={el => fileInputRefs.current[b.id] = el}
                      style={{ display: 'none' }}
                      onChange={e => uploadPhoto(b.id, 'work_progress', e.target.files[0])}
                    />
                    <button
                      onClick={() => fileInputRefs.current[b.id].click()}
                      disabled={uploading[b.id]}
                      style={{ padding: '6px 12px', fontSize: '11px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      {uploading[b.id] ? '⌛ Uploading...' : '➕ Upload Work Photo'}
                    </button>
                  </div>
                  {b.photos?.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', overflowX: 'auto' }}>
                      {b.photos.map((p, i) => (
                        <a key={p.url || i} href={p.url} target="_blank" rel="noreferrer">
                          <img src={p.url} alt={`Work photo ${i + 1}`} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* LOG TOGGLE */}
              <button onClick={() => openLog === b.id ? setOpenLog(null) : openActivityLog(b.id)}
                style={{ padding: '6px 12px', fontSize: '12px', background: '#eee', border: 'none', borderRadius: '6px' }}>
                {openLog === b.id ? 'Hide Log' : '📜 View Log'}
              </button>
            </div>

            {/* ACTIVITY LOG: Rendered in-card for quick review */}
            {openLog === b.id && logMap[b.id] && (
              <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #eee', fontSize: '11px', color: '#555' }}>
                {logMap[b.id].map((log, i) => (
                  <div key={log.timestamp?.toDate?.().getTime() || i} style={{ marginBottom: '4px' }}>
                    <span style={{ color: '#999' }}>{log.timestamp?.toDate?.().toLocaleTimeString()}</span> - <strong>{log.actorRole}</strong>: {log.action}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
