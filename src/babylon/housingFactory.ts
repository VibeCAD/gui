import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh, Vector3, Path3D, Matrix, CSG, TransformNode } from 'babylonjs';
import type { MeshCreationOptions } from './objectFactory';

/**
 * Creates a basic house structure with walls, roof, and door opening
 */
export const createBasicHouse = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  const group = new TransformNode(options.name || 'basic-house', scene);
  
  // Define house dimensions
  const width = 6;
  const depth = 4;
  const height = 3;
  const roofHeight = 1.5;
  
  // Create walls using extruded shapes
  const wallThickness = 0.2;
  
  // Front wall with door opening
  const frontWall = createWallWithDoorOpening(scene, width, height, wallThickness, 'front-wall');
  frontWall.position = new Vector3(0, height / 2, depth / 2);
  frontWall.parent = group;
  
  // Back wall
  const backWall = MeshBuilder.CreateBox('back-wall', { width, height, depth: wallThickness }, scene);
  backWall.position = new Vector3(0, height / 2, -depth / 2);
  backWall.parent = group;
  
  // Left wall
  const leftWall = MeshBuilder.CreateBox('left-wall', { width: wallThickness, height, depth }, scene);
  leftWall.position = new Vector3(-width / 2, height / 2, 0);
  leftWall.parent = group;
  
  // Right wall
  const rightWall = MeshBuilder.CreateBox('right-wall', { width: wallThickness, height, depth }, scene);
  rightWall.position = new Vector3(width / 2, height / 2, 0);
  rightWall.parent = group;
  
  // Create pitched roof
  const roof = createPitchedRoof(scene, width + 0.4, depth + 0.4, roofHeight, 'roof');
  roof.position = new Vector3(0, height + roofHeight / 2, 0);
  roof.parent = group;
  
  // Create floor
  const floor = MeshBuilder.CreateBox('floor', { width, height: 0.1, depth }, scene);
  floor.position = new Vector3(0, -0.05, 0);
  floor.parent = group;
  
  // Merge all meshes into a single mesh
  const meshes = [frontWall, backWall, leftWall, rightWall, roof, floor];
  const merged = Mesh.MergeMeshes(meshes, true, true, undefined, false, true);
  
  if (merged) {
    merged.name = options.name || 'basic-house';
    applyHousingMeshOptions(merged, options);
    return merged;
  }
  
  // Fallback: return the group as a mesh
  return group as any;
};

/**
 * Creates a single room structure
 */
export const createRoom = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  const width = 4;
  const depth = 4;
  const height = 3;
  const wallThickness = 0.2;
  
  // Create room walls using extruded path
  const roomShape = [
    new Vector3(-width / 2, 0, -depth / 2),
    new Vector3(width / 2, 0, -depth / 2),
    new Vector3(width / 2, 0, depth / 2),
    new Vector3(-width / 2, 0, depth / 2),
    new Vector3(-width / 2, 0, -depth / 2)
  ];
  
  // Create walls by extruding the room perimeter
  const walls = createExtrudedWalls(scene, roomShape, height, wallThickness, 'room-walls');
  
  // Create floor
  const floor = MeshBuilder.CreateBox('floor', { width, height: 0.1, depth }, scene);
  floor.position = new Vector3(0, -0.05, 0);
  
  // Create ceiling
  const ceiling = MeshBuilder.CreateBox('ceiling', { width, height: 0.1, depth }, scene);
  ceiling.position = new Vector3(0, height + 0.05, 0);
  
  // Merge meshes
  const merged = Mesh.MergeMeshes([walls, floor, ceiling], true, true, undefined, false, true);
  
  if (merged) {
    merged.name = options.name || 'room';
    applyHousingMeshOptions(merged, options);
    return merged;
  }
  
  return walls;
};

/**
 * Creates a hallway structure
 */
export const createHallway = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  const width = 2;
  const depth = 8;
  const height = 3;
  const wallThickness = 0.2;
  
  // Create hallway walls
  const leftWall = MeshBuilder.CreateBox('left-wall', { width: wallThickness, height, depth }, scene);
  leftWall.position = new Vector3(-width / 2, height / 2, 0);
  
  const rightWall = MeshBuilder.CreateBox('right-wall', { width: wallThickness, height, depth }, scene);
  rightWall.position = new Vector3(width / 2, height / 2, 0);
  
  // Create floor
  const floor = MeshBuilder.CreateBox('floor', { width, height: 0.1, depth }, scene);
  floor.position = new Vector3(0, -0.05, 0);
  
  // Create ceiling
  const ceiling = MeshBuilder.CreateBox('ceiling', { width, height: 0.1, depth }, scene);
  ceiling.position = new Vector3(0, height + 0.05, 0);
  
  // Merge meshes
  const merged = Mesh.MergeMeshes([leftWall, rightWall, floor, ceiling], true, true, undefined, false, true);
  
  if (merged) {
    merged.name = options.name || 'hallway';
    applyHousingMeshOptions(merged, options);
    return merged;
  }
  
  return leftWall;
};

