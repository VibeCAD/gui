import { Vector3, Mesh } from 'babylonjs';
import type { SceneObject } from '../types/types';
import { spaceOptimizer, type OptimizationResult, type OptimizationStrategy, type PlacementLayout } from '../algorithms/spaceOptimization';
import { furnitureDatabase, type FurnitureSpec } from '../data/furnitureDatabase';
import { roomAnalysisService, type RoomAnalysisResult, type PlacementZone } from './roomAnalysisService';
import { placementConstraintsService, type PlacementValidationResult } from './placementConstraintsService';

export interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  category: 'office' | 'living' | 'bedroom' | 'conference' | 'classroom' | 'flexible';
  furnitureTypes: {
    type: string;
    quantity: number;
    priority: 'required' | 'preferred' | 'optional';
    constraints?: {
      wallPlacement?: boolean;
      groupWith?: string[];
      orientation?: 'north' | 'south' | 'east' | 'west' | 'flexible';
    };
  }[];
  minRoomSize: number; // Minimum room area required
  preferredAspectRatio?: number; // Preferred room width/depth ratio
}

export interface GeneratedLayout {
  id: string;
  templateId?: string;
  strategy: OptimizationStrategy;
  objects: {
    id: string;
    type: string;
    position: Vector3;
    rotation: Vector3;
    scale: Vector3;
    furnitureSpec: FurnitureSpec;
  }[];
  metrics: {
    score: number; // Overall layout quality (0-100)
    spaceEfficiency: number; // How well space is utilized
    accessibility: number; // ADA compliance score
    ergonomics: number; // Workflow and comfort score
    safety: number; // Safety and egress score
  };
  validation: PlacementValidationResult;
  zones: {
    functional: { name: string; center: Vector3; radius: number }[];
    circulation: { start: Vector3; end: Vector3; width: number }[];
    storage: { position: Vector3; capacity: number }[];
  };
}

export interface LayoutGenerationRequest {
  roomId: string;
  templateId?: string; // Use predefined template
  customRequirements?: {
    furnitureTypes: string[];
    maxObjects?: number;
    prioritizeAccessibility?: boolean;
    prioritizeEfficiency?: boolean;
  };
  constraints?: {
    existingObjects?: string[]; // Object IDs to keep in place
    restrictedZones?: { center: Vector3; radius: number }[];
    requiredClearances?: { [objectType: string]: number };
  };
  strategies?: OptimizationStrategy[]; // Generate layouts for multiple strategies
}

export interface LayoutGenerationResult {
  layouts: GeneratedLayout[];
  recommendations: {
    preferred: string; // Layout ID of best overall option
    mostEfficient: string; // Layout ID with best space efficiency
    mostAccessible: string; // Layout ID with best accessibility
    alternatives: string[]; // Other viable layout IDs
  };
  roomAnalysis: RoomAnalysisResult;
  summary: {
    totalLayouts: number;
    validLayouts: number;
    averageScore: number;
    bestScore: number;
  };
}

/**
 * Layout Generation Service - creates optimized furniture arrangements
 */
export class LayoutGenerationService {
  
