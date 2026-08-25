/**
 * Firebase Client Configuration & Authentication Service
 * Follows Directive #3: Federated Google Authentication & Zero Password Handling
 */

const AuthModule = (function () {
  let authInstance = null;
  let currentUser = null;
  let isDemoMode = false;
  let demoUser = null;
  let onAuthStateChangedCallback = null;

  async function init() {
    try {
      // 1. Fetch public Firebase client configuration from server
      const res = await fetch('/api/config');
      const config = await res.json();

      if (config.firebaseApiKey && typeof firebase !== 'undefined') {
        const firebaseConfig = {
          apiKey: config.firebaseApiKey,
          authDomain: config.firebaseAuthDomain,
          projectId: config.firebaseProjectId,
          storageBucket: config.firebaseStorageBucket,
          messagingSenderId: config.firebaseMessagingSenderId,
          appId: config.firebaseAppId
        };

        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }

        authInstance = firebase.auth();
        authInstance.onAuthStateChanged((user) => {
          if (!isDemoMode) {
            currentUser = user;
            if (onAuthStateChangedCallback) {
              onAuthStateChangedCallback(user);
            }
          }
        });
        console.log('[AuthModule] Firebase Web Auth initialized successfully.');
      } else {
        console.log('[AuthModule] Running in standalone / demo ready mode.');
      }
    } catch (err) {
      console.warn('[AuthModule] Firebase config fetch error:', err.message);
    }
  }

  function onAuthChange(callback) {
    onAuthStateChangedCallback = callback;
    if (currentUser && callback) {
      callback(currentUser);
    } else if (isDemoMode && demoUser && callback) {
      callback(demoUser);
    }
  }

  async function signInWithGoogle() {
    if (!authInstance) {
      console.log('[AuthModule] Firebase Auth not configured, starting demo mode');
      return startDemoMode('demo-google-user');
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');

    try {
      const result = await authInstance.signInWithPopup(provider);
      currentUser = result.user;
      isDemoMode = false;
      return result.user;
    } catch (error) {
      console.error('[AuthModule] Google Sign-In error:', error);
      throw error;
    }
  }

  async function signOut() {
    if (authInstance && !isDemoMode) {
      await authInstance.signOut();
    }
    currentUser = null;
    isDemoMode = false;
    demoUser = null;
    if (onAuthStateChangedCallback) {
      onAuthStateChangedCallback(null);
    }
  }

  function startDemoMode(uid = 'demo-user-1') {
    isDemoMode = true;
    demoUser = {
      uid: uid,
      displayName: 'Alex Rivers',
      email: 'alex.rivers@mindscape.ai',
      photoURL: 'https://lh3.googleusercontent.com/a/default-user=s96-c'
    };
    currentUser = demoUser;
    if (onAuthStateChangedCallback) {
      onAuthStateChangedCallback(demoUser);
    }
    return demoUser;
  }

  async function getIdToken() {
    if (isDemoMode && demoUser) {
      return `demo-token-${demoUser.uid}`;
    }
    if (authInstance && authInstance.currentUser) {
      return await authInstance.currentUser.getIdToken();
    }
    return null;
  }

  function getUser() {
    return currentUser;
  }

  return {
    init,
    onAuthChange,
    signInWithGoogle,
    signOut,
    startDemoMode,
    getIdToken,
    getUser
  };
})();

// Auto-initialize when script loads
document.addEventListener('DOMContentLoaded', () => {
  AuthModule.init();
});
