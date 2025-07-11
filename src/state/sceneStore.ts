import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { Vector3, Mesh } from 'babylonjs'
import type { 
    TransformMode, 
    PrimitiveType, 
    SceneObject, 
    ControlPointVisualization, 
    MultiSelectInitialState,
    ModularHousingObject,
    BuildingConnection,
    HousingOperation,
    Door,
    Window,
    Wall,
    ImportError,
    TextureAsset,
    TextureType
} from '../types/types'
import type { UndoAction } from './undoMiddleware'
import {
    createAddObjectAction,
    createRemoveObjectAction,
    createUpdateObjectAction,
    createRenameAction,
    createSetObjectLockedAction,
    createSetObjectVisibilityAction,
    createBatchDeleteAction
} from './undoMiddleware'

// Store State Interface
interface SceneState {
    // Scene objects and selection
    sceneObjects: SceneObject[]
    selectedObjectId: string | null
    selectedObjectIds: string[]
    hoveredObjectId: string | null
    
    // Transform and interaction
    transformMode: TransformMode
    moveToMode: boolean
    multiSelectMode: boolean
    multiSelectPivot: Mesh | null
    multiSelectInitialStates: {[objectId: string]: MultiSelectInitialState}
    
    // Appearance and display
    currentColor: string
    wireframeMode: boolean
    showGrid: boolean
    snapToGrid: boolean
    snapToObjects: boolean
    showConnectionPoints: boolean
    gridSize: number
    gridMesh: Mesh | null
    collisionDetectionEnabled: boolean
    
    // Movement controls
    movementEnabled: boolean
    movementSpeed: number
    
    // Object properties
    objectVisibility: {[key: string]: boolean}
    objectLocked: {[key: string]: boolean}
    tessellationQuality: {[objectId: string]: number}
    
    // NURBS specific
    controlPointVisualizations: ControlPointVisualization[]
    selectedControlPointIndex: number | null
    selectedControlPointMesh: Mesh | null
    
    // UI state
    activeDropdown: string | null
    sidebarCollapsed: boolean
    
    // AI and loading
    isLoading: boolean
    apiKey: string
    showApiKeyInput: boolean
    responseLog: string[]
    sceneInitialized: boolean
    
    // Text input for AI
    textInput: string
    
    // GLB Import state
    isImporting: boolean
    importError: ImportError | null
    
    // Texture state
    textureAssets: Map<string, TextureAsset>
    selectedTextureId: string | null
    isUploadingTexture: boolean
    textureUploadError: string | null
    defaultTexturesLoaded: boolean
    
    // Housing-specific state
    housingComponents: {[objectId: string]: ModularHousingObject}
    buildingConnections: BuildingConnection[]
    selectedWallId: string | null
    selectedDoorId: string | null
    selectedWindowId: string | null
    housingEditMode: 'none' | 'wall' | 'door' | 'window' | 'ceiling'
    
    // Undo/Redo state
    undoHistory: UndoAction[]
    redoHistory: UndoAction[]
    canUndo: boolean
    canRedo: boolean
}

// Store Actions Interface
interface SceneActions {
    // Scene object actions
    addObject: (object: SceneObject) => void
    removeObject: (objectId: string) => void
    updateObject: (objectId: string, updates: Partial<SceneObject>) => void
    renameObject: (oldId: string, newId: string) => void
    setSceneObjects: (objects: SceneObject[]) => void
    clearAllObjects: () => void
    
    // Selection actions
    setSelectedObjectId: (objectId: string | null) => void
    setSelectedObjectIds: (objectIds: string[]) => void
    addToSelection: (objectId: string) => void
    removeFromSelection: (objectId: string) => void
    clearSelection: () => void
    setHoveredObjectId: (objectId: string | null) => void
    
    // Transform actions
    setTransformMode: (mode: TransformMode) => void
    setMoveToMode: (enabled: boolean) => void
    setMultiSelectMode: (enabled: boolean) => void
    setMultiSelectPivot: (pivot: Mesh | null) => void
    setMultiSelectInitialStates: (states: {[objectId: string]: MultiSelectInitialState}) => void
    
    // Appearance actions
    setCurrentColor: (color: string) => void
    setWireframeMode: (enabled: boolean) => void
    setShowGrid: (enabled: boolean) => void
    setSnapToGrid: (enabled: boolean) => void
    setSnapToObjects: (enabled: boolean) => void
    setShowConnectionPoints: (enabled: boolean) => void
    setGridSize: (size: number) => void
    setGridMesh: (mesh: Mesh | null) => void
    setCollisionDetectionEnabled: (enabled: boolean) => void
    
    // Movement control actions
    setMovementEnabled: (enabled: boolean) => void
    setMovementSpeed: (speed: number) => void
    
