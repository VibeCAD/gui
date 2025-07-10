# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VibeCAD is a 3D CAD/modeling application with AI-powered natural language scene manipulation. Built with React, TypeScript, and Babylon.js, it enables users to create and modify 3D scenes through both traditional GUI and conversational AI commands.

## Development Commands

```bash
npm run dev      # Start development server (Vite)
npm run build    # TypeScript check + production build
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

## Architecture

### Core Technologies
- **Frontend**: React 19.1 + TypeScript
- **3D Engine**: Babylon.js 8.15.1
- **State Management**: Zustand 5.0.6
- **AI Integration**: OpenAI API (GPT-3.5-turbo)
- **Build Tool**: Vite 7.0

### Key Architectural Patterns

1. **State Management Flow**
   ```
   AI Command → SceneCommand → Store Action → Scene Update → React Re-render
   ```

2. **3D Object Lifecycle**
   - Creation: `objectFactory.ts` creates Babylon.js meshes
   - Management: `SceneManager` class handles mesh lifecycle
   - React Integration: `useBabylonScene` hook bridges React and Babylon.js
   - Transformation: Gizmo system for move/rotate/scale

3. **Composite Object Pattern**
   - Complex objects (e.g., walls with doors) store metadata
   - Parameters drive mesh regeneration
   - CSG operations for boolean geometry

### Directory Structure
```
/src
  /ai            # AIService class for natural language processing
  /babylon       # Scene management, factories, gizmo system
    /hooks       # React hooks for 3D integration
  /components    # React UI components
    /sidebar     # AI chat, scene graph, properties panel
  /state         # Zustand store (sceneStore.ts)
  /types         # TypeScript definitions
```

## Key Implementation Details

### AI Command Processing
The AI system translates natural language into structured `SceneCommand` objects:
- Commands: create, move, scale, rotate, color, delete
- Target selection by name or "selected"
- Scene context awareness for accurate targeting

### Parametric Design
All geometry is parameter-driven:
- Non-destructive editing
- Dynamic mesh regeneration
- Metadata preservation for complex objects

### Import System
Supports GLB, STL, OBJ (5MB limit):
- Materials stripped for consistency
- Meshes merged into single object
- Integrated with existing scene management

### CSG Operations
Boolean operations using CSG2:
- Wall with door cutout implementation
- Deferred updates for performance
- Metadata-driven regeneration

## Common Development Tasks

### Adding New Object Types
1. Add creation function to `objectFactory.ts`
2. Update `SceneCommand` type if needed
3. Add AI command recognition in `AIService`

### Implementing New Transformations
1. Check if gizmo system supports it
2. For complex transformations, update object metadata
3. Implement regeneration logic for composite objects

### Working with Composite Objects
- Always preserve metadata when transforming
- Use deferred updates for performance
- Regenerate mesh from parameters, don't modify directly

## Important Conventions

- **Naming**: Mesh names should be descriptive for AI targeting
- **Metadata**: Store all parameters needed for regeneration
- **State Updates**: Always go through Zustand store
- **Error Handling**: AI commands should fail gracefully with user feedback