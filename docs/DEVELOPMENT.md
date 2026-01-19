# Development Guide

## Prerequisites

- Python 3.11+
- Node.js 20+
- Google Cloud SDK (`gcloud`)
- Access to `betfair-data-explorer` GCP project

## Setup

### 1. Clone Repository

```bash
git clone https://github.com/charles-ascot/chimera-dataflow-app.git
cd chimera-dataflow-app
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Authenticate with GCP
gcloud auth application-default login
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

## Running Locally

### Backend

```bash
cd backend
python main.py
```

API runs at http://localhost:8080

### Frontend

```bash
cd frontend
npm run dev
```

UI runs at http://localhost:5173

The frontend is configured to connect to `http://localhost:8080` in development.

## Project Structure

```
backend/
├── main.py              # FastAPI app, all endpoints
├── models.py            # Pydantic request/response models
├── gcp_client.py        # GCS operations (browse, list, create)
├── firestore_client.py  # Job CRUD operations
├── dataflow_runner.py   # Dataflow job submission
├── beam_pipeline.py     # Apache Beam pipeline definition
├── setup.py             # Worker module staging
└── plugins/
    ├── __init__.py      # Plugin registry
    ├── base.py          # Abstract plugin base class
    ├── betfair.py       # Betfair data source
    └── racing_api.py    # Racing API (placeholder)

frontend/
├── src/
│   ├── App.tsx          # Main app component
│   ├── components/      # React components
│   └── api/             # API client
├── package.json
└── vite.config.ts
```

## Testing

### Test Pattern Validation

```bash
# Verify patterns match actual files
gsutil ls "gs://bucket-name/path/**/*.bz2" | head -10
```

### Test Decompression Locally

```bash
python -c "
from google.cloud import storage
import bz2

client = storage.Client()
bucket = client.bucket('your-bucket')
blob = bucket.blob('path/to/file.bz2')

data = blob.download_as_bytes()
print(f'Compressed: {len(data)} bytes')

decompressed = bz2.decompress(data)
print(f'Decompressed: {len(decompressed)} bytes')
print(f'Lines: {len(decompressed.decode().strip().split(chr(10)))}')
"
```

### Test Pipeline Locally (DirectRunner)

Modify `dataflow_runner.py` temporarily:

```python
# Change runner
standard_options.runner = 'DirectRunner'  # instead of 'DataflowRunner'

# Run
python -c "
from dataflow_runner import DataflowRunner
runner = DataflowRunner()
runner.submit_pipeline(
    source_type='betfair',
    source_bucket='your-bucket',
    source_dataset='test',
    selected_paths=['path/to/small/test'],
    ...
)
"
```

## Debugging

### Check Firestore Jobs

```python
from google.cloud import firestore

db = firestore.Client()
jobs = db.collection('dataflow-jobs').order_by('createdAt', direction=firestore.Query.DESCENDING).limit(5).stream()

for job in jobs:
    print(job.id, job.to_dict().get('status'))
```

### Check Dataflow Job Status

```bash
gcloud dataflow jobs describe JOB_ID --region=us-central1
```

### View Dataflow Logs

```bash
gcloud logging read "resource.type=dataflow_step AND resource.labels.job_id=JOB_ID" --limit=100
```

### Common Issues

**Empty output files**
- Cause: `fileio.MatchFiles` not working on Dataflow workers
- Solution: Use direct GCS client access (current implementation)

**Files processed twice**
- Cause: Both `*.bz2` and `**/*.bz2` patterns matching same files
- Solution: `beam.Distinct()` deduplication step

**Module not found on workers**
- Cause: `beam_pipeline.py` not staged to workers
- Solution: `setup.py` with `py_modules=['beam_pipeline']`

## Code Style

- Python: Follow PEP 8
- TypeScript: ESLint + Prettier
- Commits: Conventional commits format

## Adding Features

1. Create feature branch from `main`
2. Make changes
3. Test locally
4. Push branch
5. Create PR
6. Merge triggers automatic deployment

## Useful Commands

```bash
# List recent Dataflow jobs
gcloud dataflow jobs list --region=us-central1 --limit=10

# Cancel a job
gcloud dataflow jobs cancel JOB_ID --region=us-central1

# Check Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision" --limit=50

# List GCS bucket contents
gsutil ls -la gs://bucket-name/path/
```
