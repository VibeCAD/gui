import React from 'react';
import { Vector3 } from 'babylonjs';
import { useSceneStore } from '../../state/sceneStore';
import type { SceneObject, ModularHousingObject } from '../../types/types';
import { TextureUpload } from './TextureUpload';
import { TextureLibrary } from './TextureLibrary';
import type { Wall } from '../../models/Wall';
import type { Opening } from '../../models/Opening';

export const PropertiesPanel: React.FC = () => {
  const {
    sceneObjects,
    selectedObjectId,
    selectedObjectIds,
    tessellationQuality,
    controlPointVisualizations,
    selectedControlPointIndex,
    housingEditMode,
    updateObject,
    setTessellationQuality,
    setSelectedControlPointIndex,
    getSelectedObject,
    getSelectedObjects,
    hasSelection,
    textureAssets,
    setTextureScale,
    setTextureOffset,
    removeTextureFromObject,
    // Housing-specific state and actions are being phased out
    // but some are kept for now to avoid breaking existing functionality.
    getHousingComponent,
    updateHousingComponent,
    // New wall actions
    walls,
    updateWall,
    addOpeningToWall,
    removeOpeningFromWall,
    updateOpeningInWall,
    enterAddOpeningMode,
    selectedOpeningId,
    setSelectedOpeningId,
  } = useSceneStore();

  const selectedObject = getSelectedObject();
  const selectedObjects = getSelectedObjects();
  const hasSelectionFlag = hasSelection();

  const updateSelectedObjectProperty = (property: keyof SceneObject, value: any) => {
    if (selectedObject) {
      updateObject(selectedObject.id, { [property]: value });
    }
  };

  const updateSelectedObjectsProperty = (property: keyof SceneObject, value: any) => {
    const objectsToUpdate = selectedObjectId ? [selectedObjectId] : selectedObjectIds;
    objectsToUpdate.forEach(id => {
      updateObject(id, { [property]: value });
    });
  };

  const updateControlPoint = (objectId: string, uvIndex: [number, number], newPosition: Vector3) => {
    const obj = sceneObjects.find(o => o.id === objectId);
    if (obj && obj.isNurbs && obj.verbData) {
      const [u, v] = uvIndex;
      const newVerbData = { ...obj.verbData };
      newVerbData.controlPoints[u][v] = [newPosition.x, newPosition.y, newPosition.z];
      updateObject(objectId, { verbData: newVerbData });
    }
  };

  const renderBasicProperties = (obj: SceneObject) => (
    <div className="properties-section">
      <h4>Transform Properties</h4>
      
      {/* Position */}
      <div className="property-group">
        <label>Position:</label>
        <div className="vector-input">
          <input
            type="number"
            value={obj.position.x.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('position', 
              new Vector3(parseFloat(e.target.value), obj.position.y, obj.position.z))}
            step="0.1"
            className="vector-component"
          />
          <input
            type="number"
            value={obj.position.y.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('position', 
              new Vector3(obj.position.x, parseFloat(e.target.value), obj.position.z))}
            step="0.1"
            className="vector-component"
          />
          <input
            type="number"
            value={obj.position.z.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('position', 
              new Vector3(obj.position.x, obj.position.y, parseFloat(e.target.value)))}
            step="0.1"
            className="vector-component"
          />
        </div>
      </div>

      {/* Rotation */}
      <div className="property-group">
        <label>Rotation (radians):</label>
        <div className="vector-input">
          <input
            type="number"
            value={obj.rotation.x.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('rotation', 
              new Vector3(parseFloat(e.target.value), obj.rotation.y, obj.rotation.z))}
            step="0.1"
            className="vector-component"
          />
          <input
            type="number"
            value={obj.rotation.y.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('rotation', 
              new Vector3(obj.rotation.x, parseFloat(e.target.value), obj.rotation.z))}
            step="0.1"
            className="vector-component"
          />
          <input
            type="number"
            value={obj.rotation.z.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('rotation', 
              new Vector3(obj.rotation.x, obj.rotation.y, parseFloat(e.target.value)))}
            step="0.1"
            className="vector-component"
          />
        </div>
      </div>

      {/* Scale */}
      <div className="property-group">
        <label>Scale:</label>
        <div className="vector-input">
          <input
            type="number"
            value={obj.scale.x.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('scale', 
              new Vector3(parseFloat(e.target.value), obj.scale.y, obj.scale.z))}
            step="0.1"
            min="0.1"
            className="vector-component"
          />
          <input
            type="number"
            value={obj.scale.y.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('scale', 
              new Vector3(obj.scale.x, parseFloat(e.target.value), obj.scale.z))}
            step="0.1"
            min="0.1"
            className="vector-component"
          />
          <input
            type="number"
            value={obj.scale.z.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('scale', 
              new Vector3(obj.scale.x, obj.scale.y, parseFloat(e.target.value)))}
            step="0.1"
            min="0.1"
            className="vector-component"
          />
        </div>
      </div>

      {/* Color */}
      <div className="property-group">
        <label>Color:</label>
        <div className="color-input-group">
          <input
            type="color"
            value={obj.color}
            onChange={(e) => updateSelectedObjectProperty('color', e.target.value)}
            className="color-picker"
          />
          <input
            type="text"
            value={obj.color}
            onChange={(e) => {
              if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                updateSelectedObjectProperty('color', e.target.value);
              }
            }}
            className="color-hex-input"
            placeholder="#FFFFFF"
          />
        </div>
      </div>
    </div>
  );

  const renderTextureProperties = (obj: SceneObject) => {
    // Don't show texture properties for ground or certain types
    if (obj.type === 'ground' || obj.type.startsWith('line-')) {
      return null;
    }

    return (
      <div className="properties-section">
        <h4>Texture Properties</h4>
        
        {/* Current Textures */}
        {obj.textureIds && Object.keys(obj.textureIds).length > 0 && (
          <div className="property-group">
            <label>Applied Textures:</label>
            <div className="applied-textures-list">
              {Object.entries(obj.textureIds).map(([type, textureId]) => {
                const texture = textureAssets.get(textureId);
                return (
                  <div key={type} className="applied-texture-item">
                    <span className="texture-type-label">{type}:</span>
                    <span className="texture-name">{texture?.name || 'Unknown'}</span>
                    <button
                      className="remove-texture-btn"
                      onClick={() => removeTextureFromObject(obj.id, type as any)}
                      title="Remove texture"
                    >
                      ❌
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Texture Scale */}
        {obj.textureIds && Object.keys(obj.textureIds).length > 0 && (
          <div className="property-group">
            <label>Texture Scale:</label>
            <div className="texture-scale-controls">
              <div className="scale-input">
                <label>U:</label>
                <input
                  type="number"
                  value={obj.textureScale?.u || 1}
                  onChange={(e) => setTextureScale(obj.id, { 
                    u: parseFloat(e.target.value), 
                    v: obj.textureScale?.v || 1 
                  })}
                  step="0.1"
                  min="0.1"
                  className="scale-component"
                />
              </div>
              <div className="scale-input">
                <label>V:</label>
                <input
                  type="number"
                  value={obj.textureScale?.v || 1}
                  onChange={(e) => setTextureScale(obj.id, { 
                    u: obj.textureScale?.u || 1, 
                    v: parseFloat(e.target.value) 
                  })}
                  step="0.1"
                  min="0.1"
                  className="scale-component"
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Texture Offset */}
        {obj.textureIds && Object.keys(obj.textureIds).length > 0 && (
          <div className="property-group">
            <label>Texture Offset:</label>
            <div className="texture-offset-controls">
              <div className="offset-input">
                <label>U:</label>
                <input
                  type="number"
                  value={obj.textureOffset?.u || 0}
                  onChange={(e) => setTextureOffset(obj.id, { 
                    u: parseFloat(e.target.value), 
                    v: obj.textureOffset?.v || 0 
                  })}
                  step="0.1"
                  className="offset-component"
                />
              </div>
              <div className="offset-input">
                <label>V:</label>
                <input
                  type="number"
                  value={obj.textureOffset?.v || 0}
                  onChange={(e) => setTextureOffset(obj.id, { 
                    u: obj.textureOffset?.u || 0, 
                    v: parseFloat(e.target.value) 
                  })}
                  step="0.1"
                  className="offset-component"
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Texture Upload */}
        <div className="property-group">
          <label>Upload New Texture:</label>
          <TextureUpload 
            className="properties-texture-upload"
            onUpload={(textureAsset) => {
              console.log('Texture uploaded:', textureAsset);
            }}
          />
        </div>
        
        {/* Texture Library */}
        <div className="property-group">
          <label>Texture Library:</label>
          <TextureLibrary 
            className="properties-texture-library"
            onApply={(textureId, textureType) => {
              console.log('Applied texture:', textureId, 'as', textureType);
            }}
          />
        </div>
      </div>
    );
  };

  const renderWallProperties = (wall: Wall) => {
    
    const handleAddOpening = (type: 'door' | 'window') => {
        console.log(`[PropertiesPanel] Clicked "Add ${type}" for wall: ${wall.id}`);
        enterAddOpeningMode(wall.id, type);
    };

    return (
        <div className="properties-section">
            <h4>Wall Properties</h4>
            <div className="property-group">
                <label>Length:</label>
                <input
                    type="number"
                    value={wall.parameters.length}
                    onChange={(e) => updateWall(wall.id, { 
                        parameters: { ...wall.parameters, length: parseFloat(e.target.value) } 
                    })}
                    step="0.1"
                    className="vector-component"
                />
            </div>
            <div className="property-group">
                <label>Height:</label>
                <input
                    type="number"
                    value={wall.parameters.height}
                    onChange={(e) => updateWall(wall.id, {
                        parameters: { ...wall.parameters, height: parseFloat(e.target.value) }
                    })}
                    step="0.1"
                    className="vector-component"
                />
            </div>
            <div className="property-group">
                <label>Thickness:</label>
                <input
                    type="number"
                    value={wall.parameters.thickness}
                    onChange={(e) => updateWall(wall.id, {
                        parameters: { ...wall.parameters, thickness: parseFloat(e.target.value) }
                    })}
                    step="0.05"
                    className="vector-component"
                />
            </div>

            <div className="property-group">
                <label>Openings ({wall.openings.length})</label>
                <div className="openings-list">
                    {wall.openings.map(opening => (
                        <div 
                            key={opening.id} 
                            className={`opening-item ${selectedOpeningId === opening.id ? 'selected' : ''}`}
                            onClick={() => setSelectedOpeningId(opening.id)}
                        >
                            <span>{opening.type}</span>
                            <button onClick={(e) => {
                                e.stopPropagation();
                                removeOpeningFromWall(wall.id, opening.id)
                            }}>Remove</button>
                        </div>
                    ))}
                </div>
                <div className="add-opening-buttons">
                    <button onClick={() => handleAddOpening('door')}>+ Add Door</button>
                    <button onClick={() => handleAddOpening('window')}>+ Add Window</button>
                </div>
            </div>
        </div>
    );
  }

  const renderNurbsProperties = (obj: SceneObject) => {
    if (!obj.isNurbs || !obj.verbData) return null;

    const visualization = controlPointVisualizations.find(viz => viz.objectId === obj.id);
    const currentTessellation = tessellationQuality[obj.id] || 16;

    return (
      <div className="properties-section">
        <h4>NURBS Properties</h4>
        
        {/* Tessellation Quality */}
        <div className="property-group">
          <label>Tessellation Quality:</label>
          <div className="tessellation-input">
            <input
              type="range"
              min="4"
              max="64"
              value={currentTessellation}
              onChange={(e) => setTessellationQuality(obj.id, parseInt(e.target.value))}
              className="tessellation-slider"
            />
            <span className="tessellation-value">{currentTessellation}</span>
          </div>
        </div>

        {/* NURBS Surface Information */}
        <div className="property-group">
          <label>Surface Info:</label>
          <div className="nurbs-info">
            <div>Degree U: {obj.verbData.degreeU}</div>
            <div>Degree V: {obj.verbData.degreeV}</div>
            <div>Control Points: {obj.verbData.controlPoints.length} × {obj.verbData.controlPoints[0]?.length || 0}</div>
          </div>
        </div>

        {/* Control Point Editing */}
        {visualization && selectedControlPointIndex !== null && (
          <div className="property-group">
            <label>Selected Control Point:</label>
            <div className="control-point-info">
              <div>Index: {selectedControlPointIndex}</div>
              {(() => {
                const controlPointsFlat = obj.verbData.controlPoints.flat();
                const controlPointData = controlPointsFlat[selectedControlPointIndex];
                if (controlPointData) {
                  const [u, v] = [
                    Math.floor(selectedControlPointIndex / obj.verbData.controlPoints[0].length),
                    selectedControlPointIndex % obj.verbData.controlPoints[0].length
                  ];
                  return (
                    <div className="vector-input">
                      <input
                        type="number"
                        value={controlPointData[0].toFixed(2)}
                        onChange={(e) => updateControlPoint(obj.id, [u, v], 
                          new Vector3(parseFloat(e.target.value), controlPointData[1], controlPointData[2]))}
                        step="0.1"
                        className="vector-component"
                      />
                      <input
                        type="number"
                        value={controlPointData[1].toFixed(2)}
                        onChange={(e) => updateControlPoint(obj.id, [u, v], 
                          new Vector3(controlPointData[0], parseFloat(e.target.value), controlPointData[2]))}
                        step="0.1"
                        className="vector-component"
                      />
                      <input
                        type="number"
                        value={controlPointData[2].toFixed(2)}
                        onChange={(e) => updateControlPoint(obj.id, [u, v], 
                          new Vector3(controlPointData[0], controlPointData[1], parseFloat(e.target.value)))}
                        step="0.1"
                        className="vector-component"
                      />
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        )}

        {/* Control Point Instructions */}
        <div className="property-group">
          <div className="control-point-instructions">
            <small>
              💡 Click on control points in the 3D view to select and edit them here.
            </small>
          </div>
        </div>
      </div>
    );
  };

  const renderHousingProperties = (obj: SceneObject) => {
    if (!obj.type.startsWith('house-') && obj.type !== 'modular-room') {
      return null;
    }

    const housingComponent = getHousingComponent(obj.id);
    if (!housingComponent) {
      return null;
    }

    return (
      <div className="properties-section">
        <h4>Housing Properties</h4>
        
        {/* Wall Thickness Control */}
        <div className="property-group">
          <label>Wall Thickness:</label>
          <div className="wall-thickness-control">
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={housingComponent.wallThickness}
              onChange={(e) => updateHousingComponent(obj.id, { wallThickness: parseFloat(e.target.value) })}
              className="thickness-slider"
            />
            <span className="thickness-value">{housingComponent.wallThickness.toFixed(2)}m</span>
          </div>
        </div>

        {/* Ceiling Toggle */}
        <div className="property-group">
          <label>
            <input
              type="checkbox"
              checked={housingComponent.hasCeiling}
              onChange={(e) => updateHousingComponent(obj.id, { hasCeiling: e.target.checked })}
            />
            Has Ceiling
          </label>
        </div>

        {/* Floor Toggle */}
        <div className="property-group">
          <label>
            <input
              type="checkbox"
              checked={housingComponent.hasFloor}
              onChange={(e) => updateHousingComponent(obj.id, { hasFloor: e.target.checked })}
            />
            Has Floor
          </label>
        </div>
      </div>
    );
  };

  const renderSelectedWallProperties = (wall: Wall) => {
    return (
      <div className="property-group selected-wall-properties">
        <h5>Selected Wall Properties</h5>
        {/* Simplified for now, will be expanded later */}
      </div>
    );
  };

  const renderMultiSelectProperties = () => (
    <div className="properties-section">
      <h4>Multiple Objects Selected ({selectedObjects.length})</h4>
      
      {/* Bulk Color Change */}
      <div className="property-group">
        <label>Bulk Color Change:</label>
        <div className="color-input-group">
          <input
            type="color"
            onChange={(e) => updateSelectedObjectsProperty('color', e.target.value)}
            className="color-picker"
          />
          <button
            onClick={() => {
              const randomColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
              updateSelectedObjectsProperty('color', randomColor);
            }}
            className="random-color-btn"
          >
            Random Color
          </button>
        </div>
      </div>

      {/* Object List */}
      <div className="property-group">
        <label>Selected Objects:</label>
        <div className="selected-objects-list">
          {selectedObjects.map(obj => (
            <div key={obj.id} className="selected-object-item">
              <span className="object-type">{obj.type}</span>
              <span className="object-id">{obj.id}</span>
              <div className="object-color" style={{ backgroundColor: obj.color }}></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSelectedOpeningProperties = (opening: Opening) => {
    const parentWall = walls.find(wall => wall.openings.some(op => op.id === opening.id));
    if (!parentWall) return null;

    return (
        <div className="properties-section">
            <h4>Opening Properties</h4>
            <div className="property-group">
                <label>Width:</label>
                <input
                    type="number"
                    value={opening.parameters.width}
                    onChange={(e) => updateOpeningInWall(parentWall.id, opening.id, {
                        parameters: { ...opening.parameters, width: parseFloat(e.target.value) }
                    })}
                    step="0.1"
                    className="vector-component"
                />
            </div>
            <div className="property-group">
                <label>Height:</label>
                <input
                    type="number"
                    value={opening.parameters.height}
                    onChange={(e) => updateOpeningInWall(parentWall.id, opening.id, {
                        parameters: { ...opening.parameters, height: parseFloat(e.target.value) }
                    })}
                    step="0.1"
                    className="vector-component"
                />
            </div>
        </div>
    );
  };

  if (!hasSelectionFlag) {
    return (
      <div className="ai-control-group">
        <label>Properties:</label>
        <div className="no-selection-message">
          Select an object to view its properties
        </div>
      </div>
    );
  }

  return (
    <div className="ai-control-group">
      <label>Properties:</label>
      <div className="properties-content">
        {selectedObject ? (
          <>
            {renderBasicProperties(selectedObject)}
            {renderTextureProperties(selectedObject)}
            {renderNurbsProperties(selectedObject)}
            {renderHousingProperties(selectedObject)}
            {walls.find(w => w.id === selectedObject.id) && renderWallProperties(walls.find(w => w.id === selectedObject.id)!)}
          </>
        ) : selectedOpeningId ? (
            renderSelectedOpeningProperties(walls.flatMap(w => w.openings).find(o => o.id === selectedOpeningId)!)
        ) : (
          renderMultiSelectProperties()
        )}
      </div>
    </div>
  );
};
