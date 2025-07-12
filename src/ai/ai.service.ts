import OpenAI from 'openai';
import type { SceneObject as BabylonSceneObject } from '../types/types';
import { Vector3 } from 'babylonjs';
import { spaceAnalysisService } from '../services/spaceAnalysisService';
import type { SpaceAnalysisRequest, SpaceAnalysisResult } from '../services/spaceAnalysisService';
import { furnitureDatabase } from '../data/furnitureDatabase';
import type { FurnitureSpec } from '../data/furnitureDatabase';

// Extend SceneObject to include metadata for this service's use
type SceneObject = BabylonSceneObject & {
  metadata?: any;
};

export interface SceneCommand {
  action: 'move' | 'color' | 'scale' | 'create' | 'delete' | 'rotate' | 'align' | 'undo' | 'redo' | 'describe' | 'rename' | 'texture' | 'analyze-space' | 'optimize-space' | 'furniture-info';
  objectId?: string;
  name?: string;
  type?: string;
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
  edge?: 'north' | 'south' | 'east' | 'west' | 'nearest-wall';
  offset?: number;
  
  // New texture-specific properties
  textureId?: string;
  textureType?: 'diffuse' | 'normal' | 'specular' | 'emissive';
  textureName?: string; // For natural language texture descriptions
  description?: string;
  
  // New space optimization properties
  roomId?: string;
  targetObjectType?: string;
  optimizationStrategy?: 'maximize' | 'comfort' | 'ergonomic' | 'aesthetic';
  useSelectedObjects?: boolean;
  analysisResult?: SpaceAnalysisResult;
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
    private availableTextures: Array<{ id: string; name: string; tags: string[] }> = [];
    private availableGlbObjects: string[] = [];
    private getMeshById: ((id: string) => any) | null = null;

  // Default front face directions for different object types
  private defaultFrontFaces: { [key: string]: Vector3 } = {
    // Basic primitives - most face +Z by default
    'cube': new Vector3(0, 0, 1),
    'sphere': new Vector3(0, 0, 1),
    'cylinder': new Vector3(0, 0, 1),
    'plane': new Vector3(0, 1, 0), // Planes face up by default
    'torus': new Vector3(0, 0, 1),
    'cone': new Vector3(0, 0, 1),
    
    // Housing objects
    'house-basic': new Vector3(0, 0, 1),
    'house-room': new Vector3(0, 0, 1),
    'house-hallway': new Vector3(1, 0, 0), // Hallways typically run along X axis
    'house-door-single': new Vector3(0, 0, 1),
    'house-door-double': new Vector3(0, 0, 1),
    'house-door-sliding': new Vector3(0, 0, 1),
    'house-door-french': new Vector3(0, 0, 1),
    'house-door-garage': new Vector3(0, 0, 1),
    'house-window-single': new Vector3(0, 0, 1),
    'house-window-double': new Vector3(0, 0, 1),
    'house-window-bay': new Vector3(0, 0, 1),
    'house-window-casement': new Vector3(0, 0, 1),
    'house-window-sliding': new Vector3(0, 0, 1),
    'house-window-skylight': new Vector3(0, 1, 0), // Skylights face up
    'house-wall': new Vector3(0, 0, 1),
    'house-ceiling': new Vector3(0, -1, 0), // Ceilings face down
    'house-floor': new Vector3(0, 1, 0), // Floors face up
    'house-roof-flat': new Vector3(0, 1, 0), // Flat roofs face up
    'house-roof-pitched': new Vector3(0, 0, 1),
    
    // GLB objects - common furniture orientations
    'Chair': new Vector3(0, 0, 1), // Chairs typically face forward
    'Desk': new Vector3(0, 0, -1), // Desks face backward (user sits on opposite side)
    'TV': new Vector3(0, 0, -1), // TV screens face backward (toward viewer)
    'Sofa': new Vector3(0, 0, 1), // Sofas face forward
    'Couch Small': new Vector3(0, 0, 1),
    'Bed Single': new Vector3(0, 0, 1), // Beds face forward (foot of bed)
    'Bed Double': new Vector3(0, 0, 1),
    'Table': new Vector3(0, 0, 1), // Tables are omnidirectional but we'll use +Z
    'Simple table': new Vector3(0, 0, 1),
    'Bookcase': new Vector3(0, 0, -1), // Bookcases face backward (books face out)
    'wooden bookshelf': new Vector3(0, 0, -1),
    'Kitchen Fridge': new Vector3(0, 0, -1), // Fridge doors face backward
    'Oven': new Vector3(0, 0, -1), // Oven doors face backward
    'Simple computer': new Vector3(0, 0, -1), // Computer screens face backward
    'Standing Desk': new Vector3(0, 0, -1),
    'Adjustable Desk': new Vector3(0, 0, -1)
  };

  constructor(apiKey: string, glbObjectNames: string[] = []) {
    this.openai = new OpenAI({ 
      apiKey, 
      dangerouslyAllowBrowser: true 
    });
    
    this.availableGlbObjects = glbObjectNames;

    // Initialize available textures
    this.availableTextures = [
      {
        id: 'default-wood-floor-01',
        name: 'Wood Floor - Natural',
        tags: ['wood', 'floor', 'planks', 'natural', 'hardwood', 'wooden']
      },
      {
        id: 'default-fabric-carpet-01',
        name: 'Carpet - Gray Textured',
        tags: ['carpet', 'fabric', 'gray', 'floor', 'textile', 'woven', 'grey']
      },
      {
        id: 'default-brick-wall-01',
        name: 'Brick Wall - Red Standard',
        tags: ['brick', 'wall', 'red', 'masonry', 'exterior', 'classic', 'bricks']
      }
    ];
  }

  /**
   * Set the mesh resolver function for space optimization
   */
  public setMeshResolver(getMeshById: (id: string) => any): void {
    this.getMeshById = getMeshById;
  }

