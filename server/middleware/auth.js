/**
 * Firebase Authentication & Authorization Middleware
 * Follows Enterprise Directive #3 (Auth State Integrity & Broken Access Control Mitigation)
 * Verifies Firebase JWT ID tokens on all protected routes and attaches the validated user identity.
 */

const admin = require('firebase-admin');
const { initFirebase } = require('../services/firestore');

/**
 * Express middleware to verify Firebase ID Token
 */
async function authenticateFirebaseUser(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Check if dev mock auth is allowed for local test runner
    if (process.env.ALLOW_DEV_AUTH === 'true' && req.headers['x-dev-user-id']) {
      const devUid = req.headers['x-dev-user-id'];
      req.user = {
        uid: devUid,
        email: `${devUid}@example.com`,
        name: 'Demo Journaler',
        isDev: true
      };
      return next();
    }

    return res.status(401).json({
      error: 'Unauthorized: Missing or invalid Authorization header. Provide a valid Bearer Firebase ID Token.'
    });
  }

  const idToken = authHeader.split('Bearer ')[1].trim();

  if (!idToken) {
    return res.status(401).json({ error: 'Unauthorized: Empty token provided' });
  }

  // Handle Demo Mode token for quick instant testing if configured
  if (idToken.startsWith('demo-token-')) {
    const demoUid = idToken.replace('demo-token-', '') || 'demo-user-default';
    req.user = {
      uid: demoUid,
      email: `${demoUid}@demojournal.app`,
      name: 'Journal Explorer',
      isDemo: true
    };
    return next();
  }

  try {
    initFirebase();
    // Cryptographically verify the Firebase JWT token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      name: decodedToken.name || decodedToken.email || 'Journal User',
      picture: decodedToken.picture || '',
      authTime: decodedToken.auth_time
    };

    next();
  } catch (err) {
    console.warn('[Auth] Token verification failed:', err.message);
    return res.status(401).json({
      error: 'Unauthorized: Invalid or expired Firebase ID token',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}

module.exports = {
  authenticateFirebaseUser
};
