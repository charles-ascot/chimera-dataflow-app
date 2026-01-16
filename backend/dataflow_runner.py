"""Dataflow pipeline runner for data transport jobs."""

import uuid
from datetime import datetime
from typing import Optional, List
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
from apache_beam.io import fileio


class DecompressBz2(beam.DoFn):
    """Decompress bz2 files and yield lines."""

    def process(self, readable_file):
        import bz2

        file_path = readable_file.metadata.path
        try:
            with readable_file.open() as f:
                compressed_content = f.read()

            decompressed = bz2.decompress(compressed_content)

            # Split into lines (NDJSON format)
            for line in decompressed.decode('utf-8').strip().split('\n'):
                if line.strip():
                    yield line
        except Exception as e:
            # Log error but continue processing other files
            import logging
            logging.error(f"Error processing {file_path}: {str(e)}")


class DataflowRunner:
    """Runner for Dataflow pipeline jobs."""

    def __init__(self, project_id: str = None):
        self.credentials, default_project = default()
        self.project_id = project_id or default_project
        self.client = dataflow_v1beta3.FlexTemplatesServiceClient(
            credentials=self.credentials
        )
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

            # Setup options
            setup_options = options.view_as(SetupOptions)
            setup_options.save_main_session = True

            # Create the input pattern (combine all patterns with comma)
            # For multiple patterns, we'll use MatchFiles with each pattern
            combined_pattern = input_patterns[0] if len(input_patterns) == 1 else input_patterns

            # Create and run the pipeline
            p = beam.Pipeline(options=options)

            if isinstance(combined_pattern, list):
                # Multiple patterns - create a PCollection for each and flatten
                collections = []
                for i, pattern in enumerate(combined_pattern):
                    collection = (
                        p
                        | f'MatchFiles_{i}' >> fileio.MatchFiles(pattern)
                        | f'ReadMatches_{i}' >> fileio.ReadMatches()
                        | f'Decompress_{i}' >> beam.ParDo(DecompressBz2())
                    )
                    collections.append(collection)

                lines = collections | 'Flatten' >> beam.Flatten()
            else:
                # Single pattern
                lines = (
                    p
                    | 'MatchFiles' >> fileio.MatchFiles(combined_pattern)
                    | 'ReadMatches' >> fileio.ReadMatches()
                    | 'Decompress' >> beam.ParDo(DecompressBz2())
                )

            # Write output
            _ = (
                lines
                | 'WriteOutput' >> beam.io.WriteToText(
                    output_path,
                    file_name_suffix='.ndjson',
                    num_shards=output_shards,
                )
            )

            # Run the pipeline (this submits to Dataflow and returns immediately)
            result = p.run()

            # Get the Dataflow job ID from the result
            # The job ID is available in the runner's job reference
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
