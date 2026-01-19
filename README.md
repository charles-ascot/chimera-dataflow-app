# CHIMERA DataFlow v2.0

Data transport pipeline for processing compressed Betfair data files from Google Cloud Storage. Reads bz2-compressed NDJSON files, decompresses and concatenates them, then writes output shards to target buckets for downstream analysis.

## Overview

CHIMERA DataFlow is part of the CHIMERA data pipeline:

```
Source Data (GCS)     CHIMERA DataFlow      CHIMERA Analysis      BigQuery
   .bz2 files    -->  decompress/concat -->    analyze       -->   tables
```

### Key Features

- **Plugin Architecture** - Extensible support for multiple data sources
- **Direct GCS Access** - Bypasses Beam fileio for reliable Dataflow execution
- **Pattern Validation** - Validates file patterns before pipeline submission
- **Deduplication** - Prevents processing the same file twice
- **Job Tracking** - Firestore-backed job history and status monitoring

## Architecture

```
Frontend (React/Vite)          Backend (FastAPI)           Dataflow
   Cloudflare Pages      -->     Cloud Run         -->    GCP Dataflow
        |                           |                         |
        |                      Firestore                     GCS
        |                     (job tracking)            (input/output)
        v                           v                         v
   User selects files     API validates & submits      Workers process
   and configures job      pipeline to Dataflow        files in parallel
```

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- Google Cloud SDK with `gcloud` authenticated
- Access to `betfair-data-explorer` GCP project

### Run Locally

```bash
# Backend
cd backend
pip install -r requirements.txt
python main.py

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, components |
| [API Reference](docs/API.md) | REST endpoints, request/response formats |
| [Deployment](docs/DEPLOYMENT.md) | Cloud Run + Cloudflare Pages deployment |
| [Development](docs/DEVELOPMENT.md) | Local setup, testing, debugging |
| [Plugins](docs/PLUGINS.md) | Plugin system and creating new sources |

## URLs

| Environment | URL |
|-------------|-----|
| Frontend | https://dataflow.thync.online |
| Frontend Alt | https://chimera-dataflow-app.pages.dev |
| API | https://chimera-dataflow-app-xxxxx.run.app |
| GitHub | https://github.com/charles-ascot/chimera-dataflow-app |

## Project Structure

```
chimera-dataflow-app/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── beam_pipeline.py     # Apache Beam pipeline definition
│   ├── dataflow_runner.py   # Dataflow job submission
│   ├── gcp_client.py        # GCS/GCP operations
│   ├── firestore_client.py  # Job persistence
│   ├── models.py            # Pydantic models
│   ├── plugins/             # Source plugins
│   │   ├── base.py          # Plugin base class
│   │   ├── betfair.py       # Betfair data source
│   │   └── racing_api.py    # Racing API (coming soon)
│   ├── setup.py             # Dataflow worker module staging
│   ├── requirements.txt     # Python dependencies
│   └── Dockerfile           # Cloud Run container
├── frontend/
│   ├── src/                 # React components
│   ├── package.json         # Node dependencies
│   └── vite.config.ts       # Vite configuration
├── .github/workflows/       # CI/CD pipelines
│   ├── deploy-backend.yml   # Cloud Run deployment
│   └── deploy-frontend.yml  # Cloudflare Pages deployment
└── docs/                    # Documentation
```

## GCP Resources

| Resource | Name/ID |
|----------|---------|
| Project | betfair-data-explorer |
| Cloud Run Service | chimera-dataflow-app |
| Cloud Run Region | us-central1 |
| Dataflow Region | us-central1 |
| Firestore Collection | dataflow-jobs |

## License

PROPRIETARY - Ascot Wealth Management