  /**
   * Handle space optimization queries
   */
  public async handleSpaceOptimization(
    prompt: string,
    sceneObjects: SceneObject[],
    selectedObjectIds?: string[]
  ): Promise<SpaceAnalysisResult | null> {
    const lowerPrompt = prompt.toLowerCase();
    
    // Check if this is a space optimization query
    const isSpaceQuery = lowerPrompt.includes('how many') || 
                        lowerPrompt.includes('fit') ||
                        lowerPrompt.includes('space') ||
                        lowerPrompt.includes('optimize') ||
                        lowerPrompt.includes('layout') ||
                        lowerPrompt.includes('arrange');
    
    if (!isSpaceQuery) {
      return null;
    }

    // Find rooms in the scene
    const rooms = sceneObjects.filter(obj => obj.type === 'custom-room');
    if (rooms.length === 0) {
      console.warn('No rooms found for space optimization');
      return null;
    }

    // Use the first room (or could be made smarter)
    const room = rooms[0];
    
    // Determine target object type from prompt
    let targetObjectType: string | undefined;
    const selectedObjects = selectedObjectIds ? 
      sceneObjects.filter(obj => selectedObjectIds.includes(obj.id)) : 
      undefined;

    // Extract object type from prompt
    for (const glbObject of this.availableGlbObjects) {
      if (lowerPrompt.includes(glbObject.toLowerCase())) {
        targetObjectType = glbObject;
        break;
      }
    }

    // Common object types
    const commonTypes = ['desk', 'chair', 'table', 'sofa', 'bed', 'bookcase'];
    for (const type of commonTypes) {
      if (lowerPrompt.includes(type)) {
        targetObjectType = type.charAt(0).toUpperCase() + type.slice(1);
        break;
      }
    }

    if (!this.getMeshById) {
      console.warn('Mesh resolver not set, cannot perform space optimization');
      return null;
    }

    try {
      const request: SpaceAnalysisRequest = {
        roomId: room.id,
        targetObjectType,
        selectedObjects,
        strategy: this.extractOptimizationStrategy(lowerPrompt)
      };

      const result = await spaceAnalysisService.analyzeSpace(
        request,
        sceneObjects,
        this.getMeshById
      );

      return result;
    } catch (error) {
      console.error('Space optimization failed:', error);
      return null;
    }
  }

  /**
   * Extract optimization strategy from prompt
   */
  private extractOptimizationStrategy(prompt: string): { name: 'maximize' | 'comfort' | 'ergonomic' | 'aesthetic'; priority: 'maximize' | 'comfort' | 'ergonomic' | 'aesthetic'; description: string } {
    if (prompt.includes('comfort') || prompt.includes('comfortable')) {
      return { name: 'comfort', priority: 'comfort', description: 'Optimize for comfort and accessibility' };
    } else if (prompt.includes('ergonomic') || prompt.includes('ergonomics')) {
      return { name: 'ergonomic', priority: 'ergonomic', description: 'Optimize for ergonomic layout' };
    } else if (prompt.includes('aesthetic') || prompt.includes('beautiful') || prompt.includes('nice')) {
      return { name: 'aesthetic', priority: 'aesthetic', description: 'Optimize for visual appeal' };
    } else {
      return { name: 'maximize', priority: 'maximize', description: 'Maximize capacity' };
    }
  }

  /**
   * Get furniture information for selected objects
   */
  public getFurnitureInfo(selectedObjects: SceneObject[]): {
    specs: FurnitureSpec[];
    summary: string;
  } {
    const specs = furnitureDatabase.getSpecsForObjects(selectedObjects);
    
    const summary = specs.map(spec => {
      const dims = spec.dimensions;
      return `${spec.name} (${spec.category}): ${dims.width.toFixed(1)}×${dims.height.toFixed(1)}×${dims.depth.toFixed(1)}m, needs ${spec.clearanceRequirements.access.toFixed(1)}m clearance`;
    }).join('\n');

    return { specs, summary };
  }