  // Predefined layout templates
  private templates: LayoutTemplate[] = [
    {
      id: 'office-single',
      name: 'Single Office',
      description: 'Individual workspace with desk and seating',
      category: 'office',
      furnitureTypes: [
        { type: 'Desk', quantity: 1, priority: 'required', constraints: { wallPlacement: true } },
        { type: 'Chair', quantity: 1, priority: 'required' },
        { type: 'Bookcase', quantity: 1, priority: 'preferred', constraints: { wallPlacement: true } }
      ],
      minRoomSize: 6.0,
      preferredAspectRatio: 1.2
    },
    {
      id: 'office-collaborative',
      name: 'Collaborative Office',
      description: 'Multiple workstations with shared table',
      category: 'office',
      furnitureTypes: [
        { type: 'Desk', quantity: 4, priority: 'required' },
        { type: 'Chair', quantity: 4, priority: 'required' },
        { type: 'Table', quantity: 1, priority: 'preferred' },
        { type: 'Chair', quantity: 4, priority: 'preferred' } // Extra chairs for table
      ],
      minRoomSize: 20.0,
      preferredAspectRatio: 1.5
    },
    {
      id: 'conference-room',
      name: 'Conference Room',
      description: 'Meeting space with central table and seating',
      category: 'conference',
      furnitureTypes: [
        { type: 'Table', quantity: 1, priority: 'required' },
        { type: 'Chair', quantity: 8, priority: 'required', constraints: { groupWith: ['Table'] } }
      ],
      minRoomSize: 15.0,
      preferredAspectRatio: 1.3
    },
    {
      id: 'living-room',
      name: 'Living Room',
      description: 'Comfortable seating area with entertainment',
      category: 'living',
      furnitureTypes: [
        { type: 'Sofa', quantity: 1, priority: 'required' },
        { type: 'Chair', quantity: 2, priority: 'preferred' },
        { type: 'Simple table', quantity: 1, priority: 'preferred' },
        { type: 'TV', quantity: 1, priority: 'optional', constraints: { wallPlacement: true } }
      ],
      minRoomSize: 12.0,
      preferredAspectRatio: 1.4
    },
    {
      id: 'classroom',
      name: 'Classroom',
      description: 'Educational space with multiple desks',
      category: 'classroom',
      furnitureTypes: [
        { type: 'Desk', quantity: 12, priority: 'required', constraints: { orientation: 'north' } },
        { type: 'Chair', quantity: 12, priority: 'required' },
        { type: 'Desk', quantity: 1, priority: 'required', constraints: { wallPlacement: true } } // Teacher desk
      ],
      minRoomSize: 30.0,
      preferredAspectRatio: 1.6
    }
  ];

  /**
   * Generate optimized layouts for a room
   */
  public async generateLayouts(
    roomMesh: Mesh,
    sceneObjects: SceneObject[],
    request: LayoutGenerationRequest,
    getMeshById: (id: string) => Mesh | null
  ): Promise<LayoutGenerationResult> {
    console.log(`🎨 Generating layouts for room ${request.roomId}`);
    
    // Analyze room
    const roomAnalysis = roomAnalysisService.analyzeRoom(roomMesh, sceneObjects, request.roomId);
    
    // Determine furniture requirements
    const furnitureRequirements = this.determineFurnitureRequirements(request, roomAnalysis);
    
    // Generate layouts for different strategies
    const strategies = request.strategies || [
      { name: 'maximize', priority: 'maximize', description: 'Maximize furniture capacity' },
      { name: 'comfort', priority: 'comfort', description: 'Optimize for comfort and accessibility' },
      { name: 'ergonomic', priority: 'ergonomic', description: 'Optimize for workflow efficiency' },
      { name: 'aesthetic', priority: 'aesthetic', description: 'Optimize for visual appeal' }
    ];
    
    const layouts: GeneratedLayout[] = [];
    
    for (const strategy of strategies) {
      const layoutsForStrategy = await this.generateLayoutsForStrategy(
        roomMesh,
        sceneObjects,
        request,
        roomAnalysis,
        furnitureRequirements,
        strategy
      );
      layouts.push(...layoutsForStrategy);
    }

    // Validate all layouts
    for (const layout of layouts) {
      layout.validation = placementConstraintsService.validatePlacement(
        roomMesh,
        this.convertLayoutToSceneObjects(layout),
        request.roomId
      );
      layout.metrics = this.calculateLayoutMetrics(layout, roomAnalysis);
    }

    // Filter valid layouts and sort by score
    const validLayouts = layouts.filter(l => l.validation.isValid || l.metrics.score > 60);
    validLayouts.sort((a, b) => b.metrics.score - a.metrics.score);

    // Generate recommendations
    const recommendations = this.generateRecommendations(validLayouts);
    
    // Calculate summary
    const summary = this.calculateSummary(layouts, validLayouts);

    const result: LayoutGenerationResult = {
      layouts: validLayouts,
      recommendations,
      roomAnalysis,
      summary
    };

    console.log(`✅ Generated ${result.layouts.length} valid layouts from ${layouts.length} total`);
    
    return result;
  }

