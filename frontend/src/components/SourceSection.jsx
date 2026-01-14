import React, { useState, useEffect } from 'react'
import { getProjects, getBuckets, getDatasets, getDates } from '../services/api'

export default function SourceSection({ config, onChange }) {
  const [projects, setProjects] = useState([])
  const [buckets, setBuckets] = useState([])
  const [datasets, setDatasets] = useState([])
  const [availableDates, setAvailableDates] = useState([])
  const [loading, setLoading] = useState({ projects: false, buckets: false, datasets: false, dates: false })
  const [error, setError] = useState(null)

  // Load projects on mount
  useEffect(() => {
    async function loadProjects() {
      setLoading(prev => ({ ...prev, projects: true }))
      try {
        const data = await getProjects()
        setProjects(data.projects || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(prev => ({ ...prev, projects: false }))
      }
    }
    loadProjects()
  }, [])

  // Load buckets when project changes
  useEffect(() => {
    if (!config.project) {
      setBuckets([])
      return
    }

    async function loadBuckets() {
      setLoading(prev => ({ ...prev, buckets: true }))
      try {
        const data = await getBuckets(config.project.id)
        setBuckets(data.buckets || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(prev => ({ ...prev, buckets: false }))
      }
    }
    loadBuckets()
  }, [config.project])

  // Load datasets when bucket changes
  useEffect(() => {
    if (!config.bucket) {
      setDatasets([])
      return
    }

    async function loadDatasets() {
      setLoading(prev => ({ ...prev, datasets: true }))
      try {
        const data = await getDatasets(config.bucket.name)
        setDatasets(data.datasets || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(prev => ({ ...prev, datasets: false }))
      }
    }
    loadDatasets()
  }, [config.bucket])

  // Load dates when dataset changes
  useEffect(() => {
    if (!config.bucket || !config.dataset) {
      setAvailableDates([])
      return
    }

    async function loadDates() {
      setLoading(prev => ({ ...prev, dates: true }))
      try {
        const data = await getDates(config.bucket.name, config.dataset.path)
        setAvailableDates(data.availableDates || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(prev => ({ ...prev, dates: false }))
      }
    }
    loadDates()
  }, [config.bucket, config.dataset])

  // Calculate file count and size when dates change
  useEffect(() => {
    if (!config.startDate || availableDates.length === 0) {
      onChange(prev => ({ ...prev, fileCount: 0, totalSize: '' }))
      return
    }

    const start = config.startDate
    const end = config.endDate || config.startDate

    let fileCount = 0
    let totalBytes = 0

    availableDates.forEach(d => {
      if (d.date >= start && d.date <= end) {
        fileCount += d.files
        totalBytes += d.sizeBytes || 0
      }
    })

    const totalSize = formatBytes(totalBytes)
    onChange(prev => ({ ...prev, fileCount, totalSize }))
  }, [config.startDate, config.endDate, availableDates])

  const handleProjectChange = (e) => {
    const project = projects.find(p => p.id === e.target.value)
    onChange({
      ...config,
      project,
      bucket: null,
      dataset: null,
      startDate: '',
      endDate: '',
      fileCount: 0,
      totalSize: ''
    })
  }

  const handleBucketChange = (e) => {
    const bucket = buckets.find(b => b.name === e.target.value)
    onChange({
      ...config,
      bucket,
      dataset: null,
      startDate: '',
      endDate: '',
      fileCount: 0,
      totalSize: ''
    })
  }

  const handleDatasetChange = (e) => {
    const dataset = datasets.find(d => d.path === e.target.value)
    onChange({
      ...config,
      dataset,
      startDate: dataset?.dateRange?.start || '',
      endDate: '',
      fileCount: 0,
      totalSize: ''
    })
  }

  return (
    <div>
      <h2 className="panel-title">Source</h2>

      {error && <div className="error-message">{error}</div>}

      {/* Project Selection */}
      <div className="form-group">
        <label className="form-label">GCP Project</label>
        <select
          className="tier-select"
          value={config.project?.id || ''}
          onChange={handleProjectChange}
          disabled={loading.projects}
        >
          <option value="">
            {loading.projects ? 'Loading projects...' : 'Select GCP Project'}
          </option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Bucket Selection */}
      <div className="form-group">
        <label className="form-label">Source Bucket</label>
        <select
          className="tier-select"
          value={config.bucket?.name || ''}
          onChange={handleBucketChange}
          disabled={!config.project || loading.buckets}
        >
          <option value="">
            {loading.buckets ? 'Loading buckets...' : 'Select Source Bucket'}
          </option>
          {buckets.map(b => (
            <option key={b.name} value={b.name}>
              {b.name} ({b.size})
            </option>
          ))}
        </select>
      </div>

      {/* Dataset Selection */}
      <div className="form-group">
        <label className="form-label">Dataset (Tier & Year)</label>
        <select
          className="tier-select"
          value={config.dataset?.path || ''}
          onChange={handleDatasetChange}
          disabled={!config.bucket || loading.datasets}
        >
          <option value="">
            {loading.datasets ? 'Loading datasets...' : 'Select Dataset'}
          </option>
          {datasets.map(d => (
            <option key={d.path} value={d.path}>
              {d.path} ({d.fileCount.toLocaleString()} files, {d.totalSize})
            </option>
          ))}
        </select>
      </div>

      {/* Date Range */}
      <div className="date-section">
        <div className="date-group">
          <span className="date-label">Date Range</span>
          <div className="date-inputs">
            <input
              type="date"
              className="date-select"
              value={config.startDate}
              onChange={(e) => onChange({ ...config, startDate: e.target.value })}
              disabled={!config.dataset || loading.dates}
              min={config.dataset?.dateRange?.start}
              max={config.dataset?.dateRange?.end}
            />
            <input
              type="date"
              className="date-select"
              value={config.endDate}
              onChange={(e) => onChange({ ...config, endDate: e.target.value })}
              disabled={!config.dataset || loading.dates}
              min={config.startDate || config.dataset?.dateRange?.start}
              max={config.dataset?.dateRange?.end}
              placeholder="Optional"
            />
          </div>
        </div>
      </div>

      {/* Selection Summary */}
      {config.fileCount > 0 && (
        <div className="preset-values">
          <div className="preset-item">
            <span className="preset-label">Files</span>
            <span className="preset-value">{config.fileCount.toLocaleString()}</span>
          </div>
          <div className="preset-item">
            <span className="preset-label">Estimated Size</span>
            <span className="preset-value">{config.totalSize}</span>
          </div>
          <div className="preset-item">
            <span className="preset-label">Status</span>
            <span className="preset-value">Ready to proceed</span>
          </div>
        </div>
      )}

      {config.dataset && config.startDate && config.fileCount === 0 && (
        <div className="batch-warning">
          No files found for selected date range
        </div>
      )}
    </div>
  )
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
