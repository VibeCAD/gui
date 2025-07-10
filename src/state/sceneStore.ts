import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { temporal, type TemporalState } from 'zundo'
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
    ImportError,
    TextureAsset,
    TextureType,
} from '../types/types'
import type { Wall } from '../models/Wall'
import type { Opening } from '../models/Opening'

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
    collisionDetectionEnabled: boolean
    
    // Object properties
    objectVisibility: {[key: string]: boolean}
    objectLocked: {[key: string]: boolean}
    tessellationQuality: {[objectId: string]: number}
    
    // NURBS specific
    controlPointVisualizations: ControlPointVisualization[]
    selectedControlPointIndex: number | null
    
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
    
    // Parametric walls and openings
    walls: Wall[]
    
    // Housing-specific state
    housingComponents: {[objectId:string]: ModularHousingObject}
    buildingConnections: BuildingConnection[]
    housingEditMode: 'none' | 'wall' | 'door' | 'window' | 'ceiling'
    
    // Add opening mode
    isAddingOpening: boolean
    openingPreview: {
        wallId: string
        opening: Opening
    } | null

    // Selected opening
    selectedOpeningId: string | null
}

interface SceneActions {
    addObject: (object: SceneObject) => void
    removeObject: (objectId: string) => void
    updateObject: (objectId: string, updates: Partial<SceneObject>) => void
    setSceneObjects: (objects: SceneObject[]) => void
    clearAllObjects: () => void
    
    setSelectedObjectId: (objectId: string | null) => void
    setSelectedObjectIds: (objectIds: string[]) => void
    addToSelection: (objectId: string) => void
    removeFromSelection: (objectId: string) => void
    clearSelection: () => void
    setHoveredObjectId: (objectId: string | null) => void
    
    setTransformMode: (mode: TransformMode) => void
    setMultiSelectMode: (enabled: boolean) => void
    setMultiSelectPivot: (pivot: Mesh | null) => void
    setMultiSelectInitialStates: (states: {[objectId: string]: MultiSelectInitialState}) => void
    
    setCurrentColor: (color: string) => void
    setWireframeMode: (enabled: boolean) => void
    setShowGrid: (enabled: boolean) => void
    setSnapToGrid: (enabled: boolean) => void
    setSnapToObjects: (enabled: boolean) => void
    setShowConnectionPoints: (enabled: boolean) => void
    setGridSize: (size: number) => void
    setCollisionDetectionEnabled: (enabled: boolean) => void
    
    setObjectVisibility: (objectId: string, visible: boolean) => void
    setObjectLocked: (objectId: string, locked: boolean) => void
    setTessellationQuality: (objectId: string, quality: number) => void
    updateTessellationQuality: (updates: {[objectId: string]: number}) => void
    
    setControlPointVisualizations: (visualizations: ControlPointVisualization[]) => void
    addControlPointVisualization: (visualization: ControlPointVisualization) => void
    removeControlPointVisualization: (objectId: string) => void
    updateControlPointVisualization: (objectId: string, updates: Partial<ControlPointVisualization>) => void
    setSelectedControlPointIndex: (index: number | null) => void
    
    setActiveDropdown: (dropdown: string | null) => void
    setSidebarCollapsed: (collapsed: boolean) => void
    
    setIsLoading: (loading: boolean) => void
    setApiKey: (key: string) => void
    setShowApiKeyInput: (show: boolean) => void
    addToResponseLog: (message: string) => void
    setResponseLog: (log: string[]) => void
    setSceneInitialized: (initialized: boolean) => void
    setTextInput: (text: string) => void
    
    startImport: () => void
    importSuccess: () => void
    setImportError: (error: ImportError) => void
    clearImportError: () => void
    
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
    
    addWall: (wall: Wall) => void
    removeWall: (wallId: string) => void
    updateWall: (wallId: string, updates: Partial<Wall>) => void
    addOpeningToWall: (wallId: string, opening: Opening) => void
    removeOpeningFromWall: (wallId: string, openingId: string) => void
    updateOpeningInWall: (wallId: string, openingId: string, updates: Partial<Opening>) => void
    
    enterAddOpeningMode: (wallId: string, type: 'door' | 'window') => void
    exitAddOpeningMode: () => void
    updateOpeningPreview: (position: Vector3) => void
    
    setSelectedOpeningId: (openingId: string | null) => void
    
