import React, { useRef, useState, useCallback } from 'react';
import { useSceneStore } from '../../state/sceneStore';
import { createTextureManager } from '../../babylon/textureManager';
import type { TextureAsset } from '../../types/types';

interface TextureUploadProps {
    onUpload?: (textureAsset: TextureAsset) => void;
    maxFileSize?: number; // in bytes, default 10MB
    acceptedFormats?: string[];
    className?: string;
}

export const TextureUpload: React.FC<TextureUploadProps> = ({
    onUpload,
    maxFileSize = 10 * 1024 * 1024, // 10MB
    acceptedFormats = ['.jpg', '.jpeg', '.png', '.webp'],
    className = ''
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    
    const {
        isUploadingTexture,
        textureUploadError,
        setIsUploadingTexture,
        setTextureUploadError,
        uploadTexture,
        addTextureAsset,
        addToResponseLog
    } = useSceneStore();
    
    // Clear error after 5 seconds
    React.useEffect(() => {
        if (uploadError || textureUploadError) {
            const timer = setTimeout(() => {
                setUploadError(null);
                setTextureUploadError(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [uploadError, textureUploadError, setTextureUploadError]);
    
    const handleFile = async (file: File) => {
        setUploadError(null);
        setTextureUploadError(null);
        
        // Quick validation
        if (file.size > maxFileSize) {
            const error = `File too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB (max ${(maxFileSize / (1024 * 1024)).toFixed(0)}MB)`;
            setUploadError(error);
            return;
        }
        
        const extension = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!acceptedFormats.includes(extension)) {
            const error = `Invalid format. Accepted: ${acceptedFormats.join(', ')}`;
            setUploadError(error);
            return;
        }
        
        try {
            setIsUploadingTexture(true);
            
            // Create temporary texture manager for validation and processing
            // In real implementation, this would be passed from the scene
            const tempManager = {
                validateTextureFile: (file: File) => {
                    const maxSize = 10 * 1024 * 1024;
                    if (file.size > maxSize) {
                        return { valid: false, error: 'File too large' };
                    }
                    return { valid: true };
                },
                loadTextureFromFile: async (file: File): Promise<TextureAsset> => {
                    // Create preview
                    const url = URL.createObjectURL(file);
                    setPreview(url);
                    
                    // Get image dimensions
                    const img = new Image();
                    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
                        img.onload = () => resolve({ width: img.width, height: img.height });
                        img.onerror = () => reject(new Error('Failed to load image'));
                        img.src = url;
                    });
                    
                    const textureAsset: TextureAsset = {
                        id: `texture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: file.name,
                        url: url,
                        type: 'diffuse',
                        fileSize: file.size,
                        dimensions,
                        uploadedAt: Date.now()
                    };
                    
                    return textureAsset;
                }
            };
            
            // Validate file
            const validation = tempManager.validateTextureFile(file);
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            
            // Load texture
            const textureAsset = await tempManager.loadTextureFromFile(file);
            
            // Add to store
            addTextureAsset(textureAsset);
            addToResponseLog(`✅ Uploaded texture: ${file.name}`);
            
            // Call callback if provided
            if (onUpload) {
                onUpload(textureAsset);
            }
            
            // Clear preview after successful upload
            setTimeout(() => setPreview(null), 2000);
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Upload failed';
            setUploadError(errorMessage);
            setTextureUploadError(errorMessage);
            addToResponseLog(`❌ Texture upload failed: ${errorMessage}`);
        } finally {
            setIsUploadingTexture(false);
        }
    };
    
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            handleFile(file);
        }
        // Reset input
        event.target.value = '';
    };
    
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);
    
    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);
    
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        
        const file = e.dataTransfer.files[0];
        if (file) {
            handleFile(file);
        }
    }, []);
    
    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };
    
    const displayError = uploadError || textureUploadError;
    
    return (
        <div className={`texture-upload-container ${className}`}>
            <input
                ref={fileInputRef}
                type="file"
                accept={acceptedFormats.join(',')}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />
            
            <div
                className={`texture-upload-area ${isDragging ? 'dragging' : ''} ${isUploadingTexture ? 'uploading' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileInput}
            >
                {isUploadingTexture ? (
                    <div className="upload-progress">
                        <div className="spinner"></div>
                        <span>Uploading...</span>
                    </div>
                ) : preview ? (
                    <div className="preview-container">
                        <img src={preview} alt="Preview" className="texture-preview" />
                        <span className="upload-success">✓ Uploaded</span>
                    </div>
                ) : (
                    <div className="upload-prompt">
                        <span className="upload-icon">📁</span>
                        <span className="upload-text">
                            {isDragging ? 'Drop to upload' : 'Drop texture here or click to browse'}
                        </span>
                        <span className="upload-hint">
                            {acceptedFormats.join(', ')} • Max {(maxFileSize / (1024 * 1024)).toFixed(0)}MB
                        </span>
                    </div>
                )}
            </div>
            
            {displayError && (
                <div className="texture-upload-error">
                    <span className="error-icon">⚠️</span>
                    <span className="error-text">{displayError}</span>
                </div>
            )}
        </div>
    );
}; 