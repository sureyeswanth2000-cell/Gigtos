import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function Profile(){
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    address: ""
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
          setProfileData({
            name: userDoc.data().name || "",
            email: user.email || "",
            phone: userDoc.data().phone || "",
            address: userDoc.data().address || ""
          });
        } else {
          setProfileData({
            name: "",
            email: user.email || "",
            phone: "",
            address: ""
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
    return <div style={{padding: "20px", textAlign: "center"}}>Loading profile...</div>;
  }

  return (
    <div style={{maxWidth: "500px", margin: "20px auto", padding: "20px"}}>
      <h2 style={{marginBottom: "20px"}}>👤 My Profile</h2>

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
        border: "1px solid #ddd",
        borderRadius: "8px",
        backgroundColor: "#fafafa"
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
            👨‍💼 Admin Account
          </div>
        )}

        {editing ? (
          <>
            <div style={{marginBottom: "15px"}}>
              <label style={{display: "block", marginBottom: "5px", fontWeight: "bold"}}>
                Name:
              </label>
              <input
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData({...profileData, name: e.target.value})}
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

            <div style={{marginBottom: "15px"}}>
              <label style={{display: "block", marginBottom: "5px", fontWeight: "bold"}}>
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
              <small style={{color: "#666"}}>Email cannot be changed</small>
            </div>

            <div style={{marginBottom: "15px"}}>
              <label style={{display: "block", marginBottom: "5px", fontWeight: "bold"}}>
                Phone Number:
              </label>
              <input
                type="tel"
                value={profileData.phone}
                onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
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

            <div style={{marginBottom: "20px"}}>
              <label style={{display: "block", marginBottom: "5px", fontWeight: "bold"}}>
                Address:
              </label>
              <textarea
                value={profileData.address}
                onChange={(e) => setProfileData({...profileData, address: e.target.value})}
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

            <div style={{display: "flex", gap: "10px"}}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: saving ? "#ccc" : "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
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
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
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
            <div style={{marginBottom: "15px"}}>
              <span style={{fontWeight: "bold", color: "#666"}}>Name:</span>
              <p style={{margin: "5px 0 0 0", fontSize: "16px"}}>{profileData.name || "Not set"}</p>
            </div>

            <div style={{marginBottom: "15px"}}>
              <span style={{fontWeight: "bold", color: "#666"}}>Email:</span>
              <p style={{margin: "5px 0 0 0", fontSize: "16px"}}>{profileData.email}</p>
            </div>

            <div style={{marginBottom: "15px"}}>
              <span style={{fontWeight: "bold", color: "#666"}}>Phone:</span>
              <p style={{margin: "5px 0 0 0", fontSize: "16px"}}>{profileData.phone || "Not set"}</p>
            </div>

            <div style={{marginBottom: "15px"}}>
              <span style={{fontWeight: "bold", color: "#666"}}>Address:</span>
              <p style={{margin: "5px 0 0 0", fontSize: "14px", whiteSpace: "pre-wrap"}}>
                {profileData.address || "Not set"}
              </p>
            </div>

            <button
              onClick={() => setEditing(true)}
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
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
    </div>
  );
}