    addHousingComponent: (objectId: string, housingObject: ModularHousingObject) => void
    removeHousingComponent: (objectId: string) => void
    updateHousingComponent: (objectId: string, updates: Partial<ModularHousingObject>) => void
    changeWallThickness: (objectId: string, thickness: number, wallId?: string) => void
    toggleCeiling: (objectId: string, hasCeiling: boolean) => void
    toggleFloor: (objectId: string, hasFloor: boolean) => void
    addBuildingConnection: (connection: Omit<BuildingConnection, 'id'>) => string
    removeBuildingConnection: (connectionId: string) => void
    updateBuildingConnection: (connectionId: string, updates: Partial<BuildingConnection>) => void
    executeHousingOperation: (objectId: string, operation: HousingOperation) => void
    setHousingEditMode: (mode: 'none' | 'wall' | 'door' | 'window' | 'ceiling') => void
    
    getHousingComponent: (objectId: string) => ModularHousingObject | undefined
    getBuildingConnections: (objectId: string) => BuildingConnection[]
    
    getSelectedObject: () => SceneObject | undefined
    getSelectedObjects: () => SceneObject[]
    hasSelection: () => boolean
    getSelectableObjects: () => SceneObject[]
    isObjectSelected: (objectId: string) => boolean
    isObjectVisible: (objectId: string) => boolean
    isObjectLocked: (objectId: string) => boolean
}

type FullState = SceneState & SceneActions;

