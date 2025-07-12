import { Vector3, Mesh } from 'babylonjs';
import { spaceOptimizer } from './spaceOptimization';
import type { OptimizationResult, SpaceOptimizationConfig } from './spaceOptimization';

/**
 * Utility functions for space optimization testing and integration
 */

/**
 * Create a mock room mesh for testing purposes
 */
export function createMockRoom(corners: { x: number; z: number }[], roomId: string = 'test-room'): Mesh {
  // Create a mock mesh (this would normally be a real Babylon.js mesh)
  const mockMesh = {
    id: roomId,
    name: roomId,
    metadata: {
      floorPolygon: corners
    },
    getBoundingInfo: () => ({
      boundingBox: {
        minimumWorld: new Vector3(-10, 0, -10),
        maximumWorld: new Vector3(10, 2, 10)
      }
    }),
    getChildMeshes: () => []
  } as unknown as Mesh;

  return mockMesh;
}

/**
 * Test the space optimization algorithm with a simple rectangular room
 */
export function testSpaceOptimization(): void {
  console.log('🧪 Testing Space Optimization Algorithm');

  // Create a 5x4 meter rectangular room
  const roomCorners = [
    { x: 0, z: 0 },
    { x: 5, z: 0 },
    { x: 5, z: 4 },
    { x: 0, z: 4 }
  ];

  const testRoom = createMockRoom(roomCorners, 'test-office');

  // Test with desks
  console.log('\n📊 Testing desk placement optimization:');
  const deskResult = spaceOptimizer.optimizeSpace(testRoom, 'Desk');
  console.log(`Max desks: ${deskResult.maxObjects}`);
  console.log(`Efficiency: ${(deskResult.efficiency * 100).toFixed(1)}%`);
  console.log(`Warnings: ${deskResult.warnings.join(', ')}`);

  // Test with chairs
  console.log('\n🪑 Testing chair placement optimization:');
  const chairResult = spaceOptimizer.optimizeSpace(testRoom, 'Chair');
  console.log(`Max chairs: ${chairResult.maxObjects}`);
  console.log(`Efficiency: ${(chairResult.efficiency * 100).toFixed(1)}%`);

  // Test with tables
  console.log('\n🪑 Testing table placement optimization:');
  const tableResult = spaceOptimizer.optimizeSpace(testRoom, 'Table');
  console.log(`Max tables: ${tableResult.maxObjects}`);
  console.log(`Efficiency: ${(tableResult.efficiency * 100).toFixed(1)}%`);

  console.log('\n✅ Space optimization tests completed');
}

/**
 * Calculate room area from floor polygon
 */
export function calculateRoomArea(floorPolygon: { x: number; z: number }[]): number {
  let area = 0;
  for (let i = 0; i < floorPolygon.length; i++) {
    const j = (i + 1) % floorPolygon.length;
    area += floorPolygon[i].x * floorPolygon[j].z;
    area -= floorPolygon[j].x * floorPolygon[i].z;
  }
  return Math.abs(area) / 2;
}

/**
 * Get human-readable summary of optimization result
 */
export function formatOptimizationSummary(
  result: OptimizationResult, 
  objectType: string, 
  roomArea: number
): string {
  const summary = [
    `${objectType} Placement Analysis:`,
    `- Maximum objects: ${result.maxObjects}`,
    `- Space efficiency: ${(result.efficiency * 100).toFixed(1)}%`,
    `- Room area: ${roomArea.toFixed(1)} m²`,
    `- Objects per m²: ${(result.maxObjects / roomArea).toFixed(2)}`
  ];

  if (result.warnings.length > 0) {
    summary.push(`- Warnings: ${result.warnings.join(', ')}`);
  }

  if (result.alternativeLayouts && result.alternativeLayouts.length > 0) {
    summary.push(`- Alternative layouts available: ${result.alternativeLayouts.length}`);
  }

  return summary.join('\n');
}

/**
 * Validate optimization result for common issues
 */
export function validateOptimizationResult(result: OptimizationResult): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (result.maxObjects === 0) {
    issues.push('No objects could be placed - room may be too small or constraints too strict');
  }

  if (result.efficiency > 0.9) {
    issues.push('Very high space utilization - may be uncomfortable in practice');
  }

  if (result.efficiency < 0.1 && result.maxObjects > 0) {
    issues.push('Very low space utilization - constraints may be too strict');
  }

  if (result.layouts.length !== result.maxObjects) {
    issues.push('Mismatch between maxObjects and layouts count');
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Get default spacing recommendations for common object types
 */
export function getSpacingRecommendations(objectType: string): {
  description: string;
  minClearance: number;
  accessClearance: number;
  reasoning: string;
} {
  const recommendations: { [key: string]: any } = {
    'Desk': {
      description: 'Office desk with chair access',
      minClearance: 0.3,
      accessClearance: 1.2,
      reasoning: 'Needs 120cm in front for chair pull-out and walking space'
    },
    'Chair': {
      description: 'Standard office chair',
      minClearance: 0.2,
      accessClearance: 0.6,
      reasoning: 'Needs 60cm for pulling out and sitting down'
    },
    'Table': {
      description: 'Meeting or dining table',
      minClearance: 0.5,
      accessClearance: 0.8,
      reasoning: 'Needs 80cm around for chair access and movement'
    },
    'Sofa': {
      description: 'Living room sofa',
      minClearance: 0.4,
      accessClearance: 1.0,
      reasoning: 'Needs 100cm in front for coffee table and foot traffic'
    },
    'Bed Single': {
      description: 'Single bed',
      minClearance: 0.6,
      accessClearance: 0.8,
      reasoning: 'Needs 80cm on access sides for getting in/out and making bed'
    },
    'Bookcase': {
      description: 'Standard bookcase',
      minClearance: 0.2,
      accessClearance: 0.9,
      reasoning: 'Needs 90cm in front for accessing books and kneeling'
    }
  };

  const defaultRecommendation = {
    description: 'Generic furniture item',
    minClearance: 0.5,
    accessClearance: 0.8,
    reasoning: 'Standard spacing for unknown object type'
  };

  return recommendations[objectType] || defaultRecommendation;
}

/**
 * Export commonly used configurations
 */
export const OFFICE_CONFIGURATIONS = {
  OPEN_OFFICE: {
    deskSpacing: 1.5,  // Distance between desk centers
    aisleWidth: 1.2,   // Main walkway width
    wallOffset: 0.3    // Distance from walls
  },
  PRIVATE_OFFICE: {
    deskSpacing: 2.0,
    aisleWidth: 1.0,
    wallOffset: 0.2
  },
  COWORKING: {
    deskSpacing: 1.8,
    aisleWidth: 1.5,
    wallOffset: 0.4
  }
};

export const ACCESSIBILITY_STANDARDS = {
  MIN_PATHWAY_WIDTH: 0.9,      // 90cm minimum pathway
  WHEELCHAIR_SPACE: 1.5,       // 150cm turning space
  DOOR_APPROACH: 1.2,          // 120cm door approach space
  DESK_KNEE_CLEARANCE: 0.7     // 70cm under-desk clearance
}; 