import { useEffect, useRef, useState, useMemo } from 'react'
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Mesh, PickingInfo, GizmoManager, PointerEventTypes, Matrix } from 'babylonjs';
import OpenAI from 'openai'
import './App.css'

// Import material presets constant (value)
import { materialPresets } from './types/types'

// types.ts content

import { useSceneStore } from './state/sceneStore'
import type { SceneObject, PrimitiveType, TransformMode, ControlPointVisualization } from './types/types'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // babylon object acccess will be moved later. Not for use in zustand store.
  const sceneRef = useRef<Scene | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const gizmoManagerRef = useRef<GizmoManager | null>(null);
  const pointerDownPosition = useRef<{ x: number, y: number } | null>(null);
  // Reference to always have the latest sceneObjects inside callbacks without
  // re-registering observers every render.
  const sceneObjectsRef = useRef<SceneObject[]>([]);

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
    sceneInitialized,
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
    setSceneInitialized,
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
  const updateSceneObjects = (updater: (objects: SceneObject[]) => SceneObject[]) => {
    setSceneObjects(updater(sceneObjectsRef.current))
  }

  // The application no longer supports NURBS control-points.  We define inert
  // placeholders so that the few remaining references compile but have no
  // runtime effect.
  const selectedControlPointMesh: Mesh | null = null
  const selectedControlPointIndex: number | null = null
  // No-op stubs replacing the old setters
  const setSelectedControlPointMesh = (_?: any) => {}
  const setSelectedControlPointIndex = (_?: any) => {}

  // Initialize OpenAI client
  const openai = apiKey ? new OpenAI({ apiKey, dangerouslyAllowBrowser: true }) : null

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

  // Keep sceneObjectsRef synchronized with sceneObjects state
  useEffect(() => {
    sceneObjectsRef.current = sceneObjects
  }, [sceneObjects])

  // Add keyboard shortcuts
  
  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

      switch (event.key.toLowerCase()) {
        case 'g':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setSnapToGrid(!snapToGrid);
          }
          break;
        case 'delete':
        case 'backspace':
          if (hasSelectionFlag) {
            event.preventDefault();
            const objectsToDelete = selectedObjectId ? [selectedObjectId] : selectedObjectIds;
            if (gizmoManagerRef.current) {
              gizmoManagerRef.current.attachToMesh(null);
            }
            objectsToDelete.forEach(id => removeObject(id));
            clearSelection();
          }
          break;
        case 'r': setTransformMode('rotate'); break;
        case 's': setTransformMode('scale'); break;
        case 'm': setTransformMode('move'); break;
        case 'escape':
          clearSelection();
          setActiveDropdown(null);
          break;
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [snapToGrid, hasSelectionFlag, selectedObjectId, selectedObjectIds, setSnapToGrid, setTransformMode, clearSelection, removeObject]);

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

  // Gizmo and selection management

  // TODO: remove NURBS specific code from here (for now)
  useEffect(() => {
    const gizmoManager = gizmoManagerRef.current
    const selectedMesh = selectedObject?.mesh
    const isMultiSelect = selectedObjectIds.length > 0
    
    if (!gizmoManager) return

    // Observers need to be cleaned up
    let positionObserver: any = null
    let rotationObserver: any = null
    let scaleObserver: any = null

    // Detach from any previous mesh and disable all gizmos
    gizmoManager.attachToMesh(null)
    gizmoManager.positionGizmoEnabled = false
    gizmoManager.rotationGizmoEnabled = false
    gizmoManager.scaleGizmoEnabled = false
    gizmoManager.boundingBoxGizmoEnabled = false

    // Choose which mesh to attach gizmo to (priority order)
    let targetMesh: Mesh | null = null
    if (isMultiSelect && multiSelectPivot) {
      targetMesh = multiSelectPivot
      console.log('Attaching gizmo to multi-select pivot')
    } else if (selectedMesh) {
      targetMesh = selectedMesh
      console.log('Attaching gizmo to single selected mesh:', selectedObject?.id)
    } else {
      console.log('No target mesh for gizmo attachment')
    }

    if (targetMesh) {
      // A mesh is selected, so attach gizmos and add observers
      gizmoManager.attachToMesh(targetMesh)
      console.log('Gizmo attached to mesh, enabling mode:', transformMode)

      // Enable the correct gizmo based on transform mode
      switch (transformMode) {
        case 'move':
          gizmoManager.positionGizmoEnabled = true
          break
        case 'rotate':
          gizmoManager.rotationGizmoEnabled = true
          break
        case 'scale':
          gizmoManager.scaleGizmoEnabled = true
          break
        case 'select':
          gizmoManager.boundingBoxGizmoEnabled = true
          break
      }

      // Add observers to update state after a gizmo drag
      const { positionGizmo, rotationGizmo, scaleGizmo } = gizmoManager.gizmos

      if (positionGizmo) {
        positionObserver = positionGizmo.onDragEndObservable.add(() => {
          if (isMultiSelect && multiSelectPivot) {
            // Apply transform to all selected objects
            applyTransformToMultipleObjects(
              multiSelectPivot.position,
              multiSelectPivot.rotation,
              multiSelectPivot.scaling
            )
          } else if (selectedMesh && selectedObject) {
            // Single object transform
            const newPosition = snapToGridPosition(selectedMesh.position.clone())
            selectedMesh.position = newPosition
            updateObject(selectedObject.id, { position: newPosition })
          }
        })
      }

      if (rotationGizmo) {
        rotationObserver = rotationGizmo.onDragEndObservable.add(() => {
          if (isMultiSelect && multiSelectPivot) {
            // Apply transform to all selected objects
            applyTransformToMultipleObjects(
              multiSelectPivot.position,
              multiSelectPivot.rotation,
              multiSelectPivot.scaling
            )
          } else if (selectedMesh && selectedObject) {
            updateObject(selectedObject.id, { rotation: selectedMesh.rotation.clone() })
          }
        })
      }
      if (scaleGizmo) {
        scaleObserver = scaleGizmo.onDragEndObservable.add(() => {
          if (isMultiSelect && multiSelectPivot) {
            // Apply transform to all selected objects
            applyTransformToMultipleObjects(
              multiSelectPivot.position,
              multiSelectPivot.rotation,
              multiSelectPivot.scaling
            )
          } else if (selectedMesh && selectedObject) {
            updateObject(selectedObject.id, { scale: selectedMesh.scaling.clone() })
          }
        })
      }
    }
    
    // Cleanup function to remove observers
    return () => {
      const { positionGizmo, rotationGizmo, scaleGizmo } = gizmoManager.gizmos
      if (positionGizmo && positionObserver) {
        positionGizmo.onDragEndObservable.remove(positionObserver)
      }
      if (rotationGizmo && rotationObserver) {
        rotationGizmo.onDragEndObservable.remove(rotationObserver)
      }
      if (scaleGizmo && scaleObserver) {
        scaleGizmo.onDragEndObservable.remove(scaleObserver)
      }
    }
  }, [selectedObject, selectedObjectIds, transformMode, multiSelectPivot, multiSelectInitialStates, selectedControlPointMesh])

  // Create/update visual grid when snap settings change
  useEffect(() => {
    createVisualGrid()
  }, [snapToGrid, gridSize])

  // Create/update multi-select pivot when selection changes
  useEffect(() => {
    createMultiSelectPivot()
  }, [selectedObjectIds, sceneObjects])

  // Handle object selection visual feedback
  useEffect(() => {
    if (!sceneRef.current) return

    // Reset all non-ground objects to a default state
    sceneObjects.forEach(obj => {
      if (obj.mesh?.material && obj.type !== 'ground') {
        const material = obj.mesh.material as StandardMaterial
        
        // Check if object is locked
        if (objectLocked[obj.id]) {
          material.emissiveColor = new Color3(0.8, 0.4, 0.4) // Red tint for locked objects
        } else {
          // Subtle glow to indicate all objects are interactive
          material.emissiveColor = new Color3(0.1, 0.1, 0.1)
        }
      }
    })

    // Add hover effect
    if (hoveredObjectId && hoveredObjectId !== selectedObjectId && !selectedObjectIds.includes(hoveredObjectId)) {
      const hoveredObject = sceneObjects.find(obj => obj.id === hoveredObjectId)
      if (hoveredObject?.mesh?.material && !objectLocked[hoveredObjectId]) {
        const material = hoveredObject.mesh.material as StandardMaterial
        material.emissiveColor = new Color3(0.3, 0.6, 0.9) // Blue hover
      }
    }

    // Add strong highlight to the single selected object
    if (selectedObject?.mesh?.material) {
      const material = selectedObject.mesh.material as StandardMaterial
      material.emissiveColor = new Color3(0.6, 1.0, 1.0) // Bright cyan selection
    }

    // Add highlight to multi-selected objects
    selectedObjectIds.forEach(objectId => {
      const selectedObj = sceneObjects.find(obj => obj.id === objectId)
      if (selectedObj?.mesh?.material) {
        const material = selectedObj.mesh.material as StandardMaterial
        material.emissiveColor = new Color3(1.0, 0.8, 0.2) // Orange for multi-selection
      }
    })
  }, [selectedObjectId, selectedObjectIds, hoveredObjectId, sceneObjects, objectLocked])

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

  const handleObjectClick = (pickInfo: PickingInfo, isCtrlHeld: boolean = false) => {
    console.log('[handleObjectClick] Received pick info:', pickInfo);

    if (pickInfo.hit && pickInfo.pickedMesh) {
      console.log(`[handleObjectClick] Hit registered on mesh: ${pickInfo.pickedMesh.name}`);
      
      // Check if this is a control point
      /*
      if (pickInfo.pickedMesh.metadata?.isControlPoint) {
        handleControlPointClick(pickInfo.pickedMesh as Mesh)
        return
      }
      */

      // Clear control point selection when clicking on something else
      setSelectedControlPointIndex(null)
      setSelectedControlPointMesh(null)
      
      // Find the object by comparing the mesh name (which we use as an ID)
      // Use the ref to get the current sceneObjects array
      const clickedObject = sceneObjectsRef.current.find(obj => obj.id === pickInfo.pickedMesh?.name)

      if (clickedObject) {
        console.log(`[handleObjectClick] Found corresponding scene object:`, clickedObject);
      } else {
        console.log(`[handleObjectClick] No corresponding scene object found for mesh: ${pickInfo.pickedMesh.name}`);
        console.log(`[handleObjectClick] Current scene objects:`, sceneObjectsRef.current.map(obj => obj.id));
      }

      if (clickedObject && clickedObject.type !== 'ground') {
        // Check if object is locked
        if (objectLocked[clickedObject.id]) {
          console.log(`[handleObjectClick] Object is locked: ${clickedObject.id}`);
          return;
        }

        if (multiSelectMode || isCtrlHeld) {
          // Multi-select mode
          const newIds = selectedObjectIds.includes(clickedObject.id)
            ? selectedObjectIds.filter(id => id !== clickedObject.id)
            : [...selectedObjectIds, clickedObject.id];
          setSelectedObjectIds(newIds);
          // Clear single selection when using multi-select
          setSelectedObjectId(null);
        } else {
          // Single select mode
          console.log(`[handleObjectClick] Selecting object: ${clickedObject.id}`);
          setSelectedObjectId(clickedObject.id);
          setSelectedObjectIds([]); // Clear multi-selection
        }
        
        // Close any open dropdowns when selecting an object
        setActiveDropdown(null)
      } else {
        // If the ground or an unmanaged mesh is clicked, deselect everything.
        console.log(`[handleObjectClick] Clicked ground or unmanaged mesh. Deselecting.`);
        setSelectedObjectId(null)
        setSelectedObjectIds([]);
      }
    } else {
      // If empty space is clicked, deselect everything.
      console.log('[handleObjectClick] Clicked empty space. Deselecting.');
      setSelectedObjectId(null)
      setSelectedObjectIds([]);
      setSelectedControlPointIndex(null)
      setSelectedControlPointMesh(null)
    }
  }

  const handleObjectHover = (pickInfo: PickingInfo) => {
    if (pickInfo.hit && pickInfo.pickedMesh) {
      const hoveredObject = sceneObjectsRef.current.find(obj => obj.mesh === pickInfo.pickedMesh)
      if (hoveredObject && hoveredObject.type !== 'ground') {
        setHoveredObjectId(hoveredObject.id)
        // Change cursor to pointer to indicate clickable
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'pointer'
        }
      } else {
        setHoveredObjectId(null)
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'default'
        }
      }
    } else {
      setHoveredObjectId(null)
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'default'
      }
    }
  }

  const createPrimitive = (type: Exclude<PrimitiveType, 'nurbs'>) => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const newId = `${type}-${Date.now()}`;
    let newMesh: Mesh;

    switch (type) {
      case 'cube': newMesh = MeshBuilder.CreateBox(newId, { size: 2 }, scene); break;
      case 'sphere': newMesh = MeshBuilder.CreateSphere(newId, { diameter: 2 }, scene); break;
      case 'cylinder': newMesh = MeshBuilder.CreateCylinder(newId, { diameter: 2, height: 2 }, scene); break;
      case 'plane': newMesh = MeshBuilder.CreatePlane(newId, { size: 2 }, scene); break;
      case 'torus': newMesh = MeshBuilder.CreateTorus(newId, { diameter: 2, thickness: 0.5 }, scene); break;
      case 'cone': newMesh = MeshBuilder.CreateCylinder(newId, { diameterTop: 0, diameterBottom: 2, height: 2 }, scene); break;
      default: return;
    }

    newMesh.position = new Vector3(Math.random() * 4 - 2, 2, Math.random() * 4 - 2);
    const material = new StandardMaterial(`${newId}-material`, scene);
    material.diffuseColor = Color3.FromHexString(currentColor);
    newMesh.material = material;
    newMesh.isPickable = true;

    const newObj: SceneObject = {
      id: newId, type, position: newMesh.position.clone(),
      scale: new Vector3(1, 1, 1), rotation: new Vector3(0, 0, 0),
      color: currentColor, mesh: newMesh, isNurbs: false
    };

    addObject(newObj);
    setSelectedObjectId(newId);
    setActiveDropdown(null);
  }

  const duplicateObject = () => {
    if (!selectedObject || !sceneRef.current) return

    const scene = sceneRef.current
    const newId = `${selectedObject.type}-${Date.now()}`
    
    console.log('Duplicating object:', selectedObject.id, 'as', newId)

    let newMesh: Mesh
    switch (selectedObject.type) {
      case 'cube':
        newMesh = MeshBuilder.CreateBox(newId, { size: 2 }, scene)
        break
      case 'sphere':
        newMesh = MeshBuilder.CreateSphere(newId, { diameter: 2 }, scene)
        break
      case 'cylinder':
        newMesh = MeshBuilder.CreateCylinder(newId, { diameter: 2, height: 2 }, scene)
        break
      case 'plane':
        newMesh = MeshBuilder.CreatePlane(newId, { size: 2 }, scene)
        break
      case 'torus':
        newMesh = MeshBuilder.CreateTorus(newId, { diameter: 2, thickness: 0.5 }, scene)
        break
      case 'cone':
        newMesh = MeshBuilder.CreateCylinder(newId, { diameterTop: 0, diameterBottom: 2, height: 2 }, scene)
        break
      default:
        return
    }

    // Copy properties from selected object
    newMesh.position = selectedObject.position.clone().add(new Vector3(2, 0, 0))
    newMesh.scaling = selectedObject.scale.clone()
    newMesh.rotation = selectedObject.rotation.clone()
    
    const material = new StandardMaterial(`${newId}-material`, scene)
    material.diffuseColor = Color3.FromHexString(selectedObject.color)
    newMesh.material = material
    
    // Make the mesh pickable and ready for selection
    newMesh.isPickable = true
    newMesh.checkCollisions = false

    const newObj: SceneObject = {
      id: newId,
      type: selectedObject.type,
      position: newMesh.position.clone(),
      scale: newMesh.scaling.clone(),
      rotation: newMesh.rotation.clone(),
      color: selectedObject.color,
      mesh: newMesh,
      isNurbs: selectedObject.isNurbs,
      verbData: selectedObject.isNurbs ? selectedObject.verbData : undefined
    }

    // REFACTOR
    addObject(newObj);
    setSelectedObjectId(newId);
    setActiveDropdown(null);
  }

  // TODO: fix store useage here
  const deleteSelectedObject = () => {
    if (!selectedObject) return

    console.log('🗑️ Deleting object:', selectedObject.id)
    
    // Detach gizmo first
    if (gizmoManagerRef.current) {
      gizmoManagerRef.current.attachToMesh(null)
    }

    if (selectedObject.mesh) {
      selectedObject.mesh.dispose()
    }
    
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
        const obj = sceneObjects.find(o => o.id === id);
        if(obj?.mesh?.material) {
            (obj.mesh.material as StandardMaterial).diffuseColor = Color3.FromHexString(color);
        }
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
    if (!cameraRef.current) return

    const camera = cameraRef.current
    const radius = camera.radius

    switch (view) {
      case 'front':
        camera.setTarget(Vector3.Zero())
        camera.setPosition(new Vector3(0, 0, radius))
        break
      case 'back':
        camera.setTarget(Vector3.Zero())
        camera.setPosition(new Vector3(0, 0, -radius))
        break
      case 'left':
        camera.setTarget(Vector3.Zero())
        camera.setPosition(new Vector3(-radius, 0, 0))
        break
      case 'right':
        camera.setTarget(Vector3.Zero())
        camera.setPosition(new Vector3(radius, 0, 0))
        break
      case 'top':
        camera.setTarget(Vector3.Zero())
        camera.setPosition(new Vector3(0, radius, 0))
        break
      case 'bottom':
        camera.setTarget(Vector3.Zero())
        camera.setPosition(new Vector3(0, -radius, 0))
        break
      case 'home':
        camera.setTarget(Vector3.Zero())
        camera.setPosition(new Vector3(10, 10, 10))
        break
    }
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

  const selectObjectById = (objectId: string) => {
    const object = sceneObjects.find(obj => obj.id === objectId)
    if (object) {
      setSelectedObjectId(objectId)
      setSelectedObjectIds([]) // Clear multi-selection
      console.log('📋 Selected from sidebar:', objectId)
      
      // Close any open dropdowns
      setActiveDropdown(null)
    }
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

  // Create visual grid
  const createVisualGrid = () => {
    if (!sceneRef.current) return

    const scene = sceneRef.current
    
    // Remove existing grid
    if (gridMesh) {
      gridMesh.dispose()
      setGridMesh(null)
    }

    if (!snapToGrid) return

    // Create grid lines
    const gridExtent = 20 // Grid extends from -20 to 20
    const lines = []
    
    // Vertical lines (along Z-axis)
    for (let i = -gridExtent; i <= gridExtent; i += gridSize) {
      lines.push([
        new Vector3(i, 0, -gridExtent),
        new Vector3(i, 0, gridExtent)
      ])
    }
    
    // Horizontal lines (along X-axis)
    for (let i = -gridExtent; i <= gridExtent; i += gridSize) {
      lines.push([
        new Vector3(-gridExtent, 0, i),
        new Vector3(gridExtent, 0, i)
      ])
    }

    // Create line system
    const lineSystem = MeshBuilder.CreateLineSystem('grid', { lines }, scene)
    lineSystem.color = new Color3(0.5, 0.5, 0.5)
    lineSystem.alpha = 0.3
    lineSystem.isPickable = false
    
    setGridMesh(lineSystem)
  }

  // Create multi-select pivot point
  const createMultiSelectPivot = () => {
    console.log('Creating multi-select pivot, selectedObjectIds:', selectedObjectIds)
    
    if (!sceneRef.current || selectedObjectIds.length === 0) {
      console.log('Removing multi-select pivot: no scene or no selected objects')
      // Remove existing pivot
      if (multiSelectPivot) {
        multiSelectPivot.dispose()
        setMultiSelectPivot(null)
      }
      setMultiSelectInitialStates({})
      return
    }

    const scene = sceneRef.current
    const selectedObjs = sceneObjects.filter(obj => selectedObjectIds.includes(obj.id))
    
    if (selectedObjs.length === 0) {
      console.warn('No matching scene objects found for selected IDs')
      return
    }

    console.log(`Creating pivot for ${selectedObjs.length} objects:`, selectedObjs.map(obj => obj.id))

    // Calculate center point of selected objects
    const center = selectedObjs.reduce((acc, obj) => {
      return acc.add(obj.position)
    }, new Vector3(0, 0, 0)).scale(1 / selectedObjs.length)

    console.log('Calculated pivot center:', center.toString())

    // Remove existing pivot
    if (multiSelectPivot) {
      console.log('Disposing existing pivot')
      multiSelectPivot.dispose()
    }

    // Create invisible pivot mesh
    const pivot = MeshBuilder.CreateSphere('multi-select-pivot', { diameter: 0.1 }, scene)
    pivot.position = center
    pivot.rotation = new Vector3(0, 0, 0)
    pivot.scaling = new Vector3(1, 1, 1)
    pivot.isVisible = false
    pivot.isPickable = false
    
    // Store initial states of all selected objects
    const initialStates: typeof multiSelectInitialStates = {}
    selectedObjs.forEach(obj => {
      const relativePos = obj.position.subtract(center)
      initialStates[obj.id] = {
        position: obj.position.clone(),
        rotation: obj.rotation.clone(),
        scale: obj.scale.clone(),
        relativePosition: relativePos
      }
      console.log(`Object ${obj.id} relative position:`, relativePos.toString())
    })
    
    setMultiSelectPivot(pivot)
    setMultiSelectInitialStates(initialStates)
    console.log('Multi-select pivot created successfully')
  }

  // Apply transform to multiple objects
  // TODO: fix store useage here
  const applyTransformToMultipleObjects = (pivotPosition: Vector3, pivotRotation: Vector3, pivotScale: Vector3) => {
    // This function can now be simplified or moved into the store as a more complex action
    selectedObjectIds.forEach(id => {
        const initialState = multiSelectInitialStates[id];
        if(!initialState) return;

        let newPosition = initialState.relativePosition.clone().multiply(pivotScale);
        const rotationMatrix = new Matrix();
        Matrix.RotationYawPitchRollToRef(pivotRotation.y, pivotRotation.x, pivotRotation.z, rotationMatrix);
        newPosition = Vector3.TransformCoordinates(newPosition, rotationMatrix).add(pivotPosition);
        
        const newRotation = initialState.rotation.add(pivotRotation);
        const newScale = initialState.scale.multiply(pivotScale);

        updateObject(id, { position: newPosition, rotation: newRotation, scale: newScale });
    });
  }

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

  // Toggle object visibility
  const toggleObjectVisibility = (objectId: string) => {
    const isCurrentlyVisible = isObjectVisible(objectId);
    setObjectVisibility(objectId, !isCurrentlyVisible);
    const obj = sceneObjects.find(o => o.id === objectId);
    if(obj?.mesh) {
        obj.mesh.isVisible = !isCurrentlyVisible;
    }
  }

  // Toggle object lock
  const toggleObjectLock = (objectId: string) => {
    const isCurrentlyLocked = isObjectLocked(objectId);
    setObjectLocked(objectId, !isCurrentlyLocked);
    if (!isCurrentlyLocked) {
        clearSelection();
    }
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
    if (!sceneRef.current) return
    
    const objectsToDuplicate = selectedObjectId ? [selectedObjectId] : selectedObjectIds
    const scene = sceneRef.current
    const newObjects: SceneObject[] = []
    
    objectsToDuplicate.forEach(objectId => {
      const originalObject = sceneObjects.find(obj => obj.id === objectId)
      if (!originalObject) return
      
      const newId = `${originalObject.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      let newMesh: Mesh
      
      switch (originalObject.type) {
        case 'cube':
          newMesh = MeshBuilder.CreateBox(newId, { size: 2 }, scene)
          break
        case 'sphere':
          newMesh = MeshBuilder.CreateSphere(newId, { diameter: 2 }, scene)
          break
        case 'cylinder':
          newMesh = MeshBuilder.CreateCylinder(newId, { diameter: 2, height: 2 }, scene)
          break
        case 'plane':
          newMesh = MeshBuilder.CreatePlane(newId, { size: 2 }, scene)
          break
        case 'torus':
          newMesh = MeshBuilder.CreateTorus(newId, { diameter: 2, thickness: 0.5 }, scene)
          break
              case 'cone':
        newMesh = MeshBuilder.CreateCylinder(newId, { diameterTop: 0, diameterBottom: 2, height: 2 }, scene)
        break
      default:
        return
    }
      
      // Copy properties and offset position
      const offsetPosition = originalObject.position.clone().add(new Vector3(2, 0, 0))
      newMesh.position = snapToGridPosition(offsetPosition)
      newMesh.scaling = originalObject.scale.clone()
      newMesh.rotation = originalObject.rotation.clone()
      
      const material = new StandardMaterial(`${newId}-material`, scene)
      material.diffuseColor = Color3.FromHexString(originalObject.color)
      newMesh.material = material
      newMesh.isPickable = true
      newMesh.checkCollisions = false
      
      const newObj: SceneObject = {
        id: newId,
        type: originalObject.type,
        position: newMesh.position.clone(),
        scale: newMesh.scaling.clone(),
        rotation: newMesh.rotation.clone(),
        color: originalObject.color,
        mesh: newMesh,
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

  const initializeBabylonScene = () => {
    if (!canvasRef.current || sceneInitialized) return

    try {
      console.log('🚀 Initializing Babylon.js scene...')
      
      const canvas = canvasRef.current
      const engine = new Engine(canvas, true)
      const scene = new Scene(engine)
      
      engineRef.current = engine
      sceneRef.current = scene

      // Create camera
      const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2.5, 10, Vector3.Zero(), scene)
      camera.attachControl(canvas, true)
      cameraRef.current = camera

      // Create gizmo manager for transform tools
      const gizmoManager = new GizmoManager(scene)
      gizmoManager.positionGizmoEnabled = false
      gizmoManager.rotationGizmoEnabled = false
      gizmoManager.scaleGizmoEnabled = false
      gizmoManager.boundingBoxGizmoEnabled = false
      gizmoManager.usePointerToAttachGizmos = false
      gizmoManagerRef.current = gizmoManager

      // Create light
      const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene)
      light.intensity = 0.7

      // Create initial cube
      const cube = MeshBuilder.CreateBox('cube-initial', { size: 2 }, sceneRef.current!);
      cube.position.y = 1
      const cubeMaterial = new StandardMaterial('cubeMaterial', scene)
      cubeMaterial.diffuseColor = Color3.FromHexString('#ff6b6b')
      cube.material = cubeMaterial
      cube.isPickable = true
      cube.checkCollisions = false

      // Create ground
      const ground = MeshBuilder.CreateGround('ground', { width: 10, height: 10 }, sceneRef.current!);
      const groundMaterial = new StandardMaterial('groundMaterial', scene)
      groundMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5)
      ground.material = groundMaterial
      ground.isPickable = true // Ground is pickable for deselection

      // Add click handling
      scene.onPointerObservable.add((pointerInfo) => {
        switch (pointerInfo.type) {
          case PointerEventTypes.POINTERDOWN:
            console.log('[Pointer Down] Event registered.');
            // Store the starting position of the pointer
            pointerDownPosition.current = { x: scene.pointerX, y: scene.pointerY };
            break;
          
          case PointerEventTypes.POINTERUP:
            console.log('[Pointer Up] Event registered.');
            if (pointerDownPosition.current) {
                const deltaX = Math.abs(pointerDownPosition.current.x - scene.pointerX);
                const deltaY = Math.abs(pointerDownPosition.current.y - scene.pointerY);
                const clickThreshold = 5; // max pixels moved to be considered a click

                console.log(`[Pointer Up] Pointer moved by (${deltaX}, ${deltaY})`);

                if (deltaX < clickThreshold && deltaY < clickThreshold) {
                    // It's a click, not a drag
                    console.log('[Pointer Up] Movement within threshold. Processing as click.');
                    const pickInfo = pointerInfo.pickInfo;

                    if (pickInfo?.pickedMesh) {
                        console.log(`[Pointer Up] Picked mesh: ${pickInfo.pickedMesh.name}`);
                    } else {
                        console.log('[Pointer Up] No mesh picked.');
                    }
                    
                    const isGizmoClick = pickInfo?.pickedMesh?.name?.toLowerCase().includes('gizmo');
                    console.log(`[Pointer Up] Is gizmo click? ${isGizmoClick}`);

                    if (!isGizmoClick && pickInfo) {
                        // Check if Ctrl key is held for multi-select
                        const isCtrlHeld = pointerInfo.event?.ctrlKey || false;
                        handleObjectClick(pickInfo, isCtrlHeld);
                    }
                } else {
                    console.log('[Pointer Up] Movement exceeded threshold. Ignoring as drag.');
                }
            }
            // Reset for the next click
            pointerDownPosition.current = null;
            break;

          case PointerEventTypes.POINTERMOVE:
            const pickInfo = pointerInfo.pickInfo;
            if (pickInfo) {
                handleObjectHover(pickInfo);
            }
            break;
        }
      })

      const initialCube: SceneObject = {
        id: 'cube-initial', type: 'cube', position: new Vector3(0, 1, 0),
        scale: new Vector3(1, 1, 1), rotation: new Vector3(0, 0, 0),
        color: '#ff6b6b', mesh: cube, isNurbs: false
      };

      const initialGround: SceneObject = {
        id: 'ground-1', type: 'ground', position: new Vector3(0, 0, 0),
        scale: new Vector3(10, 1, 10), rotation: new Vector3(0, 0, 0),
        color: '#808080', mesh: ground, isNurbs: false
      };

      setSceneObjects([initialCube, initialGround]);

      // Animation loop
      engine.runRenderLoop(() => {
        scene.render()
      })

      // Handle resize
      const handleResize = () => {
        engine.resize()
      }
      window.addEventListener('resize', handleResize)

      setSceneInitialized(true)
      console.log('✅ Scene initialized successfully')

      // Cleanup function
      return () => {
        window.removeEventListener('resize', handleResize)
        engine.dispose()
      }
    } catch (error) {
      console.error('❌ Error initializing Babylon.js scene:', error)
    }
  }

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
                      
                      // Detach gizmo first
                      if (gizmoManagerRef.current) {
                        gizmoManagerRef.current.attachToMesh(null)
                      }
                      
                      objectsToDelete.forEach(id => {
                        const obj = sceneObjects.find(o => o.id === id)
                        if (obj?.mesh) obj.mesh.dispose()
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
                    if (selectedObject?.mesh) {
                      cameraRef.current?.setTarget(selectedObject.mesh.position)
                    } else if (selectedObjects.length > 0) {
                      // Focus on center of multi-selection
                      const center = selectedObjects.reduce((acc, obj) => {
                        return acc.add(obj.position)
                      }, new Vector3(0, 0, 0)).scale(1 / selectedObjects.length)
                      cameraRef.current?.setTarget(center)
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

  // AI Sidebar Component
  const renderAISidebar = () => (
    <div className={`ai-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="ai-sidebar-header">
        <h3>AI Assistant</h3>
        <button 
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? '◀' : '▶'}
        </button>
      </div>
      
      {!sidebarCollapsed && (
        <div className="ai-sidebar-content">
          {!sceneInitialized && (
            <div className="loading-indicator">
              <p>Initializing 3D scene...</p>
            </div>
          )}
          
          <div className="ai-control-group">
            <label htmlFor="ai-prompt">Natural Language Commands:</label>
            <textarea
              id="ai-prompt"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Try: 'move the cube to the right', 'make the cube blue', 'create a red sphere above the cube'"
              className="ai-text-input"
              disabled={isLoading || !sceneInitialized}
            />
            <button 
              onClick={handleSubmitPrompt}
              disabled={isLoading || !textInput.trim() || !sceneInitialized}
              className="ai-submit-button"
            >
              {isLoading ? 'Processing...' : 'Execute AI Command'}
            </button>
          </div>

          <div className="ai-control-group">
            <label>Scene Objects ({sceneObjects.filter(obj => obj.type !== 'ground').length}):</label>
            <div className="selection-mode-hint">
              💡 {multiSelectMode ? 'Multi-select mode: Ctrl+Click to select multiple' : 'Click objects to select them'}
            </div>
            <div className="scene-objects">
              {sceneObjects.filter(obj => obj.type !== 'ground').map(obj => {
                const isSelected = selectedObjectId === obj.id || selectedObjectIds.includes(obj.id)
                const isVisible = objectVisibility[obj.id] !== false
                const isLocked = objectLocked[obj.id] || false
                
                return (
                  <div 
                    key={obj.id} 
                    className={`scene-object ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''} ${!isVisible ? 'hidden' : ''}`}
                    onClick={() => selectObjectById(obj.id)}
                    title={`${isLocked ? '[LOCKED] ' : ''}${!isVisible ? '[HIDDEN] ' : ''}Click to select this object`}
                  >
                    <span className="object-type">{obj.type}</span>
                    <span className="object-id">{obj.id}</span>
                    <div className="object-controls">
                      <button
                        className={`object-control-btn ${isVisible ? 'visible' : 'hidden'}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleObjectVisibility(obj.id)
                        }}
                        title={isVisible ? 'Hide object' : 'Show object'}
                      >
                        {isVisible ? '👁️' : '🚫'}
                      </button>
                      <button
                        className={`object-control-btn ${isLocked ? 'locked' : 'unlocked'}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleObjectLock(obj.id)
                        }}
                        title={isLocked ? 'Unlock object' : 'Lock object'}
                      >
                        {isLocked ? '🔒' : '🔓'}
                      </button>
                    </div>
                    <div className="object-color" style={{ backgroundColor: obj.color }}></div>
                  </div>
                )
              })}
              {sceneObjects.filter(obj => obj.type !== 'ground').length === 0 && (
                <div className="no-objects">
                  No objects in scene<br/>
                  <small>Use the Create menu to add objects</small>
                </div>
              )}
            </div>
            <div className="object-stats">
              <small>
                Selected: {selectedObjectId ? 1 : selectedObjectIds.length} | 
                Hidden: {Object.values(objectVisibility).filter(v => v === false).length} | 
                Locked: {Object.values(objectLocked).filter(v => v === true).length}
              </small>
            </div>
            <button 
              onClick={clearAllObjects}
              className="clear-all-button"
              disabled={sceneObjects.filter(obj => obj.type !== 'ground').length === 0}
            >
              Clear All Objects
            </button>
          </div>

          {/* NURBS panel removed in refactor */}

          <div className="ai-control-group">
            <label>Keyboard Shortcuts:</label>
            <div className="keyboard-shortcuts">
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+A</span>
                <span className="shortcut-desc">Select All</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+I</span>
                <span className="shortcut-desc">Invert Selection</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+D</span>
                <span className="shortcut-desc">Duplicate</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+T</span>
                <span className="shortcut-desc">Reset Transform</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Ctrl+G</span>
                <span className="shortcut-desc">Toggle Snap to Grid</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">M</span>
                <span className="shortcut-desc">Move Mode</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">R</span>
                <span className="shortcut-desc">Rotate Mode</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">S</span>
                <span className="shortcut-desc">Scale Mode</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Delete</span>
                <span className="shortcut-desc">Delete Selected</span>
              </div>
              <div className="shortcut-item">
                <span className="shortcut-key">Esc</span>
                <span className="shortcut-desc">Deselect All</span>
              </div>
            </div>
          </div>

          <div className="ai-control-group">
            <label>AI Response Log:</label>
            <div className="ai-response-log">
              {responseLog.slice(-8).map((log, index) => (
                <div key={index} className={`ai-log-entry ${log.startsWith('User:') ? 'user' : log.startsWith('AI:') ? 'ai' : 'error'}`}>
                  {log}
                </div>
              ))}
              {responseLog.length === 0 && (
                <div className="ai-log-entry ai-log-empty">
                  No AI responses yet. Try entering a command above.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const describeScene = (): string => {
    const description = sceneObjects.map(obj => {
      if (obj.type === 'ground') return null
      return `${obj.type} "${obj.id}" at position (${obj.position.x.toFixed(1)}, ${obj.position.y.toFixed(1)}, ${obj.position.z.toFixed(1)}) with color ${obj.color}`
    }).filter(Boolean).join(', ')
    
    return `Current scene contains: ${description || 'just a ground plane'}`
  }

  const executeSceneCommand = (command: any) => {
    if (!sceneRef.current) return

    const scene = sceneRef.current
    
    try {
      switch (command.action) {
        case 'move':
          if (command.objectId) {
            const obj = sceneObjects.find(o => o.id === command.objectId)
            if (obj?.mesh) obj.mesh.position = new Vector3(command.x, command.y, command.z)
            updateObject(command.objectId, { position: new Vector3(command.x, command.y, command.z) })
          }
          break

        case 'color':
          if (command.objectId) {
            const obj = sceneObjects.find(o => o.id === command.objectId)
            if (obj?.mesh?.material) {
              (obj.mesh.material as StandardMaterial).diffuseColor = Color3.FromHexString(command.color)
            }
            updateObject(command.objectId, { color: command.color })
          }
          break

        case 'scale':
          if (command.objectId) {
            const obj = sceneObjects.find(o => o.id === command.objectId)
            if (obj?.mesh) obj.mesh.scaling = new Vector3(command.x, command.y, command.z)
            updateObject(command.objectId, { scale: new Vector3(command.x, command.y, command.z) })
          }
          break

        case 'create':
          const newId = `${command.type}-${Date.now()}`
          let newMesh: Mesh
          
          if (command.type === 'cube') {
            newMesh = MeshBuilder.CreateBox(newId, { size: command.size || 2 }, scene)
          } else if (command.type === 'sphere') {
            newMesh = MeshBuilder.CreateSphere(newId, { diameter: command.size || 2 }, scene)
          } else if (command.type === 'cylinder') {
            newMesh = MeshBuilder.CreateCylinder(newId, { diameter: command.size || 2, height: command.height || 2 }, scene)
          } else {
            return
          }

          newMesh.position = new Vector3(command.x || 0, command.y || 1, command.z || 0)
          const newMaterial = new StandardMaterial(`${newId}-material`, scene)
          newMaterial.diffuseColor = Color3.FromHexString(command.color || '#3498db')
          newMesh.material = newMaterial
          newMesh.isPickable = true
          newMesh.checkCollisions = false

          const newObj: SceneObject = {
            id: newId,
            type: command.type,
            position: new Vector3(command.x || 0, command.y || 1, command.z || 0),
            scale: new Vector3(1, 1, 1),
            rotation: new Vector3(0, 0, 0),
            color: command.color || '#3498db',
            mesh: newMesh,
            isNurbs: false
          }

          addObject(newObj)
          break

        case 'delete':
          console.log('Deleting object with ID:', command.objectId)
          const del = sceneObjects.find(o => o.id === command.objectId)
          if (del?.mesh) del.mesh.dispose()
          removeObject(command.objectId)
          break
      }
    } catch (error) {
      console.error('Error executing scene command:', error)
    }
  }

  const handleSubmitPrompt = async () => {
    if (!openai || !textInput.trim()) return

    setIsLoading(true)
    try {
      const sceneDescription = describeScene()
      const systemPrompt = `You are a 3D scene manipulation assistant. You can modify a Babylon.js scene based on natural language commands.

Current scene: ${sceneDescription}

Available actions:
1. move: Move an object to x,y,z coordinates
2. color: Change object color (use hex colors)
3. scale: Scale an object by x,y,z factors
4. create: Create new objects (cube, sphere, cylinder)
5. delete: Remove an object

Respond ONLY with valid JSON containing an array of commands. Example:
[{"action": "move", "objectId": "cube-1", "x": 2, "y": 1, "z": 0}]
[{"action": "color", "objectId": "cube-1", "color": "#00ff00"}]
[{"action": "create", "type": "sphere", "x": 3, "y": 2, "z": 1, "color": "#ff0000", "size": 1.5}]

Object IDs currently in scene: ${sceneObjects.map(obj => obj.id).join(', ')}`

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: textInput }
        ],
        temperature: 0.1,
        max_tokens: 500
      })

      const aiResponse = response.choices[0]?.message?.content
      if (aiResponse) {
        addToResponseLog(`User: ${textInput}`)
        addToResponseLog(`AI: ${aiResponse}`)
        
        try {
          // Clean the AI response by removing markdown code blocks
          let cleanedResponse = aiResponse.trim()
          
          // Remove markdown code blocks
          cleanedResponse = cleanedResponse.replace(/```json\s*/g, '')
          cleanedResponse = cleanedResponse.replace(/```\s*/g, '')
          cleanedResponse = cleanedResponse.trim()
          
          console.log('Cleaned AI response:', cleanedResponse)
          
          const commands = JSON.parse(cleanedResponse)
          if (Array.isArray(commands)) {
            console.log('Executing commands:', commands)
            commands.forEach(command => executeSceneCommand(command))
          } else {
            console.log('Executing single command:', commands)
            executeSceneCommand(commands)
          }
        } catch (parseError) {
          console.error('Error parsing AI response:', parseError)
          console.error('Original response:', aiResponse)
          const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parsing error'
          addToResponseLog(`Error: Could not parse AI response - ${errorMessage}`)
        }
      }
    } catch (error) {
      console.error('Error calling OpenAI API:', error)
      addToResponseLog(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
      setTextInput('')
    }
  }

  const handleContinue = () => {
    if (apiKey.trim()) {
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

  useEffect(() => {
    if (!showApiKeyInput && !sceneInitialized) {
      // Small delay to ensure canvas is rendered
      const timer = setTimeout(() => {
        // Check if verb is available when initializing
        if ((window as any).verb) {
          console.log('✅ Verb library loaded successfully')
        } else {
          console.warn('⚠️ Verb library not found - NURBS functionality may not work')
        }
        initializeBabylonScene()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [showApiKeyInput, sceneInitialized])

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose()
      }
    }
  }, [])

  if (showApiKeyInput) {
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

  return (
    <div className="app-container">
      {renderTopToolbar()}
      <div className="main-content">
        <div className="canvas-container">
          <canvas ref={canvasRef} className="babylon-canvas" />
        </div>
        {renderAISidebar()}
      </div>
    </div>
  )
}

export default App
