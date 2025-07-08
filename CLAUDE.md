# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VibeCAD is a browser-based 3D CAD application built with React, TypeScript, and Babylon.js. The project is transitioning from direct OpenAI API calls to a Firebase-based architecture with plans for Gemini integration to generate actual 3D models (.glb files) from text prompts.

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

# Firebase Deployment
firebase deploy            # Deploy to Firebase (functions, rules, etc.)
```

### Development Setup (Without Emulators)

**Recommended for Quick Start:**
1. Copy `.env.local.example` to `.env.local`
2. Add your Firebase configuration values
3. Set `VITE_USE_FIREBASE_EMULATORS=false`
4. Run `npm run dev`

This approach uses your production Firebase services directly. Be mindful of:
- API usage costs
- Test data in production
- Rate limits

### Firebase Emulator Setup (Optional)

**Note:** Emulators require Java 11+ and are optional for development.

**Prerequisites:**
- Java 11+ (check with `java -version`)
- To install: `brew install openjdk@11` (macOS)

**If you want to use emulators:**
1. Set `VITE_USE_FIREBASE_EMULATORS=true` in `.env.local`
2. Run `npm run emulators` in one terminal
3. Run `npm run dev` in another terminal

**Emulator Benefits:**
- No API costs during development
- Isolated test environment
- Faster local testing

**Emulator Commands:**
```bash
npm run emulators          # Start Firebase emulators
npm run dev:emulators      # Start emulators + dev server together
```

## Architecture

### Current Architecture Transition

The project is migrating from a simple client-side application to a full-stack Firebase-powered system:

1. **Authentication**: Firebase Auth (Google Sign-In + Email/Password)
2. **Database**: Cloud Firestore for metadata and user data
3. **Storage**: Google Cloud Storage for 3D model files
4. **Backend**: Cloud Functions for secure API operations
5. **Secrets**: Google Secret Manager for API keys

### Single-File Frontend Application

The entire frontend logic is contained in `src/App.tsx` (1200+ lines). This monolithic structure includes:
- 3D scene management with Babylon.js
- UI components (toolbar, sidebars)
- State management with React hooks
- Firebase authentication integration
- Cloud Function calls for AI processing

### Key Technologies

- **React 19.1.0**: UI framework
- **TypeScript 5.8.3**: Type safety with strict mode
- **Babylon.js 8.15.1**: 3D rendering engine
- **Firebase SDK 11.2.0**: Auth, Firestore, Functions, Storage
- **Vite 7.0.0**: Build tool

### Core Data Models

```typescript
// Scene Object Interface
interface SceneObject {
  id: string
  type: string
  position: Vector3
  scale: Vector3
  rotation: Vector3
  color: string
  mesh?: Mesh
}

// Firestore Collections
// /users/{uid} - User profiles with API key storage
// /generations/{generationId} - AI generation history and metadata
```

### Firebase Integration Pattern

1. User authenticates via Firebase Auth
2. Frontend calls Cloud Functions (never direct API calls)
3. Cloud Functions handle Gemini/OpenAI API calls securely
4. Results stored in Firestore with real-time updates
5. 3D models stored in Google Cloud Storage

## Important Patterns

1. **Authentication Flow**: Check auth state before any Firebase operations
2. **Cloud Function Calls**: Use `httpsCallable` for type-safe function invocation
3. **Real-time Updates**: Use Firestore listeners for generation status
4. **Error Handling**: Always handle auth errors and function failures gracefully
5. **Mesh Creation**: All primitives created through Babylon.js MeshBuilder
6. **Transform Modes**: `select`, `move`, `rotate`, `scale`
7. **Security**: Never expose API keys client-side, use Cloud Functions

## Project Structure

```
gui/
├── src/
│   └── App.tsx           # Main application (monolithic)
├── functions/            # Cloud Functions directory
│   ├── src/
│   │   └── index.ts     # Backend functions
│   └── package.json     # Separate Node.js project
├── firebase.json        # Firebase configuration
├── firestore.rules      # Database security rules
└── storage.rules        # File storage rules
```

## Common Development Tasks

### Running Local Development

```bash
# Terminal 1: Start Firebase emulators
firebase emulators:start

# Terminal 2: Start Vite dev server
npm run dev
```

### Adding a New Cloud Function

1. Edit `functions/src/index.ts`
2. Export a new `https.onCall` function
3. Deploy with `firebase deploy --only functions:functionName`

### Modifying Firestore Security Rules

1. Edit `firestore.rules`
2. Test with emulators first
3. Deploy with `firebase deploy --only firestore:rules`

### Working with Authentication

```typescript
// Check auth state
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in
  }
});

// Call a Cloud Function
const generateModel = httpsCallable(functions, 'generateModel');
const result = await generateModel({ prompt: "..." });
```

## Testing Status

Currently no automated tests. The project prioritizes rapid feature development. When adding tests:
1. Install Vitest for unit tests
2. Configure test environment for Babylon.js mocking
3. Use Firebase emulators for integration tests

## Next Development Priorities

1. Complete Firebase emulator setup for local development
2. Implement real-time Firestore listeners for generation status
3. Add generation history sidebar
4. Improve loading states and error handling
5. Begin Gemini API integration for actual 3D model generation

## Important Notes

- The `describeScene` function is critical - it will be reused for Gemini integration
- Always use Firebase emulators for local development to avoid costs
- Check `next-steps.md` for detailed current priorities
- Review `architecture.md` for the complete system design
- Current branch: `db` (feature branch for database integration)