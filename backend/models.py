from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ProcessType(str, Enum):
    DECOMPRESS_ONLY = "decompress_only"
    DECOMPRESS_AND_CONCATENATE = "decompress_and_concatenate"
    DECOMPRESS_CONCATENATE_PARSE = "decompress_concatenate_parse"
    DIRECT_TO_BIGQUERY = "direct_to_bigquery"


class CompressionType(str, Enum):
    NONE = "none"
    GZIP = "gzip"
    SNAPPY = "snappy"


class StorageClass(str, Enum):
    STANDARD = "STANDARD"
    NEARLINE = "NEARLINE"
    COLDLINE = "COLDLINE"


class JobStatus(str, Enum):
    SUBMITTED = "submitted"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StageStatus(str, Enum):
    WAITING = "waiting"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


# Request Models
class PipelineSubmitRequest(BaseModel):
    sourceProject: str
    sourceBucket: str
    sourceDataset: str
    startDate: str
    endDate: str
    processType: ProcessType
    outputShards: int = 10
    compression: CompressionType = CompressionType.NONE
    targetBucket: str
    outputPrefix: str
    dataflowRegion: str = "europe-west2"
    dataflowWorkerType: str = "n1-standard-4"
    dataflowMaxWorkers: str = "AUTO"
    dataflowTimeoutHours: int = 4
    createNewBucket: bool = False
    storageClass: Optional[StorageClass] = StorageClass.STANDARD
    retention: Optional[str] = "P1Y"


class CreateBucketRequest(BaseModel):
    projectId: str
    bucketName: str
    location: str = "EU"
    storageClass: StorageClass = StorageClass.STANDARD
    retention: str = "P1Y"


# Response Models
class ProjectInfo(BaseModel):
    id: str
    name: str


class ProjectsResponse(BaseModel):
    projects: List[ProjectInfo]


class BucketInfo(BaseModel):
    name: str
    created: Optional[str] = None
    size: str


class BucketsResponse(BaseModel):
    buckets: List[BucketInfo]


class DateRange(BaseModel):
    start: str
    end: str


class DatasetInfo(BaseModel):
    path: str
    fileCount: int
    totalSize: str
    dateRange: DateRange


class DatasetsResponse(BaseModel):
    datasets: List[DatasetInfo]


class DateInfo(BaseModel):
    date: str
    files: int
    size: str
    sizeBytes: int


class DatesResponse(BaseModel):
    availableDates: List[DateInfo]


class BucketAvailabilityResponse(BaseModel):
    available: bool
    message: Optional[str] = None


class CreateBucketResponse(BaseModel):
    created: bool
    bucketName: str


class StagesStatus(BaseModel):
    read: StageStatus = StageStatus.WAITING
    decompress: StageStatus = StageStatus.WAITING
    concatenate: StageStatus = StageStatus.WAITING
    write: StageStatus = StageStatus.WAITING
    validate: StageStatus = StageStatus.WAITING


class PipelineSubmitResponse(BaseModel):
    jobId: str
    dataflowJobId: Optional[str] = None
    status: JobStatus
    message: str
    dataflowUrl: Optional[str] = None


class JobStatusResponse(BaseModel):
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
    logs: List[str]


class CancelJobResponse(BaseModel):
    cancelled: bool


class JobHistoryItem(BaseModel):
    jobId: str
    dataflowJobId: Optional[str] = None
    sourceDataset: str
    startDate: str
    endDate: str
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
    jobs: List[JobHistoryItem]
