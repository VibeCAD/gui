import OpenAI from 'openai';
import type { SceneObject } from '../types/types';
import { Vector3 } from 'babylonjs';
import { findContainingRoom, getRoomFloorY, getRoomCenter, getRandomPositionInRoom } from '../babylon/boundaryUtils';
import { snapToRoomGrid } from '../babylon/gridTextureUtils';

export interface SceneCommand {
  action: 'move' | 'color' | 'scale' | 'create' | 'delete' | 'rotate' | 'align' | 'place-on-floor' | 'undo' | 'redo';
  objectId?: string;
  type?: 'cube' | 'sphere' | 'cylinder' | 'plane' | 'torus' | 'cone' | 
    'house-basic' | 'house-room' | 'house-hallway' | 'house-roof-flat' | 'house-roof-pitched' |
    'house-room-modular' | 'house-wall' | 'house-ceiling' | 'house-floor' |
    'house-door-single' | 'house-door-double' | 'house-door-sliding' | 'house-door-french' | 'house-door-garage' |
    'house-window-single' | 'house-window-double' | 'house-window-bay' | 'house-window-casement' | 'house-window-sliding' | 'house-window-skylight';
  x?: number;
  y?: number;
  z?: number;
  color?: string;
  size?: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  relativeToObject?: string;
  spatialRelation?: 'on-top-of' | 'beside' | 'in-front-of' | 'behind' | 'above' | 'below' | 'inside';
  matchDimensions?: boolean;
  contactType?: 'direct' | 'gap' | 'overlap';
  // New align-specific properties
  edge?: 'north' | 'south' | 'east' | 'west';
  offset?: number;
  // New place-on-floor properties
  snapToGrid?: boolean;
}

export interface AIServiceResult {
  success: boolean;
  commands?: SceneCommand[];
  error?: string;
  userPrompt?: string;
  aiResponse?: string;
}

/**
 * AI Service for handling OpenAI API interactions and scene command generation
 */