  /**
   * Generate layout from template
   */
  public async generateFromTemplate(
    roomMesh: Mesh,
    sceneObjects: SceneObject[],
    roomId: string,
    templateId: string,
    strategy: OptimizationStrategy = { name: 'comfort', priority: 'comfort', description: 'Comfortable layout' }
  ): Promise<GeneratedLayout | null> {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const roomAnalysis = roomAnalysisService.analyzeRoom(roomMesh, sceneObjects, roomId);
    
    // Check if room meets template requirements
    if (roomAnalysis.roomGeometry.area < template.minRoomSize) {
      console.warn(`Room too small for template ${templateId}: ${roomAnalysis.roomGeometry.area}m² < ${template.minRoomSize}m²`);
      return null;
    }

    const layout = await this.createLayoutFromTemplate(roomMesh, roomAnalysis, template, strategy);
    
    if (layout) {
      // Validate layout
      layout.validation = placementConstraintsService.validatePlacement(
        roomMesh,
        this.convertLayoutToSceneObjects(layout),
        roomId
      );
      layout.metrics = this.calculateLayoutMetrics(layout, roomAnalysis);
    }

    return layout;
  }

  /**
   * Get available templates for room
   */
  public getCompatibleTemplates(roomArea: number, category?: string): LayoutTemplate[] {
    return this.templates.filter(template => {
      const sizeCompatible = roomArea >= template.minRoomSize;
      const categoryMatch = !category || template.category === category;
      return sizeCompatible && categoryMatch;
    });
  }

  /**
   * Determine furniture requirements from request
   */
  private determineFurnitureRequirements(
    request: LayoutGenerationRequest,
    roomAnalysis: RoomAnalysisResult
  ): { type: string; quantity: number; priority: 'required' | 'preferred' | 'optional' }[] {
    if (request.templateId) {
      const template = this.templates.find(t => t.id === request.templateId);
      if (template) {
        return template.furnitureTypes.map(ft => ({
          type: ft.type,
          quantity: ft.quantity,
          priority: ft.priority
        }));
      }
    }

    if (request.customRequirements?.furnitureTypes) {
      return request.customRequirements.furnitureTypes.map(type => ({
        type,
        quantity: 1,
        priority: 'required' as const
      }));
    }

    // Default requirements based on room size
    const area = roomAnalysis.roomGeometry.area;
    const requirements: { type: string; quantity: number; priority: 'required' | 'preferred' | 'optional' }[] = [];

    if (area >= 6) {
      requirements.push({ type: 'Desk', quantity: 1, priority: 'required' });
      requirements.push({ type: 'Chair', quantity: 1, priority: 'required' });
    }

    if (area >= 12) {
      requirements.push({ type: 'Table', quantity: 1, priority: 'preferred' });
      requirements.push({ type: 'Bookcase', quantity: 1, priority: 'optional' });
    }

    if (area >= 20) {
      requirements.push({ type: 'Sofa', quantity: 1, priority: 'preferred' });
    }

    return requirements;
  }

  /**
   * Generate layouts for a specific strategy
   */
  private async generateLayoutsForStrategy(
    roomMesh: Mesh,
    sceneObjects: SceneObject[],
    request: LayoutGenerationRequest,
    roomAnalysis: RoomAnalysisResult,
    furnitureRequirements: { type: string; quantity: number; priority: 'required' | 'preferred' | 'optional' }[],
    strategy: OptimizationStrategy
  ): Promise<GeneratedLayout[]> {
    const layouts: GeneratedLayout[] = [];

    // Generate layouts for each furniture type
    for (const requirement of furnitureRequirements) {
      if (requirement.priority === 'optional' && strategy.name === 'maximize') {
        continue; // Skip optional items for maximize strategy
      }

      for (let i = 0; i < requirement.quantity; i++) {
        try {
          const optimization = spaceOptimizer.optimizeSpace(
            roomMesh,
            requirement.type,
            strategy
          );

          if (optimization.maxObjects > 0 && optimization.layouts.length > 0) {
            // Create layout from optimization result
            const layout = this.createLayoutFromOptimization(
              optimization,
              requirement.type,
              strategy,
              roomAnalysis
            );
            
            if (layout) {
              layouts.push(layout);
            }
          }
        } catch (error) {
          console.warn(`Failed to generate layout for ${requirement.type}:`, error);
        }
      }
    }

    // Combine individual layouts into comprehensive layouts
    const combinedLayouts = this.combineIndividualLayouts(layouts, roomAnalysis, strategy);
    
    return combinedLayouts;
  }

