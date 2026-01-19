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
  const formatSelectedPaths = () => {
    const paths = sourceConfig.selectedPaths || []
    if (paths.length === 0) return 'None'
    if (paths.length <= 3) return paths.join(', ')
    return `${paths.slice(0, 2).join(', ')} +${paths.length - 2} more`
  }

  return (
    <div>
      <h2 className="panel-title">Submit Job</h2>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {/* Job Summary */}
      <div className="download-stats">
        <h3>Job Configuration</h3>
        
        <div className="stats-row">
          <span>Source Type</span>
          <span>{sourceConfig.sourceType || 'Betfair'}</span>
        </div>
        
        <div className="stats-row">
          <span>Source Bucket</span>
          <span>{sourceConfig.bucket?.name || '—'}</span>
        </div>
        
        <div className="stats-row">
          <span>Dataset</span>
          <span>{sourceConfig.dataset?.path || '—'}</span>
        </div>
        
        <div className="stats-row">
          <span>Selected Items</span>
          <span>{formatSelectedPaths()}</span>
        </div>
        
        <div className="stats-row">
          <span>Process Type</span>
          <span>{processConfig.processType.replace(/_/g, ' ')}</span>
        </div>
        
        <div className="stats-row">
          <span>Output Shards</span>
          <span>{processConfig.outputShards}</span>
        </div>
        
        <div className="stats-row">
          <span>Target Bucket</span>
          <span>
            {targetConfig.useExisting 
              ? targetConfig.bucket?.name 
              : targetConfig.newBucketName || '—'}
          </span>
        </div>
        
        <div className="stats-row">
          <span>Output Prefix</span>
          <span>{targetConfig.outputPrefix || '—'}</span>
        </div>
        
        <div className="stats-row">
          <span>Dataflow Region</span>
          <span>{processConfig.region}</span>
        </div>
        
        <div className="stats-row">
          <span>Worker Type</span>
          <span>{processConfig.workerType}</span>
        </div>
        
        <div className="stats-row">
          <span>Max Workers</span>
          <span>{processConfig.maxWorkers}</span>
        </div>
      </div>

      {/* Submit Button */}
      <button
        className="button-primary"
        onClick={onSubmit}
        disabled={!canSubmit || isSubmitting}
      >
        {isSubmitting ? 'Submitting...' : 'Submit Pipeline Job'}
      </button>

      {/* Validation Messages */}
      {!sourceConfig.bucket && (
        <p className="tier-description" style={{ marginTop: '12px', color: '#ffc107' }}>
          ⚠️ Select a source bucket
        </p>
      )}
      {sourceConfig.bucket && !sourceConfig.dataset && (
        <p className="tier-description" style={{ marginTop: '12px', color: '#ffc107' }}>
          ⚠️ Select a dataset
        </p>
      )}
      {sourceConfig.dataset && sourceConfig.selectedPaths?.length === 0 && (
        <p className="tier-description" style={{ marginTop: '12px', color: '#ffc107' }}>
          ⚠️ Select items from the data browser
        </p>
      )}
      {sourceConfig.selectedPaths?.length > 0 && !targetConfig.outputPrefix && (
        <p className="tier-description" style={{ marginTop: '12px', color: '#ffc107' }}>
          ⚠️ Enter an output prefix
        </p>
      )}
      {canSubmit && (
        <p className="tier-description" style={{ marginTop: '12px', color: '#4ade80' }}>
          ✓ Ready to submit
        </p>
      )}
    </div>
  )
}
