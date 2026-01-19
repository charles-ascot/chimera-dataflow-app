import React, { useState, useEffect } from 'react'
import { getJobHistory } from '../services/api'

export default function JobHistory({ onSelectJob }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadHistory() {
      try {
        const data = await getJobHistory(20)
        setJobs(data.jobs || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadHistory()
  }, [])

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4ade80'
      case 'failed': return '#FF6B6B'
      case 'cancelled': return '#ffc107'
      case 'running': return '#00D4FF'
      default: return '#888'
    }
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '-'
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins < 60) return `${mins}m ${secs}s`
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return `${hours}h ${remainingMins}m`
  }

  const formatBytes = (bytes) => {
    if (!bytes) return '-'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateValue) => {
    if (!dateValue) return '-'
    try {
      let date
      if (typeof dateValue === 'string') {
        date = new Date(dateValue)
      } else if (dateValue._seconds) {
        date = new Date(dateValue._seconds * 1000)
      } else if (dateValue.seconds) {
        date = new Date(dateValue.seconds * 1000)
      } else {
        date = new Date(dateValue)
      }
      if (isNaN(date.getTime())) return '-'
      return date
    } catch {
      return null
    }
  }

  const getProcessLabel = (type) => {
    const labels = {
      'decompress_only': 'Decomp',
      'decompress_and_concatenate': 'Concat',
      'decompress_concatenate_parse': 'Parse',
      'direct_to_bigquery': 'BigQuery'
    }
    return labels[type] || type
  }

  if (loading) {
    return (
      <div className="glass-panel" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '14px', color: '#888' }}>Loading job history...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-panel" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div className="error-message">{error}</div>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="glass-panel" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h2 className="panel-title">Recent Jobs</h2>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '14px', color: '#888' }}>No jobs found</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
            Submit a pipeline to see job history here
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-panel" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h2 className="panel-title">Recent Jobs</h2>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '13px'
        }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Source</th>
              <th style={thStyle}>Operation</th>
              <th style={thStyle}>Target</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Duration</th>
              <th style={thStyle}>Records</th>
              <th style={thStyle}>Size</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => (
              <tr
                key={job.jobId}
                onClick={() => onSelectJob(job)}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 212, 255, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={tdStyle}>
                  {(() => {
                    const date = formatDate(job.createdAt)
                    return date ? date.toLocaleDateString() : '-'
                  })()}
                  <div style={{ fontSize: '10px', color: '#666' }}>
                    {(() => {
                      const date = formatDate(job.createdAt)
                      return date ? date.toLocaleTimeString() : ''
                    })()}
                  </div>
                </td>
                <td style={tdStyle}>
                  {job.sourceDataset}
                  <div style={{ fontSize: '10px', color: '#666' }}>
                    {job.selectedPaths?.length || 0} item{job.selectedPaths?.length !== 1 ? 's' : ''} selected
                  </div>
                </td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '4px 8px',
                    background: 'rgba(157, 78, 221, 0.2)',
                    borderRadius: '4px',
                    fontSize: '11px'
                  }}>
                    {getProcessLabel(job.processType)}
                  </span>
                </td>
                <td style={tdStyle}>
                  <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                    {job.targetBucket?.replace('gs://', '').substring(0, 20)}
                    {job.targetBucket?.length > 23 ? '...' : ''}
                  </span>
                  <div style={{ fontSize: '10px', color: '#666' }}>
                    /{job.outputPrefix}
                  </div>
                </td>
                <td style={tdStyle}>
                  <span style={{
                    color: getStatusColor(job.status),
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    fontSize: '11px'
                  }}>
                    {job.status === 'completed' ? '\u2713' : job.status === 'failed' ? '\u2717' : ''}
                    {' '}{job.status}
                  </span>
                </td>
                <td style={tdStyle}>
                  {formatDuration(job.durationSeconds)}
                </td>
                <td style={tdStyle}>
                  {job.recordsProcessed ? job.recordsProcessed.toLocaleString() : '-'}
                </td>
                <td style={tdStyle}>
                  {formatBytes(job.bytesProcessed)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{
        marginTop: '16px',
        fontSize: '11px',
        color: '#666',
        textAlign: 'center'
      }}>
        Click a row to view job details
      </div>
    </div>
  )
}

const thStyle = {
  textAlign: 'left',
  padding: '12px 8px',
  color: '#00D4FF',
  fontWeight: 600,
  textTransform: 'uppercase',
  fontSize: '11px',
  letterSpacing: '0.5px'
}

const tdStyle = {
  padding: '12px 8px',
  color: '#e0e0e0',
  verticalAlign: 'top'
}