export class AIService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ 
      apiKey, 
      dangerouslyAllowBrowser: true 
    });
  }

  /**
   * Calculate the effective size of an object based on its type and scale
   */
  private getObjectDimensions(obj: SceneObject): { width: number; height: number; depth: number } {
    // Base dimensions for different object types (as used in sceneManager.ts)
    const baseDimensions: { [key: string]: { width: number; height: number; depth: number } } = {
      'cube': { width: 2, height: 2, depth: 2 },
      'sphere': { width: 2, height: 2, depth: 2 },
      'cylinder': { width: 2, height: 2, depth: 2 },
      'plane': { width: 2, height: 0.1, depth: 2 },
      'torus': { width: 2, height: 0.5, depth: 2 },
      'cone': { width: 2, height: 2, depth: 2 },
      'house-basic': { width: 2, height: 2, depth: 1.5 },
      'house-room': { width: 2, height: 1.5, depth: 2 },
      'house-hallway': { width: 1, height: 1.5, depth: 3 },
      'house-roof-flat': { width: 2, height: 0.1, depth: 1.5 },
      'house-roof-pitched': { width: 2, height: 0.8, depth: 1.5 },
      'house-room-modular': { width: 4, height: 2.5, depth: 4 },
      'house-wall': { width: 4, height: 1.5, depth: 0.2 },
      'house-ceiling': { width: 4, height: 0.1, depth: 4 },
      'house-floor': { width: 4, height: 0.1, depth: 4 },
      'house-door-single': { width: 0.9, height: 2, depth: 0.05 },
      'house-door-double': { width: 1.8, height: 2, depth: 0.05 },
      'house-door-sliding': { width: 1.2, height: 2, depth: 0.05 },
      'house-door-french': { width: 1.2, height: 2, depth: 0.05 },
      'house-door-garage': { width: 2.4, height: 2, depth: 0.05 },
      'house-window-single': { width: 0.6, height: 0.8, depth: 0.05 },
      'house-window-double': { width: 1.2, height: 0.8, depth: 0.05 },
      'house-window-bay': { width: 1.5, height: 0.8, depth: 0.3 },
      'house-window-casement': { width: 0.8, height: 1, depth: 0.05 },
      'house-window-sliding': { width: 1.2, height: 0.8, depth: 0.05 },
      'house-window-skylight': { width: 0.8, height: 0.8, depth: 0.05 },
      'ground': { width: 10, height: 1, depth: 10 },
      'custom-room': { width: 4, height: 2.5, depth: 4 } // Default custom room dimensions
    };

    const base = baseDimensions[obj.type] || { width: 1, height: 1, depth: 1 };
    
    // Apply scale factors
    return {
      width: base.width * obj.scale.x,
      height: base.height * obj.scale.y,
      depth: base.depth * obj.scale.z
    };
  }

  /**
   * Calculate the bounding box of an object
   */
  private getBoundingBox(obj: SceneObject): { min: Vector3; max: Vector3 } {
    const dimensions = this.getObjectDimensions(obj);
    const halfWidth = dimensions.width / 2;
    const halfHeight = dimensions.height / 2;
    const halfDepth = dimensions.depth / 2;

    return {
      min: new Vector3(
        obj.position.x - halfWidth,
        obj.position.y - halfHeight,
        obj.position.z - halfDepth
      ),
      max: new Vector3(
        obj.position.x + halfWidth,
        obj.position.y + halfHeight,
        obj.position.z + halfDepth
      )
    };
  }

  /**
   * Find an object by color, name, room name, or type from the scene
   */
  private findObjectByDescription(description: string, sceneObjects: SceneObject[]): SceneObject | undefined {
    const lowerDesc = description.toLowerCase();
    
    // First try to find custom rooms by name
    const roomNameMatches = sceneObjects.filter(obj => 
      obj.type === 'custom-room' && obj.roomName && 
      (obj.roomName.toLowerCase().includes(lowerDesc) || lowerDesc.includes(obj.roomName.toLowerCase()))
    );

    if (roomNameMatches.length === 1) {
      return roomNameMatches[0];
    }

    // Then try to find by color
    const colorMatches = sceneObjects.filter(obj => {
      if (obj.color) {
        const colorName = this.getColorName(obj.color);
        return colorName.includes(lowerDesc) || lowerDesc.includes(colorName);
      }
      return false;
    });

    if (colorMatches.length === 1) {
      return colorMatches[0];
    }

    // Then try to find by type (including "room" for custom-room types)
    const typeMatches = sceneObjects.filter(obj => {
      const objType = obj.type.toLowerCase();
      const isRoom = obj.type === 'custom-room' && (lowerDesc.includes('room') || lowerDesc.includes('room'));
      return objType.includes(lowerDesc) || lowerDesc.includes(objType) || isRoom;
    });

    if (typeMatches.length === 1) {
      return typeMatches[0];
    }

    // Finally try to find by ID
    const idMatch = sceneObjects.find(obj => 
      obj.id.toLowerCase().includes(lowerDesc) || lowerDesc.includes(obj.id.toLowerCase())
    );

    return idMatch || undefined;
  }

  /**
   * Convert degrees to radians for rotation calculations
   */
  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convert radians to degrees for human-readable output
   */
  private radiansToDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  /**
   * Get a human-readable color name from hex value
   */
  private getColorName(hex: string): string {
    const colorMap: { [key: string]: string } = {
      '#ff6b6b': 'red',
      '#4ecdc4': 'blue',
      '#95e1d3': 'green',
      '#fce38a': 'yellow',
      '#a8e6cf': 'purple',
      '#ffb347': 'orange',
      '#ff8fab': 'pink',
      '#87ceeb': 'cyan',
      '#808080': 'gray',
      '#8B4513': 'brown',
      '#DEB887': 'tan',
      '#654321': 'dark brown'
    };

    return colorMap[hex.toLowerCase()] || 'unknown';
  }

  /**
   * Calculate room-aware placement with grid snapping for custom rooms
   */
  private calculateRoomAwarePlacement(
    targetObject: SceneObject,
    room: SceneObject,
    relation: string
  ): { x: number; y: number; z: number } {
    const targetDimensions = this.getObjectDimensions(targetObject);
    const floorY = getRoomFloorY(room);
    
    if (relation === 'inside') {
      // Get a position within the room
      const roomPosition = getRandomPositionInRoom(room);
      
      // Apply grid snapping if the room has a mesh with grid info
      if (room.mesh) {
        const snappedPosition = snapToRoomGrid(
          { x: roomPosition.x, z: roomPosition.z },
          room.mesh
        );
        
        return {
          x: snappedPosition.x,
          y: floorY + targetDimensions.height / 2, // Place object with bottom on floor
          z: snappedPosition.z
        };
      }
      
      // Fallback without grid snapping
      return {
        x: roomPosition.x,
        y: floorY + targetDimensions.height / 2,
        z: roomPosition.z
      };
    }
    
    // For other relations, use room center
    const roomCenter = getRoomCenter(room);
    return {
      x: roomCenter.x,
      y: floorY + targetDimensions.height / 2,
      z: roomCenter.z
    };
  }

  /**
   * Calculate precise position and scaling for spatial relationships
   */
  private calculatePreciseSpatialPlacement(
    targetObject: SceneObject,
    referenceObject: SceneObject,
    relation: string,
    sceneObjects: SceneObject[]
  ): { 
    position: { x: number; y: number; z: number };
    scale?: { x: number; y: number; z: number };
    matchDimensions: boolean;
  } {
    const refDimensions = this.getObjectDimensions(referenceObject);
    const targetDimensions = this.getObjectDimensions(targetObject);
    const refBox = this.getBoundingBox(referenceObject);
    
    // Determine if we should match dimensions based on relationship and object types
    const shouldMatchDimensions = this.shouldMatchDimensions(targetObject, referenceObject, relation);
    
    let position: { x: number; y: number; z: number };
    let scale: { x: number; y: number; z: number } | undefined;
    
    // Special handling for custom rooms
    if (referenceObject.type === 'custom-room') {
      position = this.calculateRoomAwarePlacement(targetObject, referenceObject, relation);
    } else if (shouldMatchDimensions) {
      // Calculate scale factors to match reference object dimensions
      const scaleFactors = this.calculateDimensionMatchingScale(targetObject, referenceObject, relation);
      scale = scaleFactors;
      
      // Recalculate target dimensions with new scale
      const scaledTargetDimensions = {
        width: targetDimensions.width * scaleFactors.x,
        height: targetDimensions.height * scaleFactors.y,
        depth: targetDimensions.depth * scaleFactors.z
      };
      
      position = this.calculatePreciseContactPosition(
        referenceObject, 
        scaledTargetDimensions, 
        relation
      );
    } else {
      // Use original dimensions for positioning
      position = this.calculatePreciseContactPosition(
        referenceObject, 
        targetDimensions, 
        relation
      );
    }
    
    return {
      position,
      scale,
      matchDimensions: shouldMatchDimensions
    };
  }

  /**
   * Determine if objects should match dimensions based on relationship
   */
  private shouldMatchDimensions(
    targetObject: SceneObject, 
    referenceObject: SceneObject, 
    relation: string
  ): boolean {
    // Housing objects should match dimensions for roofs on rooms/buildings
    if (targetObject.type.includes('roof') && referenceObject.type.startsWith('house-')) {
      return true;
    }
    
    // Basic objects placed "on top of" each other should match dimensions
    if (relation === 'on-top-of' && 
        !targetObject.type.startsWith('house-') && 
        !referenceObject.type.startsWith('house-')) {
      return true;
    }
    
    // Spheres and cylinders on cubes should match the cube's footprint
    if (relation === 'on-top-of' && 
        referenceObject.type === 'cube' && 
        (targetObject.type === 'sphere' || targetObject.type === 'cylinder')) {
      return true;
    }
    
    return false;
  }

  /**
   * Calculate scale factors to match reference object dimensions
   */
  private calculateDimensionMatchingScale(
    targetObject: SceneObject,
    referenceObject: SceneObject,
    relation: string
  ): { x: number; y: number; z: number } {
    const refDimensions = this.getObjectDimensions(referenceObject);
    const targetDimensions = this.getObjectDimensions(targetObject);
    
    // Special case: roofs should match building footprint but keep their own height
    if (targetObject.type.includes('roof')) {
      return {
        x: refDimensions.width / targetDimensions.width,
        y: 1, // Keep original roof height
        z: refDimensions.depth / targetDimensions.depth
      };
    }
    
    // For "on-top-of" relationships, match the footprint but keep original height
    if (relation === 'on-top-of') {
      return {
        x: refDimensions.width / targetDimensions.width,
        y: 1, // Keep original height unless it's a cube on cube
        z: refDimensions.depth / targetDimensions.depth
      };
    }
    
    // Default: match all dimensions
    return {
      x: refDimensions.width / targetDimensions.width,
      y: refDimensions.height / targetDimensions.height,
      z: refDimensions.depth / targetDimensions.depth
    };
  }

  /**
   * Calculate precise contact position for direct contact
   */
  private calculatePreciseContactPosition(
    referenceObject: SceneObject,
    targetDimensions: { width: number; height: number; depth: number },
    relation: string
  ): { x: number; y: number; z: number } {
    const refDimensions = this.getObjectDimensions(referenceObject);
    const refBox = this.getBoundingBox(referenceObject);
    
    switch (relation) {
      case 'on-top-of':
        // Place object directly on top with perfect contact
        return {
          x: referenceObject.position.x, // Same X position (centered)
          y: refBox.max.y + targetDimensions.height / 2, // Bottom of target touches top of reference
          z: referenceObject.position.z  // Same Z position (centered)
        };
      
      case 'above':
        // Place object above with small gap
        return {
          x: referenceObject.position.x,
          y: refBox.max.y + targetDimensions.height / 2 + 0.2, // Small gap
          z: referenceObject.position.z
        };
      
      case 'below':
        // Place object below with direct contact
        return {
          x: referenceObject.position.x,
          y: refBox.min.y - targetDimensions.height / 2, // Top of target touches bottom of reference
          z: referenceObject.position.z
        };
      
      case 'beside':
      case 'next-to':
        // Place object beside with direct contact
        return {
          x: refBox.max.x + targetDimensions.width / 2, // Direct contact on X axis
          y: referenceObject.position.y, // Same Y position (aligned)
          z: referenceObject.position.z  // Same Z position (aligned)
        };
      
      case 'in-front-of':
        // Place object in front with direct contact
        return {
          x: referenceObject.position.x,
          y: referenceObject.position.y,
          z: refBox.max.z + targetDimensions.depth / 2 // Direct contact on Z axis
        };
      
      case 'behind':
        // Place object behind with direct contact
        return {
          x: referenceObject.position.x,
          y: referenceObject.position.y,
          z: refBox.min.z - targetDimensions.depth / 2 // Direct contact on Z axis
        };
      
      case 'inside':
        // Place object inside a room at floor level
        if (referenceObject.type === 'custom-room') {
          const roomCenter = getRoomCenter(referenceObject);
          const floorY = getRoomFloorY(referenceObject);
          
          // Get a random position within the room
          const roomPosition = getRandomPositionInRoom(referenceObject);
          
          return {
            x: roomPosition.x,
            y: roomPosition.y + targetDimensions.height / 2, // Place object with bottom on floor
            z: roomPosition.z
          };
        } else {
          // Fallback for non-room objects - same as default
          return {
            x: referenceObject.position.x,
            y: referenceObject.position.y,
            z: referenceObject.position.z
          };
        }
      
      default:
        // Default: same position
        return {
          x: referenceObject.position.x,
          y: referenceObject.position.y,
          z: referenceObject.position.z
        };
    }
  }

  /**
   * Enhanced roof positioning for housing objects
   */
  private calculateRoofPlacement(
    roofType: string,
    targetStructure: SceneObject,
    sceneObjects: SceneObject[]
  ): { 
    position: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  } {
    const structureDimensions = this.getObjectDimensions(targetStructure);
    const structureBox = this.getBoundingBox(targetStructure);
    
    // Get base dimensions for roof type
    const baseDimensions = this.getBaseDimensionsForType(roofType);
    
    // Calculate scale to match structure footprint
    const scale = {
      x: structureDimensions.width / baseDimensions.width,
      y: 1, // Keep original roof height
      z: structureDimensions.depth / baseDimensions.depth
    };
    
    // Calculate roof height with scale
    const roofHeight = baseDimensions.height * scale.y;
    
    // Position roof directly on top of structure
    const position = {
      x: targetStructure.position.x,
      y: structureBox.max.y + roofHeight / 2, // Bottom of roof touches top of structure
      z: targetStructure.position.z
    };
    
    return { position, scale };
  }

  /**
   * Get base dimensions for object type
   */
  private getBaseDimensionsForType(type: string): { width: number; height: number; depth: number } {
    const baseDimensions: { [key: string]: { width: number; height: number; depth: number } } = {
      'cube': { width: 2, height: 2, depth: 2 },
      'sphere': { width: 2, height: 2, depth: 2 },
      'cylinder': { width: 2, height: 2, depth: 2 },
      'plane': { width: 2, height: 0.1, depth: 2 },
      'torus': { width: 2, height: 0.5, depth: 2 },
      'cone': { width: 2, height: 2, depth: 2 },
      'house-basic': { width: 2, height: 2, depth: 1.5 },
      'house-room': { width: 2, height: 1.5, depth: 2 },
      'house-hallway': { width: 1, height: 1.5, depth: 3 },
      'house-roof-flat': { width: 2, height: 0.1, depth: 1.5 },
      'house-roof-pitched': { width: 2, height: 0.8, depth: 1.5 },
      'house-room-modular': { width: 4, height: 2.5, depth: 4 },
      'house-wall': { width: 4, height: 1.5, depth: 0.2 },
      'house-ceiling': { width: 4, height: 0.1, depth: 4 },
      'house-floor': { width: 4, height: 0.1, depth: 4 },
      'house-door-single': { width: 0.9, height: 2, depth: 0.05 },
      'house-door-double': { width: 1.8, height: 2, depth: 0.05 },
      'house-door-sliding': { width: 1.2, height: 2, depth: 0.05 },
      'house-door-french': { width: 1.2, height: 2, depth: 0.05 },
      'house-door-garage': { width: 2.4, height: 2, depth: 0.05 },
      'house-window-single': { width: 0.6, height: 0.8, depth: 0.05 },
      'house-window-double': { width: 1.2, height: 0.8, depth: 0.05 },
      'house-window-bay': { width: 1.5, height: 0.8, depth: 0.3 },
      'house-window-casement': { width: 0.8, height: 1, depth: 0.05 },
      'house-window-sliding': { width: 1.2, height: 0.8, depth: 0.05 },
      'house-window-skylight': { width: 0.8, height: 0.8, depth: 0.05 }
    };
    
    return baseDimensions[type] || { width: 1, height: 1, depth: 1 };
  }

  /**
   * Generate a description of the current scene with spatial relationships
   */
  public describeScene(sceneObjects: SceneObject[]): string {
    // Debug: Log received scene objects
    console.log('🤖 AI Service received scene objects:');
    sceneObjects.forEach(obj => {
      console.log(`  - ${obj.id} (${obj.type}): position (${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)})`);
    });

    const customRooms = sceneObjects.filter(obj => obj.type === 'custom-room');
    const housingObjects = sceneObjects.filter(obj => obj.type.startsWith('house-'));
    const primitiveObjects = sceneObjects.filter(obj => !obj.type.startsWith('house-') && obj.type !== 'ground' && obj.type !== 'custom-room');
    const groundObject = sceneObjects.find(obj => obj.type === 'ground');
    
    let description = '';
    
    if (groundObject) {
      description += `Ground plane at (0, 0, 0). `;
    }

    // Describe custom rooms first as they're important spatial containers
    if (customRooms.length > 0) {
      const roomsDescription = customRooms
        .map(room => {
          const dimensions = this.getObjectDimensions(room);
          const roomName = room.roomName || 'Unnamed Room';
          const gridInfo = room.gridInfo ? ` with ${room.gridInfo.gridSize}px grid` : '';
          
          return `"${roomName}" room "${room.id}" (${dimensions.width.toFixed(1)}×${dimensions.depth.toFixed(1)}) at (${room.position.x.toFixed(1)}, ${room.position.z.toFixed(1)})${gridInfo}`;
        })
        .join(', ');
      description += `Rooms: ${roomsDescription}`;
    }
    
    if (primitiveObjects.length > 0) {
      const primitiveDescription = primitiveObjects
        .map(obj => {
          const dimensions = this.getObjectDimensions(obj);
          const colorName = this.getColorName(obj.color);
          const sizeDesc = dimensions.width !== dimensions.height || dimensions.height !== dimensions.depth 
            ? `${dimensions.width.toFixed(1)}×${dimensions.height.toFixed(1)}×${dimensions.depth.toFixed(1)}` 
            : `${dimensions.width.toFixed(1)} units`;
          
          // Include rotation information if object is rotated
          const rotationDesc = (obj.rotation.x !== 0 || obj.rotation.y !== 0 || obj.rotation.z !== 0) 
            ? ` rotated (${obj.rotation.x.toFixed(2)}, ${obj.rotation.y.toFixed(2)}, ${obj.rotation.z.toFixed(2)}) rad`
            : '';
          
          return `${colorName} ${obj.type} "${obj.id}" (${sizeDesc}) at (${obj.position.x.toFixed(1)}, ${obj.position.y.toFixed(1)}, ${obj.position.z.toFixed(1)})${rotationDesc}`;
        })
        .join(', ');
      description += (description ? '. ' : '') + `Objects: ${primitiveDescription}`;
    }
    
    if (housingObjects.length > 0) {
      const housingDescription = housingObjects
        .map(obj => {
          const friendlyType = obj.type.replace('house-', '').replace('-', ' ');
          const dimensions = this.getObjectDimensions(obj);
          const colorName = this.getColorName(obj.color);
          
          // Include rotation information if object is rotated
          const rotationDesc = (obj.rotation.x !== 0 || obj.rotation.y !== 0 || obj.rotation.z !== 0) 
            ? ` rotated (${obj.rotation.x.toFixed(2)}, ${obj.rotation.y.toFixed(2)}, ${obj.rotation.z.toFixed(2)}) rad`
            : '';
          
          return `${colorName} ${friendlyType} "${obj.id}" (${dimensions.width.toFixed(1)}×${dimensions.height.toFixed(1)}×${dimensions.depth.toFixed(1)}) at (${obj.position.x.toFixed(1)}, ${obj.position.y.toFixed(1)}, ${obj.position.z.toFixed(1)})${rotationDesc}`;
        })
        .join(', ');
      description += (description ? '. ' : '') + `Housing structures: ${housingDescription}`;
    }
    
    const finalDescription = `Current scene: ${description || 'just a ground plane'}`;
    
    // Debug: Log generated scene description
    console.log('🤖 AI Service generated scene description:', finalDescription);
    
    return finalDescription;
  }

  /**
   * Generate the system prompt for the AI with enhanced spatial reasoning
   */
  private generateSystemPrompt(sceneDescription: string, objectIds: string[]): string {
    return `You are a 3D scene assistant with advanced spatial reasoning and precise positioning capabilities. You can modify a Babylon.js scene with millimeter-accurate positioning and automatic dimension matching.

${sceneDescription}

Available actions:
1. move: Move an object to x,y,z coordinates
2. color: Change object color (use hex colors like #ff6b6b, #4ecdc4, #95e1d3, etc.)
3. scale: Scale an object by scaleX, scaleY, scaleZ factors
4. create: Create new objects with intelligent positioning and automatic scaling
5. delete: Remove an object
6. rotate: Rotate an object by rotationX, rotationY, rotationZ angles in radians
7. align: Align an object to a specific edge of another object with perfect perpendicularity and flush contact
8. place-on-floor: Place an object on the floor of a room with automatic grid snapping
9. undo: Undo the last action performed on the scene
10. redo: Redo the last undone action

OBJECT TYPES:
Basic: cube, sphere, cylinder, plane, torus, cone
Housing: house-basic, house-room, house-hallway, house-roof-flat, house-roof-pitched

PRECISION SPATIAL INTELLIGENCE:
- Objects have exact dimensions and bounding boxes
- Automatic dimension matching for "on top of" relationships
- Direct contact positioning (no gaps unless specified)
- Identical orientation for stacked objects
- Specialized housing logic for roofs matching room dimensions

AUTOMATIC DIMENSION MATCHING:
- Blue cube "on top of" red cube → Blue cube automatically scaled to match red cube's footprint
- Roof on room → Roof automatically scaled to match room's exact dimensions
- Sphere on cube → Sphere scaled to match cube's width and depth
- All objects maintain their original height unless explicitly scaling cubes

POSITIONING PRECISION:
- "on top of" = Perfect contact, no gaps, centered alignment, matching dimensions
- "beside" = Direct contact on sides, aligned heights
- "in front of" = Direct contact on front face, aligned positions
- "behind" = Direct contact on back face, aligned positions
- "above" = Small gap above, centered alignment
- "below" = Direct contact below, centered alignment

QUANTITY HANDLING:
- If the prompt specifies a quantity (for example, "two", "three", "5") or uses a plural noun (such as "cubes"), you MUST create exactly that number of objects.
- Do NOT introduce a 'count' or 'quantity' property. Instead, output that many individual 'create' commands inside the JSON array.
- When the user does not specify how the objects should be arranged, position them sensibly (e.g. in a straight line) **with at least one unit of empty space between their bounding boxes**.  For standard 2×2×2 cubes this means keeping their centres ≥ 2.2 units apart (e.g. –1.5 and 1.5 on the X axis).  Always provide explicit 'x', 'y', and 'z' that do not overlap with other objects.

ROTATION PRECISION:
- Rotation values are in radians (not degrees)
- rotationX: Rotation around X-axis (pitch)
- rotationY: Rotation around Y-axis (yaw)
- rotationZ: Rotation around Z-axis (roll)
- Common values: 0 = no rotation, π/2 ≈ 1.57 = 90°, π ≈ 3.14 = 180°, 3π/2 ≈ 4.71 = 270°
- For 45° rotation: π/4 ≈ 0.785 radians
- For 30° rotation: π/6 ≈ 0.524 radians

ALIGNMENT BEHAVIOR:
- The align action creates perfect perpendicular alignment (90 degrees)
- The moving object is positioned flush with the specified edge
- The object is rotated to face outward from the edge
- North = positive Z direction, South = negative Z direction
- East = positive X direction, West = negative X direction
- Optional offset value moves the object away from the edge by the specified amount

SPATIAL COMMAND EXAMPLES:
"Put a blue cube on top of the red cube":
[{"action": "create", "type": "cube", "color": "#4ecdc4", "x": 0, "y": 2.0, "z": 0, "scaleX": 1.0, "scaleY": 1.0, "scaleZ": 1.0}]

"Create two red cubes side by side":
[{"action": "create", "type": "cube", "color": "#ff6b6b", "x": -1.5, "y": 0, "z": 0, "scaleX": 1.0, "scaleY": 1.0, "scaleZ": 1.0},
 {"action": "create", "type": "cube", "color": "#ff6b6b", "x": 1.5, "y": 0, "z": 0, "scaleX": 1.0, "scaleY": 1.0, "scaleZ": 1.0}]

"Place a yellow sphere on the green cube":
[{"action": "create", "type": "sphere", "color": "#fce38a", "x": 0, "y": 2.0, "z": 0, "scaleX": 1.0, "scaleY": 1.0, "scaleZ": 1.0}]

"Add a roof to the room":
[{"action": "create", "type": "house-roof-pitched", "color": "#654321", "x": 0, "y": 2.25, "z": 0, "scaleX": 1.0, "scaleY": 1.0, "scaleZ": 1.33}]

"Move the red sphere on top of the blue cube":
[{"action": "move", "objectId": "sphere-id", "x": 0, "y": 2.0, "z": 0}]

ROTATION COMMAND EXAMPLES:
"Rotate the blue cube 45 degrees around the Y-axis":
[{"action": "rotate", "objectId": "cube-id", "rotationX": 0, "rotationY": 0.785, "rotationZ": 0}]

"Tilt the red sphere 30 degrees forward":
[{"action": "rotate", "objectId": "sphere-id", "rotationX": 0.524, "rotationY": 0, "rotationZ": 0}]

"Spin the green cylinder 90 degrees around its vertical axis":
[{"action": "rotate", "objectId": "cylinder-id", "rotationX": 0, "rotationY": 1.57, "rotationZ": 0}]

"Flip the cube upside down":
[{"action": "rotate", "objectId": "cube-id", "rotationX": 3.14, "rotationY": 0, "rotationZ": 0}]

"Rotate the house 180 degrees to face the opposite direction":
[{"action": "rotate", "objectId": "house-id", "rotationX": 0, "rotationY": 3.14, "rotationZ": 0}]

ALIGNMENT COMMAND EXAMPLES:
"Align the wall to the north edge of the floor":
[{"action": "align", "objectId": "wall-id", "relativeToObject": "floor-id", "edge": "north"}]

"Line up the wall with the south side of the room":
[{"action": "align", "objectId": "wall-id", "relativeToObject": "room-id", "edge": "south"}]

"Move the wall flush with the east edge of the floor":
[{"action": "align", "objectId": "wall-id", "relativeToObject": "floor-id", "edge": "east"}]

"Snap the wall to the west side of the foundation":
[{"action": "align", "objectId": "wall-id", "relativeToObject": "foundation-id", "edge": "west"}]

"Align the wall to the north edge of the floor with 0.1 offset":
[{"action": "align", "objectId": "wall-id", "relativeToObject": "floor-id", "edge": "north", "offset": 0.1}]

UNDO/REDO COMMAND EXAMPLES:
"Undo the last action":
[{"action": "undo"}]

"Undo that":
[{"action": "undo"}]

"Go back":
[{"action": "undo"}]

"Redo the last action":
[{"action": "redo"}]

"Redo that":
[{"action": "redo"}]

"Restore the last undone action":
[{"action": "redo"}]



HOUSING OBJECT LOGIC:
- Roofs automatically match underlying structure dimensions
- Rooms and hallways connect at ground level
- Proper architectural proportions maintained
- Direct contact between walls and roofs

ROOM-AWARE PLACEMENT LOGIC:
- Objects placed "inside" custom rooms are automatically positioned on the room floor
- Room placement uses grid snapping for precise positioning
- Objects are randomly distributed within room boundaries for natural placement
- Use room names from scene description for accurate targeting
- Room floor level is automatically calculated for proper Y positioning

ROOM PLACEMENT EXAMPLES:
"Put a red cube in the bedroom":
[{"action": "create", "type": "cube", "color": "#ff6b6b"}, {"action": "place-on-floor", "objectId": "generated-cube-id", "relativeToObject": "bedroom", "snapToGrid": true}]

"Move the chair into the living room":
[{"action": "place-on-floor", "objectId": "chair-id", "relativeToObject": "living room", "snapToGrid": true}]

"Place a table inside the kitchen":
[{"action": "create", "type": "house-basic"}, {"action": "place-on-floor", "objectId": "generated-table-id", "relativeToObject": "kitchen", "snapToGrid": true}]

PLACE-ON-FLOOR COMMAND DETAILS:
- Use place-on-floor action for positioning objects inside rooms
- Always set snapToGrid: true for room placement
- Reference the room by name in relativeToObject
- For new objects, use the generated object ID (you must predict the ID pattern)
- For existing objects, use their current object ID

CRITICAL REQUIREMENTS:
1. ALWAYS identify the reference object from the scene when spatial relationships are mentioned
2. ALWAYS calculate precise x, y, z coordinates based on exact object dimensions
3. ALWAYS include calculated coordinates in your JSON response
4. For "on top of" positioning: place bottom of target object touching top of reference object
5. For dimension matching: automatically calculate scaleX, scaleY, scaleZ factors
6. Use exact object dimensions from the scene description for all calculations
7. Ensure perfect contact - no gaps, no overlaps, just touching surfaces
8. For rotation: ALWAYS provide rotation values in radians, not degrees
9. When rotating objects, consider their current rotation state from the scene description

DIMENSION MATCHING RULES:
- Objects placed "on top of" automatically match the footprint (width × depth) of the reference object
- Roofs automatically match the exact dimensions of the building they're placed on
- Heights are preserved unless explicitly scaling identical object types
- Spheres and cylinders on cubes match the cube's footprint dimensions

When creating objects with spatial relationships, you MUST:
1. Identify the reference object from the scene
2. Calculate precise position for direct contact
3. Calculate scale factors for dimension matching when appropriate
4. Include x, y, z coordinates AND scaleX, scaleY, scaleZ factors in your response

Respond ONLY with valid JSON array of commands.
DO NOT INCLUDE ANY OTHER TEXT IN YOUR RESPONSE. YOU MUST ONLY RESPOND WITH VALID JSON.
DO NOT INCLUDE ANY COMMENTS IN THE JSON BLOCK.

Object IDs currently in scene: ${objectIds.join(', ')}`;
  }

  /**
   * Clean AI response by removing markdown code blocks
   */
  private cleanResponse(response: string): string {
    let cleanedResponse = response.trim();
    
    // Remove markdown code blocks
    cleanedResponse = cleanedResponse.replace(/```json\s*/g, '');
    cleanedResponse = cleanedResponse.replace(/```\s*/g, '');
    cleanedResponse = cleanedResponse.trim();
    
    return cleanedResponse;
  }

  /**
   * Parse commands with enhanced spatial understanding
   */
  private parseCommandsWithSpatialLogic(response: string, sceneObjects: SceneObject[]): SceneCommand[] {
    const cleanedResponse = this.cleanResponse(response);
    
    try {
      const parsed = JSON.parse(cleanedResponse);
      const commands = Array.isArray(parsed) ? parsed : [parsed];
      
      // Extract spatial relationships from command structure
      return commands.map((command: any) => {
        // Look for spatial relationship patterns in the command
        if (command.action === 'create' || command.action === 'move') {
          // Check for implicit spatial relationships based on missing coordinates
          if (command.x === undefined && command.y === undefined && command.z === undefined) {
            // This might be a spatial relationship command
            // The AI should have provided explicit coordinates, but we can try to infer
            const enhancedCommand = this.enhanceCommandsWithSpatialLogic([command], sceneObjects)[0];
            return enhancedCommand;
          }
        }
        
        return command as SceneCommand;
      });
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
    }
  }

  /**
   * Get scene commands from user prompt with enhanced spatial reasoning
   */
  public async getSceneCommands(
    prompt: string, 
    sceneObjects: SceneObject[]
  ): Promise<AIServiceResult> {
    if (!prompt.trim()) {
      return {
        success: false,
        error: 'Empty prompt provided'
      };
    }

    try {
      const sceneDescription = this.describeScene(sceneObjects);
      const objectIds = sceneObjects.map(obj => obj.id);
      const spatialContext = this.extractSpatialContext(prompt, sceneObjects);
      const systemPrompt = this.generateSystemPrompt(sceneDescription, objectIds);

      // Enhanced prompt with spatial context
      const enhancedPrompt = spatialContext.spatialRelationDetected 
        ? `${prompt}\n\nSpatial context: ${spatialContext.description}`
        : prompt;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: enhancedPrompt }
        ],
        temperature: 0.1
      });

      const aiResponse = response.choices[0]?.message?.content;
      
      if (!aiResponse) {
        return {
          success: false,
          error: 'No response from AI',
          userPrompt: prompt
        };
      }

      try {
        const rawCommands = this.parseCommandsWithSpatialLogic(aiResponse, sceneObjects);
        const commands = this.enhanceCommandsWithSpatialLogic(rawCommands, sceneObjects);
        
        return {
          success: true,
          commands,
          userPrompt: prompt,
          aiResponse
        };
      } catch (parseError) {
        return {
          success: false,
          error: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
          userPrompt: prompt,
          aiResponse
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown API error',
        userPrompt: prompt
      };
    }
  }

  /**
   * Find the best position to place a roof above existing structures
   */
  private findRoofPosition(sceneObjects: SceneObject[], targetStructure?: string): { x: number, y: number, z: number } | null {
    // If a specific structure is mentioned, try to find it
    if (targetStructure) {
      const target = sceneObjects.find(obj => 
        obj.id.toLowerCase().includes(targetStructure.toLowerCase()) || 
        obj.type.toLowerCase().includes(targetStructure.toLowerCase())
      );
      if (target) {
        return { x: target.position.x, y: target.position.y + 2.5, z: target.position.z };
      }
    }
    
    // Otherwise, find the first house or room structure
    const structures = sceneObjects.filter(obj => 
      obj.type.startsWith('house-') && 
      !obj.type.includes('roof') &&
      obj.type !== 'ground'
    );
    
    if (structures.length > 0) {
      const structure = structures[0];
      return { x: structure.position.x, y: structure.position.y + 2.5, z: structure.position.z };
    }
    
    return null;
  }

  /**
   * Find the best position to connect structures (like rooms with hallways)
   */
  private findConnectionPosition(sceneObjects: SceneObject[], type: string): { x: number, y: number, z: number } {
    const structures = sceneObjects.filter(obj => 
      obj.type.startsWith('house-') && 
      !obj.type.includes('roof') &&
      obj.type !== 'ground'
    );
    
    if (structures.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }
    
    if (structures.length === 1) {
      // Position next to the existing structure
      const existing = structures[0];
      return { x: existing.position.x + 4, y: 0, z: existing.position.z };
    }
    
    // If multiple structures, try to position between them or extend the layout
    const avgX = structures.reduce((sum, obj) => sum + obj.position.x, 0) / structures.length;
    const avgZ = structures.reduce((sum, obj) => sum + obj.position.z, 0) / structures.length;
    
    if (type === 'house-hallway') {
      // Hallways should connect structures
      return { x: avgX, y: 0, z: avgZ };
    } else {
      // Other structures should extend the layout
      const maxX = Math.max(...structures.map(obj => obj.position.x));
      return { x: maxX + 4, y: 0, z: avgZ };
    }
  }

  /**
   * Extract spatial context from user prompt
   */
  private extractSpatialContext(prompt: string, sceneObjects: SceneObject[]): { 
    spatialRelationDetected: boolean; 
    description: string;
    referenceObject?: SceneObject;
    relation?: string;
  } {
    const lowerPrompt = prompt.toLowerCase();
    
    // Spatial relationship patterns
    const spatialPatterns = [
      { pattern: /on top of|on|above/, relation: 'on-top-of' },
      { pattern: /beside|next to|near/, relation: 'beside' },
      { pattern: /in front of|front/, relation: 'in-front-of' },
      { pattern: /behind/, relation: 'behind' },
      { pattern: /below|under/, relation: 'below' },
      { pattern: /inside|into|in the|within/, relation: 'inside' }
    ];

    let detectedRelation: string | undefined;
    let description = '';

    for (const { pattern, relation } of spatialPatterns) {
      if (pattern.test(lowerPrompt)) {
        detectedRelation = relation;
        break;
      }
    }

    if (detectedRelation) {
      // Try to find the reference object
      const colorMatches = lowerPrompt.match(/(red|blue|green|yellow|purple|orange|pink|cyan|brown|gray|tan)\s+(cube|sphere|cylinder|box|ball)/g);
      const typeMatches = lowerPrompt.match(/(cube|sphere|cylinder|box|ball|house|room|hallway)/g);
      
      // Enhanced room name detection for 'inside' relationships
      const roomNameMatches = lowerPrompt.match(/(?:in|into|inside)\s+(?:the\s+)?([a-zA-Z0-9\s]+?)(?:\s+room|\s|$)/g);
      
      let referenceObject: SceneObject | undefined;
      
      // For 'inside' relationships, prioritize room detection
      if (detectedRelation === 'inside' && roomNameMatches && roomNameMatches.length > 0) {
        const roomMatch = roomNameMatches[0];
        const roomName = roomMatch.replace(/(?:in|into|inside)\s+(?:the\s+)?/, '').replace(/\s+room.*$/, '').trim();
        referenceObject = this.findObjectByDescription(roomName, sceneObjects);
      }
      
      if (!referenceObject && colorMatches && colorMatches.length > 0) {
        const colorMatch = colorMatches[0];
        referenceObject = this.findObjectByDescription(colorMatch, sceneObjects);
      } else if (!referenceObject && typeMatches && typeMatches.length > 0) {
        const typeMatch = typeMatches[0];
        referenceObject = this.findObjectByDescription(typeMatch, sceneObjects);
      }

      if (referenceObject) {
        const refDimensions = this.getObjectDimensions(referenceObject);
        const isRoom = referenceObject.type === 'custom-room';
        const roomName = isRoom && referenceObject.roomName ? `"${referenceObject.roomName}"` : '';
        const colorName = this.getColorName(referenceObject.color);
        
        description = isRoom 
          ? `Reference room: ${roomName} room "${referenceObject.id}" at (${referenceObject.position.x.toFixed(1)}, ${referenceObject.position.z.toFixed(1)}) with dimensions ${refDimensions.width.toFixed(1)}×${refDimensions.depth.toFixed(1)}`
          : `Reference object: ${colorName} ${referenceObject.type} at (${referenceObject.position.x.toFixed(1)}, ${referenceObject.position.y.toFixed(1)}, ${referenceObject.position.z.toFixed(1)}) with dimensions ${refDimensions.width.toFixed(1)}×${refDimensions.height.toFixed(1)}×${refDimensions.depth.toFixed(1)}`;
        
        return {
          spatialRelationDetected: true,
          description,
          referenceObject,
          relation: detectedRelation
        };
      }
    }

    return {
      spatialRelationDetected: false,
      description: ''
    };
  }

  /**
   * Enhance the AI response with spatial intelligence
   */
  private enhanceCommandsWithSpatialLogic(commands: SceneCommand[], sceneObjects: SceneObject[]): SceneCommand[] {
    const enhancedCommands: SceneCommand[] = [];
    
    commands.forEach(command => {
      // Handle align and place-on-floor commands - pass through without modification as they contain all needed info
      if (command.action === 'align' || command.action === 'place-on-floor') {
        enhancedCommands.push(command);
        return;
      }
      
      // Handle spatial relationships for creation, movement, and rotation
      if ((command.action === 'create' || command.action === 'move' || command.action === 'rotate') && command.relativeToObject && command.spatialRelation) {
        const referenceObject = this.findObjectByDescription(command.relativeToObject, sceneObjects);
        
        if (referenceObject) {
          // Handle room placement with place-on-floor command
          if (referenceObject.type === 'custom-room' && command.spatialRelation === 'inside') {
            if (command.action === 'create') {
              // Create object first, then place on floor
              const createCommand: SceneCommand = {
                action: 'create',
                type: command.type,
                color: command.color
              };
              
              // Generate place-on-floor command
              const placeCommand: SceneCommand = {
                action: 'place-on-floor',
                objectId: command.objectId || 'temp-id-needs-generation',
                relativeToObject: referenceObject.roomName || referenceObject.id,
                snapToGrid: true
              };
              
              enhancedCommands.push(createCommand);
              enhancedCommands.push(placeCommand);
            } else if (command.action === 'move' && command.objectId) {
              // Move existing object to room floor
              const placeCommand: SceneCommand = {
                action: 'place-on-floor',
                objectId: command.objectId,
                relativeToObject: referenceObject.roomName || referenceObject.id,
                snapToGrid: true
              };
              
              enhancedCommands.push(placeCommand);
            } else {
              enhancedCommands.push(command);
            }
          } else {
            // Handle non-room spatial relationships with existing logic
            const tempObject: SceneObject = {
              id: 'temp',
              type: command.type || 'cube',
              position: new Vector3(0, 0, 0),
              scale: new Vector3(1, 1, 1),
              rotation: new Vector3(0, 0, 0),
              color: command.color || '#ffffff',
              isNurbs: false
            };

            const placementResult = this.calculatePreciseSpatialPlacement(
              tempObject,
              referenceObject,
              command.spatialRelation,
              sceneObjects
            );

            // Create the primary command (create/move) with position and embedded scale
            const primaryCommand: SceneCommand = {
              ...command,
              x: placementResult.position.x,
              y: placementResult.position.y,
              z: placementResult.position.z,
              matchDimensions: placementResult.matchDimensions,
              contactType: 'direct'
            };

            // If dimension matching is needed, embed scale in the create command
            if (placementResult.scale && command.action === 'create') {
              primaryCommand.scaleX = placementResult.scale.x;
              primaryCommand.scaleY = placementResult.scale.y;
              primaryCommand.scaleZ = placementResult.scale.z;
            }

            enhancedCommands.push(primaryCommand);

            // For move commands, add a separate scale command if needed
            if (placementResult.scale && command.action === 'move' && command.objectId) {
              const scaleCommand: SceneCommand = {
                action: 'scale',
                objectId: command.objectId,
                scaleX: placementResult.scale.x,
                scaleY: placementResult.scale.y,
                scaleZ: placementResult.scale.z
              };
              enhancedCommands.push(scaleCommand);
            }
          }
        } else {
          // If reference object not found, use original command
          enhancedCommands.push(command);
        }
      } else {
        // Handle architectural positioning (existing logic)
        if (command.action === 'create') {
          if (command.type?.startsWith('house-')) {
            if (command.type.includes('roof')) {
              // Enhanced roof positioning
              const targetStructure = this.findBestStructureForRoof(sceneObjects);
              if (targetStructure) {
                const roofPlacement = this.calculateRoofPlacement(
                  command.type,
                  targetStructure,
                  sceneObjects
                );
                
                const roofCommand: SceneCommand = {
                  ...command,
                  x: roofPlacement.position.x,
                  y: roofPlacement.position.y,
                  z: roofPlacement.position.z,
                  scaleX: roofPlacement.scale.x,
                  scaleY: roofPlacement.scale.y,
                  scaleZ: roofPlacement.scale.z,
                  matchDimensions: true,
                  contactType: 'direct'
                };
                
                enhancedCommands.push(roofCommand);
              } else {
                // No structure found, use original logic
                const roofPos = this.findRoofPosition(sceneObjects);
                if (roofPos && command.x === undefined && command.y === undefined && command.z === undefined) {
                  enhancedCommands.push({ ...command, ...roofPos });
                } else {
                  enhancedCommands.push(command);
                }
              }
            } else {
              // Other housing structures
              const connectionPos = this.findConnectionPosition(sceneObjects, command.type);
              if (command.x === undefined && command.y === undefined && command.z === undefined) {
                enhancedCommands.push({ ...command, ...connectionPos });
              } else {
                enhancedCommands.push(command);
              }
            }
          } else {
            // Non-housing objects
            enhancedCommands.push(command);
          }
          
          // Set default colors for housing objects if not specified
          if (command.type?.startsWith('house-') && !command.color) {
            const colorMap: { [key: string]: string } = {
              'house-basic': '#8B4513',
              'house-room': '#DEB887',
              'house-hallway': '#808080',
              'house-roof-flat': '#654321',
              'house-roof-pitched': '#654321'
            };
            const lastCommand = enhancedCommands[enhancedCommands.length - 1];
            if (lastCommand) {
              lastCommand.color = colorMap[command.type] || '#8B4513';
            }
          }
        } else {
          // Non-create actions
          enhancedCommands.push(command);
        }
      }
    });
    
    return enhancedCommands;
  }

  /**
   * Find the best structure to place a roof on
   */
  private findBestStructureForRoof(sceneObjects: SceneObject[]): SceneObject | null {
    // Look for rooms first, then basic houses
    const structures = sceneObjects.filter(obj => 
      obj.type.startsWith('house-') && 
      !obj.type.includes('roof') &&
      obj.type !== 'ground'
    );
    
    // Prioritize rooms over basic houses
    const room = structures.find(obj => obj.type === 'house-room');
    if (room) return room;
    
    const basicHouse = structures.find(obj => obj.type === 'house-basic');
    if (basicHouse) return basicHouse;
    
    // Return first available structure
    return structures[0] || null;
  }

  /**
   * Validate if the service is properly initialized
   */
  public isReady(): boolean {
    return !!this.openai;
  }
}

/**
 * Factory function to create AI service instance
 */
export const createAIService = (apiKey: string): AIService => {
  return new AIService(apiKey);
};
