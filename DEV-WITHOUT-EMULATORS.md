# Development Without Firebase Emulators

This guide helps you develop VibeCAD without needing to install Java 11+ for Firebase emulators.

## Quick Start

1. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   ```
   Edit `.env.local` and add your Firebase configuration values.

2. **Disable emulators**
   In `.env.local`, ensure:
   ```
   VITE_USE_FIREBASE_EMULATORS=false
   ```

3. **Start development**
   ```bash
   npm run dev
   ```

## Best Practices for Production Firebase Development

### 1. Use a Separate Development Project
Consider creating a separate Firebase project for development:
- Go to [Firebase Console](https://console.firebase.google.com)
- Create a new project (e.g., "vibecad-dev")
- Use those credentials in your `.env.local`

### 2. Create Test User Accounts
- Use test email addresses (e.g., test1@example.com)
- Keep test accounts separate from real user accounts
- Document test account credentials securely

### 3. Prefix Test Data
When creating test data in Firestore:
```javascript
// Add a prefix to test documents
const testGeneration = {
  userId: user.uid,
  prompt: "[TEST] Create a gear",
  // ... other fields
};
```

### 4. Monitor Usage
- Check Firebase Console regularly for usage
- Set up budget alerts in Google Cloud Console
- Monitor Firestore reads/writes

### 5. Clean Up Test Data
Periodically clean up test data:
```bash
# Use Firebase Console or create a cleanup script
firebase firestore:delete generations --where userId == "test-user-id"
```

## Common Development Tasks

### Testing Authentication
1. Use incognito/private browser windows
2. Test with multiple test accounts
3. Clear browser data between tests if needed

### Testing Cloud Functions
- Functions will run in production
- Check function logs in Firebase Console
- Use descriptive test prompts to identify test runs

### Testing Firestore
- Use Firebase Console to view/edit data
- Create minimal test documents
- Delete test data after testing

## Troubleshooting

### "Permission Denied" Errors
- Check Firestore security rules
- Ensure user is authenticated
- Verify document ownership rules

### Cloud Function Errors
- Check Firebase Console > Functions > Logs
- Verify API keys in Secret Manager
- Check function deployment status

### Performance Issues
- Production services may be slower than emulators
- Consider implementing caching
- Batch Firestore operations when possible

## When to Use Emulators

Consider setting up Java 11+ and using emulators when:
- Working with sensitive production data
- Needing to test security rules extensively
- Developing offline functionality
- Running automated tests
- Working in a team (consistent environment)

## Environment Variables Reference

```bash
# Required Firebase Config
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...

# Development Options
VITE_USE_FIREBASE_EMULATORS=false  # Keep this false to skip emulators
```