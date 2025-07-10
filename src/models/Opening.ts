import { Vector3 } from 'babylonjs';

export interface Opening {
  id: string;
  type: 'door' | 'window';
  parameters: {
    width: number;
    height: number;
    position: { offsetX: number; elevation: number; };
    frameThickness: number;
    // Formulas can be represented as strings for later evaluation
    // e.g., "wall.thickness * 0.5"
    formula?: string;
  };
} 