import { Vector3, Vector2, Quaternion, Mesh } from 'babylonjs'

export type TransformMode = 'select' | 'move' | 'rotate' | 'scale'
export type PrimitiveType = 'cube' | 'sphere' | 'cylinder' | 'plane' | 'torus' | 'cone' | 'nurbs' | 
    'house-basic' | 'house-room' | 'house-hallway' | 'house-roof-flat' | 'house-roof-pitched' |
    'house-room-modular' | 'house-wall' | 'house-ceiling' | 'house-floor' |
    'house-door-single' | 'house-door-double' | 'house-door-sliding' | 'house-door-french' | 'house-door-garage' |
    'house-window-single' | 'house-window-double' | 'house-window-bay' | 'house-window-casement' | 'house-window-sliding' | 'house-window-skylight' |
    'house-stairs' | 'house-foundation' | 'imported-glb' | 'imported-stl' | 'imported-obj' | 'custom-room'

// Import error types
export type ImportErrorType = 'FILE_TOO_LARGE' | 'INVALID_FORMAT' | 'LOADING_FAILED'

export interface ImportError {
    type: ImportErrorType
    message: string
}

// Texture types
export type TextureType = 'diffuse' | 'normal' | 'specular' | 'emissive'

export interface TextureAsset {
    id: string
    name: string
    url: string
    type: TextureType
    fileSize: number
    dimensions: {
        width: number
        height: number
    }
    uploadedAt: number
}

// Housing component types
export type HousingComponentType = 'wall' | 'door' | 'window' | 'ceiling' | 'floor' | 'foundation'
export type DoorType = 'single' | 'double' | 'sliding' | 'french' | 'garage'
export type WindowType = 'single' | 'double' | 'bay' | 'casement' | 'sliding' | 'skylight'
export type WallType = 'interior' | 'exterior' | 'load-bearing' | 'partition'

// Door component interface
export interface Door {
    id: string
    type: DoorType
    width: number
    height: number
    thickness: number
    position: Vector3  // Position relative to the wall
    wallId: string     // ID of the wall this door belongs to
    isOpen: boolean
    openDirection: 'inward' | 'outward'
    hingeDirection: 'left' | 'right'
    color: string
    material?: string
}

// Window component interface
export interface Window {
    id: string
    type: WindowType
    width: number
    height: number
    position: Vector3  // Position relative to the wall
    wallId: string     // ID of the wall this window belongs to
    sillHeight: number // Height from floor to window sill
    hasFrame: boolean
    frameThickness: number
    color: string
    material?: string
    isOpen?: boolean   // For openable windows
}

// Wall component interface
export interface Wall {
    id: string
    type: WallType
    startPoint: Vector3
    endPoint: Vector3
    height: number
    thickness: number
    color: string
    material?: string
    doors: Door[]
    windows: Window[]
    isLoadBearing: boolean
    connectedWalls: string[]  // IDs of walls this wall connects to
}

// Housing component base interface
export interface HousingComponent {
    id: string
    type: HousingComponentType
    parentId: string  // ID of the parent housing object
    position: Vector3
    rotation: Vector3
    scale: Vector3
    color: string
    material?: string
    isVisible: boolean
    isLocked: boolean
}

// Ceiling features interface
export interface CeilingFeatures {
    hasLights?: boolean
    hasFan?: boolean
    hasSkylight?: boolean
    hasBeams?: boolean
}

// Floor features interface
export interface FloorFeatures {
    hasBaseboards?: boolean
    hasHeating?: boolean
    hasTransition?: boolean
}

// Modular housing object interface
export interface ModularHousingObject extends SceneObject {
    housingType: 'modular-room' | 'modular-house' | 'modular-building'
    wallThickness: number
    hasCeiling: boolean
    hasFloor: boolean
    hasFoundation: boolean
    walls: Wall[]
    doors: Door[]
    windows: Window[]
    ceilingHeight: number
    floorThickness: number
    foundationHeight: number
    buildingConnections: string[]  // IDs of other housing objects this connects to
    roomType?: 'bedroom' | 'kitchen' | 'bathroom' | 'living-room' | 'dining-room' | 'office' | 'hallway' | 'garage'
    
    // Enhanced ceiling properties
    ceilingType?: 'flat' | 'vaulted' | 'coffered' | 'tray' | 'cathedral' | 'beam'
    ceilingMaterial?: string
    ceilingThickness?: number
    ceilingFeatures?: CeilingFeatures
    
    // Enhanced floor properties
    floorMaterial?: string
    floorFeatures?: FloorFeatures
}

// Building connection interface
export interface BuildingConnection {
    id: string
    fromObjectId: string
    toObjectId: string
    fromWallId: string
    toWallId: string
    connectionType: 'door' | 'opening' | 'seamless'
    doorId?: string  // If connectionType is 'door'
    isActive: boolean
}

