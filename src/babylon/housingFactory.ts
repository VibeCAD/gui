import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh, Vector3, CSG } from 'babylonjs';
import type { MeshCreationOptions } from './objectFactory';
import type { Wall, Door, Window, HousingComponent, ModularHousingObject, DoorType, WindowType, WallType } from '../types/types';

/**
 * Creates a wall mesh with specified dimensions and properties
 */
export const createWall = (scene: Scene, wall: Wall, options: MeshCreationOptions = {}): Mesh => {
  const length = wall.startPoint.subtract(wall.endPoint).length();
  const wallMesh = MeshBuilder.CreateBox(`wall-${wall.id}`, {
    width: length,
    height: wall.height,
    depth: wall.thickness
  }, scene);

  // Position the wall at the midpoint between start and end points
  const midpoint = wall.startPoint.add(wall.endPoint).scale(0.5);
  wallMesh.position = midpoint;

  // Calculate rotation to align with wall direction
  const direction = wall.endPoint.subtract(wall.startPoint).normalize();
  const angle = Math.atan2(direction.x, direction.z);
  wallMesh.rotation.y = angle;

  // Apply material
  const material = new StandardMaterial(`wall-${wall.id}-material`, scene);
  material.diffuseColor = Color3.FromHexString(wall.color);
  wallMesh.material = material;

  return wallMesh;
};

/**
 * Creates a door mesh with specified properties
 */
export const createDoor = (scene: Scene, door: Door, options: MeshCreationOptions = {}): Mesh => {
  let doorMesh: Mesh;

  switch (door.type) {
    case 'single':
      doorMesh = MeshBuilder.CreateBox(`door-${door.id}`, {
        width: door.width,
        height: door.height,
        depth: door.thickness
      }, scene);
      break;
    case 'double':
      const leftDoor = MeshBuilder.CreateBox(`door-${door.id}-left`, {
        width: door.width / 2,
        height: door.height,
        depth: door.thickness
      }, scene);
      const rightDoor = MeshBuilder.CreateBox(`door-${door.id}-right`, {
        width: door.width / 2,
        height: door.height,
        depth: door.thickness
      }, scene);
      leftDoor.position.x = -door.width / 4;
      rightDoor.position.x = door.width / 4;
      doorMesh = Mesh.MergeMeshes([leftDoor, rightDoor], true, true) || leftDoor;
      break;
    case 'sliding':
      doorMesh = MeshBuilder.CreateBox(`door-${door.id}`, {
        width: door.width,
        height: door.height,
        depth: door.thickness / 2
      }, scene);
      break;
    case 'french':
      const leftFrench = MeshBuilder.CreateBox(`door-${door.id}-left`, {
        width: door.width / 2,
        height: door.height,
        depth: door.thickness
      }, scene);
      const rightFrench = MeshBuilder.CreateBox(`door-${door.id}-right`, {
        width: door.width / 2,
        height: door.height,
        depth: door.thickness
      }, scene);
      leftFrench.position.x = -door.width / 4;
      rightFrench.position.x = door.width / 4;
      doorMesh = Mesh.MergeMeshes([leftFrench, rightFrench], true, true) || leftFrench;
      break;
    case 'garage':
      doorMesh = MeshBuilder.CreateBox(`door-${door.id}`, {
        width: door.width,
        height: door.height,
        depth: door.thickness / 4
      }, scene);
      break;
    default:
      doorMesh = MeshBuilder.CreateBox(`door-${door.id}`, {
        width: door.width,
        height: door.height,
        depth: door.thickness
      }, scene);
  }

  doorMesh.position = door.position.clone();

  // Apply material
  const material = new StandardMaterial(`door-${door.id}-material`, scene);
  material.diffuseColor = Color3.FromHexString(door.color);
  doorMesh.material = material;

  return doorMesh;
};

/**
 * Creates a window mesh with specified properties
 */