    // Object property actions
    setObjectVisibility: (objectId: string, visible: boolean) => void
    setObjectLocked: (objectId: string, locked: boolean) => void
    setTessellationQuality: (objectId: string, quality: number) => void
    updateTessellationQuality: (updates: {[objectId: string]: number}) => void
    
    // NURBS actions
    setControlPointVisualizations: (visualizations: ControlPointVisualization[]) => void
    addControlPointVisualization: (visualization: ControlPointVisualization) => void
    removeControlPointVisualization: (objectId: string) => void
    updateControlPointVisualization: (objectId: string, updates: Partial<ControlPointVisualization>) => void
    setSelectedControlPointIndex: (index: number | null) => void
    setSelectedControlPointMesh: (mesh: Mesh | null) => void
    
    // UI actions
    setActiveDropdown: (dropdown: string | null) => void
    setSidebarCollapsed: (collapsed: boolean) => void
    
    // AI and loading actions
    setIsLoading: (loading: boolean) => void
    setApiKey: (key: string) => void
    setShowApiKeyInput: (show: boolean) => void
    addToResponseLog: (message: string) => void
    setResponseLog: (log: string[]) => void
    setSceneInitialized: (initialized: boolean) => void
    setTextInput: (text: string) => void
    
    // GLB Import actions
    startImport: () => void
    importSuccess: () => void
    setImportError: (error: ImportError) => void
    clearImportError: () => void
    
    // Texture actions
    setTextureAssets: (assets: Map<string, TextureAsset>) => void
    addTextureAsset: (asset: TextureAsset) => void
    removeTextureAsset: (assetId: string) => void
    renameTextureAsset: (assetId: string, newName: string) => void
    setSelectedTextureId: (textureId: string | null) => void
    setIsUploadingTexture: (uploading: boolean) => void
    setTextureUploadError: (error: string | null) => void
    uploadTexture: (file: File) => Promise<string>
    applyTextureToObject: (objectId: string, textureId: string, textureType: TextureType) => void
    removeTextureFromObject: (objectId: string, textureType: TextureType) => void
    setTextureScale: (objectId: string, scale: { u: number; v: number }) => void
    setTextureOffset: (objectId: string, offset: { u: number; v: number }) => void
    loadDefaultTextures: () => void
    
    // Housing-specific actions
    addHousingComponent: (objectId: string, housingObject: ModularHousingObject) => void
    removeHousingComponent: (objectId: string) => void
    updateHousingComponent: (objectId: string, updates: Partial<ModularHousingObject>) => void
    addDoor: (objectId: string, wallId: string, door: Omit<Door, 'id' | 'wallId'>) => string
    removeDoor: (objectId: string, doorId: string) => void
    updateDoor: (objectId: string, doorId: string, updates: Partial<Door>) => void
    addWindow: (objectId: string, wallId: string, window: Omit<Window, 'id' | 'wallId'>) => string
    removeWindow: (objectId: string, windowId: string) => void
    updateWindow: (objectId: string, windowId: string, updates: Partial<Window>) => void
    changeWallThickness: (objectId: string, thickness: number, wallId?: string) => void
    toggleCeiling: (objectId: string, hasCeiling: boolean) => void
    toggleFloor: (objectId: string, hasFloor: boolean) => void
    addBuildingConnection: (connection: Omit<BuildingConnection, 'id'>) => string
    removeBuildingConnection: (connectionId: string) => void
    updateBuildingConnection: (connectionId: string, updates: Partial<BuildingConnection>) => void
    executeHousingOperation: (objectId: string, operation: HousingOperation) => void
    setSelectedWallId: (wallId: string | null) => void
    setSelectedDoorId: (doorId: string | null) => void
    setSelectedWindowId: (windowId: string | null) => void
    setHousingEditMode: (mode: 'none' | 'wall' | 'door' | 'window' | 'ceiling') => void
    
    // Housing-specific getters
    getHousingComponent: (objectId: string) => ModularHousingObject | undefined
    getSelectedWall: (objectId: string) => Wall | undefined
    getSelectedDoor: (objectId: string) => Door | undefined
    getSelectedWindow: (objectId: string) => Window | undefined
    getBuildingConnections: (objectId: string) => BuildingConnection[]
    
    // Computed getters
    getSelectedObject: () => SceneObject | undefined
    getSelectedObjects: () => SceneObject[]
    hasSelection: () => boolean
    getSelectableObjects: () => SceneObject[]
    isObjectSelected: (objectId: string) => boolean
    isObjectVisible: (objectId: string) => boolean
    isObjectLocked: (objectId: string) => boolean
    
    // Undo/Redo actions
    undo: () => void
    redo: () => void
    pushUndoAction: (action: UndoAction) => void
    clearUndoHistory: () => void
    executeUndoAction: (action: UndoAction) => void
}

