import { useEffect, useRef, useMemo, useState } from 'react'
import { Vector3, Color3, PickingInfo, Matrix, Scene, Mesh, StandardMaterial } from 'babylonjs'
import { SceneManager } from '../sceneManager'
import { useSceneStore } from '../../state/sceneStore'
import { useGizmoManager } from '../gizmoManager'
import type { SceneObject } from '../../types/types'
import { GeometryService } from '../../services/GeometryService'
import type { Opening } from '../../models/Opening'
import type { Wall } from '../../models/Wall'

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
  const geometryServiceRef = useRef<GeometryService | null>(null)
  const sceneObjectsRef = useRef<SceneObject[]>([])
  const isInitializedRef = useRef(false)
  
  // Get all store state and actions
  const store = useSceneStore()
  const {
    sceneObjects,
    walls,
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
    
    // Actions
    setSceneInitialized,
    setSelectedObjectId,
    setSelectedObjectIds,
    setHoveredObjectId,
    updateObject,
    setMultiSelectPivot,
    setMultiSelectInitialStates,
    clearSelection,
    isAddingOpening,
    openingPreview,
    exitAddOpeningMode,
    addOpeningToWall,
    updateOpeningPreview,
    selectedOpeningId,
    setSelectedOpeningId,
    updateOpeningInWall,
  } = store

  // Keep sceneObjectsRef synchronized with sceneObjects state for callbacks
  useEffect(() => {
    sceneObjectsRef.current = sceneObjects
  }, [sceneObjects])

  // Get the previous state of sceneObjects for diffing
  const prevSceneObjects = usePrevious(sceneObjects)
  const prevWalls = usePrevious(walls)

  // Initialize the scene manager when canvas is available
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
        return; // Exit if canvas is not yet available
    }

    const sceneManager = new SceneManager();
    if (sceneManager.initialize(canvas)) {
        sceneManagerRef.current = sceneManager;
        const scene = sceneManager.getScene();
        if (scene) {
            geometryServiceRef.current = new GeometryService(scene);
        }

        if (typeof window !== 'undefined') {
            // @ts-ignore
            window.VibeCadSceneManager = sceneManager;
        }

        sceneManager.setObjectClickCallback(handleObjectClick);
        sceneManager.setObjectHoverCallback(handleObjectHover);
        sceneManager.setTextureAssetCallback((textureId: string) => {
            return store.textureAssets.get(textureId);
        });

        const initialGround: SceneObject = {
            id: 'ground',
            type: 'ground',
            position: new Vector3(0, 0, 0),
            scale: new Vector3(10, 1, 10),
            rotation: new Vector3(0, 0, 0),
            color: '#808080',
            isNurbs: false
        };

        sceneManager.addMesh(initialGround);
        store.setSceneObjects([initialGround]);
        setSceneInitialized(true);
    } else {
        console.error('❌ Failed to initialize SceneManager');
    }

    return () => {
        sceneManagerRef.current?.dispose();
        sceneManagerRef.current = null;
        setSceneInitialized(false);
    }
  }, [canvasRef.current]);


  // Handle object click events
  const handleObjectClick = (pickInfo: PickingInfo, isCtrlHeld: boolean = false) => {
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

    // If the click didn't hit anything, or didn't hit a mesh, clear selection
    // unless the user is holding control to multi-select.
    if (!pickInfo.hit || !pickInfo.pickedMesh) {
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

    if (!objectId) {
      if (!isCtrlHeld) clearSelection();
      return;
    }

    const clickedObject = sceneObjects.find(obj => obj.id === objectId);

    // If we didn't find a corresponding object in our store, or if it's the ground,
    // or if the object is locked, clear the selection.
    if (!clickedObject || clickedObject.type === 'ground' || isObjectLocked(objectId)) {
      if (!isCtrlHeld) {
        clearSelection();
      }
      return;
    }

    // Handle selection logic based on the mode
    if (multiSelectMode || isCtrlHeld) {
      const isAlreadySelected = selectedObjectIds.includes(objectId);
      const newSelection = isAlreadySelected
        ? selectedObjectIds.filter(id => id !== objectId) // Deselect if already selected
        : [...selectedObjectIds, objectId]; // Add to selection
      
      setSelectedObjectIds(newSelection);
      setSelectedObjectId(null); // In multi-select, no single object is the "primary" selection
    } else {
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
    if (!sceneManagerRef.current || !geometryServiceRef.current || !sceneInitialized) return

    const sceneManager = sceneManagerRef.current
    const geometryService = geometryServiceRef.current
    const currentObjectsMap = new Map(sceneObjects.map(obj => [obj.id, obj]))
    const prevObjectsMap = new Map(prevSceneObjects?.map(obj => [obj.id, obj]) || [])

    // Find added and updated objects
    currentObjectsMap.forEach(async (currentObj, id) => {
      const prevObj = prevObjectsMap.get(id)
      
      if (!prevObj) {
        // New object added
        if (currentObj.type === 'wall') {
            const wallData = store.walls.find(w => w.id === id);
            if (wallData) {
                const wallMesh = await geometryService.generateWallMesh(wallData);
                sceneManager.addPreExistingMesh(wallMesh, id);
            }
        } else {
            sceneManager.addMesh(currentObj)
        }
      } else if (currentObj !== prevObj) {
        // Existing object updated
        if (currentObj.type === 'wall') {
            const wallData = store.walls.find(w => w.id === id);
            if (wallData) {
                console.log(`[BabylonScene] Wall ${id} updated. Regenerating mesh...`);
                sceneManager.removeMeshById(id);
                const wallMesh = await geometryService.generateWallMesh(wallData);
                sceneManager.addPreExistingMesh(wallMesh, id);
            }
        } else {
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
            }
            if (JSON.stringify(currentObj.textureScale) !== JSON.stringify(prevObj.textureScale)) {
              diff.textureScale = currentObj.textureScale
            }
            if (JSON.stringify(currentObj.textureOffset) !== JSON.stringify(prevObj.textureOffset)) {
              diff.textureOffset = currentObj.textureOffset
            }
            
            if (Object.keys(diff).length > 0) {
              sceneManager.updateMeshProperties(id, diff)
            }
        }
      }
    });

    // Find removed objects
    prevObjectsMap.forEach((_, id) => {
      if (!currentObjectsMap.has(id)) {
        sceneManager.removeMeshById(id)
      }
    });
  }, [sceneObjects, sceneInitialized, prevSceneObjects])

  // Synchronize walls with store state by diffing
  useEffect(() => {
    if (!sceneManagerRef.current || !geometryServiceRef.current || !sceneInitialized) return

    const sceneManager = sceneManagerRef.current
    const geometryService = geometryServiceRef.current
    const currentWallsMap = new Map(walls.map(wall => [wall.id, wall]))
    const prevWallsMap = new Map(prevWalls?.map(wall => [wall.id, wall]) || [])

    // Find added and updated walls
    currentWallsMap.forEach(async (currentWall, id) => {
      const prevWall = prevWallsMap.get(id)
      
      if (!prevWall) {
        // This case is handled by the sceneObjects effect
      } else if (currentWall !== prevWall) {
        // Existing wall updated
        console.log(`[BabylonScene] Wall ${id} updated. Regenerating mesh...`);
        sceneManager.removeMeshById(id)
        const wallMesh = await geometryService.generateWallMesh(currentWall)
        sceneManager.addPreExistingMesh(wallMesh, id)
      }
    })

    // Find removed walls
    prevWallsMap.forEach((_, id) => {
      if (!currentWallsMap.has(id)) {
        sceneManager.removeMeshById(id)
      }
    });
  }, [walls, sceneInitialized, prevWalls])

  // Handle opening preview
  useEffect(() => {
    if (!sceneManagerRef.current || !geometryServiceRef.current || !sceneInitialized) return

    const sceneManager = sceneManagerRef.current
    const geometryService = geometryServiceRef.current
    let previewMesh: Mesh | null = null;

    if (isAddingOpening && openingPreview) {
      // Create and show preview mesh
      const wall = walls.find(w => w.id === openingPreview.wallId);
      if (wall) {
        console.log(`[BabylonScene] Creating opening preview for wall: ${wall.id}`);
        previewMesh = geometryService.createOpeningVolume(openingPreview.opening, wall.parameters.thickness, new Vector3());
        previewMesh.isPickable = false;
        previewMesh.isVisible = true; // Make the preview mesh visible
        const previewMaterial = new StandardMaterial('preview-mat', sceneManager.getScene()!);
        previewMaterial.diffuseColor = new Color3(0.5, 0.8, 1);
        previewMaterial.alpha = 0.5;
        previewMesh.material = previewMaterial;
        
        const pointerMoveCallback = (evt: PointerEvent) => {
          const pickInfo = sceneManager.getScene()?.pick(sceneManager.getScene()!.pointerX, sceneManager.getScene()!.pointerY, (mesh) => mesh.name === openingPreview.wallId);
          if (pickInfo?.hit && pickInfo.pickedPoint) {
            previewMesh?.position.copyFrom(pickInfo.pickedPoint);
            updateOpeningPreview(pickInfo.pickedPoint);
          }
        };

        const pointerDownCallback = (evt: PointerEvent) => {
          if (evt.button === 0) { // Left click
            const pickInfo = sceneManager.getScene()?.pick(sceneManager.getScene()!.pointerX, sceneManager.getScene()!.pointerY, (mesh) => mesh.name === openingPreview.wallId);
            if (pickInfo?.hit && pickInfo.pickedPoint) {
              const wall = walls.find(w => w.id === openingPreview.wallId);
              if (wall) {
                console.log(`[BabylonScene] Placing opening on wall ${wall.id} at position:`, pickInfo.pickedPoint);
                const localPosition = pickInfo.pickedPoint.subtract(wall.parameters.position);
                const newOpening: Opening = {
                  ...openingPreview.opening,
                  id: `${openingPreview.opening.type}-${Date.now()}`,
                  parameters: {
                    ...openingPreview.opening.parameters,
                    position: {
                      offsetX: localPosition.x,
                      elevation: localPosition.y
                    }
                  }
                };
                addOpeningToWall(openingPreview.wallId, newOpening);
                exitAddOpeningMode();
              }
            }
          }
        };

        sceneManager.getScene()?.getEngine().getRenderingCanvas()?.addEventListener('pointermove', pointerMoveCallback);
        sceneManager.getScene()?.getEngine().getRenderingCanvas()?.addEventListener('pointerdown', pointerDownCallback);
        
        return () => {
          sceneManager.getScene()?.getEngine().getRenderingCanvas()?.removeEventListener('pointermove', pointerMoveCallback);
          sceneManager.getScene()?.getEngine().getRenderingCanvas()?.removeEventListener('pointerdown', pointerDownCallback);
          if (previewMesh) {
            previewMesh.dispose();
          }
        }
      }
    }
  }, [isAddingOpening, openingPreview, sceneInitialized, walls]);

  // Handle visual feedback for add opening mode
  useEffect(() => {
    if (!sceneManagerRef.current) return;
    const sceneManager = sceneManagerRef.current;

    // Reset all wall colors first
    walls.forEach(wall => {
        sceneManager.setMeshEmissive(wall.id, new Color3(0, 0, 0));
    });

    if (isAddingOpening && openingPreview) {
      sceneManager.setMeshEmissive(openingPreview.wallId, new Color3(0.5, 0.8, 1));
    }
  }, [isAddingOpening, openingPreview, walls]);

  // Handle selected opening gizmo
  useEffect(() => {
    if (!sceneManagerRef.current || !sceneInitialized) return

    const sceneManager = sceneManagerRef.current
    let proxyMesh: Mesh | null = null;

    if (selectedOpeningId) {
      // Find the opening and its parent wall
      let parentWall: Wall | undefined;
      let opening: Opening | undefined;

      for (const wall of walls) {
        const foundOpening = wall.openings.find(o => o.id === selectedOpeningId);
        if (foundOpening) {
          parentWall = wall;
          opening = foundOpening;
          break;
        }
      }

      if (parentWall && opening) {
        // Create an invisible proxy mesh for the gizmo to attach to
        proxyMesh = new Mesh(`proxy-${opening.id}`, sceneManager.getScene());
        
        const wallMesh = sceneManager.getMeshById(parentWall.id);
        if (wallMesh) {
          const localPosition = new Vector3(
            opening.parameters.position.offsetX,
            opening.parameters.position.elevation - wallMesh.position.y + opening.parameters.height / 2,
            0
          );
          proxyMesh.position = wallMesh.position.add(localPosition);
        }

        // Set up gizmo to move this proxy mesh
        // The useGizmoManager hook will need to be updated to handle this
        // For now, we are just creating the mesh.
      }
    }

    return () => {
      if (proxyMesh) {
        proxyMesh.dispose();
      }
    }
  }, [selectedOpeningId, walls, sceneInitialized]);

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
      return sceneManagerRef.current?.getMeshById(id) || null
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
