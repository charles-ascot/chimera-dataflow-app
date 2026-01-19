/**
 * API service for CHIMERA DataFlow v2.0
 * 
 * Handles all communication with the backend API.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'https://chimera-dataflow-app-1026419041222.us-central1.run.app';

async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Plugin Endpoints
// ============================================================================

export async function getPlugins() {
  return fetchApi('/api/plugins');
}

export async function validatePatterns(sourceType, sourceBucket, selectedPaths) {
  return fetchApi('/api/plugins/validate', {
    method: 'POST',
    body: JSON.stringify({
      sourceType,
      sourceBucket,
      selectedPaths
    })
  });
}

// ============================================================================
// GCP Resource Discovery
// ============================================================================

export async function getProjects() {
  return fetchApi('/api/gcp/projects');
}

export async function getBuckets(projectId) {
  return fetchApi(`/api/gcp/projects/${encodeURIComponent(projectId)}/buckets`);
}

export async function getDatasets(bucketName) {
  return fetchApi(`/api/gcp/buckets/${encodeURIComponent(bucketName)}/datasets`);
}

export async function getDates(bucketName, datasetPath) {
  return fetchApi(`/api/gcp/datasets/${encodeURIComponent(bucketName)}/${encodeURIComponent(datasetPath)}/dates`);
}

export async function browsePath(bucketName, path = '') {
  if (path) {
    return fetchApi(`/api/gcp/buckets/${encodeURIComponent(bucketName)}/browse/${encodeURIComponent(path)}`);
  }
  return fetchApi(`/api/gcp/buckets/${encodeURIComponent(bucketName)}/browse`);
}

export async function checkBucketAvailability(bucketName) {
  return fetchApi(`/api/gcp/buckets/check/${encodeURIComponent(bucketName)}`);
}

export async function createBucket(data) {
  return fetchApi('/api/gcp/buckets/create', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// ============================================================================
// Pipeline Operations
// ============================================================================

export async function submitPipeline(config) {
  return fetchApi('/api/pipeline/submit', {
    method: 'POST',
    body: JSON.stringify(config)
  });
}

export async function getJobStatus(jobId) {
  return fetchApi(`/api/pipeline/${encodeURIComponent(jobId)}/status`);
}

export async function getJobLogs(jobId) {
  return fetchApi(`/api/pipeline/${encodeURIComponent(jobId)}/logs`);
}

export async function cancelJob(jobId) {
  return fetchApi(`/api/pipeline/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST'
  });
}

export async function getJobHistory(limit = 20) {
  return fetchApi(`/api/pipeline/history?limit=${limit}`);
}

export async function getJobDetails(jobId) {
  return fetchApi(`/api/pipeline/${encodeURIComponent(jobId)}`);
}