export const createWindow = (scene: Scene, window: Window, options: MeshCreationOptions = {}): Mesh => {
  const frameThickness = window.hasFrame ? window.frameThickness : 0;
  
  let windowMesh: Mesh;

  if (window.hasFrame) {
    // Create frame
    const outerFrame = MeshBuilder.CreateBox(`window-${window.id}-outer`, {
      width: window.width,
      height: window.height,
      depth: frameThickness
    }, scene);

    const glassWidth = window.width - frameThickness * 2;
    const glassHeight = window.height - frameThickness * 2;

    if (glassWidth > 0 && glassHeight > 0) {
      const glass = MeshBuilder.CreateBox(`window-${window.id}-glass`, {
        width: glassWidth,
        height: glassHeight,
        depth: frameThickness / 2
      }, scene);

      // Make glass transparent
      const glassMaterial = new StandardMaterial(`window-${window.id}-glass-material`, scene);
      glassMaterial.diffuseColor = new Color3(0.8, 0.9, 1.0);
      glassMaterial.alpha = 0.3;
      glass.material = glassMaterial;

      windowMesh = Mesh.MergeMeshes([outerFrame, glass], true, false) || outerFrame;
    } else {
      windowMesh = outerFrame;
    }
  } else {
    // Just glass
    windowMesh = MeshBuilder.CreateBox(`window-${window.id}`, {
      width: window.width,
      height: window.height,
      depth: 0.02
    }, scene);

    const glassMaterial = new StandardMaterial(`window-${window.id}-material`, scene);
    glassMaterial.diffuseColor = new Color3(0.8, 0.9, 1.0);
    glassMaterial.alpha = 0.3;
    windowMesh.material = glassMaterial;
  }

  windowMesh.position = window.position.clone();

  // Apply frame material if has frame
  if (window.hasFrame && windowMesh.material) {
    const frameMaterial = new StandardMaterial(`window-${window.id}-frame-material`, scene);
    frameMaterial.diffuseColor = Color3.FromHexString(window.color);
    // Don't override glass material, just set the frame material
  }

  return windowMesh;
};

/**
 * Creates a ceiling mesh for a room
 */
export const createCeiling = (scene: Scene, walls: Wall[], height: number, thickness: number = 0.1, color: string = '#f0f0f0'): Mesh => {
  // Calculate room bounds from walls
  const points: Vector3[] = [];
  walls.forEach(wall => {
    points.push(wall.startPoint);
    points.push(wall.endPoint);
  });

  if (points.length === 0) {
    // Fallback: create a simple rectangular ceiling
    const ceiling = MeshBuilder.CreateBox('ceiling', {
      width: 4,
      height: thickness,
      depth: 4
    }, scene);
    ceiling.position.y = height;
    return ceiling;
  }

  // Find bounding box
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minZ = Math.min(...points.map(p => p.z));
  const maxZ = Math.max(...points.map(p => p.z));

  const width = maxX - minX;
  const depth = maxZ - minZ;

  const ceiling = MeshBuilder.CreateBox('ceiling', {
    width: width,
    height: thickness,
    depth: depth
  }, scene);

  ceiling.position = new Vector3(
    (minX + maxX) / 2,
    height,
    (minZ + maxZ) / 2
  );

  // Apply material
  const material = new StandardMaterial('ceiling-material', scene);
  material.diffuseColor = Color3.FromHexString(color);
  ceiling.material = material;

  return ceiling;
};

/**
 * Creates a floor mesh for a room
 */
export const createFloor = (scene: Scene, walls: Wall[], thickness: number = 0.05, color: string = '#8B4513'): Mesh => {
  // Calculate room bounds from walls
  const points: Vector3[] = [];
  walls.forEach(wall => {
    points.push(wall.startPoint);
    points.push(wall.endPoint);
  });

  if (points.length === 0) {
    // Fallback: create a simple rectangular floor
    const floor = MeshBuilder.CreateBox('floor', {
      width: 4,
      height: thickness,
      depth: 4
    }, scene);
    floor.position.y = thickness / 2;
    return floor;
  }

  // Find bounding box
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minZ = Math.min(...points.map(p => p.z));
  const maxZ = Math.max(...points.map(p => p.z));

  const width = maxX - minX;
  const depth = maxZ - minZ;

  const floor = MeshBuilder.CreateBox('floor', {
    width: width,
    height: thickness,
    depth: depth
  }, scene);

  floor.position = new Vector3(
    (minX + maxX) / 2,
    thickness / 2,
    (minZ + maxZ) / 2
  );

  // Apply material
  const material = new StandardMaterial('floor-material', scene);
  material.diffuseColor = Color3.FromHexString(color);
  floor.material = material;

  return floor;
};

