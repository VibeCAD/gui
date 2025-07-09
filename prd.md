# Product Requirements Document (PRD): CSG2 Operations Workflow in BabylonJS

## Overview

This document outlines the requirements and workflow for converting BabylonJS meshes into CSG2 objects, performing constructive solid geometry (CSG) operations, and converting the results back to meshes (when necessary). The goal is to enable flexible manipulation of 3D geometry, such as cutting holes or combining shapes, within a text-to-CAD tool.

## Objectives

- **Enable conversion of BabylonJS meshes to CSG2 objects**
- **Support CSG2 operations (union, subtract, intersect) between objects**
- **Allow conversion of CSG2 results back to standard BabylonJS meshes**
- **Clarify when conversion back to meshes is required in the workflow**

## Functional Requirements

### 1. Mesh to CSG2 Conversion

- The system must allow any BabylonJS mesh (primitive or custom) to be converted into a CSG2 object.
- The conversion should preserve the mesh's geometry and spatial properties.

**Acceptance Criteria:**
- Given a BabylonJS mesh, the system can produce a corresponding CSG2 object.

### 2. CSG2 Operations

- The system must support the following CSG2 operations:
  - **Union:** Combine two or more CSG2 objects into one.
  - **Subtract:** Subtract one CSG2 object from another (e.g., cut a hole).
  - **Intersect:** Create a new CSG2 object from the overlapping volume of two objects.

**Acceptance Criteria:**
- Users can perform CSG2 operations programmatically between any compatible CSG2 objects.
- The resulting CSG2 object accurately reflects the intended geometric operation.

### 3. CSG2 to Mesh Conversion

- The system must allow conversion of a CSG2 object back to a BabylonJS mesh.
- The resulting mesh should be usable in the BabylonJS scene graph and support standard mesh operations (rendering, picking, etc.).

**Acceptance Criteria:**
- After performing CSG2 operations, the result can be converted back to a mesh and added to the scene.

### 4. When Conversion Back to Meshes is Necessary

- **Conversion back to meshes is necessary** when the resulting geometry needs to be displayed, manipulated, or exported in the BabylonJS scene.
- CSG2 objects themselves are not directly renderable; only meshes can be rendered and interacted with in the BabylonJS engine.

## Technical Workflow

### Step 1: Create BabylonJS Meshes

- Create primitive or custom meshes (e.g., wall, door).

### Step 2: Convert Meshes to CSG2

```js
const wallCSG = BABYLON.CSG2.FromMesh(wallMesh);
const doorCSG = BABYLON.CSG2.FromMesh(doorMesh);
```

### Step 3: Perform CSG2 Operations

```js
const wallWithDoorCSG = wallCSG.subtract(doorCSG);
```

### Step 4: Convert CSG2 Back to Mesh

```js
const wallWithDoorMesh = wallWithDoorCSG.toMesh("wallWithDoor", null, scene);
```

### Step 5: Add Resulting Mesh to Scene

- The new mesh can now be manipulated, rendered, or exported as needed.

## Non-Functional Requirements

- **Performance:** Operations should be efficient for real-time editing of moderate complexity geometry.
- **Reliability:** The conversion and CSG2 operations must not corrupt geometry data.
- **Extensibility:** The workflow should support additional CSG2 operations or mesh types in the future.

## References

- [BabylonJS CSG2 Documentation]
- [Forum: Introducing CSG2]

## Summary Table

| Stage                | Input                | Output                | Notes                                |
|----------------------|----------------------|-----------------------|--------------------------------------|
| Mesh to CSG2         | BabylonJS Mesh       | CSG2 Object           | Required for CSG operations          |
| CSG2 Operations      | CSG2 Objects         | CSG2 Object           | Union, subtract, intersect supported |
| CSG2 to Mesh         | CSG2 Object          | BabylonJS Mesh        | Required for rendering/interaction   |

## Key Takeaways

- **Conversion back to meshes is always necessary** for rendering and scene interaction in BabylonJS.
- The workflow is modular, supporting flexible geometric editing for CAD-like applications.

: https://doc.babylonjs.com/typedoc/classes/BABYLON.CSG2
: https://forum.babylonjs.com/t/introducing-csg2/54274

Sources
