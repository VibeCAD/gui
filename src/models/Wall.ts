import { Vector3 } from 'babylonjs';
import type { Opening } from './Opening';

export interface Wall {
  id: string;
  parameters: {
    length: number;
    height: number;
    thickness: number;
    position: Vector3;
    profile?: 'straight' | 'curved';
  };
  openings: Opening[];
} 