/**
 * Modular Housing Builder class for creating complex housing assemblies
 */
export class ModularHousingBuilder {
  private scene: Scene;
  private housingObject: ModularHousingObject;
  private meshes: Mesh[] = [];

  constructor(scene: Scene, housingObject: ModularHousingObject) {
    this.scene = scene;
    this.housingObject = housingObject;
  }

  /**
   * Builds the complete housing object with all components
   */
  build(): Mesh {
    const meshes: Mesh[] = [];

    // Create walls
    this.housingObject.walls.forEach(wall => {
      const wallMesh = this.createWallWithOpenings(wall);
      meshes.push(wallMesh);
    });

    // Create floor if enabled
    if (this.housingObject.hasFloor) {
      const floorMesh = createFloor(
        this.scene,
        this.housingObject.walls,
        this.housingObject.floorThickness,
        this.housingObject.color
      );
      meshes.push(floorMesh);
    }

    // Create ceiling if enabled
    if (this.housingObject.hasCeiling) {
      const ceilingMesh = createCeiling(
        this.scene,
        this.housingObject.walls,
        this.housingObject.ceilingHeight,
        0.1,
        this.housingObject.color
      );
      meshes.push(ceilingMesh);
    }

    // Create foundation if enabled
    if (this.housingObject.hasFoundation) {
      const foundationMesh = this.createFoundation();
      meshes.push(foundationMesh);
    }

    // Merge all meshes into a single object
    const finalMesh = Mesh.MergeMeshes(meshes, true, true);
    
    if (finalMesh) {
      finalMesh.name = this.housingObject.id;
      finalMesh.position = this.housingObject.position.clone();
      finalMesh.rotation = this.housingObject.rotation.clone();
      finalMesh.scaling = this.housingObject.scale.clone();
    }

    return finalMesh || meshes[0];
  }

  /**
   * Creates a wall with door and window openings using CSG
   */
  private createWallWithOpenings(wall: Wall): Mesh {
    // Create the base wall
    const wallMesh = createWall(this.scene, wall);
    
    if (wall.doors.length === 0 && wall.windows.length === 0) {
      return wallMesh;
    }

    try {
      let wallCSG = CSG.FromMesh(wallMesh);

      // Subtract door openings
      wall.doors.forEach(door => {
        const doorOpening = this.createDoorOpening(door, wall);
        const doorCSG = CSG.FromMesh(doorOpening);
        wallCSG = wallCSG.subtract(doorCSG);
        doorOpening.dispose();
      });

      // Subtract window openings
      wall.windows.forEach(window => {
        const windowOpening = this.createWindowOpening(window, wall);
        const windowCSG = CSG.FromMesh(windowOpening);
        wallCSG = wallCSG.subtract(windowCSG);
        windowOpening.dispose();
      });

      const resultMesh = wallCSG.toMesh(`wall-${wall.id}-with-openings`, wallMesh.material, this.scene);
      wallMesh.dispose();
      
      return resultMesh;
    } catch (error) {
      console.warn('CSG operation failed for wall openings:', error);
      return wallMesh;
    }
  }

  /**
   * Creates a door opening mesh for CSG subtraction
   */
  private createDoorOpening(door: Door, wall: Wall): Mesh {
    const opening = MeshBuilder.CreateBox(`door-opening-${door.id}`, {
      width: door.width,
      height: door.height,
      depth: wall.thickness + 0.1 // Slightly thicker to ensure clean cut
    }, this.scene);

    // Position the opening relative to the wall
    const wallDirection = wall.endPoint.subtract(wall.startPoint).normalize();
    const wallMidpoint = wall.startPoint.add(wall.endPoint).scale(0.5);
    
    // Calculate position along the wall
    const positionAlongWall = wallDirection.scale(door.position.x);
    const openingPosition = wallMidpoint.add(positionAlongWall);
    openingPosition.y = door.height / 2; // Position at floor level
    
    opening.position = openingPosition;

    // Rotate to match wall orientation
    const angle = Math.atan2(wallDirection.x, wallDirection.z);
    opening.rotation.y = angle;

    return opening;
  }

