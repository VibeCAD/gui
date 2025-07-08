import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { Vector3, Mesh } from 'babylonjs'
import type { 
    TransformMode, 
    PrimitiveType, 
    SceneObject, 
    ControlPointVisualization, 
    MultiSelectInitialState 
} from '../types/types'

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
    gridSize: number
    gridMesh: Mesh | null
    
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
    setGridSize: (size: number) => void
    setGridMesh: (mesh: Mesh | null) => void
    
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
    
    // Computed getters
    getSelectedObject: () => SceneObject | undefined
    getSelectedObjects: () => SceneObject[]
    hasSelection: () => boolean
    getSelectableObjects: () => SceneObject[]
    isObjectSelected: (objectId: string) => boolean
    isObjectVisible: (objectId: string) => boolean
    isObjectLocked: (objectId: string) => boolean
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
            gridSize: 1,
            gridMesh: null,
            
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
            
            setGridSize: (size) => set({ gridSize: size }),
            
            setGridMesh: (mesh) => set({ gridMesh: mesh }),
            
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
            }
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
                multiSelectMode: state.multiSelectMode
            })
        }
    )
)

// Export types for use in components
export type { SceneState, SceneActions, SceneObject, ControlPointVisualization, TransformMode, PrimitiveType }
