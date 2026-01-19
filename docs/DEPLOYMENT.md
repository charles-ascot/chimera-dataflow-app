# Deployment Guide

## Overview

CHIMERA DataFlow uses GitHub Actions for automated deployments:

| Component | Platform | Trigger |
|-----------|----------|---------|
| Backend | Google Cloud Run | Push to `backend/**` |
| Frontend | Cloudflare Pages | Push to `frontend/**` |

## Backend Deployment (Cloud Run)

### Automatic Deployment

Pushes to the `backend/` directory automatically trigger deployment via `.github/workflows/deploy-backend.yml`.

### Manual Deployment

```bash
cd backend

# Build and deploy
gcloud run deploy chimera-dataflow-app \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 3600 \
  --min-instances 0 \
  --max-instances 10
```

### Environment Variables

The Cloud Run service uses default GCP credentials. No additional environment variables required.

### Service Account Permissions

The Cloud Run service account needs:

- `roles/dataflow.admin` - Submit and manage Dataflow jobs
- `roles/storage.admin` - Access GCS buckets
- `roles/datastore.user` - Access Firestore

## Frontend Deployment (Cloudflare Pages)

### Automatic Deployment

Pushes to `frontend/` trigger deployment via `.github/workflows/deploy-frontend.yml`.

### Cloudflare Configuration

| Setting | Value |
|---------|-------|
| Project Name | chimera-dataflow |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Root Directory | `frontend` |

### Required Secrets (GitHub)

```
CLOUDFLARE_API_TOKEN    # Cloudflare API token with Pages edit permission
CLOUDFLARE_ACCOUNT_ID   # Cloudflare account ID
```

## GitHub Actions Secrets

### Backend Secrets

```
GCP_PROJECT_NUMBER      # GCP project number for Workload Identity
```

The backend uses Workload Identity Federation for authentication (no service account keys).

### Workload Identity Setup

```bash
# Create workload identity pool
gcloud iam workload-identity-pools create "github-pool" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Create provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Grant permissions
gcloud iam service-accounts add-iam-policy-binding \
  "SERVICE_ACCOUNT@PROJECT.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/charles-ascot/chimera-dataflow-app"
```

## Dataflow Worker Setup

The Beam pipeline module (`beam_pipeline.py`) is staged to Dataflow workers via `setup.py`:

```python
# backend/setup.py
setup(
    name='chimera-dataflow-pipeline',
    version='2.0.0',
    py_modules=['beam_pipeline'],
)
```

This is referenced in `dataflow_runner.py`:

```python
setup_options.setup_file = os.path.join(current_dir, 'setup.py')
```

## GCP Resources to Create

### Firestore

```bash
# Enable Firestore
gcloud firestore databases create --location=us-central1

# No explicit collection creation needed - created on first write
```

### GCS Buckets (for temp/staging)

```bash
# Dataflow temp/staging buckets created automatically in target bucket
# No manual creation required
```

## Monitoring

### Cloud Run Logs

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=chimera-dataflow-app" --limit=50
```

### Dataflow Jobs

```bash
gcloud dataflow jobs list --region=us-central1 --status=active
```

### Firestore

View jobs in Firebase Console: https://console.firebase.google.com/project/betfair-data-explorer/firestore

## Rollback

### Backend

```bash
# List revisions
gcloud run revisions list --service=chimera-dataflow-app --region=us-central1

# Rollback to specific revision
gcloud run services update-traffic chimera-dataflow-app \
  --region=us-central1 \
  --to-revisions=REVISION_NAME=100
```

### Frontend

Cloudflare Pages maintains deployment history. Rollback via Cloudflare dashboard.