  /**
   * Creates a window opening mesh for CSG subtraction
   */
  private createWindowOpening(window: Window, wall: Wall): Mesh {
    const opening = MeshBuilder.CreateBox(`window-opening-${window.id}`, {
      width: window.width,
      height: window.height,
      depth: wall.thickness + 0.1 // Slightly thicker to ensure clean cut
    }, this.scene);

    // Position the opening relative to the wall
    const wallDirection = wall.endPoint.subtract(wall.startPoint).normalize();
    const wallMidpoint = wall.startPoint.add(wall.endPoint).scale(0.5);
    
    // Calculate position along the wall
    const positionAlongWall = wallDirection.scale(window.position.x);
    const openingPosition = wallMidpoint.add(positionAlongWall);
    openingPosition.y = window.sillHeight + window.height / 2; // Position at sill height
    
    opening.position = openingPosition;

    // Rotate to match wall orientation
    const angle = Math.atan2(wallDirection.x, wallDirection.z);
    opening.rotation.y = angle;

    return opening;
  }

  /**
   * Creates a foundation mesh
   */
  private createFoundation(): Mesh {
    const points: Vector3[] = [];
    this.housingObject.walls.forEach(wall => {
      points.push(wall.startPoint);
      points.push(wall.endPoint);
    });

    if (points.length === 0) {
      return MeshBuilder.CreateBox('foundation', { width: 4, height: 0.5, depth: 4 }, this.scene);
    }

    // Find bounding box
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minZ = Math.min(...points.map(p => p.z));
    const maxZ = Math.max(...points.map(p => p.z));

    const width = maxX - minX + 0.5; // Add some padding
    const depth = maxZ - minZ + 0.5;

    const foundation = MeshBuilder.CreateBox('foundation', {
      width: width,
      height: this.housingObject.foundationHeight,
      depth: depth
    }, this.scene);

    foundation.position = new Vector3(
      (minX + maxX) / 2,
      -this.housingObject.foundationHeight / 2,
      (minZ + maxZ) / 2
    );

    // Apply material
    const material = new StandardMaterial('foundation-material', this.scene);
    material.diffuseColor = new Color3(0.5, 0.5, 0.5);
    foundation.material = material;

    return foundation;
  }

  /**
   * Adds a door to a wall
   */
  addDoor(wallId: string, door: Omit<Door, 'id' | 'wallId'>): string {
    const wall = this.housingObject.walls.find(w => w.id === wallId);
    if (!wall) {
      throw new Error(`Wall with ID ${wallId} not found`);
    }

    const newDoor: Door = {
      ...door,
      id: `door-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      wallId: wallId
    };

    wall.doors.push(newDoor);
    this.housingObject.doors.push(newDoor);

    return newDoor.id;
  }

  /**
   * Adds a window to a wall
   */
  addWindow(wallId: string, window: Omit<Window, 'id' | 'wallId'>): string {
    const wall = this.housingObject.walls.find(w => w.id === wallId);
    if (!wall) {
      throw new Error(`Wall with ID ${wallId} not found`);
    }

    const newWindow: Window = {
      ...window,
      id: `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      wallId: wallId
    };

    wall.windows.push(newWindow);
    this.housingObject.windows.push(newWindow);

    return newWindow.id;
  }

  /**
   * Removes a door from the housing object
   */
  removeDoor(doorId: string): boolean {
    const door = this.housingObject.doors.find(d => d.id === doorId);
    if (!door) return false;

    const wall = this.housingObject.walls.find(w => w.id === door.wallId);
    if (wall) {
      wall.doors = wall.doors.filter(d => d.id !== doorId);
    }

    this.housingObject.doors = this.housingObject.doors.filter(d => d.id !== doorId);
    return true;
  }

