import type { CollisionResolutionConfig } from '../types/types';

/**
 * Default configuration for collision resolution
 */
export const DEFAULT_COLLISION_CONFIG: CollisionResolutionConfig = {
  // Enable collision resolution by default
  enabled: true,
  
  // Search pattern parameters
  searchStepSize: 0.5,           // Units to move in each search step
  maxSearchDistance: 10,         // Maximum distance to search from original position
  searchPattern: 'spiral',       // Default to spiral pattern (most efficient for nearby positions)
  
  // Vertical search options
  searchVertical: true,          // Allow searching up/down for valid positions
  verticalStepSize: 0.5,         // Step size for vertical search
  resolutionPriority: 'horizontal', // Try horizontal positions first
  
  // Collision filtering
  excludeTypes: ['ground', 'floor', 'foundation'], // Object types to ignore during collision checks
  
  // Grid snapping
  respectGridSnap: true,         // Snap resolved positions to grid
  
  // Visual feedback
  animationDuration: 300         // Duration of position animation in milliseconds
};

/**
 * Preset configurations for different use cases
 */
export const COLLISION_PRESETS = {
  // Fast mode - larger steps, shorter distance
  fast: {
    searchStepSize: 1.0,
    maxSearchDistance: 5,
    animationDuration: 150
  } as Partial<CollisionResolutionConfig>,
  
  // Precise mode - smaller steps, longer distance
  precise: {
    searchStepSize: 0.25,
    maxSearchDistance: 15,
    animationDuration: 500
  } as Partial<CollisionResolutionConfig>,
  
  // Stack mode - prioritize vertical placement
  stack: {
    searchVertical: true,
    resolutionPriority: 'vertical',
    verticalStepSize: 0.1
  } as Partial<CollisionResolutionConfig>,
  
  // Dense placement - grid pattern for tight packing
  dense: {
    searchPattern: 'grid',
    searchStepSize: 0.5,
    respectGridSnap: true
  } as Partial<CollisionResolutionConfig>,
  
  // Performance mode - minimal checks
  performance: {
    searchStepSize: 2.0,
    maxSearchDistance: 3,
    searchVertical: false,
    animationDuration: 0
  } as Partial<CollisionResolutionConfig>
};

/**
 * Merge configuration with defaults
 * @param config Partial configuration to merge
 * @returns Complete configuration with defaults
 */
export function mergeCollisionConfig(
  config?: Partial<CollisionResolutionConfig>
): CollisionResolutionConfig {
  return {
    ...DEFAULT_COLLISION_CONFIG,
    ...config
  };
}

/**
 * Apply a preset configuration
 * @param presetName Name of the preset
 * @param additionalConfig Additional configuration to merge
 * @returns Complete configuration with preset and additional settings
 */
export function applyCollisionPreset(
  presetName: keyof typeof COLLISION_PRESETS,
  additionalConfig?: Partial<CollisionResolutionConfig>
): CollisionResolutionConfig {
  return {
    ...DEFAULT_COLLISION_CONFIG,
    ...COLLISION_PRESETS[presetName],
    ...additionalConfig
  };
}

/**
 * Validate configuration values
 * @param config Configuration to validate
 * @returns Validated configuration with corrected values
 */
export function validateCollisionConfig(
  config: CollisionResolutionConfig
): CollisionResolutionConfig {
  const validated = { ...config };
  
  // Ensure positive values
  validated.searchStepSize = Math.max(0.1, validated.searchStepSize);
  validated.maxSearchDistance = Math.max(1, validated.maxSearchDistance);
  validated.verticalStepSize = Math.max(0.1, validated.verticalStepSize);
  validated.animationDuration = Math.max(0, validated.animationDuration);
  
  // Ensure valid search pattern
  const validPatterns = ['spiral', 'grid', 'radial'];
  if (!validPatterns.includes(validated.searchPattern)) {
    validated.searchPattern = 'spiral';
  }
  
  // Ensure valid resolution priority
  const validPriorities = ['horizontal', 'vertical', 'nearest'];
  if (!validPriorities.includes(validated.resolutionPriority)) {
    validated.resolutionPriority = 'horizontal';
  }
  
  return validated;
} 