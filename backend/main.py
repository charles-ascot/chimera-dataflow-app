"""CHIMERA DataFlow API v2.0 - FastAPI backend for data transport pipelines.

Supports multiple data source plugins with extensible architecture.
"""

import os
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from models import (
    PipelineSubmitRequest,
    CreateBucketRequest,
    ValidatePatternsRequest,
    ProjectsResponse,
    BucketsResponse,
    DatasetsResponse,
    DatesResponse,
    BucketAvailabilityResponse,
    CreateBucketResponse,
    PipelineSubmitResponse,
    JobStatusResponse,
    JobLogsResponse,
    CancelJobResponse,
    JobHistoryResponse,
    PluginsResponse,
    ValidatePatternsResponse,
    JobStatus,
)
from gcp_client import GCPClient
from firestore_client import FirestoreClient
from dataflow_runner import DataflowRunner
from plugins import list_plugins, get_plugin

# Initialize GCP clients - will fail immediately if credentials unavailable
gcp_client = GCPClient()
firestore_client = FirestoreClient()
dataflow_runner = DataflowRunner()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    print("=" * 60)
    print("CHIMERA DataFlow API v2.0 starting")
    print(f"GCP Project: {gcp_client.project}")
    print("=" * 60)
    yield
    print("CHIMERA DataFlow API v2.0 shutting down")


app = FastAPI(
    title="CHIMERA DataFlow API",
    description="API for data transport pipelines with multi-source plugin support",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS configuration for Cloudflare Pages frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://chimera-dataflow-app.pages.dev",
        "https://dataflow.thync.online",
        "http://localhost:5173",  # Local development
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Health Check
# ============================================================================


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "project": gcp_client.project,
    }


# ============================================================================
# Plugin Endpoints
# ============================================================================


@app.get("/api/plugins", response_model=PluginsResponse)
async def get_plugins():
    """List all available source plugins."""
    plugins = list_plugins()
    return {"plugins": plugins}


@app.post("/api/plugins/validate", response_model=ValidatePatternsResponse)
async def validate_patterns(request: ValidatePatternsRequest):
    """Validate file patterns for a source configuration.
    
    This checks that the generated patterns actually match files in GCS.
    """
    try:
        # Get the plugin and generate patterns
        plugin = get_plugin(request.sourceType)
        patterns = plugin.build_patterns(request.sourceBucket, request.selectedPaths)
        
        # Validate patterns against actual files
        result = dataflow_runner.validate_patterns(patterns)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# GCP Resource Discovery Endpoints
# ============================================================================


@app.get("/api/gcp/projects", response_model=ProjectsResponse)
async def list_projects():
    """List all accessible GCP projects."""
    try:
        projects = gcp_client.list_projects()
        return {"projects": projects}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/gcp/projects/{project_id}/buckets", response_model=BucketsResponse)
