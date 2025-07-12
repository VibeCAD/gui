import { Vector3, Mesh } from 'babylonjs';
import { spaceAnalysisService } from '../services/spaceAnalysisService';
import { furnitureDatabase } from '../data/furnitureDatabase';
import { AIService } from '../ai/ai.service';
import type { SceneObject } from '../types/types';

/**
 * Demo: Space Optimization Feature Usage
 * 
 * This demo shows how to use the new space optimization features:
 * 1. Furniture database with real dimensions
 * 2. Space analysis service
 * 3. AI integration for space optimization queries
 */

// Example scene objects (would normally come from your scene)
const exampleSceneObjects: SceneObject[] = [
  {
    id: 'office-room',
    type: 'custom-room',
    position: new Vector3(0, 0, 0),
    rotation: new Vector3(0, 0, 0),
    scale: new Vector3(1, 1, 1),
    color: '#ffffff',
    isNurbs: false,
    // Room metadata with floor polygon
    metadata: {
      floorPolygon: [
        { x: 0, z: 0 },
        { x: 6, z: 0 },
        { x: 6, z: 4 },
        { x: 0, z: 4 }
      ]
    }
  } as any,
  {
    id: 'existing-desk',
    type: 'Desk',
    position: new Vector3(1, 0, 1),
    rotation: new Vector3(0, 0, 0),
    scale: new Vector3(1, 1, 1),
    color: '#8B4513',
    isNurbs: false,
    // Mock mesh for dimension extraction
    mesh: {
      getBoundingInfo: () => ({
        boundingBox: {
          minimumWorld: new Vector3(0.4, 0, 0.7),
          maximumWorld: new Vector3(1.6, 0.75, 1.3)
        }
      }),
      computeWorldMatrix: () => true
    } as any
  },
  {
    id: 'existing-chair',
    type: 'Chair',
    position: new Vector3(1, 0, 0.2),
    rotation: new Vector3(0, 0, 0),
    scale: new Vector3(1, 1, 1),
    color: '#654321',
    isNurbs: false,
    mesh: {
      getBoundingInfo: () => ({
        boundingBox: {
          minimumWorld: new Vector3(0.7, 0, -0.1),
          maximumWorld: new Vector3(1.3, 1.0, 0.5)
        }
      }),
      computeWorldMatrix: () => true
    } as any
  }
];

/**
 * Mock mesh resolver function (would normally come from your scene manager)
 */
function mockGetMeshById(id: string): Mesh | null {
  const obj = exampleSceneObjects.find(o => o.id === id);
  if (!obj) return null;
  
  // Create mock mesh with floor polygon metadata
  const mockMesh = {
    id,
    metadata: (obj as any).metadata,
    getBoundingInfo: () => ({
      boundingBox: {
        minimumWorld: new Vector3(0, 0, 0),
        maximumWorld: new Vector3(6, 2.5, 4)
      }
    }),
    computeWorldMatrix: () => true
  } as any;
  
  return mockMesh;
}

/**
 * Demo 1: Basic Space Analysis
 */
