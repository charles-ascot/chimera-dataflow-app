import React, { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import SourceSection from './components/SourceSection'
import ProcessSection from './components/ProcessSection'
import TargetSection from './components/TargetSection'
import SubmitSection from './components/SubmitSection'
import StatusMonitor from './components/StatusMonitor'
import JobHistory from './components/JobHistory'
import { submitPipeline } from './services/api'

function Dashboard() {
  const navigate = useNavigate()

  // Source state - now includes sourceType
  const [sourceConfig, setSourceConfig] = useState({
    sourceType: 'betfair',
    project: null,
    bucket: null,
    dataset: null,
    selectedPaths: [],
    fileCount: 0,
    totalSize: ''
  })

  // Process state
  const [processConfig, setProcessConfig] = useState({
    processType: 'decompress_and_concatenate',
    outputShards: 10,
    compression: 'none',
    region: 'europe-west2',
    workerType: 'n1-standard-4',
    maxWorkers: 'AUTO',
    timeoutHours: 4
  })

  // Target state
  const [targetConfig, setTargetConfig] = useState({
    useExisting: true,
    bucket: null,
    newBucketName: '',
    storageClass: 'STANDARD',
    retention: 'P1Y',
    outputPrefix: ''
  })

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [activeJob, setActiveJob] = useState(null)

  const isSourceComplete = sourceConfig.project && sourceConfig.bucket &&
    sourceConfig.dataset && sourceConfig.selectedPaths?.length > 0

  const isTargetComplete = targetConfig.outputPrefix &&
    (targetConfig.useExisting ? targetConfig.bucket : targetConfig.newBucketName)

  const canSubmit = isSourceComplete && isTargetComplete && !isSubmitting

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const payload = {
        sourceType: sourceConfig.sourceType || 'betfair',
        sourceProject: sourceConfig.project.id,
        sourceBucket: sourceConfig.bucket.name,
        sourceDataset: sourceConfig.dataset.path,
        selectedPaths: sourceConfig.selectedPaths,
        processType: processConfig.processType,
        outputShards: processConfig.outputShards,
        compression: processConfig.compression,
        targetBucket: targetConfig.useExisting
          ? targetConfig.bucket.name
          : targetConfig.newBucketName,
        outputPrefix: targetConfig.outputPrefix,
        dataflowRegion: processConfig.region,
        dataflowWorkerType: processConfig.workerType,
        dataflowMaxWorkers: processConfig.maxWorkers,
        dataflowTimeoutHours: processConfig.timeoutHours,
        createNewBucket: !targetConfig.useExisting,
        storageClass: targetConfig.storageClass,
        retention: targetConfig.retention
      }

      const result = await submitPipeline(payload)
      setActiveJob(result)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setActiveJob(null)
    setSubmitError(null)
  }

  const handleViewHistory = () => {
    navigate('/history')
  }

  if (activeJob) {
    return (
      <div className="dashboard">
        <div className="image-bg"></div>
        <div className="login-overlay"></div>
        <header className="header">
          <div className="header-left">
            <h1 className="header-title">CHIMERA DataFlow</h1>
            <p className="header-subtitle">Job Monitor</p>
          </div>
          <button className="button-logout" onClick={handleReset}>
            New Job
          </button>
        </header>
        <div className="content">
          <StatusMonitor
            job={activeJob}
            onReset={handleReset}
            onViewHistory={handleViewHistory}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="image-bg"></div>
      <div className="login-overlay"></div>
      <header className="header">
        <div className="header-left">
          <h1 className="header-title">CHIMERA DataFlow</h1>
          <p className="header-subtitle">Data Transport Pipeline — Version 2.0</p>
        </div>
        <button className="button-logout" onClick={handleViewHistory}>
          Job History
        </button>
      </header>
      <div className="content">
        <div className="main-container">
          <div className="control-panel">
            <div className="glass-panel">
              <SourceSection
                config={sourceConfig}
                onChange={setSourceConfig}
              />
            </div>
            <div className="glass-panel" style={{ marginTop: '24px' }}>
              <ProcessSection
                config={processConfig}
                onChange={setProcessConfig}
              />
            </div>
          </div>
          <div className="results-panel">
            <div className="glass-panel">
              <TargetSection
                config={targetConfig}
                onChange={setTargetConfig}
                sourceProject={sourceConfig.project}
              />
            </div>
            <div className="glass-panel" style={{ marginTop: '24px' }}>
              <SubmitSection
                sourceConfig={sourceConfig}
                processConfig={processConfig}
                targetConfig={targetConfig}
                canSubmit={canSubmit}
                isSubmitting={isSubmitting}
                error={submitError}
                onSubmit={handleSubmit}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HistoryPage() {
  const navigate = useNavigate()

  return (
    <div className="dashboard">
      <div className="image-bg"></div>
      <div className="login-overlay"></div>
      <header className="header">
        <div className="header-left">
          <h1 className="header-title">CHIMERA DataFlow</h1>
          <p className="header-subtitle">Job History</p>
        </div>
        <button className="button-logout" onClick={() => navigate('/')}>
          New Job
        </button>
      </header>
      <div className="content">
        <JobHistory onSelectJob={(job) => navigate(`/job/${job.jobId}`)} />
      </div>
    </div>
  )
}

function JobDetailPage() {
  const navigate = useNavigate()

  return (
    <div className="dashboard">
      <div className="image-bg"></div>
      <div className="login-overlay"></div>
      <header className="header">
        <div className="header-left">
          <h1 className="header-title">CHIMERA DataFlow</h1>
          <p className="header-subtitle">Job Details</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="button-logout" onClick={() => navigate('/history')}>
            History
          </button>
          <button className="button-logout" onClick={() => navigate('/')}>
            New Job
          </button>
        </div>
      </header>
      <div className="content">
        <StatusMonitor
          jobIdFromUrl={window.location.pathname.split('/').pop()}
          onReset={() => navigate('/')}
          onViewHistory={() => navigate('/history')}
        />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/job/:jobId" element={<JobDetailPage />} />
      </Routes>
    </div>
  )
}
