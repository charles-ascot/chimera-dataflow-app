"""Base class for source plugins."""

from abc import ABC, abstractmethod
from typing import List


class SourcePlugin(ABC):
    """Abstract base class for source plugins.
    
    Each plugin defines how to handle a specific data source type,
    including file patterns, compression methods, and content format.
    """
    
    # Plugin metadata
    name: str = "Base Plugin"
    extensions: List[str] = []
    compression: str = "none"
    content_type: str = "text"
    enabled: bool = True
    description: str = ""
    
    @abstractmethod
    def build_patterns(self, bucket: str, paths: List[str]) -> List[str]:
        """Generate GCS patterns for matching files.
        
        Args:
            bucket: GCS bucket name
            paths: List of selected paths (folders/files)
            
        Returns:
            List of GCS patterns to match files
        """
        pass
    
    @abstractmethod
    def get_decompressor_class(self) -> str:
        """Return the name of the decompressor DoFn class.
        
        Returns:
            String name of the decompressor class in beam_pipeline.py
        """
        pass
    
    def normalize_path(self, path: str) -> str:
        """Normalize a path - strip leading/trailing slashes.
        
        Args:
            path: Path to normalize
            
        Returns:
            Normalized path string
        """
        return path.strip('/')
    
    def validate_pattern(self, pattern: str) -> bool:
        """Validate a GCS pattern is well-formed.
        
        Args:
            pattern: GCS pattern to validate
            
        Returns:
            True if pattern is valid
        """
        if not pattern.startswith("gs://"):
            return False
        if "//" in pattern[5:]:  # Allow gs:// but not other double slashes
            return False
        return True
