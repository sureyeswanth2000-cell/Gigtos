import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { auth, db } from "../firebase";
import { collection, doc, getDoc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { useLocation as useUserLocation } from "../context/LocationContext";
import { getDevBypassUserFromSearch, isDevBypassEnabled } from "../utils/devBypass";
import "./Profile.css";

export default function Profile() {
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    locationCity: "",
    locationArea: "",
    locationLat: null,
    locationLng: null,
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cashbacks, setCashbacks] = useState([]);
  const userDetectRef = useRef(false);
  const routeLocation = useLocation();
  const devUser = useMemo(
    () => (isDevBypassEnabled() ? getDevBypassUserFromSearch(routeLocation.search) : null),
    [routeLocation.search]
  );
  const { location: detectedLocation, detectLocation, locationLoading, locationError } = useUserLocation() || {};

  useEffect(() => {
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
            locationLat: devUser.lat || null,
            locationLng: devUser.lng || null,
          });
          return;
        }

        const user = auth.currentUser;
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
          locationLat: data.locationLat || null,
          locationLng: data.locationLng || null,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [devUser]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return undefined;
    const q = query(collection(db, "cashbacks"), where("userId", "==", user.uid));
    return onSnapshot(q, snap => {
      setCashbacks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, []);

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

    setSaving(true);
    try {
      if (devUser) {
        setSuccess("Profile preview updated locally.");
        setEditing(false);
        return;
      }

      const user = auth.currentUser;
      await setDoc(doc(db, "users", user.uid), {
        name: profileData.name,
        phone: profileData.phone,
        email: user.email,
        locationCity: profileData.locationCity || "",
        locationArea: profileData.locationArea || "",
        locationLat: profileData.locationLat || null,
        locationLng: profileData.locationLng || null,
        updatedAt: new Date(),
      }, { merge: true });

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
                  <button type="button" onClick={handleDetectAndSetLocation} disabled={locationLoading}>
                    {locationLoading ? "Detecting..." : "Detect location"}
                  </button>
                </div>
                {locationError && <small className="profile-location-error">{locationError}. You can enter city manually.</small>}
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
              <div className="profile-detail-grid">
                <div><span>Name</span><strong>{profileData.name || "Not set"}</strong></div>
                <div><span>Email</span><strong>{profileData.email || "Not set"}</strong></div>
                <div><span>Phone</span><strong>{profileData.phone || "Not set"}</strong></div>
                <div>
                  <span>Location</span>
                  <strong>{[profileData.locationArea, profileData.locationCity].filter(Boolean).join(", ") || "Not set"}</strong>
                  {profileData.locationLat && profileData.locationLng && (
                    <small>{profileData.locationLat.toFixed(4)}, {profileData.locationLng.toFixed(4)}</small>
                  )}
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