  /**
   * Removes a window from the housing object
   */
  removeWindow(windowId: string): boolean {
    const window = this.housingObject.windows.find(w => w.id === windowId);
    if (!window) return false;

    const wall = this.housingObject.walls.find(w => w.id === window.wallId);
    if (wall) {
      wall.windows = wall.windows.filter(w => w.id !== windowId);
    }

    this.housingObject.windows = this.housingObject.windows.filter(w => w.id !== windowId);
    return true;
  }

  /**
   * Changes wall thickness for all walls or a specific wall
   */
  changeWallThickness(thickness: number, wallId?: string): void {
    if (wallId) {
      const wall = this.housingObject.walls.find(w => w.id === wallId);
      if (wall) {
        wall.thickness = thickness;
      }
    } else {
      this.housingObject.walls.forEach(wall => {
        wall.thickness = thickness;
      });
      this.housingObject.wallThickness = thickness;
    }
  }

  /**
   * Toggles ceiling on/off
   */
  toggleCeiling(hasCeiling: boolean): void {
    this.housingObject.hasCeiling = hasCeiling;
  }

  /**
   * Toggles floor on/off
   */
  toggleFloor(hasFloor: boolean): void {
    this.housingObject.hasFloor = hasFloor;
  }
}

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
 * Creates a simple rectangular room for backward compatibility
 */
export const createSimpleRoom = (
  scene: Scene, 
  options: MeshCreationOptions & { 
    width?: number, 
    height?: number, 
    depth?: number, 
    wallThickness?: number,
    hasCeiling?: boolean,
    hasFloor?: boolean,
    roomType?: string
  } = {}
): ModularHousingObject => {
  const width = options.width || 4;
  const height = options.height || 3;
  const depth = options.depth || 4;
  const wallThickness = options.wallThickness || 0.2;
  const hasCeiling = options.hasCeiling !== false;
  const hasFloor = options.hasFloor !== false;
  
  // Create walls for a rectangular room
  const walls: Wall[] = [
    {
      id: 'wall-north',
      type: 'exterior',
      startPoint: new Vector3(-width/2, 0, depth/2),
      endPoint: new Vector3(width/2, 0, depth/2),
      height: height,
      thickness: wallThickness,
      color: options.color || '#DEB887',
      doors: [],
      windows: [],
      isLoadBearing: true,
      connectedWalls: ['wall-east', 'wall-west']
    },
    {
      id: 'wall-south',
      type: 'exterior',
      startPoint: new Vector3(width/2, 0, -depth/2),
      endPoint: new Vector3(-width/2, 0, -depth/2),
      height: height,
      thickness: wallThickness,
      color: options.color || '#DEB887',
      doors: [],
      windows: [],
      isLoadBearing: true,
      connectedWalls: ['wall-east', 'wall-west']
    },
    {
      id: 'wall-east',
      type: 'exterior',
      startPoint: new Vector3(width/2, 0, depth/2),
      endPoint: new Vector3(width/2, 0, -depth/2),
      height: height,
      thickness: wallThickness,
      color: options.color || '#DEB887',
      doors: [],
      windows: [],
      isLoadBearing: true,
      connectedWalls: ['wall-north', 'wall-south']
    },
    {
      id: 'wall-west',
      type: 'exterior',
      startPoint: new Vector3(-width/2, 0, -depth/2),
      endPoint: new Vector3(-width/2, 0, depth/2),
      height: height,
      thickness: wallThickness,
      color: options.color || '#DEB887',
      doors: [],
      windows: [],
      isLoadBearing: true,
      connectedWalls: ['wall-north', 'wall-south']
    }
  ];

  // Add a default door to the south wall
  const defaultDoor: Door = {
    id: 'door-main',
    type: 'single',
    width: 0.8,
    height: 2.0,
    thickness: 0.05,
    position: new Vector3(0, 0, 0), // Center of the wall
    wallId: 'wall-south',
    isOpen: false,
    openDirection: 'inward',
    hingeDirection: 'right',
    color: '#8B4513'
  };

  walls[1].doors.push(defaultDoor); // Add to south wall

  const housingObject: ModularHousingObject = {
    id: options.name || `modular-room-${Date.now()}`,
    type: 'modular-room',
    position: new Vector3(0, 0, 0),
    scale: new Vector3(1, 1, 1),
    rotation: new Vector3(0, 0, 0),
    color: options.color || '#DEB887',
    isNurbs: false,
    housingType: 'modular-room',
    wallThickness: wallThickness,
    hasCeiling: hasCeiling,
    hasFloor: hasFloor,
    hasFoundation: false,
    walls: walls,
    doors: [defaultDoor],
    windows: [],
    ceilingHeight: height,
    floorThickness: 0.1,
    foundationHeight: 0.5,
    buildingConnections: [],
    roomType: options.roomType as any || 'living-room'
  };

  return housingObject;
};