/**
 * Creates a flat roof structure
 */
export const createFlatRoof = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  const width = 6;
  const depth = 4;
  const thickness = 0.3;
  
  const roof = MeshBuilder.CreateBox(options.name || 'flat-roof', { width, height: thickness, depth }, scene);
  applyHousingMeshOptions(roof, options);
  return roof;
};

/**
 * Creates a pitched roof structure
 */
export const createPitchedRoof = (scene: Scene, width: number, depth: number, height: number, name: string): Mesh => {
  // Create a triangular prism for the pitched roof
  const roofShape = [
    new Vector3(-width / 2, 0, 0),
    new Vector3(width / 2, 0, 0),
    new Vector3(0, height, 0)
  ];
  
  const roof = MeshBuilder.ExtrudePolygon(name, {
    shape: roofShape,
    depth: depth,
    sideOrientation: 2
  }, scene);
  
  roof.rotation.x = Math.PI / 2;
  return roof;
};

/**
 * Creates a wall with a door opening
 */
const createWallWithDoorOpening = (scene: Scene, width: number, height: number, thickness: number, name: string): Mesh => {
  // Create main wall
  const wall = MeshBuilder.CreateBox(name, { width, height, depth: thickness }, scene);
  
  // Create door opening
  const doorWidth = 1.2;
  const doorHeight = 2.2;
  const doorOpening = MeshBuilder.CreateBox('door-opening', { 
    width: doorWidth, 
    height: doorHeight, 
    depth: thickness + 0.1 
  }, scene);
  doorOpening.position = new Vector3(0, doorHeight / 2 - height / 2 + 0.1, 0);
  
  // Subtract door opening from wall using CSG
  const wallCSG = CSG.FromMesh(wall);
  const doorCSG = CSG.FromMesh(doorOpening);
  const resultCSG = wallCSG.subtract(doorCSG);
  
  // Clean up temporary meshes
  wall.dispose();
  doorOpening.dispose();
  
  // Create the final mesh
  const resultMesh = resultCSG.toMesh(name, wall.material, scene);
  return resultMesh;
};

/**
 * Creates extruded walls from a floor plan path
 */
const createExtrudedWalls = (scene: Scene, shape: Vector3[], height: number, thickness: number, name: string): Mesh => {
  // Create the outer perimeter
  const outerWall = MeshBuilder.ExtrudePolygon(name + '-outer', {
    shape: shape,
    depth: height,
    sideOrientation: 2
  }, scene);
  
  // Create inner perimeter (for wall thickness)
  const innerShape = shape.map(point => {
    const direction = point.clone().normalize();
    return point.subtract(direction.scale(thickness));
  });
  
  const innerWall = MeshBuilder.ExtrudePolygon(name + '-inner', {
    shape: innerShape,
    depth: height,
    sideOrientation: 2
  }, scene);
  
  // Subtract inner from outer to create walls with thickness
  const outerCSG = CSG.FromMesh(outerWall);
  const innerCSG = CSG.FromMesh(innerWall);
  const wallCSG = outerCSG.subtract(innerCSG);
  
  // Clean up temporary meshes
  outerWall.dispose();
  innerWall.dispose();
  
  // Create the final mesh
  const walls = wallCSG.toMesh(name, outerWall.material, scene);
  walls.rotation.x = Math.PI / 2;
  return walls;
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
      return createPitchedRoof(scene, 6, 4, 1.5, options.name || 'pitched-roof');
    default:
      throw new Error(`Unknown housing type: ${type}`);
  }
};

/**
 * Helper function to apply common housing mesh options
 */
const applyHousingMeshOptions = (mesh: Mesh, options: MeshCreationOptions): void => {
  // Set position
  if (options.position) {
    mesh.position = options.position;
  }

  // Set scale
  if (options.scale) {
    mesh.scaling = options.scale;
  }

  // Set rotation
  if (options.rotation) {
    mesh.rotation = options.rotation;
  }

  // Create and apply material with color
  const material = new StandardMaterial(`${mesh.name}-material`, mesh.getScene());
  material.diffuseColor = options.color ? Color3.FromHexString(options.color) : new Color3(0.8, 0.7, 0.6); // Default house color
  mesh.material = material;
}; 