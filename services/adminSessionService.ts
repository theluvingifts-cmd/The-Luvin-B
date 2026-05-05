
import { db, auth } from '../config/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  updateDoc, 
  query, 
  onSnapshot, 
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';

const COLLECTION_NAME = "admin_sessions";

// Get or create a session ID for this browser tab/session
const getSessionId = () => {
  let sid = sessionStorage.getItem('admin_session_id');
  if (!sid) {
    sid = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionStorage.setItem('admin_session_id', sid);
  }
  return sid;
};

export const trackSession = async () => {
  const user = auth.currentUser;
  if (!user) return;

  const sessionId = getSessionId();
  const sessionRef = doc(db, COLLECTION_NAME, sessionId);

  await setDoc(sessionRef, {
    uid: user.uid,
    email: user.email,
    userAgent: navigator.userAgent,
    lastActive: serverTimestamp(),
    isRevoked: false,
    sessionId: sessionId
  }, { merge: true });
};

export const subscribeToSession = (onRevoked: () => void) => {
  const sessionId = getSessionId();
  const sessionRef = doc(db, COLLECTION_NAME, sessionId);

  return onSnapshot(sessionRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      if (data.isRevoked) {
        onRevoked();
      }
    }
  }, (error) => {
    console.error("Admin session monitor error:", error);
  });
};

export const getAllSessions = async () => {
  const q = query(collection(db, COLLECTION_NAME));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data());
};

export const revokeSession = async (sessionId: string) => {
  const sessionRef = doc(db, COLLECTION_NAME, sessionId);
  await updateDoc(sessionRef, { isRevoked: true });
};

export const deleteSession = async (sessionId: string) => {
  await deleteDoc(doc(db, COLLECTION_NAME, sessionId));
}
