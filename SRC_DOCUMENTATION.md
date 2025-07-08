# Source Code Documentation

This document provides a detailed breakdown of the `src` directory, outlining the structure, purpose, and functionality of each file and folder.

## Project Overview

This is a 3D modeling application with a focus on AI-powered scene manipulation. It uses React for the user interface, Babylon.js for the 3D rendering and interaction, and a Zustand store for state management.

## High-Level Directory Structure

```
src/
├── ai/
├── assets/
├── babylon/
├── components/
├── hooks/
├── nurbs/
├── state/
├── types/
├── App.css
├── App.tsx
├── index.css
├── main.tsx
├── verb-nurbs.d.ts
└── vite-env.d.ts
```

## Top-Level Files

### `main.tsx`

This is the main entry point for the React application. It finds the root DOM element and renders the `App` component within React's `StrictMode`. It also imports the global stylesheet `index.css`.

### `App.tsx`

This is the root component of the application. It's a large, central component that orchestrates the entire application.

**Key Responsibilities:**

*   **Main Layout:** It renders the main application layout, which consists of a top toolbar, the main content area with the 3D canvas, and a sidebar.
*   **State Management:** It connects to the `useSceneStore` (Zustand) to get and set application state. This includes scene objects, selections, UI state, etc.
*   **3D Scene Integration:** It uses the `useBabylonScene` hook to initialize and manage the Babylon.js scene, which is rendered onto a `<canvas>` element.
*   **Core Functionality:** It contains the logic for creating, deleting, and duplicating objects in the scene. It also handles camera controls and some UI interactions like dropdown menus.
*   **Component Orchestration:** It renders the `TopToolbar` and `AISidebar` components, passing down necessary state and functions.
*   **API Key Handling:** It displays an initial screen to input an OpenAI API key, which is required for the AI features.

### `App.css` & `index.css`

These files contain the CSS styles for the application.
*   `index.css`: Contains base styles and resets.
*   `App.css`: Contains styles for the main application components, including the layout, toolbar, sidebar, and 3D canvas container.

### `verb-nurbs.d.ts`

This file contains TypeScript type definitions for the `verb-nurbs` library. The presence of this file suggests that the application previously had or has some functionality related to NURBS (Non-Uniform Rational B-Splines) for creating complex curves and surfaces. However, comments in `App.tsx` indicate that this functionality might be deprecated or removed.

### `vite-env.d.ts`

This file is for Vite-specific environment variables and TypeScript configurations, ensuring that Vite's features are correctly typed.

## Directory Breakdown

### `src/ai`

This directory contains the services related to AI integration, specifically for translating natural language commands into actions within the 3D scene.

#### `ai.service.ts`

This file is central to the AI functionality. It defines the `AIService` class which is responsible for communicating with the OpenAI API.

*   **`AIService` Class:**
    *   Takes an OpenAI API key in its constructor.
    *   **`describeScene()`:** Generates a textual description of the current 3D scene's objects. This description is used to provide context to the AI.
    *   **`generateSystemPrompt()`:** Creates a detailed system prompt for the AI. This prompt instructs the AI on its role as a 3D scene assistant, the available commands (`move`, `color`, `scale`, `create`, `delete`), and the expected JSON output format.
    *   **`getSceneCommands()`:** This is the primary method of the service. It takes a natural language prompt from the user, combines it with the system prompt and scene description, sends it to the `gpt-3.5-turbo` model, and then parses the AI's JSON response into an array of `SceneCommand` objects.
    *   The service also includes utility functions for cleaning and parsing the AI's response.

*   **`SceneCommand` Interface:** Defines the TypeScript interface for the structured commands that the AI can issue.

*   **`createAIService()`:** A factory function for creating a new instance of the `AIService`.

### `src/babylon`

This directory is the core of the 3D rendering functionality, containing all the code related to Babylon.js. It manages the scene, objects, user interactions within the 3D canvas, and provides React hooks to connect the 3D world with the application's UI and state.

#### `sceneManager.ts`

This file contains the `SceneManager` class, which acts as a low-level wrapper around the Babylon.js scene. It handles the direct, imperative management of the 3D scene.

