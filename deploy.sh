#!/bin/bash
# ==============================================================================
# Cloud Run Automated Deployment Script
# Challenge: Build a Secure Personal Gemini Journal
# Mandatory Label: dev-tutorial=cloud-run-ai-challenge
# ==============================================================================

set -e

SERVICE_NAME="personal-gemini-journal"
REGION="us-central1"

echo "========================================================"
echo " Starting Cloud Run Deployment: $SERVICE_NAME"
echo "========================================================"

# 1. Check GCP Project
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
  echo "Error: No active GCP project found. Run 'gcloud config set project <PROJECT_ID>' first."
  exit 1
fi
echo "Active GCP Project: $PROJECT_ID"

# 2. Enable Required APIs
echo "Enabling Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com

# 3. Setup Secret Manager for GEMINI_API_KEY (Zero-Hardcoding Hygiene)
if ! gcloud secrets describe GEMINI_API_KEY --project="$PROJECT_ID" &>/dev/null; then
  echo "Creating GEMINI_API_KEY secret in Secret Manager..."
  gcloud secrets create GEMINI_API_KEY --replication-policy="automatic" --project="$PROJECT_ID"
  echo "Please enter your Gemini API Key:"
  read -s API_KEY_INPUT
  echo -n "$API_KEY_INPUT" | gcloud secrets versions add GEMINI_API_KEY --data-file=- --project="$PROJECT_ID"
else
  echo "GEMINI_API_KEY secret already exists in Secret Manager."
fi

# 4. Grant Cloud Run Default Service Account Access to Secrets
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "Granting Secret Accessor permission to: $SERVICE_ACCOUNT"
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor" \
  --project="$PROJECT_ID"

# 5. Build and Deploy Container to Cloud Run
echo "Deploying container image to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,NODE_ENV=production" \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --update-labels="dev-tutorial=cloud-run-ai-challenge" \
  --project="$PROJECT_ID"

# 6. Retrieve Live Service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format='value(status.url)')

echo "========================================================"
echo " Deployment Complete!"
echo " Service URL: $SERVICE_URL"
echo " Verification Label Applied: dev-tutorial=cloud-run-ai-challenge"
echo " Social Hashtag: #AccelerateAIwithCloudRun"
echo "========================================================"
