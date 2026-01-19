"""Apache Beam pipeline for data transport jobs.

This module uses direct GCS access instead of fileio to avoid
issues with file matching on Dataflow workers.

Critical: This file is staged to workers via setup.py
"""

import apache_beam as beam
from apache_beam.metrics import Metrics


class ReadAndDecompressGCSFile(beam.DoFn):
    """Read file directly from GCS and decompress - bypasses fileio."""

    def __init__(self):
        self.files_processed = Metrics.counter(self.__class__, 'files_processed')
        self.files_failed = Metrics.counter(self.__class__, 'files_failed')
        self.bytes_read = Metrics.counter(self.__class__, 'bytes_read')
        self.lines_yielded = Metrics.counter(self.__class__, 'lines_yielded')

    def setup(self):
        """Called once per worker - initialize GCS client."""
        from google.cloud import storage
        self.client = storage.Client()

    def process(self, gcs_path):
        """Download and decompress a single GCS file."""
        import bz2
        import logging

        logging.info(f"Processing: {gcs_path}")

        try:
            # Parse gs://bucket/path
            path = gcs_path.replace("gs://", "")
            bucket_name = path.split("/")[0]
            blob_path = "/".join(path.split("/")[1:])

            # Download
            bucket = self.client.bucket(bucket_name)
            blob = bucket.blob(blob_path)
            compressed_data = blob.download_as_bytes()

            self.bytes_read.inc(len(compressed_data))
            logging.info(f"Downloaded {len(compressed_data)} bytes from {gcs_path}")

            # Decompress
            decompressed = bz2.decompress(compressed_data)

            # Yield lines
            line_count = 0
            for line in decompressed.decode('utf-8').strip().split('\n'):
                if line.strip():
                    line_count += 1
                    self.lines_yielded.inc()
                    yield line

            self.files_processed.inc()
            logging.info(f"Yielded {line_count} lines from {gcs_path}")

        except Exception as e:
            import traceback
            self.files_failed.inc()
            logging.error(f"Error processing {gcs_path}: {e}")
            logging.error(traceback.format_exc())


class ListGCSFiles(beam.DoFn):
    """List all .bz2 files matching a pattern."""

    def setup(self):
        from google.cloud import storage
        self.client = storage.Client()

    def process(self, pattern):
        """Convert a pattern like gs://bucket/path/**/*.bz2 into actual file paths."""
        import logging

        logging.info(f"Listing files for pattern: {pattern}")

        # Parse pattern
        path = pattern.replace("gs://", "")
        bucket_name = path.split("/")[0]
        prefix = "/".join(path.split("/")[1:])

        # Remove glob parts to get prefix for listing
        if "**" in prefix:
            prefix = prefix.split("**")[0]
        if "*" in prefix:
            prefix = prefix.split("*")[0]
        prefix = prefix.rstrip("/")

        logging.info(f"Listing bucket={bucket_name}, prefix={prefix}")

        bucket = self.client.bucket(bucket_name)
        file_count = 0

        for blob in bucket.list_blobs(prefix=prefix):
            if blob.name.endswith('.bz2'):
                file_count += 1
                gcs_path = f"gs://{bucket_name}/{blob.name}"
                logging.info(f"Found file: {gcs_path}")
                yield gcs_path

        logging.info(f"Listed {file_count} files for pattern {pattern}")


def create_pipeline(pipeline, input_patterns, output_path, output_shards):
    """Create the Beam pipeline using direct GCS access."""
    import logging

    logging.info(f"Creating pipeline with {len(input_patterns)} pattern(s)")

    # Convert patterns to actual file paths, then process each file
    lines = (
        pipeline
        | 'CreatePatterns' >> beam.Create(input_patterns)
        | 'ListFiles' >> beam.ParDo(ListGCSFiles())
        | 'Reshuffle' >> beam.Reshuffle()  # Distribute files across workers
        | 'ReadAndDecompress' >> beam.ParDo(ReadAndDecompressGCSFile())
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

    return pipeline
