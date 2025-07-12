import { Vector3, Mesh } from 'babylonjs';
import type { SceneObject } from '../types/types';
import { furnitureDatabase, type FurnitureSpec } from '../data/furnitureDatabase';
import { roomAnalysisService, type RoomAnalysisResult, type RoomConstraint, type PlacementZone } from './roomAnalysisService';

export interface PlacementConstraint {
  id: string;
  type: 'clearance' | 'accessibility' | 'safety' | 'ergonomic' | 'building-code' | 'functional';
  severity: 'error' | 'warning' | 'info' | 'suggestion';
  description: string;
  affectedObjects: string[]; // Object IDs that violate this constraint
  position?: Vector3; // Where the violation occurs
  requiredAction: 'move' | 'remove' | 'resize' | 'rotate' | 'group' | 'none';
  suggestedPosition?: Vector3; // Where object should be moved
  measurement: {
    actual: number;
    required: number;
    unit: 'meters' | 'degrees' | 'ratio';
  };
  regulation?: {
    standard: 'ADA' | 'IBC' | 'OSHA' | 'ergonomic' | 'best-practice';
    reference: string;
  };
}

export interface AccessibilityRequirement {
  type: 'pathway' | 'maneuvering-space' | 'reach-zone' | 'clear-floor-space';
  minWidth: number;
  minArea?: number;
  description: string;
  regulation: string;
  priority: 'required' | 'recommended' | 'preferred';
}

export interface PlacementValidationResult {
  isValid: boolean;
  score: number; // 0-100, overall placement quality
  violations: PlacementConstraint[];
  warnings: PlacementConstraint[];
  suggestions: PlacementConstraint[];
  accessibility: {
    meetsADA: boolean;
    pathwayWidth: number;
    maneuvering: boolean;
    reachZones: boolean;
  };
  safety: {
    fireEgress: boolean;
    emergencyAccess: boolean;
    structuralSafety: boolean;
  };
  ergonomics: {
    workflowEfficiency: number;
    comfortLevel: number;
    functionalZones: boolean;
  };
}

export interface PlacementSuggestion {
  objectId: string;
  currentPosition: Vector3;
  suggestedPosition: Vector3;
  reason: string;
  improvement: number; // 0-100, how much this improves the layout
  alternatives: Vector3[]; // Other position options
}

/**
 * Placement Constraints Service - validates and optimizes furniture placement
 */
export class PlacementConstraintsService {
  
  // Standard accessibility requirements
  private accessibilityRequirements: AccessibilityRequirement[] = [
    {
      type: 'pathway',
      minWidth: 0.91, // 36 inches ADA minimum
      description: 'Primary circulation pathways',
      regulation: 'ADA 2010 Section 403.5.1',
      priority: 'required'
    },
    {
      type: 'pathway',
      minWidth: 0.81, // 32 inches secondary
      description: 'Secondary circulation pathways',
      regulation: 'ADA 2010 Section 403.5.1',
      priority: 'recommended'
    },
    {
      type: 'maneuvering-space',
      minWidth: 1.52, // 60 inches turning space
      minArea: 1.83, // 60" x 72" T-turn
      description: 'Wheelchair maneuvering space',
      regulation: 'ADA 2010 Section 304.3',
      priority: 'required'
    },
    {
      type: 'clear-floor-space',
      minWidth: 0.76, // 30 inches
      description: 'Clear floor space at furniture',
      regulation: 'ADA 2010 Section 305.3',
      priority: 'required'
    }
  ];

