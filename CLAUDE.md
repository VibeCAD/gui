# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
npm run dev          # Start Vite dev server at http://localhost:5173
npm run build        # TypeScript compile + Vite production build
npm run preview      # Preview production build locally
npm run lint         # Run ESLint on all files
```

### Testing
No test runner configured in package.json scripts. To run the existing test:
```bash
npx jest src/babylon/__tests__/movementController.test.ts
```

## Architecture Overview

VibeCAD is a web-based 3D modeling application with AI-powered natural language controls. The codebase follows a hybrid MVC/Component architecture:

### Core Structure
- **`/src/App.tsx`** (2027 lines) - Main component orchestrating the entire application. Contains toolbar, canvas, sidebars, and handles object operations.
- **`/src/babylon/SceneManager.ts`** - Low-level Babylon.js wrapper managing 3D scene, meshes, textures, and gizmos.
- **`/src/state/sceneStore.ts`** - Zustand store with 300+ state properties managing global application state and undo/redo.
- **`/src/ai/ai.service.ts`** - OpenAI integration translating natural language to structured scene commands.

### Key Patterns
1. **State Flow**: User Input → React Components → Zustand Store → SceneManager → Babylon.js Scene
2. **Factory Pattern**: `ObjectFactory` and `HousingFactory` for creating 3D meshes
3. **Hook Architecture**: Custom hooks (`useBabylonScene`, `useKeyboardShortcuts`) encapsulate complex logic
4. **AI Commands**: Structured JSON format for scene operations from natural language

### Important Directories
- **`/src/components/`** - React UI components (toolbars, sidebars, modals)
- **`/src/babylon/`** - 3D scene management, object factories, texture handling
- **`/src/types/`** - TypeScript interfaces and type definitions
- **`/src/hooks/`** - Custom React hooks
- **`/src/utils/`** - Utility functions

### Development Guidelines

1. **TypeScript**: Strict mode enabled. Always maintain type safety.
2. **State Management**: Use the sceneStore for all global state. Never modify Babylon meshes directly without updating store.
3. **3D Operations**: Always go through SceneManager for Babylon.js operations.
4. **Component Size**: Be aware that App.tsx is monolithic (2000+ lines). Consider extracting logic when adding features.
5. **AI Integration**: AI commands must follow the structured format defined in ai.service.ts.

### Common Tasks

**Adding a new 3D primitive:**
1. Add creation method to `ObjectFactory`
2. Add action to `sceneStore`
3. Add UI control in toolbar/sidebar
4. Update AI service if it should be accessible via natural language

**Modifying scene behavior:**
1. Update relevant methods in `SceneManager`
2. Ensure state synchronization in `sceneStore`
3. Update undo/redo middleware if operation should be undoable

**Adding UI components:**
1. Create component in appropriate `/src/components/` subdirectory
2. Follow existing patterns for styling and state management
3. Use Zustand store for global state, local state for component-specific data

### Critical Files to Understand
- `App.tsx:306-500` - Main rendering and scene setup
- `sceneStore.ts:1-100` - Core state structure
- `SceneManager.ts:50-200` - Scene initialization and mesh management
- `ai.service.ts:20-100` - AI command structure and parsing