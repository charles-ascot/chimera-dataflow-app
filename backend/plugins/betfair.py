"""Betfair data source plugin.

Handles Betfair historical data files which are:
- Compressed with bz2
- In NDJSON format
- Organized by date folders
"""

from typing import List
from .base import SourcePlugin


class BetfairPlugin(SourcePlugin):
    """Plugin for Betfair historical data."""
    
    name = "Betfair"
    extensions = [".bz2"]
    compression = "bz2"
    content_type = "ndjson"
    enabled = True
    description = "Betfair historical market data in bz2-compressed NDJSON format"
    
    def build_patterns(self, bucket: str, paths: List[str]) -> List[str]:
        """Generate GCS patterns for Betfair data.
        
        For Betfair data, we look for .bz2 files in the selected paths
        and all their subdirectories.
        
        Args:
            bucket: GCS bucket name
            paths: List of selected paths
            
        Returns:
            List of GCS patterns like gs://bucket/path/**/*.bz2
        """
        patterns = []
        
        for path in paths:
            clean_path = self.normalize_path(path)
            
            if not clean_path:
                # Root level - match all bz2 files
                pattern = f"gs://{bucket}/**/*.bz2"
            else:
                # Specific path - match bz2 files in path and subdirectories
                pattern = f"gs://{bucket}/{clean_path}/**/*.bz2"
            
            # Validate before adding
            if self.validate_pattern(pattern):
                patterns.append(pattern)
            else:
                raise ValueError(f"Invalid pattern generated: {pattern}")
        
        return patterns
    
    def get_decompressor_class(self) -> str:
        """Return the Betfair decompressor class name."""
        return "DecompressBz2Fn"
