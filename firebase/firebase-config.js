// Firebase config here
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy,
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyATPxgEAjC2EcRmpAnzHRB7bUpeG2pY-pU",
    authDomain: "central-de-links-cmp.firebaseapp.com",
    projectId: "central-de-links-cmp",
    storageBucket: "central-de-links-cmp.firebasestorage.app",
    messagingSenderId: "502211758516",
    appId: "1:502211758516:web:541ae82f18ad98178c8ae1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);