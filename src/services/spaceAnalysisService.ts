import { Vector3, Mesh } from 'babylonjs';
import { spaceOptimizer } from '../algorithms/spaceOptimization';
import type { OptimizationResult, SpaceOptimizationConfig, OptimizationStrategy } from '../algorithms/spaceOptimization';
import { furnitureDatabase } from '../data/furnitureDatabase';
import type { FurnitureSpec } from '../data/furnitureDatabase';
import type { SceneObject } from '../types/types';
import { calculateRoomArea } from '../algorithms/spaceOptimizationUtils';

export interface SpaceAnalysisRequest {
  roomId: string;
  targetObjectType?: string;           // Type of object to optimize for
  selectedObjects?: SceneObject[];     // Use these objects as reference
  strategy?: OptimizationStrategy;     // Optimization strategy
  customConstraints?: Partial<SpaceOptimizationConfig>; // Override constraints
}

export interface SpaceAnalysisResult {
  request: SpaceAnalysisRequest;
  optimization: OptimizationResult;
  furnitureSpec: FurnitureSpec;
  roomAnalysis: {
    area: number;
    usableArea: number;
    efficiency: number;
    density: number;
  };
  recommendations: string[];
  alternativeOptions: {
    objectType: string;
    maxCount: number;
    efficiency: number;
  }[];
}

/**
 * Space Analysis Service - bridges furniture database, scene objects, and space optimization
 */
export class SpaceAnalysisService {
  
  /**
   * Analyze space for selected objects or object type
   */
  public async analyzeSpace(
    request: SpaceAnalysisRequest,
    sceneObjects: SceneObject[],
    getMeshById: (id: string) => Mesh | null
  ): Promise<SpaceAnalysisResult> {
    console.log(`🔍 Starting space analysis for room ${request.roomId}`);
    
    // Find the room mesh
    const roomMesh = getMeshById(request.roomId);
    if (!roomMesh) {
      throw new Error(`Room ${request.roomId} not found`);
    }

    // Get furniture specification
    const furnitureSpec = this.getFurnitureSpecification(request);
    
    // Create optimization config from furniture spec
    const optimizationConfig = this.createOptimizationConfig(furnitureSpec, request.customConstraints);
    
    // Run space optimization
    const optimization = spaceOptimizer.optimizeSpace(
      roomMesh,
      furnitureSpec.type,
      request.strategy || { name: 'maximize', priority: 'maximize', description: 'Maximize capacity' },
      optimizationConfig
    );

    // Analyze room
    const roomAnalysis = this.analyzeRoom(roomMesh, furnitureSpec);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(optimization, furnitureSpec, roomAnalysis);
    
    // Find alternative options
    const alternativeOptions = await this.findAlternativeOptions(roomMesh, sceneObjects);

    const result: SpaceAnalysisResult = {
      request,
      optimization,
      furnitureSpec,
      roomAnalysis,
      recommendations,
      alternativeOptions
    };

    console.log(`✅ Space analysis complete: ${optimization.maxObjects} ${furnitureSpec.type} objects, ${(optimization.efficiency * 100).toFixed(1)}% efficiency`);
    
    return result;
  }

  /**
   * Get furniture specification based on request parameters
   */
  private getFurnitureSpecification(request: SpaceAnalysisRequest): FurnitureSpec {
    // If selected objects are provided, use the first one as reference
    if (request.selectedObjects && request.selectedObjects.length > 0) {
      const selectedObject = request.selectedObjects[0];
      console.log(`📋 Using selected object: ${selectedObject.id} (${selectedObject.type})`);
      
      // Extract real dimensions and create spec
      const spec = furnitureDatabase.createSpecFromSceneObject(selectedObject);
      
      // If multiple objects selected, average their dimensions (for similar objects)
      if (request.selectedObjects.length > 1) {
        const avgDimensions = this.averageObjectDimensions(request.selectedObjects);
        spec.dimensions = avgDimensions;
        spec.name = `Average ${spec.type}`;
        console.log(`📊 Averaged dimensions from ${request.selectedObjects.length} objects`);
      }
      
      return spec;
    }

    // If target object type is specified, use database spec
    if (request.targetObjectType) {
      const spec = furnitureDatabase.getFurniture(request.targetObjectType);
      if (spec) {
        console.log(`📚 Using database spec for: ${request.targetObjectType}`);
        return spec;
      }
    }

    // Fallback: create generic spec
    console.log(`⚠️ Creating generic spec for: ${request.targetObjectType || 'unknown'}`);
    return this.createGenericFurnitureSpec(request.targetObjectType || 'unknown');
  }

