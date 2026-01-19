"""The Racing API data source plugin.

Placeholder for future implementation.
Will handle data from The Racing API service.
"""

from typing import List
from .base import SourcePlugin


class RacingAPIPlugin(SourcePlugin):
    """Plugin for The Racing API data (Coming Soon)."""
    
    name = "The Racing API"
    extensions = [".json", ".json.gz"]
    compression = "gzip"
    content_type = "json"
    enabled = False  # Not yet implemented
    description = "The Racing API data in JSON/GZIP format (Coming Soon)"
    
    def build_patterns(self, bucket: str, paths: List[str]) -> List[str]:
        """Generate GCS patterns for Racing API data.
        
        Not yet implemented - raises error if called.
        """
        raise NotImplementedError("Racing API plugin is not yet implemented")
    
    def get_decompressor_class(self) -> str:
        """Return the Racing API decompressor class name."""
        raise NotImplementedError("Racing API plugin is not yet implemented")
