import React from 'react'

export default function SubmitSection({
  sourceConfig,
  processConfig,
  targetConfig,
  canSubmit,
  isSubmitting,
  error,
  onSubmit
}) {
  const targetBucket = targetConfig.useExisting
    ? targetConfig.bucket?.name
    : targetConfig.newBucketName

  const getProcessLabel = (type) => {
    const labels = {
      'decompress_only': 'Decompress Only',
      'decompress_and_concatenate': 'Decompress & Concatenate',
      'decompress_concatenate_parse': 'Decompress, Concatenate & Parse',
      'direct_to_bigquery': 'Direct to BigQuery'
    }
    return labels[type] || type
  }

  return (
    <div>
      <h2 className="panel-title">Summary</h2>

      {error && <div className="error-message">{error}</div>}

      {/* Source Summary */}
      <div className="download-stats">
        <h3>Source</h3>
        <div className="stats-row">
          <span>Project</span>
          <span>{sourceConfig.project?.name || '-'}</span>
        </div>
        <div className="stats-row">
          <span>Bucket</span>
          <span>{sourceConfig.bucket?.name || '-'}</span>
        </div>
        <div className="stats-row">
          <span>Dataset</span>
          <span>{sourceConfig.dataset?.path || '-'}</span>
        </div>
        <div className="stats-row">
          <span>Selected Items</span>
          <span>{sourceConfig.selectedPaths?.length || 0}</span>
        </div>
      </div>

      {/* Process Summary */}
      <div className="download-stats" style={{ marginTop: '16px' }}>
        <h3>Process</h3>
        <div className="stats-row">
          <span>Operation</span>
          <span>{getProcessLabel(processConfig.processType)}</span>
        </div>
        <div className="stats-row">
          <span>Output Shards</span>
          <span>{processConfig.outputShards}</span>
        </div>
        <div className="stats-row">
          <span>Compression</span>
          <span>{processConfig.compression}</span>
        </div>
        <div className="stats-row">
          <span>Region</span>
          <span>{processConfig.region}</span>
        </div>
        <div className="stats-row">
          <span>Workers</span>
          <span>{processConfig.maxWorkers}</span>
        </div>
        <div className="stats-row">
          <span>Timeout</span>
          <span>{processConfig.timeoutHours} hours</span>
        </div>
      </div>

      {/* Target Summary */}
      <div className="download-stats" style={{ marginTop: '16px' }}>
        <h3>Target</h3>
        <div className="stats-row">
          <span>Bucket</span>
          <span>{targetBucket || '-'}</span>
        </div>
        <div className="stats-row">
          <span>Folder</span>
          <span>{targetConfig.outputPrefix || '-'}</span>
        </div>
        {targetBucket && targetConfig.outputPrefix && (
          <div className="stats-row">
            <span>Full Path</span>
            <span style={{ color: '#00D4FF', fontSize: '11px' }}>
              gs://{targetBucket}/{targetConfig.outputPrefix}/
            </span>
          </div>
        )}
      </div>

      {/* Validation Messages */}
      {!sourceConfig.project && (
        <div className="batch-warning" style={{ marginTop: '16px' }}>
          Select a GCP project to continue
        </div>
      )}
      {sourceConfig.project && !sourceConfig.bucket && (
        <div className="batch-warning" style={{ marginTop: '16px' }}>
          Select a source bucket to continue
        </div>
      )}
      {sourceConfig.bucket && !sourceConfig.dataset && (
        <div className="batch-warning" style={{ marginTop: '16px' }}>
          Select a dataset to continue
        </div>
      )}
      {sourceConfig.dataset && (!sourceConfig.selectedPaths || sourceConfig.selectedPaths.length === 0) && (
        <div className="batch-warning" style={{ marginTop: '16px' }}>
          Select items from the data browser to continue
        </div>
      )}
      {sourceConfig.selectedPaths?.length > 0 && !targetBucket && (
        <div className="batch-warning" style={{ marginTop: '16px' }}>
          Select or create a target bucket
        </div>
      )}
      {targetBucket && !targetConfig.outputPrefix && (
        <div className="batch-warning" style={{ marginTop: '16px' }}>
          Enter an output folder name
        </div>
      )}

      {/* Submit Button */}
      <button
        className="button-download"
        onClick={onSubmit}
        disabled={!canSubmit}
        style={{ marginTop: '20px' }}
      >
        {isSubmitting ? 'Submitting...' : 'Submit Pipeline'}
      </button>

      {canSubmit && (
        <div className="success-message" style={{ marginTop: '16px', textAlign: 'center' }}>
          Ready to submit
        </div>
      )}
    </div>
  )
}