  /**
   * Calculate the effective size of an object based on its type and scale
   */
  private getObjectDimensions(obj: SceneObject): { width: number; height: number; depth: number } {
    // If actual dimensions are provided (from bounding box), use those
    if ((obj as any).actualDimensions) {
      return (obj as any).actualDimensions;
    }
    
    // Otherwise fall back to base dimensions for known types
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
      'ground': { width: 10, height: 1, depth: 10 }
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
   * Find an object by color or name from the scene
   */
  private findObjectByDescription(description: string, sceneObjects: SceneObject[]): SceneObject | undefined {
    const lowerDesc = description.toLowerCase();
    
    // First try to find by color
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

    // Then try to find by type
    const typeMatches = sceneObjects.filter(obj => 
      obj.type.toLowerCase().includes(lowerDesc) || lowerDesc.includes(obj.type.toLowerCase())
    );

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
   * Find a texture by name or description
   */
  private findTextureByDescription(description: string): { id: string; name: string } | undefined {
    const lowerDesc = description.toLowerCase().trim();
    
    // Direct name match
    const directMatch = this.availableTextures.find(texture => 
      texture.name.toLowerCase() === lowerDesc
    );
    if (directMatch) {
      return { id: directMatch.id, name: directMatch.name };
    }
    
    // Check if any texture tags match the description
    const tagMatch = this.availableTextures.find(texture => 
      texture.tags.some(tag => lowerDesc.includes(tag) || tag.includes(lowerDesc))
    );
    if (tagMatch) {
      return { id: tagMatch.id, name: tagMatch.name };
    }
    
    // Fuzzy match on texture name
    const nameMatch = this.availableTextures.find(texture => 
      texture.name.toLowerCase().includes(lowerDesc) || 
      lowerDesc.includes(texture.name.toLowerCase())
    );
    if (nameMatch) {
      return { id: nameMatch.id, name: nameMatch.name };
    }
    
    // Special cases for common descriptions
    if (lowerDesc.includes('wood') || lowerDesc.includes('wooden') || lowerDesc.includes('hardwood')) {
      const woodTexture = this.availableTextures.find(t => t.id.includes('wood'));
      if (woodTexture) return { id: woodTexture.id, name: woodTexture.name };
    }
    
    if (lowerDesc.includes('carpet') || lowerDesc.includes('rug') || lowerDesc.includes('fabric')) {
      const carpetTexture = this.availableTextures.find(t => t.id.includes('carpet'));
      if (carpetTexture) return { id: carpetTexture.id, name: carpetTexture.name };
    }
    
    if (lowerDesc.includes('brick') || lowerDesc.includes('stone') || lowerDesc.includes('masonry')) {
      const brickTexture = this.availableTextures.find(t => t.id.includes('brick'));
      if (brickTexture) return { id: brickTexture.id, name: brickTexture.name };
    }
    
    return undefined;
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
    
    if (shouldMatchDimensions) {
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

    const housingObjects = sceneObjects.filter(obj => obj.type.startsWith('house-'));
    const primitiveObjects = sceneObjects.filter(obj => !obj.type.startsWith('house-') && obj.type !== 'ground');
    const groundObject = sceneObjects.find(obj => obj.type === 'ground');
    
    let description = '';
    
    if (groundObject) {
      description += `Ground plane at (0, 0, 0). `;
    }
    
    // Process custom rooms first to provide spatial context
    const customRooms = sceneObjects.filter(obj => obj.type === 'custom-room');
    if (customRooms.length > 0) {
      const roomDescriptions = customRooms.map(room => {
        let roomDesc = `Custom room "${room.id}" at (${room.position.x.toFixed(1)}, ${room.position.y.toFixed(1)}, ${room.position.z.toFixed(1)})`;
        if (room.metadata?.floorPolygon) {
          const points = room.metadata.floorPolygon.map((p: { x: number, z: number }) => `(${p.x.toFixed(1)}, ${p.z.toFixed(1)})`).join(', ');
          roomDesc += ` with floor corners at [${points}]. The walls are the segments connecting these corners.`;
        }
        return roomDesc;
      }).join(' ');
      description += `Rooms: ${roomDescriptions}. `;
    }

    if (primitiveObjects.length > 0) {
      const primitiveDescription = primitiveObjects
        .map(obj => {
          const dimensions = this.getObjectDimensions(obj);
          const colorName = this.getColorName(obj.color);
          const sizeDesc = `${dimensions.width.toFixed(1)}×${dimensions.height.toFixed(1)}×${dimensions.depth.toFixed(1)}`;
          
          // Include rotation information if object is rotated
          const rotationDesc = (obj.rotation.x !== 0 || obj.rotation.y !== 0 || obj.rotation.z !== 0) 
            ? ` rotated (${obj.rotation.x.toFixed(2)}, ${obj.rotation.y.toFixed(2)}, ${obj.rotation.z.toFixed(2)}) rad`
            : '';
          
          // Include texture information if object has textures
          let textureDesc = '';
          if (obj.textureIds && obj.textureIds.diffuse) {
            const texture = this.availableTextures.find(t => t.id === obj.textureIds?.diffuse);
            if (texture) {
              textureDesc = ` with ${texture.name}`;
            }
          }
          
          return `${colorName} ${obj.type} "${obj.id}" (${sizeDesc}) at (${obj.position.x.toFixed(1)}, ${obj.position.y.toFixed(1)}, ${obj.position.z.toFixed(1)})${rotationDesc}${textureDesc}`;
        })
        .join(', ');
      description += `Objects: ${primitiveDescription}`;
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
          
          // Include texture information if object has textures
          let textureDesc = '';
          if (obj.textureIds && obj.textureIds.diffuse) {
            const texture = this.availableTextures.find(t => t.id === obj.textureIds?.diffuse);
            if (texture) {
              textureDesc = ` with ${texture.name}`;
            }
          }
          
          return `${colorName} ${friendlyType} "${obj.id}" (${dimensions.width.toFixed(1)}×${dimensions.height.toFixed(1)}×${dimensions.depth.toFixed(1)}) at (${obj.position.x.toFixed(1)}, ${obj.position.y.toFixed(1)}, ${obj.position.z.toFixed(1)})${rotationDesc}${textureDesc}`;
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
  private generateSystemPrompt(sceneDescription: string, objectIds: string[], selectedObjectId?: string | null, selectedObjectIds?: string[]): string {
    // Determine selection description
    let selectionDescription = '';
    if (selectedObjectId) {
      const selectedObj = objectIds.find(id => id === selectedObjectId);
      if (selectedObj) {
        selectionDescription = `Currently selected object: "${selectedObjectId}". `;
      }
    } else if (selectedObjectIds && selectedObjectIds.length > 0) {
      selectionDescription = `Currently selected objects: ${selectedObjectIds.map(id => `"${id}"`).join(', ')}. `;
    } else {
      selectionDescription = 'No objects are currently selected. ';
    }

    const glbObjectsList = this.availableGlbObjects.length > 0
      ? `GLB Library Objects: ${this.availableGlbObjects.join(', ')}`
      : 'No GLB library objects available.';

    return `You are a 3D scene assistant with advanced spatial reasoning and precise positioning capabilities. You can modify a Babylon.js scene with millimeter-accurate positioning and automatic dimension matching.

${sceneDescription}

${selectionDescription}

IMPORTANT: When the user refers to "it", "the object", "selected object", or uses commands without specifying an object, apply the action to the currently selected object(s).

Available actions:
1. move: Move an object to x,y,z coordinates
2. color: Change object color (use hex colors like #ff6b6b, #4ecdc4, #95e1d3, etc.)
3. scale: Scale an object by scaleX, scaleY, scaleZ factors
4. create: Create new objects with intelligent positioning and automatic scaling
5. delete: Remove an object
6. rotate: Rotate an object by rotationX, rotationY, rotationZ angles in radians. 
7. align: Align an object to a specific edge of another object with perfect perpendicularity and flush contact
8. describe: Provide a detailed text description of the current scene. The description should be generated by you based on the scene information provided.
9. undo: Undo the last action performed on the scene
10. redo: Redo the last undone action
11. rename: Rename an object. Requires objectId and a new name.
12. texture: Apply a texture to an object (wood, carpet, brick)
13. analyze-space: Analyze how many objects can fit in a room or space
14. optimize-space: Optimize the layout of objects in a room for maximum efficiency
15. furniture-info: Get detailed information about furniture dimensions and space requirements

AVAILABLE TEXTURES:
- Wood Floor: Natural hardwood planks texture (use: "wood", "wooden", "hardwood", "wood floor")
- Gray Carpet: Textured gray fabric carpet (use: "carpet", "gray carpet", "fabric", "rug")
- Red Brick Wall: Classic red brick masonry (use: "brick", "brick wall", "red brick", "masonry")

OBJECT TYPES:
Basic: cube, sphere, cylinder, plane, torus, cone
Housing: house-basic, house-room, house-hallway, house-roof-flat, house-roof-pitched
${glbObjectsList}

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

COMPOSITE OBJECT NAMING:
- When creating composite objects (like "make a person out of blocks", "build a house", "create a car"), assign meaningful descriptive names to each component.
- Use a consistent naming pattern: [main-object]-[component] (e.g., "person-head", "person-torso", "person-left-arm").
- For humanoid figures: Use parts like head, torso, left-arm, right-arm, left-leg, right-leg.
- For vehicles: Use parts like body, wheels, roof, etc.
- For buildings: Use parts like foundation, walls, roof, door, windows, etc.
- For furniture: Use parts like seat, back, legs, armrests, etc.
- Always make the names descriptive enough that someone could understand what each part represents.

ROTATION PRECISION:
- Rotation values are in radians (not degrees)
- rotationX: Rotation around X-axis (pitch)
- rotationY: Rotation around Y-axis (yaw)
- rotationZ: Rotation around Z-axis (roll)
- For 45° rotation: π/4 ≈ 0.785 radians
- For 30° rotation: π/6 ≈ 0.524 radians
- For 90° rotation: π/2 ≈ 1.571 radians
- For 180° rotation: π ≈ 3.142 radians

FACING LOGIC:
- When asked to make an object "face" another object, the system automatically calculates the proper Y-axis rotation
- Different object types have different "front" directions:
  - Most objects face +Z (north) by default
  - TVs, desks, computers, fridges face -Z (south) by default
  - Planes, floors face +Y (up) by default
  - Ceilings face -Y (down) by default
- The facing calculation preserves X and Z rotations, only adjusting Y rotation
- For "face" commands, you can return rotation values of 0,0,0 - the system will calculate the correct values

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

"Create a cube named 'my-box'":
[{"action": "create", "type": "cube", "name": "my-box", "color": "#ff6b6b", "x": 0, "y": 0, "z": 0}]

"Add a roof to the room":
[{"action": "create", "type": "house-roof-pitched", "color": "#654321", "x": 0, "y": 2.25, "z": 0, "scaleX": 1.0, "scaleY": 1.0, "scaleZ": 1.33}]

"Move the red sphere on top of the blue cube":
[{"action": "move", "objectId": "sphere-id", "x": 0, "y": 2.0, "z": 0}]

"Rename the sphere to 'red-ball'":
[{"action": "rename", "objectId": "sphere-id", "name": "red-ball"}]

COMPOSITE OBJECT EXAMPLES:
"Make a person out of blocks":
[{"action": "create", "type": "cube", "name": "person-head", "color": "#fce38a", "x": 0, "y": 5, "z": 0, "scaleX": 0.8, "scaleY": 0.8, "scaleZ": 0.8},
 {"action": "create", "type": "cube", "name": "person-torso", "color": "#4ecdc4", "x": 0, "y": 3, "z": 0, "scaleX": 1.2, "scaleY": 1.5, "scaleZ": 0.8},
 {"action": "create", "type": "cube", "name": "person-left-arm", "color": "#fce38a", "x": -1.5, "y": 3.5, "z": 0, "scaleX": 0.4, "scaleY": 1.2, "scaleZ": 0.4},
 {"action": "create", "type": "cube", "name": "person-right-arm", "color": "#fce38a", "x": 1.5, "y": 3.5, "z": 0, "scaleX": 0.4, "scaleY": 1.2, "scaleZ": 0.4},
 {"action": "create", "type": "cube", "name": "person-left-leg", "color": "#4ecdc4", "x": -0.4, "y": 1, "z": 0, "scaleX": 0.5, "scaleY": 1.5, "scaleZ": 0.5},
 {"action": "create", "type": "cube", "name": "person-right-leg", "color": "#4ecdc4", "x": 0.4, "y": 1, "z": 0, "scaleX": 0.5, "scaleY": 1.5, "scaleZ": 0.5}]

"Build a simple car":
[{"action": "create", "type": "cube", "name": "car-body", "color": "#ff6b6b", "x": 0, "y": 1, "z": 0, "scaleX": 2, "scaleY": 0.8, "scaleZ": 1},
 {"action": "create", "type": "cylinder", "name": "car-wheel-front-left", "color": "#808080", "x": -1.2, "y": 0.4, "z": 0.6, "scaleX": 0.4, "scaleY": 0.2, "scaleZ": 0.4},
 {"action": "create", "type": "cylinder", "name": "car-wheel-front-right", "color": "#808080", "x": 1.2, "y": 0.4, "z": 0.6, "scaleX": 0.4, "scaleY": 0.2, "scaleZ": 0.4},
 {"action": "create", "type": "cylinder", "name": "car-wheel-rear-left", "color": "#808080", "x": -1.2, "y": 0.4, "z": -0.6, "scaleX": 0.4, "scaleY": 0.2, "scaleZ": 0.4},
 {"action": "create", "type": "cylinder", "name": "car-wheel-rear-right", "color": "#808080", "x": 1.2, "y": 0.4, "z": -0.6, "scaleX": 0.4, "scaleY": 0.2, "scaleZ": 0.4}]

"Create a simple table":
[{"action": "create", "type": "cube", "name": "table-top", "color": "#8B4513", "x": 0, "y": 1.5, "z": 0, "scaleX": 2, "scaleY": 0.1, "scaleZ": 1.2},
 {"action": "create", "type": "cube", "name": "table-leg-1", "color": "#654321", "x": -0.8, "y": 0.75, "z": -0.5, "scaleX": 0.1, "scaleY": 1.5, "scaleZ": 0.1},
 {"action": "create", "type": "cube", "name": "table-leg-2", "color": "#654321", "x": 0.8, "y": 0.75, "z": -0.5, "scaleX": 0.1, "scaleY": 1.5, "scaleZ": 0.1},
 {"action": "create", "type": "cube", "name": "table-leg-3", "color": "#654321", "x": -0.8, "y": 0.75, "z": 0.5, "scaleX": 0.1, "scaleY": 1.5, "scaleZ": 0.1},
 {"action": "create", "type": "cube", "name": "table-leg-4", "color": "#654321", "x": 0.8, "y": 0.75, "z": 0.5, "scaleX": 0.1, "scaleY": 1.5, "scaleZ": 0.1}]

DESCRIBE COMMAND EXAMPLE:
"What is in the scene?":
[{"action": "describe", "description": "The scene contains a red cube and a green sphere"}]

ROTATION COMMAND EXAMPLES:
"Rotate the blue cube 45 degrees around the Y-axis":
[{"action": "rotate", "objectId": "cube-id", "rotationX": 0, "rotationY": 0.785, "rotationZ": 0}]

"Tilt the red sphere 30 degrees forward":
[{"action": "rotate", "objectId": "sphere-id", "rotationX": 0.524, "rotationY": 0, "rotationZ": 0}]

"Spin the green cylinder 90 degrees around its vertical axis":
[{"action": "rotate", "objectId": "cylinder-id", "rotationX": 0, "rotationY": 1.571, "rotationZ": 0}]

"Flip the cube upside down":
[{"action": "rotate", "objectId": "cube-id", "rotationX": 3.142, "rotationY": 0, "rotationZ": 0}]

"Rotate the house 180 degrees to face the opposite direction":
[{"action": "rotate", "objectId": "house-id", "rotationX": 0, "rotationY": 3.142, "rotationZ": 0}]

FACING COMMAND EXAMPLES (let the system calculate the exact rotation):
"Rotate the tv to face the cube":
[{"action": "rotate", "objectId": "tv-id", "rotationX": 0, "rotationY": 0, "rotationZ": 0, "description": "rotate the tv to face the cube"}]

"Make the chair face the table":
[{"action": "rotate", "objectId": "chair-id", "rotationX": 0, "rotationY": 0, "rotationZ": 0, "description": "make the chair face the table"}]

"Turn the sofa toward the TV":
[{"action": "rotate", "objectId": "sofa-id", "rotationX": 0, "rotationY": 0, "rotationZ": 0, "description": "turn the sofa toward the TV"}]

"Point the desk at the window":
[{"action": "rotate", "objectId": "desk-id", "rotationX": 0, "rotationY": 0, "rotationZ": 0, "description": "point the desk at the window"}]

"Orient the bookshelf toward the reading chair":
[{"action": "rotate", "objectId": "bookshelf-id", "rotationX": 0, "rotationY": 0, "rotationZ": 0, "description": "orient the bookshelf toward the reading chair"}]

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

"Align the bookcase to the nearest wall of the room":
[{"action": "align", "objectId": "bookcase-id", "relativeToObject": "room-id", "edge": "nearest-wall"}]

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

ROOM GEOMETRY COMMANDS:
- "against the wall" or "against a wall": Use the 'align' command with 'edge' set to 'nearest-wall' and the room ID as 'relativeToObject'.
  Example: [{"action": "align", "objectId": "chair-1", "relativeToObject": "custom-room-1", "edge": "nearest-wall"}]
  The align command will automatically position the object with its bounding box flush against the wall.

- "in the corner" or "in a corner": To place an object in a corner, calculate the position with proper offsets:
  1. Find the corner coordinates from the room's floor corners
  2. Calculate the object's half-dimensions (width/2, depth/2) from its bounding box
  3. Offset the object from the corner by these half-dimensions plus wall thickness (0.5 units)
  Example: If room has corner at (0,0) and object is 2x2 units, position at (1.5, 0, 1.5) to account for object size and wall thickness
  For "northeast corner": corner with max x,z → position at (cornerX - objectWidth/2 - 0.5, y, cornerZ - objectDepth/2 - 0.5)
  For "southwest corner": corner with min x,z → position at (cornerX + objectWidth/2 + 0.5, y, cornerZ + objectDepth/2 + 0.5)
  For "northwest corner": min x, max z → position at (cornerX + objectWidth/2 + 0.5, y, cornerZ - objectDepth/2 - 0.5)
  For "southeast corner": max x, min z → position at (cornerX - objectWidth/2 - 0.5, y, cornerZ + objectDepth/2 + 0.5)

- "outside the room" or "out of the room": Calculate a position outside the room's polygon.
  Find the nearest wall and place the object beyond it by at least the object's half-dimension plus a margin.
  Example: [{"action": "move", "objectId": "chair-1", "x": 6, "y": 0, "z": 0}] (assuming room extends to x=4)

When working with custom rooms:
- Room corners define the INNER boundaries of the room (where walls meet)
- Standard wall thickness is approximately 0.5 units
- When placing objects in corners, ensure they don't overlap with either wall
- When placing objects against walls, ensure only one face touches the wall
- Always account for the object's own dimensions when calculating positions
- For objects on the floor: ALWAYS use y=0 for the position (objects have pivot at bottom)
- The scene will automatically prevent objects from sinking below the floor

CORNER PLACEMENT EXAMPLES:
Given a room with corners at [(0,0), (5,0), (5,5), (0,5)] and a chair that is 1×1×1 units:
- "Put the chair in the southwest corner": 
  Southwest = min x, min z = (0,0)
  Position = (0 + 0.5 + 0.5, 0, 0 + 0.5 + 0.5) = (1.0, 0, 1.0)
  Note: Y=0 because objects sit on the floor (pivot at bottom)
  Result: [{"action": "move", "objectId": "chair-1", "x": 1.0, "y": 0, "z": 1.0}]

- "Put a 2×2×2 table in the northeast corner":
  Northeast = max x, max z = (5,5)
  Position = (5 - 1 - 0.5, 0, 5 - 1 - 0.5) = (3.5, 0, 3.5)
  Note: Y=0 because objects sit on the floor (pivot at bottom)
  Result: [{"action": "move", "objectId": "table-1", "x": 3.5, "y": 0, "z": 3.5}]

TEXTURE COMMAND EXAMPLES:
"Apply wood texture to the cube":
[{"action": "texture", "objectId": "cube-id", "textureId": "default-wood-floor-01", "textureType": "diffuse"}]

"Make the floor wooden":
[{"action": "texture", "objectId": "floor-id", "textureId": "default-wood-floor-01", "textureType": "diffuse"}]

"Add brick texture to the wall":
[{"action": "texture", "objectId": "wall-id", "textureId": "default-brick-wall-01", "textureType": "diffuse"}]

"Apply carpet to the plane":
[{"action": "texture", "objectId": "plane-id", "textureId": "default-fabric-carpet-01", "textureType": "diffuse"}]

"Give the cube a wooden texture":
[{"action": "texture", "objectId": "cube-id", "textureId": "default-wood-floor-01", "textureType": "diffuse"}]

"Make it brick":
[{"action": "texture", "objectId": "selected-object-id", "textureId": "default-brick-wall-01", "textureType": "diffuse"}]

SPACE OPTIMIZATION COMMAND EXAMPLES:
"How many desks can fit in this room?":
[{"action": "analyze-space", "roomId": "custom-room-1", "targetObjectType": "Desk", "optimizationStrategy": "maximize"}]

"How many chairs can I fit in the room?":
[{"action": "analyze-space", "roomId": "custom-room-1", "targetObjectType": "Chair"}]

"Optimize the space for desks":
[{"action": "optimize-space", "roomId": "custom-room-1", "targetObjectType": "Desk", "optimizationStrategy": "maximize"}]

"How should I arrange chairs for comfort?":
[{"action": "optimize-space", "roomId": "custom-room-1", "targetObjectType": "Chair", "optimizationStrategy": "comfort"}]

"Analyze space for the selected objects":
[{"action": "analyze-space", "roomId": "custom-room-1", "useSelectedObjects": true}]

"Get furniture information for selected objects":
[{"action": "furniture-info", "useSelectedObjects": true}]

"How many of these chairs can fit?" (when chairs are selected):
[{"action": "analyze-space", "roomId": "custom-room-1", "useSelectedObjects": true, "optimizationStrategy": "maximize"}]

"What are the dimensions of the selected furniture?":
[{"action": "furniture-info", "useSelectedObjects": true}]

"Plan an office layout":
[{"action": "optimize-space", "roomId": "custom-room-1", "targetObjectType": "Desk", "optimizationStrategy": "ergonomic"}]


HOUSING OBJECT LOGIC:
- Roofs automatically match underlying structure dimensions
- Rooms and hallways connect at ground level
- Proper architectural proportions maintained
- Direct contact between walls and roofs

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
10. For texture commands: If no object is specified but there's a selected object in the scene, apply texture to the selected object
11. When applying textures, always use textureId (not textureName) in the final command
12. Default to "diffuse" texture type if not specified
13. For corner placement: ALWAYS use the actual dimensions (width×height×depth) shown in the scene description, NOT default values
14. For wall alignment: Account for object dimensions to ensure only one face touches the wall
15. For imported objects (GLB/STL/OBJ): Their pivot is at bottom center, so position.y represents the floor contact point
16. When moving objects, ensure they don't sink below y=0 (the floor level)
17. For composite objects: ALWAYS use meaningful, descriptive names following the [main-object]-[component] pattern
18. When creating multiple objects that form a single conceptual entity, ensure all parts are properly named and positioned relative to each other

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
    sceneObjects: SceneObject[],
    selectedObjectId?: string | null,
    selectedObjectIds?: string[]
  ): Promise<AIServiceResult> {
    if (!prompt.trim()) {
      return {
        success: false,
        error: 'Empty prompt provided'
      };
    }

    try {
      // First, check if this is a space optimization query
      const spaceOptimizationResult = await this.handleSpaceOptimization(
        prompt, 
        sceneObjects, 
        selectedObjectIds || (selectedObjectId ? [selectedObjectId] : undefined)
      );

      if (spaceOptimizationResult) {
        // Return space optimization result as a command
        const strategy = spaceOptimizationResult.request.strategy?.name || 'maximize';
        const command: SceneCommand = {
          action: 'analyze-space',
          roomId: spaceOptimizationResult.request.roomId,
          targetObjectType: spaceOptimizationResult.request.targetObjectType,
          optimizationStrategy: strategy as 'maximize' | 'comfort' | 'ergonomic' | 'aesthetic',
          useSelectedObjects: !!spaceOptimizationResult.request.selectedObjects,
          analysisResult: spaceOptimizationResult
        };

        return {
          success: true,
          commands: [command],
          userPrompt: prompt,
          aiResponse: this.formatSpaceOptimizationResponse(spaceOptimizationResult)
        };
      }

      const sceneDescription = this.describeScene(sceneObjects);
      const objectIds = sceneObjects.map(obj => obj.id);
      const spatialContext = this.extractSpatialContext(prompt, sceneObjects);
      const systemPrompt = this.generateSystemPrompt(sceneDescription, objectIds, selectedObjectId, selectedObjectIds);

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
        const commands = this.enhanceCommandsWithSpatialLogic(rawCommands, sceneObjects, selectedObjectId, selectedObjectIds);
        
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
   * Format space optimization result for AI response
   */
  private formatSpaceOptimizationResponse(result: SpaceAnalysisResult): string {
    const { optimization, furnitureSpec, roomAnalysis, recommendations } = result;
    
    let response = `## Space Analysis Results\n\n`;
    
    // Main result
    if (optimization.maxObjects === 0) {
      response += `❌ **No ${furnitureSpec.type} objects can fit in this room.**\n\n`;
      response += `The room is too small. Minimum area needed: ${furnitureSpec.constraints.minRoomSize}m²\n`;
      response += `Current room area: ${roomAnalysis.area.toFixed(1)}m²\n\n`;
    } else {
      response += `✅ **Maximum ${furnitureSpec.type} objects that can fit: ${optimization.maxObjects}**\n\n`;
      response += `- Space efficiency: ${(optimization.efficiency * 100).toFixed(1)}%\n`;
      response += `- Object dimensions: ${furnitureSpec.dimensions.width.toFixed(1)}×${furnitureSpec.dimensions.height.toFixed(1)}×${furnitureSpec.dimensions.depth.toFixed(1)}m\n`;
      response += `- Required clearance: ${furnitureSpec.clearanceRequirements.access.toFixed(1)}m\n`;
      response += `- Room area: ${roomAnalysis.area.toFixed(1)}m²\n\n`;
    }

    // Recommendations
    if (recommendations.length > 0) {
      response += `## Recommendations\n\n`;
      recommendations.forEach(rec => {
        response += `- ${rec}\n`;
      });
      response += `\n`;
    }

    // Alternative options
    if (result.alternativeOptions.length > 0) {
      response += `## Alternative Options\n\n`;
      result.alternativeOptions.forEach(alt => {
        response += `- ${alt.objectType}: ${alt.maxCount} objects (${(alt.efficiency * 100).toFixed(1)}% efficiency)\n`;
      });
    }

    return response;
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
   * Get the front face direction for an object type
   */
  private getFrontFace(objectType: string): Vector3 {
    // Check if we have a defined front face for this type
    if (this.defaultFrontFaces[objectType]) {
      return this.defaultFrontFaces[objectType].clone();
    }
    
    // For imported models, try to match by partial name
    const lowerType = objectType.toLowerCase();
    for (const [key, value] of Object.entries(this.defaultFrontFaces)) {
      if (lowerType.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerType)) {
        return value.clone();
      }
    }
    
    // Default to +Z for unknown types
    return new Vector3(0, 0, 1);
  }

  /**
   * Calculate the rotation needed for objectA to face objectB
   * @param objectA The object that needs to rotate
   * @param objectB The target object to face
   * @param currentRotation The current rotation of objectA
   * @returns The new rotation values in radians
   */
  private calculateFacingRotation(
    objectA: SceneObject,
    objectB: SceneObject,
    currentRotation: Vector3
  ): { x: number; y: number; z: number } {
    // Get the direction vector from A to B
    const direction = objectB.position.subtract(objectA.position);
    direction.y = 0; // Keep rotation on horizontal plane only
    direction.normalize();
    
    // Get the front face direction for objectA
    const frontFace = objectA.frontFace || this.getFrontFace(objectA.type);
    
    // Calculate the angle between the front face and the direction to target
    // We'll use Y-axis rotation (yaw) for facing
    let targetAngle = Math.atan2(direction.x, direction.z);
    
    console.log(`🎯 Facing calc: ${objectA.id} → ${objectB.id}`);
    console.log(`   Direction: (${direction.x.toFixed(2)}, ${direction.z.toFixed(2)})`);
    console.log(`   Front face: (${frontFace.x}, ${frontFace.y}, ${frontFace.z})`);
    
    // Adjust based on the object's default front face
    if (frontFace.z === -1) {
      // Object faces backward by default, add 180 degrees
      targetAngle += Math.PI;
      console.log(`   Adjusted: +180° (faces backward)`);
    } else if (frontFace.x === 1) {
      // Object faces right by default, adjust by 90 degrees
      targetAngle -= Math.PI / 2;
      console.log(`   Adjusted: -90° (faces right)`);
    } else if (frontFace.x === -1) {
      // Object faces left by default, adjust by 90 degrees
      targetAngle += Math.PI / 2;
      console.log(`   Adjusted: +90° (faces left)`);
    }
    
    // For objects that face up/down (planes, floors, ceilings), we might need different logic
    if (Math.abs(frontFace.y) > 0.9) {
      console.log(`⚠️ Object ${objectA.id} has vertical front face, facing on horizontal plane may not work as expected`);
    }
    
    console.log(`   Final Y rotation: ${this.radiansToDegrees(targetAngle).toFixed(1)}°`);
    
    // Return the new rotation, preserving X and Z rotations
    return {
      x: currentRotation.x,
      y: targetAngle,
      z: currentRotation.z
    };
  }

  /**
   * Detect if a command is asking to face another object
   */
  private detectFacingCommand(prompt: string): { 
    isFacing: boolean; 
    sourceDesc?: string; 
    targetDesc?: string;
  } {
    const lowerPrompt = prompt.toLowerCase();
    
    // Patterns for facing commands
    const facingPatterns = [
      /make (?:the )?(.+?) face (?:the )?(.+)/,
      /rotate (?:the )?(.+?) to face (?:the )?(.+)/,
      /turn (?:the )?(.+?) toward(?:s)? (?:the )?(.+)/,
      /point (?:the )?(.+?) at (?:the )?(.+)/,
      /orient (?:the )?(.+?) toward(?:s)? (?:the )?(.+)/,
      /(.+?) face(?:s)? (?:the )?(.+)/
    ];
    
    for (const pattern of facingPatterns) {
      const match = lowerPrompt.match(pattern);
      if (match) {
        console.log(`🔍 Facing pattern matched: "${match[1]}" → "${match[2]}"`);
        return {
          isFacing: true,
          sourceDesc: match[1].trim(),
          targetDesc: match[2].trim()
        };
      }
    }
    
    return { isFacing: false };
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
      { pattern: /below|under/, relation: 'below' }
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
      
      let referenceObject: SceneObject | undefined;
      
      if (colorMatches && colorMatches.length > 0) {
        const colorMatch = colorMatches[0];
        referenceObject = this.findObjectByDescription(colorMatch, sceneObjects);
      } else if (typeMatches && typeMatches.length > 0) {
        const typeMatch = typeMatches[0];
        referenceObject = this.findObjectByDescription(typeMatch, sceneObjects);
      }

      if (referenceObject) {
        const refDimensions = this.getObjectDimensions(referenceObject);
        const colorName = this.getColorName(referenceObject.color);
        description = `Reference object: ${colorName} ${referenceObject.type} at (${referenceObject.position.x.toFixed(1)}, ${referenceObject.position.y.toFixed(1)}, ${referenceObject.position.z.toFixed(1)}) with dimensions ${refDimensions.width.toFixed(1)}×${refDimensions.height.toFixed(1)}×${refDimensions.depth.toFixed(1)}`;
        
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
  private enhanceCommandsWithSpatialLogic(commands: SceneCommand[], sceneObjects: SceneObject[], selectedObjectId?: string | null, selectedObjectIds?: string[]): SceneCommand[] {
    const enhancedCommands: SceneCommand[] = [];
    
    commands.forEach(command => {
      // Handle rotation commands with facing logic
      if (command.action === 'rotate') {
        // Check if this is a facing command by looking for target object reference
        const facingCommand = this.detectFacingInRotationCommand(command, sceneObjects);
        
        if (facingCommand.isFacing && facingCommand.sourceObject && facingCommand.targetObject) {
          // Calculate the rotation needed to face the target
          const newRotation = this.calculateFacingRotation(
            facingCommand.sourceObject,
            facingCommand.targetObject,
            facingCommand.sourceObject.rotation
          );
          
          // Update the command with calculated rotation values
          command.objectId = facingCommand.sourceObject.id;
          command.rotationX = newRotation.x;
          command.rotationY = newRotation.y;
          command.rotationZ = newRotation.z;
          
          enhancedCommands.push(command);
          return;
        }
      }
      
      // Handle texture commands - resolve texture names to IDs
      if (command.action === 'texture') {
        // If no object is specified but there's a selection, use the selected object
        if (!command.objectId) {
          if (selectedObjectId) {
            command.objectId = selectedObjectId;
            console.log(`🎯 Using selected object for texture: ${selectedObjectId}`);
          } else if (selectedObjectIds && selectedObjectIds.length === 1) {
            command.objectId = selectedObjectIds[0];
            console.log(`🎯 Using selected object for texture: ${selectedObjectIds[0]}`);
          } else if (selectedObjectIds && selectedObjectIds.length > 1) {
            console.warn(`⚠️ Multiple objects selected, please specify which object to texture`);
          }
        }
        
        // If textureId is not provided but textureName is, try to find the texture
        if (!command.textureId && command.textureName) {
          const texture = this.findTextureByDescription(command.textureName);
          if (texture) {
            command.textureId = texture.id;
            console.log(`🎨 Resolved texture "${command.textureName}" to ${texture.name} (${texture.id})`);
          } else {
            console.warn(`⚠️ Could not find texture matching "${command.textureName}"`);
          }
        }
        
        // Default to diffuse texture type if not specified
        if (!command.textureType) {
          command.textureType = 'diffuse';
        }
        
        enhancedCommands.push(command);
        return;
      }
      
      // Handle align commands - pass through without modification as they contain all needed info
      if (command.action === 'align') {
        enhancedCommands.push(command);
        return;
      }
      
      // Handle spatial relationships for creation, movement, and rotation
      if ((command.action === 'create' || command.action === 'move' || command.action === 'rotate') && command.relativeToObject && command.spatialRelation) {
        const referenceObject = this.findObjectByDescription(command.relativeToObject, sceneObjects);
        
        if (referenceObject) {
          // Create a temporary object to calculate dimensions
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
   * Detect if a rotation command is asking to face another object
   */
  private detectFacingInRotationCommand(command: SceneCommand, sceneObjects: SceneObject[]): {
    isFacing: boolean;
    sourceObject?: SceneObject;
    targetObject?: SceneObject;
  } {
    // If rotation values are all 0 and there's a description, it might be a facing command
    if (command.action === 'rotate' && 
        command.rotationX === 0 && 
        command.rotationY === 0 && 
        command.rotationZ === 0 &&
        command.description) {
      
      console.log(`🔄 Checking rotation command for facing: "${command.description}"`);
      const facingInfo = this.detectFacingCommand(command.description);
      if (facingInfo.isFacing && facingInfo.sourceDesc && facingInfo.targetDesc) {
        const sourceObject = this.findObjectByDescription(facingInfo.sourceDesc, sceneObjects);
        const targetObject = this.findObjectByDescription(facingInfo.targetDesc, sceneObjects);
        
        if (sourceObject && targetObject) {
          return {
            isFacing: true,
            sourceObject,
            targetObject
          };
        }
      }
    }
    
    // Also check if the command has objectId but targets another object in description
    if (command.objectId && command.description) {
      const sourceObject = sceneObjects.find(obj => obj.id === command.objectId);
      if (sourceObject) {
        // Look for "to face X" or "face X" patterns in description
        const patterns = [
          /to face (?:the )?(.+)/i,
          /face (?:the )?(.+)/i,
          /toward(?:s)? (?:the )?(.+)/i
        ];
        
        for (const pattern of patterns) {
          const match = command.description.match(pattern);
          if (match) {
            const targetDesc = match[1].trim();
            const targetObject = this.findObjectByDescription(targetDesc, sceneObjects);
            if (targetObject) {
              return {
                isFacing: true,
                sourceObject,
                targetObject
              };
            }
          }
        }
      }
    }
    
    return { isFacing: false };
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
export const createAIService = (apiKey: string, glbObjectNames: string[]): AIService => {
  return new AIService(apiKey, glbObjectNames);
};
