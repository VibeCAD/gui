# Tasks Checklist

## Phase 1: Firebase & Google Cloud Setup
- [x] Create Firebase project in Firebase Console
- [x] Enable Firebase Authentication service
- [x] Enable Cloud Firestore database
- [x] Enable Cloud Storage service
- [x] Enable Gemini API in Google Cloud Console
- [x] Enable Cloud Secret Manager API
- [x] Create Cloud Storage bucket for 3D models
- [x] Set up billing (required for Cloud Functions)

## Phase 2: Authentication Implementation
- [x] Install Firebase SDK: `npm install firebase`
- [x] Create Firebase configuration file
- [x] Initialize Firebase app in main.tsx
- [x] Replace API key input with Firebase Auth
- [x] Implement login/logout UI components
- [x] Add Google Sign-In provider
- [x] Create user profile in Firestore on first login
- [x] Update App.tsx to use Firebase user context

## Phase 3: Cloud Functions & Backend Logic
- [x] Install Firebase CLI: `npm install -g firebase-tools`
- [x] Initialize Cloud Functions: `firebase init functions`
- [x] Create `processScene` callable function (using OpenAI for now)
- [x] Store OpenAI API key in Secret Manager
- [x] Implement OpenAI API call logic
- [ ] Handle .glb file processing (future: Gemini integration)
- [x] Add error handling and retry logic
- [x] Deploy Cloud Functions successfully
- [x] Update frontend to use Cloud Functions instead of direct OpenAI calls
- [ ] Set up local emulator for testing

## Phase 4: Firestore Integration
- [x] Design Firestore collections schema
- [x] Create `users` collection structure
- [x] Create `generations` collection structure
- [x] Implement Firestore security rules
- [x] Add real-time listeners in React
- [x] Replace local state with Firestore documents
- [x] Implement generation status tracking
- [x] Add generation history feature
- [x] Create `savedScenes` collection for save/load functionality
- [x] Add security rules for savedScenes
- [x] Deploy Firestore indexes

## Phase 5: Cloud Storage Setup
- [x] Configure Storage security rules
- [ ] Implement .glb file upload from Cloud Function
- [ ] Generate public URLs for models
- [ ] Add thumbnail generation (optional)
- [ ] Implement file naming convention
- [ ] Set up CDN for model delivery
- [ ] Add storage quota management
- [ ] Clean up old/unused files policy

## Phase 6: UI Updates & Real-time Features
- [x] Remove OpenAI direct integration from frontend
- [x] Update AI sidebar to call Cloud Function
- [x] Add loading states for generation
- [x] Implement real-time status updates
- [x] Add generation history sidebar
- [x] Create user profile page
- [x] Add error notifications (basic implementation)
- [ ] Implement model gallery view
- [x] Add save/load scene functionality
- [x] Create load scene dialog

## Phase 7: Deployment & Production Setup
- [x] Deploy Firestore security rules
- [x] Deploy Storage security rules  
- [x] Deploy Cloud Functions
- [ ] Set up Firebase Hosting
- [ ] Configure custom domain (optional)
- [ ] Set up monitoring and alerts
- [ ] Implement usage quotas
- [ ] Add analytics tracking

## Migration Tasks (Current � New Architecture)
- [ ] Backup current local implementation
- [ ] Document breaking changes
- [ ] Create migration script for existing users
- [ ] Update environment variables
- [ ] Remove hardcoded API keys
- [ ] Update build configuration
- [ ] Test all existing features
- [ ] Update documentation

## Post-Launch Tasks
- [ ] Monitor performance metrics
- [ ] Optimize Cloud Function cold starts
- [ ] Implement caching strategy
- [ ] Add user feedback mechanism
- [ ] Create admin dashboard
- [ ] Set up automated backups
- [ ] Plan scaling strategy
- [ ] Document API limits and quotas