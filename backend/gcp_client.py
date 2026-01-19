"""GCP client for interacting with Google Cloud resources."""

import re
from datetime import datetime
from typing import List, Optional
from google.auth import default
from google.cloud import storage
from google.cloud import resourcemanager_v3
from google.api_core import exceptions as gcp_exceptions


class GCPClient:
    """Client for GCP operations."""

    def __init__(self):
        self.credentials, self.project = default()
        self.storage_client = storage.Client(credentials=self.credentials)

    def list_projects(self) -> List[dict]:
        """List all accessible GCP projects."""
        client = resourcemanager_v3.ProjectsClient(credentials=self.credentials)
        projects = []

        try:
            request = resourcemanager_v3.SearchProjectsRequest()
            for project in client.search_projects(request=request):
                if project.state == resourcemanager_v3.Project.State.ACTIVE:
                    projects.append({
                        "id": project.project_id,
                        "name": project.display_name or project.project_id,
                    })
        except Exception as e:
            # Fallback to default project if search fails
            if self.project:
                projects.append({
                    "id": self.project,
                    "name": self.project,
                })

        return projects

    def list_buckets(self, project_id: str) -> List[dict]:
        """List all buckets in a project."""
        buckets = []

        try:
            for bucket in self.storage_client.list_buckets(project=project_id):
                # Calculate approximate bucket size
                size = self._get_bucket_size(bucket)
                buckets.append({
                    "name": bucket.name,
                    "created": bucket.time_created.strftime("%Y-%m-%d") if bucket.time_created else None,
                    "size": size,
                })
        except Exception as e:
            raise Exception(f"Failed to list buckets: {str(e)}")

        return buckets

    def _get_bucket_size(self, bucket) -> str:
        """Get approximate bucket size (limited scan for performance)."""
        try:
            total_bytes = 0
            count = 0
            max_scan = 1000  # Limit scan for performance

            for blob in bucket.list_blobs(max_results=max_scan):
                total_bytes += blob.size or 0
                count += 1

            if count >= max_scan:
                # Extrapolate if we hit the limit
                avg_size = total_bytes / count if count > 0 else 0
                # This is a rough estimate
                return f"~{self._format_bytes(total_bytes)}+"

            return self._format_bytes(total_bytes)
        except Exception:
            return "Unknown"

    def list_datasets(self, bucket_name: str) -> List[dict]:
        """List all top-level prefixes (datasets) in a bucket."""
        datasets = []
        bucket = self.storage_client.bucket(bucket_name)

        try:
            # List all top-level prefixes in the bucket
            iterator = bucket.list_blobs(delimiter="/")
            blobs = list(iterator)  # Consume to get prefixes
            prefixes = list(iterator.prefixes)

            for prefix in prefixes:
                path = prefix.rstrip("/")
                # Get basic stats for this prefix
                stats = self._get_prefix_stats(bucket, prefix)
                datasets.append({
                    "path": path,
                    "fileCount": stats["fileCount"],
                    "totalSize": self._format_bytes(stats["totalBytes"]),
                    "hasChildren": stats["hasChildren"],
                })

        except Exception as e:
            raise Exception(f"Failed to list datasets: {str(e)}")

        return datasets

    def _get_prefix_stats(self, bucket, prefix: str) -> dict:
        """Get statistics for a prefix (quick scan)."""
        file_count = 0
        total_bytes = 0
        has_children = False
        max_scan = 100  # Quick scan for preview

        try:
            # Check for sub-prefixes (children)
            child_iterator = bucket.list_blobs(prefix=prefix, delimiter="/", max_results=10)
            child_blobs = list(child_iterator)
            child_prefixes = list(child_iterator.prefixes)
            has_children = len(child_prefixes) > 0

            # Count files at this level
            for blob in child_blobs:
                if not blob.name.endswith("/"):
                    file_count += 1
                    total_bytes += blob.size or 0

            return {
                "fileCount": file_count,
                "totalBytes": total_bytes,
                "hasChildren": has_children,
            }
        except Exception:
            return {"fileCount": 0, "totalBytes": 0, "hasChildren": False}

    def browse_path(self, bucket_name: str, path: str = "") -> dict:
        """Browse a path in a bucket and return its children (folders and files)."""
        bucket = self.storage_client.bucket(bucket_name)
        prefix = f"{path}/" if path and not path.endswith("/") else path

        folders = []
        files = []

        try:
            iterator = bucket.list_blobs(prefix=prefix, delimiter="/")
            blobs = list(iterator)
            prefixes = list(iterator.prefixes)

            # Process folders (sub-prefixes)
            for sub_prefix in prefixes:
                folder_name = sub_prefix.rstrip("/").split("/")[-1]
                folder_path = sub_prefix.rstrip("/")
                stats = self._get_prefix_stats(bucket, sub_prefix)
                folders.append({
                    "name": folder_name,
                    "path": folder_path,
                    "type": "folder",
                    "hasChildren": stats["hasChildren"],
                    "fileCount": stats["fileCount"],
                    "totalSize": self._format_bytes(stats["totalBytes"]),
                })

            # Process files at this level
            for blob in blobs:
                if blob.name.endswith("/"):
                    continue
                file_name = blob.name.split("/")[-1]
                files.append({
                    "name": file_name,
                    "path": blob.name,
                    "type": "file",
                    "size": self._format_bytes(blob.size or 0),
                    "sizeBytes": blob.size or 0,
                    "updated": blob.updated.isoformat() if blob.updated else None,
                })

            return {
                "path": path,
                "folders": folders,
                "files": files,
                "totalFolders": len(folders),
                "totalFiles": len(files),
            }

        except Exception as e:
            raise Exception(f"Failed to browse path: {str(e)}")

    def _get_dataset_stats(self, bucket, prefix: str) -> dict:
        """Get statistics for a dataset prefix."""
        file_count = 0
        total_bytes = 0
        dates = set()
        max_scan = 10000

        try:
            for blob in bucket.list_blobs(prefix=prefix, max_results=max_scan):
                if blob.name.endswith(".bz2"):
                    file_count += 1
                    total_bytes += blob.size or 0

                    # Extract date from path or filename
                    date_match = re.search(r"(\d{4}-\d{2}-\d{2})", blob.name)
                    if date_match:
                        dates.add(date_match.group(1))

            date_range = {
                "start": min(dates) if dates else "",
                "end": max(dates) if dates else "",
            }

            return {
                "fileCount": file_count,
                "totalBytes": total_bytes,
                "dateRange": date_range,
            }
        except Exception:
            return {"fileCount": 0, "totalBytes": 0, "dateRange": {"start": "", "end": ""}}

    def list_dates(self, bucket_name: str, dataset_path: str) -> List[dict]:
        """List available dates in a dataset with file counts."""
        dates = {}
        bucket = self.storage_client.bucket(bucket_name)

        try:
            prefix = f"{dataset_path}/" if not dataset_path.endswith("/") else dataset_path

            for blob in bucket.list_blobs(prefix=prefix):
                if not blob.name.endswith(".bz2"):
                    continue

                # Extract date from path
                date_match = re.search(r"(\d{4}-\d{2}-\d{2})", blob.name)
                if date_match:
                    date = date_match.group(1)
                    if date not in dates:
                        dates[date] = {"files": 0, "sizeBytes": 0}
                    dates[date]["files"] += 1
                    dates[date]["sizeBytes"] += blob.size or 0

            result = []
            for date in sorted(dates.keys()):
                info = dates[date]
                result.append({
                    "date": date,
                    "files": info["files"],
                    "size": self._format_bytes(info["sizeBytes"]),
                    "sizeBytes": info["sizeBytes"],
                })

            return result
        except Exception as e:
            raise Exception(f"Failed to list dates: {str(e)}")

    def check_bucket_availability(self, bucket_name: str) -> dict:
        """Check if a bucket name is available."""
        try:
            bucket = self.storage_client.bucket(bucket_name)
            if bucket.exists():
                return {"available": False, "message": "Bucket already exists"}
            return {"available": True, "message": "Bucket name is available"}
        except gcp_exceptions.Forbidden:
            return {"available": False, "message": "Bucket name is taken or forbidden"}
        except Exception as e:
            return {"available": False, "message": str(e)}

    def create_bucket(
        self,
        project_id: str,
        bucket_name: str,
        location: str = "EU",
        storage_class: str = "STANDARD",
    ) -> dict:
        """Create a new GCS bucket."""
        try:
            bucket = self.storage_client.bucket(bucket_name)
            bucket.storage_class = storage_class
            new_bucket = self.storage_client.create_bucket(
                bucket,
                project=project_id,
                location=location,
            )
            return {"created": True, "bucketName": new_bucket.name}
        except Exception as e:
            raise Exception(f"Failed to create bucket: {str(e)}")

    def _format_bytes(self, bytes_value: int) -> str:
        """Format bytes into human-readable string."""
        if bytes_value == 0:
            return "0 B"
        units = ["B", "KB", "MB", "GB", "TB"]
        i = 0
        while bytes_value >= 1024 and i < len(units) - 1:
            bytes_value /= 1024
            i += 1
        return f"{bytes_value:.2f} {units[i]}"
