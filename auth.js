// auth.js — Firebase Authentication Logic
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "api-key",
    authDomain: "central-de-links-cmp.firebaseapp.com",
    projectId: "central-de-links-cmp",
    storageBucket: "central-de-links-cmp.firebasestorage.app",
    messagingSenderId: "502211758516",
    appId: "1:502211758516:web:541ae82f18ad98178c8ae1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ── If already logged in, redirect to main ──
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = 'index.html';
    }
});

// ── Helpers ──
function setLoading(btn, loading) {
    const text = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');
    btn.disabled = loading;
    text.style.display = loading ? 'none' : 'flex';
    loader.style.display = loading ? 'flex' : 'none';
}

function showError(id, msg) {
    const el = document.getElementById(id);
    el.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
    el.style.display = 'flex';
}

function hideMsg(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

function showSuccess(id, msg) {
    const el = document.getElementById(id);
    el.innerHTML = `<i class="fas fa-check-circle"></i> ${msg}`;
    el.style.display = 'flex';
}

// ── Login ──
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMsg('loginError');
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');
    setLoading(btn, true);
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // redirect handled by onAuthStateChanged
    } catch (err) {
        const msgs = {
            'auth/user-not-found': 'Usuário não encontrado.',
            'auth/wrong-password': 'Senha incorreta.',
            'auth/invalid-email': 'E-mail inválido.',
            'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.',
            'auth/invalid-credential': 'E-mail ou senha incorretos.'
        };
        showError('loginError', msgs[err.code] || 'Erro ao fazer login. Verifique suas credenciais.');
        setLoading(btn, false);
    }
});

// ── Register ──
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMsg('registerError');
    hideMsg('registerSuccess');

    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerConfirm').value;
    const btn = document.getElementById('registerBtn');

    if (password !== confirm) {
        showError('registerError', 'As senhas não coincidem.');
        return;
    }

    setLoading(btn, true);

    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });

        // Save user profile to Firestore
        await setDoc(doc(db, 'users', cred.user.uid), {
            uid: cred.user.uid,
            name,
            email,
            role: 'user', // 'user' | 'admin'
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp()
        });

        // redirect handled by onAuthStateChanged
    } catch (err) {
        const msgs = {
            'auth/email-already-in-use': 'Este e-mail já está em uso.',
            'auth/invalid-email': 'E-mail inválido.',
            'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.'
        };
        showError('registerError', msgs[err.code] || 'Erro ao criar conta.');
        setLoading(btn, false);
    }
});

// ── Forgot Password ──
document.getElementById('forgotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMsg('forgotError');
    hideMsg('forgotSuccess');

    const email = document.getElementById('forgotEmail').value.trim();
    const btn = document.getElementById('forgotBtn');
    setLoading(btn, true);

    try {
        await sendPasswordResetEmail(auth, email);
        showSuccess('forgotSuccess', 'Link enviado! Verifique seu e-mail.');
        setLoading(btn, false);
    } catch (err) {
        const msgs = {
            'auth/user-not-found': 'Nenhuma conta com este e-mail.',
            'auth/invalid-email': 'E-mail inválido.'
        };
        showError('forgotError', msgs[err.code] || 'Erro ao enviar link.');
        setLoading(btn, false);
    }
});