  /**
   * Average dimensions from multiple scene objects
   */
  private averageObjectDimensions(objects: SceneObject[]): { width: number; height: number; depth: number } {
    let totalWidth = 0, totalHeight = 0, totalDepth = 0;
    let validCount = 0;

    for (const obj of objects) {
      try {
        const dimensions = furnitureDatabase.extractDimensionsFromMesh(obj);
        totalWidth += dimensions.width;
        totalHeight += dimensions.height;
        totalDepth += dimensions.depth;
        validCount++;
      } catch (error) {
        console.warn(`Failed to extract dimensions from ${obj.id}:`, error);
      }
    }

    if (validCount === 0) {
      return { width: 1, height: 1, depth: 1 };
    }

    return {
      width: totalWidth / validCount,
      height: totalHeight / validCount,
      depth: totalDepth / validCount
    };
  }

  /**
   * Create optimization configuration from furniture specification
   */
  private createOptimizationConfig(
    furnitureSpec: FurnitureSpec, 
    customConstraints?: Partial<SpaceOptimizationConfig>
  ): Partial<SpaceOptimizationConfig> {
    const baseConfig: Partial<SpaceOptimizationConfig> = {
      objectType: furnitureSpec.type,
      minClearance: Math.min(furnitureSpec.clearanceRequirements.left, furnitureSpec.clearanceRequirements.right),
      accessClearance: furnitureSpec.clearanceRequirements.access,
      wallOffset: furnitureSpec.usagePattern.wallPlacement === 'required' ? 0.05 : 0.2,
      cornerUsage: furnitureSpec.constraints.cornerPlacement,
      grouping: furnitureSpec.usagePattern.groupingRules.includes('linear') || 
                furnitureSpec.usagePattern.groupingRules.includes('cluster'),
      gridResolution: 0.2
    };

    // Apply custom constraints if provided
    return { ...baseConfig, ...customConstraints };
  }

  /**
   * Analyze room properties
   */
  private analyzeRoom(roomMesh: Mesh, furnitureSpec: FurnitureSpec): {
    area: number;
    usableArea: number;
    efficiency: number;
    density: number;
  } {
    const floorPolygon = roomMesh.metadata?.floorPolygon || [];
    const area = calculateRoomArea(floorPolygon);
    
    // Estimate usable area (subtract wall buffer)
    const wallBuffer = 0.5; // 50cm buffer from walls
    const perimeter = this.calculatePerimeter(floorPolygon);
    const usableArea = Math.max(0, area - (perimeter * wallBuffer));

    // Calculate efficiency based on furniture footprint
    const footprint = furnitureSpec.dimensions.width * furnitureSpec.dimensions.depth;
    const clearanceArea = Math.PI * furnitureSpec.clearanceRequirements.access * furnitureSpec.clearanceRequirements.access;
    const objectAreaNeeded = footprint + clearanceArea;
    
    const maxTheoretical = Math.floor(usableArea / objectAreaNeeded);
    const efficiency = maxTheoretical > 0 ? 1.0 : 0.0;
    const density = 1.0 / objectAreaNeeded; // Objects per square meter

    return {
      area,
      usableArea,
      efficiency,
      density
    };
  }

  /**
   * Calculate perimeter of polygon
   */
  private calculatePerimeter(polygon: { x: number; z: number }[]): number {
    let perimeter = 0;
    for (let i = 0; i < polygon.length; i++) {
      const current = polygon[i];
      const next = polygon[(i + 1) % polygon.length];
      const dx = next.x - current.x;
      const dz = next.z - current.z;
      perimeter += Math.sqrt(dx * dx + dz * dz);
    }
    return perimeter;
  }

  /**
   * Generate recommendations based on analysis results
   */
  private generateRecommendations(
    optimization: OptimizationResult,
    furnitureSpec: FurnitureSpec,
    roomAnalysis: { area: number; usableArea: number; efficiency: number; density: number }
  ): string[] {
    const recommendations: string[] = [];

    // Capacity recommendations
    if (optimization.maxObjects === 0) {
      recommendations.push(`Room is too small for ${furnitureSpec.type}. Minimum room size needed: ${furnitureSpec.constraints.minRoomSize}m²`);
      
      // Suggest smaller alternatives
      if (furnitureSpec.category === 'desk') {
        recommendations.push('Consider a smaller desk or wall-mounted desk solution');
      } else if (furnitureSpec.category === 'table') {
        recommendations.push('Consider a smaller table or folding table');
      }
    } else if (optimization.maxObjects === 1) {
      recommendations.push(`Room can accommodate 1 ${furnitureSpec.type} with ${(optimization.efficiency * 100).toFixed(0)}% space utilization`);
    } else {
      recommendations.push(`Room can accommodate up to ${optimization.maxObjects} ${furnitureSpec.type} objects`);
    }

    // Efficiency recommendations
    if (optimization.efficiency > 0.85) {
      recommendations.push('⚠️ Space utilization is very high. Consider reducing objects for better comfort and accessibility.');
    } else if (optimization.efficiency < 0.4 && optimization.maxObjects > 0) {
      recommendations.push('💡 Space utilization is low. You could add more objects or consider larger furniture.');
    }

    // Accessibility recommendations
    const hasAccessibilityIssues = optimization.layouts.some(layout => 
      layout.accessZones.some(zone => zone.required && zone.radius < 0.9)
    );
    if (hasAccessibilityIssues) {
      recommendations.push('♿ Some placements may not meet accessibility requirements (90cm pathways)');
    }

    // Furniture-specific recommendations
    if (furnitureSpec.category === 'desk' && furnitureSpec.constraints.requiresElectricity) {
      recommendations.push('🔌 Ensure adequate electrical outlets for desk placement');
    }

    if (furnitureSpec.category === 'seating' && optimization.maxObjects > 6) {
      recommendations.push('💺 For large seating arrangements, consider grouping chairs around tables');
    }

    // Room shape recommendations
    const aspectRatio = Math.sqrt(roomAnalysis.area) / Math.sqrt(roomAnalysis.area); // This is simplified
    if (roomAnalysis.area / roomAnalysis.usableArea < 0.7) {
      recommendations.push('📐 Room shape has many corners/alcoves. Consider furniture that works well in irregular spaces.');
    }

    return recommendations;
  }