*   **`SceneManager` Class:**
    *   **Initialization:** The `initialize` method sets up the core Babylon.js components: `Engine`, `Scene`, `ArcRotateCamera`, `HemisphericLight`, and the `GizmoManager`.
    *   **Mesh Management:** It maintains a `meshMap` to associate `SceneObject` IDs with Babylon.js `Mesh` objects. It includes methods like `addMesh`, `removeMeshById`, and `updateMeshProperties` to manipulate objects in the scene.
    *   **Event Handling:** It sets up pointer observers to detect clicks and hovers on objects within the scene, and exposes callbacks (`setObjectClickCallback`, `setObjectHoverCallback`) to be handled by higher-level logic (specifically, the `useBabylonScene` hook).
    *   **Visuals:** Provides methods to control scene-wide visual aspects like `setWireframeMode` and creating a `createVisualGrid`.
    *   **Camera:** Includes a `setCameraView` method for changing the camera's perspective.
    *   **Disposal:** Has a `dispose` method to clean up all Babylon.js resources.

While this class manages the scene, it is primarily used internally by the `useBabylonScene` hook and not directly by the UI components.

#### `objectFactory.ts`

This file provides a set of factory functions to create primitive 3D shapes.

*   **`createPrimitiveMesh`:** A central factory function that takes a `PrimitiveType` (e.g., `'cube'`, `'sphere'`) and returns a Babylon.js `Mesh` instance.
*   It has individual functions for each shape (`createCube`, `createSphere`, etc.).
*   It abstracts away the `MeshBuilder` calls and provides a single, consistent way to create objects, applying common properties like position, scale, rotation, and color.
*   It explicitly does not handle NURBS creation.

#### `gizmoManager.ts`

This file contains a `GizmoController` class and a `useGizmoManager` hook, which together provide a modern, hook-based approach to managing the transformation gizmos.

*   **`GizmoController` Class:** A dedicated class to manage the lifecycle and state of the Babylon.js `GizmoManager`. It handles enabling/disabling the correct gizmo, attaching it to a mesh, and managing the observers for drag events.
*   **`useGizmoManager` Hook:** This hook integrates the `GizmoController` into the React application. It listens to state changes from `useSceneStore` (like the selected object or current transform mode) and updates the gizmo accordingly. It also handles the callback from the gizmo drag events, updating the object's properties in the store.

#### `babylon/hooks/useBabylonScene.ts`

This is a crucial custom React hook that serves as the primary bridge between the React application (UI and state) and the Babylon.js scene. It encapsulates almost all of the 3D scene logic.

*   **Responsibilities:**
    *   **Initialization:** It initializes the `SceneManager` when the React component mounts and the canvas is ready. It also creates a default scene with a ground and a single cube.
    *   **State Synchronization (Two-way):**
        *   **Store to Scene:** It subscribes to the `useSceneStore` and automatically reflects changes in the 3D scene. For example, if an object is added to the `sceneObjects` array in the store, this hook calls the `sceneManager` to create and add the corresponding mesh to the Babylon scene. It also syncs properties like wireframe mode, grid visibility, and selection highlights.
        *   **Scene to Store:** It uses callbacks from the `sceneManager` (for clicks and hovers) to update the state in the `useSceneStore`. For example, when a user clicks an object in the 3D view, the hook updates the `selectedObjectId` in the store.
    *   **Interaction Logic:** Contains the implementation for how user interactions (like clicks) translate into state changes (like selecting an object).
    *   **Gizmo Integration:** It uses the `useGizmoManager` hook to manage the transformation gizmos.
    *   **API Exposure:** It returns a clean API (`setCameraView`) that can be used by UI components to command the scene.

This hook allows the rest of the application to interact with the 3D scene in a declarative, React-friendly way, without needing to directly interface with the imperative Babylon.js APIs.

### `src/components`

This directory contains all the React components that make up the user interface of the application. The components are organized into logical subdirectories: `layout`, `sidebar`, and `toolbar`.

#### `components/layout`

This directory is intended to hold high-level layout components.

*   **`AppLayout.tsx`**: This file is currently empty. It is likely a placeholder for a future layout component that would structure the main parts of the application's UI.

#### `components/sidebar`

This directory contains the components that make up the main sidebar of the application.

*   **`AISidebar.tsx`**: This is a major component that acts as the control center for the application.
    *   It's a collapsible sidebar that contains other key UI elements.
    *   **AI Command Input:** It provides a `textarea` for users to enter natural language commands. It handles the logic of sending these prompts to the `AIService`, receiving the structured commands, and then executing them by calling the appropriate actions in the `useSceneStore`.
    *   **Child Components:** It renders the `SceneGraph` and `PropertiesPanel` components.
    *   **Info Display:** It also displays a list of keyboard shortcuts and a log of the AI responses.