  /**
   * Validate placement of objects in a room
   */
  public validatePlacement(
    roomMesh: Mesh,
    sceneObjects: SceneObject[],
    roomId: string,
    focusObjects?: string[] // Specific objects to focus validation on
  ): PlacementValidationResult {
    console.log(`🔍 Validating placement in room ${roomId}`);
    
    // Get room analysis
    const roomAnalysis = roomAnalysisService.analyzeRoom(roomMesh, sceneObjects, roomId);
    
    // Get furniture specifications for objects in room
    const roomObjects = this.getObjectsInRoom(sceneObjects, roomAnalysis);
    const furnitureSpecs = roomObjects.map(obj => furnitureDatabase.createSpecFromSceneObject(obj));
    
    // Validate constraints
    const violations: PlacementConstraint[] = [];
    const warnings: PlacementConstraint[] = [];
    const suggestions: PlacementConstraint[] = [];

    // Check clearance constraints
    violations.push(...this.validateClearanceConstraints(roomObjects, furnitureSpecs, roomAnalysis));
    
    // Check accessibility constraints
    violations.push(...this.validateAccessibilityConstraints(roomObjects, furnitureSpecs, roomAnalysis));
    
    // Check safety constraints
    warnings.push(...this.validateSafetyConstraints(roomObjects, furnitureSpecs, roomAnalysis));
    
    // Check ergonomic constraints
    suggestions.push(...this.validateErgonomicConstraints(roomObjects, furnitureSpecs, roomAnalysis));
    
    // Calculate scores
    const accessibility = this.assessAccessibility(roomAnalysis, violations, warnings);
    const safety = this.assessSafety(roomAnalysis, violations, warnings);
    const ergonomics = this.assessErgonomics(roomObjects, furnitureSpecs, roomAnalysis);
    
    // Overall score calculation
    const score = this.calculateOverallScore(violations, warnings, suggestions, accessibility, safety, ergonomics);
    
    const result: PlacementValidationResult = {
      isValid: violations.filter(v => v.severity === 'error').length === 0,
      score,
      violations: violations.filter(v => v.severity === 'error'),
      warnings: [...violations.filter(v => v.severity === 'warning'), ...warnings],
      suggestions,
      accessibility,
      safety,
      ergonomics
    };

    console.log(`✅ Validation complete: ${result.score}/100 score, ${result.violations.length} violations`);
    
    return result;
  }

  /**
   * Generate placement suggestions for improved layout
   */
  public generatePlacementSuggestions(
    roomMesh: Mesh,
    sceneObjects: SceneObject[],
    roomId: string,
    optimizationGoal: 'accessibility' | 'efficiency' | 'safety' | 'ergonomics' = 'accessibility'
  ): PlacementSuggestion[] {
    const roomAnalysis = roomAnalysisService.analyzeRoom(roomMesh, sceneObjects, roomId);
    const roomObjects = this.getObjectsInRoom(sceneObjects, roomAnalysis);
    const suggestions: PlacementSuggestion[] = [];

    for (const obj of roomObjects) {
      const currentValidation = this.validateObjectPlacement(obj, roomObjects, roomAnalysis);
      
      if (currentValidation.violations.length > 0 || currentValidation.score < 80) {
        const betterPositions = this.findBetterPositions(obj, roomObjects, roomAnalysis, optimizationGoal);
        
        if (betterPositions.length > 0) {
          const best = betterPositions[0];
          suggestions.push({
            objectId: obj.id,
            currentPosition: obj.position.clone(),
            suggestedPosition: best.position,
            reason: best.reason,
            improvement: best.improvement,
            alternatives: betterPositions.slice(1, 4).map(p => p.position) // Top 3 alternatives
          });
        }
      }
    }

    return suggestions.sort((a, b) => b.improvement - a.improvement);
  }

  /**
   * Validate clearance constraints
   */
  private validateClearanceConstraints(
    objects: SceneObject[],
    specs: FurnitureSpec[],
    roomAnalysis: RoomAnalysisResult
  ): PlacementConstraint[] {
    const violations: PlacementConstraint[] = [];

    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      const spec = specs[i];

      // Check clearance from walls
      const wallViolations = this.checkWallClearance(obj, spec, roomAnalysis);
      violations.push(...wallViolations);

      // Check clearance from other objects
      for (let j = i + 1; j < objects.length; j++) {
        const otherObj = objects[j];
        const otherSpec = specs[j];
        
        const objectViolations = this.checkObjectClearance(obj, spec, otherObj, otherSpec);
        violations.push(...objectViolations);
      }
    }

