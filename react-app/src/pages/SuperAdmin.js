import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
    EmailAuthProvider,
    GoogleAuthProvider,
    PhoneAuthProvider,
    PhoneMultiFactorGenerator,
    RecaptchaVerifier,
    multiFactor,
    reauthenticateWithCredential,
    reauthenticateWithPopup,
} from 'firebase/auth';
import { auth, db, functionsInstance } from '../firebase';
import { useToast } from '../context/ToastContext';
import { buildCopperMonitorSummary } from '../utils/gigScore';
import { MVP_SERVICE_PRICE_CAPS, buildAreaId } from '../utils/backendContracts';
import SuperAdminAreaIntelMap from '../components/SuperAdminAreaIntelMap';
import {
    buildAreaIntelSummary,
    buildAreaIntelligenceRows,
    buildAreaMapPoints,
    getDemandBadgeClass,
} from '../utils/areaIntelligence';
import { buildTravelResolvedHistoryQueue, buildTravelReviewQueue } from '../utils/operatorQueues';
import {
    DEFAULT_PRICING_SETTINGS,
    PAYOUT_HOLD_MINUTES_MAX,
    PAYOUT_HOLD_MINUTES_MIN,
    formatPayoutHoldDuration,
    normalizePricingSettings,
} from '../config/pricingSettings';
import './SuperAdmin.css';

const RECENT_REAUTH_WINDOW_MS = 10 * 60 * 1000;
const MVP_PRICE_SERVICE_OPTIONS = Object.values(MVP_SERVICE_PRICE_CAPS);

function createDefaultPriceRuleForm() {
    const preset = MVP_PRICE_SERVICE_OPTIONS[0];
    return {
        city: 'Bangalore',
        areaName: 'Indiranagar',
        areaId: buildAreaId({ city: 'Bangalore', areaName: 'Indiranagar' }),
        areaCenterLat: '',
        areaCenterLng: '',
        serviceId: preset.serviceId,
        serviceName: preset.serviceName,
        unitType: preset.unitType,
        minPrice: preset.minPrice,
        normalPrice: preset.normalPrice,
        highPrice: preset.highPrice,
        peakPrice: preset.peakPrice,
        maxAllowedPrice: preset.maxAllowedPrice,
        workerMinPrice: preset.minPrice,
        workerMaxPrice: preset.maxAllowedPrice,
        minimumWorkerThreshold: 20,
        peakUtilizationPercent: 90,
        manualDemandLevel: '',
        manualOverrideReason: '',
        enabled: true,
    };
}

