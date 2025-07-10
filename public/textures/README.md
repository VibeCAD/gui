# Default Textures Directory

This directory contains the default textures that are available to all users of vibeCAD.

## Directory Structure

```
textures/
├── wood/          # Wood textures (floors, panels, etc.)
├── fabric/        # Fabric textures (carpets, upholstery, etc.)
├── brick/         # Brick and masonry textures
└── README.md      # This file
```

## Adding New Default Textures

1. Place your texture image files in the appropriate category folder
2. Use descriptive filenames (e.g., `wood-floor-light-oak.jpg`)
3. Recommended formats: JPG, PNG, WebP
4. Recommended dimensions: 1024x1024 or 2048x2048 (power of 2)
5. Keep file sizes reasonable (< 2MB per texture)
6. Update `src/config/defaultTextures.ts` to register the new texture

## Texture Naming Convention

- Use lowercase with hyphens: `material-type-variant.jpg`
- Examples:
  - `wood-floor-dark-walnut.jpg`
  - `brick-wall-red-classic.jpg`
  - `carpet-gray-weave.jpg`

## Required Texture Files

Based on the configuration in `src/config/defaultTextures.ts`, the following texture files should be added:

### Wood Textures (/textures/wood/)
- `wood-floor-natural.jpg` - Natural wood floor texture

### Fabric Textures (/textures/fabric/)
- `carpet-gray-textured.jpg` - Gray textured carpet

### Brick Textures (/textures/brick/)
- `brick-wall-red-standard.jpg` - Standard red brick wall

## License Notes

Ensure all textures added here are either:
1. Created by you
2. Licensed for commercial use
3. Public domain
4. Have appropriate attribution in this README

## Current Texture Attributions

[Add attribution information for any third-party textures here] 