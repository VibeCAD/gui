import { useEffect, useRef, useMemo, useState } from 'react'
import { Vector3, Color3, PickingInfo, Matrix, Quaternion } from 'babylonjs'
import { SceneManager } from '../sceneManager'
import { useSceneStore } from '../../state/sceneStore'
import { useGizmoManager } from '../gizmoManager'
import type { SceneObject } from '../../types/types'

// Custom hook to get the previous value of a prop or state
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined)
  useEffect(() => {
    ref.current = value
  }, [value])
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
    snapToObjects,
    showConnectionPoints,
    gridSize,
    showGrid,
    hoveredObjectId,
    objectVisibility,
    objectLocked,
    multiSelectPivot,
    multiSelectInitialStates,
    sceneInitialized,
    moveToMode,
    
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
          
          // Expose for DevTools debugging
          if (typeof window !== 'undefined') {
            // @ts-ignore
            window.VibeCadSceneManager = sceneManager
            console.log('🐞 VibeCadSceneManager is available on window for debugging')
          }
          
          console.log('✅ SceneManager initialized, setting up callbacks...')
          
          // Set up event callbacks
          console.log('🔗 Setting up object click callback')
          sceneManager.setObjectClickCallback(handleObjectClick)
          console.log('🔗 Setting up object hover callback')
          sceneManager.setObjectHoverCallback(handleObjectHover)
          
          
          console.log('🔗 Setting up move to callback')
          sceneManager.setMoveToCallback((position: Vector3) => {
            const { selectedObjectId, updateObject, setMoveToMode } = useSceneStore.getState()
            if (selectedObjectId) {
              const sceneManager = sceneManagerRef.current
              const mesh = sceneManager?.getMeshById(selectedObjectId)

              if (mesh) {
                // --- 1. ROTATION LOGIC: Align object to be flush with the floor ---
                mesh.computeWorldMatrix(true)

                const localNormals = [
                  new Vector3(0, 1, 0), new Vector3(0, -1, 0),
                  new Vector3(1, 0, 0), new Vector3(-1, 0, 0),
                  new Vector3(0, 0, 1), new Vector3(0, 0, -1),
                ]
                let mostDownNormal = new Vector3(0, -1, 0)
                let lowestY = Infinity

                localNormals.forEach(localNormal => {
                  const worldNormal = Vector3.TransformNormal(localNormal, mesh.getWorldMatrix()).normalize()
                  if (worldNormal.y < lowestY) {
                    lowestY = worldNormal.y
                    mostDownNormal = worldNormal
                  }
                })

                const correctiveRotation = new Quaternion()
                Quaternion.FromUnitVectorsToRef(mostDownNormal, new Vector3(0, -1, 0), correctiveRotation)
                
                const originalRotationQuaternion = mesh.rotationQuaternion 
                    ? mesh.rotationQuaternion.clone() 
                    : Quaternion.RotationYawPitchRoll(mesh.rotation.y, mesh.rotation.x, mesh.rotation.z)

                const newRotationQuaternion = correctiveRotation.multiply(originalRotationQuaternion)
                const finalRotation = newRotationQuaternion.toEulerAngles()

                // --- 2. POSITION LOGIC: Move object to be flush with the floor ---
                const originalQuat = mesh.rotationQuaternion?.clone()
                mesh.rotationQuaternion = newRotationQuaternion
                mesh.computeWorldMatrix(true)

                const boundingBox = mesh.getBoundingInfo().boundingBox
                const worldVertices = boundingBox.vectorsWorld
                const lowestPointYAfterRotation = Math.min(...worldVertices.map(v => v.y))
                const yOffset = mesh.position.y - lowestPointYAfterRotation
                
                const finalPosition = position.clone()
                finalPosition.y += yOffset

                // Restore mesh to its pre-calculation state to avoid flicker
                mesh.rotationQuaternion = originalQuat ?? null
                mesh.computeWorldMatrix(true)

                updateObject(selectedObjectId, { position: finalPosition, rotation: finalRotation })
              } else {
                updateObject(selectedObjectId, { position })
              }
            }
            setMoveToMode(false)
          })

          // Set up texture asset callback
          console.log('🔗 Setting up texture asset callback')
          sceneManager.setTextureAssetCallback((textureId: string) => {
            const state = useSceneStore.getState()
            return state.textureAssets.get(textureId)
          })

          // Create initial scene objects - only ground, no cube
          const initialGround: SceneObject = {
            id: 'ground',
            type: 'ground',
            position: new Vector3(0, 0, 0),
            scale: new Vector3(10, 1, 10),
            rotation: new Vector3(0, 0, 0),
            color: '#808080',
            isNurbs: false
          }

          console.log('🎲 Adding initial ground to scene...')
          
          // Add initial ground to the scene and store
          sceneManager.addMesh(initialGround)
          
          // Initialize store with initial ground only
          store.setSceneObjects([initialGround])
          
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
    console.log('🖱️ handleObjectClick called:', { 
      hit: pickInfo.hit, 
      meshName: pickInfo.pickedMesh?.name, 
      isCtrlHeld 
    });

    // Get fresh state from the store at the moment of the click to avoid stale closures
    const {
      sceneObjects,
      multiSelectMode,
      selectedObjectIds,
      isObjectLocked,
      setSelectedObjectId,
      setSelectedObjectIds,
      clearSelection,
    } = useSceneStore.getState();

    console.log('🔍 Current state:', { 
      multiSelectMode, 
      selectedObjectIds: [...selectedObjectIds],
      sceneObjectCount: sceneObjects.length 
    });

    // If the click didn't hit anything, or didn't hit a mesh, clear selection
    // unless the user is holding control to multi-select.
    if (!pickInfo.hit || !pickInfo.pickedMesh) {
      console.log('❌ No hit or no mesh');
      if (!isCtrlHeld) {
        clearSelection();
      }
      return;
    }

    let pickedMesh = pickInfo.pickedMesh;
    // The clicked mesh may be a child mesh; walk up until we find a mesh whose
    // name matches one of our scene object IDs (or we reach the root).
    const sceneIds = new Set(sceneObjects.map(o => o.id))
    while (pickedMesh && !sceneIds.has(pickedMesh.name) && pickedMesh.parent) {
      pickedMesh = pickedMesh.parent as any;
    }

    const objectId = pickedMesh?.name;
    console.log('🎯 Found objectId:', objectId);

    if (!objectId) {
      console.log('❌ No objectId found');
      if (!isCtrlHeld) clearSelection();
      return;
    }

    const clickedObject = sceneObjects.find(obj => obj.id === objectId);
    console.log('📦 Found clickedObject:', clickedObject?.type);

    // If we didn't find a corresponding object in our store, or if it's the ground,
    // or if the object is locked, clear the selection.
    if (!clickedObject || clickedObject.type === 'ground' || isObjectLocked(objectId)) {
      console.log('❌ Object not valid for selection:', { 
        found: !!clickedObject, 
        type: clickedObject?.type, 
        locked: isObjectLocked(objectId) 
      });
      if (!isCtrlHeld) {
        clearSelection();
      }
      return;
    }

    // Handle selection logic based on the mode
    if (multiSelectMode || isCtrlHeld) {
      console.log('🔄 Multi-select mode triggered');
      const isAlreadySelected = selectedObjectIds.includes(objectId);
      const newSelection = isAlreadySelected
        ? selectedObjectIds.filter(id => id !== objectId) // Deselect if already selected
        : [...selectedObjectIds, objectId]; // Add to selection
      
      console.log('✅ Setting new multi-selection:', { 
        old: [...selectedObjectIds], 
        new: [...newSelection],
        wasSelected: isAlreadySelected 
      });
      
      setSelectedObjectIds(newSelection);
      // Note: setSelectedObjectIds automatically clears selectedObjectId in the store
    } else {
      console.log('📝 Single select mode');
      // Single selection mode – first clear multi-selection, then set single selection
      setSelectedObjectIds([]);
      setSelectedObjectId(objectId);
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
        
        // Check for texture changes
        if (JSON.stringify(currentObj.textureIds) !== JSON.stringify(prevObj.textureIds)) {
          diff.textureIds = currentObj.textureIds
          // When textures are removed, also include the color to restore it
          if (!currentObj.textureIds || Object.keys(currentObj.textureIds).length === 0) {
            diff.color = currentObj.color
          }
        }
        if (JSON.stringify(currentObj.textureScale) !== JSON.stringify(prevObj.textureScale)) {
          diff.textureScale = currentObj.textureScale
        }
        if (JSON.stringify(currentObj.textureOffset) !== JSON.stringify(prevObj.textureOffset)) {
          diff.textureOffset = currentObj.textureOffset
        }
        
        // Check for gridInfo changes (custom rooms)
        if (currentObj.type === 'custom-room' && JSON.stringify(currentObj.gridInfo) !== JSON.stringify(prevObj.gridInfo)) {
          diff.gridInfo = currentObj.gridInfo
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

  // Handle move-to mode changes
  useEffect(() => {
    if (!sceneManagerRef.current || !sceneInitialized) return
    sceneManagerRef.current.setMoveToMode(moveToMode)
  }, [moveToMode, sceneInitialized])

  // Handle visual grid changes
  useEffect(() => {
    if (!sceneManagerRef.current || !sceneInitialized) return
    sceneManagerRef.current.createVisualGrid(snapToGrid && showGrid, gridSize)
  }, [snapToGrid, showGrid, gridSize, sceneInitialized])

  // Handle collision detection changes
  useEffect(() => {
    if (!sceneManagerRef.current || !sceneInitialized) return
    sceneManagerRef.current.setCollisionDetectionEnabled(store.collisionDetectionEnabled)
  }, [store.collisionDetectionEnabled, sceneInitialized])

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

  // Handle connection point visualization toggle
  useEffect(() => {
    if (!sceneManagerRef.current || !sceneInitialized) return
    sceneManagerRef.current.visualizeConnectionPoints(showConnectionPoints)
  }, [showConnectionPoints, sceneInitialized])

  // Use gizmo management hook
  useGizmoManager(
    sceneManagerRef.current?.getScene() || null,
    (id: string) => {
      console.log('🎯 getMeshById called with:', id)
      console.log('🎯 sceneManagerRef.current:', !!sceneManagerRef.current)
      const mesh = sceneManagerRef.current?.getMeshById(id) || null
      console.log('🎯 getMeshById result:', mesh?.name || 'null')
      return mesh
    },
    multiSelectPivot,
    snapToGrid,
    snapToObjects,
    gridSize,
    sceneManagerRef.current
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
    
    setCollisionDetectionEnabled: (enabled: boolean) => {
      sceneManagerRef.current?.setCollisionDetectionEnabled(enabled)
    },
    
    getSceneManager: () => sceneManagerRef.current
  }), [snapToGrid, gridSize])

  return {
    sceneAPI,
    sceneInitialized
  }
}