function safeBuildAreaId(city, areaName) {
    try {
        return buildAreaId({ city: city || 'city', areaName: areaName || 'area' });
    } catch {
        return `${String(city || 'city').toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${String(areaName || 'area').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    }
}

function normalizeMfaPhone(value) {
    const raw = (value || '').toString().trim();
    if (raw.startsWith('+')) return `+${raw.slice(1).replace(/\D/g, '')}`;
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return `+91${digits}`;
    return digits ? `+${digits}` : '';
}

export default function SuperAdmin() {
    const { addToast } = useToast();
    const recaptchaVerifierRef = useRef(null);
    const [admins, setAdmins] = useState([]);
    const [escalatedBookings, setEscalatedBookings] = useState([]);
    const [allDisputes, setAllDisputes] = useState([]);
    const [allBookings, setAllBookings] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [allWorkers, setAllWorkers] = useState([]);
    const [workerVerificationSubmissions, setWorkerVerificationSubmissions] = useState([]);
    const [paymentOperations, setPaymentOperations] = useState([]);
    const [supportTickets, setSupportTickets] = useState([]);
    const [pendingGigScoreEvents, setPendingGigScoreEvents] = useState([]);
    const [servicePriceRules, setServicePriceRules] = useState([]);
    const [areaDemandSnapshots, setAreaDemandSnapshots] = useState([]);
    const [areaGrowthInsights, setAreaGrowthInsights] = useState([]);
    const [areaGrowthHealth, setAreaGrowthHealth] = useState(null);
    const [recentPriceQuotes, setRecentPriceQuotes] = useState([]);
    const [aiModelGatewayHealth, setAiModelGatewayHealth] = useState(null);
    const [sentryIssueIngestHealth, setSentryIssueIngestHealth] = useState(null);
    const [sentryCanaryHealth, setSentryCanaryHealth] = useState(null);
    const [activeTab, setActiveTab] = useState('escalations');
    const [copperSettings, setCopperSettings] = useState({
        threshold: 400,
        recoveryDiscountPercent: 10,
        alertFrequencyHours: 24,
        scoreDropSensitivity: 60,
        cityEnabled: true,
    });
    const [gigscoreSettings, setGigscoreSettings] = useState({
        copperThreshold: 450,
        recoveryDiscountPercent: 10,
        workerFreezeBelow: 300,
        workerRecoveryBelow: 400,
        inactivityFloor: 450,
        inactivityDecayAfterDays: 10,
        workerInactivityDecay: -5,
        consumerInactivityDecay: -2,
        diamondWorkerOptionalPriceIncreasePercent: 10,
        eliteConsumerMinimumRealConsumers: 3000,
        eliteConsumerDiscountPercent: 25,
        eliteConsumerMonthlyBookingLimit: 8,
        guildMinMembers: 3,
        guildMaxMembers: 6,
        guildDiamondShieldDays: 7,
    });
    const [pricingSettings, setPricingSettings] = useState(DEFAULT_PRICING_SETTINGS);
    const [savedPricingSettings, setSavedPricingSettings] = useState(DEFAULT_PRICING_SETTINGS);
    const [priceRuleForm, setPriceRuleForm] = useState(createDefaultPriceRuleForm);
    const [priceRuleSaving, setPriceRuleSaving] = useState(false);
    const [areaGrowthRefreshing, setAreaGrowthRefreshing] = useState(false);
    const [aiHealthRefreshing, setAiHealthRefreshing] = useState(false);
    const [sentryCanaryRefreshing, setSentryCanaryRefreshing] = useState(false);
    const [mfaFactors, setMfaFactors] = useState([]);
    const [mfaPhone, setMfaPhone] = useState('');
    const [mfaCode, setMfaCode] = useState('');
    const [mfaVerificationId, setMfaVerificationId] = useState('');
    const [mfaLoading, setMfaLoading] = useState(false);
    const [mfaError, setMfaError] = useState('');
    
    // ── Filter states ──
    const [filterSearch, setFilterSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [filterRegion, setFilterRegion] = useState('all');
    
    // Form states for creating new regionAdmin or admin
    const [createForm, setCreateForm] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'regionAdmin',
        regionAdminId: '',
        areaName: '',
    });
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState('');
    const [createSuccess, setCreateSuccess] = useState('');

    const requireRecentSuperadminAuth = async (actionLabel) => {
        const user = auth.currentUser;
        if (!user) {
            addToast('Please sign in again before changing security-sensitive settings.', 'error');
            return false;
        }

        const lastSignInMs = Date.parse(user.metadata?.lastSignInTime || '');
        if (lastSignInMs && Date.now() - lastSignInMs <= RECENT_REAUTH_WINDOW_MS) {
            return true;
        }

        try {
            const providerIds = (user.providerData || []).map(provider => provider.providerId);
            if (providerIds.includes('google.com')) {
                await reauthenticateWithPopup(user, new GoogleAuthProvider());
                return true;
            }

            const password = window.prompt(`Re-enter your password to continue: ${actionLabel}`);
            if (!password || !user.email) return false;
            await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
            return true;
        } catch (err) {
            addToast('Recent sign-in failed: ' + err.message, 'error');
            return false;
        }
    };

    const callSuperadminAction = async (action, payload = {}) => {
        const callable = httpsCallable(functionsInstance, 'superadminAction');
        return callable({ action, payload });
    };

    const callAdminWorkerAction = async (action, payload = {}) => {
        const callable = httpsCallable(functionsInstance, 'adminWorkerAction');
        return callable({ action, payload });
    };

    const refreshMfaFactors = async () => {
        const user = auth.currentUser;
        if (!user) {
            setMfaFactors([]);
            return [];
        }
        await user.reload?.();
        const factors = multiFactor(user).enrolledFactors || [];
        setMfaFactors(factors);
        return factors;
    };

    const getMfaRecaptchaVerifier = () => {
        if (!recaptchaVerifierRef.current) {
            recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'superadmin-mfa-recaptcha', {
                size: 'invisible',
                callback: () => {},
            });
        }
        return recaptchaVerifierRef.current;
    };

    const startMfaEnrollment = async () => {
        setMfaError('');
        const user = auth.currentUser;
        if (!user) return setMfaError('Please sign in again before enrolling MFA.');
        const phoneNumber = normalizeMfaPhone(mfaPhone || user.phoneNumber);
        if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
            return setMfaError('Enter a valid phone number with country code, for example +919876543210.');
        }
        if (!await requireRecentSuperadminAuth('enroll SuperAdmin MFA')) return false;

        setMfaLoading(true);
        try {
            const mfaUser = multiFactor(user);
            const session = await mfaUser.getSession();
            const phoneProvider = new PhoneAuthProvider(auth);
            const verificationId = await phoneProvider.verifyPhoneNumber(
                { phoneNumber, session },
                getMfaRecaptchaVerifier()
            );
            setMfaVerificationId(verificationId);
            setMfaPhone(phoneNumber);
            addToast('MFA code sent to phone.', 'success');
            return true;
        } catch (err) {
            setMfaError(err.message || 'Could not send MFA code.');
            recaptchaVerifierRef.current?.clear?.();
            recaptchaVerifierRef.current = null;
            return false;
        } finally {
            setMfaLoading(false);
        }
    };

    const completeMfaEnrollment = async () => {
        setMfaError('');
        const user = auth.currentUser;
        if (!user) return setMfaError('Please sign in again before confirming MFA.');
        if (!mfaVerificationId || !mfaCode.trim()) return setMfaError('Enter the SMS verification code.');

        setMfaLoading(true);
        try {
            const credential = PhoneAuthProvider.credential(mfaVerificationId, mfaCode.trim());
            const assertion = PhoneMultiFactorGenerator.assertion(credential);
            await multiFactor(user).enroll(assertion, 'SuperAdmin phone');
            setMfaCode('');
            setMfaVerificationId('');
            await refreshMfaFactors();
            addToast('SuperAdmin MFA enrolled.', 'success');
        } catch (err) {
            setMfaError(err.message || 'MFA enrollment failed.');
        } finally {
            setMfaLoading(false);
        }
    };

    const removeMfaFactor = async (factor) => {
        if (!factor?.uid) return;
        if (mfaFactors.length <= 1 && !window.confirm('Remove the only MFA factor? Do this only while hard backend enforcement is still disabled.')) return;
        if (!await requireRecentSuperadminAuth('remove SuperAdmin MFA factor')) return;
        setMfaLoading(true);
        setMfaError('');
        try {
            await multiFactor(auth.currentUser).unenroll(factor);
            await refreshMfaFactors();
            addToast('MFA factor removed.', 'info');
        } catch (err) {
            setMfaError(err.message || 'Could not remove MFA factor.');
        } finally {
            setMfaLoading(false);
        }
    };

    /* ── Listen to all admins (regionLeads) ── */
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'admins'), snap => {
            setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return unsub;
    }, []);

    useEffect(() => {
        refreshMfaFactors().catch(() => {});
        return () => {
            recaptchaVerifierRef.current?.clear?.();
            recaptchaVerifierRef.current = null;
        };
    }, []);

    /* ── Listen to all bookings and escalated disputes ── */
    useEffect(() => {
        const unsub = onSnapshot(
            query(collection(db, 'bookings'), orderBy('createdAt', 'desc')),
            snap => {
                const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setAllBookings(all);
                setEscalatedBookings(all.filter(b =>
                    b.dispute?.escalationStatus === true && b.dispute?.status === 'open'
                ));
                const disputes = all.filter(b => b.dispute?.status);
                setAllDisputes(disputes);
            }
        );
        return unsub;
    }, []);

    /* ── Listen to all users ── */
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'users'), snap => {
            setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return unsub;
    }, []);

    /* ── Listen to all workers ── */
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'gig_workers'), snap => {
            setAllWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return unsub;
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, 'worker_verification_submissions'),
            snap => setWorkerVerificationSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
            () => setWorkerVerificationSubmissions([])
        );
        return unsub;
    }, []);

    /* GigScore pending review queue */
    useEffect(() => {
        const unsub = onSnapshot(
            query(collection(db, 'gigscore_events'), where('status', '==', 'pending')),
            snap => {
                const rows = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                setPendingGigScoreEvents(rows);
            }
        );
        return unsub;
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'platform_settings', 'pricing_controls'), snap => {
            const nextSettings = normalizePricingSettings(snap.exists() ? snap.data() : DEFAULT_PRICING_SETTINGS);
            setPricingSettings(nextSettings);
            setSavedPricingSettings(nextSettings);
        }, () => {});
        return unsub;
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'platform_settings', 'gigscore_controls'), snap => {
            if (snap.exists()) {
                setGigscoreSettings(prev => ({
                    ...prev,
                    ...snap.data()
                }));
            }
        }, () => {});
        return unsub;
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(
            doc(db, 'platform_settings', 'ai_model_gateway_health'),
            snap => setAiModelGatewayHealth(snap.exists() ? { id: snap.id, ...snap.data() } : null),
            () => setAiModelGatewayHealth(null)
        );
        return unsub;
    }, []);

    useEffect(() => {
        const unsubIngest = onSnapshot(
            doc(db, 'platform_settings', 'sentry_issue_ingest'),
            snap => setSentryIssueIngestHealth(snap.exists() ? { id: snap.id, ...snap.data() } : null),
            () => setSentryIssueIngestHealth(null)
        );
        const unsubCanary = onSnapshot(
            doc(db, 'platform_settings', 'sentry_canary'),
            snap => setSentryCanaryHealth(snap.exists() ? { id: snap.id, ...snap.data() } : null),
            () => setSentryCanaryHealth(null)
        );
        return () => {
            unsubIngest();
            unsubCanary();
        };
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(
            query(collection(db, 'service_price_rules'), orderBy('updatedAt', 'desc')),
            snap => setServicePriceRules(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
            () => setServicePriceRules([])
        );
        return unsub;
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(
            query(collection(db, 'area_demand_snapshots'), orderBy('computedAt', 'desc')),
            snap => setAreaDemandSnapshots(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
            () => setAreaDemandSnapshots([])
        );
        return unsub;
    }, []);

    useEffect(() => {
        const unsubInsights = onSnapshot(
            query(collection(db, 'area_growth_insights'), orderBy('updatedAt', 'desc'), limit(60)),
            snap => setAreaGrowthInsights(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(item => item.status === 'open').slice(0, 40)),
            () => setAreaGrowthInsights([])
        );
        const unsubHealth = onSnapshot(
            doc(db, 'platform_settings', 'area_growth_intelligence'),
            snap => setAreaGrowthHealth(snap.exists() ? { id: snap.id, ...snap.data() } : null),
            () => setAreaGrowthHealth(null)
        );
        return () => {
            unsubInsights();
            unsubHealth();
        };
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(
            query(collection(db, 'price_quotes'), orderBy('createdAt', 'desc'), limit(250)),
            snap => setRecentPriceQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
            () => setRecentPriceQuotes([])
        );
        return unsub;
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(
            query(collection(db, 'payment_operations'), orderBy('createdAt', 'desc')),
            snap => setPaymentOperations(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
            () => {}
        );
        return unsub;
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, 'support_tickets'),
            snap => setSupportTickets(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
            () => setSupportTickets([])
        );
        return unsub;
    }, []);

    /* ── Actions ── */
    const suspendRegion = async (adminId) => {
        if (!window.confirm('Suspend this region lead? Their workers will not receive new assignments.')) return;
        if (!await requireRecentSuperadminAuth('suspend a region lead')) return;
        await callSuperadminAction('suspend_region', { adminId });
        addToast('Region lead suspended.', 'info');
    };

    const reinstateRegion = async (adminId) => {
        if (!await requireRecentSuperadminAuth('reinstate a region lead')) return;
        await callSuperadminAction('reinstate_region', { adminId });
        addToast('Region lead reinstated.', 'success');
    };

    const markWorkerFraud = async (workerId) => {
        if (!window.confirm('Mark this worker as fraudulent?')) return;
        if (!await requireRecentSuperadminAuth('mark a worker as fraud')) return;
        await callSuperadminAction('mark_worker_fraud', { workerId });
        addToast('Worker marked as fraud.', 'warning');
    };

    const resolveEscalatedDispute = async (booking, decision) => {
        if (!decision) return alert('Please select a decision');
        if (!window.confirm('Resolve this dispute?')) return;
        if (!await requireRecentSuperadminAuth('resolve an escalated dispute')) return;
        try {
            await httpsCallable(functionsInstance, 'updateBookingStatus')({
                bookingId: booking.id,
                action: 'admin_resolve_dispute',
                extraArgs: { decision }
            });
            if (decision === 'refund_user' || decision === 'split_payment') {
                const amount = decision === 'split_payment'
                    ? Number(booking.acceptedQuote?.pricing?.finalTotal || booking.finalTotal || booking.totalAmount || 0) / 2
                    : Number(booking.acceptedQuote?.pricing?.finalTotal || booking.finalTotal || booking.totalAmount || 0);
                await callSuperadminAction('create_consumer_refund', { bookingId: booking.id, amount });
            }
            if (decision === 'pay_worker' || decision === 'split_payment') {
                const amount = decision === 'split_payment'
                    ? Number(booking.acceptedQuote?.pricing?.workerReceives || booking.fixedRate || booking.acceptedQuote?.price || 0) / 2
                    : Number(booking.acceptedQuote?.pricing?.workerReceives || booking.fixedRate || booking.acceptedQuote?.price || 0);
                await callSuperadminAction('create_worker_payout', { bookingId: booking.id, amount });
            }
            addToast('✅ Dispute resolved', 'success');
        } catch (err) { addToast('Error: ' + err.message, 'error'); }
    };

    const assignAdminToRegionLead = async (adminId, regionLeadId) => {
        if (!adminId || !regionLeadId) return addToast('Please select both admin and region lead', 'warning');
        if (!await requireRecentSuperadminAuth('assign an admin to a region lead')) return;
        try {
            await callSuperadminAction('assign_admin_to_region_lead', { adminId, regionLeadId });
            addToast('✅ Admin assigned', 'success');
        } catch (err) { addToast('Error: ' + err.message, 'error'); }
    };

    const unassignAdminFromRegionLead = async (adminId) => {
        if (!window.confirm('Remove this admin from the region lead?')) return;
        if (!await requireRecentSuperadminAuth('remove an admin from a region lead')) return;
        try {
            await callSuperadminAction('unassign_admin_from_region_lead', { adminId });
            addToast('✅ Admin unassigned', 'success');
        } catch (err) { addToast('Error: ' + err.message, 'error'); }
    };

    const createRegionAdmin = async (e) => {
        e.preventDefault();
        setCreateError(''); setCreateSuccess('');
        const { name, email, password, confirmPassword, areaName } = createForm;
        if (!name || !email || !password || !areaName) return setCreateError('Fill all fields');
        if (password !== confirmPassword) return setCreateError('Passwords mismatch');
        if (!await requireRecentSuperadminAuth('create a region lead account')) return;
        
        setCreateLoading(true);
        try {
            await callSuperadminAction('create_region_lead', { name, email, password, areaName });
            setCreateSuccess(`✅ Created "${name}". Please logout and log back in.`);
            setCreateForm({ name: '', email: '', password: '', confirmPassword: '', role: 'regionAdmin', regionAdminId: '', areaName: '' });
        } catch (err) { setCreateError('Error: ' + err.message); }
        finally { setCreateLoading(false); }
    };

    const saveCopperSettings = async () => {
        try {
            if (!await requireRecentSuperadminAuth('save Copper monitoring controls')) return;
            await callSuperadminAction('save_copper_settings', { settings: copperSettings });
            addToast('Copper monitoring settings saved.', 'success');
        } catch (err) {
            addToast('Error: ' + err.message, 'error');
        }
    };

    const savePricingControls = async () => {
        try {
            if (!await requireRecentSuperadminAuth('save pricing controls')) return;
            const settings = normalizePricingSettings(pricingSettings);
            let reason = null;
            if (settings.payoutHoldMinutes !== savedPricingSettings.payoutHoldMinutes) {
                reason = window.prompt('Reason for changing the payout/dispute hold timing?', 'Adjusting dispute review window for launch operations.');
                if (!reason) return;
            }
            await callSuperadminAction('save_pricing_controls', { settings, reason });
            setPricingSettings(settings);
            setSavedPricingSettings(settings);
            addToast('Pricing controls saved.', 'success');
        } catch (err) {
            addToast('Error: ' + err.message, 'error');
        }
    };

    const saveGigscoreSettings = async () => {
        try {
            if (!await requireRecentSuperadminAuth('save GigScore controls')) return;
            const reason = window.prompt('Reason for changing the GigScore control parameters?', 'Adjusting thresholds for platform balancing.');
            if (!reason) return;
            await callSuperadminAction('save_gigscore_controls', { settings: gigscoreSettings, reason });
            addToast('GigScore controls saved.', 'success');
        } catch (err) {
            addToast('Error: ' + err.message, 'error');
        }
    };

    const refreshAiModelGatewayHealth = async () => {
        setAiHealthRefreshing(true);
        try {
            const result = await callSuperadminAction('run_ai_model_gateway_health_check');
            const status = result?.data?.health?.status || 'updated';
            addToast(`AI gateway health check ${status}.`, status === 'ok' ? 'success' : 'info');
        } catch (err) {
            addToast(err.message || 'AI gateway health check failed.', 'error');
        } finally {
            setAiHealthRefreshing(false);
        }
    };

    const refreshSentryCanaryHealth = async () => {
        setSentryCanaryRefreshing(true);
        try {
            if (!await requireRecentSuperadminAuth('run Sentry canary check')) return;
            const result = await callSuperadminAction('run_sentry_canary_check');
            const status = result?.data?.health?.status || 'updated';
            addToast(`Sentry canary check ${status}.`, status === 'ok' ? 'success' : 'info');
        } catch (err) {
            addToast(err.message || 'Sentry canary check failed.', 'error');
        } finally {
            setSentryCanaryRefreshing(false);
        }
    };

    const refreshAreaGrowthInsights = async () => {
        setAreaGrowthRefreshing(true);
        try {
            if (!await requireRecentSuperadminAuth('refresh area growth insights')) return;
            const result = await callSuperadminAction('refresh_area_growth_insights');
            const count = result?.data?.health?.openInsightCount ?? 0;
            addToast(`Area growth insights refreshed: ${count} open.`, count > 0 ? 'info' : 'success');
        } catch (err) {
            addToast(err.message || 'Area growth insight refresh failed.', 'error');
        } finally {
            setAreaGrowthRefreshing(false);
        }
    };

    const updatePriceRuleField = (field, value) => {
        setPriceRuleForm(prev => {
            const next = { ...prev, [field]: value };
            if (field === 'city' || field === 'areaName') {
                next.areaId = safeBuildAreaId(
                    field === 'city' ? value : next.city,
                    field === 'areaName' ? value : next.areaName
                );
            }
            if (field === 'serviceId') {
                const preset = MVP_SERVICE_PRICE_CAPS[value];
                if (preset) {
                    Object.assign(next, {
                        serviceId: preset.serviceId,
                        serviceName: preset.serviceName,
                        unitType: preset.unitType,
                        minPrice: preset.minPrice,
                        normalPrice: preset.normalPrice,
                        highPrice: preset.highPrice,
                        peakPrice: preset.peakPrice,
                        maxAllowedPrice: preset.maxAllowedPrice,
                        workerMinPrice: preset.minPrice,
                        workerMaxPrice: preset.maxAllowedPrice,
                    });
                }
            }
            return next;
        });
    };

    const loadPriceRuleIntoForm = (rule) => {
        setPriceRuleForm({
            ...createDefaultPriceRuleForm(),
            ...rule,
            manualDemandLevel: rule.manualDemandLevel || '',
            manualOverrideReason: rule.manualOverrideReason || '',
            enabled: rule.enabled !== false,
        });
        addToast('Price rule loaded for editing.', 'info');
    };

    const saveServicePriceRule = async () => {
        const manualReason = (priceRuleForm.manualOverrideReason || '').trim();
        if (priceRuleForm.manualDemandLevel && manualReason.length < 12) {
            addToast('Manual demand override needs a clear audit reason before saving.', 'error');
            return;
        }
        const defaultReason = manualReason || 'MVP area/service price setup.';
        const reason = window.prompt('Reason for changing this area/service price rule?', defaultReason);
        if (!reason) return;
        if (priceRuleForm.manualDemandLevel && reason.trim().length < 12) {
            addToast('Manual demand override save reason must be clear for audit.', 'error');
            return;
        }
        if (!await requireRecentSuperadminAuth('save MVP service price rule')) return;
        setPriceRuleSaving(true);
        try {
            await callSuperadminAction('save_service_price_rule', { rule: priceRuleForm, reason });
            addToast('Service price rule saved.', 'success');
        } catch (err) {
            addToast('Error: ' + err.message, 'error');
        } finally {
            setPriceRuleSaving(false);
        }
    };

    const seedMvpPriceRules = async () => {
        const reason = window.prompt('Reason for seeding all MVP rules for this area?', `Seed launch rules for ${priceRuleForm.city}/${priceRuleForm.areaName}.`);
        if (!reason) return;
        if (!await requireRecentSuperadminAuth('seed MVP service price rules')) return;
        setPriceRuleSaving(true);
        try {
            const result = await callSuperadminAction('seed_mvp_price_rules', {
                city: priceRuleForm.city,
                areaName: priceRuleForm.areaName,
                areaId: priceRuleForm.areaId,
                areaCenterLat: priceRuleForm.areaCenterLat,
                areaCenterLng: priceRuleForm.areaCenterLng,
                reason,
            });
            addToast(`Seeded ${result.data?.count || MVP_PRICE_SERVICE_OPTIONS.length} MVP price rules.`, 'success');
        } catch (err) {
            addToast('Error: ' + err.message, 'error');
        } finally {
            setPriceRuleSaving(false);
        }
    };

    const reviewGigScoreEvent = async (eventId, decision) => {
        const reason = window.prompt(`Reason for GigScore ${decision}?`, 'Superadmin reviewed evidence and score impact.');
        if (!reason) return;
        if (!await requireRecentSuperadminAuth(`GigScore ${decision}`)) return;
        try {
            await httpsCallable(functionsInstance, 'reviewGigScoreEvent')({ eventId, decision, reason });
            addToast(`GigScore event ${decision}d.`, 'success');
        } catch (err) {
            addToast('Error: ' + err.message, 'error');
        }
    };

    /* ── Derived data ── */
    const holdWorkerPayout = async (operation) => {
        if (!operation?.bookingId) return addToast('Booking ID is missing for this payout row.', 'error');
        const reason = window.prompt('Reason to hold this worker payout?', 'Suspicious payout requires SuperAdmin review before release.');
        if (!reason) return;
        if (!await requireRecentSuperadminAuth('hold worker payout')) return;
        try {
            await callSuperadminAction('manual_payout_hold', {
                bookingId: operation.bookingId,
                operationId: operation.id,
                reason,
            });
            addToast('Worker payout placed on manual hold.', 'warning');
        } catch (err) {
            addToast('Error: ' + err.message, 'error');
        }
    };

    const releaseWorkerPayoutHold = async (operation) => {
        if (!operation?.bookingId) return addToast('Booking ID is missing for this payout row.', 'error');
        const reason = window.prompt('Reason to release this worker payout hold?', 'Reviewed evidence and payout can continue.');
        if (!reason) return;
        if (!await requireRecentSuperadminAuth('release worker payout hold')) return;
        try {
            await callSuperadminAction('release_manual_payout_hold', {
                bookingId: operation.bookingId,
                operationId: operation.id,
                reason,
            });
            addToast('Worker payout hold released.', 'success');
        } catch (err) {
            addToast('Error: ' + err.message, 'error');
        }
    };

    const resolveTravelReview = async (row, decision) => {
        if (!row?.bookingId) return addToast('Booking ID is missing for this travel review.', 'error');
        const reason = window.prompt(
            'Resolution reason for this travel review?',
            decision === 'confirmed_no_show'
                ? 'Confirmed no-show after reviewing location evidence and contacting parties. Send to GigScore review queue.'
                : 'Reviewed travel evidence and contacted parties.'
        );
        if (!reason) return;
        try {
            await httpsCallable(functionsInstance, 'resolveTravelWatchdogReview')({
                bookingId: row.bookingId,
                ticketId: row.ticket?.id || '',
                decision,
                reason,
                payoutDecision: decision === 'confirmed_no_show' ? 'hold_for_review' : 'no_payout_change',
                scoreDecision: decision === 'confirmed_no_show' ? 'create_gigscore_review' : 'no_score_change',
            });
            addToast(decision === 'confirmed_no_show' ? 'Travel review updated and GigScore review created.' : 'Travel review updated.', 'success');
        } catch (err) {
            addToast('Error: ' + err.message, 'error');
        }
    };

    const approveWorkerVerification = async (row) => {
        if (!row?.id) return addToast('Worker ID is missing.', 'error');
        const defaultTarget = assignableWorkerAdmins[0]?.id || '';
        if (!defaultTarget) return addToast('Create or assign a mason/admin before approving workers.', 'error');
        const targetAdminId = window.prompt('Assign approved worker to admin/mason ID:', defaultTarget);
        if (!targetAdminId) return;
        try {
            await callAdminWorkerAction('approve_worker', { workerId: row.id, targetAdminId });
            addToast('Worker approved and assigned.', 'success');
        } catch (err) {
            addToast('Approval failed: ' + err.message, 'error');
        }
    };

    const rejectWorkerVerification = async (row) => {
        if (!row?.id) return addToast('Worker ID is missing.', 'error');
        const reason = window.prompt('Reason for rejecting this worker verification?', 'Proof was incomplete or did not match MVP launch requirements.');
        if (!reason) return;
        try {
            await callAdminWorkerAction('reject_worker', { workerId: row.id, reason });
            addToast('Worker verification rejected.', 'info');
        } catch (err) {
            addToast('Rejection failed: ' + err.message, 'error');
        }
    };

    const regionLeads = admins.filter(a => a.role === 'regionLead');
    const childAdmins = admins.filter(a => ['admin', 'mason'].includes(a.role) && !!a.parentAdminId);
    const unassignedAdmins = admins.filter(a => ['admin', 'mason'].includes(a.role) && !a.parentAdminId);
    const assignableWorkerAdmins = admins.filter(a => ['admin', 'mason'].includes(a.role));
    const workerVerificationRows = workerVerificationSubmissions
        .map(row => ({
            ...row,
            worker: allWorkers.find(worker => worker.id === row.id || worker.uid === row.id),
        }))
        .filter(row => (row.reviewStatus || row.worker?.verificationStatus || row.worker?.approvalStatus || 'pending') === 'pending')
        .sort((a, b) => (b.submittedAt?.toMillis?.() || b.verificationSubmittedAt?.toMillis?.() || 0) - (a.submittedAt?.toMillis?.() || a.verificationSubmittedAt?.toMillis?.() || 0));
    const copperSummary = buildCopperMonitorSummary({
        consumers: allUsers.map(u => ({ ...u, score: u.gigScore ?? u.socioScore ?? u.trustScore ?? 0 })),
        workers: allWorkers.map(w => ({ ...w, score: w.gigScore ?? w.socioScore ?? 0 })),
        guilds: [],
        threshold: Number(copperSettings.threshold || 450),
    });
    const areaIntelligenceRows = buildAreaIntelligenceRows(servicePriceRules, areaDemandSnapshots, recentPriceQuotes);
    const areaMapPoints = buildAreaMapPoints(areaIntelligenceRows);
    const travelReviewRows = buildTravelReviewQueue(allBookings, supportTickets)
        .sort((a, b) => {
            const priorityScore = { High: 3, high: 3, Medium: 2, medium: 2, Normal: 1, normal: 1 };
            return (priorityScore[b.priority] || 0) - (priorityScore[a.priority] || 0);
        });
    const travelResolvedHistoryRows = buildTravelResolvedHistoryQueue(allBookings, supportTickets);
    const areaIntelSummary = buildAreaIntelSummary(areaIntelligenceRows, servicePriceRules, areaDemandSnapshots, recentPriceQuotes);
    const areaGrowthUrgentCount = areaGrowthInsights.filter(insight => insight.priority === 'urgent').length;
    const areaGrowthHighCount = areaGrowthInsights.filter(insight => insight.priority === 'high').length;
    
    const getScoreColor = (score) => {
        if (score >= 80) return 'var(--success)';
        if (score >= 60) return 'var(--warning)';
        return 'var(--error)';
    };

    /* ── Filtering helpers ── */
    const filteredBookings = allBookings.filter(b => {
        if (filterStatus !== 'all' && b.status !== filterStatus) return false;
        if (filterSearch && !b.customerName?.toLowerCase().includes(filterSearch.toLowerCase())) return false;
        return true;
    });

    const resetFilters = () => {
        setFilterSearch(''); setFilterStatus('all'); setFilterDateFrom(''); setFilterDateTo(''); setFilterRegion('all');
    };

    const formatTimestamp = (value) => {
        const date = value?.toDate?.() || (value ? new Date(value) : null);
        if (!date || Number.isNaN(date.getTime())) return 'Waiting';
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const aiGatewayStatus = aiModelGatewayHealth?.status || 'waiting';
    const aiGatewayNeedsAttention = aiGatewayStatus !== 'ok';
    const sentryIngestStatus = sentryIssueIngestHealth?.healthStatus === 'needs_attention'
        ? 'needs_attention'
        : (sentryIssueIngestHealth?.status || 'waiting');
    const sentryCanaryStatus = sentryCanaryHealth?.status || 'waiting';
    const sentryNeedsAttention =
        ['needs_attention', 'failed', 'disabled'].includes(sentryIngestStatus) ||
        ['needs_monitor_setup', 'failed', 'unsupported', 'unverified', 'disabled'].includes(sentryCanaryStatus);
    const opsHealthCount = Number(aiGatewayNeedsAttention) + Number(sentryNeedsAttention);
    const getSentryStatusCopy = (status) => {
        if (status === 'ok') return 'Healthy';
        if (status === 'needs_monitor_setup') return 'Needs monitor setup';
        if (status === 'needs_attention') return 'Needs attention';
        if (status === 'disabled') return 'Disabled';
        if (status === 'failed') return 'Failed';
        if (status === 'unsupported' || status === 'unverified') return 'Needs verification';
        return 'Waiting';
    };

    return (
        <div className="super-admin-shell dash-container">
            <main className="super-admin-main">
                
                {/* Global Header */}
                <header className="super-admin-hero">
                    <div>
                        <h1>Super Admin Overview</h1>
                        <p>System performance, trust controls, and global ecosystem health.</p>
                    </div>
                    <div className="super-admin-health-pill">
                        <span>System Status: Optimal</span>
                        <button type="button">Export Report</button>
                    </div>
                </header>

                {/* Summary Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 40 }}>
                    {[
                        { label: 'Regions', value: regionLeads.length, icon: '🌐', color: 'var(--primary-purple)' },
                        { label: 'Masons', value: childAdmins.length, icon: '👤', color: 'var(--secondary-green)' },
                        { label: 'Escalations', value: escalatedBookings.length, icon: '🚨', color: 'var(--error)' },
                        { label: 'Total Jobs', value: allBookings.length, icon: '📋', color: 'var(--text-main)' },
                        { label: 'Active Pros', value: allWorkers.length, icon: '👷', color: 'var(--success)' },
                    ].map(card => (
                        <div key={card.label} className="job-card" style={{ padding: 20, textAlign: 'center' }}>
                            <div style={{ fontSize: 24, marginBottom: 8 }}>{card.icon}</div>
                            <div style={{ fontSize: 24, fontWeight: 900, color: card.color }}>{card.value}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>{card.label}</div>
                        </div>
                    ))}
                </div>

                {/* Navigation */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap', background: 'var(--bg-soft)', padding: 8, borderRadius: 'var(--radius-lg)' }}>
                    {[
                        { id: 'escalations', label: 'Escalations', icon: '🚨', count: escalatedBookings.length },
                        { id: 'disputes', label: 'Disputes', icon: '⚠️' },
                        { id: 'work-status', label: 'Monitor', icon: '🔍' },
                        { id: 'travel-review', label: 'Travel', icon: 'ETA', count: travelReviewRows.length },
                        { id: 'area-intel', label: 'Area Intel', icon: 'AI', count: areaIntelSummary.supplyGaps + areaIntelSummary.staleOrMissing + areaGrowthInsights.length },
                        { id: 'ai-health', label: 'AI/Ops Health', icon: 'AI', count: opsHealthCount },
                        { id: 'worker-verification', label: 'Worker Verify', icon: 'ID', count: workerVerificationRows.length },
                        { id: 'copper', label: 'Copper', icon: '⚙️' },
                        { id: 'pricing', label: 'Pricing', icon: '₹' },
                        { id: 'security', label: 'Security', icon: 'SEC', count: mfaFactors.length ? 0 : 1 },
                        { id: 'payments', label: 'Payments', icon: 'PAY', count: paymentOperations.filter(op => ['queued_for_manual_review', 'pending'].includes(op.status)).length },
                        { id: 'gigscore-review', label: 'GigScore', icon: 'GS', count: pendingGigScoreEvents.length },
                        { id: 'regions', label: 'Performance', icon: '📊' },
                        { id: 'admin-workers', label: 'Infrastructure', icon: '👥' },
                        { id: 'create', label: 'Setup', icon: '➕' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '12px 20px',
                                borderRadius: 'var(--radius-md)',
                                background: activeTab === tab.id ? 'var(--bg-main)' : 'transparent',
                                color: activeTab === tab.id ? 'var(--primary-purple)' : 'var(--text-muted)',
                                fontWeight: 800,
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: 'all 0.2s',
                                boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none'
                            }}
                        >
                            <span>{tab.icon}</span> {tab.label}
                            {tab.count > 0 && <span style={{ background: 'var(--error)', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 10 }}>{tab.count}</span>}
                        </button>
                    ))}
                </div>

                {/* Tab Content Rendering */}
                <div style={{ minHeight: 400 }}>
                    {activeTab === 'escalations' && (
                        <div className="job-card" style={{ padding: 32 }}>
                            <h3 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 800 }}>Escalated Resolution Queue</h3>
                            {escalatedBookings.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>✅ No pending escalations.</div>
                            ) : (
                                <div style={{ display: 'grid', gap: 16 }}>
                                    {escalatedBookings.map(b => (
                                        <div key={b.id} style={{ padding: 24, background: 'var(--bg-soft)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--error)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: 18 }}>{b.serviceType} - {b.id.slice(-6)}</div>
                                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Customer: {b.customerName} | Region: {b.area || 'Unknown'}</div>
                                                </div>
                                                <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 900 }}>ESCALATED</div>
                                            </div>
                                            <div style={{ background: 'var(--bg-main)', padding: 16, borderRadius: 12, marginBottom: 20, fontSize: 13 }}>
                                                <strong>Dispute Detail:</strong> {b.dispute?.reason || 'No reason provided'}
                                            </div>
                                            <div style={{ display: 'flex', gap: 12 }}>
                                                <button onClick={() => resolveEscalatedDispute(b, 'refund_user')} className="btn-primary" style={{ background: 'var(--error)' }}>Full Refund</button>
                                                <button onClick={() => resolveEscalatedDispute(b, 'pay_worker')} className="btn-primary" style={{ background: 'var(--success)' }}>Pay Worker</button>
                                                <button onClick={() => resolveEscalatedDispute(b, 'split_payment')} className="btn-primary" style={{ background: 'var(--primary-purple)' }}>Split 50/50</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'travel-review' && (
                        <div className="job-card superadmin-area-intel">
                            <div className="superadmin-area-intel-head">
                                <div>
                                    <h3>Travel Watchdog Reviews</h3>
                                    <p>Delayed travel, stale GPS, and no-show candidates that need human review before score or payout action.</p>
                                </div>
                                <span>{travelReviewRows.length} open / {travelResolvedHistoryRows.length} resolved</span>
                            </div>

                            <div className="superadmin-area-intel-summary">
                                {[
                                    ['Timeout candidates', travelReviewRows.filter(row => row.level === 'timeout_review').length],
                                    ['Support review', travelReviewRows.filter(row => row.level === 'support_review').length],
                                    ['Worker warnings', travelReviewRows.filter(row => row.level === 'worker_warning').length],
                                    ['High priority', travelReviewRows.filter(row => String(row.priority).toLowerCase() === 'high').length],
                                ].map(([label, value]) => (
                                    <div key={label}>
                                        <strong>{value}</strong>
                                        <span>{label}</span>
                                    </div>
                                ))}
                            </div>

                            {travelReviewRows.length === 0 ? (
                                <div className="superadmin-area-intel-empty">
                                    No travel watchdog reviews are open.
                                </div>
                            ) : (
                                <div className="superadmin-area-intel-list">
                                    {travelReviewRows.slice(0, 40).map(row => (
                                        <div key={`${row.bookingId || row.id}_${row.level}`} className={`superadmin-area-intel-row health-${row.level === 'timeout_review' ? 'supply_gap' : 'healthy'}`}>
                                            <div className="superadmin-area-intel-main">
                                                <div>
                                                    <strong>{row.service} / {row.bookingId || 'booking'}</strong>
                                                    <span>{row.consumer} - {row.worker}</span>
                                                </div>
                                                <span className={`superadmin-demand-badge ${row.level === 'timeout_review' ? 'is-peak' : row.level === 'support_review' ? 'is-high' : 'is-normal'}`}>
                                                    {String(row.level).replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                            <div className="superadmin-area-intel-metrics">
                                                <span>Elapsed <strong>{row.elapsedMinutes || 0}m</strong></span>
                                                <span>Stale <strong>{row.staleSeconds || 0}s</strong></span>
                                                <span>Priority <strong>{row.priority}</strong></span>
                                                <span>Status <strong>{row.status}</strong></span>
                                            </div>
                                            <div className="superadmin-area-intel-foot">
                                                <span>{row.nextAction}. No automatic GigScore penalty; confirmed no-show goes to GigScore review.</span>
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                    <button type="button" className="btn-secondary" onClick={() => resolveTravelReview(row, 'worker_contacted')}>
                                                        Contacted
                                                    </button>
                                                    <button type="button" className="btn-secondary" onClick={() => resolveTravelReview(row, 'dismiss_gps_issue')}>
                                                        Dismiss GPS
                                                    </button>
                                                    <button type="button" className="btn-secondary" onClick={() => resolveTravelReview(row, 'confirmed_no_show')}>
                                                        Send No-show Review
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="superadmin-travel-history">
                                <div className="superadmin-area-intel-head">
                                    <div>
                                        <h3>Resolved Travel History</h3>
                                        <p>Closed watchdog decisions kept for audit. These rows are not active queue work and do not change GigScore unless a pending event is finalized.</p>
                                    </div>
                                    <span>{travelResolvedHistoryRows.length} resolved cases</span>
                                </div>

                                {travelResolvedHistoryRows.length === 0 ? (
                                    <div className="superadmin-area-intel-empty">
                                        No resolved travel watchdog history yet.
                                    </div>
                                ) : (
                                    <div className="superadmin-area-intel-list">
                                        {travelResolvedHistoryRows.slice(0, 40).map(row => (
                                            <div key={`resolved_${row.bookingId || row.id}`} className={`superadmin-area-intel-row health-${row.status === 'dismissed' ? 'disabled' : 'healthy'}`}>
                                                <div className="superadmin-area-intel-main">
                                                    <div>
                                                        <strong>{row.service} / {row.bookingId || 'booking'}</strong>
                                                        <span>{row.consumer} - {row.worker}</span>
                                                    </div>
                                                    <span className={`superadmin-demand-badge ${row.status === 'dismissed' ? 'is-low' : 'is-normal'}`}>
                                                        {String(row.status || 'resolved').replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                                <div className="superadmin-area-intel-metrics">
                                                    <span>Decision <strong>{String(row.decision || '').replace(/_/g, ' ')}</strong></span>
                                                    <span>Resolved <strong>{row.resolvedAt || 'time missing'}</strong></span>
                                                    <span>Payout <strong>{String(row.payoutDecision || 'no_payout_change').replace(/_/g, ' ')}</strong></span>
                                                    <span>Score <strong>{row.gigScoreReviewEventId ? 'pending review' : String(row.scoreDecision || 'no_score_change').replace(/_/g, ' ')}</strong></span>
                                                </div>
                                                <div className="superadmin-area-intel-foot">
                                                    <span>{row.reason}</span>
                                                    {row.gigScoreReviewEventId && (
                                                        <span className="superadmin-travel-history-event">
                                                            GigScore review: {row.gigScoreReviewEventId}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'regions' && (
                        <div style={{ display: 'grid', gap: 20 }}>
                            {regionLeads.map(lead => (
                                <div key={lead.id} className="job-card" style={{ padding: 32, borderLeft: `6px solid ${getScoreColor(lead.regionScore)}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                        <div>
                                            <div style={{ fontSize: 22, fontWeight: 900 }}>{lead.name || lead.email}</div>
                                            <div style={{ color: 'var(--primary-purple)', fontWeight: 700 }}>{lead.areaName}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800 }}>PERFORMANCE SCORE</div>
                                            <div style={{ fontSize: 32, fontWeight: 900, color: getScoreColor(lead.regionScore) }}>{lead.regionScore}%</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 20, marginBottom: 24 }}>
                                        <div style={{ background: 'var(--bg-soft)', padding: 16, borderRadius: 12 }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800 }}>DISPUTES</div>
                                            <div style={{ fontSize: 20, fontWeight: 800 }}>{lead.totalDisputes || 0}</div>
                                        </div>
                                        <div style={{ background: 'var(--bg-soft)', padding: 16, borderRadius: 12 }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800 }}>FRAUD</div>
                                            <div style={{ fontSize: 20, fontWeight: 800, color: (lead.fraudCount || 0) > 0 ? 'var(--error)' : 'inherit' }}>{lead.fraudCount || 0}</div>
                                        </div>
                                        <div style={{ background: 'var(--bg-soft)', padding: 16, borderRadius: 12 }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800 }}>MASONS</div>
                                            <div style={{ fontSize: 20, fontWeight: 800 }}>{childAdmins.filter(a => a.parentAdminId === lead.id).length}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        {lead.regionStatus !== 'suspended' 
                                            ? <button onClick={() => suspendRegion(lead.id)} style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--error)', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer' }}>Suspend Region</button>
                                            : <button onClick={() => reinstateRegion(lead.id)} style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--success)', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer' }}>Reinstate Region</button>
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'create' && (
                        <div className="job-card" style={{ padding: 48, maxWidth: 600, margin: '0 auto' }}>
                            <h3 style={{ margin: '0 0 32px 0', fontSize: 24, fontWeight: 800 }}>Commission New Region</h3>
                            <form onSubmit={createRegionAdmin} style={{ display: 'grid', gap: 20 }}>
                                {createError && <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: 16, borderRadius: 12, fontWeight: 700 }}>{createError}</div>}
                                {createSuccess && <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: 16, borderRadius: 12, fontWeight: 700 }}>{createSuccess}</div>}
                                <input placeholder="Region Leader Name" className="input-field" value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})} />
                                <input placeholder="Official Email" className="input-field" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} />
                                <input placeholder="Jurisdiction / Area Name" className="input-field" value={createForm.areaName} onChange={e => setCreateForm({...createForm, areaName: e.target.value})} />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <input type="password" placeholder="Secure Password" className="input-field" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})} />
                                    <input type="password" placeholder="Confirm Password" className="input-field" value={createForm.confirmPassword} onChange={e => setCreateForm({...createForm, confirmPassword: e.target.value})} />
                                </div>
                                <button type="submit" disabled={createLoading} className="btn-primary" style={{ padding: 20 }}>{createLoading ? 'Provisioning...' : 'Confirm Provisioning'}</button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'area-intel' && (
                        <div className="job-card superadmin-area-intel">
                            <div className="superadmin-area-intel-head">
                                <div>
                                    <h3>Area Intelligence</h3>
                                    <p>Founder view for aggregate demand, supply, pricing health, conversion after price shown, and recruiting gaps.</p>
                                </div>
                                <span>{areaIntelSummary.snapshotsWatched} snapshots · {areaIntelSummary.priceQuoteSample} quote samples</span>
                            </div>

                            <div className="superadmin-area-intel-summary">
                                {[
                                    ['Rules', areaIntelSummary.totalRules],
                                    ['Fresh snapshots', areaIntelSummary.freshSnapshots],
                                    ['Stale or missing', areaIntelSummary.staleOrMissing],
                                    ['Supply gaps', areaIntelSummary.supplyGaps],
                                    ['Peak active', areaIntelSummary.peakActive],
                                    ['Low sample', areaIntelSummary.lowSample],
                                    ['Manual overrides', areaIntelSummary.manualOverrides],
                                    ['Price-to-queue', areaIntelSummary.conversionPercent === null ? 'n/a' : `${areaIntelSummary.conversionPercent}%`],
                                ].map(([label, value]) => (
                                    <div key={label}>
                                        <strong>{value}</strong>
                                        <span>{label}</span>
                                    </div>
                                ))}
                            </div>

                            <SuperAdminAreaIntelMap points={areaMapPoints} />

                            <div className="superadmin-growth-insights">
                                <div className="superadmin-growth-insights-head">
                                    <div>
                                        <h4>Growth insights</h4>
                                        <p>Backend-written aggregate signals for recruiting focus, no-worker recovery, and price health.</p>
                                    </div>
                                    <div className="superadmin-ai-health-actions">
                                        <span>{formatTimestamp(areaGrowthHealth?.checkedAt || areaGrowthHealth?.updatedAt)} last refresh</span>
                                        <button type="button" className="btn-secondary" onClick={refreshAreaGrowthInsights} disabled={areaGrowthRefreshing}>
                                            {areaGrowthRefreshing ? 'Refreshing...' : 'Refresh insights'}
                                        </button>
                                    </div>
                                </div>

                                <div className="superadmin-growth-summary">
                                    {[
                                        ['Open insights', areaGrowthInsights.length],
                                        ['Urgent', areaGrowthUrgentCount],
                                        ['High', areaGrowthHighCount],
                                        ['Source', areaGrowthHealth?.source || 'waiting'],
                                    ].map(([label, value]) => (
                                        <div key={label}>
                                            <strong>{value}</strong>
                                            <span>{label}</span>
                                        </div>
                                    ))}
                                </div>

                                {areaGrowthInsights.length === 0 ? (
                                    <div className="superadmin-area-intel-empty">
                                        No open growth insights yet. Run refresh after seeding price rules or after demand snapshots are created.
                                    </div>
                                ) : (
                                    <div className="superadmin-growth-list">
                                        {areaGrowthInsights.slice(0, 8).map(insight => (
                                            <div key={insight.id} className={`superadmin-growth-row priority-${insight.priority || 'medium'}`}>
                                                <div>
                                                    <strong>{insight.title}</strong>
                                                    <span>{insight.city || 'City'} / {insight.areaName || insight.areaId || 'area'} · {insight.serviceName || insight.serviceId || 'service'} · {insight.insightType?.replace(/_/g, ' ')}</span>
                                                </div>
                                                <p>{insight.recommendation}</p>
                                                <div className="superadmin-area-intel-metrics">
                                                    <span>Open <strong>{insight.metrics?.openWorkers ?? 0}</strong></span>
                                                    <span>Jobs <strong>{insight.metrics?.openJobs ?? 0}</strong></span>
                                                    <span>No worker <strong>{insight.metrics?.noWorkerSearches ?? 0}</strong></span>
                                                    <span>Util <strong>{insight.metrics?.utilizationPercent ?? 0}%</strong></span>
                                                    <span>Queue <strong>{insight.metrics?.conversionPercent ?? 'n/a'}{insight.metrics?.conversionPercent == null ? '' : '%'}</strong></span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {areaIntelligenceRows.length === 0 ? (
                                <div className="superadmin-area-intel-empty">
                                    Seed MVP service price rules first. Area intelligence appears after rules and demand snapshots exist.
                                </div>
                            ) : (
                                <div className="superadmin-area-intel-list">
                                    {areaIntelligenceRows.slice(0, 40).map(row => (
                                        <div key={row.id} className={`superadmin-area-intel-row health-${row.health}`}>
                                            <div className="superadmin-area-intel-main">
                                                <div>
                                                    <strong>{row.rule.city || 'City'} / {row.rule.areaId || 'area'}</strong>
                                                    <span>{row.rule.serviceName || row.rule.serviceId || 'Service'} · v{row.rule.version || 1}</span>
                                                </div>
                                                <span className={`superadmin-demand-badge ${getDemandBadgeClass(row.demandLevel)}`}>
                                                    {row.demandLevel}
                                                </span>
                                            </div>

                                            <div className="superadmin-area-intel-metrics">
                                                <span>Open <strong>{row.openWorkers}</strong></span>
                                                <span>Busy <strong>{row.busyWorkers}</strong></span>
                                                <span>Pool <strong>{row.activePoolWorkers}</strong></span>
                                                <span>Jobs <strong>{row.openJobs}</strong></span>
                                                <span>Searches <strong>{row.searches}</strong></span>
                                                <span>No worker <strong>{row.noWorkerSearches}</strong></span>
                                                <span>Util <strong>{row.utilizationPercent}%</strong></span>
                                                <span>Shown <strong>{row.quoteShownCount}</strong></span>
                                                <span>Queue <strong>{row.conversionPercent === null ? 'n/a' : `${row.conversionPercent}%`}</strong></span>
                                            </div>

                                            <div className="superadmin-area-intel-tags">
                                                {row.healthLabels.map(label => (
                                                    <span key={label}>{label}</span>
                                                ))}
                                            </div>

                                            <div className="superadmin-area-intel-foot">
                                                <span>
                                                    {row.health.replace(/_/g, ' ')} · {row.computedAge} · INR {row.recommendedPrice.toLocaleString('en-IN')} · {row.recruitSuggestion}
                                                </span>
                                                <button type="button" className="btn-secondary" onClick={() => { loadPriceRuleIntoForm(row.rule); setActiveTab('pricing'); }}>
                                                    Edit rule
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'worker-verification' && (
                        <div className="job-card superadmin-area-intel">
                            <div className="superadmin-area-intel-head">
                                <div>
                                    <h3>Worker Verification Queue</h3>
                                    <p>Review experienced-worker proof, masked identity status, service/area fit, and uploaded documents before approval.</p>
                                </div>
                                <span>{workerVerificationRows.length} pending</span>
                            </div>

                            {workerVerificationRows.length === 0 ? (
                                <div className="superadmin-area-intel-empty">
                                    No worker verification submissions are pending.
                                </div>
                            ) : (
                                <div className="superadmin-area-intel-list">
                                    {workerVerificationRows.slice(0, 40).map(row => (
                                        <div key={row.id} className="superadmin-area-intel-row health-low_sample">
                                            <div className="superadmin-area-intel-main">
                                                <div>
                                                    <strong>{row.name || row.worker?.name || 'Worker'} / {row.locationArea || row.area || 'area missing'}</strong>
                                                    <span>{(row.serviceIds || row.gigTypes || []).join(', ') || 'service missing'} · {row.experienceYears || 0} yrs · INR {Number(row.startingPrice || 0).toLocaleString('en-IN')}</span>
                                                </div>
                                                <span className="superadmin-demand-badge is-normal">
                                                    {row.reviewStatus || row.verificationStatus || 'pending'}
                                                </span>
                                            </div>

                                            <div className="superadmin-area-intel-metrics">
                                                <span>Phone <strong>{row.phone || 'missing'}</strong></span>
                                                <span>ID <strong>{row.aadhaarMasked || 'not added'}</strong></span>
                                                <span>Proof <strong>{row.externalPlatformProof ? 'yes' : 'check'}</strong></span>
                                                <span>Docs <strong>{row.documentCount || row.documents?.length || 0}</strong></span>
                                                <span>Status <strong>{row.worker?.approvalStatus || 'pending'}</strong></span>
                                            </div>

                                            {row.worker && (
                                                <div style={{
                                                    background: 'var(--bg-soft)',
                                                    border: '1px solid var(--border-light)',
                                                    borderRadius: 10,
                                                    padding: 10,
                                                    marginTop: 10,
                                                    fontSize: 12,
                                                }}>
                                                    <strong>Recovery Training Status:</strong>{' '}
                                                    {row.worker.trainingQuizPassed ? (
                                                        <span style={{ color: 'var(--success)' }}>
                                                            ✓ Passed ({row.worker.trainingQuizScore}/3)
                                                            {row.worker.trainingCompletedAt && ` on ${formatTimestamp(row.worker.trainingCompletedAt)}`}
                                                        </span>
                                                    ) : row.worker.gigScoreStatus === 'recovery' ? (
                                                        <span style={{ color: 'var(--error)' }}>
                                                            ✗ Pending Quiz (Completed: {row.worker.trainingCompleted ? 'Yes' : 'No'})
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)' }}>Not in recovery</span>
                                                    )}
                                                </div>
                                            )}


                                            {Array.isArray(row.documents) && row.documents.length > 0 && (
                                                <div className="superadmin-area-intel-tags">
                                                    {row.documents.map((doc, index) => (
                                                        <a key={`${doc.category}_${index}`} href={doc.downloadUrl} target="_blank" rel="noreferrer">
                                                            {doc.category?.replace(/_/g, ' ') || 'document'}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="superadmin-area-intel-foot">
                                                <span>
                                                    Previous platform: {row.previousPlatformName || 'not named'} {row.previousPlatformMaskedId ? `(${row.previousPlatformMaskedId})` : ''}. Raw identity stored: {row.rawIdentityStored ? 'yes' : 'no'}.
                                                </span>
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                    <button type="button" className="btn-primary" onClick={() => approveWorkerVerification(row)}>
                                                        Approve
                                                    </button>
                                                    <button type="button" className="btn-secondary" onClick={() => rejectWorkerVerification(row)}>
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'ai-health' && (
                        <>
                        <div className="job-card superadmin-ai-health">
                            <div className="superadmin-area-intel-head">
                                <div>
                                    <h3>AI Model Gateway Health</h3>
                                    <p>Backend-only status for Vertex AI, Gemini fallback, and deterministic fallback routing.</p>
                                </div>
                                <span>{formatTimestamp(aiModelGatewayHealth?.checkedAt)} last check</span>
                            </div>

                            <div className={`superadmin-ai-health-banner status-${aiGatewayStatus}`}>
                                <strong>{aiGatewayStatus.replace(/_/g, ' ')}</strong>
                                <span>
                                    {aiGatewayStatus === 'ok'
                                        ? 'Vertex AI answered the latest backend health check.'
                                        : aiGatewayStatus === 'fallback'
                                            ? 'Gemini fallback answered. Keep fallback enabled and check Vertex IAM/API setup.'
                                            : aiGatewayStatus === 'failed'
                                                ? 'No model answered. Review the alert and backend logs before removing fallback.'
                                                : 'Waiting for the first scheduled backend health check.'}
                                </span>
                            </div>

                            <div className="superadmin-ai-health-grid">
                                {[
                                    ['Provider', aiModelGatewayHealth?.modelProvider || 'waiting'],
                                    ['Model', aiModelGatewayHealth?.modelName || aiModelGatewayHealth?.vertexModel || 'waiting'],
                                    ['Vertex project', aiModelGatewayHealth?.vertexProjectId || 'not set'],
                                    ['Location', aiModelGatewayHealth?.vertexLocation || 'not set'],
                                    ['Vertex expected', aiModelGatewayHealth?.vertexExpected ? 'yes' : 'no'],
                                    ['Source', aiModelGatewayHealth?.source || 'scheduled monitor'],
                                ].map(([label, value]) => (
                                    <div key={label}>
                                        <span>{label}</span>
                                        <strong>{value}</strong>
                                    </div>
                                ))}
                            </div>

                            <div className="superadmin-ai-health-copy">
                                <span>Latest safe reply</span>
                                <p>{aiModelGatewayHealth?.replyPreview || aiModelGatewayHealth?.error || 'No backend model response recorded yet.'}</p>
                            </div>

                            <div className="superadmin-area-intel-foot">
                                <span>
                                    Remove Gemini fallback only after this status is ok and provider is vertex_ai.
                                </span>
                                <div className="superadmin-ai-health-actions">
                                    <button type="button" className="btn-secondary" onClick={refreshAiModelGatewayHealth} disabled={aiHealthRefreshing}>
                                        {aiHealthRefreshing ? 'Checking...' : 'Run check'}
                                    </button>
                                    <button type="button" className="btn-secondary" onClick={() => setActiveTab('security')}>
                                        Review security
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="job-card superadmin-ai-health">
                            <div className="superadmin-area-intel-head">
                                <div>
                                    <h3>Sentry Monitoring Health</h3>
                                    <p>Backend ingest, Sentry Cron canary, and setup status for production incident monitoring.</p>
                                </div>
                                <span>{formatTimestamp(sentryCanaryHealth?.lastCheckInAt || sentryIssueIngestHealth?.healthCheckedAt || sentryIssueIngestHealth?.updatedAt)} last check</span>
                            </div>

                            <div className="superadmin-sentry-health-grid">
                                <div className={`superadmin-ai-health-banner status-${sentryIngestStatus}`}>
                                    <strong>Issue ingest: {getSentryStatusCopy(sentryIngestStatus)}</strong>
                                    <span>
                                        {sentryIngestStatus === 'ok'
                                            ? `Synced ${sentryIssueIngestHealth?.issueCount ?? 0} unresolved Sentry issue summaries.`
                                            : sentryIngestStatus === 'needs_attention'
                                                ? sentryIssueIngestHealth?.healthReason || 'Sentry ingest is failed, stale, or partially configured.'
                                                : sentryIssueIngestHealth?.reason || sentryIssueIngestHealth?.error || 'Waiting for scheduled Sentry issue ingest.'}
                                    </span>
                                </div>

                                <div className={`superadmin-ai-health-banner status-${sentryCanaryStatus}`}>
                                    <strong>Canary: {getSentryStatusCopy(sentryCanaryStatus)}</strong>
                                    <span>
                                        {sentryCanaryStatus === 'ok'
                                            ? 'Sentry Cron monitor is verified and receiving backend check-ins.'
                                            : sentryCanaryStatus === 'needs_monitor_setup'
                                                ? 'Create the Sentry Cron monitor or provide a token with monitor creation permission.'
                                                : sentryCanaryHealth?.reason || sentryCanaryHealth?.error || 'Waiting for backend canary heartbeat.'}
                                    </span>
                                </div>
                            </div>

                            <div className="superadmin-ai-health-grid">
                                {[
                                    ['Ingest projects', sentryIssueIngestHealth?.projectCount ?? 'waiting'],
                                    ['Issues', sentryIssueIngestHealth?.issueCount ?? 'waiting'],
                                    ['High severity', sentryIssueIngestHealth?.highSeverityCount ?? 'waiting'],
                                    ['Issue handoff', sentryIssueIngestHealth?.jiraProvider || (sentryIssueIngestHealth?.jiraConfigured ? 'atlassian' : 'waiting')],
                                    ['Canary monitor', sentryCanaryHealth?.monitorSlug || 'gigtos-backend-sentry-canary'],
                                    ['Canary verification', sentryCanaryHealth?.monitorVerification?.status || 'waiting'],
                                ].map(([label, value]) => (
                                    <div key={label}>
                                        <span>{label}</span>
                                        <strong>{value}</strong>
                                    </div>
                                ))}
                            </div>

                            <div className="superadmin-ai-health-copy">
                                <span>Next action</span>
                                <p>
                                    {sentryCanaryStatus === 'needs_monitor_setup'
                                        ? 'Create Sentry Cron monitor slug gigtos-backend-sentry-canary in the backend node project, or replace the token with one that can create monitors.'
                                        : sentryIngestStatus === 'needs_attention'
                                            ? sentryIssueIngestHealth?.healthReason || 'Review Sentry ingest configuration and scheduled function logs.'
                                            : 'Sentry monitoring is wired. Keep watching this panel after the first live Cron monitor check-in.'}
                                </p>
                            </div>

                            <div className="superadmin-area-intel-foot">
                                <span>
                                    Raw Sentry payloads are not stored; this panel reads sanitized backend health records only.
                                </span>
                                <div className="superadmin-ai-health-actions">
                                    <button type="button" className="btn-secondary" onClick={refreshSentryCanaryHealth} disabled={sentryCanaryRefreshing}>
                                        {sentryCanaryRefreshing ? 'Checking...' : 'Run canary check'}
                                    </button>
                                    <button type="button" className="btn-secondary" onClick={() => setActiveTab('security')}>
                                        Review security
                                    </button>
                                </div>
                            </div>
                        </div>
                        </>
                    )}

                    {activeTab === 'copper' && (
                        <div className="job-card" style={{ padding: 32 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 28 }}>
                                <div>
                                    <h3 style={{ margin: '0 0 8px 0', fontSize: 22, fontWeight: 900 }}>Copper Monitoring Controls</h3>
                                    <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                        Watch low-score consumers, workers, and guilds closely while always showing a clear recovery path.
                                    </p>
                                </div>
                                <button onClick={saveCopperSettings} className="btn-primary" style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                                    Save Controls
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
                                <div style={{ background: 'var(--bg-soft)', padding: 18, borderRadius: 12 }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 900 }}>COPPER CONSUMERS</div>
                                    <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--warning)' }}>{copperSummary.copperConsumersCount}</div>
                                </div>
                                <div style={{ background: 'var(--bg-soft)', padding: 18, borderRadius: 12 }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 900 }}>COPPER WORKERS</div>
                                    <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--warning)' }}>{copperSummary.copperWorkersCount}</div>
                                </div>
                                <div style={{ background: 'var(--bg-soft)', padding: 18, borderRadius: 12 }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 900 }}>COPPER GUILDS</div>
                                    <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--warning)' }}>{copperSummary.copperGuildsCount}</div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginBottom: 24 }}>
                                <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                    Copper score threshold
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={copperSettings.threshold}
                                        onChange={e => setCopperSettings({ ...copperSettings, threshold: Number(e.target.value) })}
                                    />
                                </label>
                                <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                    Recovery discount %
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={copperSettings.recoveryDiscountPercent}
                                        onChange={e => setCopperSettings({ ...copperSettings, recoveryDiscountPercent: Number(e.target.value) })}
                                    />
                                </label>
                                <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                    Monitor every hours
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={copperSettings.alertFrequencyHours}
                                        onChange={e => setCopperSettings({ ...copperSettings, alertFrequencyHours: Number(e.target.value) })}
                                    />
                                </label>
                                <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                    Score-drop sensitivity
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={copperSettings.scoreDropSensitivity}
                                        onChange={e => setCopperSettings({ ...copperSettings, scoreDropSensitivity: Number(e.target.value) })}
                                    />
                                </label>
                            </div>

                            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800, marginBottom: 24 }}>
                                <input
                                    type="checkbox"
                                    checked={copperSettings.cityEnabled}
                                    onChange={e => setCopperSettings({ ...copperSettings, cityEnabled: e.target.checked })}
                                />
                                Enable Copper monitoring for active launch cities
                            </label>

                            <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: 18, borderRadius: 12, lineHeight: 1.6, fontWeight: 700 }}>
                                Recovery rule: Copper users and workers must see exact reasons, next clean actions, and the shortest honest path back to Silver.
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="job-card" style={{ padding: 32 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 28 }}>
                                <div>
                                    <h3 style={{ margin: '0 0 8px 0', fontSize: 22, fontWeight: 900 }}>Security Controls</h3>
                                    <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                        Enroll SuperAdmin phone MFA before enabling hard backend enforcement for payouts, pricing, admin provisioning, and fraud controls.
                                    </p>
                                </div>
                                <div style={{
                                    background: mfaFactors.length ? 'var(--success-bg)' : 'var(--warning-bg)',
                                    color: mfaFactors.length ? 'var(--success)' : 'var(--warning)',
                                    padding: '10px 14px',
                                    borderRadius: 12,
                                    fontWeight: 900,
                                }}>
                                    {mfaFactors.length ? 'MFA Ready' : 'MFA Required'}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, marginBottom: 24 }}>
                                <div style={{ border: '1px solid var(--border-light)', borderRadius: 12, padding: 18 }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontWeight: 900 }}>Enrolled factors</h4>
                                    {mfaFactors.length ? (
                                        <div style={{ display: 'grid', gap: 10 }}>
                                            {mfaFactors.map(factor => (
                                                <div key={factor.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: 'var(--bg-soft)', borderRadius: 10, padding: 12 }}>
                                                    <div>
                                                        <div style={{ fontWeight: 900 }}>{factor.displayName || 'Phone MFA'}</div>
                                                        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{factor.phoneNumber || factor.factorId}</div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeMfaFactor(factor)}
                                                        disabled={mfaLoading}
                                                        className="btn-secondary"
                                                        style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                                            No MFA factor is enrolled on this SuperAdmin account yet.
                                        </p>
                                    )}
                                </div>

                                <div style={{ border: '1px solid var(--border-light)', borderRadius: 12, padding: 18 }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontWeight: 900 }}>Add phone MFA</h4>
                                    <div style={{ display: 'grid', gap: 12 }}>
                                        <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                            Phone number
                                            <input
                                                className="input-field"
                                                value={mfaPhone}
                                                onChange={e => setMfaPhone(e.target.value)}
                                                placeholder="+919876543210"
                                                disabled={mfaLoading || !!mfaVerificationId}
                                            />
                                        </label>
                                        {mfaVerificationId && (
                                            <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                                SMS code
                                                <input
                                                    className="input-field"
                                                    value={mfaCode}
                                                    onChange={e => setMfaCode(e.target.value)}
                                                    inputMode="numeric"
                                                    placeholder="123456"
                                                    disabled={mfaLoading}
                                                />
                                            </label>
                                        )}
                                        {mfaError && (
                                            <div style={{ color: 'var(--error)', fontWeight: 800, fontSize: 13 }}>
                                                {mfaError}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                            {!mfaVerificationId ? (
                                                <button type="button" className="btn-primary" onClick={startMfaEnrollment} disabled={mfaLoading}>
                                                    {mfaLoading ? 'Sending...' : 'Send SMS code'}
                                                </button>
                                            ) : (
                                                <>
                                                    <button type="button" className="btn-primary" onClick={completeMfaEnrollment} disabled={mfaLoading}>
                                                        {mfaLoading ? 'Enrolling...' : 'Confirm MFA'}
                                                    </button>
                                                    <button type="button" className="btn-secondary" onClick={() => { setMfaVerificationId(''); setMfaCode(''); }} disabled={mfaLoading}>
                                                        Cancel
                                                    </button>
                                                </>
                                            )}
                                            <button type="button" className="btn-secondary" onClick={refreshMfaFactors} disabled={mfaLoading}>
                                                Refresh
                                            </button>
                                        </div>
                                        <div id="superadmin-mfa-recaptcha" />
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: 'var(--warning-bg)', color: 'var(--warning)', padding: 18, borderRadius: 12, lineHeight: 1.6, fontWeight: 700 }}>
                                Backend hard enforcement remains staged until REQUIRE_SUPERADMIN_MFA=true is set in Functions environment. Enroll owner accounts first, then enable it.
                            </div>
                        </div>
                    )}

                    {activeTab === 'pricing' && (
                        <div className="job-card" style={{ padding: 32 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 28 }}>
                                <div>
                                    <h3 style={{ margin: '0 0 8px 0', fontSize: 22, fontWeight: 900 }}>Pricing Controls</h3>
                                    <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                        Superadmin controls the Gigtos platform fee. The payment gateway fee is shown to consumers and added to the Razorpay amount.
                                    </p>
                                </div>
                                <button onClick={savePricingControls} className="btn-primary" style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                                    Save Pricing
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginBottom: 24 }}>
                                <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                    Platform fee mode
                                    <select
                                        className="input-field"
                                        value={pricingSettings.platformFeeMode}
                                        onChange={e => setPricingSettings({ ...pricingSettings, platformFeeMode: e.target.value })}
                                    >
                                        <option value="tiered">Tiered launch fee</option>
                                        <option value="flat">Flat fee</option>
                                        <option value="percent">Percent of worker rate</option>
                                    </select>
                                </label>
                                <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                    Flat platform fee
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={pricingSettings.platformFeeFlat}
                                        onChange={e => setPricingSettings({ ...pricingSettings, platformFeeFlat: Number(e.target.value) })}
                                    />
                                </label>
                                <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                    Platform fee %
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={pricingSettings.platformFeePercent}
                                        onChange={e => setPricingSettings({ ...pricingSettings, platformFeePercent: Number(e.target.value) })}
                                    />
                                </label>
                                <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                    Payment gateway %
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={pricingSettings.gatewayFeePercent}
                                        onChange={e => setPricingSettings({ ...pricingSettings, gatewayFeePercent: Number(e.target.value) })}
                                    />
                                </label>
                                <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                    Tier low max
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={pricingSettings.tieredFeeLowMax ?? DEFAULT_PRICING_SETTINGS.tieredFeeLowMax}
                                        onChange={e => setPricingSettings({ ...pricingSettings, tieredFeeLowMax: Number(e.target.value) })}
                                    />
                                </label>
                                <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                    Tier low fee
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={pricingSettings.tieredFeeLow ?? DEFAULT_PRICING_SETTINGS.tieredFeeLow}
                                        onChange={e => setPricingSettings({ ...pricingSettings, tieredFeeLow: Number(e.target.value) })}
                                    />
                                </label>
                                <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                    Tier mid max
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={pricingSettings.tieredFeeMidMax ?? DEFAULT_PRICING_SETTINGS.tieredFeeMidMax}
                                        onChange={e => setPricingSettings({ ...pricingSettings, tieredFeeMidMax: Number(e.target.value) })}
                                    />
                                </label>
                                <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                    Tier mid fee
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={pricingSettings.tieredFeeMid ?? DEFAULT_PRICING_SETTINGS.tieredFeeMid}
                                        onChange={e => setPricingSettings({ ...pricingSettings, tieredFeeMid: Number(e.target.value) })}
                                    />
                                </label>
                                <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                    Tier high base
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={pricingSettings.tieredFeeBase ?? DEFAULT_PRICING_SETTINGS.tieredFeeBase}
                                        onChange={e => setPricingSettings({ ...pricingSettings, tieredFeeBase: Number(e.target.value) })}
                                    />
                                </label>
                                <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                    Tier high %
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={pricingSettings.tieredFeePercentAboveMid ?? DEFAULT_PRICING_SETTINGS.tieredFeePercentAboveMid}
                                        onChange={e => setPricingSettings({ ...pricingSettings, tieredFeePercentAboveMid: Number(e.target.value) })}
                                    />
                                </label>
                                <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                    Payout hold minutes
                                    <input
                                        type="number"
                                        min={PAYOUT_HOLD_MINUTES_MIN}
                                        max={PAYOUT_HOLD_MINUTES_MAX}
                                        step="15"
                                        className="input-field"
                                        value={pricingSettings.payoutHoldMinutes}
                                        onChange={e => setPricingSettings({ ...pricingSettings, payoutHoldMinutes: Number(e.target.value) })}
                                    />
                                    <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
                                        Superadmin can set {PAYOUT_HOLD_MINUTES_MIN} minutes to 24 hours. Effective clamped window: {formatPayoutHoldDuration(normalizePricingSettings(pricingSettings).payoutHoldMinutes)}.
                                    </span>
                                </label>
                            </div>

                            <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: 18, borderRadius: 12, lineHeight: 1.6, fontWeight: 700 }}>
                                Consumer total = worker rate + platform fee + {pricingSettings.gatewayFeePercent}% payment gateway fee. Consumer payment stays held until work completion, then worker payout opens after {formatPayoutHoldDuration(pricingSettings.payoutHoldMinutes)} if no dispute is raised.
                            </div>

                            <div className="superadmin-price-rule-panel">
                                <div className="superadmin-price-rule-head">
                                    <div>
                                        <h3>MVP Service Price Rules</h3>
                                        <p>
                                            These rules unlock worker Open-to-Work and consumer demand pricing. Seed an area first, then tune each service.
                                        </p>
                                    </div>
                                    <button type="button" className="btn-secondary" onClick={seedMvpPriceRules} disabled={priceRuleSaving}>
                                        {priceRuleSaving ? 'Saving...' : 'Seed area rules'}
                                    </button>
                                </div>

                                <div className="superadmin-price-rule-grid">
                                    <label>
                                        City
                                        <input className="input-field" value={priceRuleForm.city} onChange={e => updatePriceRuleField('city', e.target.value)} />
                                    </label>
                                    <label>
                                        Area name
                                        <input className="input-field" value={priceRuleForm.areaName} onChange={e => updatePriceRuleField('areaName', e.target.value)} />
                                    </label>
                                    <label>
                                        Area ID
                                        <input className="input-field" value={priceRuleForm.areaId} onChange={e => updatePriceRuleField('areaId', e.target.value)} />
                                    </label>
                                    <label>
                                        Area center lat
                                        <input
                                            type="number"
                                            step="0.000001"
                                            className="input-field"
                                            value={priceRuleForm.areaCenterLat ?? ''}
                                            onChange={e => updatePriceRuleField('areaCenterLat', e.target.value)}
                                            placeholder="Aggregate map center"
                                        />
                                    </label>
                                    <label>
                                        Area center lng
                                        <input
                                            type="number"
                                            step="0.000001"
                                            className="input-field"
                                            value={priceRuleForm.areaCenterLng ?? ''}
                                            onChange={e => updatePriceRuleField('areaCenterLng', e.target.value)}
                                            placeholder="Aggregate map center"
                                        />
                                    </label>
                                    <label>
                                        Service
                                        <select className="input-field" value={priceRuleForm.serviceId} onChange={e => updatePriceRuleField('serviceId', e.target.value)}>
                                            {MVP_PRICE_SERVICE_OPTIONS.map(service => (
                                                <option key={service.serviceId} value={service.serviceId}>{service.serviceName}</option>
                                            ))}
                                        </select>
                                    </label>
                                    {[
                                        ['minPrice', 'Min price'],
                                        ['normalPrice', 'Normal price'],
                                        ['highPrice', 'High price'],
                                        ['peakPrice', 'Peak price'],
                                        ['maxAllowedPrice', 'Max cap'],
                                        ['workerMinPrice', 'Worker min'],
                                        ['workerMaxPrice', 'Worker max'],
                                        ['minimumWorkerThreshold', 'Min worker threshold'],
                                        ['peakUtilizationPercent', 'Peak utilization %'],
                                    ].map(([field, label]) => (
                                        <label key={field}>
                                            {label}
                                            <input
                                                type="number"
                                                className="input-field"
                                                value={priceRuleForm[field]}
                                                onChange={e => updatePriceRuleField(field, Number(e.target.value))}
                                            />
                                        </label>
                                    ))}
                                    <label>
                                        Manual demand
                                        <select className="input-field" value={priceRuleForm.manualDemandLevel} onChange={e => updatePriceRuleField('manualDemandLevel', e.target.value)}>
                                            <option value="">Snapshot decides</option>
                                            <option value="low">Low</option>
                                            <option value="normal">Normal</option>
                                            <option value="high">High</option>
                                            <option value="peak">Peak</option>
                                        </select>
                                        <small className="superadmin-price-rule-helper">
                                            Manual demand beats snapshots only with an audit reason. Disabled rules, worker caps, and max caps still win.
                                        </small>
                                    </label>
                                    <label>
                                        Enabled
                                        <select className="input-field" value={priceRuleForm.enabled ? 'yes' : 'no'} onChange={e => updatePriceRuleField('enabled', e.target.value === 'yes')}>
                                            <option value="yes">Enabled</option>
                                            <option value="no">Disabled</option>
                                        </select>
                                    </label>
                                </div>

                                <label className="superadmin-price-rule-reason">
                                    Manual override reason / note
                                    <textarea
                                        className="input-field"
                                        rows={3}
                                        value={priceRuleForm.manualOverrideReason}
                                        onChange={e => updatePriceRuleField('manualOverrideReason', e.target.value)}
                                        placeholder="Example: Festival demand spike verified from searches and no-worker bookings."
                                    />
                                </label>

                                <div className="superadmin-price-rule-actions">
                                    <button type="button" className="btn-primary" onClick={saveServicePriceRule} disabled={priceRuleSaving}>
                                        {priceRuleSaving ? 'Saving...' : 'Save service rule'}
                                    </button>
                                    <span>
                                        Hierarchy: disabled rule, worker cap, SuperAdmin manual demand with reason, fresh snapshot, safe normal fallback, then max cap.
                                    </span>
                                </div>

                                <div className="superadmin-price-rule-list">
                                    <div className="superadmin-price-rule-list-head">
                                        <strong>Existing MVP rules</strong>
                                        <span>{servicePriceRules.length} rules</span>
                                    </div>
                                    {servicePriceRules.length === 0 ? (
                                        <div className="superadmin-price-rule-empty">No service price rules yet. Seed an MVP area to start.</div>
                                    ) : (
                                        servicePriceRules.slice(0, 24).map(rule => (
                                            <button type="button" key={rule.id} className="superadmin-price-rule-row" onClick={() => loadPriceRuleIntoForm(rule)}>
                                                <span>
                                                    <strong>{rule.serviceName || rule.serviceId}</strong>
                                                    <small>{rule.city} / {rule.areaId} / v{rule.version || 1}</small>
                                                </span>
                                                <span>
                                                    INR {Number(rule.minPrice || 0).toLocaleString('en-IN')} - {Number(rule.maxAllowedPrice || 0).toLocaleString('en-IN')}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'payments' && (
                        <div className="job-card" style={{ padding: 32 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 24 }}>
                                <div>
                                    <h3 style={{ margin: '0 0 8px 0', fontSize: 22, fontWeight: 900 }}>Payment Operations</h3>
                                    <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                        Worker payouts and consumer refunds created from dispute decisions. Manual rows need finance review when RazorpayX or payment IDs are not configured.
                                    </p>
                                </div>
                                <div style={{ background: 'var(--bg-soft)', padding: '10px 14px', borderRadius: 12, fontWeight: 900 }}>
                                    {paymentOperations.length} operations
                                </div>
                            </div>
                            {paymentOperations.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>No payment operations yet.</div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid var(--border-light)', textAlign: 'left' }}>
                                                <th style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>TYPE</th>
                                                <th style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>BOOKING</th>
                                                <th style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>AMOUNT</th>
                                                <th style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>STATUS</th>
                                                <th style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>DESTINATION</th>
                                                <th style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>ACTION</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paymentOperations.slice(0, 50).map(op => (
                                                <tr key={op.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                    <td style={{ padding: 12, fontSize: 13, fontWeight: 800 }}>{op.type}</td>
                                                    <td style={{ padding: 12, fontSize: 13 }}>{op.bookingId?.slice?.(-8) || op.bookingId}</td>
                                                    <td style={{ padding: 12, fontSize: 13 }}>₹{Number(op.amount || 0).toLocaleString('en-IN')}</td>
                                                    <td style={{ padding: 12 }}>
                                                        <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', padding: '4px 8px', borderRadius: 4, background: op.status?.includes('requested') ? 'var(--success-bg)' : 'var(--warning-bg)', color: op.status?.includes('requested') ? 'var(--success)' : 'var(--warning)' }}>
                                                            {op.status || 'pending'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                                                        {op.razorpayPayoutId || op.razorpayRefundId || op.bankAccount?.accountNumberMasked || op.bankAccount?.ifscMasked || op.refundBankAccount?.ifsc || 'Razorpay source refund'}
                                                    </td>
                                                    <td style={{ padding: 12 }}>
                                                        {op.type === 'worker_payout' && op.bookingId ? (
                                                            op.status === 'manual_hold' ? (
                                                                <button type="button" className="btn-secondary" onClick={() => releaseWorkerPayoutHold(op)} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                                                                    Release hold
                                                                </button>
                                                            ) : (
                                                                <button type="button" className="btn-secondary" onClick={() => holdWorkerPayout(op)} style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                                                                    Hold payout
                                                                </button>
                                                            )
                                                        ) : (
                                                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'gigscore-review' && (
                        <div className="job-card" style={{ padding: 32 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 24 }}>
                                <div>
                                    <h3 style={{ margin: '0 0 8px 0', fontSize: 22, fontWeight: 900 }}>GigScore Review Queue</h3>
                                    <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                        Low ratings, suspicious score events, and confirmed travel no-shows stay pending here until evidence is checked.
                                    </p>
                                </div>
                                <div style={{ background: 'var(--bg-soft)', padding: '10px 14px', borderRadius: 12, fontWeight: 900 }}>
                                    {pendingGigScoreEvents.length} pending
                                </div>
                            </div>

                            {pendingGigScoreEvents.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>
                                    No pending GigScore events.
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: 14 }}>
                                    {pendingGigScoreEvents.slice(0, 30).map(event => (
                                        <div key={event.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center', padding: 18, background: 'var(--bg-soft)', border: '1px solid var(--border-light)', borderRadius: 14 }}>
                                            <div>
                                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                                                    <strong>{event.actorRole} · {event.reasonCode}</strong>
                                                    <span style={{ padding: '2px 8px', borderRadius: 999, background: Number(event.delta || 0) < 0 ? 'var(--error-bg)' : 'var(--success-bg)', color: Number(event.delta || 0) < 0 ? 'var(--error)' : 'var(--success)', fontWeight: 900 }}>
                                                        {Number(event.delta || 0) >= 0 ? '+' : ''}{event.delta}
                                                    </span>
                                                </div>
                                                <div style={{ color: 'var(--text-main)', marginBottom: 6 }}>{event.reasonText}</div>
                                                {event.handoffType === 'travel_watchdog_confirmed_no_show' && (
                                                    <div style={{ color: 'var(--warning)', fontSize: 13, fontWeight: 800, marginBottom: 6 }}>
                                                        Travel watchdog handoff: check route evidence, support ticket, and party contact notes before finalizing.
                                                    </div>
                                                )}
                                                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                                                    Actor: {event.actorId} · Booking: {event.bookingId || 'none'} · Advice: {event.improvementAdvice || 'Review evidence and decide.'}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                <button onClick={() => reviewGigScoreEvent(event.id, 'finalize')} className="btn-primary" style={{ padding: '10px 14px' }}>
                                                    Finalize
                                                </button>
                                                <button onClick={() => reviewGigScoreEvent(event.id, 'reverse')} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--error)', color: 'var(--error)', background: 'var(--bg-main)', fontWeight: 800, cursor: 'pointer' }}>
                                                    Reverse
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* GigScore Controls Settings Editor */}
                            <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid var(--border-light)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 28 }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 900 }}>GigScore Platform Controls</h3>
                                        <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                            Configure platform-wide rules, inactivity decay rates, Elite/Diamond thresholds, and Guild boundaries.
                                        </p>
                                    </div>
                                    <button onClick={saveGigscoreSettings} className="btn-primary" style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                                        Save GigScore Controls
                                    </button>
                                </div>

                                <div style={{ display: 'grid', gap: 24 }}>
                                    {/* Section 1: Core Thresholds & Recovery */}
                                    <div>
                                        <h4 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 800, color: 'var(--primary-purple)' }}>Core Thresholds & Recovery</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
                                            <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                                Copper score threshold
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={gigscoreSettings.copperThreshold}
                                                    onChange={e => setGigscoreSettings({ ...gigscoreSettings, copperThreshold: Number(e.target.value) })}
                                                />
                                            </label>
                                            <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                                Recovery discount %
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={gigscoreSettings.recoveryDiscountPercent}
                                                    onChange={e => setGigscoreSettings({ ...gigscoreSettings, recoveryDiscountPercent: Number(e.target.value) })}
                                                />
                                            </label>
                                            <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                                Worker Freeze score
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={gigscoreSettings.workerFreezeBelow}
                                                    onChange={e => setGigscoreSettings({ ...gigscoreSettings, workerFreezeBelow: Number(e.target.value) })}
                                                />
                                            </label>
                                            <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                                Worker Recovery threshold
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={gigscoreSettings.workerRecoveryBelow}
                                                    onChange={e => setGigscoreSettings({ ...gigscoreSettings, workerRecoveryBelow: Number(e.target.value) })}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    {/* Section 2: Inactivity Decay Rules */}
                                    <div>
                                        <h4 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 800, color: 'var(--primary-purple)' }}>Inactivity Decay Rules</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
                                            <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                                Inactivity Floor
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={gigscoreSettings.inactivityFloor}
                                                    onChange={e => setGigscoreSettings({ ...gigscoreSettings, inactivityFloor: Number(e.target.value) })}
                                                />
                                            </label>
                                            <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                                Decay delay (days)
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={gigscoreSettings.inactivityDecayAfterDays}
                                                    onChange={e => setGigscoreSettings({ ...gigscoreSettings, inactivityDecayAfterDays: Number(e.target.value) })}
                                                />
                                            </label>
                                            <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                                Worker decay delta
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={gigscoreSettings.workerInactivityDecay}
                                                    onChange={e => setGigscoreSettings({ ...gigscoreSettings, workerInactivityDecay: Number(e.target.value) })}
                                                />
                                            </label>
                                            <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                                Consumer decay delta
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={gigscoreSettings.consumerInactivityDecay}
                                                    onChange={e => setGigscoreSettings({ ...gigscoreSettings, consumerInactivityDecay: Number(e.target.value) })}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    {/* Section 3: Elite & Diamond Tiers */}
                                    <div>
                                        <h4 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 800, color: 'var(--primary-purple)' }}>Elite & Diamond Tiers</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
                                            <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                                Diamond Worker price premium %
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={gigscoreSettings.diamondWorkerOptionalPriceIncreasePercent}
                                                    onChange={e => setGigscoreSettings({ ...gigscoreSettings, diamondWorkerOptionalPriceIncreasePercent: Number(e.target.value) })}
                                                />
                                            </label>
                                            <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                                Elite Consumer min real consumers
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={gigscoreSettings.eliteConsumerMinimumRealConsumers}
                                                    onChange={e => setGigscoreSettings({ ...gigscoreSettings, eliteConsumerMinimumRealConsumers: Number(e.target.value) })}
                                                />
                                            </label>
                                            <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                                Elite Consumer discount %
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={gigscoreSettings.eliteConsumerDiscountPercent}
                                                    onChange={e => setGigscoreSettings({ ...gigscoreSettings, eliteConsumerDiscountPercent: Number(e.target.value) })}
                                                />
                                            </label>
                                            <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                                Elite Consumer monthly booking limit
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={gigscoreSettings.eliteConsumerMonthlyBookingLimit}
                                                    onChange={e => setGigscoreSettings({ ...gigscoreSettings, eliteConsumerMonthlyBookingLimit: Number(e.target.value) })}
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    {/* Section 4: Guild Boundaries */}
                                    <div>
                                        <h4 style={{ margin: '0 0 14px 0', fontSize: 16, fontWeight: 800, color: 'var(--primary-purple)' }}>Guild Boundaries</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
                                            <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                                Min Guild Members
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={gigscoreSettings.guildMinMembers}
                                                    onChange={e => setGigscoreSettings({ ...gigscoreSettings, guildMinMembers: Number(e.target.value) })}
                                                />
                                            </label>
                                            <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                                Max Guild Members
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={gigscoreSettings.guildMaxMembers}
                                                    onChange={e => setGigscoreSettings({ ...gigscoreSettings, guildMaxMembers: Number(e.target.value) })}
                                                />
                                            </label>
                                            <label style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
                                                Guild Diamond Shield Days
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    value={gigscoreSettings.guildDiamondShieldDays}
                                                    onChange={e => setGigscoreSettings({ ...gigscoreSettings, guildDiamondShieldDays: Number(e.target.value) })}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Infrastructure Tab (Child Admins/Masons) */}
                    {activeTab === 'admin-workers' && (
                         <div className="job-card" style={{ padding: 32 }}>
                            <h3 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 800 }}>Logistics Network</h3>
                            <div style={{ display: 'grid', gap: 32 }}>
                                {regionLeads.map(rl => {
                                    const masons = childAdmins.filter(a => a.parentAdminId === rl.id);
                                    return (
                                        <div key={rl.id} style={{ borderBottom: '1px solid var(--border-light)', pb: 32 }}>
                                            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--primary-purple)', mb: 16 }}>🌐 {rl.name} ({rl.areaName})</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                                                {masons.map(m => (
                                                    <div key={m.id} style={{ background: 'var(--bg-soft)', padding: 16, borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 800 }}>{m.name}</div>
                                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.email}</div>
                                                        </div>
                                                        <button onClick={() => unassignAdminFromRegionLead(m.id)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--error)', color: 'var(--error)', background: 'transparent', fontSize: 10, fontWeight: 800 }}>DETACH</button>
                                                    </div>
                                                ))}
                                                {masons.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', italic: true }}>No masons assigned to this region.</div>}
                                            </div>
                                        </div>
                                    )
                                })}
                                
                                {unassignedAdmins.length > 0 && (
                                    <div style={{ background: 'var(--warning-bg)', padding: 24, borderRadius: 16, border: '1px dashed var(--warning)' }}>
                                        <h4 style={{ margin: '0 0 16px 0', color: 'var(--warning)', fontWeight: 800 }}>⚠️ Unassigned Logisticians (Masons)</h4>
                                        <div style={{ display: 'grid', gap: 12 }}>
                                            {unassignedAdmins.map(a => (
                                                <div key={a.id} style={{ background: 'var(--bg-main)', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 700 }}>{a.name} ({a.email})</span>
                                                    <select 
                                                        onChange={(e) => e.target.value && assignAdminToRegionLead(a.id, e.target.value)}
                                                        style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--bg-soft)', color: 'var(--text-main)', border: '1px solid var(--border-light)' }}
                                                    >
                                                        <option value="">Assign to Region...</option>
                                                        {regionLeads.map(rl => <option key={rl.id} value={rl.id}>{rl.name} ({rl.areaName})</option>)}
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                         </div>
                    )}
                    
                    {/* Monitor Tab */}
                    {activeTab === 'work-status' && (
                        <div className="job-card" style={{ padding: 32 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 24 }}>
                                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Global Operation Monitor</h3>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <input placeholder="Search customer..." className="input-field" style={{ width: 200, padding: '8px 12px' }} value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
                                    <select className="input-field" style={{ padding: '8px 12px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                        <option value="all">All Status</option>
                                        <option value="pending">Pending</option>
                                        <option value="in_progress">Active</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20 }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-light)', textAlign: 'left' }}>
                                            <th style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>JOB ID</th>
                                            <th style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>CUSTOMER</th>
                                            <th style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>SERVICE</th>
                                            <th style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>STATUS</th>
                                            <th style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>REGION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredBookings.map(b => (
                                            <tr key={b.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                <td style={{ padding: 12, fontSize: 13, fontWeight: 700 }}>#{b.id.slice(-6)}</td>
                                                <td style={{ padding: 12, fontSize: 13 }}>{b.customerName}</td>
                                                <td style={{ padding: 12, fontSize: 13 }}>{b.serviceType}</td>
                                                <td style={{ padding: 12 }}>
                                                    <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', padding: '4px 8px', borderRadius: 4, background: b.status === 'completed' ? 'var(--success-bg)' : 'var(--bg-soft)', color: b.status === 'completed' ? 'var(--success)' : 'inherit' }}>{b.status}</span>
                                                </td>
                                                <td style={{ padding: 12, fontSize: 13 }}>{b.area || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
