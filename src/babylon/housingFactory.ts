import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh, Vector3, CSG } from 'babylonjs';
import type { MeshCreationOptions } from './objectFactory';

/**
 * Creates a basic house structure with walls, roof, and door opening
 */
export const createBasicHouse = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  // Define house dimensions - normalized to unit scale
  const width = 2;
  const depth = 1.5;
  const height = 1.5;
  const roofHeight = 0.5;
  const wallThickness = 0.1;
  
  // Create the main house body
  const houseBody = MeshBuilder.CreateBox('house-body', { width, height, depth }, scene);
  houseBody.position = new Vector3(0, height / 2, 0);
  
  // Create door opening
  const doorWidth = 0.4;
  const doorHeight = 0.8;
  const doorOpening = MeshBuilder.CreateBox('door-opening', { 
    width: doorWidth, 
    height: doorHeight, 
    depth: wallThickness * 2 
  }, scene);
  doorOpening.position = new Vector3(0, doorHeight / 2, depth / 2);
  
  // Create house with door opening using CSG
  let houseWithDoor: Mesh;
  try {
    const houseCSG = CSG.FromMesh(houseBody);
    const doorCSG = CSG.FromMesh(doorOpening);
    const resultCSG = houseCSG.subtract(doorCSG);
    houseWithDoor = resultCSG.toMesh('house-with-door', houseBody.material, scene);
  } catch (error) {
    console.warn('CSG operation failed, using simple house body:', error);
    houseWithDoor = houseBody;
  }
  
  // Clean up temporary meshes
  houseBody.dispose();
  doorOpening.dispose();
  
  // Create roof
  const roof = MeshBuilder.CreateCylinder('roof', { 
    diameterTop: 0, 
    diameterBottom: Math.sqrt(width * width + depth * depth) + 0.2, 
    height: roofHeight,
    tessellation: 4
  }, scene);
  roof.position = new Vector3(0, height + roofHeight / 2, 0);
  roof.rotation.y = Math.PI / 4;
  
  // Merge house and roof
  const finalMesh = Mesh.MergeMeshes([houseWithDoor, roof], true, true);
  
     if (finalMesh) {
     finalMesh.name = options.name || 'basic-house';
     // Position at origin for proper gizmo handling
     finalMesh.position = Vector3.Zero();
     
     // Apply default house material if no material exists
     if (!finalMesh.material) {
       const material = new StandardMaterial(`${finalMesh.name}-material`, scene);
       material.diffuseColor = options.color ? Color3.FromHexString(options.color) : new Color3(0.8, 0.7, 0.6);
       finalMesh.material = material;
     }
     
     return finalMesh;
   }
  
  return houseWithDoor;
};

/**
 * Creates a single room structure
 */
export const createRoom = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  // Normalized room dimensions
  const width = 2;
  const depth = 2;
  const height = 1.5;
  const wallThickness = 0.1;
  
  // Create outer walls
  const outerWalls = MeshBuilder.CreateBox('outer-walls', { width, height, depth }, scene);
  outerWalls.position = new Vector3(0, height / 2, 0);
  
  // Create inner space to subtract
  const innerSpace = MeshBuilder.CreateBox('inner-space', { 
    width: width - wallThickness * 2, 
    height: height + 0.2, 
    depth: depth - wallThickness * 2 
  }, scene);
  innerSpace.position = new Vector3(0, height / 2, 0);
  
  // Create room walls using CSG
  let roomMesh: Mesh;
  try {
    const outerCSG = CSG.FromMesh(outerWalls);
    const innerCSG = CSG.FromMesh(innerSpace);
    const wallsCSG = outerCSG.subtract(innerCSG);
    roomMesh = wallsCSG.toMesh('room-walls', outerWalls.material, scene);
  } catch (error) {
    console.warn('CSG operation failed for room, using simple box:', error);
    roomMesh = outerWalls;
  }
  
  // Clean up temporary meshes
  outerWalls.dispose();
  innerSpace.dispose();
  
  // Create floor
  const floor = MeshBuilder.CreateBox('floor', { width, height: 0.05, depth }, scene);
  floor.position = new Vector3(0, 0.025, 0);
  
  // Merge walls and floor
  const finalMesh = Mesh.MergeMeshes([roomMesh, floor], true, true);
  
     if (finalMesh) {
     finalMesh.name = options.name || 'room';
     finalMesh.position = Vector3.Zero();
     
     // Apply default room material if no material exists
     if (!finalMesh.material) {
       const material = new StandardMaterial(`${finalMesh.name}-material`, scene);
       material.diffuseColor = options.color ? Color3.FromHexString(options.color) : new Color3(0.9, 0.8, 0.7);
       finalMesh.material = material;
     }
     
     return finalMesh;
   }
  
  return roomMesh;
};

