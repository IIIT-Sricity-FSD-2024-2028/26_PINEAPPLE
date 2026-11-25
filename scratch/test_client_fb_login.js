const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyCo5wT6vFTW1HSwA5uXEd1F_E5wfm35EzA",
  authDomain: "team-forge-auth.firebaseapp.com",
  projectId: "team-forge-auth",
  storageBucket: "team-forge-auth.firebasestorage.app",
  messagingSenderId: "908426332128",
  appId: "1:908426332128:web:785d4e53f976d92d1a8d85",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function testClientLogin() {
  try {
    console.log('Attempting client sign-in for superuser@teamforge.io...');
    const cred = await signInWithEmailAndPassword(auth, 'superuser@teamforge.io', 'Super@123');
    console.log('✅ Client sign-in SUCCESS!');
    console.log('User UID:', cred.user.uid);
    console.log('User Email:', cred.user.email);
    const tokenResult = await cred.user.getIdTokenResult(true);
    console.log('Token claims:', tokenResult.claims);

    console.log('\nAttempting client sign-in for admin@teamforge.io...');
    const adminCred = await signInWithEmailAndPassword(auth, 'admin@teamforge.io', 'admin123');
    console.log('✅ Client admin sign-in SUCCESS!');
    console.log('Admin UID:', adminCred.user.uid);
    const adminToken = await adminCred.user.getIdTokenResult(true);
    console.log('Admin claims:', adminToken.claims);
  } catch (err) {
    console.error('❌ Sign-in FAILED:', err.code, err.message);
  }
}

testClientLogin();
