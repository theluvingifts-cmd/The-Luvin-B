
// config/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; 
import { getAuth } from "firebase/auth";

// Config của bạn (giữ nguyên)
export const firebaseConfig = {
  apiKey: "AIzaSyCEEblAsaEQPDGeEO7PLrzDLfpa7Z8O1ss",
  authDomain: "the-luvin.firebaseapp.com",
  projectId: "the-luvin",
  storageBucket: "the-luvin.appspot.com",
  messagingSenderId: "280180645664",
  appId: "1:280180645664:web:616b7a84d214629e064145",
  measurementId: "G-1E58PMLPRP"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
