import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { useLocation as useUserLocation } from "../context/LocationContext";

export default function Profile() {
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    locationCity: "",
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

  const { location: detectedLocation, detectLocation, locationLoading } = useUserLocation() || {};

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        // Check if admin
        const adminDoc = await getDoc(doc(db, "admins", user.uid));
        setIsAdmin(adminDoc.exists());

        // Load user profile
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setProfileData({
            name: data.name || "",
            email: user.email || "",
            phone: data.phone || "",
            address: data.address || "",
            locationCity: data.locationCity || "",
            locationLat: data.locationLat || null,
            locationLng: data.locationLng || null,
          });
        } else {
          setProfileData({
            name: "",
            email: user.email || "",
            phone: "",
            address: "",
            locationCity: "",
            locationLat: null,
            locationLng: null,
          });
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  /* ── Cashback wallet listener ── */
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, 'cashbacks'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      setCashbacks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const handleDetectAndSetLocation = () => {
    userDetectRef.current = true;
    if (detectLocation) detectLocation();
  };

  // Sync detected location into profile when it changes
  useEffect(() => {
    if (detectedLocation && (userDetectRef.current || !profileData.locationCity)) {
      setProfileData((prev) => ({
        ...prev,
        locationCity: detectedLocation.city || prev.locationCity,
        locationLat: detectedLocation.lat ?? prev.locationLat,
        locationLng: detectedLocation.lng ?? prev.locationLng,
        // Auto-fill address with full display name if address is empty
        address: prev.address || detectedLocation.displayName || detectedLocation.city || prev.address,
      }));
      userDetectRef.current = false;
    }
  }, [detectedLocation, profileData.locationCity]);

  const handleSave = async () => {
    setError("");
    setSuccess("");

    // Validation
    if (!profileData.name || !profileData.phone || !profileData.address) {
      setError("All fields are required");
      return;
    }

    if (profileData.phone.length < 10) {
      setError("Please enter a valid phone number");
      return;
    }

    setSaving(true);

    try {
      const user = auth.currentUser;
      // Use setDoc with merge=true to create if missing, update if exists
      await setDoc(doc(db, "users", user.uid), {
        name: profileData.name,
        phone: profileData.phone,
        address: profileData.address,
        email: user.email,
        locationCity: profileData.locationCity || "",
        locationLat: profileData.locationLat || null,
        locationLng: profileData.locationLng || null,
        updatedAt: new Date()
      }, { merge: true });

      setSuccess("Profile updated successfully!");
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "24px", textAlign: "center", color: "#4b5563" }}>Loading profile...</div>;
  }

  return (
    <div style={{ maxWidth: "620px", margin: "20px auto", padding: "24px 18px 90px", color: '#1f2937' }}>
      <h2 style={{ marginBottom: "8px", fontSize: '34px', fontFamily: 'Manrope, Inter, sans-serif' }}>My Profile</h2>
      <p style={{ margin: '0 0 16px 0', color: '#4b5563', fontSize: '14px' }}>Keep your contact details up to date for faster booking confirmations.</p>

      {error && (
        <div style={{
          padding: "12px",
          marginBottom: "15px",
          backgroundColor: "#fee",
          border: "1px solid #fcc",
          borderRadius: "4px",
          color: "#c00",
          fontSize: "14px"
        }}>
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: "12px",
          marginBottom: "15px",
          backgroundColor: "#efe",
          border: "1px solid #cfc",
          borderRadius: "4px",
          color: "#060",
          fontSize: "14px"
        }}>
          ✓ {success}
        </div>
      )}

      <div style={{
        padding: "20px",
        border: "1px solid #d6d8de",
        borderRadius: "12px",
        backgroundColor: "#fff",
        boxShadow: '0 10px 24px rgba(17,24,39,0.08)'
      }}>
        {isAdmin && (
          <div style={{
            padding: "12px",
            marginBottom: "20px",
            backgroundColor: "#e8f4f8",
            border: "1px solid #b3e5fc",
            borderRadius: "4px",
            color: "#01579b",
            fontSize: "13px"
          }}>
            Admin Account
          </div>
        )}

        {editing ? (
          <>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Name:
              </label>
              <input
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Email:
              </label>
              <input
                type="email"
                value={profileData.email}
                disabled
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  backgroundColor: "#f0f0f0",
                  cursor: "not-allowed"
                }}
              />
              <small style={{ color: "#666" }}>Email cannot be changed</small>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Phone Number:
              </label>
              <input
                type="tel"
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                placeholder="Enter your 10-digit phone number"
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                  boxSizing: "border-box"
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Address:
              </label>
              <textarea
                value={profileData.address}
                onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                placeholder="Enter your complete address"
                rows="4"
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  fontSize: "14px",
                  fontFamily: "Arial, sans-serif",
                  boxSizing: "border-box",
                  resize: "vertical"
                }}
              />
            </div>

            {/* Location section in edit mode – detect only */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                Location:
              </label>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px', background: '#f3e8ff', borderRadius: '8px',
                border: '1px solid #c4b5fd'
              }}>
                <span style={{ flex: 1, fontSize: '14px', color: profileData.locationCity ? '#1f2937' : '#9ca3af' }}>
                  {profileData.locationCity ? `📍 ${profileData.locationCity}` : 'Not detected'}
                </span>
                <button
                  onClick={handleDetectAndSetLocation}
                  disabled={locationLoading}
                  style={{
                    padding: '6px 14px', fontSize: '13px', fontWeight: 600,
                    background: locationLoading ? '#c4b5fd' : '#A259FF', color: '#fff', border: 'none',
                    borderRadius: '6px', cursor: locationLoading ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {locationLoading ? '⏳ Detecting…' : '📍 Detect Location'}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: saving ? "#ccc" : "#057A31",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontWeight: "bold"
                }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => setEditing(false)}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "#4B5563",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: "15px" }}>
              <span style={{ fontWeight: "bold", color: "#666" }}>Name:</span>
              <p style={{ margin: "5px 0 0 0", fontSize: "16px" }}>{profileData.name || "Not set"}</p>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <span style={{ fontWeight: "bold", color: "#666" }}>Email:</span>
              <p style={{ margin: "5px 0 0 0", fontSize: "16px" }}>{profileData.email}</p>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <span style={{ fontWeight: "bold", color: "#666" }}>Phone:</span>
              <p style={{ margin: "5px 0 0 0", fontSize: "16px" }}>{profileData.phone || "Not set"}</p>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <span style={{ fontWeight: "bold", color: "#666" }}>Address:</span>
              <p style={{ margin: "5px 0 0 0", fontSize: "14px", whiteSpace: "pre-wrap" }}>
                {profileData.address || "Not set"}
              </p>
              {profileData.locationLat && profileData.locationLng && (
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#7C3AED", fontWeight: 500 }}>
                  📍 {profileData.locationLat.toFixed(4)}, {profileData.locationLng.toFixed(4)}
                </p>
              )}
            </div>

            <div style={{ marginBottom: "15px" }}>
              <span style={{ fontWeight: "bold", color: "#666" }}>Location:</span>
              <p style={{ margin: "5px 0 0 0", fontSize: "14px" }}>
                {profileData.locationCity || "Not set"}
              </p>
            </div>

            <button
              onClick={() => setEditing(true)}
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: "#057A31",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                marginTop: "10px"
              }}
            >
              Edit Profile
            </button>
          </>
        )}
      </div>

      {/* ═══ Cashback Wallet ═══ */}
      {!isAdmin && (
        <div style={{
          marginTop: '20px', padding: '20px', border: '1px solid #d6d8de',
          borderRadius: '12px', backgroundColor: '#fff', boxShadow: '0 10px 24px rgba(17,24,39,0.08)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', color: '#1f2937', fontFamily: 'Manrope, Inter, sans-serif' }}>Cashback Wallet</h3>

          {(() => {
            const activeCashbacks = cashbacks.filter(c => c.cashbackStatus === 'active');
            const totalActive = activeCashbacks.reduce((sum, c) => sum + (c.cashbackAmount || 0), 0);
            const expiredCashbacks = cashbacks.filter(c => c.cashbackStatus === 'expired');
            const usedCashbacks = cashbacks.filter(c => c.cashbackStatus === 'used');

            return (
              <>
                {/* Balance */}
                <div style={{
                  textAlign: 'center', padding: '16px', marginBottom: '16px',
                  background: totalActive > 0 ? 'linear-gradient(135deg, #ecfdf5, #d1fae5)' : '#f8fafc',
                  borderRadius: '12px', border: `1px solid ${totalActive > 0 ? '#86efac' : '#e2e8f0'}`,
                }}>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Available Balance</div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: totalActive > 0 ? '#166534' : '#94a3b8' }}>₹{totalActive}</div>
                </div>

                {/* Active cashbacks list */}
                {activeCashbacks.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Active Cashbacks:</div>
                    {activeCashbacks.map(cb => {
                      const expiry = cb.cashbackExpiryDate?.toDate ? cb.cashbackExpiryDate.toDate() : new Date(cb.cashbackExpiryDate);
                      const daysLeft = Math.max(0, Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24)));
                      return (
                        <div key={cb.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 12px', background: 'white', borderRadius: '8px',
                          border: '1px solid #e2e8f0', marginBottom: '6px',
                        }}>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#166534' }}>₹{cb.cashbackAmount}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Expires: {expiry.toLocaleDateString('en-IN')}</div>
                          </div>
                          <span style={{
                            padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold',
                            background: daysLeft <= 3 ? '#fef2f2' : '#ecfdf5',
                            color: daysLeft <= 3 ? '#dc2626' : '#166534',
                          }}>
                            {daysLeft <= 0 ? 'Expiring today' : `${daysLeft}d left`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Summary */}
                {(expiredCashbacks.length > 0 || usedCashbacks.length > 0) && (
                  <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
                    {usedCashbacks.length > 0 && `${usedCashbacks.length} used`}
                    {usedCashbacks.length > 0 && expiredCashbacks.length > 0 && ' · '}
                    {expiredCashbacks.length > 0 && `${expiredCashbacks.length} expired`}
                  </div>
                )}

                {cashbacks.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '12px' }}>
                    No cashbacks yet. Complete bookings to earn ₹9 cashback each!
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