// Create the store
export const useSceneStore = create<SceneState & SceneActions>()(
    devtools(
        (set, get) => ({
            // Initial state
            sceneObjects: [],
            selectedObjectId: null,
            selectedObjectIds: [],
            hoveredObjectId: null,
            
            transformMode: 'select',
            moveToMode: false,
            multiSelectMode: false,
            multiSelectPivot: null,
            multiSelectInitialStates: {},
            
            currentColor: '#3498db',
            wireframeMode: false,
            showGrid: true,
            snapToGrid: true,
            snapToObjects: true,
            showConnectionPoints: false,
            gridSize: 1,
            gridMesh: null,
            collisionDetectionEnabled: false,
            
            // Movement controls initial state (load from localStorage if available)
            movementEnabled: (() => {
                try {
                    const saved = localStorage.getItem('vibecad_movement_enabled')
                    return saved ? JSON.parse(saved) : false
                } catch (e) {
                    console.warn('Failed to load movement enabled setting from localStorage:', e)
                    return false
                }
            })(),
            movementSpeed: (() => {
                try {
                    const saved = localStorage.getItem('vibecad_movement_speed')
                    const parsed = saved ? JSON.parse(saved) : 0.1
                    return Math.max(0.05, Math.min(1.0, parsed)) // Ensure valid range
                } catch (e) {
                    console.warn('Failed to load movement speed setting from localStorage:', e)
                    return 0.1
                }
            })(),
            
            objectVisibility: {},
            objectLocked: {},
            tessellationQuality: {},
            
            controlPointVisualizations: [],
            selectedControlPointIndex: null,
            selectedControlPointMesh: null,
            
            activeDropdown: null,
            sidebarCollapsed: false,
            
            isLoading: false,
            apiKey: '',
            showApiKeyInput: true,
            responseLog: [],
            sceneInitialized: false,
            
            textInput: '',
            
            // GLB Import state
            isImporting: false,
            importError: null,
            
            // Texture state
            textureAssets: new Map(),
            selectedTextureId: null,
            isUploadingTexture: false,
            textureUploadError: null,
            defaultTexturesLoaded: false,
            
            // Housing-specific initial state
            housingComponents: {},
            buildingConnections: [],
            selectedWallId: null,
            selectedDoorId: null,
            selectedWindowId: null,
            housingEditMode: 'none',
            
            // Undo/Redo initial state
            undoHistory: [],
            redoHistory: [],
            canUndo: false,
            canRedo: false,
            
            // Actions
            addObject: (object) => {
                set((state) => ({
                    sceneObjects: [...state.sceneObjects, object]
                }))
                // Track for undo
                get().pushUndoAction(createAddObjectAction(object))
            },
            
            removeObject: (objectId) => {
                const state = get()
                const objectToRemove = state.sceneObjects.find(obj => obj.id === objectId)
                
                if (objectToRemove) {
                    set((state) => ({
                        sceneObjects: state.sceneObjects.filter(obj => obj.id !== objectId),
                        selectedObjectId: state.selectedObjectId === objectId ? null : state.selectedObjectId,
                        selectedObjectIds: state.selectedObjectIds.filter(id => id !== objectId)
                    }))
                    // Track for undo
                    get().pushUndoAction(createRemoveObjectAction(objectToRemove))
                }
            },
            
            updateObject: (objectId, updates) => {
                console.log(`📝 updateObject called for ${objectId}:`, updates)
                const state = get()
                const existingObject = state.sceneObjects.find(obj => obj.id === objectId)
                
                if (existingObject) {
                    // Extract only the properties being updated for the undo action
                    // Properly clone Vector3 objects to avoid reference issues
                    const previousValues: any = {}
                    Object.keys(updates).forEach(key => {
                        const value = existingObject[key as keyof typeof existingObject]
                        if (value instanceof Vector3) {
                            previousValues[key] = value.clone()
                        } else {
                            previousValues[key] = value
                        }
                    })
                    
                    set((state) => ({
                        sceneObjects: state.sceneObjects.map(obj => 
                            obj.id === objectId ? (() => { 
                                const updated = { ...obj, ...updates };
                                if (updates.rotation) {
                                  console.log(`📝 sceneStore: Updated rotation for ${objectId} to (${updates.rotation.x.toFixed(3)}, ${updates.rotation.y.toFixed(3)}, ${updates.rotation.z.toFixed(3)})`);
                                }
                                return updated;
                            })() : obj
                        )
                    }))
                    
                    // Track for undo - also clone Vector3s in updates for consistency
                    const clonedUpdates: any = {}
                    Object.keys(updates).forEach(key => {
                        const value = updates[key as keyof typeof updates]
                        if (value instanceof Vector3) {
                            clonedUpdates[key] = value.clone()
                        } else {
                            clonedUpdates[key] = value
                        }
                    })
                    
                    get().pushUndoAction(createUpdateObjectAction(objectId, clonedUpdates, previousValues))
                    console.log(`🔄 Undo: Tracked object update for ${objectId}:`, Object.keys(clonedUpdates))
                }
            },
            
            renameObject: (oldId: string, newId: string) => {
                const { sceneObjects, pushUndoAction } = get()
                const objectToRename = sceneObjects.find(obj => obj.id === oldId)
                if (!objectToRename || sceneObjects.some(obj => obj.id === newId)) {
                    console.warn(`Cannot rename: oldId ${oldId} not found or newId ${newId} already exists.`)
                    return
                }

                pushUndoAction(createRenameAction(newId, oldId, objectToRename))
                get()._renameObject(oldId, newId)
            },
            
            setSceneObjects: (objects) => set({ sceneObjects: objects }),
            
            clearAllObjects: () => set((state) => ({
                sceneObjects: state.sceneObjects.filter(obj => obj.type === 'ground'),
                selectedObjectId: null,
                selectedObjectIds: [],
                hoveredObjectId: null
            })),
            
            setSelectedObjectId: (objectId) => set({ 
                selectedObjectId: objectId,
                selectedObjectIds: []
            }),
            
            setSelectedObjectIds: (objectIds) => set({ 
                selectedObjectIds: objectIds,
                selectedObjectId: null
            }),
            
            addToSelection: (objectId) => set((state) => ({
                selectedObjectIds: state.selectedObjectIds.includes(objectId) 
                    ? state.selectedObjectIds 
                    : [...state.selectedObjectIds, objectId]
            })),
            
            removeFromSelection: (objectId) => set((state) => ({
                selectedObjectIds: state.selectedObjectIds.filter(id => id !== objectId)
            })),
            
            clearSelection: () => set({
                selectedObjectId: null,
                selectedObjectIds: [],
                selectedControlPointIndex: null,
                selectedControlPointMesh: null
            }),
            
            setHoveredObjectId: (objectId) => set({ hoveredObjectId: objectId }),
            
            setTransformMode: (mode) => set({ transformMode: mode }),
            setMoveToMode: (enabled) => {
                set(state => {
                    if (enabled) {
                        // When entering move-to mode, disable other gizmos
                        return { moveToMode: true, transformMode: 'select' }
                    }
                    return { moveToMode: false }
                })
            },
            setMultiSelectMode: (enabled) => set({ multiSelectMode: enabled }),
            setMultiSelectPivot: (pivot) => set({ multiSelectPivot: pivot }),
            
            setMultiSelectInitialStates: (states) => set({ multiSelectInitialStates: states }),
            
            setCurrentColor: (color) => set({ currentColor: color }),
            
            setWireframeMode: (enabled) => set({ wireframeMode: enabled }),
            
            setShowGrid: (enabled) => set({ showGrid: enabled }),
            
            setSnapToGrid: (enabled) => set({ snapToGrid: enabled }),
            
            setSnapToObjects: (enabled: boolean) => set({ snapToObjects: enabled }),
            
            setShowConnectionPoints: (enabled: boolean) => set({ showConnectionPoints: enabled }),
            
            setGridSize: (size) => set({ gridSize: size }),
            
            setGridMesh: (mesh) => set({ gridMesh: mesh }),
            
            setCollisionDetectionEnabled: (enabled) => set({ collisionDetectionEnabled: enabled }),
            
            // Movement control actions
            setMovementEnabled: (enabled) => {
                set({ movementEnabled: enabled })
                // Persist to localStorage
                try {
                    localStorage.setItem('vibecad_movement_enabled', JSON.stringify(enabled))
                } catch (e) {
                    console.warn('Failed to save movement enabled setting to localStorage:', e)
                }
            },
            setMovementSpeed: (speed) => {
                const clampedSpeed = Math.max(0.05, Math.min(1.0, speed))
                set({ movementSpeed: clampedSpeed })
                // Persist to localStorage
                try {
                    localStorage.setItem('vibecad_movement_speed', JSON.stringify(clampedSpeed))
                } catch (e) {
                    console.warn('Failed to save movement speed setting to localStorage:', e)
                }
            },
            
            setObjectVisibility: (objectId, visible) => {
                const state = get()
                const previousVisible = state.objectVisibility[objectId] !== false // default is true
                
                if (previousVisible !== visible) {
                    set((state) => ({
                        objectVisibility: { ...state.objectVisibility, [objectId]: visible }
                    }))
                    // Track for undo
                    get().pushUndoAction(createSetObjectVisibilityAction(objectId, visible, previousVisible))
                }
            },
            
            setObjectLocked: (objectId, locked) => {
                const state = get()
                const previousLocked = state.objectLocked[objectId] || false
                
                if (previousLocked !== locked) {
                    set((state) => ({
                        objectLocked: { ...state.objectLocked, [objectId]: locked }
                    }))
                    // Track for undo
                    get().pushUndoAction(createSetObjectLockedAction(objectId, locked, previousLocked))
                }
            },
            
            setTessellationQuality: (objectId, quality) => set((state) => ({
                tessellationQuality: { ...state.tessellationQuality, [objectId]: quality }
            })),
            
            updateTessellationQuality: (updates) => set((state) => ({
                tessellationQuality: { ...state.tessellationQuality, ...updates }
            })),
            
            setControlPointVisualizations: (visualizations) => set({ controlPointVisualizations: visualizations }),
            
            addControlPointVisualization: (visualization) => set((state) => ({
                controlPointVisualizations: [
                    ...state.controlPointVisualizations.filter(viz => viz.objectId !== visualization.objectId),
                    visualization
                ]
            })),
            
            removeControlPointVisualization: (objectId) => set((state) => ({
                controlPointVisualizations: state.controlPointVisualizations.filter(viz => viz.objectId !== objectId)
            })),
            
            updateControlPointVisualization: (objectId, updates) => set((state) => ({
                controlPointVisualizations: state.controlPointVisualizations.map(viz =>
                    viz.objectId === objectId ? { ...viz, ...updates } : viz
                )
            })),
            
            setSelectedControlPointIndex: (index) => set({ selectedControlPointIndex: index }),
            
            setSelectedControlPointMesh: (mesh) => set({ selectedControlPointMesh: mesh }),
            
            setActiveDropdown: (dropdown) => set({ activeDropdown: dropdown }),
            
            setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
            
            setIsLoading: (loading) => set({ isLoading: loading }),
            
            setApiKey: (key) => set({ apiKey: key }),
            
            setShowApiKeyInput: (show) => set({ showApiKeyInput: show }),
            
            addToResponseLog: (message) => set((state) => ({
                responseLog: [...state.responseLog, message]
            })),
            
            setResponseLog: (log) => set({ responseLog: log }),
            
            setSceneInitialized: (initialized) => set({ sceneInitialized: initialized }),
            
            setTextInput: (text) => set({ textInput: text }),
            
            // GLB Import actions
            startImport: () => set({ isImporting: true, importError: null }),
            importSuccess: () => set({ isImporting: false }),
            setImportError: (error) => set({ isImporting: false, importError: error }),
            clearImportError: () => set({ importError: null }),
            
            // Texture actions
            setTextureAssets: (assets) => set({ textureAssets: assets }),
            addTextureAsset: (asset) => set((state) => ({
                textureAssets: new Map([...state.textureAssets, [asset.id, asset]])
            })),
            removeTextureAsset: (assetId) => set((state) => {
                const newAssets = new Map(state.textureAssets);
                newAssets.delete(assetId);
                return { textureAssets: newAssets };
            }),
            renameTextureAsset: (assetId, newName) => set((state) => {
                const newAssets = new Map(state.textureAssets);
                const asset = newAssets.get(assetId);
                if (asset) {
                    asset.name = newName;
                }
                return { textureAssets: newAssets };
            }),
            setSelectedTextureId: (textureId) => set({ selectedTextureId: textureId }),
            setIsUploadingTexture: (uploading) => set({ isUploadingTexture: uploading }),
            setTextureUploadError: (error) => set({ textureUploadError: error }),
            
            uploadTexture: async (file) => {
                const state = get();
                
                // Generate texture ID
                const textureId = `texture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                
                // Create texture asset (actual file processing will be handled by TextureManager)
                const textureAsset: TextureAsset = {
                    id: textureId,
                    name: file.name,
                    url: '', // Will be set by TextureManager
                    type: 'diffuse', // Default type
                    fileSize: file.size,
                    dimensions: { width: 0, height: 0 }, // Will be updated after loading
                    uploadedAt: Date.now()
                };
                
                // Add to store
                set((state) => ({
                    textureAssets: new Map([...state.textureAssets, [textureId, textureAsset]])
                }));
                
                return textureId;
            },
            
            applyTextureToObject: (objectId, textureId, textureType) => {
                set((state) => ({
                    sceneObjects: state.sceneObjects.map(obj => {
                        if (obj.id === objectId) {
                            return {
                                ...obj,
                                textureIds: {
                                    ...obj.textureIds,
                                    [textureType]: textureId
                                }
                            };
                        }
                        return obj;
                    })
                }));
            },
            
            removeTextureFromObject: (objectId, textureType) => {
                set((state) => ({
                    sceneObjects: state.sceneObjects.map(obj => {
                        if (obj.id === objectId && obj.textureIds) {
                            const newTextureIds = { ...obj.textureIds };
                            delete newTextureIds[textureType];
                            return {
                                ...obj,
                                textureIds: Object.keys(newTextureIds).length > 0 ? newTextureIds : undefined,
                                // Ensure color is included in the update for proper restoration
                                color: obj.color
                            };
                        }
                        return obj;
                    })
                }));
            },
            
            setTextureScale: (objectId, scale) => {
                set((state) => ({
                    sceneObjects: state.sceneObjects.map(obj => {
                        if (obj.id === objectId) {
                            return {
                                ...obj,
                                textureScale: scale
                            };
                        }
                        return obj;
                    })
                }));
            },
            
            setTextureOffset: (objectId, offset) => {
                set((state) => ({
                    sceneObjects: state.sceneObjects.map(obj => {
                        if (obj.id === objectId) {
                            return {
                                ...obj,
                                textureOffset: offset
                            };
                        }
                        return obj;
                    })
                }));
            },
            
            loadDefaultTextures: async () => {
                const state = get();
                if (state.defaultTexturesLoaded) {
                    return; // Already loaded
                }
                
                // Lazy import to avoid circular dependencies
                const { getAllDefaultTextures } = await import('../config/defaultTextures');
                const defaultTextures = getAllDefaultTextures();
                
                // Add default textures to the store
                const newTextureAssets = new Map(state.textureAssets);
                defaultTextures.forEach(texture => {
                    newTextureAssets.set(texture.id, texture);
                });
                
                set({ 
                    textureAssets: newTextureAssets,
                    defaultTexturesLoaded: true
                });
                
                console.log(`✅ Loaded ${defaultTextures.length} default textures`);
            },
            
            // Housing-specific actions
            addHousingComponent: (objectId, housingObject) => set((state) => ({
                housingComponents: { ...state.housingComponents, [objectId]: housingObject }
            })),
            
            removeHousingComponent: (objectId) => set((state) => {
                const newComponents = { ...state.housingComponents };
                delete newComponents[objectId];
                return { housingComponents: newComponents };
            }),
            
            updateHousingComponent: (objectId, updates) => set((state) => ({
                housingComponents: {
                    ...state.housingComponents,
                    [objectId]: { ...state.housingComponents[objectId], ...updates }
                }
            })),
            
            addDoor: (objectId, wallId, door) => {
                const state = get();
                const housing = state.housingComponents[objectId];
                if (!housing) return '';
                
                const wall = housing.walls.find(w => w.id === wallId);
                if (!wall) return '';
                
                const doorId = `door-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const newDoor: Door = { ...door, id: doorId, wallId };
                
                wall.doors.push(newDoor);
                housing.doors.push(newDoor);
                
                set((state) => ({
                    housingComponents: {
                        ...state.housingComponents,
                        [objectId]: housing
                    }
                }));
                
                return doorId;
            },
            
            removeDoor: (objectId, doorId) => set((state) => {
                const housing = state.housingComponents[objectId];
                if (!housing) return state;
                
                const door = housing.doors.find(d => d.id === doorId);
                if (!door) return state;
                
                const wall = housing.walls.find(w => w.id === door.wallId);
                if (wall) {
                    wall.doors = wall.doors.filter(d => d.id !== doorId);
                }
                
                housing.doors = housing.doors.filter(d => d.id !== doorId);
                
                return {
                    housingComponents: {
                        ...state.housingComponents,
                        [objectId]: housing
                    }
                };
            }),
            
            updateDoor: (objectId, doorId, updates) => set((state) => {
                const housing = state.housingComponents[objectId];
                if (!housing) return state;
                
                const door = housing.doors.find(d => d.id === doorId);
                if (!door) return state;
                
                const wall = housing.walls.find(w => w.id === door.wallId);
                if (wall) {
                    const wallDoor = wall.doors.find(d => d.id === doorId);
                    if (wallDoor) {
                        Object.assign(wallDoor, updates);
                    }
                }
                
                Object.assign(door, updates);
                
                return {
                    housingComponents: {
                        ...state.housingComponents,
                        [objectId]: housing
                    }
                };
            }),
            
            addWindow: (objectId, wallId, window) => {
                const state = get();
                const housing = state.housingComponents[objectId];
                if (!housing) return '';
                
                const wall = housing.walls.find(w => w.id === wallId);
                if (!wall) return '';
                
                const windowId = `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const newWindow: Window = { ...window, id: windowId, wallId };
                
                wall.windows.push(newWindow);
                housing.windows.push(newWindow);
                
                set((state) => ({
                    housingComponents: {
                        ...state.housingComponents,
                        [objectId]: housing
                    }
                }));
                
                return windowId;
            },
            
            removeWindow: (objectId, windowId) => set((state) => {
                const housing = state.housingComponents[objectId];
                if (!housing) return state;
                
                const window = housing.windows.find(w => w.id === windowId);
                if (!window) return state;
                
                const wall = housing.walls.find(w => w.id === window.wallId);
                if (wall) {
                    wall.windows = wall.windows.filter(w => w.id !== windowId);
                }
                
                housing.windows = housing.windows.filter(w => w.id !== windowId);
                
                return {
                    housingComponents: {
                        ...state.housingComponents,
                        [objectId]: housing
                    }
                };
            }),
            
            updateWindow: (objectId, windowId, updates) => set((state) => {
                const housing = state.housingComponents[objectId];
                if (!housing) return state;
                
                const window = housing.windows.find(w => w.id === windowId);
                if (!window) return state;
                
                const wall = housing.walls.find(w => w.id === window.wallId);
                if (wall) {
                    const wallWindow = wall.windows.find(w => w.id === windowId);
                    if (wallWindow) {
                        Object.assign(wallWindow, updates);
                    }
                }
                
                Object.assign(window, updates);
                
                return {
                    housingComponents: {
                        ...state.housingComponents,
                        [objectId]: housing
                    }
                };
            }),
            
            changeWallThickness: (objectId, thickness, wallId) => set((state) => {
                const housing = state.housingComponents[objectId];
                if (!housing) return state;
                
                if (wallId) {
                    const wall = housing.walls.find(w => w.id === wallId);
                    if (wall) {
                        wall.thickness = thickness;
                    }
                } else {
                    housing.walls.forEach(wall => {
                        wall.thickness = thickness;
                    });
                    housing.wallThickness = thickness;
                }
                
                return {
                    housingComponents: {
                        ...state.housingComponents,
                        [objectId]: housing
                    }
                };
            }),
            
            toggleCeiling: (objectId, hasCeiling) => set((state) => {
                const housing = state.housingComponents[objectId];
                if (!housing) return state;
                
                housing.hasCeiling = hasCeiling;
                
                return {
                    housingComponents: {
                        ...state.housingComponents,
                        [objectId]: housing
                    }
                };
            }),
            
            toggleFloor: (objectId, hasFloor) => set((state) => {
                const housing = state.housingComponents[objectId];
                if (!housing) return state;
                
                housing.hasFloor = hasFloor;
                
                return {
                    housingComponents: {
                        ...state.housingComponents,
                        [objectId]: housing
                    }
                };
            }),
            
            addBuildingConnection: (connection) => {
                const connectionId = `connection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const newConnection: BuildingConnection = { ...connection, id: connectionId };
                
                set((state) => ({
                    buildingConnections: [...state.buildingConnections, newConnection]
                }));
                
                return connectionId;
            },
            
            removeBuildingConnection: (connectionId) => set((state) => ({
                buildingConnections: state.buildingConnections.filter(conn => conn.id !== connectionId)
            })),
            
            updateBuildingConnection: (connectionId, updates) => set((state) => ({
                buildingConnections: state.buildingConnections.map(conn =>
                    conn.id === connectionId ? { ...conn, ...updates } : conn
                )
            })),
            
            executeHousingOperation: (objectId, operation) => {
                const actions = get();
                
                switch (operation.type) {
                    case 'add-door':
                        actions.addDoor(objectId, operation.wallId, operation.door);
                        break;
                    case 'remove-door':
                        actions.removeDoor(objectId, operation.doorId);
                        break;
                    case 'add-window':
                        actions.addWindow(objectId, operation.wallId, operation.window);
                        break;
                    case 'remove-window':
                        actions.removeWindow(objectId, operation.windowId);
                        break;
                    case 'change-wall-thickness':
                        actions.changeWallThickness(objectId, operation.thickness, operation.wallId);
                        break;
                    case 'toggle-ceiling':
                        actions.toggleCeiling(objectId, operation.hasCeiling);
                        break;
                    case 'toggle-floor':
                        actions.toggleFloor(objectId, operation.hasFloor);
                        break;
                    case 'connect-buildings':
                        actions.addBuildingConnection(operation.connection);
                        break;
                    case 'disconnect-buildings':
                        actions.removeBuildingConnection(operation.connectionId);
                        break;
                }
            },
            
            setSelectedWallId: (wallId) => set({ selectedWallId: wallId }),
            
            setSelectedDoorId: (doorId) => set({ selectedDoorId: doorId }),
            
            setSelectedWindowId: (windowId) => set({ selectedWindowId: windowId }),
            
            setHousingEditMode: (mode) => set({ housingEditMode: mode }),
            
            // Housing-specific getters
            getHousingComponent: (objectId) => {
                const state = get();
                return state.housingComponents[objectId];
            },
            
            getSelectedWall: (objectId) => {
                const state = get();
                const housing = state.housingComponents[objectId];
                if (!housing || !state.selectedWallId) return undefined;
                return housing.walls.find(w => w.id === state.selectedWallId);
            },
            
            getSelectedDoor: (objectId) => {
                const state = get();
                const housing = state.housingComponents[objectId];
                if (!housing || !state.selectedDoorId) return undefined;
                return housing.doors.find(d => d.id === state.selectedDoorId);
            },
            
            getSelectedWindow: (objectId) => {
                const state = get();
                const housing = state.housingComponents[objectId];
                if (!housing || !state.selectedWindowId) return undefined;
                return housing.windows.find(w => w.id === state.selectedWindowId);
            },
            
            getBuildingConnections: (objectId) => {
                const state = get();
                return state.buildingConnections.filter(conn => 
                    conn.fromObjectId === objectId || conn.toObjectId === objectId
                );
            },
            
            // Computed getters
            getSelectedObject: () => {
                const state = get()
                return state.sceneObjects.find(obj => obj.id === state.selectedObjectId)
            },
            
            getSelectedObjects: () => {
                const state = get()
                return state.sceneObjects.filter(obj => state.selectedObjectIds.includes(obj.id))
            },
            
            hasSelection: () => {
                const state = get()
                return state.selectedObjectId !== null || state.selectedObjectIds.length > 0
            },
            
            getSelectableObjects: () => {
                const state = get()
                return state.sceneObjects.filter(obj => 
                    obj.type !== 'ground' && !state.objectLocked[obj.id]
                )
            },
            
            isObjectSelected: (objectId) => {
                const state = get()
                return state.selectedObjectId === objectId || state.selectedObjectIds.includes(objectId)
            },
            
            isObjectVisible: (objectId) => {
                const state = get()
                return state.objectVisibility[objectId] !== false
            },
            
            isObjectLocked: (objectId) => {
                const state = get()
                return state.objectLocked[objectId] === true
            },
            
            // Undo/Redo implementation
            undo: () => {
                const state = get()
                if (state.undoHistory.length === 0) return
                
                const lastAction = state.undoHistory[state.undoHistory.length - 1]
                const newUndoHistory = state.undoHistory.slice(0, -1)
                const newRedoHistory = [...state.redoHistory, lastAction]
                
                console.log('🔄 Undoing action:', lastAction.type, 'Payload:', lastAction.payload)
                console.log('🔄 Full undo history:', state.undoHistory.map(a => a.type))
                
                // Execute the inverse action
                get().executeUndoAction(lastAction.inverse)
                
                // Update undo/redo state
                set({
                    undoHistory: newUndoHistory,
                    redoHistory: newRedoHistory,
                    canUndo: newUndoHistory.length > 0,
                    canRedo: true
                })
            },
            
            redo: () => {
                const state = get()
                if (state.redoHistory.length === 0) return
                
                const lastUndoneAction = state.redoHistory[state.redoHistory.length - 1]
                const newRedoHistory = state.redoHistory.slice(0, -1)
                const newUndoHistory = [...state.undoHistory, lastUndoneAction]
                
                console.log('🔄 Redoing action:', lastUndoneAction.type)
                
                // Re-execute the original action
                get().executeUndoAction(lastUndoneAction)
                
                // Update undo/redo state
                set({
                    undoHistory: newUndoHistory,
                    redoHistory: newRedoHistory,
                    canUndo: true,
                    canRedo: newRedoHistory.length > 0
                })
            },
            
            pushUndoAction: (action) => {
                set((state) => ({
                    undoHistory: [...state.undoHistory, action],
                    redoHistory: [], // Clear redo history on new action
                    canUndo: true,
                    canRedo: false
                }))
            },
            
            clearUndoHistory: () => {
                set({ undoHistory: [], redoHistory: [], canUndo: false, canRedo: false })
            },

            executeUndoAction: (action) => {
                switch (action.type) {
                    case 'ADD_OBJECT':
                        get().removeObject(action.payload.object.id)
                        break
                    case 'REMOVE_OBJECT':
                        get().addObject(action.payload.object)
                        break
                    case 'UPDATE_OBJECT':
                        get().updateObject(action.payload.objectId, action.payload.oldState)
                        break
                    case 'RENAME_OBJECT':
                        get().renameObject(action.payload.newId, action.payload.oldId)
                        break
                    case 'SET_OBJECT_LOCKED':
                        get().setObjectLocked(action.payload.objectId, action.payload.oldLocked)
                        break
                    case 'SET_OBJECT_VISIBILITY':
                        get().setObjectVisibility(action.payload.objectId, action.payload.oldVisible)
                        break
                    case 'BATCH_DELETE':
                        action.payload.objects.forEach(obj => get().addObject(obj))
                        break
                }
            }
        }),
        {
            name: 'vibecad-scene-store',
        }
    )
)

// Export types for use in components
export type { 
    SceneState, 
    SceneActions, 
    SceneObject, 
    ControlPointVisualization, 
    TransformMode, 
    PrimitiveType,
    ModularHousingObject,
    BuildingConnection,
    HousingOperation,
    Door,
    Window,
    Wall,
    ImportError,
    TextureAsset,
    TextureType
}
