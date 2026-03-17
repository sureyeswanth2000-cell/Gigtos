/**
 * ONE-TIME SCRIPT: Create SuperAdmin in Firestore
 * 
 * Usage: node create_superadmin.js
 * 
 * This creates a superadmin document in the 'admins' collection
 * for the user yeswanthsure97@gmail.com (UID: OPKEivC1GsfsRo5mcGd0SFOXO3y1)
 */

const admin = require('firebase-admin');

// Initialize with default project
admin.initializeApp({
    projectId: 'gigto-c0c83'
});

const db = admin.firestore();

async function createSuperAdmin() {
    const uid = 'OPKEivC1GsfsRo5mcGd0SFOXO3y1';

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