*   **`SceneGraph.tsx`**: This component renders a list of all the objects in the scene (often called a scene outliner).
    *   It gets the list of `sceneObjects` from the `useSceneStore`.
    *   For each object, it displays its name, type, and color.
    *   It provides controls to select, hide/show, and lock/unlock each object directly from the list.

*   **`PropertiesPanel.tsx`**: This component is a classic properties inspector.
    *   When an object is selected, this panel displays its detailed properties (position, rotation, scale, color).
    *   Users can edit these properties using number and color inputs, which provides precise control over the objects. The changes are immediately reflected in the 3D scene by updating the state in the `useSceneStore`.
    *   It includes special UI for editing NURBS properties, such as tessellation quality and control point positions.
    *   It also has a mode for when multiple objects are selected, providing tools for bulk editing.

#### `components/toolbar`

This directory is intended to hold the components for the main top toolbar.

*   **`TopToolbar.tsx`** & **`ToolbarDropdown.tsx`**: Both of these files are currently empty. The functionality for the top toolbar, including its dropdown menus, is currently implemented directly within a `renderTopToolbar` function inside `App.tsx`. It is likely that the intention is to refactor this logic into these dedicated components.

### `src/hooks`

This directory contains global custom React hooks that can be used by any component.

#### `useKeyboardShortcuts.tsx`

This custom hook is responsible for setting up and managing all global keyboard shortcuts for the application.

*   It adds a `keydown` event listener to the window when it's active.
*   It connects to the `useSceneStore` to trigger actions based on key presses.
*   It handles shortcuts for:
    *   Switching between transform modes (`M` for move, `R` for rotate, `S` for scale).
    *   Deleting selected objects (`Delete`, `Backspace`).
    *   Toggling grid snapping (`Ctrl/Cmd + G`).
    *   Deselecting objects (`Escape`).
*   It is used in `App.tsx` to enable these shortcuts globally.

### `src/nurbs`

This directory was likely intended to hold utility functions related to NURBS (Non-Uniform Rational B-Splines) surfaces.

*   **`nurbs.utils.ts`**: This file is currently empty. This, along with comments in other parts of the codebase, strongly suggests that NURBS functionality was either planned and not implemented, or has been deprecated and removed.

### `src/state`

This directory holds the global state management for the application.

#### `sceneStore.ts`

This is one of the most important files in the application. It defines and creates the global application state using Zustand, a popular state management library for React. This store serves as the single source of truth for the entire application.

*   **Zustand Store (`useSceneStore`):** A custom hook that gives any component access to the shared state and the actions to update it.
*   **`SceneState` Interface:** Defines the shape of the global state, which includes:
    *   **Scene Data:** `sceneObjects` array, `selectedObjectId`, `selectedObjectIds`.
    *   **Interaction State:** `transformMode`, `multiSelectMode`, `snapToGrid`, etc.
    *   **UI State:** `sidebarCollapsed`, `activeDropdown`.
    *   **AI State:** `isLoading`, `apiKey`, `responseLog`.
*   **`SceneActions` Interface:** Defines all the functions that can be used to update the state. Having explicit action functions ensures that state changes are predictable and traceable.
*   **Getters:** The store also includes getter functions to compute derived state (e.g., `getSelectedObject()`, `hasSelection()`).
*   **Devtools:** The store is wrapped with `devtools` middleware, which allows for debugging the state and actions using the Redux DevTools browser extension.

### `src/types`

This directory contains TypeScript definition files, providing a single source for all the custom types used across the application.

#### `types.ts`

This file defines the core data structures and types that are shared throughout the codebase.

*   **Type Aliases:** Defines several type aliases for string literals, such as `TransformMode` and `PrimitiveType`, which helps enforce consistency.
*   **`SceneObject` Interface:** This is a crucial interface that defines the structure of a 3D object in the application's state. It includes properties like `id`, `type`, transform data (`position`, `rotation`, `scale`), and optional data for NURBS surfaces (`verbData`).
*   **Other Interfaces:** It also defines interfaces for `ControlPointVisualization` and `MultiSelectInitialState` to support more complex functionalities.
*   **Constants:** It exports a `materialPresets` array, which provides a predefined list of colors for the UI.

### `src/assets`

This directory contains static assets, such as images and icons, used in the application.

*   **`react.svg`**: This is the standard React logo. It appears to be a leftover from the default Vite project setup and is not currently used within the application's UI. 