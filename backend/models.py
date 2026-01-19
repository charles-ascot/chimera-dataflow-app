"""Pydantic models for API requests and responses."""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ProcessType(str, Enum):
    """Processing type options."""
    DECOMPRESS_ONLY = "decompress_only"
    DECOMPRESS_AND_CONCATENATE = "decompress_and_concatenate"
    DECOMPRESS_CONCATENATE_PARSE = "decompress_concatenate_parse"
    DIRECT_TO_BIGQUERY = "direct_to_bigquery"


class CompressionType(str, Enum):
    """Output compression options."""
    NONE = "none"
    GZIP = "gzip"
    SNAPPY = "snappy"


class StorageClass(str, Enum):
    """GCS storage class options."""
    STANDARD = "STANDARD"
    NEARLINE = "NEARLINE"
    COLDLINE = "COLDLINE"


class JobStatus(str, Enum):
    """Pipeline job status."""
    SUBMITTED = "submitted"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StageStatus(str, Enum):
    """Pipeline stage status."""
    WAITING = "waiting"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


# ============================================================================
# Request Models
# ============================================================================


class PipelineSubmitRequest(BaseModel):
    """Request model for pipeline submission."""
    
    # Source configuration
    sourceType: str = "betfair"  # Plugin identifier
    sourceProject: str
    sourceBucket: str
    sourceDataset: str
    selectedPaths: List[str]
    
    # Processing configuration
    processType: ProcessType = ProcessType.DECOMPRESS_AND_CONCATENATE
    outputShards: int = 10
    compression: CompressionType = CompressionType.NONE
    
    # Target configuration
    targetBucket: str
    outputPrefix: str
    
    # Dataflow configuration
    dataflowRegion: str = "europe-west2"
    dataflowWorkerType: str = "n1-standard-4"
    dataflowMaxWorkers: str = "AUTO"
    dataflowTimeoutHours: int = 4
    
    # Bucket creation options
    createNewBucket: bool = False
    storageClass: Optional[StorageClass] = StorageClass.STANDARD
    retention: Optional[str] = "P1Y"


class CreateBucketRequest(BaseModel):
    """Request model for bucket creation."""
    projectId: str
    bucketName: str
    location: str = "EU"
    storageClass: StorageClass = StorageClass.STANDARD
    retention: str = "P1Y"


class ValidatePatternsRequest(BaseModel):
    """Request model for pattern validation."""
    sourceType: str = "betfair"
    sourceBucket: str
    selectedPaths: List[str]


# ============================================================================
# Response Models
# ============================================================================


class PluginInfo(BaseModel):
    """Plugin information."""
    id: str
    name: str
    extensions: List[str]
    compression: str
    enabled: bool
    description: str


class PluginsResponse(BaseModel):
    """Response for plugin list."""
    plugins: List[PluginInfo]


class ProjectInfo(BaseModel):
    """GCP project information."""
    id: str
    name: str


class ProjectsResponse(BaseModel):
    """Response for project list."""
    projects: List[ProjectInfo]


class BucketInfo(BaseModel):
    """GCS bucket information."""
    name: str
    created: Optional[str] = None
    size: str


class BucketsResponse(BaseModel):
    """Response for bucket list."""
    buckets: List[BucketInfo]


class DateRange(BaseModel):
    """Date range."""
    start: str
    end: str


class DatasetInfo(BaseModel):
    """Dataset information."""
    path: str
    fileCount: int
    totalSize: str
    hasChildren: bool = False


class DatasetsResponse(BaseModel):
    """Response for dataset list."""
    datasets: List[DatasetInfo]


class DateInfo(BaseModel):
    """Date information with file counts."""
    date: str
    files: int
    size: str
    sizeBytes: int


class DatesResponse(BaseModel):
    """Response for dates list."""
    availableDates: List[DateInfo]


class BucketAvailabilityResponse(BaseModel):
    """Response for bucket availability check."""
    available: bool
    message: Optional[str] = None


class CreateBucketResponse(BaseModel):
    """Response for bucket creation."""
    created: bool
    bucketName: str


class PatternValidationResult(BaseModel):
    """Single pattern validation result."""
    pattern: str
    valid: bool
    fileCount: int
    error: Optional[str] = None
    truncated: bool = False


class ValidatePatternsResponse(BaseModel):
    """Response for pattern validation."""
    totalFiles: int
    patterns: List[PatternValidationResult]
    allValid: bool


class StagesStatus(BaseModel):
    """Pipeline stages status."""
    read: StageStatus = StageStatus.WAITING
    decompress: StageStatus = StageStatus.WAITING
    concatenate: StageStatus = StageStatus.WAITING
    write: StageStatus = StageStatus.WAITING
    validate: StageStatus = StageStatus.WAITING


class PipelineSubmitResponse(BaseModel):
    """Response for pipeline submission."""
    jobId: str
    dataflowJobId: Optional[str] = None
    status: JobStatus
    message: str
    dataflowUrl: Optional[str] = None


class JobStatusResponse(BaseModel):
    """Response for job status."""
    jobId: str
    dataflowJobId: Optional[str] = None
    status: JobStatus
    progress: int = 0
    recordsProcessed: int = 0
    recordsTotal: Optional[int] = None
    bytesRead: int = 0
    bytesTotal: Optional[int] = None
    elapsedSeconds: int = 0
    estimatedSecondsRemaining: Optional[int] = None
    throughputRecordsPerSec: Optional[int] = None
    stages: Optional[dict] = None
    createdAt: Optional[str] = None
    completedAt: Optional[str] = None
    errorMessage: Optional[str] = None
    outputLocation: Optional[str] = None
    dataflowUrl: Optional[str] = None


class JobLogsResponse(BaseModel):
    """Response for job logs."""
    logs: List[str]


class CancelJobResponse(BaseModel):
    """Response for job cancellation."""
    cancelled: bool


class JobHistoryItem(BaseModel):
    """Job history item."""
    jobId: str
    dataflowJobId: Optional[str] = None
    sourceType: str = "betfair"
    sourceDataset: str
    selectedPaths: Optional[List[str]] = None
    processType: str
    targetBucket: str
    outputPrefix: str
    status: JobStatus
    createdAt: str
    completedAt: Optional[str] = None
    durationSeconds: Optional[int] = None
    recordsProcessed: Optional[int] = None
    bytesProcessed: Optional[int] = None
    outputFiles: Optional[int] = None
    outputShards: Optional[int] = None


class JobHistoryResponse(BaseModel):
    """Response for job history."""
    jobs: List[JobHistoryItem]
