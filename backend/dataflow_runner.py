"""Dataflow pipeline runner for data transport jobs."""

import os
import uuid
from datetime import datetime
from typing import List
from google.auth import default
from google.cloud import dataflow_v1beta3

import apache_beam as beam
from apache_beam.options.pipeline_options import (
    PipelineOptions,
    StandardOptions,
    GoogleCloudOptions,
    WorkerOptions,
    SetupOptions,
)

# Import the pipeline module - this will be staged to workers via setup_file
from beam_pipeline import create_pipeline


class DataflowRunner:
    """Runner for Dataflow pipeline jobs."""

    def __init__(self, project_id: str = None):
        self.credentials, default_project = default()
        self.project_id = project_id or default_project
        self.jobs_client = dataflow_v1beta3.JobsV1Beta3Client(
            credentials=self.credentials
        )

    def submit_pipeline(
        self,
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
    ) -> dict:
        """Submit a Dataflow pipeline job."""

        job_id = f"{datetime.utcnow().strftime('%Y-%m-%d')}-{uuid.uuid4().hex[:8]}"
        job_name = f"chimera-{job_id}"

        # Build input patterns from selected paths
        input_patterns = []
        for path in selected_paths:
            # Each path can be a folder or file
            if path.endswith('/'):
                input_patterns.append(f"gs://{source_bucket}/{path}**/*.bz2")
            else:
                # Check if it looks like a file or folder
                input_patterns.append(f"gs://{source_bucket}/{path}/**/*.bz2")
                input_patterns.append(f"gs://{source_bucket}/{path}")

        # Build output path
        output_path = f"gs://{target_bucket}/{output_prefix}/output"
        temp_location = f"gs://{target_bucket}/temp/{job_id}/"

        # Determine number of workers
        num_workers = None
        if max_workers != "AUTO":
            num_workers = int(max_workers)

        # Get the directory where this file is located for setup_file path
        current_dir = os.path.dirname(os.path.abspath(__file__))
        setup_file = os.path.join(current_dir, 'pipeline_setup.py')

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
            google_cloud_options.staging_location = f"gs://{target_bucket}/staging/{job_id}/"

            # Worker options
            worker_options = options.view_as(WorkerOptions)
            worker_options.machine_type = worker_type
            if num_workers:
                worker_options.num_workers = num_workers
                worker_options.max_num_workers = num_workers

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
                # Try to extract from the result object
                try:
                    dataflow_job_id = result._job_id
                except:
                    # Generate a placeholder - the actual job might still be starting
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
                    "inputPatterns": input_patterns,
                    "outputPath": output_path,
                    "tempLocation": temp_location,
                    "region": region,
                    "workerType": worker_type,
                    "maxWorkers": max_workers,
                },
            }

        except Exception as e:
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
            # If job not found or error, return unknown status
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
