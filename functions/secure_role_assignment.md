# Secure Role Assignment (Backend Enforcement)

## Principle
- **Never trust role from frontend.**
- All role assignment and changes must be enforced in backend functions.
- Only privileged backend logic (superadmin, region lead, etc.) can set or change roles.

## Implementation Pattern

### 1. User/Worker Signup (Callable Function)
- Ignore any `role` field from client.
- Always set role server-side, based on the function's intent.

```js
// Example: Secure user signup
exports.user_signup = functions.https.onCall(async (data, context) => {
  // ...validate input...
  // Ignore data.role if present
  const userRecord = await admin.auth().createUser({
    email: data.email,
    password: data.password,
    phoneNumber: data.phone,
  });
  // Always set role here
  await db.collection('users').doc(userRecord.uid).set({
    email: data.email,
    phone: data.phone,
    role: 'user', // enforced
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { success: true };
});
```

### 2. Admin/Mason/RegionLead Creation
- Only allow privileged callers (checked via context.auth and Firestore role) to create sub-accounts.
- Set the role in backend logic, not from client data.

```js
// Example: Secure admin creation
exports.admin_create_sub_account = functions.https.onCall(async (data, context) => {
  // Check caller's role
  const callerDoc = await db.collection('admins').doc(context.auth.uid).get();
  if (!callerDoc.exists || !['superadmin', 'regionLead'].includes(callerDoc.data().role)) {
    throw new functions.https.HttpsError('permission-denied', 'Only superadmin or regionLead can create admins.');
  }
  // Ignore data.role, set it here
  const role = 'mason'; // or 'admin', 'regionLead', etc. as per logic
  const userRecord = await admin.auth().createUser({
    email: data.email,
    password: data.password,
  });
  await db.collection('admins').doc(userRecord.uid).set({
    email: data.email,
    name: data.name,
    role, // enforced
    parentAdminId: context.auth.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { success: true };
});
```

### 3. Firestore Security Rules
- Only allow role changes by privileged users.
- Users cannot write or change their own `role` field.

```js
// Example: firebase.rules
match /admins/{uid} {
  allow update: if request.auth != null && get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'superadmin';
  allow create: if request.auth != null && get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role in ['superadmin', 'regionLead'];
  allow read: if request.auth != null;
}
```

## Summary
- Remove all role selection from frontend.
- Set/check roles only in backend code and Firestore.
- Use backend-determined role for all permissions and routing.
- Document this pattern for all contributors.