  /**
   * Create layout from optimization result
   */
  private createLayoutFromOptimization(
    optimization: OptimizationResult,
    objectType: string,
    strategy: OptimizationStrategy,
    roomAnalysis: RoomAnalysisResult
  ): GeneratedLayout | null {
    if (optimization.layouts.length === 0) return null;

    const bestLayout = optimization.layouts[0]; // Take the best layout
    const furnitureSpec = furnitureDatabase.getFurniture(objectType);
    
    if (!furnitureSpec) {
      console.warn(`No furniture spec found for ${objectType}`);
      return null;
    }

    const objects = bestLayout.positions.map((pos, index) => ({
      id: `${objectType.toLowerCase()}-${index + 1}`,
      type: objectType,
      position: pos.clone(),
      rotation: new Vector3(0, 0, 0), // Default rotation
      scale: new Vector3(1, 1, 1), // Default scale
      furnitureSpec
    }));

    return {
      id: `${strategy.name}-${objectType}-${Date.now()}`,
      strategy,
      objects,
      metrics: {
        score: optimization.efficiency * 100,
        spaceEfficiency: optimization.efficiency,
        accessibility: 75, // Placeholder - would be calculated from validation
        ergonomics: strategy.name === 'ergonomic' ? 85 : 70,
        safety: 80
      },
      validation: {} as PlacementValidationResult, // Will be filled later
      zones: {
        functional: this.identifyFunctionalZones(objects, roomAnalysis),
        circulation: this.identifyCirculationPaths(objects, roomAnalysis),
        storage: this.identifyStorageAreas(objects, roomAnalysis)
      }
    };
  }

  /**
   * Create layout from template
   */
  private async createLayoutFromTemplate(
    roomMesh: Mesh,
    roomAnalysis: RoomAnalysisResult,
    template: LayoutTemplate,
    strategy: OptimizationStrategy
  ): Promise<GeneratedLayout | null> {
    const objects: GeneratedLayout['objects'] = [];

    // Place furniture according to template requirements
    for (const furnitureType of template.furnitureTypes) {
      const furnitureSpec = furnitureDatabase.getFurniture(furnitureType.type);
      if (!furnitureSpec) continue;

      // Find optimal placement zones for this furniture type
      const suitableZones = roomAnalysis.placementZones.filter(zone => 
        zone.recommendedFor.includes(furnitureType.type) && 
        (zone.type === 'optimal' || zone.type === 'good')
      );

      // Place furniture in zones
      for (let i = 0; i < Math.min(furnitureType.quantity, suitableZones.length); i++) {
        const zone = suitableZones[i];
        
        // Apply template constraints
        let position = zone.center.clone();
        let rotation = new Vector3(0, 0, 0);

        if (furnitureType.constraints?.wallPlacement) {
          // Move to nearest wall
          position = this.findWallPlacement(position, roomAnalysis, furnitureSpec);
        }

        if (furnitureType.constraints?.orientation) {
          rotation = this.getOrientationRotation(furnitureType.constraints.orientation);
        }

        objects.push({
          id: `${furnitureType.type.toLowerCase()}-${i + 1}`,
          type: furnitureType.type,
          position,
          rotation,
          scale: new Vector3(1, 1, 1),
          furnitureSpec
        });
      }
    }

    if (objects.length === 0) return null;

    return {
      id: `template-${template.id}-${Date.now()}`,
      templateId: template.id,
      strategy,
      objects,
      metrics: {
        score: 0, // Will be calculated
        spaceEfficiency: 0,
        accessibility: 0,
        ergonomics: 0,
        safety: 0
      },
      validation: {} as PlacementValidationResult,
      zones: {
        functional: this.identifyFunctionalZones(objects, roomAnalysis),
        circulation: this.identifyCirculationPaths(objects, roomAnalysis),
        storage: this.identifyStorageAreas(objects, roomAnalysis)
      }
    };
  }

