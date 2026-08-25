# ==============================================================================
# Cloud Run Automated Deployment Script (PowerShell for Windows)
# Challenge: Build a Secure Personal Gemini Journal
# Mandatory Label: dev-tutorial=cloud-run-ai-challenge
# ==============================================================================

$ServiceName = "personal-gemini-journal"
$Region = "us-central1"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Starting Cloud Run Deployment: $ServiceName" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Get Project ID
$ProjectId = (gcloud config get-value project 2>$null).Trim()
if (-not $ProjectId) {
    Write-Error "No active GCP project found. Run 'gcloud config set project <PROJECT_ID>' first."
    exit 1
}
Write-Host "Active GCP Project: $ProjectId" -ForegroundColor Green

# 2. Enable Required APIs
Write-Host "Enabling Google Cloud APIs..." -ForegroundColor Yellow
gcloud services enable `
    run.googleapis.com `
    secretmanager.googleapis.com `
    firestore.googleapis.com `
    artifactregistry.googleapis.com `
    cloudbuild.googleapis.com

# 3. Setup Secret Manager for GEMINI_API_KEY
$secretCheck = gcloud secrets describe GEMINI_API_KEY --project=$ProjectId 2>$null
if (-not $secretCheck) {
    Write-Host "Creating GEMINI_API_KEY secret in Secret Manager..." -ForegroundColor Yellow
    gcloud secrets create GEMINI_API_KEY --replication-policy="automatic" --project=$ProjectId
    $apiKey = Read-Host "Please enter your Gemini API Key" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($apiKey)
    $plainApiKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    $plainApiKey | gcloud secrets versions add GEMINI_API_KEY --data-file=- --project=$ProjectId
} else {
    Write-Host "GEMINI_API_KEY secret exists in Secret Manager." -ForegroundColor Green
}

# 4. Grant Secret Accessor IAM Role
$ProjectNumber = (gcloud projects describe $ProjectId --format="value(projectNumber)").Trim()
$ServiceAccount = "$ProjectNumber-compute@developer.gserviceaccount.com"

Write-Host "Granting Secret Accessor permission to: $ServiceAccount" -ForegroundColor Yellow
gcloud secrets add-iam-policy-binding GEMINI_API_KEY `
    --member="serviceAccount:$ServiceAccount" `
    --role="roles/secretmanager.secretAccessor" `
    --project=$ProjectId

# 5. Build and Deploy to Cloud Run
Write-Host "Deploying to Google Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $ServiceName `
    --source . `
    --region $Region `
    --allow-unauthenticated `
    --set-env-vars="GOOGLE_CLOUD_PROJECT=$ProjectId,NODE_ENV=production" `
    --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" `
    --update-labels="dev-tutorial=cloud-run-ai-challenge" `
    --project=$ProjectId

# 6. Retrieve Service URL
$ServiceUrl = (gcloud run services describe $ServiceName --region=$Region --format='value(status.url)').Trim()

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Deployment Complete!" -ForegroundColor Green
Write-Host " Service URL: $ServiceUrl" -ForegroundColor Green
Write-Host " Verification Label: dev-tutorial=cloud-run-ai-challenge" -ForegroundColor Green
Write-Host " Hashtag: #AccelerateAIwithCloudRun" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
