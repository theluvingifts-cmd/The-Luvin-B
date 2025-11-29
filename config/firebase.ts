// config/firebase.ts
import * as firebase from "firebase/app";
import { getFirestore } from "firebase/firestore"; 
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth"; // <--- Mới thêm cái này

// Config của bạn (giữ nguyên)
const firebaseConfig = {
  apiKey: "AIzaSyCEEblAsaEQPDGeEO7PLrzDLfpa7Z8O1ss",
  authDomain: "the-luvin.firebaseapp.com",
  projectId: "the-luvin",
  storageBucket: "the-luvin.appspot.com", // Đã sửa thành tên chuẩn
  messagingSenderId: "280180645664",
  appId: "1:280180645664:web:616b7a84d214629e064145",
  measurementId: "G-1E58PMLPRP"
};

const app = firebase.initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app); // <--- Xuất cái này ra để dùng