import type { TextureAsset } from '../types/types';

/**
 * Default texture configurations that ship with the application
 * These textures are stored in the public/textures directory and are available to all users
 */

export interface DefaultTextureConfig {
  id: string;
  name: string;
  category: 'wood' | 'fabric' | 'brick' | 'metal' | 'concrete' | 'other';
  filename: string; // Filename in public/textures/{category}/
  type: 'diffuse';
  tags: string[]; // For search/filtering
}

export const DEFAULT_TEXTURES: DefaultTextureConfig[] = [
  // Wood textures
  {
    id: 'default-wood-floor-01',
    name: 'Wood Floor - Natural',
    category: 'wood',
    filename: 'wood-floor-natural.jpg',
    type: 'diffuse',
    tags: ['floor', 'wood', 'planks', 'natural', 'hardwood']
  },
  
  // Fabric textures
  {
    id: 'default-fabric-carpet-01',
    name: 'Carpet - Gray Textured',
    category: 'fabric',
    filename: 'carpet-gray-textured.jpg',
    type: 'diffuse',
    tags: ['carpet', 'fabric', 'gray', 'floor', 'textile', 'woven']
  },
  
  // Brick textures
  {
    id: 'default-brick-wall-01',
    name: 'Brick Wall - Red Standard',
    category: 'brick',
    filename: 'brick-wall-red-standard.jpg',
    type: 'diffuse',
    tags: ['brick', 'wall', 'red', 'masonry', 'exterior', 'classic']
  }
];

/**
 * Converts a default texture config to a TextureAsset
 * Note: dimensions will be set after the texture loads
 */
export function defaultTextureToAsset(config: DefaultTextureConfig): TextureAsset {
  const url = `/textures/${config.category}/${config.filename}`;
  
  return {
    id: config.id,
    name: config.name,
    url: url,
    type: config.type,
    fileSize: 0, // Will be updated when loaded
    dimensions: { width: 0, height: 0 }, // Will be updated when loaded
    uploadedAt: 0 // Default textures don't have upload time
  };
}

/**
 * Get all default textures as TextureAssets
 */
export function getAllDefaultTextures(): TextureAsset[] {
  return DEFAULT_TEXTURES.map(defaultTextureToAsset);
}

/**
 * Get default textures by category
 */
export function getDefaultTexturesByCategory(category: string): TextureAsset[] {
  return DEFAULT_TEXTURES
    .filter(t => t.category === category)
    .map(defaultTextureToAsset);
}

/**
 * Search default textures by tags
 */
export function searchDefaultTextures(searchTerm: string): TextureAsset[] {
  const term = searchTerm.toLowerCase();
  return DEFAULT_TEXTURES
    .filter(t => 
      t.name.toLowerCase().includes(term) ||
      t.tags.some(tag => tag.toLowerCase().includes(term))
    )
    .map(defaultTextureToAsset);
} 