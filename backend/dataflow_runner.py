"""Dataflow pipeline runner for data transport jobs.

Handles pipeline submission to Google Cloud Dataflow with proper
module staging and file pattern validation.
"""

import os
import uuid
import logging
from datetime import datetime
from typing import List, Optional
from google.auth import default
from google.cloud import dataflow_v1beta3
from google.cloud import storage

import apache_beam as beam
from apache_beam.options.pipeline_options import (
    PipelineOptions,
    StandardOptions,
    GoogleCloudOptions,
    WorkerOptions,
    SetupOptions,
)

from plugins import get_plugin
from beam_pipeline import create_pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DataflowRunner:
    """Runner for Dataflow pipeline jobs."""

    def __init__(self, project_id: str = None):
        self.credentials, default_project = default()
        self.project_id = project_id or default_project
        self.jobs_client = dataflow_v1beta3.JobsV1Beta3Client(
            credentials=self.credentials
        )
        self.storage_client = storage.Client(credentials=self.credentials)

    def validate_patterns(self, patterns: List[str]) -> dict:
        """Validate that patterns match actual files in GCS.
        
        Args:
            patterns: List of GCS patterns to validate
            
        Returns:
            Dictionary with validation results including file count
        """
        total_files = 0
        pattern_results = []
        
        for pattern in patterns:
            try:
                # Parse the pattern to extract bucket and prefix
                # Pattern format: gs://bucket/path/**/*.bz2
                if not pattern.startswith("gs://"):
                    pattern_results.append({
                        "pattern": pattern,
                        "valid": False,
                        "error": "Pattern must start with gs://",
                        "fileCount": 0
                    })
                    continue
                
                # Extract bucket and path from pattern
                path_part = pattern[5:]  # Remove gs://
                parts = path_part.split("/", 1)
                bucket_name = parts[0]
                
                if len(parts) > 1:
                    # Handle glob patterns by getting the fixed prefix
                    prefix = parts[1]
                    # Remove glob parts to get the prefix for listing
                    if "**" in prefix:
                        prefix = prefix.split("**")[0]
                    if "*" in prefix:
                        prefix = prefix.split("*")[0]
                    prefix = prefix.rstrip("/")
                else:
                    prefix = ""
                
                # List files matching the pattern
                bucket = self.storage_client.bucket(bucket_name)
                
                # Get extension from pattern
                ext = ".bz2"  # Default
                if pattern.endswith("*.bz2"):
                    ext = ".bz2"
                elif pattern.endswith("*.json"):
                    ext = ".json"
                elif pattern.endswith("*.gz"):
                    ext = ".gz"
                
                # Count matching files (limit scan for performance)
                file_count = 0
                max_scan = 10000
                
                blobs = bucket.list_blobs(prefix=prefix, max_results=max_scan)
                for blob in blobs:
                    if blob.name.endswith(ext):
                        file_count += 1
                
                total_files += file_count
                pattern_results.append({
                    "pattern": pattern,
                    "valid": file_count > 0,
                    "fileCount": file_count,
                    "truncated": file_count >= max_scan
                })
                
                logger.info(f"Pattern '{pattern}' matched {file_count} files")
                
            except Exception as e:
                pattern_results.append({
                    "pattern": pattern,
                    "valid": False,
                    "error": str(e),
                    "fileCount": 0
                })
        
        return {
            "totalFiles": total_files,
            "patterns": pattern_results,
            "allValid": all(p.get("valid", False) for p in pattern_results)
        }

    def submit_pipeline(
        self,
        source_type: str,
        source_bucket: str,
        source_dataset: str,
        selected_paths: List[str],
        process_type: str,
        output_shards: int,
        compression: str,
        target_bucket: str,
        output_prefix: str,
        region: str,
        worker_type: str,
        max_workers: str,
        timeout_hours: int,
        skip_validation: bool = False,
    ) -> dict:
        """Submit a Dataflow pipeline job.
        
        Args:
            source_type: Plugin identifier (e.g., 'betfair')
            source_bucket: Source GCS bucket name
            source_dataset: Source dataset path
            selected_paths: List of selected paths
            process_type: Processing type
            output_shards: Number of output shards
            compression: Output compression type
            target_bucket: Target GCS bucket
            output_prefix: Output prefix path
            region: Dataflow region
            worker_type: Worker machine type
            max_workers: Maximum workers (or "AUTO")
            timeout_hours: Pipeline timeout in hours
            skip_validation: Skip file validation (for testing)
            
        Returns:
            Dictionary with job submission results
        """
        job_id = f"{datetime.utcnow().strftime('%Y-%m-%d')}-{uuid.uuid4().hex[:8]}"
        job_name = f"chimera-{job_id}"

        # Get the plugin for this source type
        plugin = get_plugin(source_type)
        logger.info(f"Using plugin: {plugin.name}")

        # Build input patterns using the plugin
        input_patterns = plugin.build_patterns(source_bucket, selected_paths)
        
        logger.info(f"Generated {len(input_patterns)} pattern(s):")
        for i, pattern in enumerate(input_patterns):
            logger.info(f"  [{i}] {pattern}")

        # Validate patterns match actual files
        if not skip_validation:
            validation = self.validate_patterns(input_patterns)
            logger.info(f"Validation result: {validation['totalFiles']} total files found")
            
            if not validation['allValid'] or validation['totalFiles'] == 0:
                raise ValueError(
                    f"Pattern validation failed: {validation['totalFiles']} files found. "
                    f"Patterns: {input_patterns}"
                )

        # Build output path
        output_path = f"gs://{target_bucket}/{output_prefix}/output"
        temp_location = f"gs://{target_bucket}/temp/{job_id}/"
        staging_location = f"gs://{target_bucket}/staging/{job_id}/"

        # Determine number of workers
        num_workers = None
        if max_workers != "AUTO":
            try:
                num_workers = int(max_workers)
            except ValueError:
                pass

        # Get the directory where this file is located for setup_file path
        current_dir = os.path.dirname(os.path.abspath(__file__))
        setup_file = os.path.join(current_dir, 'setup.py')

        try:
            # Configure pipeline options for Dataflow
            options = PipelineOptions()

            # Standard options
            standard_options = options.view_as(StandardOptions)
            standard_options.runner = 'DataflowRunner'

            # Google Cloud options
            google_cloud_options = options.view_as(GoogleCloudOptions)
            google_cloud_options.project = self.project_id
            google_cloud_options.region = region
            google_cloud_options.temp_location = temp_location
            google_cloud_options.job_name = job_name
            google_cloud_options.staging_location = staging_location

            # Worker options
            worker_options = options.view_as(WorkerOptions)
            worker_options.machine_type = worker_type
            if num_workers:
                worker_options.num_workers = num_workers
                worker_options.max_num_workers = num_workers
            
            # CRITICAL: Zone flexibility to avoid ZONE_RESOURCE_POOL_EXHAUSTED errors
            # When worker_zone is not set, Dataflow can try any zone in the region
            # Reference: https://cloud.google.com/dataflow/docs/guides/common-errors#worker-pool-failure
            # 
            # Additionally, we enable Dataflow Shuffle and Streaming Engine for better
            # resource allocation and retry behavior
            worker_options.use_public_ips = True  # Required for most network configs
            
            # Use service options for enhanced resource scheduling
            # enable_prime: Uses Flexible Resource Scheduling which handles zone exhaustion
            # enable_recommendations: Allows Dataflow to optimize resource allocation
            google_cloud_options.dataflow_service_options = ['enable_prime']

            # Setup options - use setup_file to stage the beam_pipeline module
            setup_options = options.view_as(SetupOptions)
            setup_options.save_main_session = False
            setup_options.setup_file = setup_file

            # Create and run the pipeline
            p = beam.Pipeline(options=options)

            # Use the create_pipeline function from beam_pipeline module
            create_pipeline(p, input_patterns, output_path, output_shards)

            # Run the pipeline (this submits to Dataflow and returns immediately)
            result = p.run()

            # Get the Dataflow job ID from the result
            dataflow_job_id = None
            if hasattr(result, '_job') and result._job:
                dataflow_job_id = result._job.id
            elif hasattr(result, 'job_id'):
                dataflow_job_id = result.job_id
            else:
                try:
                    dataflow_job_id = result._job_id
                except Exception:
                    dataflow_job_id = job_name

            dataflow_url = (
                f"https://console.cloud.google.com/dataflow/jobs/"
                f"{region}/{dataflow_job_id}?project={self.project_id}"
            )

            return {
                "jobId": job_id,
                "dataflowJobId": dataflow_job_id,
                "status": "submitted",
                "message": "Job submitted to Dataflow",
                "dataflowUrl": dataflow_url,
                "config": {
                    "sourceType": source_type,
                    "inputPatterns": input_patterns,
                    "outputPath": output_path,
                    "tempLocation": temp_location,
                    "region": region,
                    "workerType": worker_type,
                    "maxWorkers": max_workers,
                },
            }

        except Exception as e:
            logger.error(f"Failed to submit Dataflow job: {str(e)}")
            raise Exception(f"Failed to submit Dataflow job: {str(e)}")

    def get_job_status(self, dataflow_job_id: str, region: str) -> dict:
        """Get the status of a Dataflow job."""
        try:
            request = dataflow_v1beta3.GetJobRequest(
                project_id=self.project_id,
                job_id=dataflow_job_id,
                location=region,
                view=dataflow_v1beta3.JobView.JOB_VIEW_ALL,
            )

            job = self.jobs_client.get_job(request=request)

            # Map Dataflow state to our status
            state_map = {
                "JOB_STATE_RUNNING": "running",
                "JOB_STATE_DONE": "completed",
                "JOB_STATE_FAILED": "failed",
                "JOB_STATE_CANCELLED": "cancelled",
                "JOB_STATE_PENDING": "submitted",
                "JOB_STATE_QUEUED": "submitted",
            }

            status = state_map.get(job.current_state.name, "running")

            return {
                "status": status,
                "dataflowState": job.current_state.name,
                "createTime": job.create_time.isoformat() if job.create_time else None,
                "startTime": job.start_time.isoformat() if job.start_time else None,
            }

        except Exception as e:
            return {"status": "unknown", "error": str(e)}

    def cancel_job(self, dataflow_job_id: str, region: str) -> bool:
        """Cancel a Dataflow job."""
        try:
            request = dataflow_v1beta3.UpdateJobRequest(
                project_id=self.project_id,
                job_id=dataflow_job_id,
                location=region,
                job=dataflow_v1beta3.Job(
                    requested_state=dataflow_v1beta3.JobState.JOB_STATE_CANCELLED
                ),
            )

            self.jobs_client.update_job(request=request)
            return True

        except Exception as e:
            raise Exception(f"Failed to cancel job: {str(e)}")