  /**
   * Combine individual layouts into comprehensive layouts
   */
  private combineIndividualLayouts(
    individualLayouts: GeneratedLayout[],
    roomAnalysis: RoomAnalysisResult,
    strategy: OptimizationStrategy
  ): GeneratedLayout[] {
    if (individualLayouts.length <= 1) {
      return individualLayouts;
    }

    // Group layouts by object type
    const layoutsByType = new Map<string, GeneratedLayout[]>();
    for (const layout of individualLayouts) {
      const type = layout.objects[0]?.type || 'unknown';
      if (!layoutsByType.has(type)) {
        layoutsByType.set(type, []);
      }
      layoutsByType.get(type)!.push(layout);
    }

    // Create combined layouts
    const combinedLayouts: GeneratedLayout[] = [];
    const maxCombinations = 3; // Limit number of combinations

    for (let i = 0; i < maxCombinations && i < individualLayouts.length; i++) {
      const combinedObjects: GeneratedLayout['objects'] = [];
      let combinedScore = 0;
      
      // Take one layout from each type
      for (const [type, layouts] of layoutsByType) {
        if (layouts.length > i) {
          combinedObjects.push(...layouts[i].objects);
          combinedScore += layouts[i].metrics.score;
        }
      }

      if (combinedObjects.length > 0) {
        combinedLayouts.push({
          id: `combined-${strategy.name}-${i + 1}-${Date.now()}`,
          strategy,
          objects: combinedObjects,
          metrics: {
            score: combinedScore / layoutsByType.size,
            spaceEfficiency: 0, // Will be recalculated
            accessibility: 0,
            ergonomics: 0,
            safety: 0
          },
          validation: {} as PlacementValidationResult,
          zones: {
            functional: this.identifyFunctionalZones(combinedObjects, roomAnalysis),
            circulation: this.identifyCirculationPaths(combinedObjects, roomAnalysis),
            storage: this.identifyStorageAreas(combinedObjects, roomAnalysis)
          }
        });
      }
    }

    return combinedLayouts.length > 0 ? combinedLayouts : individualLayouts;
  }

  /**
   * Convert layout to scene objects for validation
   */
  private convertLayoutToSceneObjects(layout: GeneratedLayout): SceneObject[] {
    return layout.objects.map(obj => ({
      id: obj.id,
      type: obj.type as any,
      position: obj.position.clone(),
      rotation: obj.rotation.clone(),
      scale: obj.scale.clone(),
      color: '#8B4513',
      isNurbs: false
    }));
  }

  /**
   * Calculate layout metrics
   */
  private calculateLayoutMetrics(
    layout: GeneratedLayout,
    roomAnalysis: RoomAnalysisResult
  ): GeneratedLayout['metrics'] {
    const validation = layout.validation;
    
    // Space efficiency: furniture area / usable room area
    const furnitureArea = layout.objects.reduce((sum, obj) => {
      const spec = obj.furnitureSpec;
      return sum + (spec.dimensions.width * spec.dimensions.depth);
    }, 0);
    
    const spaceEfficiency = Math.min(1.0, furnitureArea / roomAnalysis.spaceUtilization.usableArea);
    
    // Accessibility score from validation
    const accessibility = validation.accessibility ? 
      (validation.accessibility.meetsADA ? 90 : 60) +
      (validation.accessibility.maneuvering ? 10 : 0) : 75;
    
    // Ergonomics score from validation
    const ergonomics = validation.ergonomics ? 
      validation.ergonomics.workflowEfficiency : 70;
    
    // Safety score from validation
    const safety = validation.safety ? 
      (validation.safety.fireEgress ? 40 : 20) +
      (validation.safety.emergencyAccess ? 40 : 20) +
      (validation.safety.structuralSafety ? 20 : 10) : 75;
    
    // Overall score
    const score = validation.score || 
      (spaceEfficiency * 25 + accessibility * 0.25 + ergonomics * 0.25 + safety * 0.25);

    return {
      score: Math.round(score),
      spaceEfficiency: Math.round(spaceEfficiency * 100) / 100,
      accessibility: Math.round(accessibility),
      ergonomics: Math.round(ergonomics),
      safety: Math.round(safety)
    };
  }

