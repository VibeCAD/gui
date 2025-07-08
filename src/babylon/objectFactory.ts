import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh, Vector3 } from 'babylonjs';
import type { PrimitiveType } from '../types/types';
import { createHousingMesh } from './housingFactory';

export interface MeshCreationOptions {
  position?: Vector3;
  scale?: Vector3;
  rotation?: Vector3;
  color?: string;
  name?: string;
}

/**
 * Creates a cube mesh with the specified options
 */
export const createCube = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  const mesh = MeshBuilder.CreateBox(options.name || 'cube', { size: 1 }, scene);
  applyMeshOptions(mesh, options);
  return mesh;
};

/**
 * Creates a sphere mesh with the specified options
 */
export const createSphere = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  const mesh = MeshBuilder.CreateSphere(options.name || 'sphere', { diameter: 1 }, scene);
  applyMeshOptions(mesh, options);
  return mesh;
};

/**
 * Creates a cylinder mesh with the specified options
 */
export const createCylinder = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  const mesh = MeshBuilder.CreateCylinder(options.name || 'cylinder', { height: 1, diameter: 1 }, scene);
  applyMeshOptions(mesh, options);
  return mesh;
};

/**
 * Creates a plane mesh with the specified options
 */
export const createPlane = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  const mesh = MeshBuilder.CreatePlane(options.name || 'plane', { size: 1 }, scene);
  applyMeshOptions(mesh, options);
  return mesh;
};

/**
 * Creates a torus mesh with the specified options
 */
export const createTorus = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  const mesh = MeshBuilder.CreateTorus(options.name || 'torus', { diameter: 1, thickness: 0.3 }, scene);
  applyMeshOptions(mesh, options);
  return mesh;
};

/**
 * Creates a cone mesh with the specified options
 */
export const createCone = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  const mesh = MeshBuilder.CreateCylinder(options.name || 'cone', { 
    height: 1, 
    diameterTop: 0, 
    diameterBottom: 1 
  }, scene);
  applyMeshOptions(mesh, options);
  return mesh;
};

/**
 * Creates a ground plane mesh with the specified options
 */
export const createGround = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  const mesh = MeshBuilder.CreateGround(options.name || 'ground', { width: 20, height: 20 }, scene);
  applyMeshOptions(mesh, options);
  return mesh;
};

/**
 * Factory function that creates a mesh based on the primitive type
 */
export const createPrimitiveMesh = (
  type: PrimitiveType, 
  scene: Scene, 
  options: MeshCreationOptions = {}
): Mesh => {
  // Check if it's a housing type
  if (type.startsWith('house-')) {
    return createHousingMesh(type, scene, options);
  }
  
  switch (type) {
    case 'cube':
      return createCube(scene, options);
    case 'sphere':
      return createSphere(scene, options);
    case 'cylinder':
      return createCylinder(scene, options);
    case 'plane':
      return createPlane(scene, options);
    case 'torus':
      return createTorus(scene, options);
    case 'cone':
      return createCone(scene, options);
    case 'nurbs':
      // NURBS is handled separately, not through this factory
      throw new Error('NURBS meshes are not supported in this factory');
    default:
      throw new Error(`Unknown primitive type: ${type}`);
  }
};

/**
 * Helper function to apply common mesh options
 */
const applyMeshOptions = (mesh: Mesh, options: MeshCreationOptions): void => {
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
  material.diffuseColor = options.color ? Color3.FromHexString(options.color) : Color3.White();
  mesh.material = material;
};

/**
 * Updates an existing mesh with new options
 */
export const updateMesh = (mesh: Mesh, options: Partial<MeshCreationOptions>): void => {
  if (options.position) {
    mesh.position = options.position;
  }

  if (options.scale) {
    mesh.scaling = options.scale;
  }

  if (options.rotation) {
    mesh.rotation = options.rotation;
  }

  if (options.color && mesh.material) {
    const material = mesh.material as StandardMaterial;
    material.diffuseColor = Color3.FromHexString(options.color);
  }
};
