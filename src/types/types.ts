import { Vector3, Mesh } from 'babylonjs'

export type TransformMode = 'select' | 'move' | 'rotate' | 'scale'
export type PrimitiveType = 'cube' | 'sphere' | 'cylinder' | 'plane' | 'torus' | 'cone' | 'nurbs' | 
    'house-basic' | 'house-room' | 'house-hallway' | 'house-roof-flat' | 'house-roof-pitched' |
    'house-room-modular' | 'house-wall' | 'house-ceiling' | 'house-floor' |
    'house-door-single' | 'house-door-double' | 'house-door-sliding' | 'house-door-french' | 'house-door-garage' |
    'house-window-single' | 'house-window-double' | 'house-window-bay' | 'house-window-casement' | 'house-window-sliding' | 'house-window-skylight' |
    'house-stairs' | 'house-foundation' | 'house-wall-with-doorcutout' | 'parametric-wall' | 'imported-glb' | 'imported-stl' | 'imported-obj';

// Import error types
export type ImportErrorType = 'FILE_TOO_LARGE' | 'INVALID_FORMAT' | 'LOADING_FAILED'

export interface ImportError {
    type: ImportErrorType
    message: string
}

// Params for creating a wall with a door cutout
export interface WallWithDoorParams {
  wallWidth: number;
  wallHeight: number;
  wallDepth: number;
  doorWidth: number;
  doorHeight: number;
}

// Parametric wall and opening interfaces
export interface DoorOpening {
  id: string;
  type: 'door';
  width: number;
  height: number;
  position: Vector3; // Position relative to the wall's origin
}

export interface WindowOpening {
  id: string;
  type: 'window';
  width: number;
  height: number;
  position: Vector3; // Position relative to the wall's origin
}

export interface RoundWindowOpening {
  id: string;
  type: 'roundWindow';
  radius: number;
  position: Vector3; // Position relative to the wall's origin
}

export type Opening = DoorOpening | WindowOpening | RoundWindowOpening;

export interface ParametricWallParams {
  width: number;
  height: number;
  thickness: number;
  openings: Opening[];
}

export interface ParametricWallObject extends SceneObject {
  type: 'parametric-wall';
  params: ParametricWallParams;
}


// Redundant housing component types are being removed.
// The new `Opening` type and `ParametricWallParams` will be used instead.

// Scene object metadata interface
export interface SceneObjectMetadata {
    isComposite?: boolean;
    componentType?: string;
    parameters?: WallWithDoorParams | ParametricWallParams | any;
    connectionPoints?: ConnectionPoint[];
    // parametricWallParams?: ParametricWallParams; // This is now part of ParametricWallObject, so it's redundant here
    [key: string]: any; // Allow additional properties
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
    // Housing-specific properties (for backward compatibility) - REMOVED
    // housingData?: ModularHousingObject

    /** Optional list of connection points used for snapping/alignment */
    connectionPoints?: ConnectionPoint[]
    
    /** Flag to indicate mesh needs regeneration */
    needsRegeneration?: boolean
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
    /** Optional list of object primitive types that are allowed to connect to this point */
    allowedTypes?: string[]
}

// The HousingOperation type is part of the deprecated Modular Housing system and is being removed.
/*
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
*/