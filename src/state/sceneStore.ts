import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { Mesh } from 'babylonjs'
import type { 
    TransformMode, 
    PrimitiveType, 
    SceneObject, 
    ControlPointVisualization, 
    MultiSelectInitialState,
    ImportError,
    ParametricWallParams,
    Opening,
    DoorOpeningParams,
    WindowOpeningParams
} from '../types/types'
import { Scene } from 'babylonjs'

// Store State Interface
interface SceneState {
    // Scene objects and selection
    sceneObjects: SceneObject[]
    selectedObjectId: string | null
    selectedObjectIds: string[]
    hoveredObjectId: string | null
    
    // Transform and interaction
    transformMode: TransformMode
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
    
    // Parametric wall state
    parametricWalls: {[objectId: string]: ParametricWallParams}
    selectedOpeningId: string | null

    // Preview meshes
    previewMeshes: Mesh[]
    addPreviewMesh: (mesh: Mesh) => void
    removeAllPreviews: () => void
    scene: Scene | null;
}

// Store Actions Interface
interface SceneActions {
    // Scene object actions
    addObject: (object: SceneObject) => void
    removeObject: (objectId: string) => void
    updateObject: (objectId: string, updates: Partial<SceneObject>) => void
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
    
    // Parametric wall actions
    addParametricWall: (wall: ParametricWallParams) => void
    updateParametricWall: (objectId: string, updates: Partial<ParametricWallParams>) => void
    removeParametricWall: (objectId: string) => void
    addOpeningToWall: (wallId: string, opening: Omit<Opening, 'id'>) => string
    updateOpeningInWall: (wallId: string, opening: Opening) => void
    removeOpeningFromWall: (wallId: string, openingId: string) => void
    setSelectedOpeningId: (openingId: string | null) => void
    getParametricWall: (objectId: string) => ParametricWallParams | undefined
    regenerateWallMesh: (wallId: string) => void
    
    // Computed getters
    getSelectedObject: () => SceneObject | undefined
    getSelectedObjects: () => SceneObject[]
    hasSelection: () => boolean
    getSelectableObjects: () => SceneObject[]
    isObjectSelected: (objectId: string) => boolean
    isObjectVisible: (objectId: string) => boolean
    isObjectLocked: (objectId: string) => boolean

    // Preview actions
    addPreviewMesh: (mesh: Mesh) => void
    removeAllPreviews: () => void
    setScene: (scene: Scene) => void
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
            multiSelectMode: false,
            multiSelectPivot: null,
            multiSelectInitialStates: {},
            
            currentColor: '#3498db',
            wireframeMode: false,
            showGrid: true,
            snapToGrid: false,
            snapToObjects: true,
            showConnectionPoints: false,
            gridSize: 1,
            gridMesh: null,
            collisionDetectionEnabled: true,
            
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
            
            // Parametric wall initial state
            parametricWalls: {},
            selectedOpeningId: null,

            // Preview meshes
            previewMeshes: [],
            addPreviewMesh: (mesh) => set(state => ({ previewMeshes: [...state.previewMeshes, mesh] })),
            removeAllPreviews: () => {
                const { previewMeshes } = get()
                previewMeshes.forEach(m => m.dispose())
                set({ previewMeshes: [] })
            },
            scene: null,
            
            // Actions
            addObject: (object) => set((state) => ({
                sceneObjects: [...state.sceneObjects, object]
            })),
            
            removeObject: (objectId) => set((state) => ({
                sceneObjects: state.sceneObjects.filter(obj => obj.id !== objectId),
                selectedObjectId: state.selectedObjectId === objectId ? null : state.selectedObjectId,
                selectedObjectIds: state.selectedObjectIds.filter(id => id !== objectId)
            })),
            
            updateObject: (objectId, updates) => set((state) => ({
                sceneObjects: state.sceneObjects.map(obj => 
                    obj.id === objectId ? { ...obj, ...updates } : obj
                )
            })),
            
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
            
            setObjectVisibility: (objectId, visible) => set((state) => ({
                objectVisibility: { ...state.objectVisibility, [objectId]: visible }
            })),
            
            setObjectLocked: (objectId, locked) => set((state) => ({
                objectLocked: { ...state.objectLocked, [objectId]: locked }
            })),
            
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
            
