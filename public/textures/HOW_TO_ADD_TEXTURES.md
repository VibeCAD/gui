# How to Add Texture Files

To add the texture images you provided to vibeCAD:

## 1. Save the texture files

Place your texture images in the appropriate subdirectories:

- **Wood Floor Texture** → Save as `public/textures/wood/wood-floor-natural.jpg`
- **Gray Fabric/Carpet Texture** → Save as `public/textures/fabric/carpet-gray-textured.jpg`
- **Red Brick Wall Texture** → Save as `public/textures/brick/brick-wall-red-standard.jpg`

## 2. Verify the configuration

The textures are already configured in `src/config/defaultTextures.ts`. If you add more textures, update that file with the new texture information.

## 3. File naming guidelines

- Use lowercase with hyphens
- Be descriptive: `material-type-variant.jpg`
- Keep consistent naming patterns within categories

## 4. Image optimization

For best performance:
- Resize images to 1024x1024 or 2048x2048 (power of 2 dimensions)
- Compress JPGs to ~80% quality
- Keep file sizes under 2MB

## 5. Testing

After adding textures:
1. Start the development server: `npm run dev`
2. Open the application
3. Check the sidebar → Texture Library
4. You should see a "Default Textures" section with your textures

## Current Default Textures Expected

Based on the configuration, the following files should be present:

```
public/textures/
├── wood/
│   └── wood-floor-natural.jpg
├── fabric/
│   └── carpet-gray-textured.jpg
└── brick/
    └── brick-wall-red-standard.jpg
```

These are the only 3 default textures configured in the system, matching the images provided. 