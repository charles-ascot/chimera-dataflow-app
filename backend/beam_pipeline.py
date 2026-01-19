"""Apache Beam pipeline for data transport jobs.

This module is separate from the main backend to avoid serialization issues
with Dataflow workers. The DoFn classes defined here will be properly
pickled and sent to workers.

Critical: This file is staged to workers via setup.py
"""

import apache_beam as beam
from apache_beam.io import fileio
from apache_beam.metrics import Metrics


class DecompressBz2Fn(beam.DoFn):
    """Decompress bz2 files and yield lines.
    
    Includes comprehensive logging and metrics for debugging.
    """
    
    def __init__(self):
        # Initialize metric counters
        self.files_processed = Metrics.counter(self.__class__, 'files_processed')
        self.files_failed = Metrics.counter(self.__class__, 'files_failed')
        self.bytes_read = Metrics.counter(self.__class__, 'bytes_read')
        self.bytes_decompressed = Metrics.counter(self.__class__, 'bytes_decompressed')
        self.lines_yielded = Metrics.counter(self.__class__, 'lines_yielded')
    
    def process(self, readable_file):
        import bz2
        import logging
        
        file_path = readable_file.metadata.path
        logging.info(f"[DecompressBz2Fn] Starting to process: {file_path}")
        
        try:
            # Read compressed content
            with readable_file.open() as f:
                compressed_content = f.read()
            
            compressed_size = len(compressed_content)
            self.bytes_read.inc(compressed_size)
            logging.info(f"[DecompressBz2Fn] Read {compressed_size} compressed bytes from {file_path}")
            
            # Decompress
            decompressed = bz2.decompress(compressed_content)
            decompressed_size = len(decompressed)
            self.bytes_decompressed.inc(decompressed_size)
            logging.info(f"[DecompressBz2Fn] Decompressed to {decompressed_size} bytes")
            
            # Split into lines (NDJSON format)
            line_count = 0
            for line in decompressed.decode('utf-8').strip().split('\n'):
                stripped_line = line.strip()
                if stripped_line:
                    line_count += 1
                    self.lines_yielded.inc()
                    yield stripped_line
            
            self.files_processed.inc()
            logging.info(f"[DecompressBz2Fn] Yielded {line_count} lines from {file_path}")
            
        except Exception as e:
            import traceback
            self.files_failed.inc()
            logging.error(f"[DecompressBz2Fn] Error processing {file_path}: {str(e)}")
            logging.error(traceback.format_exc())


class LogMatchedFilesFn(beam.DoFn):
    """Log matched files for debugging."""
    
    def __init__(self):
        self.files_matched = Metrics.counter(self.__class__, 'files_matched')
    
    def process(self, file_metadata):
        import logging
        self.files_matched.inc()
        logging.info(f"[MatchFiles] Found file: {file_metadata.path} ({file_metadata.size_in_bytes} bytes)")
        yield file_metadata


def create_pipeline(pipeline, input_patterns, output_path, output_shards):
    """Create the Beam pipeline transforms.
    
    Args:
        pipeline: Apache Beam Pipeline object
        input_patterns: List of GCS patterns to match files
        output_path: GCS output path prefix
        output_shards: Number of output shards
        
    Returns:
        The pipeline with transforms applied
    """
    import logging
    
    logging.info(f"[Pipeline] Creating pipeline with {len(input_patterns)} pattern(s)")
    for i, pattern in enumerate(input_patterns):
        logging.info(f"[Pipeline] Pattern {i}: {pattern}")
    
    logging.info(f"[Pipeline] Output path: {output_path}")
    logging.info(f"[Pipeline] Output shards: {output_shards}")
    
    if isinstance(input_patterns, list) and len(input_patterns) > 1:
        # Multiple patterns - create a PCollection for each and flatten
        collections = []
        for i, pattern in enumerate(input_patterns):
            logging.info(f"[Pipeline] Setting up collection for pattern {i}: {pattern}")
            collection = (
                pipeline
                | f'MatchFiles_{i}' >> fileio.MatchFiles(pattern)
                | f'LogMatched_{i}' >> beam.ParDo(LogMatchedFilesFn())
                | f'ReadMatches_{i}' >> fileio.ReadMatches()
                | f'Decompress_{i}' >> beam.ParDo(DecompressBz2Fn())
            )
            collections.append(collection)
        
        lines = collections | 'Flatten' >> beam.Flatten()
    else:
        # Single pattern
        pattern = input_patterns[0] if isinstance(input_patterns, list) else input_patterns
        logging.info(f"[Pipeline] Setting up single pattern: {pattern}")
        lines = (
            pipeline
            | 'MatchFiles' >> fileio.MatchFiles(pattern)
            | 'LogMatched' >> beam.ParDo(LogMatchedFilesFn())
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
    
    logging.info("[Pipeline] Pipeline transforms created successfully")
    return pipeline
