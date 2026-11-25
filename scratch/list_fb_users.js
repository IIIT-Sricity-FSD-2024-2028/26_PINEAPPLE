const admin = require('firebase-admin');
const fs = require('fs');

const sa = JSON.parse(fs.readFileSync('back-end/serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(sa),
  projectId: sa.project_id,
});

async function listUsers() {
  try {
    const list = await admin.auth().listUsers(100);
    console.log(`Found ${list.users.length} users in Firebase:`);
    list.users.forEach(u => {
      console.log(`- UID: ${u.uid}, Email: ${u.email}, Claims:`, u.customClaims);
    });
  } catch (err) {
    console.error('Error listing users:', err.message);
  }
}

listUsers();