// Scene Object (preserving info after scene change)
export interface SceneObject {
    id: string
    type: string
    position: Vector3
    scale: Vector3
    rotation: Vector3
    color: string
    mesh?: Mesh
    isNurbs: boolean
    frontFace?: Vector3  // Direction that represents "forward" for this object (default: +Z)
    verbData?: {
      controlPoints: number[][][]
      knotsU: number[]
      knotsV: number[]
      degreeU: number
      degreeV: number
      weights?: number[][]
    }
    // Housing-specific properties (for backward compatibility)
    housingData?: ModularHousingObject

    /** Optional list of connection points used for snapping/alignment */
    connectionPoints?: ConnectionPoint[]
    
    // Texture properties
    textureIds?: {
        diffuse?: string
        normal?: string
        specular?: string
        emissive?: string
    }
    textureScale?: {
        u: number
        v: number
    }
    textureOffset?: {
        u: number
        v: number
    }
    
    // Room name for custom rooms
    roomName?: string
    
    // Grid information for custom rooms
    gridInfo?: {
        gridSize: number  // Size of each grid cell in drawing units
        worldScale: number  // Scale factor from drawing units to world units
        drawingBounds?: { width: number; height: number }  // Original drawing canvas dimensions
        visible?: boolean  // Whether the grid is visible
        lineColor?: string  // Color of grid lines
        showSubGrid?: boolean  // Whether to show sub-grid divisions
    }
}

// NURBS control point visualization data
export interface ControlPointVisualization {
    objectId: string
    controlPointMeshes: Mesh[]
    selectedControlPointIndex: number | null
}

// Multi-select initial state for transform operations
export interface MultiSelectInitialState {
    position: Vector3
    rotation: Vector3
    scale: Vector3
    relativePosition: Vector3
}

// Material preset interface
export interface MaterialPreset {
    name: string
    color: string
}

// Material presets for quick color selection
export const materialPresets: MaterialPreset[] = [
    { name: 'Red', color: '#ff6b6b' },
    { name: 'Blue', color: '#4ecdc4' },
    { name: 'Green', color: '#95e1d3' },
    { name: 'Yellow', color: '#fce38a' },
    { name: 'Purple', color: '#a8e6cf' },
    { name: 'Orange', color: '#ffb347' },
    { name: 'Pink', color: '#ff8fab' },
    { name: 'Cyan', color: '#87ceeb' },
]

// Add after materialPresets definition or maybe before utility types
export interface ConnectionPoint {
    /** A unique id within the object */
    id: string
    /** Local-space position of the point (before world transform) */
    position: Vector3
    /** Local-space outward normal of the face this point belongs to. Used to orient snapping. */
    normal: Vector3
    /** Semantic kind of connector (face, edge, corner, custom) */
    kind?: 'face' | 'edge' | 'corner' | 'custom'
    /** Optional list of object primitive types that are allowed to connect to this point */
    allowedTypes?: string[]
    /** Optional priority (lower = preferred) when multiple snaps are possible */
    snapPriority?: number
}

/**
 * Axis-aligned / oriented bounding information used for snapping & stacking logic.
 */
export interface Boundary {
    /** Axis-aligned bounding box */
    aabb: {
        min: Vector3
        max: Vector3
        size: Vector3
        center: Vector3
    }
    /** Optional oriented bounding box */
    obb?: {
        center: Vector3
        halfSizes: Vector3
        orientation: Quaternion
    }
    /** Optional 2D footprint (projected on XZ plane) for advanced layout */
    footprint2D?: Vector2[]
}

// Utility types for housing operations
export type HousingOperation = 
  | { type: 'add-door', wallId: string, door: Omit<Door, 'id'> }
  | { type: 'remove-door', doorId: string }
  | { type: 'add-window', wallId: string, window: Omit<Window, 'id'> }
  | { type: 'remove-window', windowId: string }
  | { type: 'change-wall-thickness', wallId?: string, thickness: number }
  | { type: 'toggle-ceiling', hasCeiling: boolean }
  | { type: 'toggle-floor', hasFloor: boolean }
  | { type: 'connect-buildings', fromObjectId: string, toObjectId: string, connection: Omit<BuildingConnection, 'id'> }
  | { type: 'disconnect-buildings', connectionId: string }

// Add this near the RoomData interface definition
export interface RoomData {
  points: { x: number; y: number }[]
  openings?: { start: { x: number; y: number }; end: { x: number; y: number } }[]
  name?: string
  allSegments?: { start: { x: number; y: number }; end: { x: number; y: number }; isOpening?: boolean }[]
  gridSize?: number  // Grid size used during drawing (in pixels)
  drawingBounds?: { width: number; height: number }  // SVG canvas dimensions
}