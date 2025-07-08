import { useEffect, useRef, useMemo } from 'react'
import { Vector3, StandardMaterial, Color3, Mesh, Engine, ArcRotateCamera, GizmoManager, PickingInfo, Matrix, HemisphericLight } from 'babylonjs';
import './App.css'

// Import material presets constant (value)
import { materialPresets } from './types/types'

// Import the new hook
import { useBabylonScene } from './babylon/hooks/useBabylonScene'

// Import the new AISidebar component
import { AISidebar } from './components/sidebar/AISidebar'

// Import the keyboard shortcuts hook
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

import { useSceneStore } from './state/sceneStore'
import type { SceneObject, PrimitiveType, TransformMode, ControlPointVisualization } from './types/types'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Use the new babylon scene hook
  console.log('🎮 App.tsx: Calling useBabylonScene hook with canvasRef:', canvasRef.current)
  const { sceneAPI, sceneInitialized } = useBabylonScene(canvasRef)

  // Use keyboard shortcuts hook
  useKeyboardShortcuts()

  // --- START: Reading state from the Zustand store ---
  const {
    // State properties
    sceneObjects,
    selectedObjectId,
    selectedObjectIds,
    transformMode,
    currentColor,
    isLoading,
    apiKey,
    showApiKeyInput,
    responseLog,
    wireframeMode,
    hoveredObjectId,
    multiSelectMode,
    snapToGrid,
    gridSize,
    objectLocked,
    showGrid,
    objectVisibility,
    multiSelectPivot,
    gridMesh,
    multiSelectInitialStates,
    textInput,
    sidebarCollapsed,
    activeDropdown,

    // Actions
    setSceneObjects,
    setSelectedObjectId,
    setSelectedObjectIds,
    setTransformMode,
    setCurrentColor,
    setIsLoading,
    setApiKey,
    setShowApiKeyInput,
    addToResponseLog,
    setWireframeMode,
    setShowGrid,
    setHoveredObjectId,
    setMultiSelectMode,
    setSnapToGrid,
    setGridSize,
    setObjectVisibility,
    setObjectLocked,
    setMultiSelectPivot,
    setGridMesh,
    setMultiSelectInitialStates,
    setTextInput,
    setSidebarCollapsed,
    setActiveDropdown,
    setResponseLog,
    clearSelection,
    clearAllObjects,
    updateObject,
    addObject,
    removeObject,
    
    // Getters from store (for checking object status)
    hasSelection,
    isObjectLocked,
    isObjectVisible,
  } = useSceneStore();
  // --- END: Reading state from the Zustand store ---

  // ---------------------------------------------------------------------------
  // Helper utils (state write) & placeholders for removed NURBS functionality
  // ---------------------------------------------------------------------------

  /**
   * Functional updater helper that keeps the ergonomic `(prev) => newArray` style
   * while complying with the store API which expects the full object array.
   */
  // Scene objects are now managed by the useBabylonScene hook

  // The application no longer supports NURBS control-points.  We define inert
  // placeholders so that the few remaining references compile but have no
  // runtime effect.
  const selectedControlPointMesh: Mesh | null = null
  const selectedControlPointIndex: number | null = null
  // No-op stubs replacing the old setters
  const setSelectedControlPointMesh = (_?: any) => {}
  const setSelectedControlPointIndex = (_?: any) => {}

  // OpenAI client initialization is now handled by the AI service

  // now use getters from the store
  // something is wrong here....
  const selectedObject = useMemo(() => 
    sceneObjects.find(obj => obj.id === selectedObjectId), 
    [sceneObjects, selectedObjectId]
  );

  const selectedObjects = useMemo(() => 
    sceneObjects.filter(obj => selectedObjectIds.includes(obj.id)), 
    [sceneObjects, selectedObjectIds]
  );

  // Boolean flag for current selection
  const hasSelectionFlag = hasSelection();

  // Scene synchronization is now handled by the useBabylonScene hook

  // Track canvas ref changes
  useEffect(() => {
    console.log('🎯 App.tsx: Canvas ref changed:', {
      hasCanvas: !!canvasRef.current,
      showApiKeyInput,
      canvasElement: canvasRef.current
    })
  }, [canvasRef.current, showApiKeyInput])
  
  // Keyboard shortcuts are now handled by the useKeyboardShortcuts hook

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeDropdown && !(event.target as Element).closest('.toolbar-item')) {
        setActiveDropdown(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [activeDropdown])

  // Gizmo management is now handled by the useGizmoManager hook in useBabylonScene

  // Visual grid, multi-select pivot, and object selection feedback are now handled by the useBabylonScene hook

  // Handle NURBS control point visualizations when selection changes
  /*
  useEffect(() => {
    if (selectedObject && selectedObject.isNurbs && selectedObject.verbData) {
      // Create control point visualizations for selected NURBS object
      createControlPointVisualizations(selectedObject.id, selectedObject.verbData)
    } else {
      // Remove all control point visualizations when no NURBS object is selected
      controlPointVisualizations.forEach(viz => {
        removeControlPointVisualizations(viz.objectId)
      })
      setSelectedControlPointIndex(null)
      setSelectedControlPointMesh(null)
    }
  }, [selectedObjectId, selectedObject?.isNurbs])
  */

  const toggleDropdown = (dropdownName: string) => {
    setActiveDropdown(activeDropdown === dropdownName ? null : dropdownName)
  }

  // Object click and hover handling is now managed directly in the useBabylonScene hook

  const createPrimitive = (type: Exclude<PrimitiveType, 'nurbs'>) => {
    if (!sceneInitialized) return;
    
    const newId = `${type}-${Date.now()}`;
    const position = new Vector3(Math.random() * 4 - 2, 2, Math.random() * 4 - 2);

    const newObj: SceneObject = {
      id: newId, 
      type, 
      position: position,
      scale: new Vector3(1, 1, 1), 
      rotation: new Vector3(0, 0, 0),
      color: currentColor, 
      isNurbs: false
    };

    addObject(newObj);
    setSelectedObjectId(newId);
    setActiveDropdown(null);
  }

  const duplicateObject = () => {
    if (!selectedObject || !sceneInitialized) return

    const newId = `${selectedObject.type}-${Date.now()}`
    
    console.log('Duplicating object:', selectedObject.id, 'as', newId)

    const newObj: SceneObject = {
      id: newId,
      type: selectedObject.type,
      position: selectedObject.position.clone().add(new Vector3(2, 0, 0)),
      scale: selectedObject.scale.clone(),
      rotation: selectedObject.rotation.clone(),
      color: selectedObject.color,
      isNurbs: selectedObject.isNurbs,
      verbData: selectedObject.isNurbs ? selectedObject.verbData : undefined
    }

    addObject(newObj);
    setSelectedObjectId(newId);
    setActiveDropdown(null);
  }

  const deleteSelectedObject = () => {
    if (!selectedObject) return

    console.log('🗑️ Deleting object:', selectedObject.id)
    
    removeObject(selectedObject.id)
    setSelectedObjectId(null)
    setActiveDropdown(null)
    console.log('✅ Deleted object')
  }


  // TODO: fix store useage here
  const changeSelectedObjectColor = (color: string) => {
    const objectsToColor = selectedObjectId ? [selectedObjectId] : selectedObjectIds;
    if (objectsToColor.length === 0) return;

    objectsToColor.forEach(id => {
        updateObject(id, { color });
    });
  }

  const applyCurrentColorToSelection = () => {
    changeSelectedObjectColor(currentColor)
    setActiveDropdown(null)
  }

  const applyPresetColor = (color: string) => {
    setCurrentColor(color)
    changeSelectedObjectColor(color)
  }

  const setCameraView = (view: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'home') => {
    sceneAPI.setCameraView(view)
    setActiveDropdown(null)
    console.log('📷 Camera set to:', view)
  }

  const toggleWireframe = () => {
    const newWireframeMode = !wireframeMode
    setWireframeMode(newWireframeMode)

    sceneObjects.forEach(obj => {
      if (obj.mesh?.material && obj.type !== 'ground') {
        const material = obj.mesh.material as StandardMaterial
        material.wireframe = newWireframeMode
      }
    })
    
    console.log('🔲 Wireframe mode:', newWireframeMode ? 'ON' : 'OFF')
  }



  // Snap position to grid
  const snapToGridPosition = (position: Vector3): Vector3 => {
    if (!snapToGrid) return position
    return new Vector3(
      Math.round(position.x / gridSize) * gridSize,
      Math.round(position.y / gridSize) * gridSize,
      Math.round(position.z / gridSize) * gridSize
    )
  }

  // Visual grid, multi-select pivot, and transform operations are now handled by the useBabylonScene hook

  // Select all objects
  const selectAllObjects = () => {
    const selectableObjects = sceneObjects.filter(obj => obj.type !== 'ground' && !objectLocked[obj.id])
    setSelectedObjectIds(selectableObjects.map(obj => obj.id))
    setSelectedObjectId(null)
    setActiveDropdown(null)
    console.log('🔍 Selected all objects')
  }

  // Deselect all objects
  const deselectAllObjects = () => {
    setSelectedObjectId(null)
    setSelectedObjectIds([])
    setActiveDropdown(null)
    console.log('🔍 Deselected all objects')
  }

  // Invert selection
  const invertSelection = () => {
    const selectableObjects = sceneObjects.filter(obj => obj.type !== 'ground' && !objectLocked[obj.id])
    const currentlySelected = selectedObjectIds
    const newSelection = selectableObjects.filter(obj => !currentlySelected.includes(obj.id)).map(obj => obj.id)
    setSelectedObjectIds(newSelection)
    setSelectedObjectId(null)
    setActiveDropdown(null)
    console.log('🔍 Inverted selection')
  }



  // Reset transform for selected objects
  const resetTransforms = () => {
    const objectsToReset = selectedObjectId ? [selectedObjectId] : selectedObjectIds;
    const defaultPosition = new Vector3(0, 1, 0);
    const defaultRotation = new Vector3(0, 0, 0);
    const defaultScale = new Vector3(1, 1, 1);
    
    objectsToReset.forEach(id => {
        updateObject(id, {
            position: defaultPosition,
            rotation: defaultRotation,
            scale: defaultScale
        });
    });
  }

  // Duplicate selected objects
  const duplicateSelectedObjects = () => {
    if (!sceneInitialized) return
    
    const objectsToDuplicate = selectedObjectId ? [selectedObjectId] : selectedObjectIds
    const newObjects: SceneObject[] = []
    
    objectsToDuplicate.forEach(objectId => {
      const originalObject = sceneObjects.find(obj => obj.id === objectId)
      if (!originalObject) return
      
      const newId = `${originalObject.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Copy properties and offset position
      const offsetPosition = originalObject.position.clone().add(new Vector3(2, 0, 0))
      const snappedPosition = snapToGrid ? sceneAPI.snapToGrid(offsetPosition) : offsetPosition
      
      const newObj: SceneObject = {
        id: newId,
        type: originalObject.type,
        position: snappedPosition,
        scale: originalObject.scale.clone(),
        rotation: originalObject.rotation.clone(),
        color: originalObject.color,
        isNurbs: originalObject.isNurbs,
        verbData: originalObject.isNurbs ? originalObject.verbData : undefined
      }
      
      newObjects.push(newObj)
    })
    
    newObjects.forEach(addObject)
    
    // Select the new objects
    if (newObjects.length === 1) {
      setSelectedObjectId(newObjects[0].id)
      setSelectedObjectIds([])
    } else {
      setSelectedObjectIds(newObjects.map(obj => obj.id))
      setSelectedObjectId(null)
    }
    
    setActiveDropdown(null)
    console.log('📋 Duplicated selected objects')
  }

  // Scene initialization is now handled by the useBabylonScene hook

  // Top Toolbar Component
  const renderTopToolbar = () => (
    <div className="top-toolbar">
      <div className="toolbar-menu">
        <div className="toolbar-brand">VibeCad Pro</div>
        
        <div className="toolbar-status">
          <span className="status-item">
            <span className="status-label">Mode:</span>
            <span className={`status-value ${transformMode}`}>{transformMode.toUpperCase()}</span>
          </span>
          <span className="status-item">
            <span className="status-label">Grid:</span>
            <span className={`status-value ${snapToGrid ? 'on' : 'off'}`}>
              {snapToGrid ? `ON (${gridSize})` : 'OFF'}
            </span>
          </span>
          <span className="status-item">
            <span className="status-label">Selected:</span>
            <span className="status-value">
              {selectedObjectId ? '1' : selectedObjectIds.length}
            </span>
          </span>
        </div>
        
        {/* Transform Tools */}
        <div className="toolbar-item">
          <button 
            className={`toolbar-button ${transformMode !== 'select' ? 'active' : ''}`}
            onClick={() => toggleDropdown('transform')}
          >
            Transform <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'transform' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Transform Mode</div>
              <div className="dropdown-grid">
                <button 
                  className={`dropdown-button ${transformMode === 'select' ? 'active' : ''}`}
                  onClick={() => {
                    setTransformMode('select')
                    setActiveDropdown(null)
                  }}
                >
                  <span className="dropdown-icon">🔍</span>
                  Select
                </button>
                <button 
                  className={`dropdown-button ${transformMode === 'move' ? 'active' : ''}`}
                  onClick={() => {
                    setTransformMode('move')
                    setActiveDropdown(null)
                  }}
                >
                  <span className="dropdown-icon">⬆️</span>
                  Move
                </button>
                <button 
                  className={`dropdown-button ${transformMode === 'rotate' ? 'active' : ''}`}
                  onClick={() => {
                    setTransformMode('rotate')
                    setActiveDropdown(null)
                  }}
                >
                  <span className="dropdown-icon">🔄</span>
                  Rotate
                </button>
                <button 
                  className={`dropdown-button ${transformMode === 'scale' ? 'active' : ''}`}
                  onClick={() => {
                    setTransformMode('scale')
                    setActiveDropdown(null)
                  }}
                >
                  <span className="dropdown-icon">📏</span>
                  Scale
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Create Menu */}
        <div className="toolbar-item">
          <button 
            className="toolbar-button"
            onClick={() => toggleDropdown('create')}
          >
            Create <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'create' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Primitives</div>
              <div className="dropdown-grid">
                <button className="dropdown-button" onClick={() => createPrimitive('cube')}>
                  <span className="dropdown-icon">⬜</span>
                  Cube
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('sphere')}>
                  <span className="dropdown-icon">⚪</span>
                  Sphere
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('cylinder')}>
                  <span className="dropdown-icon">⚫</span>
                  Cylinder
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('plane')}>
                  <span className="dropdown-icon">▬</span>
                  Plane
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('torus')}>
                  <span className="dropdown-icon">🔘</span>
                  Torus
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('cone')}>
                  <span className="dropdown-icon">🔺</span>
                  Cone
                </button>
                {/* NURBS option removed */}
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Housing</div>
              <div className="dropdown-grid">
                <button className="dropdown-button" onClick={() => createPrimitive('house-basic')}>
                  <span className="dropdown-icon">🏠</span>
                  Basic House
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('house-room')}>
                  <span className="dropdown-icon">🏠</span>
                  Room
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('house-hallway')}>
                  <span className="dropdown-icon">🚪</span>
                  Hallway
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('house-roof-flat')}>
                  <span className="dropdown-icon">🏢</span>
                  Flat Roof
                </button>
                <button className="dropdown-button" onClick={() => createPrimitive('house-roof-pitched')}>
                  <span className="dropdown-icon">🏠</span>
                  Pitched Roof
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Material Menu */}
        <div className="toolbar-item">
          <button 
            className={`toolbar-button ${hasSelectionFlag ? 'active' : ''}`}
            onClick={() => toggleDropdown('material')}
          >
            Material <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'material' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">RGB Color Picker</div>
              <div className="dropdown-controls">
                <div className="control-row">
                  <span className="control-label">Color:</span>
                  <input
                    type="color"
                    value={currentColor}
                    onChange={(e) => {
                      setCurrentColor(e.target.value)
                      if (hasSelectionFlag) {
                        changeSelectedObjectColor(e.target.value)
                      }
                    }}
                    className="color-picker-large"
                  />
                </div>
                <div className="control-row">
                  <span className="control-label">Hex:</span>
                  <input
                    type="text"
                    value={currentColor}
                    onChange={(e) => {
                      const hexValue = e.target.value
                      if (/^#[0-9A-F]{6}$/i.test(hexValue)) {
                        setCurrentColor(hexValue)
                        if (hasSelectionFlag) {
                          changeSelectedObjectColor(hexValue)
                        }
                      }
                    }}
                    className="hex-input"
                    placeholder="#FFFFFF"
                  />
                </div>
                <div className="control-row">
                  <span className="control-label">RGB:</span>
                  <div className="rgb-inputs">
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={parseInt(currentColor.substr(1, 2), 16)}
                      onChange={(e) => {
                        const r = Math.max(0, Math.min(255, parseInt(e.target.value) || 0))
                        const g = parseInt(currentColor.substr(3, 2), 16)
                        const b = parseInt(currentColor.substr(5, 2), 16)
                        const newColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
                        setCurrentColor(newColor)
                        if (hasSelectionFlag) {
                          changeSelectedObjectColor(newColor)
                        }
                      }}
                      className="rgb-input"
                      placeholder="R"
                    />
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={parseInt(currentColor.substr(3, 2), 16)}
                      onChange={(e) => {
                        const r = parseInt(currentColor.substr(1, 2), 16)
                        const g = Math.max(0, Math.min(255, parseInt(e.target.value) || 0))
                        const b = parseInt(currentColor.substr(5, 2), 16)
                        const newColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
                        setCurrentColor(newColor)
                        if (hasSelectionFlag) {
                          changeSelectedObjectColor(newColor)
                        }
                      }}
                      className="rgb-input"
                      placeholder="G"
                    />
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={parseInt(currentColor.substr(5, 2), 16)}
                      onChange={(e) => {
                        const r = parseInt(currentColor.substr(1, 2), 16)
                        const g = parseInt(currentColor.substr(3, 2), 16)
                        const b = Math.max(0, Math.min(255, parseInt(e.target.value) || 0))
                        const newColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
                        setCurrentColor(newColor)
                        if (hasSelectionFlag) {
                          changeSelectedObjectColor(newColor)
                        }
                      }}
                      className="rgb-input"
                      placeholder="B"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Quick Colors</div>
              <div className="dropdown-controls">
                <div className="control-row">
                  <div className="material-chips">
                    {materialPresets.map((preset) => (
                      <button
                        key={preset.name}
                        className={`material-chip ${currentColor === preset.color ? 'active' : ''}`}
                        style={{ backgroundColor: preset.color }}
                        onClick={() => applyPresetColor(preset.color)}
                        title={preset.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {hasSelectionFlag && (
              <div className="dropdown-section">
                <div className="dropdown-section-title">
                  Apply to: {selectedObject ? selectedObject.type.toUpperCase() : `${selectedObjectIds.length} OBJECTS`}
                </div>
                <div className="dropdown-actions">
                  <button 
                    className="dropdown-action"
                    onClick={applyCurrentColorToSelection}
                  >
                    Apply Current Color
                  </button>
                  <button 
                    className="dropdown-action"
                    onClick={() => {
                      // Random color generator
                      const randomColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
                      setCurrentColor(randomColor)
                      changeSelectedObjectColor(randomColor)
                    }}
                  >
                    Random Color
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Edit Menu */}
        <div className="toolbar-item">
          <button 
            className={`toolbar-button ${hasSelectionFlag ? 'active' : ''}`}
            onClick={() => toggleDropdown('edit')}
          >
            Edit <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'edit' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Selection Mode</div>
              <div className="dropdown-actions">
                <button 
                  className={`dropdown-action ${!multiSelectMode ? 'active' : ''}`}
                  onClick={() => {
                    setMultiSelectMode(false)
                    setSelectedObjectIds([])
                    setActiveDropdown(null)
                  }}
                >
                  Single Select
                </button>
                <button 
                  className={`dropdown-action ${multiSelectMode ? 'active' : ''}`}
                  onClick={() => {
                    setMultiSelectMode(true)
                    setSelectedObjectId(null)
                    setActiveDropdown(null)
                  }}
                >
                  Multi Select
                </button>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Selection Tools</div>
              <div className="dropdown-actions">
                <button 
                  className="dropdown-action"
                  onClick={selectAllObjects}
                >
                  Select All
                </button>
                <button 
                  className="dropdown-action"
                  onClick={deselectAllObjects}
                >
                  Deselect All
                </button>
                <button 
                  className="dropdown-action"
                  onClick={invertSelection}
                >
                  Invert Selection
                </button>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Current Selection</div>
              <div className={`selection-info ${hasSelectionFlag ? 'has-selection' : ''}`}>
                {selectedObject ? (
                  <>
                    <div className="selected-object-name">{selectedObject.type.toUpperCase()}</div>
                    <div className="selected-object-details">
                      ID: {selectedObject.id}<br/>
                      Position: ({selectedObject.position.x.toFixed(1)}, {selectedObject.position.y.toFixed(1)}, {selectedObject.position.z.toFixed(1)})
                    </div>
                  </>
                ) : selectedObjectIds.length > 0 ? (
                  <>
                    <div className="selected-object-name">MULTIPLE OBJECTS</div>
                    <div className="selected-object-details">
                      {selectedObjectIds.length} objects selected<br/>
                      {selectedObjectIds.slice(0, 3).join(', ')}
                      {selectedObjectIds.length > 3 ? '...' : ''}
                    </div>
                  </>
                ) : (
                  <div className="no-selection-text">
                    {multiSelectMode ? 'Ctrl+Click objects to select multiple' : 'Click an object in the 3D scene to select it'}
                  </div>
                )}
              </div>
            </div>
            {hasSelectionFlag && (
              <div className="dropdown-section">
                <div className="dropdown-section-title">Actions</div>
                <div className="dropdown-actions">
                  <button 
                    className="dropdown-action"
                    onClick={duplicateSelectedObjects}
                  >
                    Duplicate
                  </button>
                  <button 
                    className="dropdown-action"
                    onClick={resetTransforms}
                  >
                    Reset Transform
                  </button>
                  <button 
                    className="dropdown-action danger"
                                      onClick={() => {
                    const objectsToDelete = selectedObjectId ? [selectedObjectId] : selectedObjectIds
                    
                    objectsToDelete.forEach(id => {
                      removeObject(id)
                    })
                    
                    setSelectedObjectId(null)
                    setSelectedObjectIds([])
                    setActiveDropdown(null)
                    console.log('🗑️ Deleted selected objects')
                  }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tools Menu */}
        <div className="toolbar-item">
          <button 
            className="toolbar-button"
            onClick={() => toggleDropdown('tools')}
          >
            Tools <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'tools' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Snap Settings</div>
              <div className="dropdown-controls">
                <div className="control-row">
                  <label className="control-checkbox">
                    <input
                      type="checkbox"
                      checked={snapToGrid}
                      onChange={(e) => setSnapToGrid(e.target.checked)}
                    />
                    <span>Snap to Grid</span>
                  </label>
                </div>
                <div className="control-row">
                  <span className="control-label">Grid Size:</span>
                  <input
                    type="number"
                    value={gridSize}
                    onChange={(e) => setGridSize(parseFloat(e.target.value) || 1)}
                    min="0.1"
                    max="5"
                    step="0.1"
                    className="control-input"
                  />
                </div>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Precision Tools</div>
              <div className="dropdown-actions">
                <button 
                  className="dropdown-action"
                  onClick={() => {
                    // Focus on selected object
                    if (selectedObject) {
                      sceneAPI.focusOnPosition(selectedObject.position)
                    } else if (selectedObjects.length > 0) {
                      // Focus on center of multi-selection
                      const center = selectedObjects.reduce((acc, obj) => {
                        return acc.add(obj.position)
                      }, new Vector3(0, 0, 0)).scale(1 / selectedObjects.length)
                      sceneAPI.focusOnPosition(center)
                    }
                    setActiveDropdown(null)
                  }}
                  disabled={!hasSelectionFlag}
                >
                  Focus Selected
                </button>
                <button 
                  className="dropdown-action"
                  onClick={() => {
                    // Align selected objects to grid
                    const objectsToAlign = selectedObjectId ? [selectedObjectId] : selectedObjectIds
                    objectsToAlign.forEach(id => {
                      const obj = sceneObjects.find(o => o.id === id)
                      if (obj && obj.mesh) {
                        const snappedPos = snapToGridPosition(obj.position)
                        obj.mesh.position = snappedPos
                        updateObject(id, { position: snappedPos })
                      }
                    })
                    setActiveDropdown(null)
                  }}
                  disabled={!hasSelectionFlag}
                >
                  Align to Grid
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* View Menu */}
        <div className="toolbar-item">
          <button 
            className="toolbar-button"
            onClick={() => toggleDropdown('view')}
          >
            View <span className="dropdown-arrow">▼</span>
          </button>
          <div className={`dropdown-menu ${activeDropdown === 'view' ? 'show' : ''}`}>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Camera</div>
              <div className="camera-grid">
                <button className="camera-button" onClick={() => setCameraView('front')}>Front</button>
                <button className="camera-button" onClick={() => setCameraView('back')}>Back</button>
                <button className="camera-button" onClick={() => setCameraView('left')}>Left</button>
                <button className="camera-button" onClick={() => setCameraView('right')}>Right</button>
                <button className="camera-button" onClick={() => setCameraView('top')}>Top</button>
                <button className="camera-button" onClick={() => setCameraView('bottom')}>Bottom</button>
                <button className="camera-button" onClick={() => setCameraView('home')}>Home</button>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Display</div>
              <div className="dropdown-actions">
                <button 
                  className={`dropdown-action ${wireframeMode ? 'active' : ''}`}
                  onClick={toggleWireframe}
                >
                  {wireframeMode ? '✓' : ''} Wireframe
                </button>
                <button 
                  className={`dropdown-action ${showGrid ? 'active' : ''}`}
                  onClick={() => setShowGrid(!showGrid)}
                >
                  {showGrid ? '✓' : ''} Grid
                </button>
                <button 
                  className={`dropdown-action ${snapToGrid ? 'active' : ''}`}
                  onClick={() => setSnapToGrid(!snapToGrid)}
                >
                  {snapToGrid ? '✓' : ''} Snap to Grid
                </button>
              </div>
            </div>
            <div className="dropdown-section">
              <div className="dropdown-section-title">Visibility</div>
              <div className="dropdown-actions">
                <button 
                  className="dropdown-action"
                  onClick={() => {
                    // Show all objects
                    sceneObjects.forEach(obj => {
                      if (obj.type !== 'ground') {
                        setObjectVisibility(obj.id, true)
                        if (obj.mesh) obj.mesh.isVisible = true
                      }
                    })
                    setActiveDropdown(null)
                  }}
                >
                  Show All
                </button>
                <button 
                  className="dropdown-action"
                  onClick={() => {
                    // Hide unselected objects
                    const visibleIds = selectedObjectId ? [selectedObjectId] : selectedObjectIds
                    const newVisibility: {[key: string]: boolean} = {}
                    
                    sceneObjects.forEach(obj => {
                      if (obj.type !== 'ground') {
                        const shouldBeVisible = visibleIds.includes(obj.id)
                        if (obj.mesh) {
                          obj.mesh.isVisible = shouldBeVisible
                        }
                        newVisibility[obj.id] = shouldBeVisible
                      }
                    })
                    
                    // isolate selected handler change
                    Object.entries(newVisibility).forEach(([id, vis]) => setObjectVisibility(id, vis))
                    
                    setActiveDropdown(null)
                  }}
                  disabled={!hasSelectionFlag}
                >
                  Isolate Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )



  // AI logic is now handled by the AI service in the AISidebar component

  const handleContinue = () => {
    if (apiKey.trim()) {
      console.log('🔑 API key entered, switching to main app view')
      setShowApiKeyInput(false)
    }
  }
  /*
  const clearAllObjects = () => {
    // Detach gizmo first
    if (gizmoManagerRef.current) {
      gizmoManagerRef.current.attachToMesh(null)
    }

    setSceneObjects(prev => {
      const objectsToDelete = prev.filter(obj => obj.type !== 'ground')
      console.log('🧹 Clearing all objects:', objectsToDelete.map(obj => obj.id))
      
      // Dispose all meshes
      objectsToDelete.forEach(obj => {
        if (obj.mesh) {
          obj.mesh.dispose()
        }
      })
      
      // Keep only the ground
      const remainingObjects = prev.filter(obj => obj.type === 'ground')
      return remainingObjects
    })
    setSelectedObjectId(null)
    console.log('✅ All objects cleared')
  }
  */

  // Scene initialization is now handled by the useBabylonScene hook
  // No need for manual cleanup since the hook handles it

  if (showApiKeyInput) {
    console.log('🔐 App.tsx: Rendering API key input form')
    return (
      <div className="api-key-setup">
        <div className="api-key-container">
          <h2>VibeCad - AI Scene Manipulation</h2>
          <p>Enter your OpenAI API Key to enable AI-powered 3D scene manipulation:</p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="api-key-input"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleContinue()
              }
            }}
          />
          <button 
            onClick={handleContinue}
            disabled={!apiKey.trim()}
            className="api-key-submit"
          >
            Continue
          </button>
          <p className="api-key-note">
            Your API key is stored locally and never sent to our servers.
          </p>
        </div>
      </div>
    )
  }

  console.log('🎨 App.tsx: Rendering main app with canvas')
  
  return (
    <div className="app-container">
      {renderTopToolbar()}
      <div className="main-content">
        <div className="canvas-container">
          <canvas 
            ref={canvasRef} 
            className="babylon-canvas" 
            onLoad={() => console.log('📺 Canvas onLoad event')}
          />
        </div>
        <AISidebar 
          apiKey={apiKey}
          sceneInitialized={sceneInitialized}
        />
      </div>
    </div>
  )
}

export default App
