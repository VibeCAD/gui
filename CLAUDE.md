# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VibeCAD is a browser-based 3D CAD application built with React, TypeScript, and Babylon.js. It features AI-powered scene manipulation through natural language commands using the OpenAI API.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (port 5173)
npm run dev

# Run linter
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

### Single-File Application
The entire application logic is contained in `src/App.tsx` (1200+ lines). This monolithic structure includes:
- 3D scene management
- UI components (toolbar, sidebars)
- State management
- AI integration
- Event handlers

### Key Technologies
- **React 19.1.0**: UI framework
- **TypeScript 5.8.3**: Type safety
- **Babylon.js 8.15.1**: 3D rendering engine
- **OpenAI API 5.8.2**: Natural language scene manipulation
- **Vite 7.0.0**: Build tool

### Core Concepts

1. **Scene Objects**: Managed through the `SceneObject` interface:
   ```typescript
   interface SceneObject {
     id: string
     type: string
     position: Vector3
     scale: Vector3
     rotation: Vector3
     color: string
     mesh?: Mesh
   }
   ```

2. **Transform Modes**: `select`, `move`, `rotate`, `scale`

3. **Primitive Types**: `cube`, `sphere`, `cylinder`, `plane`, `torus`, `cone`

4. **State Management**: Uses React hooks (useState, useRef, useEffect) for all state

5. **Gizmo System**: Babylon.js GizmoManager for 3D manipulation

### UI Structure
- **Top Toolbar**: Dropdown menus for Transform, Create, Material, Edit, and View operations
- **Left Sidebar**: Object hierarchy display
- **Right Sidebar**: AI command interface (collapsible)
- **Center Canvas**: 3D viewport

### AI Integration
- Requires OpenAI API key
- Processes natural language commands to manipulate 3D scene
- Commands interpreted through GPT-4 to generate scene modifications

## Important Patterns

1. **Mesh Creation**: All primitives created through Babylon.js MeshBuilder
2. **Material Management**: StandardMaterial with color presets
3. **Selection System**: Click-to-select with visual feedback
4. **Camera Controls**: ArcRotateCamera with preset views
5. **Event Handling**: Babylon.js PointerEventTypes for interaction

## No Testing Framework

Currently no tests are configured. To add testing, you would need to:
1. Install a test runner (e.g., Vitest)
2. Configure test environment for Babylon.js
3. Add test scripts to package.json

## Code Style

- TypeScript strict mode enabled
- ESLint configured for React + TypeScript
- No specific formatter configured (consider adding Prettier)
- React functional components with hooks
- Inline styles and CSS classes mixed

## Common Tasks

### Adding a New Primitive Type
1. Add to `PrimitiveType` type definition
2. Add creation logic in `createPrimitive` function
3. Add menu item in Create dropdown

### Adding a New Tool/Feature
1. Add state management hooks
2. Add toolbar menu item
3. Implement feature logic in main component
4. Update event handlers as needed

### Modifying AI Behavior
1. Locate `processWithAI` function
2. Modify system prompt or parsing logic
3. Update object manipulation based on AI response