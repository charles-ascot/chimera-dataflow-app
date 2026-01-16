"""Standalone Apache Beam pipeline for data transport jobs.

This module is separate from the main backend to avoid serialization issues
with Dataflow workers. The DoFn classes defined here will be properly
pickled and sent to workers.
"""

import apache_beam as beam
from apache_beam.io import fileio


class DecompressBz2Fn(beam.DoFn):
    """Decompress bz2 files and yield lines."""

    def process(self, readable_file):
        import bz2
        import logging

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
            logging.error(f"Error processing {file_path}: {str(e)}")


def create_pipeline(pipeline, input_patterns, output_path, output_shards):
    """Create the Beam pipeline transforms.

    Args:
        pipeline: The Beam Pipeline object
        input_patterns: List of GCS patterns to read
        output_path: Output path prefix
        output_shards: Number of output shards

    Returns:
        The pipeline result
    """
    if isinstance(input_patterns, list) and len(input_patterns) > 1:
        # Multiple patterns - create a PCollection for each and flatten
        collections = []
        for i, pattern in enumerate(input_patterns):
            collection = (
                pipeline
                | f'MatchFiles_{i}' >> fileio.MatchFiles(pattern)
                | f'ReadMatches_{i}' >> fileio.ReadMatches()
                | f'Decompress_{i}' >> beam.ParDo(DecompressBz2Fn())
            )
            collections.append(collection)

        lines = collections | 'Flatten' >> beam.Flatten()
    else:
        # Single pattern
        pattern = input_patterns[0] if isinstance(input_patterns, list) else input_patterns
        lines = (
            pipeline
            | 'MatchFiles' >> fileio.MatchFiles(pattern)
            | 'ReadMatches' >> fileio.ReadMatches()
            | 'Decompress' >> beam.ParDo(DecompressBz2Fn())
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
