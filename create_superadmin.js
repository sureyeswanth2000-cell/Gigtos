/**
 * ONE-TIME SCRIPT: Create SuperAdmin in Firestore
 * 
 * Usage: node create_superadmin.js
 * 
 * This creates a superadmin document in the 'admins' collection.
 * Set SUPERADMIN_UID and SUPERADMIN_EMAIL in your local shell before running.
 */

const admin = require('firebase-admin');

// Initialize with default project
admin.initializeApp({
    projectId: 'gigto-c0c83'
});

const db = admin.firestore();

async function createSuperAdmin() {
    const uid = process.env.SUPERADMIN_UID;
    const email = process.env.SUPERADMIN_EMAIL;
    const name = process.env.SUPERADMIN_NAME || 'Gigtos SuperAdmin';
    if (!uid || !email) {
        throw new Error('Set SUPERADMIN_UID and SUPERADMIN_EMAIL before running this local bootstrap script.');
    }

    try {
        // Check if already exists
        const existing = await db.collection('admins').doc(uid).get();
        if (existing.exists) {
            console.log('⚠️  Admin document already exists for this UID:', existing.data());
            console.log('Updating role to superadmin...');
            await db.collection('admins').doc(uid).update({
                role: 'superadmin'
            });
            console.log('✅ Role updated to superadmin!');
        } else {
            // Create new superadmin document
            await db.collection('admins').doc(uid).set({
                name,
                email,
                role: 'superadmin',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                regionStatus: 'active',
                probationStatus: false,
                regionScore: 100,
                totalDisputes: 0,
                fraudCount: 0,
                areaName: 'Global',
            });
            console.log('✅ SuperAdmin document created successfully!');
        }

        // Verify
        const verify = await db.collection('admins').doc(uid).get();
        console.log('📄 Verified document:', verify.data());

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    process.exit(0);
}

createSuperAdmin();
