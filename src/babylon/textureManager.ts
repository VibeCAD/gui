import { Scene, Texture, StandardMaterial, PBRMaterial, BaseTexture } from 'babylonjs';
import type { TextureAsset, TextureType } from '../types/types';

/**
 * TextureManager handles loading, caching, and application of textures in the Babylon.js scene
 */
export class TextureManager {
    private scene: Scene;
    private loadedTextures: Map<string, Texture>;
    private textureReferences: Map<string, number>; // Reference counting for cleanup
    
    constructor(scene: Scene) {
        this.scene = scene;
        this.loadedTextures = new Map();
        this.textureReferences = new Map();
    }
    
    /**
     * Validates a texture file before loading
     */
    validateTextureFile(file: File): { valid: boolean; error?: string } {
        // Check file size (10MB limit)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            return { 
                valid: false, 
                error: `File size exceeds 10MB limit (${(file.size / (1024 * 1024)).toFixed(2)}MB)` 
            };
        }
        
        // Check file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            const extension = file.name.split('.').pop()?.toLowerCase() || '';
            const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
            
            if (!validExtensions.includes(extension)) {
                return { 
                    valid: false, 
                    error: 'Invalid file format. Supported formats: JPG, PNG, WebP' 
                };
            }
        }
        
        return { valid: true };
    }
    
    /**
     * Loads a texture from a File object
     */
    async loadTextureFromFile(file: File): Promise<TextureAsset> {
        // Validate file first
        const validation = this.validateTextureFile(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        
        // Create object URL for the file
        const url = URL.createObjectURL(file);
        
        try {
            // Load image to get dimensions
            const img = new Image();
            const loadPromise = new Promise<{ width: number; height: number }>((resolve, reject) => {
                img.onload = () => {
                    resolve({ width: img.width, height: img.height });
                };
                img.onerror = () => {
                    reject(new Error('Failed to load image'));
                };
            });
            
            img.src = url;
            const dimensions = await loadPromise;
            
            // Check texture dimensions
            const maxDimension = 4096;
            if (dimensions.width > maxDimension || dimensions.height > maxDimension) {
                URL.revokeObjectURL(url);
                throw new Error(`Texture dimensions exceed ${maxDimension}x${maxDimension} pixels`);
            }
            
            // Warn about non-power-of-two textures
            if (!this.isPowerOfTwo(dimensions.width) || !this.isPowerOfTwo(dimensions.height)) {
                console.warn('Texture dimensions are not power of two. This may cause issues on some devices.');
            }
            
            // Create texture asset
            const textureAsset: TextureAsset = {
                id: '', // Will be set by the store
                name: file.name,
                url: url,
                type: 'diffuse', // Default type
                fileSize: file.size,
                dimensions: dimensions,
                uploadedAt: Date.now()
            };
            
            return textureAsset;
        } catch (error) {
            // Clean up URL on error
            URL.revokeObjectURL(url);
            throw error;
        }
    }
    
    /**
     * Creates a Babylon.js texture from a TextureAsset
     */
    createBabylonTexture(textureAsset: TextureAsset): Texture {
        console.log('🔨 TextureManager.createBabylonTexture called with:', {
            id: textureAsset.id,
            name: textureAsset.name,
            url: textureAsset.url
        });
        
        // Check if texture is already loaded
        const cached = this.loadedTextures.get(textureAsset.id);
        if (cached) {
            console.log('📦 Returning cached texture:', textureAsset.id);
            this.incrementReference(textureAsset.id);
            return cached;
        }
        
        console.log('🆕 Creating new texture for:', textureAsset.name);
        
        // Create new texture
        const texture = new Texture(
            textureAsset.url,
            this.scene,
            false, // noMipmap - we'll use mipmaps for better quality
            true,  // invertY - required for most textures
            Texture.TRILINEAR_SAMPLINGMODE // Best quality sampling
        );
        
        // Set texture properties
        texture.name = textureAsset.name;
        texture.wrapU = Texture.WRAP_ADDRESSMODE;
        texture.wrapV = Texture.WRAP_ADDRESSMODE;
        
        // Add event handlers for debugging
        texture.onLoadObservable.add(() => {
            console.log('✅ Texture loaded successfully:', textureAsset.name);
        });
        
        // Cache the texture
        this.loadedTextures.set(textureAsset.id, texture);
        this.incrementReference(textureAsset.id);
        
        console.log('📌 Texture cached with ID:', textureAsset.id);
        
        return texture;
    }
    
    /**
     * Applies a diffuse texture to a material
     */
    applyDiffuseTexture(material: StandardMaterial | PBRMaterial, texture: Texture): void {
        if (material instanceof StandardMaterial) {
            material.diffuseTexture = texture;
        } else if (material instanceof PBRMaterial) {
            material.albedoTexture = texture;
        }
    }
    
    /**
     * Applies a normal texture to a material
     */
    applyNormalTexture(material: StandardMaterial | PBRMaterial, texture: Texture): void {
        if (material instanceof StandardMaterial) {
            material.bumpTexture = texture;
        } else if (material instanceof PBRMaterial) {
            material.bumpTexture = texture;
        }
    }
    
    /**
     * Applies a specular texture to a material
     */
    applySpecularTexture(material: StandardMaterial | PBRMaterial, texture: Texture): void {
        if (material instanceof StandardMaterial) {
            material.specularTexture = texture;
        } else if (material instanceof PBRMaterial) {
            material.reflectivityTexture = texture;
        }
    }
    
    /**
     * Applies an emissive texture to a material
     */
    applyEmissiveTexture(material: StandardMaterial | PBRMaterial, texture: Texture): void {
        if (material instanceof StandardMaterial) {
            material.emissiveTexture = texture;
        } else if (material instanceof PBRMaterial) {
            material.emissiveTexture = texture;
        }
    }
    
    /**
     * Sets texture scale on a texture
     */
    setTextureScale(texture: Texture, scale: { u: number; v: number }): void {
        texture.uScale = scale.u;
        texture.vScale = scale.v;
    }
    
    /**
     * Sets texture offset on a texture
     */
    setTextureOffset(texture: Texture, offset: { u: number; v: number }): void {
        texture.uOffset = offset.u;
        texture.vOffset = offset.v;
    }
    
    /**
     * Disposes a texture and cleans up resources
     */
    disposeTexture(textureId: string): void {
        this.decrementReference(textureId);
        
        // Only dispose if no more references
        const refCount = this.textureReferences.get(textureId) || 0;
        if (refCount <= 0) {
            const texture = this.loadedTextures.get(textureId);
            if (texture) {
                // Revoke object URL if it exists
                const url = texture.url;
                if (url && url.startsWith('blob:')) {
                    URL.revokeObjectURL(url);
                }
                
                // Dispose the texture
                texture.dispose();
                
                // Remove from cache
                this.loadedTextures.delete(textureId);
                this.textureReferences.delete(textureId);
            }
        }
    }
    
    /**
     * Clears all texture cache and disposes resources
     */
    clearTextureCache(): void {
        this.loadedTextures.forEach((texture, id) => {
            // Revoke object URL if it exists
            const url = texture.url;
            if (url && url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
            
            // Dispose the texture
            texture.dispose();
        });
        
        this.loadedTextures.clear();
        this.textureReferences.clear();
    }
    
    /**
     * Gets a texture from cache
     */
    getTextureFromCache(textureId: string): Texture | null {
        return this.loadedTextures.get(textureId) || null;
    }
    
    /**
     * Generates a unique texture ID
     */
    generateTextureId(): string {
        return `texture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Gets the current texture memory usage estimate
     */
    getTextureMemoryUsage(): number {
        let totalBytes = 0;
        
        this.loadedTextures.forEach((texture) => {
            // Estimate based on texture dimensions and format
            // Assuming RGBA format (4 bytes per pixel)
            const width = texture.getSize().width;
            const height = texture.getSize().height;
            const bytesPerPixel = 4;
            
            // Include mipmap memory (roughly 1.33x the base texture)
            const mipmapMultiplier = texture.noMipmap ? 1 : 1.33;
            
            totalBytes += width * height * bytesPerPixel * mipmapMultiplier;
        });
        
        return totalBytes;
    }
    
    /**
     * Checks if a number is a power of two
     */
    private isPowerOfTwo(n: number): boolean {
        return n > 0 && (n & (n - 1)) === 0;
    }
    
    /**
     * Increments reference count for a texture
     */
    private incrementReference(textureId: string): void {
        const current = this.textureReferences.get(textureId) || 0;
        this.textureReferences.set(textureId, current + 1);
    }
    
    /**
     * Decrements reference count for a texture
     */
    private decrementReference(textureId: string): void {
        const current = this.textureReferences.get(textureId) || 0;
        this.textureReferences.set(textureId, Math.max(0, current - 1));
    }
}

/**
 * Factory function to create a TextureManager instance
 */
export function createTextureManager(scene: Scene): TextureManager {
    return new TextureManager(scene);
} 