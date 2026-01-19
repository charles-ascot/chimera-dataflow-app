import React from 'react'

const PROCESS_TYPES = [
  {
    value: 'decompress_only',
    label: 'Decompress Only',
    description: 'Decompress .bz2 files, write raw NDJSON to bucket. Preserves original file structure.'
  },
  {
    value: 'decompress_and_concatenate',
    label: 'Decompress & Concatenate',
    description: 'Decompress and combine into fewer, larger files. Standard pipeline for easier analysis.',
    recommended: true
  },
  {
    value: 'decompress_concatenate_parse',
    label: 'Decompress, Concatenate & Parse',
    description: 'Also validate NDJSON format. Coming soon.',
    disabled: true
  },
  {
    value: 'direct_to_bigquery',
    label: 'Direct to BigQuery',
    description: 'Write to BigQuery tables directly. Coming soon.',
    disabled: true
  }
]

const REGIONS = [
  { value: 'europe-west2', label: 'europe-west2 (London)' },
  { value: 'europe-west1', label: 'europe-west1 (Belgium)' },
  { value: 'us-central1', label: 'us-central1 (Iowa)' }
]

const WORKER_TYPES = [
  { value: 'n1-standard-4', label: 'n1-standard-4 (4 vCPU, 15 GB)' },
  { value: 'n1-highmem-8', label: 'n1-highmem-8 (8 vCPU, 52 GB)' },
  { value: 'n1-standard-16', label: 'n1-standard-16 (16 vCPU, 60 GB)' }
]

const MAX_WORKERS = [
  { value: 'AUTO', label: 'Auto (Dataflow scales)' },
  { value: '5', label: '5 workers' },
  { value: '10', label: '10 workers' },
  { value: '20', label: '20 workers' },
  { value: '50', label: '50 workers' }
]

const TIMEOUTS = [
  { value: 1, label: '1 hour' },
  { value: 2, label: '2 hours' },
  { value: 4, label: '4 hours' },
  { value: 6, label: '6 hours' },
  { value: 12, label: '12 hours' },
  { value: 24, label: '24 hours' }
]

const OUTPUT_SHARDS = [5, 10, 20, 50]
const COMPRESSION_OPTIONS = [
  { value: 'none', label: 'None (Raw NDJSON)' },
  { value: 'gzip', label: 'Gzip' },
  { value: 'snappy', label: 'Snappy' }
]

export default function ProcessSection({ config, onChange }) {
  const update = (key, value) => {
    onChange({ ...config, [key]: value })
  }

  return (
    <div>
      <h2 className="panel-title">Process</h2>

      {/* Operation Type */}
      <div className="form-group">
        <label className="form-label">Operation Type</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
          {PROCESS_TYPES.map(type => (
            <label
              key={type.value}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px',
                background: config.processType === type.value
                  ? 'rgba(0, 212, 255, 0.1)'
                  : 'rgba(20, 30, 50, 0.3)',
                border: `1px solid ${config.processType === type.value ? '#00D4FF' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '10px',
                cursor: type.disabled ? 'not-allowed' : 'pointer',
                opacity: type.disabled ? 0.5 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              <input
                type="radio"
                name="processType"
                value={type.value}
                checked={config.processType === type.value}
                onChange={(e) => update('processType', e.target.value)}
                disabled={type.disabled}
                style={{ marginTop: '3px' }}
              />
              <div>
                <div style={{ fontWeight: 600, color: '#e0e0e0', fontSize: '13px' }}>
                  {type.label}
                  {type.recommended && (
                    <span style={{ color: '#4ade80', marginLeft: '8px', fontSize: '11px' }}>
                      Recommended
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                  {type.description}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Output Configuration */}
      {(config.processType === 'decompress_and_concatenate' || config.processType === 'decompress_only') && (
        <>
          <div className="form-group">
            <label className="form-label">Output Shards</label>
            <select
              className="tier-select"
              value={config.outputShards}
              onChange={(e) => update('outputShards', parseInt(e.target.value))}
            >
              {OUTPUT_SHARDS.map(n => (
                <option key={n} value={n}>{n} files</option>
              ))}
            </select>
            <div className="tier-description">
              Recommendation: 10 shards for most jobs
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Output Compression</label>
            <select
              className="tier-select"
              value={config.compression}
              onChange={(e) => update('compression', e.target.value)}
            >
              {COMPRESSION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="separator"></div>

      {/* Dataflow Configuration */}
      <h3 className="panel-title" style={{ fontSize: '12px', marginBottom: '16px' }}>
        Dataflow Options
      </h3>

      <div className="form-group">
        <label className="form-label">Region</label>
        <select
          className="tier-select"
          value={config.region}
          onChange={(e) => update('region', e.target.value)}
        >
          {REGIONS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Worker Type</label>
        <select
          className="tier-select"
          value={config.workerType}
          onChange={(e) => update('workerType', e.target.value)}
        >
          {WORKER_TYPES.map(w => (
            <option key={w.value} value={w.value}>{w.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Max Workers</label>
        <select
          className="tier-select"
          value={config.maxWorkers}
          onChange={(e) => update('maxWorkers', e.target.value)}
        >
          {MAX_WORKERS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Timeout</label>
        <select
          className="tier-select"
          value={config.timeoutHours}
          onChange={(e) => update('timeoutHours', parseInt(e.target.value))}
        >
          {TIMEOUTS.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