            // Parametric wall actions
            addParametricWall: (wall) => set((state) => ({
                parametricWalls: { ...state.parametricWalls, [wall.id]: wall }
            })),
            
            updateParametricWall: (objectId, updates) => set((state) => ({
                parametricWalls: {
                    ...state.parametricWalls,
                    [objectId]: { ...state.parametricWalls[objectId], ...updates }
                }
            })),
            
            removeParametricWall: (objectId) => set((state) => {
                const newWalls = { ...state.parametricWalls };
                delete newWalls[objectId];
                return { parametricWalls: newWalls };
            }),
            
            addOpeningToWall: (wallId, opening) => {
                const state = get();
                const wall = state.parametricWalls[wallId];
                if (!wall) return '';
                
                const openingId = `${opening.type}-opening-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                
                let newOpening: Opening;

                if (opening.type === 'door') {
                    newOpening = {
                        id: openingId,
                        type: 'door',
                        width: opening.width,
                        height: opening.height,
                        offset: opening.offset,
                    };
                } else if (opening.type === 'window') {
                    newOpening = {
                        id: openingId,
                        type: 'window',
                        width: opening.width,
                        height: opening.height,
                        offset: opening.offset,
                        sillHeight: opening.sillHeight,
                    };
                } else {
                    // This should not be reachable with the current Opening types
                    return '';
                }
                
                set((state) => ({
                    parametricWalls: {
                        ...state.parametricWalls,
                        [wallId]: {
                            ...wall,
                            openings: [...wall.openings, newOpening]
                        }
                    }
                }));
                
                // Trigger mesh regeneration
                get().regenerateWallMesh(wallId);
                
                return openingId;
            },
            
            removeOpeningFromWall: (wallId, openingId) => {
                set((state) => {
                    const wall = state.parametricWalls[wallId];
                    if (!wall) return state;
                    
                    return {
                        parametricWalls: {
                            ...state.parametricWalls,
                            [wallId]: {
                                ...wall,
                                openings: wall.openings.filter(opening => opening.id !== openingId)
                            }
                        }
                    };
                });
                
                // Trigger mesh regeneration
                get().regenerateWallMesh(wallId);
            },
            
            setSelectedOpeningId: (openingId) => set({ selectedOpeningId: openingId }),
            
            getParametricWall: (objectId) => {
                const state = get();
                return state.parametricWalls[objectId];
            },
            
            regenerateWallMesh: (wallId) => {
                const state = get();
                const wallParams = state.parametricWalls[wallId];
                if (!wallParams) return;
                
                const sceneObject = state.sceneObjects.find(obj => obj.id === wallId);
                if (!sceneObject || !sceneObject.mesh) return;
                
                // Mark that regeneration is needed
                // The actual regeneration will be handled by the scene manager
                // when it detects the parameter change
                set((state) => ({
                    sceneObjects: state.sceneObjects.map(obj =>
                        obj.id === wallId
                            ? { ...obj, needsRegeneration: true }
                            : obj
                    )
                }));
            },
            
            updateOpeningInWall: (wallId, opening) => {
                set((state) => {
                    const wall = state.parametricWalls[wallId];
                    if (!wall) return state;
                    return {
                        parametricWalls: {
                            ...state.parametricWalls,
                            [wallId]: {
                                ...wall,
                                openings: wall.openings.map(o => o.id === opening.id ? opening : o)
                            }
                        }
                    };
                });
                get().regenerateWallMesh(wallId);
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
            setScene: (scene: Scene) => set({ scene })
        }),
        {
            name: 'scene-store',
            partialize: (state: SceneState & SceneActions) => ({
                // Persist only non-Babylon.js objects to avoid serialization issues
                currentColor: state.currentColor,
                wireframeMode: state.wireframeMode,
                showGrid: state.showGrid,
                snapToGrid: state.snapToGrid,
                gridSize: state.gridSize,
                sidebarCollapsed: state.sidebarCollapsed,
                apiKey: state.apiKey,
                showApiKeyInput: state.showApiKeyInput,
                transformMode: state.transformMode,
                multiSelectMode: state.multiSelectMode,
                collisionDetectionEnabled: state.collisionDetectionEnabled
            })
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
    ImportError,
    ParametricWallParams,
    Opening,
    DoorOpeningParams,
    WindowOpeningParams
}
