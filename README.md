# CHIMERA DataFlow v2.0

Data transport pipeline application for reading compressed data files from Google Cloud Storage buckets, decompressing them, and writing output to target buckets.

## Features

- **Plugin Architecture**: Supports multiple data source providers
  - Betfair (default) - bz2 compressed NDJSON files
  - The Racing API (coming soon)
  - Custom/Other (coming soon)
  
- **Improved Reliability**
  - Pattern validation before pipeline submission
  - File count verification
  - Comprehensive metrics and logging
  - Proper module staging for Dataflow workers

- **Modern Stack**
  - Backend: Python 3.11+, FastAPI, Apache Beam
  - Frontend: React (Vite), vanilla CSS
  - Backend Hosting: Google Cloud Run
  - Frontend Hosting: Cloudflare Pages
  - Database: Firestore (job tracking)
  - Storage: Google Cloud Storage

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CHIMERA DataFlow v2.0                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Frontend   │───▶│   Backend    │───▶│  Dataflow    │  │
│  │  (React/CF)  │    │ (FastAPI/CR) │    │  Pipeline    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                             │                    │          │
│                             ▼                    ▼          │
│                      ┌──────────────┐    ┌──────────────┐  │
│                      │  Firestore   │    │     GCS      │  │
│                      │  (Jobs DB)   │    │   Buckets    │  │
│                      └──────────────┘    └──────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### GCP Settings

| Setting | Value |
|---------|-------|
| Project ID | betfair-data-explorer |
| Cloud Run Region | europe-west2 |
| Dataflow Region | europe-west2 |
| Service Name | chimera-dataflow-api |

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/plugins` | GET | List available source plugins |
| `/api/plugins/validate` | POST | Validate file patterns |
| `/api/gcp/projects` | GET | List GCP projects |
| `/api/gcp/projects/{id}/buckets` | GET | List buckets |
| `/api/gcp/buckets/{name}/browse/{path?}` | GET | Browse bucket contents |
| `/api/pipeline/submit` | POST | Submit pipeline job |
| `/api/pipeline/{job_id}/status` | GET | Get job status |
| `/api/pipeline/{job_id}/cancel` | POST | Cancel job |
| `/api/pipeline/history` | GET | List past jobs |

## Development

### Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Deployment

### Backend (Cloud Run)

Automatically deployed via GitHub Actions when changes are pushed to `backend/**`.

### Frontend (Cloudflare Pages)

Automatically deployed via GitHub Actions when changes are pushed to `frontend/**`.

## Testing

### Validate Pattern Matching

```bash
# Test that patterns match actual files
gsutil ls "gs://your-bucket/ADVANCED/2016/**/*.bz2" | head -10
```

### Test Decompression

```bash
python -c "
import bz2
with open('sample.bz2', 'rb') as f:
    data = bz2.decompress(f.read())
    print(f'Decompressed {len(data)} bytes')
    print(data[:500].decode('utf-8'))
"
```

## Critical Fixes from v1.0

1. **Pattern Matching**: Added validation to ensure patterns match actual files before pipeline submission
2. **Path Handling**: Normalized paths to prevent malformed GCS patterns
3. **Module Staging**: Proper setup.py configuration for Dataflow workers
4. **Empty Output Files**: Added metrics counters and logging to debug issues

## License

Proprietary - Ascot Wealth Management