/**
 * Creates a modular housing mesh using the ModularHousingBuilder
 */
export const createModularHousingMesh = (
  housingObject: ModularHousingObject,
  scene: Scene
): Mesh => {
  const builder = new ModularHousingBuilder(scene, housingObject);
  return builder.build();
};

/**
 * Creates a standalone wall component
 */
export const createStandaloneWall = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  const wall: Wall = {
    id: options.name || 'standalone-wall',
    type: 'exterior',
    startPoint: new Vector3(-2, 0, 0),
    endPoint: new Vector3(2, 0, 0),
    height: 2.5,
    thickness: 0.2,
    color: options.color || '#8B4513',
    doors: [],
    windows: [],
    isLoadBearing: false,
    connectedWalls: []
  };
  
  return createWall(scene, wall, options);
};

/**
 * Creates a standalone ceiling component
 */
export const createStandaloneCeiling = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  const walls: Wall[] = [
    {
      id: 'temp-wall-1',
      type: 'exterior',
      startPoint: new Vector3(-2, 0, -2),
      endPoint: new Vector3(2, 0, -2),
      height: 2.5,
      thickness: 0.2,
      color: '#8B4513',
      doors: [],
      windows: [],
      isLoadBearing: false,
      connectedWalls: []
    },
    {
      id: 'temp-wall-2',
      type: 'exterior',
      startPoint: new Vector3(2, 0, -2),
      endPoint: new Vector3(2, 0, 2),
      height: 2.5,
      thickness: 0.2,
      color: '#8B4513',
      doors: [],
      windows: [],
      isLoadBearing: false,
      connectedWalls: []
    },
    {
      id: 'temp-wall-3',
      type: 'exterior',
      startPoint: new Vector3(2, 0, 2),
      endPoint: new Vector3(-2, 0, 2),
      height: 2.5,
      thickness: 0.2,
      color: '#8B4513',
      doors: [],
      windows: [],
      isLoadBearing: false,
      connectedWalls: []
    },
    {
      id: 'temp-wall-4',
      type: 'exterior',
      startPoint: new Vector3(-2, 0, 2),
      endPoint: new Vector3(-2, 0, -2),
      height: 2.5,
      thickness: 0.2,
      color: '#8B4513',
      doors: [],
      windows: [],
      isLoadBearing: false,
      connectedWalls: []
    }
  ];
  
  return createCeiling(scene, walls, 2.5, 0.1, options.color || '#F5F5DC');
};

/**
 * Creates a standalone floor component
 */
export const createStandaloneFloor = (scene: Scene, options: MeshCreationOptions = {}): Mesh => {
  const walls: Wall[] = [
    {
      id: 'temp-wall-1',
      type: 'exterior',
      startPoint: new Vector3(-2, 0, -2),
      endPoint: new Vector3(2, 0, -2),
      height: 2.5,
      thickness: 0.2,
      color: '#8B4513',
      doors: [],
      windows: [],
      isLoadBearing: false,
      connectedWalls: []
    },
    {
      id: 'temp-wall-2',
      type: 'exterior',
      startPoint: new Vector3(2, 0, -2),
      endPoint: new Vector3(2, 0, 2),
      height: 2.5,
      thickness: 0.2,
      color: '#8B4513',
      doors: [],
      windows: [],
      isLoadBearing: false,
      connectedWalls: []
    },
    {
      id: 'temp-wall-3',
      type: 'exterior',
      startPoint: new Vector3(2, 0, 2),
      endPoint: new Vector3(-2, 0, 2),
      height: 2.5,
      thickness: 0.2,
      color: '#8B4513',
      doors: [],
      windows: [],
      isLoadBearing: false,
      connectedWalls: []
    },
    {
      id: 'temp-wall-4',
      type: 'exterior',
      startPoint: new Vector3(-2, 0, 2),
      endPoint: new Vector3(-2, 0, -2),
      height: 2.5,
      thickness: 0.2,
      color: '#8B4513',
      doors: [],
      windows: [],
      isLoadBearing: false,
      connectedWalls: []
    }
  ];
  
  return createFloor(scene, walls, 0.1, options.color || '#8B4513');
};

