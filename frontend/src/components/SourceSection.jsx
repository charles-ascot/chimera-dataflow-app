import React, { useState, useEffect, useCallback } from 'react'
import { getPlugins, getProjects, getBuckets, getDatasets, browsePath, validatePatterns } from '../services/api'

// Tree node component for hierarchical browsing
function TreeNode({ node, level, selectedPaths, onToggleSelect, onExpand, expandedPaths, bucketName }) {
  const [children, setChildren] = useState(null)
  const [loading, setLoading] = useState(false)
  const isExpanded = expandedPaths.has(node.path)
  const isSelected = selectedPaths.has(node.path)
  const isFolder = node.type === 'folder'
  const indent = level * 20

  const handleExpand = async () => {
    if (!isFolder) return

    if (isExpanded) {
      onExpand(node.path, false)
      return
    }

    if (children === null) {
      setLoading(true)
      try {
        const data = await browsePath(bucketName, node.path)
        setChildren([...data.folders, ...data.files])
      } catch (err) {
        console.error('Failed to load children:', err)
        setChildren([])
      } finally {
        setLoading(false)
      }
    }
    onExpand(node.path, true)
  }

  const handleSelect = (e) => {
    e.stopPropagation()
    onToggleSelect(node.path, !isSelected, isFolder)
  }

  return (
    <div className="tree-node">
      <div
        className={`tree-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${indent}px` }}
        onClick={handleExpand}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleSelect}
          onClick={(e) => e.stopPropagation()}
          className="tree-checkbox"
        />
        {isFolder && (
          <span className="tree-icon">
            {loading ? '⏳' : isExpanded ? '📂' : '📁'}
          </span>
        )}
        {!isFolder && <span className="tree-icon">📄</span>}
        <span className="tree-name">{node.name}</span>
        {isFolder && node.hasChildren && (
          <span className="tree-meta">
            {node.fileCount > 0 && `${node.fileCount} files`}
            {node.totalSize && node.totalSize !== '0 B' && ` • ${node.totalSize}`}
          </span>
        )}
        {!isFolder && (
          <span className="tree-meta">{node.size}</span>
        )}
      </div>
      {isExpanded && children && children.length > 0 && (
        <div className="tree-children">
          {children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              selectedPaths={selectedPaths}
              onToggleSelect={onToggleSelect}
              onExpand={onExpand}
              expandedPaths={expandedPaths}
              bucketName={bucketName}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function SourceSection({ config, onChange }) {
  // Plugin state
  const [plugins, setPlugins] = useState([])
  const [sourceType, setSourceType] = useState('betfair')
  
  // GCP resource state
  const [projects, setProjects] = useState([])
  const [buckets, setBuckets] = useState([])
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState({ plugins: false, projects: false, buckets: false, datasets: false })
  const [error, setError] = useState(null)

  // Data browser state
  const [dataExpanded, setDataExpanded] = useState(false)
  const [browserData, setBrowserData] = useState(null)
  const [browserLoading, setBrowserLoading] = useState(false)
  const [selectedPaths, setSelectedPaths] = useState(new Set())
  const [expandedPaths, setExpandedPaths] = useState(new Set())
  
  // Validation state
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState(null)

  // Load plugins on mount
  useEffect(() => {
    async function loadPlugins() {
      setLoading(prev => ({ ...prev, plugins: true }))
      try {
        const data = await getPlugins()
        setPlugins(data.plugins || [])
      } catch (err) {
        console.error('Failed to load plugins:', err)
        // Fallback to default plugin
        setPlugins([
          { id: 'betfair', name: 'Betfair', extensions: ['.bz2'], enabled: true, description: 'Betfair historical data' },
          { id: 'racing_api', name: 'The Racing API', extensions: ['.json'], enabled: false, description: 'Coming Soon' }
        ])
      } finally {
        setLoading(prev => ({ ...prev, plugins: false }))
      }
    }
    loadPlugins()
  }, [])

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

  // Load browser data when dataset changes
  useEffect(() => {
    if (!config.bucket || !config.dataset) {
      setBrowserData(null)
      setSelectedPaths(new Set())
      setExpandedPaths(new Set())
      setDataExpanded(false)
      setValidationResult(null)
      return
    }

    async function loadBrowserData() {
      setBrowserLoading(true)
      try {
        const data = await browsePath(config.bucket.name, config.dataset.path)
        setBrowserData(data)
        setDataExpanded(true)
      } catch (err) {
        setError(err.message)
      } finally {
        setBrowserLoading(false)
      }
    }
    loadBrowserData()
  }, [config.bucket, config.dataset])

  // Update parent config when selection changes
  useEffect(() => {
    const pathsArray = Array.from(selectedPaths)
    const fileCount = pathsArray.length
    onChange(prev => ({
      ...prev,
      sourceType,
      selectedPaths: pathsArray,
      fileCount,
      totalSize: fileCount > 0 ? `${fileCount} items selected` : ''
    }))
    // Clear validation when selection changes
    setValidationResult(null)
  }, [selectedPaths, sourceType])

  const handleSourceTypeChange = (e) => {
    setSourceType(e.target.value)
    // Clear selection when source type changes
    setSelectedPaths(new Set())
    setValidationResult(null)
  }

  const handleProjectChange = (e) => {
    const project = projects.find(p => p.id === e.target.value)
    onChange({
      ...config,
      sourceType,
      project,
      bucket: null,
      dataset: null,
      selectedPaths: [],
      fileCount: 0,
      totalSize: ''
    })
    setValidationResult(null)
  }

  const handleBucketChange = (e) => {
    const bucket = buckets.find(b => b.name === e.target.value)
    onChange({
      ...config,
      sourceType,
      bucket,
      dataset: null,
      selectedPaths: [],
      fileCount: 0,
      totalSize: ''
    })
    setValidationResult(null)
  }

  const handleDatasetChange = (e) => {
    const dataset = datasets.find(d => d.path === e.target.value)
    onChange({
      ...config,
      sourceType,
      dataset,
      selectedPaths: [],
      fileCount: 0,
      totalSize: ''
    })
    setSelectedPaths(new Set())
    setExpandedPaths(new Set())
    setValidationResult(null)
  }

  const handleToggleSelect = useCallback((path, selected, isFolder) => {
    setSelectedPaths(prev => {
      const next = new Set(prev)
      if (selected) {
        next.add(path)
      } else {
        next.delete(path)
      }
      return next
    })
  }, [])

  const handleExpand = useCallback((path, expanded) => {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (expanded) {
        next.add(path)
      } else {
        next.delete(path)
      }
      return next
    })
  }, [])

  const handleSelectAll = () => {
    if (!browserData) return
    const allPaths = new Set()
    const collectPaths = (items) => {
      items.forEach(item => {
        allPaths.add(item.path)
      })
    }
    collectPaths([...browserData.folders, ...browserData.files])
    setSelectedPaths(allPaths)
  }

  const handleClearSelection = () => {
    setSelectedPaths(new Set())
  }

  const handleValidateSelection = async () => {
    if (selectedPaths.size === 0 || !config.bucket) return
    
    setValidating(true)
    setValidationResult(null)
    
    try {
      const result = await validatePatterns(
        sourceType,
        config.bucket.name,
        Array.from(selectedPaths)
      )
      setValidationResult(result)
    } catch (err) {
      setValidationResult({
        allValid: false,
        totalFiles: 0,
        error: err.message
      })
    } finally {
      setValidating(false)
    }
  }

  const currentPlugin = plugins.find(p => p.id === sourceType)

  return (
    <div>
      <h2 className="panel-title">Source</h2>

      {error && <div className="error-message">{error}</div>}

      {/* Data Source Type Selector */}
      <div className="form-group">
        <label className="form-label">Data Source</label>
        <select
          className="tier-select"
          value={sourceType}
          onChange={handleSourceTypeChange}
          disabled={loading.plugins}
        >
          {loading.plugins ? (
            <option value="">Loading plugins...</option>
          ) : (
            plugins.map(plugin => (
              <option key={plugin.id} value={plugin.id} disabled={!plugin.enabled}>
                {plugin.name} {!plugin.enabled ? '(Coming Soon)' : ''}
              </option>
            ))
          )}
        </select>
        {currentPlugin && (
          <p className="tier-description">
            {currentPlugin.description} • Extensions: {currentPlugin.extensions.join(', ')}
          </p>
        )}
      </div>

      {/* Project Selection */}
      <div className="form-group">
        <label className="form-label">Google Cloud Project</label>
        <select
          className="tier-select"
          value={config.project?.id || ''}
          onChange={handleProjectChange}
          disabled={loading.projects}
        >
          <option value="">
            {loading.projects ? 'Loading projects...' : 'Select Project'}
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
        <label className="form-label">Dataset</label>
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
              {d.path} {d.hasChildren ? '(has subfolders)' : `(${d.fileCount} files)`}
            </option>
          ))}
        </select>
      </div>

      {/* Collapsible Data Browser */}
      {config.dataset && (
        <div className="data-browser-section">
          <div
            className="data-browser-header"
            onClick={() => setDataExpanded(!dataExpanded)}
          >
            <span className="collapse-icon">{dataExpanded ? '▼' : '▶'}</span>
            <span className="data-browser-title">Data Selection</span>
            {selectedPaths.size > 0 && (
              <span className="selection-badge">{selectedPaths.size} selected</span>
            )}
          </div>

          {dataExpanded && (
            <div className="data-browser-content">
              {browserLoading ? (
                <div className="browser-loading">Loading data structure...</div>
              ) : browserData ? (
                <>
                  <div className="browser-actions">
                    <button
                      type="button"
                      className="browser-btn"
                      onClick={handleSelectAll}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="browser-btn"
                      onClick={handleClearSelection}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="browser-btn"
                      onClick={handleValidateSelection}
                      disabled={selectedPaths.size === 0 || validating}
                    >
                      {validating ? 'Validating...' : 'Validate Files'}
                    </button>
                  </div>
                  
                  {/* Validation Result */}
                  {validationResult && (
                    <div className={`validation-result ${validationResult.allValid ? 'valid' : 'invalid'}`}>
                      {validationResult.error ? (
                        <span>❌ Validation error: {validationResult.error}</span>
                      ) : validationResult.allValid ? (
                        <span>✅ Found {validationResult.totalFiles.toLocaleString()} matching files</span>
                      ) : (
                        <span>⚠️ No matching files found. Check your selection.</span>
                      )}
                    </div>
                  )}
                  
                  <div className="tree-container">
                    {browserData.folders.length === 0 && browserData.files.length === 0 ? (
                      <div className="browser-empty">No data found in this dataset</div>
                    ) : (
                      <>
                        {browserData.folders.map(folder => (
                          <TreeNode
                            key={folder.path}
                            node={folder}
                            level={0}
                            selectedPaths={selectedPaths}
                            onToggleSelect={handleToggleSelect}
                            onExpand={handleExpand}
                            expandedPaths={expandedPaths}
                            bucketName={config.bucket.name}
                          />
                        ))}
                        {browserData.files.map(file => (
                          <TreeNode
                            key={file.path}
                            node={file}
                            level={0}
                            selectedPaths={selectedPaths}
                            onToggleSelect={handleToggleSelect}
                            onExpand={handleExpand}
                            expandedPaths={expandedPaths}
                            bucketName={config.bucket.name}
                          />
                        ))}
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="browser-empty">Select a dataset to browse</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Selection Summary */}
      {selectedPaths.size > 0 && (
        <div className="preset-values">
          <div className="preset-item">
            <span className="preset-label">Selected Items</span>
            <span className="preset-value">{selectedPaths.size}</span>
          </div>
          <div className="preset-item">
            <span className="preset-label">Source Type</span>
            <span className="preset-value">{currentPlugin?.name || sourceType}</span>
          </div>
          <div className="preset-item">
            <span className="preset-label">Status</span>
            <span className="preset-value">
              {validationResult?.allValid ? 'Validated ✓' : 'Ready to validate'}
            </span>
          </div>
        </div>
      )}

      {config.dataset && selectedPaths.size === 0 && (
        <div className="batch-warning">
          Select items from the data browser above
        </div>
      )}
    </div>
  )
}