async def list_buckets(project_id: str):
    """List all buckets in a project."""
    try:
        buckets = gcp_client.list_buckets(project_id)
        return {"buckets": buckets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/gcp/buckets/{bucket_name}/datasets", response_model=DatasetsResponse)
async def list_datasets(bucket_name: str):
    """List top-level datasets (prefixes) in a bucket."""
    try:
        datasets = gcp_client.list_datasets(bucket_name)
        return {"datasets": datasets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/gcp/datasets/{bucket_name}/{dataset_path:path}/dates", response_model=DatesResponse)
async def list_dates(bucket_name: str, dataset_path: str):
    """List available dates in a dataset with file counts."""
    try:
        dates = gcp_client.list_dates(bucket_name, dataset_path)
        return {"availableDates": dates}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/gcp/buckets/{bucket_name}/browse")
async def browse_bucket_root(bucket_name: str):
    """Browse the root of a bucket."""
    try:
        result = gcp_client.browse_path(bucket_name, "")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/gcp/buckets/{bucket_name}/browse/{path:path}")
async def browse_bucket_path(bucket_name: str, path: str):
    """Browse a specific path within a bucket."""
    try:
        result = gcp_client.browse_path(bucket_name, path)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/gcp/buckets/check/{bucket_name}", response_model=BucketAvailabilityResponse)
async def check_bucket_availability(bucket_name: str):
    """Check if a bucket name is available."""
    try:
        result = gcp_client.check_bucket_availability(bucket_name)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/gcp/buckets/create", response_model=CreateBucketResponse)
async def create_bucket(request: CreateBucketRequest):
    """Create a new GCS bucket."""
    try:
        result = gcp_client.create_bucket(
            project_id=request.projectId,
            bucket_name=request.bucketName,
            location=request.location,
            storage_class=request.storageClass.value,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Pipeline Submission Endpoints
# ============================================================================


@app.post("/api/pipeline/submit", response_model=PipelineSubmitResponse)
async def submit_pipeline(request: PipelineSubmitRequest):
    """Submit a new Dataflow pipeline job."""
    try:
        # Create new bucket if requested
        if request.createNewBucket:
            gcp_client.create_bucket(
                project_id=request.sourceProject,
                bucket_name=request.targetBucket,
                location="EU",
                storage_class=request.storageClass.value if request.storageClass else "STANDARD",
            )

        # Submit to Dataflow
        result = dataflow_runner.submit_pipeline(
            source_type=request.sourceType,
            source_bucket=request.sourceBucket,
            source_dataset=request.sourceDataset,
            selected_paths=request.selectedPaths,
            process_type=request.processType.value,
            output_shards=request.outputShards,
            compression=request.compression.value,
            target_bucket=request.targetBucket,
            output_prefix=request.outputPrefix,
            region=request.dataflowRegion,
            worker_type=request.dataflowWorkerType,
            max_workers=request.dataflowMaxWorkers,
            timeout_hours=request.dataflowTimeoutHours,
        )

        # Store job in Firestore
        job_data = {
            "jobId": result["jobId"],
            "dataflowJobId": result["dataflowJobId"],
            "sourceType": request.sourceType,
            "sourceProject": request.sourceProject,
            "sourceBucket": request.sourceBucket,
            "sourceDataset": request.sourceDataset,
            "selectedPaths": request.selectedPaths,
            "processType": request.processType.value,
            "outputShards": request.outputShards,
            "compression": request.compression.value,
            "targetBucket": request.targetBucket,
            "outputPrefix": request.outputPrefix,
            "dataflowRegion": request.dataflowRegion,
            "status": "submitted",
            "createdAt": datetime.utcnow(),
            "dataflowUrl": result["dataflowUrl"],
            "config": result.get("config", {}),
            "logs": [f"[{datetime.utcnow().isoformat()}Z] Pipeline submitted"],
            "stages": {
                "read": "waiting",
                "decompress": "waiting",
                "concatenate": "waiting",
                "write": "waiting",
                "validate": "waiting",
            },
        }

        firestore_client.create_job(job_data)

        return {
            "jobId": result["jobId"],
            "dataflowJobId": result["dataflowJobId"],
            "status": JobStatus.SUBMITTED,
            "message": result["message"],
            "dataflowUrl": result["dataflowUrl"],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Job Monitoring Endpoints
# ============================================================================


@app.get("/api/pipeline/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Get the status of a pipeline job."""
    try:
        job = firestore_client.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Get latest status from Dataflow if job is still running
        if job.get("dataflowJobId") and job.get("status") in ["submitted", "running"]:
            df_status = dataflow_runner.get_job_status(
                job["dataflowJobId"],
                job.get("dataflowRegion", "europe-west2")
            )
            if df_status.get("status") != "unknown":
                job["status"] = df_status["status"]
                firestore_client.update_job(job_id, {"status": df_status["status"]})

        return job

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/pipeline/{job_id}", response_model=JobStatusResponse)
async def get_job_details(job_id: str):
    """Get full details of a pipeline job."""
    return await get_job_status(job_id)


@app.get("/api/pipeline/{job_id}/logs", response_model=JobLogsResponse)
async def get_job_logs(job_id: str):
    """Get logs for a pipeline job."""
    try:
        logs = firestore_client.get_logs(job_id)
        return {"logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/pipeline/{job_id}/cancel", response_model=CancelJobResponse)
async def cancel_job(job_id: str):
    """Cancel a running pipeline job."""
    try:
        job = firestore_client.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Try to cancel the Dataflow job if it exists
        if job.get("dataflowJobId"):
            try:
                dataflow_runner.cancel_job(
                    job["dataflowJobId"],
                    job.get("dataflowRegion", "europe-west2")
                )
            except Exception as df_error:
                # Log the error but continue
                print(f"Could not cancel Dataflow job: {df_error}")

        firestore_client.update_job(job_id, {"status": "cancelled"})
        return {"cancelled": True}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/pipeline/history", response_model=JobHistoryResponse)
async def get_job_history(limit: int = Query(default=20, le=100)):
    """Get recent job history."""
    try:
        jobs = firestore_client.list_jobs(limit=limit)
        return {"jobs": jobs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Run the application
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
