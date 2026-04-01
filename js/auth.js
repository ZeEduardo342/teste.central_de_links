import {
    auth, 
    db, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    doc
} from './firebase-config.js';

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.isAdmin = false;
    }

    init() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadUserProfile(user.uid);
                this.redirectIfNeeded();
            } else {
                this.currentUser = null;
                this.userProfile = null;
                this.isAdmin = false;
                this.redirectToLogin();
            }
        });
    }

    async loadUserProfile(uid) {
        try {
            const q = query(collection(db, 'users'), where('uid', '==', uid));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                this.userProfile = { id: userDoc.id, ...userDoc.data() };
                this.isAdmin = this.userProfile.role === 'admin';
            } else {
                // Criar perfil de usuário padrão
                await this.createUserProfile(uid, this.currentUser.email);
            }
        } catch (error) {
            console.error('Erro ao carregar perfil:', error);
        }
    }

    async createUserProfile(uid, email) {
        try {
            const userData = {
                uid,
                email,
                displayName: email.split('@')[0],
                role: 'user',
                cardSize: 'medium',
                createdAt: new Date()
            };
            await addDoc(collection(db, 'users'), userData);
            this.userProfile = userData;
            this.isAdmin = false;
        } catch (error) {
            console.error('Erro ao criar perfil:', error);
        }
    }

    async register(email, password, displayName) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;
            
            // Criar documento do usuário no Firestore
            const userData = {
                uid,
                email,
                displayName: displayName || email.split('@')[0],
                role: 'user',
                cardSize: 'medium',
                createdAt: new Date()
            };
            
            await addDoc(collection(db, 'users'), userData);
            this.currentUser = userCredential.user;
            this.userProfile = userData;
            
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async login(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            this.currentUser = userCredential.user;
            await this.loadUserProfile(userCredential.user.uid);
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async logout() {
        try {
            await signOut(auth);
            this.currentUser = null;
            this.userProfile = null;
            this.isAdmin = false;
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
        }
    }

    redirectIfNeeded() {
        const currentPage = window.location.pathname;
        
        if (currentPage.includes('login.html') && this.currentUser) {
            window.location.href = 'index.html';
        }
    }

    redirectToLogin() {
        const currentPage = window.location.pathname;
        
        if (!currentPage.includes('login.html')) {
            window.location.href = 'login.html';
        }
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getUserProfile() {
        return this.userProfile;
    }

    isUserAdmin() {
        return this.isAdmin;
    }
}

// Exportar instância única
export const authManager = new AuthManager();
