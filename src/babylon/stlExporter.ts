import { Scene, Mesh, Vector3 } from 'babylonjs';
import 'babylonjs-serializers';
import type { SceneObject } from '../types/types';

/**
 * STLExporter class handles exporting scene objects to STL format
 */
export class STLExporter {
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Exports all scene objects (except ground) as a single STL file
   * @param sceneObjects Array of scene objects to export
   * @param filename Optional filename (defaults to "scene-export.stl")
   */
  async exportSceneToSTL(sceneObjects: SceneObject[], filename: string = 'scene-export.stl'): Promise<void> {
    try {
      // Filter out ground objects
      const exportableObjects = sceneObjects.filter(obj => 
        obj.type !== 'ground'
      );

      if (exportableObjects.length === 0) {
        throw new Error('No objects to export');
      }

      // Collect all meshes
      const meshesToExport: Mesh[] = [];
      
      for (const obj of exportableObjects) {
        // Get the mesh from the scene by ID
        const mesh = this.scene.getMeshById(obj.id);
        if (mesh && mesh instanceof Mesh && mesh.geometry) {
          meshesToExport.push(mesh);
        }
      }

      if (meshesToExport.length === 0) {
        throw new Error('No valid meshes found to export');
      }

      // Merge all meshes into a single mesh for export
      const mergedMesh = this.mergeMeshesForExport(meshesToExport);
      
      if (!mergedMesh) {
        throw new Error('Failed to merge meshes for export');
      }

      // Use Babylon's STL export - cast to global BABYLON.Mesh type
      const stlString = (window as any).BABYLON.STLExport.CreateSTL([mergedMesh as any], true, mergedMesh.name);
      
      // Create a blob and download
      const blob = new Blob([stlString], { type: 'application/octet-stream' });
      this.downloadBlob(blob, filename);

      // Clean up the temporary merged mesh
      mergedMesh.dispose();
      
      console.log(`✅ Successfully exported ${meshesToExport.length} objects to ${filename}`);
    } catch (error) {
      console.error('❌ Error exporting to STL:', error);
      throw error;
    }
  }

  /**
   * Merges multiple meshes into a single mesh for export
   * @param meshes Array of meshes to merge
   * @returns A single merged mesh
   */
  private mergeMeshesForExport(meshes: Mesh[]): Mesh | null {
    if (meshes.length === 0) return null;
    
    // Clone meshes to avoid modifying originals
    const clonedMeshes = meshes.map((mesh, index) => {
      const clone = mesh.clone(`export-clone-${index}`, null);
      
      // Apply the mesh's world matrix to bake transformations
      if (clone && clone.geometry) {
        clone.bakeCurrentTransformIntoVertices();
      }
      
      return clone;
    }).filter(mesh => mesh !== null) as Mesh[];

    if (clonedMeshes.length === 0) return null;

    // Merge all cloned meshes
    const mergedMesh = Mesh.MergeMeshes(
      clonedMeshes,
      true,  // dispose source meshes
      true,  // allow different materials
      undefined,  // no parent
      false,  // don't optimize vertex data
      true   // use precise bounding info
    );

    if (mergedMesh) {
      mergedMesh.name = 'scene-export';
    }

    return mergedMesh;
  }

  /**
   * Downloads a blob as a file
   * @param blob The blob to download
   * @param filename The filename for the download
   */
  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Checks if STL export is available
   * @returns true if STL export is supported
   */
  public static isSTLExportAvailable(): boolean {
    return typeof (window as any).BABYLON !== 'undefined' && 
           typeof (window as any).BABYLON.STLExport !== 'undefined' &&
           typeof (window as any).BABYLON.STLExport.CreateSTL === 'function';
  }
}

/**
 * Factory function to create a new STLExporter instance
 * @param scene The Babylon.js scene
 * @returns A new STLExporter instance
 */
export function createSTLExporter(scene: Scene): STLExporter {
  return new STLExporter(scene);
} 