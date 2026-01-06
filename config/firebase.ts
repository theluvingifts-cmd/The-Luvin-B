
// config/firebase.ts
// Fix: Use standard modular imports for Firebase v9+
import { initializeApp } from "firebase/app";
// Import getFirestore from the modular SDK subpath
import { getFirestore } from "firebase/firestore"; 
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Config của bạn
export const firebaseConfig = {
  apiKey: "AIzaSyCEEblAsaEQPDGeEO7PLrzDLfpa7Z8O1ss",
  authDomain: "the-luvin.firebaseapp.com",
  projectId: "the-luvin",
  // CẬP NHẬT: Tên bucket khớp với hiển thị trên Firebase Console của bạn
  storageBucket: "the-luvin.firebasestorage.app",
  messagingSenderId: "280180645664",
  appId: "1:280180645664:web:616b7a84d214629e064145",
  measurementId: "G-1E58PMLPRP"
};

// Fix: Direct initialization as per modular SDK v9+
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
