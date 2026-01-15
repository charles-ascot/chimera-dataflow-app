import React, { useState, useEffect, useCallback } from 'react'
import { getProjects, getBuckets, getDatasets, browsePath } from '../services/api'

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
  const [projects, setProjects] = useState([])
  const [buckets, setBuckets] = useState([])
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState({ projects: false, buckets: false, datasets: false })
  const [error, setError] = useState(null)

  // Data browser state
  const [dataExpanded, setDataExpanded] = useState(false)
  const [browserData, setBrowserData] = useState(null)
  const [browserLoading, setBrowserLoading] = useState(false)
  const [selectedPaths, setSelectedPaths] = useState(new Set())
  const [expandedPaths, setExpandedPaths] = useState(new Set())

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
      selectedPaths: pathsArray,
      fileCount,
      totalSize: fileCount > 0 ? `${fileCount} items selected` : ''
    }))
  }, [selectedPaths])

  const handleProjectChange = (e) => {
    const project = projects.find(p => p.id === e.target.value)
    onChange({
      ...config,
      project,
      bucket: null,
      dataset: null,
      selectedPaths: [],
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
      selectedPaths: [],
      fileCount: 0,
      totalSize: ''
    })
  }

  const handleDatasetChange = (e) => {
    const dataset = datasets.find(d => d.path === e.target.value)
    onChange({
      ...config,
      dataset,
      selectedPaths: [],
      fileCount: 0,
      totalSize: ''
    })
    setSelectedPaths(new Set())
    setExpandedPaths(new Set())
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

  return (
    <div>
      <h2 className="panel-title">Source</h2>

      {error && <div className="error-message">{error}</div>}

      {/* Project Selection */}
      <div className="form-group">
        <label className="form-label">Google Cloud</label>
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
                  </div>
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
            <span className="preset-label">Status</span>
            <span className="preset-value">Ready to proceed</span>
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
