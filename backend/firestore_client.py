"""Firestore client for job storage and retrieval."""

from datetime import datetime
from typing import List, Optional
from google.cloud import firestore


class FirestoreClient:
    """Client for Firestore operations."""

    COLLECTION = "dataflow_jobs"

    def __init__(self):
        self.db = firestore.Client()

    def create_job(self, job_data: dict) -> dict:
        """Create a new job document."""
        job_id = job_data["jobId"]
        doc_ref = self.db.collection(self.COLLECTION).document(job_id)

        # Ensure timestamps are properly formatted
        if "createdAt" not in job_data:
            job_data["createdAt"] = datetime.utcnow()

        doc_ref.set(job_data)
        return job_data

    def get_job(self, job_id: str) -> Optional[dict]:
        """Get a job by ID."""
        doc_ref = self.db.collection(self.COLLECTION).document(job_id)
        doc = doc_ref.get()

        if not doc.exists:
            return None

        data = doc.to_dict()
        # Convert Firestore timestamps to ISO strings
        data = self._convert_timestamps(data)
        return data

    def update_job(self, job_id: str, updates: dict) -> dict:
        """Update a job document."""
        doc_ref = self.db.collection(self.COLLECTION).document(job_id)
        doc_ref.update(updates)
        return self.get_job(job_id)

    def list_jobs(self, limit: int = 20) -> List[dict]:
        """List recent jobs ordered by creation date."""
        query = (
            self.db.collection(self.COLLECTION)
            .order_by("createdAt", direction=firestore.Query.DESCENDING)
            .limit(limit)
        )

        jobs = []
        for doc in query.stream():
            data = doc.to_dict()
            data = self._convert_timestamps(data)
            jobs.append(data)

        return jobs

    def add_log(self, job_id: str, log_entry: str) -> None:
        """Add a log entry to a job."""
        doc_ref = self.db.collection(self.COLLECTION).document(job_id)
        doc_ref.update({
            "logs": firestore.ArrayUnion([log_entry])
        })

    def get_logs(self, job_id: str, limit: int = 50) -> List[str]:
        """Get logs for a job."""
        job = self.get_job(job_id)
        if not job:
            return []

        logs = job.get("logs", [])
        return logs[-limit:] if len(logs) > limit else logs

    def _convert_timestamps(self, data: dict) -> dict:
        """Convert Firestore timestamps to ISO strings."""
        for key in ["createdAt", "completedAt", "updatedAt"]:
            if key in data and data[key]:
                if hasattr(data[key], "isoformat"):
                    data[key] = data[key].isoformat() + "Z"
                elif hasattr(data[key], "timestamp"):
                    # Firestore DatetimeWithNanoseconds
                    data[key] = data[key].isoformat() + "Z"
        return data
