# 🛡️ Personal Gemini Journal: Enterprise Secure AI Reflection Studio

[![Google Cloud Run](https://img.shields.io/badge/Deploy-Google%20Cloud%20Run-4285F4?logo=google-cloud&logoColor=white)](https://cloud.google.com/run)
[![Firebase Auth](https://img.shields.io/badge/Auth-Firebase%20Google%20Sign--In-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![Cloud Firestore](https://img.shields.io/badge/Database-Cloud%20Firestore-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/docs/firestore)
[![Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini%20API-8E75B2?logo=google-gemini&logoColor=white)](https://ai.google.dev/)
[![Challenge Label](https://img.shields.io/badge/Verification%20Label-dev--tutorial%3Dcloud--run--ai--challenge-34A853)](#cloud-run-deployment)
[![Hashtag](https://img.shields.io/badge/Hashtag-%23AccelerateAIwithCloudRun-blue)](#submission--social-showcase)

---

## 🌟 Executive Summary

**Personal Gemini Journal** is an authenticated, enterprise-grade AI journaling application built on **Google Cloud Run**, powered by **Google Gemini API**, authenticated via **Firebase Google Sign-In**, and isolated within **Cloud Firestore**.

Configured from inception with **Google AI Studio Custom Security Directives**, this project solves the fundamental vulnerabilities of AI prototypes by integrating proactive threat modeling, strict owner-bound data isolation, Secret Manager credential resolution, a 4-tier Gemini model fallback ladder, and 5 original AI enhancements.

---

## 🏗️ System Architecture

```mermaid
graph TD
    User([User Browser])
    
    subgraph Frontend Client [Responsive Glassmorphism UI]
        WebUI[SPA Dashboard]
        AuthSDK[Firebase Web Auth SDK]
        VoiceEngine[Web Speech Dictation Engine]
    end

    subgraph Google Cloud Run Service [Containerized Express Backend]
        Server[Express.js App]
        AuthGuard[Firebase Admin Token Verifier]
        Sanitizer[Zero-Crash Payload Sanitizer]
        GeminiService[Gemini SDK + 4-Tier Fallback Ladder]
        SecretClient[Secret Manager Service Client]
    end

    subgraph Managed Google Cloud & Firebase Services
        FirebaseAuth[(Firebase Authentication)]
        Firestore[(Cloud Firestore: users/{userId}/entries)]
        SecretMgr[(Google Cloud Secret Manager)]
        GeminiAPI[(Google Gemini 2.5/1.5 Flash API)]
    end

    User -->|Single Sign-On| AuthSDK
    AuthSDK -->|Federated Google Auth| FirebaseAuth
    FirebaseAuth -->|Cryptographic JWT ID Token| AuthSDK
    
    User -->|Voice / Text Reflections| WebUI
    WebUI -->|API Request + Bearer Token| Server
    
    Server -->|1. Verify Token UID| AuthGuard
    AuthGuard -->|2. Check Context Identity| Sanitizer
    Server -->|3. Fetch Operational Keys| SecretClient
    SecretClient -.->|Retrieve GEMINI_API_KEY| SecretMgr
    
    Server -->|4. Generate Insights & Socratic Coaching| GeminiService
    GeminiService -->|5. Resilient Generation Call| GeminiAPI
    
    Server -->|6. User-Isolated Write: users/{uid}/...| Firestore
    Server -->|7. Sanitized JSON Output| WebUI
```

---

## 🛡️ Agentic Threat Modeling (The 5 Threat Zones)

In accordance with **Directive #1**, this system underwent structured threat modeling before implementation:

| Threat Zone | Identified Attack Vector | Mitigation / Countermeasure |
| :--- | :--- | :--- |
| **1. Input Surfaces** | Malicious prompt injection, payload tampering, huge payloads. | Strict JSON schema decoding, input sanitization, body parser limit (5MB), and parameterized handlers. |
| **2. Planning & Reasoning** | Prompt injection attempting to leak other user data or override system instructions. | Socratic system prompts instructing Gemini to treat input as plain text data, not executable commands. |
| **3. Tool Execution** | SSRF, privilege escalation, unauthorized API calls. | Secret Manager runtime extraction; no raw exec or arbitrary HTTP fetching allowed from client. |
| **4. Memory & State** | Cross-user data leakage, unauthorized document queries. | Strict Firestore path isolation (`/users/{userId}/...`) verified cryptographically on server and via `firestore.rules`. |
| **5. Inter-System Comm.** | Hardcoded API keys in git or client bundles. | Zero hardcoded keys; dynamically resolved via Google Cloud Secret Manager. |

---

## 🚀 5 Original Feature Enhancements

Beyond the baseline journal spec, this application incorporates 5 original capabilities:

1. **🧠 Mindscape Emotional Resonance Analytics**:
   - Analyzes entries across 5 emotional vectors: *Gratitude, Clarity, Stress, Joy, and Focus* (0-100 score).
   - Generates historical averages and trajectory charts on the dashboard.

2. **💡 Socratic Deep Reflection Coach**:
   - Automatically formulates constructive Socratic inquiries tailored to the user's reflection, sparking deeper self-awareness.
   - Includes 1-click **"Discuss in Gemini Companion"** transition.

3. **🏷️ Smart Semantic Tagging & Dynamic Theme Filtering**:
   - Automatically extracts entity tags and recurring life themes (e.g., `#mindfulness`, `#workplace`, `#growth`).
   - Interactive sidebar pill filter to browse entries by topic.

4. **🎙️ Voice-to-Journal Dictation Engine**:
   - Direct Web Speech API integration allowing users to speak their stream of consciousness with real-time transcription and visual pulse indicator.

5. **📦 Privacy Vault & One-Click Backup Export**:
   - Instant Markdown and JSON export capabilities for true user data ownership.

---

## 🔒 Security Configuration & Firestore Rules

### Cloud Firestore Security Rules (`firestore.rules`)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Default Deny All
    match /{document=**} {
      allow read, write: if false;
    }

    // User Data Isolation Boundary
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /entries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      match /analytics/{analyticsId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

---

## 🛠️ Step-by-Step Google Cloud Run Deployment

### Prerequisites
1. [Google Cloud SDK (gcloud CLI)](https://cloud.google.com/sdk/docs/install) installed and logged in.
2. An active Google Cloud Project with billing enabled.

### 1. Configure GCP Project
```bash
gcloud config set project YOUR_PROJECT_ID
export PROJECT_ID=$(gcloud config get-value project)
```

### 2. Enable Required Cloud APIs
```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

### 3. Create Secret in Google Cloud Secret Manager
```bash
# Create secret for Gemini API Key
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Grant Cloud Run Service Account permission to read secret
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 4. Deploy to Google Cloud Run (With Mandatory Campaign Verification Label)
```bash
gcloud run deploy personal-gemini-journal \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,NODE_ENV=production" \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --update-labels="dev-tutorial=cloud-run-ai-challenge"
```

---

## 💻 Local Development & Verification

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Verification Test Suite
```bash
npm test
```
*Validates 4-tier model fallback ladder, payload sanitization, user data isolation, and API integrity.*

### 3. Start Local Server
```bash
npm start
```
Open **http://localhost:8080** in your browser.

---

## 🏆 Submission & Social Showcase

- **Challenge Verification Label**: `dev-tutorial=cloud-run-ai-challenge`
- **Social Media Hashtag**: `#AccelerateAIwithCloudRun`

### 💡 Technologies Used
- **Google Cloud Run**: Serverless container hosting with autoscaling and secure HTTPS.
- **Google Cloud Secret Manager**: Dynamic zero-hardcoding key management.
- **Google Gemini API**: Multi-turn brainstorming, emotion classification, and cognitive summarization with automated 4-tier fallback ladder.
- **Firebase Authentication**: Federated Google Sign-In single sign-on.
- **Cloud Firestore**: Strict user-isolated document subcollection store (`/users/{userId}/...`).
- **Google AI Studio**: Custom Security Directives & Constitution.
