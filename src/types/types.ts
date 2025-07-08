import { Vector3, Mesh } from 'babylonjs'

export type TransformMode = 'select' | 'move' | 'rotate' | 'scale'
export type PrimitiveType = 'cube' | 'sphere' | 'cylinder' | 'plane' | 'torus' | 'cone' | 'nurbs' | 'house-basic' | 'house-room' | 'house-hallway' | 'house-roof-flat' | 'house-roof-pitched'

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