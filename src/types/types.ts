import { Vector3, Vector2, Quaternion, Mesh } from 'babylonjs'
import type { Opening } from '../models/Opening';
import type { Wall } from '../models/Wall';

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
  | { type: 'add-opening', wallId: string, opening: Omit<Opening, 'id'> }
  | { type: 'remove-opening', openingId: string }
  | { type: 'change-wall-thickness', wallId?: string, thickness: number }
  | { type: 'toggle-ceiling', hasCeiling: boolean }
  | { type: 'toggle-floor', hasFloor: boolean }
  | { type: 'connect-buildings', fromObjectId: string, toObjectId: string, connection: Omit<BuildingConnection, 'id'> }
  | { type: 'disconnect-buildings', connectionId: string }