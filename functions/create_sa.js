/**
 * ONE-TIME SCRIPT: Create SuperAdmin in Firestore
 * Run from functions directory: node create_sa.js
 */
const admin = require('firebase-admin');

// Use Application Default Credentials from gcloud/firebase login
admin.initializeApp({
    projectId: 'gigto-c0c83'
});

const db = admin.firestore();

async function main() {
    const uid = 'OPKEivC1GsfsRo5mcGd0SFOXO3y1';

    try {
        const existing = await db.collection('admins').doc(uid).get();
        if (existing.exists) {
            console.log('Admin doc exists, updating role to superadmin...');
            await db.collection('admins').doc(uid).update({ role: 'superadmin' });
        } else {
            await db.collection('admins').doc(uid).set({
                name: 'Yeswanth (SuperAdmin)',
                email: 'yeswanthsure97@gmail.com',
                role: 'superadmin',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                regionStatus: 'active',
                probationStatus: false,
                regionScore: 100,
                totalDisputes: 0,
                fraudCount: 0,
                areaName: 'Global',
            });
        }
        console.log('✅ SuperAdmin created/updated!');
        const doc = await db.collection('admins').doc(uid).get();
        console.log('Verified:', JSON.stringify(doc.data()));
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
    process.exit(0);
}

main();
