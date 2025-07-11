import { Scene, SceneLoader, AssetContainer, Mesh, StandardMaterial, Color3, Vector3, Matrix } from 'babylonjs';
import type { SceneObject, ImportError, ImportErrorType, PrimitiveType, Boundary } from '../types/types';
import { integrateImportedMesh } from './objectFactory';
import { SceneManager } from './sceneManager';
import { computeMeshBoundary, computeCompositeBoundary } from './boundaryUtils';

/**
 * ModelImporter class handles the import and processing of 3D model files (GLB, STL, OBJ)
 */
export class ModelImporter {
  private scene: Scene;
  private sceneManager: SceneManager;
  private maxFileSize: number = 5 * 1024 * 1024; // 5 MB in bytes
  private referenceSize: number = 2.0; // Reference cube size for scaling

  constructor(scene: Scene, sceneManager: SceneManager) {
    this.scene = scene;
    this.sceneManager = sceneManager;
  }

  /**
   * Calculates the bounding box for an imported mesh
   * Handles both single meshes and meshes with children
   * @param mesh The mesh to calculate bounds for
   * @returns The calculated boundary information
   */
  private calculateMeshBounds(mesh: Mesh): Boundary {
    // Force computation of world matrix to ensure accurate bounds
    mesh.computeWorldMatrix(true);
    
    // Check if mesh has children that should be included in bounds
    const hasChildren = mesh.getChildMeshes(false).length > 0;
    
    if (hasChildren) {
      console.log('📦 Calculating composite boundary for mesh with children');
      return computeCompositeBoundary(mesh);
    } else {
      console.log('📦 Calculating simple boundary for single mesh');
      return computeMeshBoundary(mesh);
    }
  }

