# CHIMERA DataFlow App

A full-stack application for safely and accurately transporting Betfair data from source to target using Google Cloud Dataflow.

**Core Philosophy:** The pipeline is a pure data courier. Read files, decompress them, concatenate them, write to target. Nothing is filtered. Nothing is modified. Everything is transported safely.

## Tech Stack

- **Frontend:** React/Vite on Cloudflare Pages
- **Backend:** FastAPI/Python on Cloud Run
- **Pipeline:** Apache Beam/Dataflow
- **Storage:** Google Cloud Storage + Firestore

## Prerequisites

Before deploying, you need:

1. **GitHub Repository:** `chimera-dataflow-app`
2. **Google Cloud Project:** `betfair-data-explorer` with:
   - Cloud Run API enabled
   - Dataflow API enabled
   - Firestore enabled
   - Artifact Registry repository: `chimera-dataflow`
   - Workload Identity Federation configured for GitHub Actions
3. **Cloudflare Pages Project:** `chimera-dataflow`

## GitHub Secrets

Configure these secrets in your GitHub repository settings:

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Pages permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `GCP_PROJECT_NUMBER` | GCP project number (not ID) |
| `BACKEND_API_URL` | Cloud Run backend URL (e.g., `https://chimera-dataflow-api-xxxxx.run.app`) |

## Workload Identity Setup

Run these commands once to configure GitHub Actions authentication:

```bash
# Create Workload Identity Pool
gcloud iam workload-identity-pools create github-pool \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Create Provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Create Service Account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions"

# Grant permissions
gcloud projects add-iam-policy-binding betfair-data-explorer \
  --member="serviceAccount:github-actions@betfair-data-explorer.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding betfair-data-explorer \
  --member="serviceAccount:github-actions@betfair-data-explorer.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding betfair-data-explorer \
  --member="serviceAccount:github-actions@betfair-data-explorer.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Allow GitHub to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding \
  github-actions@betfair-data-explorer.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR_ORG/chimera-dataflow-app"
```

## Deployment

1. Clone the repository
2. Make your code changes
3. Commit and push to `main` branch
4. GitHub Actions automatically deploys:
   - Frontend → Cloudflare Pages
   - Backend → Cloud Run
5. Check deployment status in GitHub Actions tab

## Access

- **Frontend:** https://chimera-dataflow.pages.dev
- **Backend API:** https://chimera-dataflow-api-xxxxx.run.app

## API Endpoints

### GCP Resource Discovery

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/gcp/projects` | GET | List accessible GCP projects |
| `/api/gcp/projects/{project_id}/buckets` | GET | List buckets in a project |
| `/api/gcp/buckets/{bucket_name}/datasets` | GET | List datasets in a bucket |
| `/api/gcp/datasets/{bucket_name}/{dataset_path}/dates` | GET | List available dates |
| `/api/gcp/buckets/check/{bucket_name}` | GET | Check bucket name availability |
| `/api/gcp/buckets/create` | POST | Create a new bucket |

### Pipeline Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pipeline/submit` | POST | Submit a new pipeline job |
| `/api/pipeline/{job_id}/status` | GET | Get job status |
| `/api/pipeline/{job_id}/logs` | GET | Get job logs |
| `/api/pipeline/{job_id}/cancel` | POST | Cancel a running job |
| `/api/pipeline/history` | GET | Get recent job history |

## User Interface

### Section A: Source
- Select GCP project
- Select source bucket
- Select dataset (tier/year)
- Choose date range

### Section B: Process
- Choose operation type:
  - Decompress Only
  - Decompress & Concatenate (recommended)
- Configure output shards and compression
- Set Dataflow options (region, workers, timeout)

### Section C: Target
- Use existing bucket or create new
- Specify output folder name
- Preview target path

### Job Monitoring
- Real-time progress tracking
- Pipeline stage visualization
- Live logs
- Cancel running jobs

### Job History
- View past jobs
- Re-run with same configuration
- Download logs

## License

Proprietary - Betfair Data Explorer
