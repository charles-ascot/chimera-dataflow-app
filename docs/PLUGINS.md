# Plugin System

CHIMERA DataFlow uses a plugin architecture to support multiple data sources. Each plugin defines how to match files and process them.

## Available Plugins

| Plugin | ID | Status | Description |
|--------|-------|--------|-------------|
| Betfair | `betfair` | Active | Bz2-compressed NDJSON betting data |
| Racing API | `racing_api` | Coming Soon | Racing API JSON data |

## Plugin Interface

All plugins inherit from `SourcePlugin`:

```python
from abc import ABC, abstractmethod
from typing import List

class SourcePlugin(ABC):
    # Plugin metadata
    name: str = "Plugin Name"
    extensions: List[str] = [".ext"]
    compression: str = "none"  # none, bz2, gzip
    content_type: str = "text"  # text, json, ndjson
    enabled: bool = True
    description: str = "Plugin description"

    @abstractmethod
    def build_patterns(self, bucket: str, paths: List[str]) -> List[str]:
        """Generate GCS patterns for matching files."""
        pass

    @abstractmethod
    def get_decompressor_class(self) -> str:
        """Return the decompressor DoFn class name."""
        pass

    def normalize_path(self, path: str) -> str:
        """Normalize path - strip slashes."""
        return path.strip('/')
```

## Betfair Plugin

The Betfair plugin handles bz2-compressed NDJSON files from Betfair historical data.

### Configuration

```python
class BetfairPlugin(SourcePlugin):
    name = "Betfair"
    extensions = [".bz2"]
    compression = "bz2"
    content_type = "ndjson"
    enabled = True
    description = "Betfair historical market data in bz2-compressed NDJSON format"
```

### Pattern Generation

For each selected path, generates two patterns to match files directly and in subdirectories:

```python
def build_patterns(self, bucket: str, paths: List[str]) -> List[str]:
    patterns = []
    for path in paths:
        clean_path = self.normalize_path(path)
        if not clean_path:
            patterns.append(f"gs://{bucket}/*.bz2")
            patterns.append(f"gs://{bucket}/**/*.bz2")
        else:
            patterns.append(f"gs://{bucket}/{clean_path}/*.bz2")
            patterns.append(f"gs://{bucket}/{clean_path}/**/*.bz2")
    return patterns
```

### Example

```python
plugin = BetfairPlugin()
patterns = plugin.build_patterns("my-bucket", ["ADVANCED/2016/Jan/1"])
# Returns:
# [
#   "gs://my-bucket/ADVANCED/2016/Jan/1/*.bz2",
#   "gs://my-bucket/ADVANCED/2016/Jan/1/**/*.bz2"
# ]
```

## Creating a New Plugin

### 1. Create Plugin File

Create `backend/plugins/my_source.py`:

```python
from typing import List
from .base import SourcePlugin

class MySourcePlugin(SourcePlugin):
    name = "My Source"
    extensions = [".json"]
    compression = "none"
    content_type = "json"
    enabled = True
    description = "My custom data source"

    def build_patterns(self, bucket: str, paths: List[str]) -> List[str]:
        patterns = []
        for path in paths:
            clean_path = self.normalize_path(path)
            if clean_path:
                patterns.append(f"gs://{bucket}/{clean_path}/**/*.json")
            else:
                patterns.append(f"gs://{bucket}/**/*.json")
        return patterns

    def get_decompressor_class(self) -> str:
        return "ReadJsonFn"  # or "PassThroughFn" for no decompression
```

### 2. Register Plugin

Add to `backend/plugins/__init__.py`:

```python
from .my_source import MySourcePlugin

PLUGINS = {
    "betfair": BetfairPlugin(),
    "racing_api": RacingAPIPlugin(),
    "my_source": MySourcePlugin(),  # Add here
}
```

### 3. Add Decompressor (if needed)

If your source uses a different compression, add a DoFn to `beam_pipeline.py`:

```python
class ReadJsonFn(beam.DoFn):
    def setup(self):
        from google.cloud import storage
        self.client = storage.Client()

    def process(self, gcs_path):
        import json
        # Download file
        path = gcs_path.replace("gs://", "")
        bucket_name = path.split("/")[0]
        blob_path = "/".join(path.split("/")[1:])

        bucket = self.client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        content = blob.download_as_text()

        # Parse JSON and yield lines
        data = json.loads(content)
        for item in data:
            yield json.dumps(item)
```

### 4. Test

```bash
# Verify patterns match files
gsutil ls "gs://bucket/path/**/*.json" | head

# Test locally
python -c "
from plugins import get_plugin
plugin = get_plugin('my_source')
patterns = plugin.build_patterns('bucket', ['path/to/data'])
print(patterns)
"
```

## Plugin Discovery

The API exposes plugins via `GET /api/plugins`:

```json
{
  "plugins": [
    {
      "id": "betfair",
      "name": "Betfair",
      "extensions": [".bz2"],
      "compression": "bz2",
      "enabled": true,
      "description": "..."
    }
  ]
}
```

The frontend uses this to populate the source type dropdown.

## Future Considerations

### Adding New Compression Types

1. Add decompressor DoFn to `beam_pipeline.py`
2. Reference it in plugin's `get_decompressor_class()`

### Adding Authentication

For sources requiring auth:
1. Add credentials handling to plugin
2. Pass credentials to decompressor DoFn via `__init__`

### Multi-Format Support

A plugin can support multiple file types by generating patterns for each:

```python
def build_patterns(self, bucket, paths):
    patterns = []
    for path in paths:
        patterns.append(f"gs://{bucket}/{path}/**/*.json")
        patterns.append(f"gs://{bucket}/{path}/**/*.ndjson")
    return patterns
```
