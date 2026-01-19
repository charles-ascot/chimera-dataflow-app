# API Reference

Base URL: `https://chimera-dataflow-app-xxxxx.run.app`

## Health Check

### GET /health

Returns service health status.

**Response**
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "project": "betfair-data-explorer"
}
```

---

## Plugins

### GET /api/plugins

List available source plugins.

**Response**
```json
{
  "plugins": [
    {
      "id": "betfair",
      "name": "Betfair",
      "extensions": [".bz2"],
      "compression": "bz2",
      "enabled": true,
      "description": "Betfair historical market data in bz2-compressed NDJSON format"
    },
    {
      "id": "racing_api",
      "name": "The Racing API",
      "extensions": [".json", ".ndjson"],
      "compression": "none",
      "enabled": false,
      "description": "Racing API data (coming soon)"
    }
  ]
}
```

### POST /api/plugins/validate

Validate that file patterns match actual files in GCS.

**Request**
```json
{
  "sourceType": "betfair",
  "sourceBucket": "my-bucket",
  "selectedPaths": ["ADVANCED/2016/Jan/1"]
}
```

**Response**
```json
{
  "totalFiles": 150,
  "patterns": [
    {
      "pattern": "gs://my-bucket/ADVANCED/2016/Jan/1/*.bz2",
      "valid": true,
      "fileCount": 150,
      "truncated": false
    }
  ],
  "allValid": true
}
```

---

## GCP Resources

### GET /api/gcp/projects

List accessible GCP projects.

**Response**
```json
{
  "projects": [
    {
      "projectId": "betfair-data-explorer",
      "displayName": "Betfair Data Explorer"
    }
  ]
}
```

### GET /api/gcp/projects/{project_id}/buckets

List buckets in a project.

**Response**
```json
{
  "buckets": [
    {
      "name": "my-bucket",
      "location": "EU",
      "storageClass": "STANDARD"
    }
  ]
}
```

### GET /api/gcp/buckets/{bucket_name}/browse

Browse root of a bucket.

**Response**
```json
{
  "path": "",
  "folders": ["ADVANCED", "BASIC"],
  "files": []
}
```

### GET /api/gcp/buckets/{bucket_name}/browse/{path}

Browse a specific path.

**Response**
```json
{
  "path": "ADVANCED/2016/Jan",
  "folders": ["1", "2", "3"],
  "files": [
    {
      "name": "metadata.json",
      "size": 1234,
      "updated": "2024-01-19T12:00:00Z"
    }
  ]
}
```

### GET /api/gcp/buckets/check/{bucket_name}

Check if bucket name is available.

**Response**
```json
{
  "available": true,
  "bucketName": "new-bucket-name"
}
```

### POST /api/gcp/buckets/create

Create a new bucket.

**Request**
```json
{
  "projectId": "betfair-data-explorer",
  "bucketName": "new-bucket",
  "location": "EU",
  "storageClass": "STANDARD"
}
```

**Response**
```json
{
  "created": true,
  "bucketName": "new-bucket",
  "location": "EU"
}
```

---

## Pipeline Operations

### POST /api/pipeline/submit

Submit a new Dataflow pipeline job.

**Request**
```json
{
  "sourceType": "betfair",
  "sourceProject": "betfair-data-explorer",
  "sourceBucket": "source-bucket",
  "sourceDataset": "ADVANCED/2016",
  "selectedPaths": ["Jan/1", "Jan/2"],
  "processType": "CONCATENATE",
  "outputShards": 10,
  "compression": "NONE",
  "targetBucket": "target-bucket",
  "outputPrefix": "output/jan-2016",
  "dataflowRegion": "us-central1",
  "dataflowWorkerType": "n1-standard-4",
  "dataflowMaxWorkers": "AUTO",
  "dataflowTimeoutHours": 6,
  "createNewBucket": false,
  "storageClass": "STANDARD"
}
```

**Response**
```json
{
  "jobId": "2024-01-19-abc12345",
  "dataflowJobId": "2024-01-19-xxxx-xxxx",
  "status": "submitted",
  "message": "Job submitted to Dataflow",
  "dataflowUrl": "https://console.cloud.google.com/dataflow/jobs/us-central1/..."
}
```

### GET /api/pipeline/{job_id}/status

Get job status.

**Response**
```json
{
  "jobId": "2024-01-19-abc12345",
  "dataflowJobId": "2024-01-19-xxxx",
  "status": "running",
  "sourceType": "betfair",
  "sourceBucket": "source-bucket",
  "targetBucket": "target-bucket",
  "createdAt": "2024-01-19T12:00:00Z",
  "dataflowUrl": "https://console.cloud.google.com/dataflow/jobs/...",
  "stages": {
    "read": "complete",
    "decompress": "running",
    "write": "waiting"
  }
}
```

**Status Values**
- `submitted` - Job submitted, waiting to start
- `running` - Pipeline is processing
- `completed` - Successfully finished
- `failed` - Pipeline failed
- `cancelled` - User cancelled

### GET /api/pipeline/{job_id}/logs

Get job logs.

**Response**
```json
{
  "logs": [
    "[2024-01-19T12:00:00Z] Pipeline submitted",
    "[2024-01-19T12:01:00Z] Workers started",
    "[2024-01-19T12:05:00Z] Processing files..."
  ]
}
```

### POST /api/pipeline/{job_id}/cancel

Cancel a running job.

**Response**
```json
{
  "cancelled": true
}
```

### GET /api/pipeline/history

Get recent job history.

**Query Parameters**
- `limit` (optional): Max jobs to return (default: 20, max: 100)

**Response**
```json
{
  "jobs": [
    {
      "jobId": "2024-01-19-abc12345",
      "status": "completed",
      "sourceType": "betfair",
      "createdAt": "2024-01-19T12:00:00Z"
    }
  ]
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

HTTP Status Codes:
- `400` - Bad request (invalid parameters)
- `404` - Resource not found
- `500` - Internal server error
