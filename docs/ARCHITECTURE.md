# Architecture

## System Overview

CHIMERA DataFlow is a distributed data processing system that reads compressed files from GCS, decompresses them, and writes concatenated output for downstream analysis.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CHIMERA DataFlow v2.0                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────────┐  │
│  │   Frontend   │───▶│   Backend    │───▶│      Google Dataflow         │  │
│  │  React/Vite  │    │   FastAPI    │    │                              │  │
│  │  Cloudflare  │    │  Cloud Run   │    │  ┌────────┐  ┌────────┐     │  │
│  └──────────────┘    └──────────────┘    │  │Worker 1│  │Worker N│     │  │
│         │                   │            │  └────────┘  └────────┘     │  │
│         │                   │            │       │            │        │  │
│         │                   ▼            └───────┼────────────┼────────┘  │
│         │            ┌──────────────┐            │            │           │
│         │            │  Firestore   │            │            │           │
│         │            │  (Job DB)    │            │            │           │
│         │            └──────────────┘            │            │           │
│         │                                        ▼            ▼           │
│         │                              ┌─────────────────────────────┐    │
│         └─────────────────────────────▶│    Google Cloud Storage     │    │
│              (browse buckets)          │  (source + target buckets)  │    │
│                                        └─────────────────────────────┘    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## Components

### Frontend (React/Vite)

- **Hosting**: Cloudflare Pages
- **Purpose**: User interface for job configuration and monitoring
- **Features**:
  - GCS bucket browser
  - File/folder selection
  - Job configuration form
  - Real-time status polling
  - Job history view

### Backend (FastAPI)

- **Hosting**: Google Cloud Run
- **Purpose**: API layer and job orchestration
- **Responsibilities**:
  - GCS bucket listing and browsing
  - Pattern validation
  - Dataflow pipeline submission
  - Job status tracking via Firestore
  - Dataflow job status polling

### Apache Beam Pipeline

- **Hosting**: Google Cloud Dataflow
- **Purpose**: Distributed file processing
- **Pipeline stages**:

```
CreatePatterns → ListFiles → Deduplicate → Reshuffle → ReadAndDecompress → WriteOutput
```

### Data Flow

1. **Pattern Creation**: Input paths converted to GCS patterns
2. **File Listing**: `ListGCSFiles` DoFn lists actual files using GCS client
3. **Deduplication**: `beam.Distinct()` removes duplicate paths from overlapping patterns
4. **Reshuffling**: Redistributes files across workers for parallel processing
5. **Read/Decompress**: `ReadAndDecompressGCSFile` DoFn downloads and decompresses each file
6. **Write Output**: `WriteToText` writes lines to sharded output files

## Key Design Decisions

### Direct GCS Access (not fileio)

The pipeline uses direct GCS client access instead of Beam's `fileio` module:

```python
# Old approach (problematic on Dataflow workers)
fileio.MatchFiles(pattern) | fileio.ReadMatches()

# New approach (reliable)
beam.ParDo(ListGCSFiles()) | beam.ParDo(ReadAndDecompressGCSFile())
```

**Reason**: `fileio.MatchFiles` and `fileio.ReadMatches` were producing zero-byte output files on Dataflow workers despite working locally.

### Dual Pattern Matching

Each path generates two patterns:
- `gs://bucket/path/*.bz2` - Files directly in folder
- `gs://bucket/path/**/*.bz2` - Files in subdirectories

Combined with `beam.Distinct()` to prevent duplicate processing.

### Plugin Architecture

Extensible source plugin system allows adding new data sources without modifying core pipeline code:

```python
class SourcePlugin(ABC):
    @abstractmethod
    def build_patterns(self, bucket, paths) -> List[str]: ...

    @abstractmethod
    def get_decompressor_class(self) -> str: ...
```

## Data Storage

### Firestore Schema

Collection: `dataflow-jobs`

```json
{
  "jobId": "2024-01-19-abc12345",
  "dataflowJobId": "2024-01-19-xxxx",
  "sourceType": "betfair",
  "sourceBucket": "source-bucket",
  "selectedPaths": ["path/to/data"],
  "targetBucket": "target-bucket",
  "outputPrefix": "output/prefix",
  "status": "running",
  "createdAt": "2024-01-19T12:00:00Z",
  "dataflowUrl": "https://console.cloud.google.com/dataflow/jobs/...",
  "logs": ["[timestamp] message"],
  "stages": {
    "read": "complete",
    "decompress": "running",
    "write": "waiting"
  }
}
```

### GCS Structure

**Input**: Raw compressed files
```
gs://source-bucket/
  └── ADVANCED/
      └── 2016/
          └── Jan/
              └── 1/
                  ├── file1.bz2
                  └── file2.bz2
```

**Output**: Sharded NDJSON
```
gs://target-bucket/
  └── output-prefix/
      └── output/
          ├── output-00000-of-00010.ndjson
          ├── output-00001-of-00010.ndjson
          └── ...
```

## Security

- Cloud Run uses default service account with GCS access
- Dataflow workers use project default service account
- CORS restricted to known frontend origins
- No authentication on API (internal use only)

## Scalability

- Dataflow auto-scales workers based on data volume
- Cloud Run scales 0-10 instances
- Firestore handles job metadata
- GCS handles all data storage
