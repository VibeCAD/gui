---
description: Best practices for checking and installing NPM packages before use
globs: **/*.{js,jsx,ts,tsx}, **/package.json
---

# NPM Package Check

// Description: Best practices for checking and installing NPM packages before use
// Recommended Globs: **/*.{js,jsx,ts,tsx}, **/package.json

## Overview
Ensure all required NPM packages are properly installed before use to prevent runtime errors.

## Package Check Process
1. Before requiring any npm package, check package.json dependencies
2. If package exists in dependencies:
   - Output: "✓ {package_name} is already installed"
3. If package NOT found:
   - Output terminal command: `npm install {package_name}`

## Example Implementation
```javascript
const fs = require('fs');
const path = require('path');

function checkPackage(packageName) {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
    );

    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    if (deps[packageName]) {
      console.log(`✓ ${packageName} is already installed`);
      return true;
    } else {
      console.log(`Installing ${packageName}...`);
      console.log(`Run: npm install ${packageName}`);
      return false;
    }
  } catch (error) {
    console.error('Error reading package.json:', error);
    return false;
  }
}
```

## Usage Example
```javascript
// Before importing a package
if (checkPackage('express')) {
  const express = require('express');
  // Use express...
} else {
  console.error('Please install express first');
  process.exit(1);
}
```

## Best Practices
- Always check packages before requiring them
- Handle missing package.json gracefully
- Consider both dependencies and devDependencies
- Provide clear installation instructions
- Exit gracefully if required packages are missing

## Common Patterns
- Pre-startup dependency check
- Dynamic package loading
- Development tooling setup
- Build process validation