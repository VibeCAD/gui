# VibeCAD Flagship - AI Room Integration Project

## Project Overview
VibeCAD is a web-based text-to-CAD application that allows users to create 3D scenes through natural language commands. The current focus is on enhancing AI capabilities to handle room-aware object placement.

## Core Problem
Objects created via AI text commands don't get placed inside custom rooms properly. Users want to be able to say "move the chair into the room" and have the system:
1. Identify the target room
2. Move the object inside the room boundaries  
3. Snap the object to the room's grid floor
4. Ensure proper spatial positioning

## Key Technologies
- **Frontend**: React + TypeScript
- **3D Engine**: Babylon.js
- **AI**: OpenAI GPT-4o
- **State Management**: Zustand
- **Build Tool**: Vite

## Architecture
- `ai.service.ts` - Natural language processing and scene command generation
- `sceneManager.ts` - 3D scene management and object manipulation
- `boundaryUtils.ts` - Spatial boundary detection and calculations
- `gridTextureUtils.ts` - Grid snapping and room floor utilities
- `sceneStore.ts` - Application state management

## Custom Room System
Custom rooms are created via drawing tools and stored as `SceneObject` with:
- `type: 'custom-room'`
- `roomName: string` - User-defined room name
- `gridInfo` - Grid configuration for floor snapping

## Current Implementation Status
**Completed:**
- Enhanced AI room detection in scene descriptions
- Added 'inside' spatial relationship recognition
- Room name parsing from natural language

**In Progress:**
- Room boundary detection utilities
- Floor-level positioning logic

**Pending:**
- Grid snapping integration for AI commands
- Comprehensive room-aware placement system 