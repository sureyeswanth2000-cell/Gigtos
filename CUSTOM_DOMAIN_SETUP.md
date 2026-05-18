# Connecting `gigto.in` to Firebase Hosting

This guide walks you through the complete process of connecting the custom domain
`gigto.in` (and optionally `www.gigto.in`) to Firebase Hosting.

---

## Prerequisites

- Firebase project created and the Firebase CLI installed (`npm install -g firebase-tools`)
- You have access to the DNS management panel for `gigto.in` at your domain registrar
- The React app has been built and Firebase Hosting is configured (see [README.md](README.md))

---

## Step 1 — Set Your Firebase Project ID

Open `.firebaserc` in the root of this repository and replace `YOUR_FIREBASE_PROJECT_ID`
with your actual Firebase project ID:

```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

You can find your project ID in the [Firebase Console](https://console.firebase.google.com/)
under **Project settings → General**.

---

## Step 2 — Build and Deploy to Firebase Hosting

```bash
# Install Firebase CLI if you haven't already
npm install -g firebase-tools

# Log in to Firebase
firebase login

# Build the React app
cd react-app
npm install
npm run build
cd ..

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

After a successful deploy, Firebase Hosting will serve the app at:
`https://YOUR_FIREBASE_PROJECT_ID.web.app`

---

## Step 3 — Add `gigto.in` as a Custom Domain in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/) → your project.
2. In the left menu, click **Hosting**.
3. Click **Add custom domain**.
4. Enter `gigto.in` and click **Continue**.
5. Firebase will display a **TXT verification record** — copy it now.

---

## Step 4 — Add the TXT Verification Record at Your DNS Registrar

Log in to the DNS management panel for `gigto.in` and add:

| Type | Host/Name | Value |
|------|-----------|-------|
| `TXT` | `@` (or `gigto.in`) | *(paste the token shown by Firebase — e.g. `firebase=xxxxxxxxxxxx`)* |

> **Note:** The exact TXT value is unique to your project and is shown only in the
> Firebase Console during the domain-addition flow. Never use a placeholder here.

Save the record, then return to the Firebase Console and click **Verify**.
DNS propagation can take anywhere from a few minutes to 24–48 hours.

---

## Step 5 — Add the A Records for `gigto.in` (Apex Domain)

After verification, Firebase provides the IP addresses to use as **A records**.
Add them at your DNS registrar:

| Type | Host/Name | Value |
|------|-----------|-------|
| `A` | `@` (or `gigto.in`) | *(first IP shown in Firebase Console — e.g. `199.36.158.100`)* |
| `A` | `@` (or `gigto.in`) | *(second IP shown in Firebase Console, if provided)* |

> **Important:** Use the exact IP addresses shown in **your** Firebase Console.
> Firebase may update these addresses over time.

---

## Step 6 (Optional) — Connect `www.gigto.in`

Repeat **Step 3** but enter `www.gigto.in` instead. Firebase will ask you to add a
CNAME record:

| Type | Host/Name | Value |
|------|-----------|-------|
| `CNAME` | `www` | `your-project-id.web.app.` (trailing dot may be required) |

> Choose one domain as primary in Firebase Hosting and set up a redirect from the other.

---

## Step 7 — Wait for SSL Provisioning

Once DNS has propagated and Firebase has verified the domain, it will automatically
provision a free SSL certificate via Let's Encrypt. This usually takes a few minutes
after DNS verification succeeds.

You will see the domain status change from **Pending** to **Connected** in the
Firebase Console → Hosting → Custom Domains panel.

---

## Step 8 — Update `homepage` in `react-app/package.json`

Change the `homepage` field so that build asset paths are correct for your custom domain:

```json
"homepage": "https://gigto.in"
```

Then rebuild and redeploy:

```bash
cd react-app && npm run build && cd .. && firebase deploy --only hosting
```

---

## DNS Record Summary (Template)

| Type | Host | Value | Purpose |
|------|------|-------|---------|
| `TXT` | `@` | `firebase=<token from console>` | Domain ownership verification |
| `A` | `@` | `<IP from Firebase console>` | Apex domain routing |
| `A` | `@` | `<second IP from Firebase console>` | Apex domain routing (redundancy) |
| `CNAME` | `www` | `<project-id>.web.app.` | www subdomain routing |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Domain stuck on "Pending" | DNS hasn't propagated yet — wait up to 48 hours |
| SSL not provisioned | Ensure A records point to Firebase IPs, not old host IPs |
| 404 on routes | The `rewrites` rule in `firebase.json` already handles SPA routing |
| Wrong project deployed | Check `.firebaserc` has the correct project ID |

---

## Further Reading

- [Firebase Hosting custom domain docs](https://firebase.google.com/docs/hosting/custom-domain)
- [Firebase CLI reference](https://firebase.google.com/docs/cli)