    return violations;
  }

  /**
   * Check clearance from walls
   */
  private checkWallClearance(
    obj: SceneObject,
    spec: FurnitureSpec,
    roomAnalysis: RoomAnalysisResult
  ): PlacementConstraint[] {
    const violations: PlacementConstraint[] = [];
    const wallConstraints = roomAnalysis.constraints.filter(c => c.type === 'wall');

    for (const wall of wallConstraints) {
      const distance = Vector3.Distance(obj.position, wall.position);
      const requiredClearance = this.getRequiredWallClearance(spec);
      
      if (distance < requiredClearance) {
        violations.push({
          id: `clearance-wall-${obj.id}-${wall.id}`,
          type: 'clearance',
          severity: distance < requiredClearance * 0.7 ? 'error' : 'warning',
          description: `${spec.type} too close to wall`,
          affectedObjects: [obj.id],
          position: obj.position.clone(),
          requiredAction: 'move',
          measurement: {
            actual: distance,
            required: requiredClearance,
            unit: 'meters'
          },
          regulation: {
            standard: 'best-practice',
            reference: 'Furniture clearance guidelines'
          }
        });
      }
    }

    return violations;
  }

  /**
   * Check clearance between objects
   */
  private checkObjectClearance(
    obj1: SceneObject,
    spec1: FurnitureSpec,
    obj2: SceneObject,
    spec2: FurnitureSpec
  ): PlacementConstraint[] {
    const violations: PlacementConstraint[] = [];
    const distance = Vector3.Distance(obj1.position, obj2.position);
    const requiredClearance = this.getRequiredObjectClearance(spec1, spec2);

    if (distance < requiredClearance) {
      const severity = distance < requiredClearance * 0.5 ? 'error' : 
                     distance < requiredClearance * 0.8 ? 'warning' : 'info';

      violations.push({
        id: `clearance-objects-${obj1.id}-${obj2.id}`,
        type: 'clearance',
        severity,
        description: `Insufficient clearance between ${spec1.type} and ${spec2.type}`,
        affectedObjects: [obj1.id, obj2.id],
        position: obj1.position.add(obj2.position).scale(0.5), // Midpoint
        requiredAction: 'move',
        measurement: {
          actual: distance,
          required: requiredClearance,
          unit: 'meters'
        }
      });
    }

    return violations;
  }

  /**
   * Validate accessibility constraints
   */
  private validateAccessibilityConstraints(
    objects: SceneObject[],
    specs: FurnitureSpec[],
    roomAnalysis: RoomAnalysisResult
  ): PlacementConstraint[] {
    const violations: PlacementConstraint[] = [];

    // Check pathway widths
    violations.push(...this.validatePathwayWidths(objects, roomAnalysis));
    
    // Check maneuvering spaces
    violations.push(...this.validateManeuveringSpaces(objects, specs, roomAnalysis));
    
    // Check reach zones
    violations.push(...this.validateReachZones(objects, specs));

    return violations;
  }

  /**
   * Validate pathway widths
   */
  private validatePathwayWidths(
    objects: SceneObject[],
    roomAnalysis: RoomAnalysisResult
  ): PlacementConstraint[] {
    const violations: PlacementConstraint[] = [];
    
    // Check accessibility paths from room analysis
    for (const path of roomAnalysis.accessibilityPaths) {
      if (path.width < 0.91) { // ADA minimum
        violations.push({
          id: `pathway-width-${path.id}`,
          type: 'accessibility',
          severity: path.width < 0.81 ? 'error' : 'warning',
          description: `Pathway too narrow for accessibility`,
          affectedObjects: path.blockedBy.map(id => id.replace(/^object-/, '')),
          position: path.start.add(path.end).scale(0.5),
          requiredAction: 'move',
          measurement: {
            actual: path.width,
            required: 0.91,
            unit: 'meters'
          },
          regulation: {
            standard: 'ADA',
            reference: 'ADA 2010 Section 403.5.1'
          }
        });
      }
    }

    return violations;
  }

  /**
   * Validate maneuvering spaces
   */
  private validateManeuveringSpaces(
    objects: SceneObject[],
    specs: FurnitureSpec[],
    roomAnalysis: RoomAnalysisResult
  ): PlacementConstraint[] {
    const violations: PlacementConstraint[] = [];

    // Check for 60" turning circle availability
    const optimalZones = roomAnalysis.placementZones.filter(z => z.type === 'optimal' || z.type === 'good');
    
    for (const zone of optimalZones) {
      const turningRadius = 0.76; // 30" radius for 60" diameter
      const availableRadius = Math.sqrt(zone.area / Math.PI);
      
      if (availableRadius < turningRadius) {
        violations.push({
          id: `maneuvering-space-${zone.id}`,
          type: 'accessibility',
          severity: 'warning',
          description: 'Insufficient space for wheelchair maneuvering',
          affectedObjects: zone.constraints.map(id => id.replace(/^object-/, '')).filter(id => id),
          position: zone.center,
          requiredAction: 'move',
          measurement: {
            actual: availableRadius * 2,
            required: 1.52,
            unit: 'meters'
          },
          regulation: {
            standard: 'ADA',
            reference: 'ADA 2010 Section 304.3'
          }
        });
      }
    }

    return violations;
  }

  /**
   * Validate reach zones
   */
  private validateReachZones(
    objects: SceneObject[],
    specs: FurnitureSpec[]
  ): PlacementConstraint[] {
    const violations: PlacementConstraint[] = [];

    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      const spec = specs[i];

      // Check if object requires front access (desks, appliances)
      if (spec.category === 'desk' || spec.category === 'appliance') {
        const frontClearance = spec.clearanceRequirements.front;
        
        if (frontClearance < 0.76) { // ADA clear floor space
          violations.push({
            id: `reach-zone-${obj.id}`,
            type: 'accessibility',
            severity: 'warning',
            description: `Insufficient clear floor space at ${spec.type}`,
            affectedObjects: [obj.id],
            position: obj.position.clone(),
            requiredAction: 'move',
            measurement: {
              actual: frontClearance,
              required: 0.76,
              unit: 'meters'
            },
            regulation: {
              standard: 'ADA',
              reference: 'ADA 2010 Section 305.3'
            }
          });
        }
      }
    }

    return violations;
  }

  /**
   * Validate safety constraints
   */
  private validateSafetyConstraints(
    objects: SceneObject[],
    specs: FurnitureSpec[],
    roomAnalysis: RoomAnalysisResult
  ): PlacementConstraint[] {
    const warnings: PlacementConstraint[] = [];

    // Check fire egress paths
    warnings.push(...this.validateFireEgressPaths(objects, roomAnalysis));
    
    // Check emergency access
    warnings.push(...this.validateEmergencyAccess(objects, specs, roomAnalysis));

    return warnings;
  }

  /**
   * Validate fire egress paths
   */
  private validateFireEgressPaths(
    objects: SceneObject[],
    roomAnalysis: RoomAnalysisResult
  ): PlacementConstraint[] {
    const warnings: PlacementConstraint[] = [];
    
    // Find doors marked as fire exits
    const fireExits = roomAnalysis.constraints.filter(c => 
      c.type === 'door' && c.metadata?.isFireExit
    );

    for (const exit of fireExits) {
      // Check for 44" (1.12m) minimum egress width
      const egressPath = roomAnalysis.accessibilityPaths.find(p => 
        Vector3.Distance(p.start, exit.position) < 0.5
      );

      if (egressPath && egressPath.width < 1.12) {
        warnings.push({
          id: `fire-egress-${exit.id}`,
          type: 'safety',
          severity: 'warning',
          description: 'Fire egress path may be too narrow',
          affectedObjects: egressPath.blockedBy.map(id => id.replace(/^object-/, '')),
          position: exit.position.clone(),
          requiredAction: 'move',
          measurement: {
            actual: egressPath.width,
            required: 1.12,
            unit: 'meters'
          },
          regulation: {
            standard: 'IBC',
            reference: 'International Building Code Section 1005.1'
          }
        });
      }
    }

    return warnings;
  }

  /**
   * Validate emergency access
   */
  private validateEmergencyAccess(
    objects: SceneObject[],
    specs: FurnitureSpec[],
    roomAnalysis: RoomAnalysisResult
  ): PlacementConstraint[] {
    const warnings: PlacementConstraint[] = [];

    // Check that all areas of room are accessible
    const restrictedZones = roomAnalysis.placementZones.filter(z => z.type === 'restricted');
    
    if (restrictedZones.length > 0) {
      const totalRestrictedArea = restrictedZones.reduce((sum, z) => sum + z.area, 0);
      const restrictedRatio = totalRestrictedArea / roomAnalysis.roomGeometry.area;

      if (restrictedRatio > 0.2) { // More than 20% of room is inaccessible
        warnings.push({
          id: 'emergency-access-restriction',
          type: 'safety',
          severity: 'warning',
          description: 'Large areas of room are inaccessible for emergency response',
          affectedObjects: objects.map(obj => obj.id),
          requiredAction: 'move',
          measurement: {
            actual: restrictedRatio,
            required: 0.2,
            unit: 'ratio'
          }
        });
      }
    }

    return warnings;
  }

  /**
   * Validate ergonomic constraints
   */
  private validateErgonomicConstraints(
    objects: SceneObject[],
    specs: FurnitureSpec[],
    roomAnalysis: RoomAnalysisResult
  ): PlacementConstraint[] {
    const suggestions: PlacementConstraint[] = [];

    // Check workflow efficiency for office furniture
    suggestions.push(...this.validateWorkflowEfficiency(objects, specs));
    
    // Check comfort zones
    suggestions.push(...this.validateComfortZones(objects, specs, roomAnalysis));

    return suggestions;
  }

  /**
   * Validate workflow efficiency
   */
  private validateWorkflowEfficiency(
    objects: SceneObject[],
    specs: FurnitureSpec[]
  ): PlacementConstraint[] {
    const suggestions: PlacementConstraint[] = [];

    // Find desk and chair pairs
    const desks = objects.filter((_, i) => specs[i].category === 'desk');
    const chairs = objects.filter((_, i) => specs[i].category === 'seating');

    for (const desk of desks) {
      const nearestChair = chairs.reduce((nearest, chair) => {
        const distance = Vector3.Distance(desk.position, chair.position);
        return !nearest || distance < Vector3.Distance(desk.position, nearest.position) ? chair : nearest;
      }, null as SceneObject | null);

      if (nearestChair) {
        const distance = Vector3.Distance(desk.position, nearestChair.position);
        if (distance > 1.5) { // More than 1.5m apart
          suggestions.push({
            id: `workflow-desk-chair-${desk.id}`,
            type: 'ergonomic',
            severity: 'suggestion',
            description: 'Desk and chair could be positioned closer for better workflow',
            affectedObjects: [desk.id, nearestChair.id],
            position: desk.position.clone(),
            requiredAction: 'move',
            measurement: {
              actual: distance,
              required: 1.2,
              unit: 'meters'
            }
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Validate comfort zones
   */
  private validateComfortZones(
    objects: SceneObject[],
    specs: FurnitureSpec[],
    roomAnalysis: RoomAnalysisResult
  ): PlacementConstraint[] {
    const suggestions: PlacementConstraint[] = [];

    // Check seating orientation towards windows/views
    const windows = roomAnalysis.constraints.filter(c => c.type === 'window');
    const seating = objects.filter((_, i) => specs[i].category === 'seating');

    if (windows.length > 0 && seating.length > 0) {
      for (const seat of seating) {
        const nearestWindow = windows.reduce((nearest, window) => {
          const distance = Vector3.Distance(seat.position, window.position);
          return !nearest || distance < Vector3.Distance(seat.position, nearest.position) ? window : nearest;
        }, null as RoomConstraint | null);

        if (nearestWindow) {
          const distance = Vector3.Distance(seat.position, nearestWindow.position);
          if (distance > 3.0) { // Far from natural light
            suggestions.push({
              id: `comfort-lighting-${seat.id}`,
              type: 'ergonomic',
              severity: 'suggestion',
              description: 'Seating could be positioned closer to natural light',
              affectedObjects: [seat.id],
              position: seat.position.clone(),
              requiredAction: 'move',
              measurement: {
                actual: distance,
                required: 2.5,
                unit: 'meters'
              }
            });
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Get objects that are inside the specified room
   */
  private getObjectsInRoom(
    sceneObjects: SceneObject[],
    roomAnalysis: RoomAnalysisResult
  ): SceneObject[] {
    return sceneObjects.filter(obj => {
      if (obj.type === 'custom-room') return false;
      return this.isPointInRoom(obj.position, roomAnalysis.roomGeometry.floorPolygon);
    });
  }

  /**
   * Check if point is inside room polygon
   */
  private isPointInRoom(point: Vector3, polygon: { x: number; z: number }[]): boolean {
    const x = point.x;
    const z = point.z;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, zi = polygon[i].z;
      const xj = polygon[j].x, zj = polygon[j].z;

      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Get required wall clearance for furniture type
   */
  private getRequiredWallClearance(spec: FurnitureSpec): number {
    if (spec.usagePattern.wallPlacement === 'required') {
      return 0.05; // 5cm for wall-mounted items
    }
    return Math.max(0.3, spec.clearanceRequirements.back); // 30cm minimum or spec requirement
  }

  /**
   * Get required clearance between two objects
   */
  private getRequiredObjectClearance(spec1: FurnitureSpec, spec2: FurnitureSpec): number {
    const clearance1 = spec1.clearanceRequirements.access;
    const clearance2 = spec2.clearanceRequirements.access;
    
    // Use the larger clearance requirement
    return Math.max(clearance1, clearance2);
  }

  /**
   * Validate placement of a single object
   */
  private validateObjectPlacement(
    obj: SceneObject,
    allObjects: SceneObject[],
    roomAnalysis: RoomAnalysisResult
  ): { violations: PlacementConstraint[]; score: number } {
    const spec = furnitureDatabase.createSpecFromSceneObject(obj);
    const otherObjects = allObjects.filter(o => o.id !== obj.id);
    const otherSpecs = otherObjects.map(o => furnitureDatabase.createSpecFromSceneObject(o));
    
    const violations: PlacementConstraint[] = [];
    
    // Check this object against all constraints
    violations.push(...this.checkWallClearance(obj, spec, roomAnalysis));
    
    for (let i = 0; i < otherObjects.length; i++) {
      violations.push(...this.checkObjectClearance(obj, spec, otherObjects[i], otherSpecs[i]));
    }
    
    const score = Math.max(0, 100 - (violations.length * 20));
    
    return { violations, score };
  }

  /**
   * Find better positions for an object
   */
  private findBetterPositions(
    obj: SceneObject,
    allObjects: SceneObject[],
    roomAnalysis: RoomAnalysisResult,
    goal: 'accessibility' | 'efficiency' | 'safety' | 'ergonomics'
  ): { position: Vector3; reason: string; improvement: number }[] {
    const positions: { position: Vector3; reason: string; improvement: number }[] = [];
    const currentValidation = this.validateObjectPlacement(obj, allObjects, roomAnalysis);
    
    // Test positions in optimal zones
    const optimalZones = roomAnalysis.placementZones.filter(z => 
      z.type === 'optimal' || z.type === 'good'
    );
    
    for (const zone of optimalZones) {
      // Test center of zone
      const testPosition = zone.center.clone();
      
      // Temporarily move object
      const originalPosition = obj.position.clone();
      obj.position = testPosition;
      
      const testValidation = this.validateObjectPlacement(obj, allObjects, roomAnalysis);
      
      // Restore original position
      obj.position = originalPosition;
      
      if (testValidation.score > currentValidation.score) {
        positions.push({
          position: testPosition,
          reason: `Better ${goal} in ${zone.type} zone`,
          improvement: testValidation.score - currentValidation.score
        });
      }
    }
    
    return positions.sort((a, b) => b.improvement - a.improvement);
  }

  /**
   * Calculate overall placement score
   */
  private calculateOverallScore(
    violations: PlacementConstraint[],
    warnings: PlacementConstraint[],
    suggestions: PlacementConstraint[],
    accessibility: any,
    safety: any,
    ergonomics: any
  ): number {
    let score = 100;
    
    // Deduct for violations
    score -= violations.filter(v => v.severity === 'error').length * 25;
    score -= violations.filter(v => v.severity === 'warning').length * 10;
    score -= warnings.length * 5;
    
    // Factor in specific assessments
    if (!accessibility.meetsADA) score -= 20;
    if (!safety.fireEgress) score -= 15;
    score += ergonomics.workflowEfficiency * 0.1;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess accessibility compliance
   */
  private assessAccessibility(
    roomAnalysis: RoomAnalysisResult,
    violations: PlacementConstraint[],
    warnings: PlacementConstraint[]
  ): PlacementValidationResult['accessibility'] {
    const accessibilityViolations = violations.filter(v => v.type === 'accessibility');
    const pathwayViolations = accessibilityViolations.filter(v => v.id.includes('pathway'));
    const maneuveringViolations = accessibilityViolations.filter(v => v.id.includes('maneuvering'));
    const reachViolations = accessibilityViolations.filter(v => v.id.includes('reach'));

    const minPathwayWidth = Math.min(...roomAnalysis.accessibilityPaths.map(p => p.width));

    return {
      meetsADA: accessibilityViolations.filter(v => v.severity === 'error').length === 0,
      pathwayWidth: minPathwayWidth,
      maneuvering: maneuveringViolations.length === 0,
      reachZones: reachViolations.length === 0
    };
  }

  /**
   * Assess safety compliance
   */
  private assessSafety(
    roomAnalysis: RoomAnalysisResult,
    violations: PlacementConstraint[],
    warnings: PlacementConstraint[]
  ): PlacementValidationResult['safety'] {
    const safetyViolations = violations.filter(v => v.type === 'safety');
    const fireEgressViolations = safetyViolations.filter(v => v.id.includes('fire-egress'));
    const emergencyViolations = safetyViolations.filter(v => v.id.includes('emergency'));

    return {
      fireEgress: fireEgressViolations.length === 0,
      emergencyAccess: emergencyViolations.length === 0,
      structuralSafety: true // Placeholder - would need structural analysis
    };
  }

  /**
   * Assess ergonomic quality
   */
  private assessErgonomics(
    objects: SceneObject[],
    specs: FurnitureSpec[],
    roomAnalysis: RoomAnalysisResult
  ): PlacementValidationResult['ergonomics'] {
    // Calculate workflow efficiency based on object relationships
    let workflowScore = 70; // Base score
    
    // Bonus for desk-chair proximity
    const desks = objects.filter((_, i) => specs[i].category === 'desk');
    const chairs = objects.filter((_, i) => specs[i].category === 'seating');
    
    if (desks.length > 0 && chairs.length > 0) {
      const avgDistance = desks.reduce((sum, desk) => {
        const nearestChair = chairs.reduce((nearest, chair) => {
          const distance = Vector3.Distance(desk.position, chair.position);
          return !nearest || distance < Vector3.Distance(desk.position, nearest.position) ? chair : nearest;
        }, null as SceneObject | null);
        
        return sum + (nearestChair ? Vector3.Distance(desk.position, nearestChair.position) : 2.0);
      }, 0) / desks.length;
      
      if (avgDistance < 1.5) workflowScore += 20;
      else if (avgDistance > 2.0) workflowScore -= 10;
    }

    return {
      workflowEfficiency: Math.max(0, Math.min(100, workflowScore)),
      comfortLevel: 75, // Placeholder - would need detailed comfort analysis
      functionalZones: roomAnalysis.placementZones.filter(z => z.type === 'optimal').length > 0
    };
  }
}

// Export singleton instance
export const placementConstraintsService = new PlacementConstraintsService(); 