  /**
   * Generate recommendations for layouts
   */
  private generateRecommendations(layouts: GeneratedLayout[]): LayoutGenerationResult['recommendations'] {
    if (layouts.length === 0) {
      return {
        preferred: '',
        mostEfficient: '',
        mostAccessible: '',
        alternatives: []
      };
    }

    const sortedByScore = [...layouts].sort((a, b) => b.metrics.score - a.metrics.score);
    const sortedByEfficiency = [...layouts].sort((a, b) => b.metrics.spaceEfficiency - a.metrics.spaceEfficiency);
    const sortedByAccessibility = [...layouts].sort((a, b) => b.metrics.accessibility - a.metrics.accessibility);

    return {
      preferred: sortedByScore[0].id,
      mostEfficient: sortedByEfficiency[0].id,
      mostAccessible: sortedByAccessibility[0].id,
      alternatives: sortedByScore.slice(1, 4).map(l => l.id)
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(
    allLayouts: GeneratedLayout[],
    validLayouts: GeneratedLayout[]
  ): LayoutGenerationResult['summary'] {
    const scores = validLayouts.map(l => l.metrics.score);
    
    return {
      totalLayouts: allLayouts.length,
      validLayouts: validLayouts.length,
      averageScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      bestScore: scores.length > 0 ? Math.max(...scores) : 0
    };
  }

  /**
   * Helper: Find wall placement for furniture
   */
  private findWallPlacement(
    currentPosition: Vector3,
    roomAnalysis: RoomAnalysisResult,
    furnitureSpec: FurnitureSpec
  ): Vector3 {
    const walls = roomAnalysis.constraints.filter(c => c.type === 'wall');
    if (walls.length === 0) return currentPosition;

    // Find nearest wall
    const nearestWall = walls.reduce((nearest, wall) => {
      const distance = Vector3.Distance(currentPosition, wall.position);
      return !nearest || distance < Vector3.Distance(currentPosition, nearest.position) ? wall : nearest;
    }, null as any);

    if (nearestWall) {
      // Position furniture near wall with proper clearance
      const direction = nearestWall.position.subtract(currentPosition).normalize();
      const clearance = furnitureSpec.usagePattern.wallPlacement === 'required' ? 0.1 : 0.3;
      return nearestWall.position.subtract(direction.scale(clearance + furnitureSpec.dimensions.depth / 2));
    }

    return currentPosition;
  }

  /**
   * Helper: Get rotation for orientation
   */
  private getOrientationRotation(orientation: 'north' | 'south' | 'east' | 'west' | 'flexible'): Vector3 {
    const rotations = {
      'north': new Vector3(0, 0, 0),
      'south': new Vector3(0, Math.PI, 0),
      'east': new Vector3(0, Math.PI / 2, 0),
      'west': new Vector3(0, -Math.PI / 2, 0),
      'flexible': new Vector3(0, 0, 0)
    };
    
    return rotations[orientation] || new Vector3(0, 0, 0);
  }

  /**
   * Helper: Identify functional zones
   */
  private identifyFunctionalZones(
    objects: GeneratedLayout['objects'],
    roomAnalysis: RoomAnalysisResult
  ): { name: string; center: Vector3; radius: number }[] {
    const zones: { name: string; center: Vector3; radius: number }[] = [];

    // Group objects by category
    const categories = new Set(objects.map(obj => obj.furnitureSpec.category));
    
    for (const category of categories) {
      const categoryObjects = objects.filter(obj => obj.furnitureSpec.category === category);
      if (categoryObjects.length === 0) continue;

      // Calculate center of objects in this category
      const center = categoryObjects.reduce((sum, obj) => sum.add(obj.position), Vector3.Zero())
        .scale(1 / categoryObjects.length);
      
      // Calculate radius to encompass all objects
      const radius = Math.max(...categoryObjects.map(obj => Vector3.Distance(center, obj.position))) + 1.0;

      zones.push({
        name: `${category} zone`,
        center,
        radius
      });
    }

    return zones;
  }

  /**
   * Helper: Identify circulation paths
   */
  private identifyCirculationPaths(
    objects: GeneratedLayout['objects'],
    roomAnalysis: RoomAnalysisResult
  ): { start: Vector3; end: Vector3; width: number }[] {
    // Use accessibility paths from room analysis as base
    return roomAnalysis.accessibilityPaths.map(path => ({
      start: path.start.clone(),
      end: path.end.clone(),
      width: path.width
    }));
  }

  /**
   * Helper: Identify storage areas
   */
  private identifyStorageAreas(
    objects: GeneratedLayout['objects'],
    roomAnalysis: RoomAnalysisResult
  ): { position: Vector3; capacity: number }[] {
    const storageObjects = objects.filter(obj => obj.furnitureSpec.category === 'storage');
    
    return storageObjects.map(obj => ({
      position: obj.position.clone(),
      capacity: obj.furnitureSpec.dimensions.width * obj.furnitureSpec.dimensions.height * obj.furnitureSpec.dimensions.depth
    }));
  }
}

// Export singleton instance
export const layoutGenerationService = new LayoutGenerationService(); 