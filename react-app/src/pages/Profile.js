import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../firebase";
import { useLocation as useUserLocation } from "../context/LocationContext";
import GigScoreSpeedometer from "../components/GigScoreSpeedometer";
import { getDevBypassUserFromSearch, isDevBypassEnabled } from "../utils/devBypass";
import { EMPTY_BANK_ACCOUNT, maskAccountNumber, normalizeBankAccount, validateBankAccount } from "../utils/bankDetails";
import "./Profile.css";

export default function Profile() {
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    locationCity: "",
    locationArea: "",
    state: "",
    postalCode: "",
    locationLat: null,
    locationLng: null,
    photoURL: "",
    gigScore: 0,
    socioScore: 0,
    gigScoreTier: "Copper",
    refundBankAccount: EMPTY_BANK_ACCOUNT,
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cashbacks, setCashbacks] = useState([]);
  const [gigScoreEvents, setGigScoreEvents] = useState([]);
  const [authUser, setAuthUser] = useState(() => auth.currentUser);
  const [authStateReady, setAuthStateReady] = useState(() => Boolean(auth.currentUser));
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const userDetectRef = useRef(false);
  const routeLocation = useLocation();
  const devUser = useMemo(
    () => (isDevBypassEnabled() ? getDevBypassUserFromSearch(routeLocation.search) : null),
    [routeLocation.search]
  );
  const { location: detectedLocation, detectLocation, locationLoading, locationError } = useUserLocation() || {};

  useEffect(() => {
    if (devUser) {
      setAuthStateReady(true);
      return undefined;
    }
    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthStateReady(true);
    });
  }, [devUser]);

  useEffect(() => {
    if (!authStateReady) return;
    const loadProfile = async () => {
      try {
        if (devUser) {
          setIsAdmin(devUser.role === "superadmin" || devUser.role === "field_operator");
          setProfileData({
            name: devUser.name || "",
            email: devUser.email || "",
            phone: devUser.phone || "",
            locationCity: devUser.city || "",
            locationArea: devUser.address || devUser.area || "",
            state: devUser.state || "",
            postalCode: devUser.postalCode || "",
            locationLat: devUser.lat || null,
            locationLng: devUser.lng || null,
            photoURL: devUser.photoURL || "",
            gigScore: devUser.gigScore ?? devUser.socioScore ?? 0,
            socioScore: devUser.socioScore ?? 0,
            gigScoreTier: devUser.gigScoreTier || "Copper",
            refundBankAccount: devUser.refundBankAccount || EMPTY_BANK_ACCOUNT,
          });
          return;
        }

        const user = authUser;
        if (!user) return;

        const adminDoc = await getDoc(doc(db, "admins", user.uid));
        setIsAdmin(adminDoc.exists());

        const userDoc = await getDoc(doc(db, "users", user.uid));
        const data = userDoc.exists() ? userDoc.data() : {};
        setProfileData({
          name: data.name || "",
          email: user.email || data.email || "",
          phone: data.phone || "",
          locationCity: data.locationCity || "",
          locationArea: data.locationArea || "",
          state: data.state || "",
          postalCode: data.postalCode || "",
          locationLat: data.locationLat || null,
          locationLng: data.locationLng || null,
          photoURL: data.photoURL || user.photoURL || "",
          gigScore: data.gigScore ?? data.socioScore ?? 0,
          socioScore: data.socioScore ?? 0,
          gigScoreTier: data.gigScoreTier || "Copper",
          refundBankAccount: data.refundBankAccount || EMPTY_BANK_ACCOUNT,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [authStateReady, authUser, devUser]);

  useEffect(() => {
    const user = authUser;
    if (!user) return undefined;
    const q = query(collection(db, "cashbacks"), where("userId", "==", user.uid));
    return onSnapshot(q, snap => {
      setCashbacks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [authUser]);

  useEffect(() => {
    if (devUser) {
      setGigScoreEvents(devUser.gigScoreEvents || devUser.scoreEvents || []);
      return undefined;
    }
    const user = authUser;
    if (!user) return undefined;
    const q = query(collection(db, "gigscore_events"), where("actorId", "==", user.uid));
    return onSnapshot(q, snap => {
      setGigScoreEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [authUser, devUser]);

  useEffect(() => {
    if (!detectedLocation) return;
    setProfileData(prev => {
      if (!userDetectRef.current && prev.locationCity) return prev;
      userDetectRef.current = false;
      return {
        ...prev,
        locationCity: detectedLocation.city || prev.locationCity,
        locationArea: detectedLocation.displayName ? detectedLocation.displayName.split(",")[0].trim() : prev.locationArea,
        locationLat: detectedLocation.lat ?? prev.locationLat,
        locationLng: detectedLocation.lng ?? prev.locationLng,
      };
    });
  }, [detectedLocation]);

  const activeCashbacks = useMemo(() => cashbacks.filter(c => c.cashbackStatus === "active"), [cashbacks]);
  const totalActive = useMemo(() => activeCashbacks.reduce((sum, c) => sum + (c.cashbackAmount || 0), 0), [activeCashbacks]);
  const expiredCount = cashbacks.filter(c => c.cashbackStatus === "expired").length;
  const usedCount = cashbacks.filter(c => c.cashbackStatus === "used").length;
  const completionItems = [
    { label: "Name", done: Boolean(profileData.name) },
    { label: "Phone", done: Boolean(profileData.phone) },
    { label: "City", done: Boolean(profileData.locationCity) },
    { label: "Postal code", done: Boolean(profileData.postalCode) },
    { label: "Photo", done: Boolean(profileData.photoURL || profilePhotoFile) },
    { label: "Refund bank", done: Boolean(profileData.refundBankAccount?.accountNumber && profileData.refundBankAccount?.ifsc) },
  ];
  const completionScore = Math.round((completionItems.filter(i => i.done).length / completionItems.length) * 100);

  const handleDetectAndSetLocation = () => {
    userDetectRef.current = true;
    if (detectLocation) detectLocation();
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");

    if (!profileData.name || !profileData.phone) {
      setError("Name and phone number are required.");
      return;
    }

    if (profileData.phone.replace(/[^\d]/g, "").length < 10) {
      setError("Please enter a valid phone number.");
      return;
    }

    const refundBankAccount = normalizeBankAccount(profileData.refundBankAccount);
    const bankError = refundBankAccount.accountNumber || refundBankAccount.ifsc || refundBankAccount.accountHolderName || refundBankAccount.bankName
      ? validateBankAccount(refundBankAccount)
      : "";
    if (bankError) {
      setError(bankError);
      return;
    }

    setSaving(true);
    try {
      if (devUser) {
        setSuccess("Profile preview updated locally.");
        setEditing(false);
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        setError("Please sign in again to save your profile.");
        return;
      }

      let photoURL = profileData.photoURL || "";
      if (profilePhotoFile) {
        if (!profilePhotoFile.type.startsWith("image/")) {
          setError("Profile photo must be an image file.");
          setSaving(false);
          return;
        }
        if (profilePhotoFile.size > 10 * 1024 * 1024) {
          setError("Profile photo must be under 10 MB.");
          setSaving(false);
          return;
        }
        const safeName = profilePhotoFile.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
        const photoRef = ref(storage, `users/${user.uid}/profile/photo-${Date.now()}-${safeName}`);
        await uploadBytes(photoRef, profilePhotoFile, { contentType: profilePhotoFile.type });
        photoURL = await getDownloadURL(photoRef);
      }

      await setDoc(doc(db, "users", user.uid), {
        name: profileData.name,
        phone: profileData.phone,
        email: user.email,
        locationCity: profileData.locationCity || "",
        locationArea: profileData.locationArea || "",
        state: profileData.state || "",
        postalCode: profileData.postalCode || "",
        locationLat: profileData.locationLat || null,
        locationLng: profileData.locationLng || null,
        photoURL,
        displayName: profileData.name,
        refundBankAccount,
        refundBankAccountUpdatedAt: new Date(),
        updatedAt: new Date(),
      }, { merge: true });

      setProfileData(prev => ({ ...prev, photoURL }));
      setProfilePhotoFile(null);
      setSuccess("Profile updated successfully.");
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="profile-loading">Loading profile...</div>;

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <div>
          <span className="profile-kicker">Account readiness</span>
          <h1>My Profile</h1>
          <p>Save the details that make booking fast: name, phone, service area, and wallet benefits.</p>
        </div>
        <div className="profile-readiness">
          <strong>{completionScore}%</strong>
          <span>Ready</span>
        </div>
      </section>

      {error && <div className="profile-alert profile-alert-error">{error}</div>}
      {success && <div className="profile-alert profile-alert-success">{success}</div>}

      <section className="profile-grid">
        <div className="profile-card profile-main-card">
          <div className="profile-card-header">
            <div>
              <span className="profile-kicker">Saved contact</span>
              <h2>Booking identity</h2>
            </div>
            <button className="profile-secondary-action" onClick={() => setEditing(prev => !prev)}>
              {editing ? "View" : "Edit"}
            </button>
          </div>

          {isAdmin && <div className="profile-admin-badge">Admin account</div>}

          {editing ? (
            <>
              <div className="profile-photo-panel">
                <div className="profile-photo-preview">
                  {profileData.photoURL ? (
                    <img src={profileData.photoURL} alt="Profile" />
                  ) : (
                    <span>{(profileData.name || "U").slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <label className="profile-field profile-photo-input">
                  <span>Profile photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setProfilePhotoFile(e.target.files?.[0] || null)}
                  />
                  <small>{profilePhotoFile ? profilePhotoFile.name : "Image only, up to 10 MB."}</small>
                </label>
              </div>

              <div className="profile-form-grid">
                <label className="profile-field">
                  <span>Name</span>
                  <input value={profileData.name} onChange={e => setProfileData({ ...profileData, name: e.target.value })} />
                </label>
                <label className="profile-field">
                  <span>Email</span>
                  <input value={profileData.email} disabled />
                  <small>Email cannot be changed here.</small>
                </label>
                <label className="profile-field">
                  <span>Phone number</span>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={e => setProfileData({ ...profileData, phone: e.target.value })}
                    placeholder="Enter your 10-digit phone number"
                  />
                </label>
              </div>

              <div className="profile-location-panel">
                <div>
                  <strong>Service location</strong>
                  <span>Use GPS or save city and area manually.</span>
                </div>
                <div className="profile-location-grid">
                  <input
                    value={profileData.locationCity}
                    onChange={e => setProfileData({ ...profileData, locationCity: e.target.value })}
                    placeholder="City"
                  />
                  <input
                    value={profileData.locationArea}
                    onChange={e => setProfileData({ ...profileData, locationArea: e.target.value })}
                    placeholder="Area, e.g. Indiranagar"
                  />
                  <input
                    value={profileData.state}
                    onChange={e => setProfileData({ ...profileData, state: e.target.value })}
                    placeholder="State"
                  />
                  <input
                    value={profileData.postalCode}
                    onChange={e => setProfileData({ ...profileData, postalCode: e.target.value.replace(/[^\d]/g, "").slice(0, 6) })}
                    placeholder="Postal code"
                    inputMode="numeric"
                  />
                  <button type="button" onClick={handleDetectAndSetLocation} disabled={locationLoading}>
                    {locationLoading ? "Detecting..." : "Detect location"}
                  </button>
                </div>
                {locationError && <small className="profile-location-error">{locationError}. You can enter city manually.</small>}
              </div>

              <div className="profile-location-panel">
                <div>
                  <strong>Refund bank account</strong>
                  <span>Used only when Gigtos needs to refund a consumer after a failed or disputed service.</span>
                </div>
                <div className="profile-form-grid">
                  <label className="profile-field">
                    <span>Account holder</span>
                    <input
                      value={profileData.refundBankAccount?.accountHolderName || ""}
                      onChange={e => setProfileData({
                        ...profileData,
                        refundBankAccount: { ...(profileData.refundBankAccount || EMPTY_BANK_ACCOUNT), accountHolderName: e.target.value },
                      })}
                    />
                  </label>
                  <label className="profile-field">
                    <span>Bank name</span>
                    <input
                      value={profileData.refundBankAccount?.bankName || ""}
                      onChange={e => setProfileData({
                        ...profileData,
                        refundBankAccount: { ...(profileData.refundBankAccount || EMPTY_BANK_ACCOUNT), bankName: e.target.value },
                      })}
                    />
                  </label>
                  <label className="profile-field">
                    <span>Account number</span>
                    <input
                      inputMode="numeric"
                      value={profileData.refundBankAccount?.accountNumber || ""}
                      onChange={e => setProfileData({
                        ...profileData,
                        refundBankAccount: { ...(profileData.refundBankAccount || EMPTY_BANK_ACCOUNT), accountNumber: e.target.value },
                      })}
                    />
                  </label>
                  <label className="profile-field">
                    <span>IFSC</span>
                    <input
                      value={profileData.refundBankAccount?.ifsc || ""}
                      onChange={e => setProfileData({
                        ...profileData,
                        refundBankAccount: { ...(profileData.refundBankAccount || EMPTY_BANK_ACCOUNT), ifsc: e.target.value.toUpperCase() },
                      })}
                    />
                  </label>
                  <label className="profile-field">
                    <span>UPI ID optional</span>
                    <input
                      value={profileData.refundBankAccount?.upiId || ""}
                      onChange={e => setProfileData({
                        ...profileData,
                        refundBankAccount: { ...(profileData.refundBankAccount || EMPTY_BANK_ACCOUNT), upiId: e.target.value },
                      })}
                    />
                  </label>
                </div>
              </div>

              <div className="profile-actions">
                <button className="profile-primary-action" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button className="profile-secondary-action" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="profile-photo-summary">
                <div className="profile-photo-preview">
                  {profileData.photoURL ? (
                    <img src={profileData.photoURL} alt="Profile" />
                  ) : (
                    <span>{(profileData.name || "U").slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <span>Profile photo</span>
                  <strong>{profileData.photoURL ? "Added" : "Not added"}</strong>
                </div>
              </div>
              <div className="profile-detail-grid">
                <div><span>Name</span><strong>{profileData.name || "Not set"}</strong></div>
                <div><span>Email</span><strong>{profileData.email || "Not set"}</strong></div>
                <div><span>Phone</span><strong>{profileData.phone || "Not set"}</strong></div>
                <div><span>State</span><strong>{profileData.state || "Not set"}</strong></div>
                <div><span>Postal code</span><strong>{profileData.postalCode || "Not set"}</strong></div>
                <div>
                  <span>Location</span>
                  <strong>{[profileData.locationArea, profileData.locationCity].filter(Boolean).join(", ") || "Not set"}</strong>
                  {profileData.locationLat && profileData.locationLng && (
                    <small>{profileData.locationLat.toFixed(4)}, {profileData.locationLng.toFixed(4)}</small>
                  )}
                </div>
                <div>
                  <span>Refund account</span>
                  <strong>{maskAccountNumber(profileData.refundBankAccount?.accountNumber)}</strong>
                  <small>{profileData.refundBankAccount?.ifsc || "IFSC not set"}</small>
                </div>
              </div>
              <button className="profile-primary-action profile-full-width" onClick={() => setEditing(true)}>Edit profile</button>
            </>
          )}
        </div>

        <aside className="profile-card profile-status-card">
          <span className="profile-kicker">Fast booking checks</span>
          <h2>Profile strength</h2>
          <div className="profile-check-list">
            {completionItems.map(item => (
              <div key={item.label} className={item.done ? "done" : ""}>
                <span>{item.done ? "Ready" : "Needed"}</span>
                <strong>{item.label}</strong>
              </div>
            ))}
          </div>
        </aside>
      </section>

      {!isAdmin && (
        <section className="profile-gigscore-section">
          <GigScoreSpeedometer
            score={profileData.gigScore ?? profileData.socioScore ?? 0}
            role="consumer"
            events={gigScoreEvents}
          />
        </section>
      )}

      {!isAdmin && (
        <section className="profile-card profile-wallet-card">
          <div className="profile-card-header">
            <div>
              <span className="profile-kicker">Digital wallet</span>
              <h2>Cashback Wallet</h2>
            </div>
          </div>

          <div className={totalActive > 0 ? "wallet-balance wallet-balance-active" : "wallet-balance"}>
            <span>Available balance</span>
            <strong>Rs {totalActive}</strong>
          </div>

          {activeCashbacks.length > 0 ? (
            <div className="cashback-list">
              <h3>Active cashbacks</h3>
              {activeCashbacks.map(cb => {
                const expiry = cb.cashbackExpiryDate?.toDate ? cb.cashbackExpiryDate.toDate() : new Date(cb.cashbackExpiryDate);
                const daysLeft = Math.max(0, Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24)));
                return (
                  <div key={cb.id} className="cashback-row">
                    <div>
                      <strong>Rs {cb.cashbackAmount}</strong>
                      <span>Expires: {expiry.toLocaleDateString("en-IN")}</span>
                    </div>
                    <em className={daysLeft <= 3 ? "cashback-expiring" : ""}>
                      {daysLeft <= 0 ? "Expiring today" : `${daysLeft}d left`}
                    </em>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="wallet-empty">No cashbacks yet. Complete bookings to unlock wallet benefits.</div>
          )}

          {(usedCount > 0 || expiredCount > 0) && (
            <div className="cashback-summary">
              {usedCount > 0 && `${usedCount} used`}
              {usedCount > 0 && expiredCount > 0 && " / "}
              {expiredCount > 0 && `${expiredCount} expired`}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
