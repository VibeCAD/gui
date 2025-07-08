#!/bin/bash

echo "🚀 Starting Firebase Emulators for VibeCAD..."
echo ""
echo "⚠️  Note: Java 11+ is required for Firebase emulators to work."
echo "   Current Java version:"
java -version 2>&1 | head -n 1
echo ""
echo "If you see Java 8 or lower, please install Java 11+ first:"
echo "  - macOS: brew install openjdk@11"
echo "  - Ubuntu/Debian: sudo apt install openjdk-11-jdk"
echo "  - Windows: Download from https://adoptium.net/"
echo ""
echo "Starting emulators..."
echo ""

firebase emulators:start

# If emulators fail due to Java version, provide helpful message
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Emulators failed to start. Please ensure:"
    echo "   1. Java 11+ is installed"
    echo "   2. Firebase CLI is installed (npm install -g firebase-tools)"
    echo "   3. You're in the correct directory (gui/)"
    echo ""
    echo "To run without emulators, set VITE_USE_FIREBASE_EMULATORS=false in .env.local"
fi