  /**
   * Find alternative furniture options for the room
   */
  private async findAlternativeOptions(
    roomMesh: Mesh,
    sceneObjects: SceneObject[]
  ): Promise<{ objectType: string; maxCount: number; efficiency: number }[]> {
    const alternatives: { objectType: string; maxCount: number; efficiency: number }[] = [];
    
    // Test common furniture types
    const testTypes = ['Chair', 'Desk', 'Table', 'Sofa', 'Bookcase'];
    
    for (const objectType of testTypes) {
      try {
        const result = spaceOptimizer.optimizeSpace(roomMesh, objectType);
        if (result.maxObjects > 0) {
          alternatives.push({
            objectType,
            maxCount: result.maxObjects,
            efficiency: result.efficiency
          });
        }
      } catch (error) {
        console.warn(`Failed to test ${objectType}:`, error);
      }
    }

    // Sort by efficiency
    alternatives.sort((a, b) => b.efficiency - a.efficiency);
    
    return alternatives.slice(0, 5); // Return top 5 alternatives
  }

  /**
   * Create a generic furniture specification
   */
  private createGenericFurnitureSpec(objectType: string): FurnitureSpec {
    return {
      id: objectType,
      name: objectType,
      type: objectType,
      category: 'other',
      dimensions: { width: 1.0, height: 1.0, depth: 1.0 },
      clearanceRequirements: { front: 0.6, back: 0.3, left: 0.3, right: 0.3, access: 0.8 },
      usagePattern: {
        primaryDirection: new Vector3(0, 0, 1),
        accessPoints: [new Vector3(0, 0, 0.5)],
        groupingRules: ['flexible'],
        wallPlacement: 'optional'
      },
      constraints: {
        cornerPlacement: false,
        requiresElectricity: false,
        requiresPlumbing: false,
        minRoomSize: 2.0
      },
      metadata: {
        description: `Generic ${objectType} object`,
        tags: ['generic', 'unknown'],
        estimatedCost: 100
      }
    };
  }

  /**
   * Quick analysis for selected objects
   */
  public analyzeSelectedObjects(
    selectedObjects: SceneObject[],
    roomId: string,
    sceneObjects: SceneObject[],
    getMeshById: (id: string) => Mesh | null
  ): Promise<SpaceAnalysisResult> {
    if (selectedObjects.length === 0) {
      throw new Error('No objects selected for analysis');
    }

    const request: SpaceAnalysisRequest = {
      roomId,
      selectedObjects,
      strategy: { name: 'maximize', priority: 'maximize', description: 'Maximize capacity based on selected object' }
    };

    return this.analyzeSpace(request, sceneObjects, getMeshById);
  }

  /**
   * Get optimization summary for multiple object types
   */
  public async getCapacityReport(
    roomId: string,
    objectTypes: string[],
    getMeshById: (id: string) => Mesh | null
  ): Promise<{ objectType: string; maxObjects: number; efficiency: number; warnings: string[] }[]> {
    const roomMesh = getMeshById(roomId);
    if (!roomMesh) {
      throw new Error(`Room ${roomId} not found`);
    }

    const results = [];

    for (const objectType of objectTypes) {
      try {
        const optimization = spaceOptimizer.optimizeSpace(roomMesh, objectType);
        results.push({
          objectType,
          maxObjects: optimization.maxObjects,
          efficiency: optimization.efficiency,
          warnings: optimization.warnings
        });
      } catch (error) {
        console.warn(`Failed to analyze ${objectType}:`, error);
        results.push({
          objectType,
          maxObjects: 0,
          efficiency: 0,
          warnings: [`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
        });
      }
    }

    return results;
  }
}

// Export singleton instance
export const spaceAnalysisService = new SpaceAnalysisService(); 