export const useSceneStore = create<FullState>()(
    devtools(
        temporal(
            (set, get): FullState => ({
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
                collisionDetectionEnabled: false,
                
                objectVisibility: {},
                objectLocked: {},
                tessellationQuality: {},
                
                controlPointVisualizations: [],
                selectedControlPointIndex: null,
                
                activeDropdown: null,
                sidebarCollapsed: false,
                
                isLoading: false,
                apiKey: '',
                showApiKeyInput: true,
                responseLog: [],
                sceneInitialized: false,
                
                textInput: '',
                
                isImporting: false,
                importError: null,
                
                textureAssets: new Map(),
                selectedTextureId: null,
                isUploadingTexture: false,
                textureUploadError: null,

                walls: [],
                
                housingComponents: {},
                buildingConnections: [],
                housingEditMode: 'none',

                isAddingOpening: false,
                openingPreview: null,

                selectedOpeningId: null,
                
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
                    hoveredObjectId: null,
                    walls: []
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
                }),
                
                setHoveredObjectId: (objectId) => set({ hoveredObjectId: objectId }),
                
                setTransformMode: (mode) => set({ transformMode: mode }),
                
                setMultiSelectMode: (enabled) => set({ multiSelectMode: enabled }),

                setMultiSelectPivot: (pivot) => set({ multiSelectPivot: pivot }),
                
                setMultiSelectInitialStates: (states) => set({ multiSelectInitialStates: states as any }),
                
                setCurrentColor: (color) => set({ currentColor: color }),
                
                setWireframeMode: (enabled) => set({ wireframeMode: enabled }),
                
                setShowGrid: (enabled) => set({ showGrid: enabled }),
                
                setSnapToGrid: (enabled) => set({ snapToGrid: enabled }),
                
                setSnapToObjects: (enabled: boolean) => set({ snapToObjects: enabled }),
                
                setShowConnectionPoints: (enabled: boolean) => set({ showConnectionPoints: enabled }),
                
                setGridSize: (size) => set({ gridSize: size }),
                
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
                
                startImport: () => set({ isImporting: true, importError: null }),
                importSuccess: () => set({ isImporting: false }),
                setImportError: (error) => set({ isImporting: false, importError: error }),
                clearImportError: () => set({ importError: null }),
                
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
                    const textureId = `texture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    const textureAsset: TextureAsset = {
                        id: textureId,
                        name: file.name,
                        url: '',
                        type: 'diffuse',
                        fileSize: file.size,
                        dimensions: { width: 0, height: 0 },
                        uploadedAt: Date.now()
                    };
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
                                    textureIds: Object.keys(newTextureIds).length > 0 ? newTextureIds : undefined
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
                                return { ...obj, textureScale: scale };
                            }
                            return obj;
                        })
                    }));
                },
                
                setTextureOffset: (objectId, offset) => {
                    set((state) => ({
                        sceneObjects: state.sceneObjects.map(obj => {
                            if (obj.id === objectId) {
                                return { ...obj, textureOffset: offset };
                            }
                            return obj;
                        })
                    }));
                },
                
                addWall: (wall) => set((state) => ({
                    walls: [...state.walls, wall]
                })),

                removeWall: (wallId) => set((state) => ({
                    walls: state.walls.filter(wall => wall.id !== wallId)
                })),

                updateWall: (wallId, updates) => set((state) => ({
                    walls: state.walls.map(wall => 
                        wall.id === wallId ? { ...wall, ...updates } : wall
                    )
                })),

                addOpeningToWall: (wallId, opening) => set((state) => ({
                    walls: state.walls.map(wall => {
                        if (wall.id === wallId) {
                            return { ...wall, openings: [...wall.openings, opening] };
                        }
                        return wall;
                    })
                })),

                removeOpeningFromWall: (wallId, openingId) => set((state) => ({
                    walls: state.walls.map(wall => {
                        if (wall.id === wallId) {
                            return { ...wall, openings: wall.openings.filter(op => op.id !== openingId) };
                        }
                        return wall;
                    })
                })),

                updateOpeningInWall: (wallId, openingId, updates) => set((state) => ({
                    walls: state.walls.map(wall => {
                        if (wall.id === wallId) {
                            return { ...wall, openings: wall.openings.map(op => op.id === openingId ? { ...op, ...updates } : op) };
                        }
                        return wall;
                    })
                })),
                
                enterAddOpeningMode: (wallId, type) => {
                    console.log(`Entering 'Add Opening' mode for wall: ${wallId}, type: ${type}`);
                    set({
                        isAddingOpening: true,
                        openingPreview: {
                            wallId,
                            opening: {
                                id: `preview-${type}`,
                                type: type,
                                parameters: {
                                    width: type === 'door' ? 1 : 1.2,
                                    height: type === 'door' ? 2 : 1,
                                    position: { offsetX: 0, elevation: type === 'window' ? 1 : 0 },
                                    frameThickness: 0.1
                                }
                            }
                        }
                    });
                },

                exitAddOpeningMode: () => set({
                    isAddingOpening: false,
                    openingPreview: null
                }),

                updateOpeningPreview: (position) => set((state) => {
                    if (!state.openingPreview) return state;
                    return state;
                }),
                
                setSelectedOpeningId: (openingId) => set({ selectedOpeningId: openingId }),
                
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

                changeWallThickness: (objectId, thickness, wallId) => set((state) => {
                    const housing = state.housingComponents[objectId];
                    if (!housing) return state;
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
                        case 'add-opening':
                            break;
                        case 'remove-opening':
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
                
                setHousingEditMode: (mode) => set({ housingEditMode: mode }),
                
                getHousingComponent: (objectId) => {
                    const state = get();
                    return state.housingComponents[objectId];
                },
                
                getBuildingConnections: (objectId) => {
                    const state = get();
                    return state.buildingConnections.filter(conn => 
                        conn.fromObjectId === objectId || conn.toObjectId === objectId
                    );
                },
                
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
                }
            }),
            {
                partialize: (state: FullState) => {
                    const { 
                        sceneObjects,
                        controlPointVisualizations,
                        multiSelectPivot, // Exclude non-serializable Mesh
                        ...rest 
                    } = state;

                    const serializableState: Partial<FullState> = {};
                    for (const key in rest) {
                        if (typeof (rest as any)[key] !== 'function') {
                            (serializableState as any)[key] = (rest as any)[key];
                        }
                    }
                    
                    const serializableSceneObjects = sceneObjects.map(obj => {
                        const { mesh, ...restObj } = obj;
                        return restObj;
                    });

                    const serializableCpViz = controlPointVisualizations.map(viz => {
                        const { controlPointMeshes, ...restViz } = viz;
                        return restViz;
                      });

                    return { 
                        ...serializableState, 
                        sceneObjects: serializableSceneObjects, 
                        walls: state.walls,
                        controlPointVisualizations: serializableCpViz,
                    } as Partial<FullState>;
                }
            }
        ),
        {
            name: 'scene-store',
        }
    )
)

export const useTemporalStore = useSceneStore as unknown as {
  getState: () => FullState & { temporal: TemporalState<FullState> };
  setState: (
    partial: FullState | Partial<FullState> | ((state: FullState) => FullState | Partial<FullState>),
    replace?: boolean | undefined
  ) => void;
  subscribe: (
    listener: (state: FullState, prevState: FullState) => void,
    selector?: (state: FullState) => any,
    equalityFn?: (a: any, b: any) => boolean
  ) => () => void;
  destroy: () => void;
  temporal: TemporalState<FullState>;
};


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
    ImportError,
    TextureAsset,
    TextureType,
    Wall,
    Opening
}
