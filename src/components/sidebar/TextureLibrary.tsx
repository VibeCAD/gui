import React, { useState, useMemo } from 'react';
import { useSceneStore } from '../../state/sceneStore';
import type { TextureAsset, TextureType } from '../../types/types';

interface TextureLibraryProps {
    onApply?: (textureId: string, textureType: TextureType) => void;
    className?: string;
}

export const TextureLibrary: React.FC<TextureLibraryProps> = ({
    onApply,
    className = ''
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTextureType, setSelectedTextureType] = useState<TextureType>('diffuse');
    const [renameTextureId, setRenameTextureId] = useState<string | null>(null);
    const [renameName, setRenameName] = useState('');
    
    const {
        textureAssets,
        selectedTextureId,
        selectedObjectId,
        selectedObjectIds,
        setSelectedTextureId,
        removeTextureAsset,
        renameTextureAsset,
        applyTextureToObject,
        addToResponseLog,
        hasSelection
    } = useSceneStore();
    
    // Convert Map to array and filter based on search
    const filteredTextures = useMemo(() => {
        const texturesArray = Array.from(textureAssets.values());
        
        if (!searchTerm) return texturesArray;
        
        return texturesArray.filter(texture => 
            texture.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [textureAssets, searchTerm]);
    
    const handleTextureClick = (textureId: string) => {
        setSelectedTextureId(textureId === selectedTextureId ? null : textureId);
    };
    
    const handleApplyTexture = () => {
        if (!selectedTextureId) {
            addToResponseLog('⚠️ Please select a texture to apply');
            return;
        }
        
        if (!hasSelection()) {
            addToResponseLog('⚠️ Please select an object to apply texture to');
            return;
        }
        
        // Apply to single or multiple objects
        const objectIds = selectedObjectId ? [selectedObjectId] : selectedObjectIds;
        
        objectIds.forEach(objectId => {
            applyTextureToObject(objectId, selectedTextureId, selectedTextureType);
        });
        
        const texture = textureAssets.get(selectedTextureId);
        const objectCount = objectIds.length;
        addToResponseLog(`✅ Applied ${texture?.name || 'texture'} (${selectedTextureType}) to ${objectCount} object${objectCount > 1 ? 's' : ''}`);
        
        // Call callback if provided
        if (onApply) {
            onApply(selectedTextureId, selectedTextureType);
        }
    };
    
    const handleDeleteTexture = (textureId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent texture selection
        
        const texture = textureAssets.get(textureId);
        if (window.confirm(`Delete texture "${texture?.name}"?`)) {
            removeTextureAsset(textureId);
            addToResponseLog(`🗑️ Deleted texture: ${texture?.name}`);
            
            // Clear selection if deleted texture was selected
            if (selectedTextureId === textureId) {
                setSelectedTextureId(null);
            }
        }
    };
    
    const handleRename = (textureId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const texture = textureAssets.get(textureId);
        if (texture) {
            setRenameTextureId(textureId);
            setRenameName(texture.name);
        }
    };
    
    const handleRenameSubmit = (textureId: string) => {
        if (renameName.trim()) {
            renameTextureAsset(textureId, renameName.trim());
            addToResponseLog(`✏️ Renamed texture to: ${renameName.trim()}`);
        }
        setRenameTextureId(null);
        setRenameName('');
    };
    
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };
    
    const formatDate = (timestamp: number): string => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
        return date.toLocaleDateString();
    };
    
    return (
        <div className={`texture-library-container ${className}`}>
            <div className="texture-library-header">
                <input
                    type="text"
                    placeholder="Search textures..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="texture-search-input"
                />
                
                <div className="texture-type-selector">
                    <label>Type:</label>
                    <select 
                        value={selectedTextureType} 
                        onChange={(e) => setSelectedTextureType(e.target.value as TextureType)}
                        className="texture-type-select"
                    >
                        <option value="diffuse">Diffuse</option>
                        <option value="normal">Normal</option>
                        <option value="specular">Specular</option>
                        <option value="emissive">Emissive</option>
                    </select>
                </div>
            </div>
            
            {filteredTextures.length === 0 ? (
                <div className="texture-library-empty">
                    <span className="empty-icon">🖼️</span>
                    <span className="empty-text">
                        {searchTerm ? 'No textures found' : 'No textures uploaded yet'}
                    </span>
                    <span className="empty-hint">
                        Upload textures using the upload area above
                    </span>
                </div>
            ) : (
                <div className="texture-grid">
                    {filteredTextures.map(texture => (
                        <div
                            key={texture.id}
                            className={`texture-item ${selectedTextureId === texture.id ? 'selected' : ''}`}
                            onClick={() => handleTextureClick(texture.id)}
                        >
                            <div className="texture-thumbnail">
                                <img src={texture.url} alt={texture.name} />
                            </div>
                            
                            <div className="texture-info">
                                {renameTextureId === texture.id ? (
                                    <input
                                        type="text"
                                        value={renameName}
                                        onChange={(e) => setRenameName(e.target.value)}
                                        onBlur={() => handleRenameSubmit(texture.id)}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                handleRenameSubmit(texture.id);
                                            }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="texture-rename-input"
                                        autoFocus
                                    />
                                ) : (
                                    <div className="texture-name" title={texture.name}>
                                        {texture.name}
                                    </div>
                                )}
                                
                                <div className="texture-meta">
                                    <span>{texture.dimensions.width}×{texture.dimensions.height}</span>
                                    <span>{formatFileSize(texture.fileSize)}</span>
                                </div>
                                
                                <div className="texture-date">
                                    {formatDate(texture.uploadedAt)}
                                </div>
                            </div>
                            
                            <div className="texture-actions">
                                <button
                                    className="texture-action-btn rename"
                                    onClick={(e) => handleRename(texture.id, e)}
                                    title="Rename"
                                >
                                    ✏️
                                </button>
                                <button
                                    className="texture-action-btn delete"
                                    onClick={(e) => handleDeleteTexture(texture.id, e)}
                                    title="Delete"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {selectedTextureId && hasSelection() && (
                <div className="texture-apply-section">
                    <button
                        className="texture-apply-button"
                        onClick={handleApplyTexture}
                    >
                        Apply {selectedTextureType} Texture
                    </button>
                </div>
            )}
        </div>
    );
}; 