export async function demoBasicSpaceAnalysis() {
  console.log('🚀 Demo 1: Basic Space Analysis');
  
  const request = {
    roomId: 'office-room',
    targetObjectType: 'Desk',
    strategy: { name: 'maximize' as const, priority: 'maximize' as const, description: 'Maximize desk capacity' }
  };

  try {
    const result = await spaceAnalysisService.analyzeSpace(
      request, 
      exampleSceneObjects, 
      mockGetMeshById
    );

    console.log(`📊 Analysis Results:`);
    console.log(`   Max desks: ${result.optimization.maxObjects}`);
    console.log(`   Efficiency: ${(result.optimization.efficiency * 100).toFixed(1)}%`);
    console.log(`   Room area: ${result.roomAnalysis.area.toFixed(1)}m²`);
    console.log(`   Recommendations: ${result.recommendations.length}`);
    
    result.recommendations.forEach(rec => {
      console.log(`   - ${rec}`);
    });

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

/**
 * Demo 2: Selected Objects Analysis
 */
export async function demoSelectedObjectsAnalysis() {
  console.log('\n🚀 Demo 2: Selected Objects Analysis');
  
  const selectedObjects = [exampleSceneObjects[1]]; // The desk
  
  try {
    const result = await spaceAnalysisService.analyzeSelectedObjects(
      selectedObjects,
      'office-room',
      exampleSceneObjects,
      mockGetMeshById
    );

    console.log(`📋 Selected Object Analysis:`);
    console.log(`   Object: ${result.furnitureSpec.name}`);
    console.log(`   Dimensions: ${result.furnitureSpec.dimensions.width.toFixed(1)}×${result.furnitureSpec.dimensions.height.toFixed(1)}×${result.furnitureSpec.dimensions.depth.toFixed(1)}m`);
    console.log(`   Category: ${result.furnitureSpec.category}`);
    console.log(`   Max objects like this: ${result.optimization.maxObjects}`);
    
  } catch (error) {
    console.error('❌ Selected objects analysis failed:', error);
  }
}

/**
 * Demo 3: Furniture Database Usage
 */
export function demoFurnitureDatabase() {
  console.log('\n🚀 Demo 3: Furniture Database Usage');
  
  // Get furniture specifications
  const deskSpec = furnitureDatabase.getFurniture('Desk');
  const chairSpec = furnitureDatabase.getFurniture('Chair');
  
  console.log('📚 Furniture Database:');
  if (deskSpec) {
    console.log(`   Desk: ${deskSpec.dimensions.width}×${deskSpec.dimensions.height}×${deskSpec.dimensions.depth}m`);
    console.log(`   Clearance: ${deskSpec.clearanceRequirements.access}m`);
    console.log(`   Category: ${deskSpec.category}`);
  }
  
  if (chairSpec) {
    console.log(`   Chair: ${chairSpec.dimensions.width}×${chairSpec.dimensions.height}×${chairSpec.dimensions.depth}m`);
    console.log(`   Clearance: ${chairSpec.clearanceRequirements.access}m`);
    console.log(`   Category: ${chairSpec.category}`);
  }
  
  // Extract dimensions from scene objects
  const existingDesk = exampleSceneObjects[1];
  const extractedDimensions = furnitureDatabase.extractDimensionsFromMesh(existingDesk);
  
  console.log('📏 Extracted Dimensions:');
  console.log(`   ${existingDesk.id}: ${extractedDimensions.width.toFixed(2)}×${extractedDimensions.height.toFixed(2)}×${extractedDimensions.depth.toFixed(2)}m`);
}

/**
 * Demo 4: AI Integration
 */
export async function demoAIIntegration() {
  console.log('\n🚀 Demo 4: AI Integration');
  
  // Create AI service (would normally use real API key)
  const aiService = new AIService('mock-api-key', ['Desk', 'Chair', 'Table', 'Sofa']);
  
  // Set mesh resolver
  aiService.setMeshResolver(mockGetMeshById);
  
  // Example space optimization queries
  const queries = [
    "How many desks can fit in this room?",
    "How many chairs can I fit?",
    "What's the best way to arrange desks for an office?",
    "Optimize the space for comfort"
  ];
  
  for (const query of queries) {
    console.log(`\n❓ Query: "${query}"`);
    
    try {
      const result = await aiService.getSceneCommands(
        query,
        exampleSceneObjects,
        null,
        ['existing-desk'] // Selected objects
      );
      
      if (result.success && result.commands && result.commands.length > 0) {
        const command = result.commands[0];
        console.log(`   Action: ${command.action}`);
        console.log(`   Target: ${command.targetObjectType || 'selected objects'}`);
        console.log(`   Strategy: ${command.optimizationStrategy || 'default'}`);
        
        if (command.analysisResult) {
          console.log(`   Result: ${command.analysisResult.optimization.maxObjects} objects`);
        }
      } else {
        console.log(`   ⚠️ No space optimization detected`);
      }
    } catch (error) {
      console.warn(`   ❌ Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Demo 5: Multi-Object Type Comparison
 */
export async function demoMultiObjectComparison() {
  console.log('\n🚀 Demo 5: Multi-Object Type Comparison');
  
  const objectTypes = ['Desk', 'Chair', 'Table', 'Sofa'];
  
  try {
    const report = await spaceAnalysisService.getCapacityReport(
      'office-room',
      objectTypes,
      mockGetMeshById
    );
    
    console.log('📊 Capacity Report:');
    report.forEach(item => {
      console.log(`   ${item.objectType}: ${item.maxObjects} objects (${(item.efficiency * 100).toFixed(1)}% efficiency)`);
      if (item.warnings.length > 0) {
        item.warnings.forEach(warning => {
          console.log(`     ⚠️ ${warning}`);
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Capacity report failed:', error);
  }
}

/**
 * Run all demos
 */
export async function runAllDemos() {
  console.log('🎯 Space Optimization Feature Demo\n');
  
  await demoBasicSpaceAnalysis();
  await demoSelectedObjectsAnalysis();
  demoFurnitureDatabase();
  await demoAIIntegration();
  await demoMultiObjectComparison();
  
  console.log('\n✅ All demos completed!');
}

// Usage example:
// import { runAllDemos } from './spaceOptimizationDemo';
// runAllDemos(); 