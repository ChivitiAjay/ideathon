/**
 * Personal Gemini Journal - Express Server Entrypoint
 * Follows Enterprise Directives #2 (OWASP Secure Coding), #3 (Auth & Isolation), and #6 (Ordering & Robustness)
 */

require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const journalRoutes = require('./routes/journal');
const chatRoutes = require('./routes/chat');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 8080;

// 1. Security Headers via Helmet (Directive #2)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://www.gstatic.com",
          "https://apis.google.com",
          "https://cdn.jsdelivr.net"
        ],
        connectSrc: [
          "'self'",
          "https://*.googleapis.com",
          "https://*.firebaseio.com",
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com"
        ],
        imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com", "https://*.googleusercontent.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        frameSrc: ["'self'", "https://*.firebaseapp.com", "https://accounts.google.com"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// 2. CORS Policy
app.use(cors({
  origin: true,
  credentials: true
}));

// 3. Request Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// 4. Rate Limiting Protection (OWASP Mitigation)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again after a short break.' }
});
app.use('/api/', apiLimiter);

// 5. Top-Level Request Deserialization (Directive #6 - Ordering Guarantee)
// Parsers MUST be mounted before endpoint routes
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 6. Cloud Run Health Check Probe
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'personal-gemini-journal',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'production'
  });
});

// 7. API Routes
app.use('/api/journal', journalRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/analytics', analyticsRoutes);

// Config endpoint to provide public Firebase client settings safely
app.get('/api/config', (req, res) => {
  res.json({
    firebaseApiKey: process.env.FIREBASE_API_KEY || '',
    firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '',
    firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    firebaseAppId: process.env.FIREBASE_APP_ID || '',
    allowDevAuth: process.env.ALLOW_DEV_AUTH === 'true'
  });
});

// 8. Serve Static Frontend UI
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// Fallback to index.html for Single-Page Navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// 9. Global Error Handler (Directive #2 - Output Handling & Sanitization)
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    requestId: req.headers['x-request-id'] || undefined
  });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  Personal Gemini Journal running on port ${PORT}`);
  console.log(`  Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Health probe: http://localhost:${PORT}/health`);
  console.log(`====================================================`);
});