/**
 * Creates a standalone door component
 */
export const createStandaloneDoor = (scene: Scene, doorType: DoorType, options: MeshCreationOptions = {}): Mesh => {
  const doorWidths: { [key in DoorType]: number } = {
    'single': 0.9,
    'double': 1.8,
    'sliding': 1.2,
    'french': 1.2,
    'garage': 2.4
  };
  
  const door: Door = {
    id: options.name || `standalone-door-${doorType}`,
    type: doorType,
    width: doorWidths[doorType],
    height: 2.0,
    thickness: 0.05,
    position: new Vector3(0, 0, 0),
    wallId: 'standalone',
    isOpen: false,
    openDirection: 'inward',
    hingeDirection: 'right',
    color: options.color || '#654321'
  };
  
  return createDoor(scene, door, options);
};

/**
 * Creates a standalone window component
 */
export const createStandaloneWindow = (scene: Scene, windowType: WindowType, options: MeshCreationOptions = {}): Mesh => {
  const windowDimensions: { [key in WindowType]: { width: number; height: number; depth: number } } = {
    'single': { width: 0.6, height: 0.8, depth: 0.05 },
    'double': { width: 1.2, height: 0.8, depth: 0.05 },
    'bay': { width: 1.5, height: 0.8, depth: 0.3 },
    'casement': { width: 0.8, height: 1.0, depth: 0.05 },
    'sliding': { width: 1.2, height: 0.8, depth: 0.05 },
    'skylight': { width: 0.8, height: 0.8, depth: 0.05 }
  };
  
  const dims = windowDimensions[windowType];
  const window: Window = {
    id: options.name || `standalone-window-${windowType}`,
    type: windowType,
    width: dims.width,
    height: dims.height,
    position: new Vector3(0, 0, 0),
    wallId: 'standalone',
    sillHeight: 0.8,
    hasFrame: true,
    frameThickness: 0.05,
    color: options.color || '#87CEEB'
  };
  
  return createWindow(scene, window, options);
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
    case 'house-room-modular':
    case 'modular-room':
      // Create a simple modular room for backward compatibility
      const simpleRoom = createSimpleRoom(scene, options);
      return createModularHousingMesh(simpleRoom, scene);
    
    // Individual wall component
    case 'house-wall':
      return createStandaloneWall(scene, options);
    
    // Individual ceiling component
    case 'house-ceiling':
      return createStandaloneCeiling(scene, options);
    
    // Individual floor component
    case 'house-floor':
      return createStandaloneFloor(scene, options);
    
    // Door types
    case 'house-door-single':
      return createStandaloneDoor(scene, 'single', options);
    case 'house-door-double':
      return createStandaloneDoor(scene, 'double', options);
    case 'house-door-sliding':
      return createStandaloneDoor(scene, 'sliding', options);
    case 'house-door-french':
      return createStandaloneDoor(scene, 'french', options);
    case 'house-door-garage':
      return createStandaloneDoor(scene, 'garage', options);
    
    // Window types
    case 'house-window-single':
      return createStandaloneWindow(scene, 'single', options);
    case 'house-window-double':
      return createStandaloneWindow(scene, 'double', options);
    case 'house-window-bay':
      return createStandaloneWindow(scene, 'bay', options);
    case 'house-window-casement':
      return createStandaloneWindow(scene, 'casement', options);
    case 'house-window-sliding':
      return createStandaloneWindow(scene, 'sliding', options);
    case 'house-window-skylight':
      return createStandaloneWindow(scene, 'skylight', options);
    
    default:
      throw new Error(`Unknown housing type: ${type}`);
  }
};

 