
import admin from 'firebase-admin'
import serviceAccount from './Affinity-firebase.json'

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as any),
});
const messaging = admin.messaging();

export default messaging;