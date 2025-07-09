import { Scene, SceneLoader, AssetContainer, Mesh, StandardMaterial, Color3, Vector3 } from 'babylonjs';
import type { SceneObject, ImportError, ImportErrorType, PrimitiveType } from '../types/types';
import { integrateImportedMesh } from './objectFactory';
import { SceneManager } from './sceneManager';

/**
 * ModelImporter class handles the import and processing of 3D model files (GLB, STL, OBJ)
 */
export class ModelImporter {
  private scene: Scene;
  private sceneManager: SceneManager;
  private maxFileSize: number = 5 * 1024 * 1024; // 5 MB in bytes

  constructor(scene: Scene, sceneManager: SceneManager) {
    this.scene = scene;
    this.sceneManager = sceneManager;
  }

  /**
   * Imports a 3D model file and converts it to a SceneObject
   * @param file The 3D model file to import (GLB, STL, or OBJ)
   * @returns The imported mesh as a SceneObject
   */
  async importModel(file: File): Promise<SceneObject> {
    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      throw new Error('FILE_TOO_LARGE');
    }

    // Get file extension
    const fileExtension = this.getFileExtension(file.name);
    if (!fileExtension) {
      throw new Error('INVALID_FORMAT');
    }

    try {
      // Read file as base64 data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Load the 3D model file using LoadAssetContainer
      const container: AssetContainer = await SceneLoader.LoadAssetContainerAsync(
        "",
        dataUrl,
        this.scene,
        undefined,
        fileExtension
      );

      // Add all assets to the scene
      container.addAllToScene();

      // Filter to get only actual meshes (not transform nodes)
      const meshes = container.meshes.filter(
        m => m instanceof Mesh && m.geometry
      ) as Mesh[];
      
      if (meshes.length === 0) {
        throw new Error('INVALID_FORMAT');
      }

      // Merge all meshes into a single mesh
      const mergedMesh = this.mergeMeshes(meshes);
      
      // Strip materials and apply default gray material
      this.applyDefaultMaterial(mergedMesh);

      // Generate a unique ID for the object
      const modelType = fileExtension.substring(1); // Remove the dot
      const objectId = `imported-${modelType}-${Date.now()}`;
      
      // Register the mesh with the scene manager
      this.sceneManager.addPreExistingMesh(mergedMesh, objectId);
      
      // Apply standard integration options
      integrateImportedMesh(mergedMesh, {
        name: objectId,
        position: new Vector3(0, 0, 0),
        scale: new Vector3(1, 1, 1),
        rotation: new Vector3(0, 0, 0),
        color: '#808080'
      });

      // Create and return the SceneObject
      const sceneObject: SceneObject = {
        id: objectId,
        type: `imported-${modelType}` as PrimitiveType,
        position: mergedMesh.position.clone(),
        rotation: mergedMesh.rotation.clone(), 
        scale: mergedMesh.scaling.clone(),
        color: '#808080',
        isNurbs: false
      };

      return sceneObject;
    } catch (error) {
      console.error('Error importing 3D model:', error);
      
      // Check for specific error messages
      if (error instanceof Error) {
        if (error.message.includes('Unable to load') || 
            error.message.includes('importScene has failed') ||
            error.message.includes('JSON parse')) {
          // This might be a format issue
          throw new Error('INVALID_FORMAT');
        }
      }
      
      throw new Error('LOADING_FAILED');
    }
  }

  /**
   * Gets the file extension with validation
   * @param filename The filename to extract extension from
   * @returns The file extension (e.g., '.glb', '.stl', '.obj') or null if invalid
   */
  private getFileExtension(filename: string): string | null {
    const extension = filename.toLowerCase().match(/\.(glb|stl|obj)$/);
    return extension ? extension[0] : null;
  }

  /**
   * Validates that the file size is within the allowed limit
   * @param file The file to validate
   * @returns true if valid, false if too large
   */
  private validateFileSize(file: File): boolean {
    return file.size <= this.maxFileSize;
  }

  /**
   * Loads a GLB file using Babylon.js SceneLoader
   * @param file The GLB file to load
   * @returns Promise that resolves to an array of loaded meshes
   */
  private async loadGLBFile(file: File): Promise<Mesh[]> {
    try {
      // Create a blob URL from the file
      const url = URL.createObjectURL(file);
      
      try {
        // Load the GLB file as an asset container
        const assetContainer = await SceneLoader.LoadAssetContainerAsync(
          url,
          '',
          this.scene,
          null,
          '.glb'
        );
        
        // Extract meshes from the container
        const meshes: Mesh[] = assetContainer.meshes.filter(
          (mesh): mesh is Mesh => mesh instanceof Mesh && mesh.geometry !== undefined
        );
        
        // Add all assets to the scene
        assetContainer.addAllToScene();
        
        // Clean up the blob URL
        URL.revokeObjectURL(url);
        
        // Return only the actual meshes (not transform nodes or other types)
        return meshes;
      } catch (loadError) {
        // Clean up the blob URL in case of error
        URL.revokeObjectURL(url);
        throw loadError;
      }
    } catch (error) {
      console.error('Error loading GLB file:', error);
      throw this.createImportError('INVALID_FORMAT', 'IMPORT FAILED');
    }
  }

  /**
   * Merges multiple meshes into a single mesh
   * @param meshes Array of meshes to merge
   * @returns A single merged mesh
   */
  private mergeMeshes(meshes: Mesh[]): Mesh {
    if (meshes.length === 0) {
      // No meshes to merge, create an empty mesh
      return new Mesh('imported-model-empty', this.scene);
    }
    
    if (meshes.length === 1) {
      // Only one mesh, just rename and return it
      meshes[0].name = 'imported-model';
      return meshes[0];
    }
    
    // Multiple meshes need to be merged
    // First, make sure all meshes are enabled and have geometry
    const validMeshes = meshes.filter(mesh => mesh.isEnabled() && mesh.geometry);
    
    if (validMeshes.length === 0) {
      // No valid meshes to merge
      return new Mesh('imported-model-empty', this.scene);
    }
    
    // Create a new merged mesh using Babylon's merge function
    const mergedMesh = Mesh.MergeMeshes(
      validMeshes,
      true,  // dispose source meshes
      true,  // allow different materials (we'll replace them anyway)
      undefined,  // no parent
      false,  // don't optimize vertex data
      true   // use precise bounding info
    );
    
    if (!mergedMesh) {
      // Merge failed, return an empty mesh
      console.warn('Mesh merging failed, creating empty mesh');
      return new Mesh('imported-model-empty', this.scene);
    }
    
    // Set the name of the merged mesh
    mergedMesh.name = 'imported-model';
    
    // Reset position, rotation, and scaling to ensure clean import
    mergedMesh.position = Vector3.Zero();
    mergedMesh.rotation = Vector3.Zero();
    mergedMesh.scaling = Vector3.One();
    
    return mergedMesh;
  }

  /**
   * Applies a default material to the mesh, removing any existing materials
   * @param mesh The mesh to apply the material to
   */
  private applyDefaultMaterial(mesh: Mesh): void {
    // Dispose of any existing material to free up memory
    if (mesh.material) {
      mesh.material.dispose();
    }
    
    // Create a new standard material
    const defaultMaterial = new StandardMaterial('imported-model-material', this.scene);
    
    // Set the default color to gray (#808080)
    defaultMaterial.diffuseColor = Color3.FromHexString('#808080');
    
    // Set some reasonable defaults for the material
    defaultMaterial.specularColor = new Color3(0.2, 0.2, 0.2);
    defaultMaterial.ambientColor = new Color3(0.1, 0.1, 0.1);
    defaultMaterial.backFaceCulling = true;
    
    // Apply the material to the mesh
    mesh.material = defaultMaterial;
    
    // Ensure the mesh is set up for proper rendering
    mesh.receiveShadows = true;
    
    // Make sure the mesh is pickable for selection
    mesh.isPickable = true;
    
    // Enable collision detection
    mesh.checkCollisions = true;
  }

  /**
   * Converts a Babylon.js mesh to a SceneObject format
   * @param mesh The mesh to convert
   * @returns A SceneObject representation of the mesh
   */
  private convertToSceneObject(mesh: Mesh): SceneObject {
    // Generate a unique ID for the imported object
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const id = `imported-glb-${timestamp}-${randomId}`;
    
    // Get the mesh position, rotation, and scaling
    // These should already be at origin from the merge process, but we'll use the actual values
    const position = mesh.position.clone();
    const rotation = mesh.rotation.clone();
    const scale = mesh.scaling.clone();
    
    // Get the color from the material we applied
    let color = '#808080'; // Default gray
    if (mesh.material && mesh.material instanceof StandardMaterial) {
      const diffuseColor = mesh.material.diffuseColor;
      color = diffuseColor.toHexString();
    }
    
    // Set the mesh name to match the ID for consistency
    mesh.name = id;
    
    // Create and return the SceneObject
    const sceneObject: SceneObject = {
      id,
      type: 'imported-glb' as PrimitiveType, // Default type for unused method
      position,
      scale,
      rotation,
      color,
      mesh,
      isNurbs: false
    };
    
    return sceneObject;
  }

  /**
   * Creates an ImportError object with proper type and message
   * @param type The type of import error
   * @param message The error message
   * @returns ImportError object
   */
  private createImportError(type: ImportErrorType, message: string): ImportError {
    return {
      type,
      message
    };
  }

  /**
   * Type guard to check if an error is an ImportError
   * @param error The error to check
   * @returns true if the error is an ImportError
   */
  private isImportError(error: any): error is ImportError {
    return error && typeof error === 'object' && 'type' in error && 'message' in error;
  }
}

/**
 * Factory function to create a new ModelImporter instance
 * @param scene The Babylon.js scene
 * @param sceneManager The scene manager instance
 * @returns A new ModelImporter instance
 */
export function createModelImporter(scene: Scene, sceneManager: SceneManager): ModelImporter {
  return new ModelImporter(scene, sceneManager);
}

// Export with old name for backwards compatibility
export const GLBImporter = ModelImporter;
export const createGLBImporter = createModelImporter; 