# Tasks Checklist

## Phase 1: Firebase & Google Cloud Setup
- [x] Create Firebase project in Firebase Console
- [x] Enable Firebase Authentication service
- [ ] Enable Cloud Firestore database
- [ ] Enable Cloud Storage service
- [ ] Enable Gemini API in Google Cloud Console
- [ ] Enable Cloud Secret Manager API
- [ ] Create Cloud Storage bucket for 3D models
- [ ] Set up billing (required for Cloud Functions)

## Phase 2: Authentication Implementation
- [x] Install Firebase SDK: `npm install firebase`
- [x] Create Firebase configuration file
- [x] Initialize Firebase app in main.tsx
- [x] Replace API key input with Firebase Auth
- [x] Implement login/logout UI components
- [x] Add Google Sign-In provider
- [ ] Create user profile in Firestore on first login
- [x] Update App.tsx to use Firebase user context

## Phase 3: Cloud Functions & Backend Logic
- [ ] Install Firebase CLI: `npm install -g firebase-tools`
- [ ] Initialize Cloud Functions: `firebase init functions`
- [ ] Create `generateModel` callable function
- [ ] Store Gemini API key in Secret Manager
- [ ] Implement Gemini API call logic
- [ ] Handle .glb file processing
- [ ] Add error handling and retry logic
- [ ] Set up local emulator for testing

## Phase 4: Firestore Integration
- [x] Design Firestore collections schema
- [x] Create `users` collection structure
- [x] Create `generations` collection structure
- [x] Implement Firestore security rules
- [ ] Add real-time listeners in React
- [ ] Replace local state with Firestore documents
- [ ] Implement generation status tracking
- [ ] Add generation history feature

## Phase 5: Cloud Storage Setup
- [ ] Configure Storage security rules
- [ ] Implement .glb file upload from Cloud Function
- [ ] Generate public URLs for models
- [ ] Add thumbnail generation (optional)
- [ ] Implement file naming convention
- [ ] Set up CDN for model delivery
- [ ] Add storage quota management
- [ ] Clean up old/unused files policy

## Phase 6: UI Updates & Real-time Features
- [ ] Remove OpenAI direct integration from frontend
- [ ] Update AI sidebar to call Cloud Function
- [ ] Add loading states for generation
- [ ] Implement real-time status updates
- [ ] Add generation history sidebar
- [ ] Create user profile page
- [ ] Add error notifications
- [ ] Implement model gallery view

## Phase 7: Deployment & Production Setup
- [ ] Deploy Firestore security rules
- [ ] Deploy Storage security rules
- [ ] Deploy Cloud Functions
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