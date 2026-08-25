/**
 * Firestore Database & Isolation Service
 * Follows Enterprise Directives #3 (Firestore User Data Isolation) and #6 (Payload Hygiene & Transaction Integrity)
 */

const admin = require('firebase-admin');

let firestoreDb = null;
let isFirebaseInitialized = false;

// In-Memory fallback store for offline development / testing if Firebase project credentials aren't linked yet
const mockStore = {
  users: new Map() // userId -> { entries: Map, interactions: Map, analytics: Map }
};

function getMockUserStore(userId) {
  if (!mockStore.users.has(userId)) {
    mockStore.users.set(userId, {
      entries: new Map(),
      interactions: new Map(),
      analytics: new Map()
    });
  }
  return mockStore.users.get(userId);
}

function initFirebase() {
  if (isFirebaseInitialized) return;

  try {
    if (admin.apps.length === 0) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
          console.log('[Firestore] Initialized with FIREBASE_SERVICE_ACCOUNT_KEY');
        } catch (e) {
          console.warn('[Firestore] Failed parsing FIREBASE_SERVICE_ACCOUNT_KEY, falling back to ADC');
          admin.initializeApp();
        }
      } else {
        // Cloud Run Application Default Credentials (ADC)
        admin.initializeApp();
        console.log('[Firestore] Initialized with Application Default Credentials');
      }
    }
    firestoreDb = admin.firestore();
    firestoreDb.settings({ ignoreUndefinedProperties: true });
    isFirebaseInitialized = true;
    console.log('[Firestore] Connected to Cloud Firestore successfully.');
  } catch (err) {
    console.warn('[Firestore] Cloud Firestore init warning (will use resilient local storage if offline):', err.message);
  }
}

/**
 * Strict Undefined-Stripping (Zero-Crash Payload Hygiene)
 * Directive #6: Recursively removes undefined fields and sanitizes values before database persistence.
 */
function sanitizePayload(data) {
  if (data === null || data === undefined) return null;
  if (typeof data !== 'object') return data;
  if (data instanceof Date) return data;
  if (Array.isArray(data)) {
    return data
      .filter(item => item !== undefined)
      .map(item => sanitizePayload(item));
  }

  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      clean[key] = sanitizePayload(value);
    }
  }
  return clean;
}

/**
 * Persist a user journal entry to the user-isolated subcollection /users/{userId}/entries/{entryId}
 */
async function saveJournalEntry(userId, entryData) {
  if (!userId) throw new Error('Security violation: userId is required for entry persistence');
  
  initFirebase();
  const cleanData = sanitizePayload({
    ...entryData,
    userId,
    updatedAt: new Date().toISOString(),
    createdAt: entryData.createdAt || new Date().toISOString()
  });

  const entryId = entryData.id || `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  cleanData.id = entryId;

  if (firestoreDb && isFirebaseInitialized) {
    try {
      const docRef = firestoreDb.collection('users').doc(userId).collection('entries').doc(entryId);
      await docRef.set(cleanData, { merge: true });
      return cleanData;
    } catch (err) {
      console.warn(`[Firestore] Remote write failed for user ${userId}, saving to in-memory store:`, err.message);
    }
  }

  // Resilient Local fallback
  const userStore = getMockUserStore(userId);
  userStore.entries.set(entryId, cleanData);
  return cleanData;
}

/**
 * Retrieve all journal entries strictly isolated to the requesting user
 */
async function getUserJournalEntries(userId, limit = 50) {
  if (!userId) throw new Error('Security violation: userId is required');

  initFirebase();
  if (firestoreDb && isFirebaseInitialized) {
    try {
      const snapshot = await firestoreDb
        .collection('users')
        .doc(userId)
        .collection('entries')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const entries = [];
      snapshot.forEach(doc => {
        entries.push(doc.data());
      });
      return entries;
    } catch (err) {
      console.warn(`[Firestore] Remote read failed for user ${userId}, checking local store:`, err.message);
    }
  }

  const userStore = getMockUserStore(userId);
  return Array.from(userStore.entries.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
}

/**
 * Retrieve a single journal entry with strict user ownership verification
 */
async function getUserJournalEntryById(userId, entryId) {
  if (!userId || !entryId) throw new Error('Security violation: userId and entryId are required');

  initFirebase();
  if (firestoreDb && isFirebaseInitialized) {
    try {
      const doc = await firestoreDb
        .collection('users')
        .doc(userId)
        .collection('entries')
        .doc(entryId)
        .get();

      if (!doc.exists) return null;
      const data = doc.data();
      if (data.userId !== userId) {
        throw new Error('Access Denied: Cross-user data boundary violation');
      }
      return data;
    } catch (err) {
      console.warn(`[Firestore] Remote get failed for ${entryId}:`, err.message);
    }
  }

  const userStore = getMockUserStore(userId);
  const entry = userStore.entries.get(entryId);
  if (!entry) return null;
  if (entry.userId !== userId) {
    throw new Error('Access Denied: Cross-user data boundary violation');
  }
  return entry;
}

/**
 * Delete a journal entry with strict user ownership verification
 */
async function deleteUserJournalEntry(userId, entryId) {
  if (!userId || !entryId) throw new Error('Security violation: userId and entryId are required');

  initFirebase();
  if (firestoreDb && isFirebaseInitialized) {
    try {
      await firestoreDb
        .collection('users')
        .doc(userId)
        .collection('entries')
        .doc(entryId)
        .delete();
      return true;
    } catch (err) {
      console.warn(`[Firestore] Remote delete failed for ${entryId}:`, err.message);
    }
  }

  const userStore = getMockUserStore(userId);
  return userStore.entries.delete(entryId);
}

/**
 * Save multi-turn interaction logs to /users/{userId}/interactions/{interactionId}
 */
async function saveUserInteraction(userId, interactionData) {
  if (!userId) throw new Error('Security violation: userId is required');

  initFirebase();
  const cleanData = sanitizePayload({
    ...interactionData,
    userId,
    timestamp: new Date().toISOString()
  });

  const interactionId = interactionData.id || `interaction_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  cleanData.id = interactionId;

  if (firestoreDb && isFirebaseInitialized) {
    try {
      await firestoreDb
        .collection('users')
        .doc(userId)
        .collection('interactions')
        .doc(interactionId)
        .set(cleanData);
      return cleanData;
    } catch (err) {
      console.warn(`[Firestore] Remote interaction write failed:`, err.message);
    }
  }

  const userStore = getMockUserStore(userId);
  userStore.interactions.set(interactionId, cleanData);
  return cleanData;
}

/**
 * Retrieve user's multi-turn interaction history
 */
async function getUserInteractions(userId, limit = 20) {
  if (!userId) throw new Error('Security violation: userId is required');

  initFirebase();
  if (firestoreDb && isFirebaseInitialized) {
    try {
      const snapshot = await firestoreDb
        .collection('users')
        .doc(userId)
        .collection('interactions')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      const interactions = [];
      snapshot.forEach(doc => interactions.push(doc.data()));
      return interactions;
    } catch (err) {
      console.warn(`[Firestore] Remote interactions read failed:`, err.message);
    }
  }

  const userStore = getMockUserStore(userId);
  return Array.from(userStore.interactions.values())
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

module.exports = {
  initFirebase,
  sanitizePayload,
  saveJournalEntry,
  getUserJournalEntries,
  getUserJournalEntryById,
  deleteUserJournalEntry,
  saveUserInteraction,
  getUserInteractions
};
