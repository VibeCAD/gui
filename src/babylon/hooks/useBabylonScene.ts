import { useEffect, useRef, useMemo, useState } from 'react'
import { Vector3, Color3, PickingInfo, Matrix } from 'babylonjs'
import { SceneManager } from '../sceneManager'
import { useSceneStore } from '../../state/sceneStore'
import { useGizmoManager } from '../gizmoManager'
import type { SceneObject } from '../../types/types'

// Custom hook to get the previous value of a prop or state
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>()
  useEffect(() => {
    ref.current = value
  })
  return ref.current
}

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

  // Keep sceneObjectsRef synchronized with sceneObjects state for callbacks
  useEffect(() => {
    sceneObjectsRef.current = sceneObjects
  }, [sceneObjects])

  // Get the previous state of sceneObjects for diffing
  const prevSceneObjects = usePrevious(sceneObjects)

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
          console.log('🔗 Setting up object click callback')
          sceneManager.setObjectClickCallback(handleObjectClick)
          console.log('🔗 Setting up object hover callback')
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
    // Get latest state directly from the store to prevent stale closures
    const state = useSceneStore.getState()
    
    console.log('🎯 [handleObjectClick] Received pick info:', {
      hit: pickInfo.hit,
      pickedMesh: pickInfo.pickedMesh?.name,
      isCtrlHeld,
      currentSceneObjects: sceneObjectsRef.current.map(obj => obj.id)
    })

    if (pickInfo.hit && pickInfo.pickedMesh) {
      const meshName = pickInfo.pickedMesh.name
      const clickedObject = sceneObjectsRef.current.find(obj => obj.id === meshName)

      console.log('🎯 [handleObjectClick] Object lookup:', {
        meshName,
        foundObject: clickedObject?.id,
        objectType: clickedObject?.type
      })

      if (clickedObject && clickedObject.type !== 'ground') {
        // Check if object is locked
        if (state.objectLocked[clickedObject.id]) {
          console.log(`🔒 [handleObjectClick] Object is locked: ${clickedObject.id}`)
          return
        }

        if (state.multiSelectMode || isCtrlHeld) {
          // Multi-select mode
          const newIds = state.selectedObjectIds.includes(clickedObject.id)
            ? state.selectedObjectIds.filter(id => id !== clickedObject.id)
            : [...state.selectedObjectIds, clickedObject.id]
          console.log('🎯 [handleObjectClick] Multi-select mode:', {
            objectId: clickedObject.id,
            newSelection: newIds
          })
          setSelectedObjectIds(newIds)
          setSelectedObjectId(null)
        } else {
          // Single select mode
          console.log('🎯 [handleObjectClick] Single select mode:', {
            objectId: clickedObject.id
          })
          setSelectedObjectId(clickedObject.id)
          setSelectedObjectIds([])
        }
        
        state.setActiveDropdown(null)
      } else {
        // If the ground or an unmanaged mesh is clicked, deselect everything
        console.log('🎯 [handleObjectClick] Clicked ground or unmanaged mesh, clearing selection')
        clearSelection()
      }
    } else {
      // If empty space is clicked, deselect everything
      console.log('🎯 [handleObjectClick] Clicked empty space, clearing selection')
      clearSelection()
    }
  }

  // Handle object hover events
  const handleObjectHover = (pickInfo: PickingInfo) => {
    // Get latest state directly from the store to prevent stale closures
    const state = useSceneStore.getState()

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

  // Pointer events are now handled by the SceneManager's built-in system

  // Synchronize scene objects with store state by diffing
  useEffect(() => {
    if (!sceneManagerRef.current || !sceneInitialized) return

    const sceneManager = sceneManagerRef.current
    const currentObjectsMap = new Map(sceneObjects.map(obj => [obj.id, obj]))
    const prevObjectsMap = new Map(prevSceneObjects?.map(obj => [obj.id, obj]) || [])

    // Find added and updated objects
    currentObjectsMap.forEach((currentObj, id) => {
      const prevObj = prevObjectsMap.get(id)
      
      if (!prevObj) {
        // New object added
        console.log(`➕ Adding new mesh: ${id} (${currentObj.type})`)
        sceneManager.addMesh(currentObj)
      } else if (currentObj !== prevObj) {
        // Existing object updated, calculate a diff
        console.log(`🔄 Updating existing mesh: ${id}`)
        const diff: Partial<SceneObject> = {}
        
        if (currentObj.position !== prevObj.position && !currentObj.position.equals(prevObj.position)) {
          diff.position = currentObj.position
        }
        if (currentObj.rotation !== prevObj.rotation && !currentObj.rotation.equals(prevObj.rotation)) {
          diff.rotation = currentObj.rotation
        }
        if (currentObj.scale !== prevObj.scale && !currentObj.scale.equals(prevObj.scale)) {
          diff.scale = currentObj.scale
        }
        if (currentObj.color !== prevObj.color) {
          diff.color = currentObj.color
        }
        
        if (Object.keys(diff).length > 0) {
          sceneManager.updateMeshProperties(id, diff)
        }
      }
    })

    // Find removed objects
    prevObjectsMap.forEach((_, id) => {
      if (!currentObjectsMap.has(id)) {
        console.log(`➖ Removing mesh: ${id}`)
        sceneManager.removeMeshById(id)
      }
    })
  }, [sceneObjects, sceneInitialized, prevSceneObjects])

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
    const state = useSceneStore.getState()

    // Reset all non-ground objects to a default state
    state.sceneObjects.forEach(obj => {
      if (obj.type !== 'ground') {
        // Check if object is locked
        if (state.objectLocked[obj.id]) {
          sceneManager.setMeshEmissive(obj.id, new Color3(0.8, 0.4, 0.4)) // Red tint for locked objects
        } else {
          // Subtle glow to indicate all objects are interactive
          sceneManager.setMeshEmissive(obj.id, new Color3(0.1, 0.1, 0.1))
        }
      }
    })

    // Add hover effect
    if (state.hoveredObjectId && state.hoveredObjectId !== state.selectedObjectId && !state.selectedObjectIds.includes(state.hoveredObjectId)) {
      if (!state.objectLocked[state.hoveredObjectId]) {
        sceneManager.setMeshEmissive(state.hoveredObjectId, new Color3(0.3, 0.6, 0.9)) // Blue hover
      }
    }

    // Add strong highlight to the single selected object
    if (state.selectedObjectId) {
      sceneManager.setMeshEmissive(state.selectedObjectId, new Color3(0.6, 1.0, 1.0)) // Bright cyan selection
    }

    // Add highlight to multi-selected objects
    state.selectedObjectIds.forEach(objectId => {
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

  // Use gizmo management hook
  useGizmoManager(
    sceneManagerRef.current?.getScene() || null,
    (id: string) => sceneManagerRef.current?.getMeshById(id) || null,
    multiSelectPivot,
    snapToGrid,
    gridSize
  )

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