/**
 * Creates a hallway structure
 */
export const createHallway = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  // Normalized hallway dimensions
  const width = 1;
  const depth = 3;
  const height = 1.5;
  const wallThickness = 0.1;
  
  // Create hallway walls
  const leftWall = MeshBuilder.CreateBox('left-wall', { width: wallThickness, height, depth }, scene);
  leftWall.position = new Vector3(-width / 2, height / 2, 0);
  
  const rightWall = MeshBuilder.CreateBox('right-wall', { width: wallThickness, height, depth }, scene);
  rightWall.position = new Vector3(width / 2, height / 2, 0);
  
  // Create floor
  const floor = MeshBuilder.CreateBox('floor', { width, height: 0.05, depth }, scene);
  floor.position = new Vector3(0, 0.025, 0);
  
  // Create ceiling
  const ceiling = MeshBuilder.CreateBox('ceiling', { width, height: 0.05, depth }, scene);
  ceiling.position = new Vector3(0, height + 0.025, 0);
  
  // Merge meshes
  const merged = Mesh.MergeMeshes([leftWall, rightWall, floor, ceiling], true, true);
  
     if (merged) {
     merged.name = options.name || 'hallway';
     merged.position = Vector3.Zero();
     
     // Apply default hallway material if no material exists
     if (!merged.material) {
       const material = new StandardMaterial(`${merged.name}-material`, scene);
       material.diffuseColor = options.color ? Color3.FromHexString(options.color) : new Color3(0.8, 0.8, 0.8);
       merged.material = material;
     }
     
     return merged;
   }
  
  return leftWall;
};

/**
 * Creates a flat roof structure
 */
export const createFlatRoof = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  // Normalized roof dimensions
  const width = 2;
  const depth = 1.5;
  const thickness = 0.1;
  
     const roof = MeshBuilder.CreateBox(options.name || 'flat-roof', { width, height: thickness, depth }, scene);
   roof.position = new Vector3(0, thickness / 2, 0);
   
   // Apply default roof material
   const material = new StandardMaterial(`${roof.name}-material`, scene);
   material.diffuseColor = options.color ? Color3.FromHexString(options.color) : new Color3(0.6, 0.4, 0.2);
   roof.material = material;
   
   return roof;
};

/**
 * Creates a pitched roof structure
 */
export const createPitchedRoof = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  // Normalized roof dimensions
  const width = 2;
  const depth = 1.5;
  const height = 0.8;
  
  // Create a triangular prism using a cylinder with 3 tessellation
  const roof = MeshBuilder.CreateCylinder(options.name || 'pitched-roof', {
    diameterTop: 0,
    diameterBottom: Math.sqrt(width * width + depth * depth),
    height: height,
    tessellation: 4
  }, scene);
  
     roof.position = new Vector3(0, height / 2, 0);
   roof.rotation.y = Math.PI / 4;
   
   // Apply default roof material
   const material = new StandardMaterial(`${roof.name}-material`, scene);
   material.diffuseColor = options.color ? Color3.FromHexString(options.color) : new Color3(0.6, 0.4, 0.2);
   roof.material = material;
   
   return roof;
};



/**
 * Factory function that creates housing meshes based on the type
 */
export const createHousingMesh = (
  type: string, 
  scene: Scene, 
  options: MeshCreationOptions = {}
): Mesh => {
  switch (type) {
    case 'house-basic':
      return createBasicHouse(scene, options);
    case 'house-room':
      return createRoom(scene, options);
    case 'house-hallway':
      return createHallway(scene, options);
    case 'house-roof-flat':
      return createFlatRoof(scene, options);
    case 'house-roof-pitched':
      return createPitchedRoof(scene, options);
    default:
      throw new Error(`Unknown housing type: ${type}`);
  }
};

 