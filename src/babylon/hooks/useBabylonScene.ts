import { useEffect, useRef, useMemo, useState } from 'react'
import { Vector3, Color3, PickingInfo, Matrix } from 'babylonjs'
import { SceneManager } from '../sceneManager'
import { useSceneStore } from '../../state/sceneStore'
import type { SceneObject } from '../../types/types'

export const useBabylonScene = (canvasRef: React.RefObject<HTMLCanvasElement | null>) => {
  const sceneManagerRef = useRef<SceneManager | null>(null)
  const sceneObjectsRef = useRef<SceneObject[]>([])
  const isInitializedRef = useRef(false)
  const [canvasAvailable, setCanvasAvailable] = useState(false)

  // Get all store state and actions
  const store = useSceneStore()
  const {
    sceneObjects,
    selectedObjectId,
    selectedObjectIds,
    transformMode,
    wireframeMode,
    snapToGrid,
    gridSize,
    showGrid,
    hoveredObjectId,
    objectVisibility,
    objectLocked,
    multiSelectPivot,
    multiSelectInitialStates,
    sceneInitialized,
    
    // Actions
    setSceneInitialized,
    setSelectedObjectId,
    setSelectedObjectIds,
    setHoveredObjectId,
    updateObject,
    setMultiSelectPivot,
    setMultiSelectInitialStates,
    setGridMesh,
    clearSelection
  } = store

  // Keep sceneObjectsRef synchronized with sceneObjects state
  useEffect(() => {
    sceneObjectsRef.current = sceneObjects
  }, [sceneObjects])

  // Watch for canvas ref changes and update canvasAvailable state
  useEffect(() => {
    const checkCanvas = () => {
      const canvas = canvasRef.current
      const hasCanvas = !!(canvas && canvas.offsetWidth > 0 && canvas.offsetHeight > 0 && canvas.isConnected)
      console.log('🔍 Canvas availability check:', {
        hasCanvas,
        hasCanvasRef: !!canvas,
        offsetWidth: canvas?.offsetWidth,
        offsetHeight: canvas?.offsetHeight,
        isConnected: canvas?.isConnected,
        parentElement: canvas?.parentElement
      })
      setCanvasAvailable(hasCanvas)
    }

    // Check immediately
    checkCanvas()

    // If canvas is not available, check again after a short delay
    if (!canvasAvailable && canvasRef.current) {
      const timeoutId = setTimeout(() => {
        console.log('🔄 Retrying canvas availability check...')
        checkCanvas()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [canvasRef.current, canvasAvailable])

  // Initialize the scene manager when canvas is available
  useEffect(() => {
    // Prevent re-initialization
    if (isInitializedRef.current) {
      return
    }

    const intervalId = setInterval(() => {
      const canvas = canvasRef.current
      
      // Check if canvas is mounted and has dimensions
      if (canvas && canvas.offsetWidth > 0 && canvas.offsetHeight > 0) {
        clearInterval(intervalId)
        
        console.log('🚀 Canvas is ready, initializing Babylon.js scene...')
        isInitializedRef.current = true
        const sceneManager = new SceneManager()
        
        if (sceneManager.initialize(canvas)) {
          sceneManagerRef.current = sceneManager
          
          console.log('✅ SceneManager initialized, setting up callbacks...')
          
          // Set up event callbacks
          sceneManager.setObjectClickCallback(handleObjectClick)
          sceneManager.setObjectHoverCallback(handleObjectHover)
          
          // Create initial scene objects
          const initialCube: SceneObject = {
            id: 'cube-initial',
            type: 'cube',
            position: new Vector3(0, 1, 0),
            scale: new Vector3(1, 1, 1),
            rotation: new Vector3(0, 0, 0),
            color: '#ff6b6b',
            isNurbs: false
          }

          const initialGround: SceneObject = {
            id: 'ground',
            type: 'ground',
            position: new Vector3(0, 0, 0),
            scale: new Vector3(10, 1, 10),
            rotation: new Vector3(0, 0, 0),
            color: '#808080',
            isNurbs: false
          }

          console.log('🎲 Adding initial objects to scene...')
          
          // Add initial objects to the scene and store
          sceneManager.addMesh(initialCube)
          sceneManager.addMesh(initialGround)
          
          // Initialize store with initial objects
          store.setSceneObjects([initialCube, initialGround])
          
          setSceneInitialized(true)
          console.log('✅ useBabylonScene initialized successfully')
        } else {
          console.error('❌ Failed to initialize SceneManager')
          isInitializedRef.current = false // Allow retry if initialization fails
        }
      } else {
        console.log('⏳ Canvas not ready yet, will check again...')
      }
    }, 100) // Poll every 100ms

    return () => {
      console.log('🧹 Cleaning up Babylon.js scene effect...')
      clearInterval(intervalId)
      if (sceneManagerRef.current) {
        sceneManagerRef.current.dispose()
        sceneManagerRef.current = null
      }
      isInitializedRef.current = false
      setSceneInitialized(false)
    }
  }, []) // Run this effect only once on mount

  // Handle object click events
  const handleObjectClick = (pickInfo: PickingInfo, isCtrlHeld: boolean = false) => {
    console.log('[handleObjectClick] Received pick info:', pickInfo)

    if (pickInfo.hit && pickInfo.pickedMesh) {
      const clickedObject = sceneObjectsRef.current.find(obj => obj.id === pickInfo.pickedMesh?.name)

      if (clickedObject && clickedObject.type !== 'ground') {
        // Check if object is locked
        if (objectLocked[clickedObject.id]) {
          console.log(`[handleObjectClick] Object is locked: ${clickedObject.id}`)
          return
        }

        if (store.multiSelectMode || isCtrlHeld) {
          // Multi-select mode
          const newIds = selectedObjectIds.includes(clickedObject.id)
            ? selectedObjectIds.filter(id => id !== clickedObject.id)
            : [...selectedObjectIds, clickedObject.id]
          setSelectedObjectIds(newIds)
          setSelectedObjectId(null)
        } else {
          // Single select mode
          setSelectedObjectId(clickedObject.id)
          setSelectedObjectIds([])
        }
        
        store.setActiveDropdown(null)
      } else {
        // If the ground or an unmanaged mesh is clicked, deselect everything
        clearSelection()
      }
    } else {
      // If empty space is clicked, deselect everything
      clearSelection()
    }
  }

  // Handle object hover events
  const handleObjectHover = (pickInfo: PickingInfo) => {
    if (pickInfo.hit && pickInfo.pickedMesh) {
      const hoveredObject = sceneObjectsRef.current.find(obj => obj.id === pickInfo.pickedMesh?.name)
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

  // Synchronize scene objects with store state
  useEffect(() => {
    if (!sceneManagerRef.current || !sceneInitialized) return

    const sceneManager = sceneManagerRef.current
    const currentMeshIds = new Set<string>()
    
    console.log('🔄 Synchronizing scene objects:', sceneObjects.map(obj => obj.id))
    
    // Track existing meshes
    sceneObjects.forEach(obj => {
      const mesh = sceneManager.getMeshById(obj.id)
      if (mesh) {
        currentMeshIds.add(obj.id)
        console.log(`✅ Updating existing mesh: ${obj.id}`)
        // Update existing mesh properties
        sceneManager.updateMeshProperties(obj.id, obj)
      } else {
        console.log(`➕ Adding new mesh: ${obj.id} (${obj.type})`)
        // Add new mesh
        const success = sceneManager.addMesh(obj)
        if (success) {
          currentMeshIds.add(obj.id)
          console.log(`✅ Successfully added mesh: ${obj.id}`)
        } else {
          console.error(`❌ Failed to add mesh: ${obj.id}`)
        }
      }
    })

    // Remove meshes that are no longer in the state
    // Note: We need to track which meshes exist in the scene manager
    // For now, we'll rely on the scene manager to handle this internally
    
  }, [sceneObjects, sceneInitialized])

  // Handle wireframe mode changes
  useEffect(() => {
    if (!sceneManagerRef.current || !sceneInitialized) return
    sceneManagerRef.current.setWireframeMode(wireframeMode)
  }, [wireframeMode, sceneInitialized])

  // Handle object visibility changes
  useEffect(() => {
    if (!sceneManagerRef.current || !sceneInitialized) return
    
    Object.entries(objectVisibility).forEach(([objectId, visible]) => {
      sceneManagerRef.current!.setMeshVisibility(objectId, visible)
    })
  }, [objectVisibility, sceneInitialized])

  // Handle visual grid changes
  useEffect(() => {
    if (!sceneManagerRef.current || !sceneInitialized) return
    sceneManagerRef.current.createVisualGrid(snapToGrid && showGrid, gridSize)
  }, [snapToGrid, showGrid, gridSize, sceneInitialized])

  // Handle selection visual feedback
  useEffect(() => {
    if (!sceneManagerRef.current || !sceneInitialized) return

    const sceneManager = sceneManagerRef.current

    // Reset all non-ground objects to a default state
    sceneObjects.forEach(obj => {
      if (obj.type !== 'ground') {
        // Check if object is locked
        if (objectLocked[obj.id]) {
          sceneManager.setMeshEmissive(obj.id, new Color3(0.8, 0.4, 0.4)) // Red tint for locked objects
        } else {
          // Subtle glow to indicate all objects are interactive
          sceneManager.setMeshEmissive(obj.id, new Color3(0.1, 0.1, 0.1))
        }
      }
    })

    // Add hover effect
    if (hoveredObjectId && hoveredObjectId !== selectedObjectId && !selectedObjectIds.includes(hoveredObjectId)) {
      if (!objectLocked[hoveredObjectId]) {
        sceneManager.setMeshEmissive(hoveredObjectId, new Color3(0.3, 0.6, 0.9)) // Blue hover
      }
    }

    // Add strong highlight to the single selected object
    if (selectedObjectId) {
      sceneManager.setMeshEmissive(selectedObjectId, new Color3(0.6, 1.0, 1.0)) // Bright cyan selection
    }

    // Add highlight to multi-selected objects
    selectedObjectIds.forEach(objectId => {
      sceneManager.setMeshEmissive(objectId, new Color3(1.0, 0.8, 0.2)) // Orange for multi-selection
    })
  }, [selectedObjectId, selectedObjectIds, hoveredObjectId, sceneObjects, objectLocked, sceneInitialized])

  // Handle multi-select pivot creation
  useEffect(() => {
    if (!sceneManagerRef.current || !sceneInitialized) return

    const sceneManager = sceneManagerRef.current
    
    if (selectedObjectIds.length === 0) {
      sceneManager.removeMultiSelectPivot()
      setMultiSelectPivot(null)
      setMultiSelectInitialStates({})
      return
    }

    const selectedObjs = sceneObjects.filter(obj => selectedObjectIds.includes(obj.id))
    if (selectedObjs.length === 0) return

    // Calculate center point of selected objects
    const center = selectedObjs.reduce((acc, obj) => {
      return acc.add(obj.position)
    }, new Vector3(0, 0, 0)).scale(1 / selectedObjs.length)

    // Create pivot
    const pivot = sceneManager.createMultiSelectPivot(center)
    if (pivot) {
      setMultiSelectPivot(pivot)
      
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
      })
      setMultiSelectInitialStates(initialStates)
    }
  }, [selectedObjectIds, sceneObjects, sceneInitialized])

  // Handle gizmo management
  useEffect(() => {
    if (!sceneManagerRef.current || !sceneInitialized) return

    const sceneManager = sceneManagerRef.current
    const isMultiSelect = selectedObjectIds.length > 0
    
    // Choose which mesh to attach gizmo to
    let targetMesh = null
    if (isMultiSelect && multiSelectPivot) {
      targetMesh = multiSelectPivot
    } else if (selectedObjectId) {
      targetMesh = sceneManager.getMeshById(selectedObjectId)
    }

    // Set up gizmos with drag end handler
    const handleGizmoDragEnd = (position: Vector3, rotation: Vector3, scale: Vector3) => {
      if (isMultiSelect && multiSelectPivot) {
        // Apply transform to all selected objects
        selectedObjectIds.forEach(id => {
          const initialState = multiSelectInitialStates[id]
          if (!initialState) return

          let newPosition = initialState.relativePosition.clone().multiply(scale)
          const rotationMatrix = new Matrix()
          Matrix.RotationYawPitchRollToRef(rotation.y, rotation.x, rotation.z, rotationMatrix)
          newPosition = Vector3.TransformCoordinates(newPosition, rotationMatrix).add(position)
          
          const newRotation = initialState.rotation.add(rotation)
          const newScale = initialState.scale.multiply(scale)

          updateObject(id, { position: newPosition, rotation: newRotation, scale: newScale })
        })
      } else if (selectedObjectId) {
        // Single object transform
        let newPosition = position.clone()
        if (snapToGrid) {
          newPosition = sceneManager.snapToGrid(newPosition, gridSize)
        }
        updateObject(selectedObjectId, { position: newPosition, rotation: rotation.clone(), scale: scale.clone() })
      }
    }

    sceneManager.setupGizmos(transformMode, targetMesh, handleGizmoDragEnd)
  }, [selectedObjectId, selectedObjectIds, transformMode, multiSelectPivot, multiSelectInitialStates, sceneInitialized, snapToGrid, gridSize])

  // Expose scene manager methods for external use
  const sceneAPI = useMemo(() => ({
    setCameraView: (view: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'home') => {
      sceneManagerRef.current?.setCameraView(view)
    },
    
    focusOnPosition: (position: Vector3) => {
      sceneManagerRef.current?.focusOnPosition(position)
    },
    
    snapToGrid: (position: Vector3) => {
      if (sceneManagerRef.current && snapToGrid) {
        return sceneManagerRef.current.snapToGrid(position, gridSize)
      }
      return position
    },
    
    getSceneManager: () => sceneManagerRef.current
  }), [snapToGrid, gridSize])

  return {
    sceneAPI,
    sceneInitialized
  }
}
