import React, { useState, useEffect, useRef } from 'react'
import { getJobStatus, getJobLogs, cancelJob, getJobDetails } from '../services/api'

const STAGE_ICONS = {
  completed: '\u2611',
  in_progress: '\u25D0',
  waiting: '\u25CB',
  failed: '\u2717'
}

export default function StatusMonitor({ job, jobIdFromUrl, onReset, onViewHistory }) {
  const [status, setStatus] = useState(job || null)
  const [logs, setLogs] = useState([])
  const [error, setError] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const pollRef = useRef(null)
  const logsRef = useRef(null)

  const jobId = job?.jobId || jobIdFromUrl

  // Poll for status updates
  useEffect(() => {
    if (!jobId) return

    async function fetchStatus() {
      try {
        const data = jobIdFromUrl
          ? await getJobDetails(jobId)
          : await getJobStatus(jobId)
        setStatus(data)

        // Stop polling if job is complete
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
          clearInterval(pollRef.current)
        }
      } catch (err) {
        setError(err.message)
      }
    }

    fetchStatus()
    pollRef.current = setInterval(fetchStatus, 3000)

    return () => clearInterval(pollRef.current)
  }, [jobId, jobIdFromUrl])

  // Poll for logs
  useEffect(() => {
    if (!jobId) return

    async function fetchLogs() {
      try {
        const data = await getJobLogs(jobId)
        setLogs(data.logs || [])
      } catch (err) {
        // Ignore log fetch errors
      }
    }

    fetchLogs()
    const logPoll = setInterval(fetchLogs, 5000)

    return () => clearInterval(logPoll)
  }, [jobId])

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [logs])

  const handleCancel = async () => {
    if (!jobId || cancelling) return
    setCancelling(true)
    try {
      await cancelJob(jobId)
      setStatus(prev => ({ ...prev, status: 'cancelled' }))
    } catch (err) {
      setError(err.message)
    } finally {
      setCancelling(false)
    }
  }

  const openDataflowConsole = () => {
    if (status?.dataflowUrl) {
      window.open(status.dataflowUrl, '_blank')
    }
  }

  if (!status) {
    return (
      <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '14px', color: '#888' }}>Loading job details...</div>
        </div>
      </div>
    )
  }

  const isRunning = status.status === 'running' || status.status === 'submitted'
  const isComplete = status.status === 'completed'
  const isFailed = status.status === 'failed'
  const isCancelled = status.status === 'cancelled'

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {error && <div className="error-message">{error}</div>}

      {/* Job Info */}
      <div className="glass-panel">
        <h2 className="panel-title">Job Information</h2>
        <div className="download-stats" style={{ marginTop: '0', border: 'none', padding: '0' }}>
          <div className="stats-row">
            <span>Job ID</span>
            <span style={{ fontFamily: 'monospace' }}>{status.jobId}</span>
          </div>
          {status.dataflowJobId && (
            <div className="stats-row">
              <span>Dataflow Job</span>
              <span style={{ fontFamily: 'monospace' }}>{status.dataflowJobId}</span>
            </div>
          )}
          <div className="stats-row">
            <span>Status</span>
            <span style={{
              color: isComplete ? '#4ade80' : isFailed ? '#FF6B6B' : isCancelled ? '#ffc107' : '#00D4FF',
              fontWeight: 600,
              textTransform: 'uppercase'
            }}>
              {status.status}
            </span>
          </div>
          {status.createdAt && (
            <div className="stats-row">
              <span>Created</span>
              <span>{formatDate(status.createdAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      {(isRunning || isComplete) && (
        <div className="glass-panel" style={{ marginTop: '24px' }}>
          <div className="progress-section" style={{ background: 'transparent', border: 'none', padding: '0', margin: '0' }}>
            <div className="progress-header">
              <span className="progress-title">Progress</span>
              <span className="progress-percent">{status.progress || 0}%</span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${status.progress || 0}%` }}
              />
            </div>

            {/* Stats */}
            <div className="progress-details">
              <div className="progress-stat">
                <span className="stat-label">Records</span>
                <span className="stat-value">
                  {(status.recordsProcessed || 0).toLocaleString()}
                  {status.recordsTotal ? ` / ${status.recordsTotal.toLocaleString()}` : ''}
                </span>
              </div>
              <div className="progress-stat">
                <span className="stat-label">Elapsed</span>
                <span className="stat-value">{formatDuration(status.elapsedSeconds || 0)}</span>
              </div>
              {status.estimatedSecondsRemaining > 0 && (
                <div className="progress-stat">
                  <span className="stat-label">Remaining</span>
                  <span className="stat-value">{formatDuration(status.estimatedSecondsRemaining)}</span>
                </div>
              )}
            </div>

            {status.throughputRecordsPerSec > 0 && (
              <div className="current-file">
                Throughput: {status.throughputRecordsPerSec.toLocaleString()} records/sec
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pipeline Stages */}
      {status.stages && (
        <div className="glass-panel" style={{ marginTop: '24px' }}>
          <h2 className="panel-title">Pipeline Stages</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Object.entries(status.stages).map(([stage, state]) => (
              <div
                key={stage}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: state === 'completed' ? 'rgba(74, 222, 128, 0.1)'
                    : state === 'in_progress' ? 'rgba(0, 212, 255, 0.1)'
                    : state === 'failed' ? 'rgba(255, 107, 107, 0.1)'
                    : 'rgba(255,255,255,0.02)',
                  borderRadius: '8px',
                  border: `1px solid ${
                    state === 'completed' ? 'rgba(74, 222, 128, 0.3)'
                    : state === 'in_progress' ? 'rgba(0, 212, 255, 0.3)'
                    : state === 'failed' ? 'rgba(255, 107, 107, 0.3)'
                    : 'rgba(255,255,255,0.05)'
                  }`
                }}
              >
                <span style={{
                  fontSize: '18px',
                  color: state === 'completed' ? '#4ade80'
                    : state === 'in_progress' ? '#00D4FF'
                    : state === 'failed' ? '#FF6B6B'
                    : '#666'
                }}>
                  {STAGE_ICONS[state] || STAGE_ICONS.waiting}
                </span>
                <span style={{
                  textTransform: 'capitalize',
                  color: state === 'waiting' ? '#666' : '#e0e0e0',
                  fontWeight: state === 'in_progress' ? 600 : 400
                }}>
                  {stage.replace(/_/g, ' ')}
                </span>
                {state === 'in_progress' && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '11px',
                    color: '#00D4FF'
                  }}>
                    In Progress...
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="glass-panel" style={{ marginTop: '24px' }}>
          <h2 className="panel-title">Logs</h2>
          <div
            ref={logsRef}
            style={{
              maxHeight: '200px',
              overflow: 'auto',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '11px',
              lineHeight: '1.6'
            }}
          >
            {logs.map((log, i) => (
              <div key={i} style={{ color: '#888' }}>{log}</div>
            ))}
          </div>
        </div>
      )}

      {/* Completion Message */}
      {isComplete && (
        <div className="download-complete" style={{ marginTop: '24px' }}>
          Pipeline completed successfully
          {status.outputLocation && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#00D4FF' }}>
              Output: {status.outputLocation}
            </div>
          )}
        </div>
      )}

      {isFailed && (
        <div className="error-message" style={{ marginTop: '24px' }}>
          Pipeline failed
          {status.errorMessage && (
            <div style={{ marginTop: '8px', fontSize: '12px' }}>
              {status.errorMessage}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="glass-panel" style={{ marginTop: '24px' }}>
        <h2 className="panel-title">Actions</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {status.dataflowUrl && (
            <button className="button-check" onClick={openDataflowConsole}>
              View on Dataflow Console
            </button>
          )}

          {isRunning && (
            <button
              className="button-abort"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Cancel Job'}
            </button>
          )}

          <button className="button-reset" onClick={onViewHistory}>
            View Job History
          </button>

          <button className="button-reset" onClick={onReset}>
            Start New Job
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins < 60) return `${mins}m ${secs}s`
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  return `${hours}h ${remainingMins}m`
}

function formatDate(dateValue) {
  if (!dateValue) return '-'
  try {
    // Handle various date formats
    let date
    if (typeof dateValue === 'string') {
      // Try parsing ISO string or other formats
      date = new Date(dateValue)
    } else if (dateValue._seconds) {
      // Firestore timestamp format
      date = new Date(dateValue._seconds * 1000)
    } else if (dateValue.seconds) {
      // Another Firestore timestamp format
      date = new Date(dateValue.seconds * 1000)
    } else {
      date = new Date(dateValue)
    }

    if (isNaN(date.getTime())) {
      return '-'
    }
    return date.toLocaleString()
  } catch {
    return '-'
  }
}
