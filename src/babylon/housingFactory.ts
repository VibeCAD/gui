import { Scene, MeshBuilder, StandardMaterial, Vector3, Mesh, CSG } from 'babylonjs';
import type {
  SceneObject,
  ParametricWallObject,
  Opening,
} from '../types/types';

class ParametricWallBuilder {
  static build(scene: Scene, object: ParametricWallObject): Mesh {
    const wall = MeshBuilder.CreateBox(
      object.id,
      {
        width: object.params.width,
        height: object.params.height,
        depth: object.params.thickness,
      },
      scene
    );
    wall.position = new Vector3(object.position.x, object.position.y, object.position.z);
    wall.rotation = new Vector3(object.rotation.x, object.rotation.y, object.rotation.z);
    wall.metadata = { type: 'parametricWall', id: object.id };

    let wallCSG = CSG.FromMesh(wall);
    wall.dispose(); // The original mesh is no longer needed

    object.params.openings?.forEach((opening) => {
      // Pass thickness to ensure CSG operation is clean
      const openingMesh = this.createOpeningMesh(scene, opening, object.params.thickness);
      const openingCSG = CSG.FromMesh(openingMesh);
      wallCSG = wallCSG.subtract(openingCSG);
      openingMesh.dispose();
    });

    const finalWall = wallCSG.toMesh(object.id, new StandardMaterial(`${object.id}_mat`, scene), scene);
    finalWall.position = new Vector3(object.position.x, object.position.y, object.position.z);
    finalWall.rotation = new Vector3(object.rotation.x, object.rotation.y, object.rotation.z);
    finalWall.metadata = { type: 'parametricWall', id: object.id, params: object.params };

    return finalWall;
  }

  private static createOpeningMesh(scene: Scene, opening: Opening, wallThickness: number): Mesh {
    let openingMesh: Mesh;
    
    // Make the opening slightly larger than the wall to ensure a clean cut
    const depth = wallThickness * 1.5;

    switch (opening.type) {
      case 'door':
      case 'window':
        openingMesh = MeshBuilder.CreateBox(
          `opening_${opening.id}`,
          {
            width: opening.width,
            height: opening.height,
            depth: depth,
          },
          scene
        );
        break;
      case 'roundWindow':
        openingMesh = MeshBuilder.CreateCylinder(
          `opening_${opening.id}`,
          {
            diameter: opening.radius * 2,
            height: depth,
          },
          scene
        );
        // Align cylinder to cut through the wall's thickness
        openingMesh.rotation.x = Math.PI / 2;
        break;
      default: {
        const _exhaustiveCheck: never = opening;
        throw new Error(`Unhandled opening type: ${JSON.stringify(_exhaustiveCheck)}`);
      }
    }
    
    // Position the opening relative to the wall
    openingMesh.position = new Vector3(opening.position.x, opening.position.y, opening.position.z);
    
    return openingMesh;
  }
}

export class HousingFactory {
  static create(scene: Scene, object: SceneObject): Mesh | null {
    if (object.type === 'parametricWall') {
      return ParametricWallBuilder.build(scene, object as ParametricWallObject);
    }
    
    // All other types are part of the old, deprecated system.
    // We will no longer build them and instead log a warning.
    console.warn(`Object type "${object.type}" is deprecated and cannot be created.`);
    return null;
  }
}

 