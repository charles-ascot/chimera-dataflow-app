import React, { useState, useEffect } from 'react'
import { getBuckets, checkBucketAvailability } from '../services/api'

const STORAGE_CLASSES = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'NEARLINE', label: 'Nearline' },
  { value: 'COLDLINE', label: 'Coldline' }
]

const RETENTION_OPTIONS = [
  { value: 'P30D', label: '30 days' },
  { value: 'P90D', label: '90 days' },
  { value: 'P1Y', label: '1 year' },
  { value: 'FOREVER', label: 'Forever' }
]

export default function TargetSection({ config, onChange, sourceProject }) {
  const [buckets, setBuckets] = useState([])
  const [loading, setLoading] = useState(false)
  const [checkingBucket, setCheckingBucket] = useState(false)
  const [bucketAvailable, setBucketAvailable] = useState(null)
  const [error, setError] = useState(null)

  // Load buckets when project is available
  useEffect(() => {
    if (!sourceProject) {
      setBuckets([])
      return
    }

    async function loadBuckets() {
      setLoading(true)
      try {
        const data = await getBuckets(sourceProject.id)
        setBuckets(data.buckets || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadBuckets()
  }, [sourceProject])

  // Check bucket availability when name changes
  useEffect(() => {
    if (config.useExisting || !config.newBucketName) {
      setBucketAvailable(null)
      return
    }

    const timer = setTimeout(async () => {
      setCheckingBucket(true)
      try {
        const result = await checkBucketAvailability(config.newBucketName)
        setBucketAvailable(result.available)
      } catch (err) {
        setBucketAvailable(null)
      } finally {
        setCheckingBucket(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [config.newBucketName, config.useExisting])

  const update = (key, value) => {
    onChange({ ...config, [key]: value })
  }

  const handleBucketChange = (e) => {
    const bucket = buckets.find(b => b.name === e.target.value)
    update('bucket', bucket)
  }

  const generateBucketName = () => {
    const suffix = Math.random().toString(36).substring(2, 7)
    return `betfair-dataflow-output-${suffix}`
  }

  const targetPath = config.useExisting
    ? config.bucket?.name
    : config.newBucketName

  return (
    <div>
      <h2 className="panel-title">Target</h2>

      {error && <div className="error-message">{error}</div>}

      {/* Bucket Type Selection */}
      <div className="form-group">
        <label className="form-label">Target Bucket</label>
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <label
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px',
              background: config.useExisting
                ? 'rgba(0, 212, 255, 0.1)'
                : 'rgba(20, 30, 50, 0.3)',
              border: `1px solid ${config.useExisting ? '#00D4FF' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <input
              type="radio"
              name="bucketType"
              checked={config.useExisting}
              onChange={() => update('useExisting', true)}
            />
            <span style={{ fontSize: '13px', color: '#e0e0e0' }}>Use Existing</span>
          </label>
          <label
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px',
              background: !config.useExisting
                ? 'rgba(157, 78, 221, 0.1)'
                : 'rgba(20, 30, 50, 0.3)',
              border: `1px solid ${!config.useExisting ? '#9D4EDD' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <input
              type="radio"
              name="bucketType"
              checked={!config.useExisting}
              onChange={() => update('useExisting', false)}
            />
            <span style={{ fontSize: '13px', color: '#e0e0e0' }}>Create New</span>
          </label>
        </div>
      </div>

      {/* Existing Bucket Selection */}
      {config.useExisting && (
        <div className="form-group">
          <label className="form-label">Select Bucket</label>
          <select
            className="tier-select"
            value={config.bucket?.name || ''}
            onChange={handleBucketChange}
            disabled={loading || !sourceProject}
          >
            <option value="">
              {loading ? 'Loading buckets...' : 'Select Target Bucket'}
            </option>
            {buckets.map(b => (
              <option key={b.name} value={b.name}>
                {b.name} ({b.size})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* New Bucket Configuration */}
      {!config.useExisting && (
        <>
          <div className="form-group">
            <label className="form-label">Bucket Name</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="bucket-name"
                value={config.newBucketName}
                onChange={(e) => update('newBucketName', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="button-location"
                onClick={() => update('newBucketName', generateBucketName())}
                style={{ width: 'auto', padding: '12px 16px' }}
              >
                Generate
              </button>
            </div>
            {config.newBucketName && (
              <div style={{ marginTop: '8px', fontSize: '12px' }}>
                {checkingBucket ? (
                  <span style={{ color: '#888' }}>Checking availability...</span>
                ) : bucketAvailable === true ? (
                  <span style={{ color: '#4ade80' }}>Bucket name available</span>
                ) : bucketAvailable === false ? (
                  <span style={{ color: '#FF6B6B' }}>Bucket name already taken</span>
                ) : null}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Storage Class</label>
            <select
              className="tier-select"
              value={config.storageClass}
              onChange={(e) => update('storageClass', e.target.value)}
            >
              {STORAGE_CLASSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Retention</label>
            <select
              className="tier-select"
              value={config.retention}
              onChange={(e) => update('retention', e.target.value)}
            >
              {RETENTION_OPTIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="separator"></div>

      {/* Output Prefix */}
      <div className="form-group">
        <label className="form-label">Output Folder</label>
        <input
          type="text"
          className="form-input"
          placeholder="march_15_2016_normalized"
          value={config.outputPrefix}
          onChange={(e) => update('outputPrefix', e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
        />
        <div className="tier-description">
          This becomes the folder name in the bucket
        </div>
      </div>

      {/* Target Preview */}
      {targetPath && config.outputPrefix && (
        <div className="path-display">
          <span className="path-label">Target Path:</span>
          <span className="path-value">
            gs://{targetPath}/{config.outputPrefix}/
          </span>
        </div>
      )}

      {targetPath && config.outputPrefix && (
        <div style={{ marginTop: '12px', fontSize: '11px', color: '#888' }}>
          Files will appear as:<br />
          <code style={{ color: '#00D4FF' }}>
            {config.outputPrefix}-00001-of-00010.ndjson
          </code>
        </div>
      )}
    </div>
  )
}