  /**
   * Calculates the appropriate scale factor to fit the mesh within reference cube
   * @param boundary The boundary information of the mesh
   * @param targetSize The target size to fit within (default: 2.0)
   * @returns The uniform scale factor to apply
   */
  private calculateScaleFactor(boundary: Boundary, targetSize: number = 2.0): number {
    const { size } = boundary.aabb;
    
    // Find the maximum dimension
    const maxDimension = Math.max(size.x, size.y, size.z);
    
    console.log(`📏 Mesh dimensions: ${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)}`);
    console.log(`📏 Max dimension: ${maxDimension.toFixed(3)}`);
    
    // Avoid division by zero for extremely small objects
    if (maxDimension < 0.001) {
      console.warn('⚠️ Object has extremely small dimensions, using default scale');
      return 1.0;
    }
    
    // Calculate scale factor to fit within target size
    const scaleFactor = targetSize / maxDimension;
    
    // Apply limits to prevent extreme scaling
    const MIN_SCALE = 0.01;  // Prevent invisible objects
    const MAX_SCALE = 100.0; // Prevent numerical issues
    
    const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scaleFactor));
    
    if (clampedScale !== scaleFactor) {
      console.warn(`⚠️ Scale factor clamped from ${scaleFactor.toFixed(3)} to ${clampedScale.toFixed(3)}`);
    }
    
    console.log(`🔧 Scale factor: ${clampedScale.toFixed(3)}`);
    
    return clampedScale;
  }

  /**
   * Applies auto-scaling to fit the mesh within the reference cube size
   * @param mesh The mesh to scale
   * @param autoScale Whether to apply auto-scaling (default: true)
   * @returns The scale factor applied (1.0 if no scaling)
   */
  private applyAutoScaling(mesh: Mesh, autoScale: boolean = true): number {
    if (!autoScale) {
      console.log('🚫 Auto-scaling disabled');
      return 1.0;
    }
    
    console.log('🎯 Applying auto-scaling to imported mesh');
    
    // Calculate the mesh bounds
    const boundary = this.calculateMeshBounds(mesh);
    
    // Calculate the scale factor
    const scaleFactor = this.calculateScaleFactor(boundary, this.referenceSize);
    
    // Apply the scale uniformly to maintain aspect ratio
    mesh.scaling = new Vector3(scaleFactor, scaleFactor, scaleFactor);
    
    // Log the result
    const newBounds = this.calculateMeshBounds(mesh);
    console.log(`✅ Scaled mesh to fit within ${this.referenceSize} x ${this.referenceSize} x ${this.referenceSize} units`);
    console.log(`📦 New dimensions: ${newBounds.aabb.size.x.toFixed(3)} x ${newBounds.aabb.size.y.toFixed(3)} x ${newBounds.aabb.size.z.toFixed(3)}`);
    
    return scaleFactor;
  }

  /**
   * Centers the mesh at the origin based on its bounding box
   * @param mesh The mesh to center
   */
  private centerMesh(mesh: Mesh): void {
    console.log('🎯 Centering mesh at origin');
    
    // Calculate current bounds
    const boundary = this.calculateMeshBounds(mesh);
    const center = boundary.aabb.center;
    
    // Adjust position to center the mesh
    mesh.position = mesh.position.subtract(center);
    
    console.log(`✅ Mesh centered - offset by (${-center.x.toFixed(3)}, ${-center.y.toFixed(3)}, ${-center.z.toFixed(3)})`);
  }

  /**
   * Adjusts the mesh pivot to its bottom center, ensuring it sits properly on the floor
   * @param mesh The mesh to adjust
   */
  private adjustPivotToBottom(mesh: Mesh): void {
    console.log('🎯 Adjusting pivot to bottom center');
    
    // Force update of world matrix
    mesh.computeWorldMatrix(true);
    
    // Get the bounding info in world space
    const boundingInfo = mesh.getBoundingInfo();
    const worldMin = boundingInfo.boundingBox.minimumWorld;
    const worldMax = boundingInfo.boundingBox.maximumWorld;
    
    // Calculate the center bottom point in world space
    const bottomCenterWorld = new Vector3(
      (worldMin.x + worldMax.x) / 2,
      worldMin.y,
      (worldMin.z + worldMax.z) / 2
    );
    
    // Convert to local space
    const worldToLocal = new Matrix();
    mesh.getWorldMatrix().invertToRef(worldToLocal);
    const bottomCenterLocal = Vector3.TransformCoordinates(bottomCenterWorld, worldToLocal);
    
    // Create a pivot at the bottom center
    mesh.setPivotPoint(bottomCenterLocal);
    
    // Adjust position so the bottom sits at y=0
    mesh.position.y = 0;
    
    console.log(`✅ Pivot adjusted to bottom center at local (${bottomCenterLocal.x.toFixed(3)}, ${bottomCenterLocal.y.toFixed(3)}, ${bottomCenterLocal.z.toFixed(3)})`);
  }

  /**
   * Imports a 3D model file and converts it to a SceneObject
   * @param file The 3D model file to import (GLB, STL, or OBJ)
   * @param autoScale Whether to automatically scale the model to fit reference cube (default: true)
   * @returns The imported mesh as a SceneObject
   */
  async importModel(file: File, autoScale: boolean = true): Promise<SceneObject> {
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
      console.log(`📁 Importing ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      
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

      console.log(`🔨 Found ${meshes.length} mesh(es) to process`);

      // Merge all meshes into a single mesh
      const mergedMesh = this.mergeMeshes(meshes);
      
      // Strip materials and apply default gray material
      this.applyDefaultMaterial(mergedMesh);

      // Log pre-scaling dimensions
      if (autoScale) {
        const preBounds = this.calculateMeshBounds(mergedMesh);
        console.log(`📏 Pre-scaling dimensions: ${preBounds.aabb.size.x.toFixed(3)} x ${preBounds.aabb.size.y.toFixed(3)} x ${preBounds.aabb.size.z.toFixed(3)}`);
      }

      // Apply auto-scaling to fit within reference cube
      const scaleFactor = this.applyAutoScaling(mergedMesh, autoScale);
      
      // Adjust pivot to bottom center so object sits properly on floor
      this.adjustPivotToBottom(mergedMesh);
      
      // Optionally center the mesh at origin (after scaling)
      // This is commented out for now to maintain backward compatibility
      // Uncomment if you want imported objects centered at origin
      // this.centerMesh(mergedMesh);

      // Generate a unique ID for the object
      const modelType = fileExtension.substring(1); // Remove the dot
      const objectId = `imported-${modelType}-${Date.now()}`;
      
      console.log(`📦 Registering imported mesh as: ${objectId}`);
      console.log(`📐 Final scale factor: ${scaleFactor.toFixed(3)}`);
      
      // Register the mesh with the scene manager
      this.sceneManager.addPreExistingMesh(mergedMesh, objectId);
      
      // Apply standard integration options
      // Note: We don't pass scale when auto-scaling is enabled because we've already applied it to the mesh
      const integrationOptions: any = {
        name: objectId,
        position: new Vector3(0, 0, 0),
        rotation: new Vector3(0, 0, 0),
        color: '#808080'
      };
      
      // Only set scale if auto-scaling is disabled
      if (!autoScale) {
        integrationOptions.scale = new Vector3(1, 1, 1);
      }
      
      integrateImportedMesh(mergedMesh, integrationOptions);

      // Create and return the SceneObject
      // The scale reflects the actual mesh scaling that was applied
      const sceneObject: SceneObject = {
        id: objectId,
        type: `imported-${modelType}` as PrimitiveType,
        position: mergedMesh.position.clone(),
        rotation: mergedMesh.rotation.clone(), 
        scale: mergedMesh.scaling.clone(),
        color: '#808080',
        isNurbs: false
      };

      console.log(`✅ Import complete: ${objectId}`);

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