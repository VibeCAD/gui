import React from 'react';
import { Vector3 } from 'babylonjs';
import { useSceneStore } from '../../state/sceneStore';
import type { SceneObject, ModularHousingObject, Door, Window, Wall } from '../../types/types';
import { TextureUpload } from './TextureUpload';
import { TextureLibrary } from './TextureLibrary';

export const PropertiesPanel: React.FC = () => {
  const {
    sceneObjects,
    selectedObjectId,
    selectedObjectIds,
    tessellationQuality,
    controlPointVisualizations,
    selectedControlPointIndex,
    selectedWallId,
    selectedDoorId,
    selectedWindowId,
    housingEditMode,
    updateObject,
    setTessellationQuality,
    setSelectedControlPointIndex,
    getSelectedObject,
    getSelectedObjects,
    hasSelection,
    // Texture-related state
    textureAssets,
    setTextureScale,
    setTextureOffset,
    removeTextureFromObject,
    // Housing-specific actions
    getHousingComponent,
    getSelectedWall,
    getSelectedDoor,
    getSelectedWindow,
    addDoor,
    removeDoor,
    addWindow,
    removeWindow,
    changeWallThickness,
    toggleCeiling,
    toggleFloor,
    setSelectedWallId,
    setSelectedDoorId,
    setSelectedWindowId,
    setHousingEditMode,
    addHousingComponent,
    updateHousingComponent,
    removeObject,
    setObjectVisibility,
    setObjectLocked,
    clearSelection,
    isObjectVisible,
    isObjectLocked,
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
      
      {/* Room Name for custom rooms */}
      {obj.roomName && (
        <div className="property-group">
          <label>Room Name:</label>
          <input
            type="text"
            value={obj.roomName}
            onChange={(e) => updateSelectedObjectProperty('roomName', e.target.value)}
            className="room-name-input"
            placeholder="Enter room name"
          />
        </div>
      )}
      
      {/* Position */}
      <div className="property-group">
        <label>Position:</label>
        <div className="position-inputs">
          <input
            type="number"
            value={obj.position.x.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('position', new Vector3(parseFloat(e.target.value), obj.position.y, obj.position.z))}
            step="0.1"
            placeholder="X"
          />
          <input
            type="number"
            value={obj.position.y.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('position', new Vector3(obj.position.x, parseFloat(e.target.value), obj.position.z))}
            step="0.1"
            placeholder="Y"
          />
          <input
            type="number"
            value={obj.position.z.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('position', new Vector3(obj.position.x, obj.position.y, parseFloat(e.target.value)))}
            step="0.1"
            placeholder="Z"
          />
        </div>
      </div>

      {/* Rotation */}
      <div className="property-group">
        <label>Rotation (degrees):</label>
        <div className="rotation-inputs">
          <input
            type="number"
            value={(obj.rotation.x * 180 / Math.PI).toFixed(1)}
            onChange={(e) => {
              const degrees = parseFloat(e.target.value);
              const radians = degrees * Math.PI / 180;
              updateSelectedObjectProperty('rotation', new Vector3(radians, obj.rotation.y, obj.rotation.z));
            }}
            step="1"
            placeholder="X"
          />
          <input
            type="number"
            value={(obj.rotation.y * 180 / Math.PI).toFixed(1)}
            onChange={(e) => {
              const degrees = parseFloat(e.target.value);
              const radians = degrees * Math.PI / 180;
              updateSelectedObjectProperty('rotation', new Vector3(obj.rotation.x, radians, obj.rotation.z));
            }}
            step="1"
            placeholder="Y"
          />
          <input
            type="number"
            value={(obj.rotation.z * 180 / Math.PI).toFixed(1)}
            onChange={(e) => {
              const degrees = parseFloat(e.target.value);
              const radians = degrees * Math.PI / 180;
              updateSelectedObjectProperty('rotation', new Vector3(obj.rotation.x, obj.rotation.y, radians));
            }}
            step="1"
            placeholder="Z"
          />
        </div>
      </div>

      {/* Scale */}
      <div className="property-group">
        <label>Scale:</label>
        <div className="scale-inputs">
          <input
            type="number"
            value={obj.scale.x.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('scale', new Vector3(parseFloat(e.target.value), obj.scale.y, obj.scale.z))}
            step="0.1"
            min="0.1"
            placeholder="X"
          />
          <input
            type="number"
            value={obj.scale.y.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('scale', new Vector3(obj.scale.x, parseFloat(e.target.value), obj.scale.z))}
            step="0.1"
            min="0.1"
            placeholder="Y"
          />
          <input
            type="number"
            value={obj.scale.z.toFixed(2)}
            onChange={(e) => updateSelectedObjectProperty('scale', new Vector3(obj.scale.x, obj.scale.y, parseFloat(e.target.value)))}
            step="0.1"
            min="0.1"
            placeholder="Z"
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
            onChange={(e) => updateSelectedObjectProperty('color', e.target.value)}
            className="color-text"
            placeholder="#FFFFFF"
          />
        </div>
      </div>
    </div>
  );

  const renderGridProperties = (obj: SceneObject) => {
    // Only show grid properties for custom rooms
    if (obj.type !== 'custom-room' || !obj.gridInfo) {
      return null;
    }

    const currentGridSize = obj.gridInfo.gridSize;
    const worldScale = obj.gridInfo.worldScale;
    const gridWorldSize = currentGridSize * worldScale;

    return (
      <div className="properties-section">
        <h4>Floor Grid Properties</h4>
        
        {/* Grid Size Control */}
        <div className="property-group">
          <label>Grid Size:</label>
          <div className="grid-size-control">
            <input
              type="range"
              min="10"
              max="40"
              step="5"
              value={currentGridSize}
              onChange={(e) => {
                const newGridSize = parseInt(e.target.value);
                updateSelectedObjectProperty('gridInfo', {
                  ...obj.gridInfo,
                  gridSize: newGridSize
                });
                
                // Also update the floor texture
                // This will trigger a scene update that will regenerate the texture
                updateSelectedObjectProperty('color', obj.color); // Force update
              }}
              className="grid-size-slider"
            />
            <span className="grid-size-value">{currentGridSize}px</span>
            <span className="grid-world-size">({gridWorldSize.toFixed(2)}m)</span>
          </div>
        </div>

        {/* Grid Visibility Toggle */}
        <div className="property-group">
          <label>
            <input
              type="checkbox"
              checked={obj.gridInfo.visible !== false}
              onChange={(e) => {
                updateSelectedObjectProperty('gridInfo', {
                  ...obj.gridInfo,
                  visible: e.target.checked
                });
              }}
            />
            Show Grid
          </label>
        </div>

        {/* Grid Color */}
        <div className="property-group">
          <label>Grid Line Color:</label>
          <div className="color-input-group">
            <input
              type="color"
              value={obj.gridInfo.lineColor || '#e0e0e0'}
              onChange={(e) => {
                updateSelectedObjectProperty('gridInfo', {
                  ...obj.gridInfo,
                  lineColor: e.target.value
                });
              }}
              className="color-picker"
            />
            <input
              type="text"
              value={obj.gridInfo.lineColor || '#e0e0e0'}
              onChange={(e) => {
                updateSelectedObjectProperty('gridInfo', {
                  ...obj.gridInfo,
                  lineColor: e.target.value
                });
              }}
              className="color-text"
              placeholder="#e0e0e0"
            />
          </div>
        </div>

        {/* Sub-grid Toggle */}
        <div className="property-group">
          <label>
            <input
              type="checkbox"
              checked={obj.gridInfo.showSubGrid !== false}
              onChange={(e) => {
                updateSelectedObjectProperty('gridInfo', {
                  ...obj.gridInfo,
                  showSubGrid: e.target.checked
                });
              }}
            />
            Show Sub-grid
          </label>
        </div>

        {/* Grid Info */}
        <div className="property-group">
          <label>Grid Information:</label>
          <div className="grid-info">
            <div>Drawing Size: {obj.gridInfo.drawingBounds?.width || 400} × {obj.gridInfo.drawingBounds?.height || 400}px</div>
            <div>World Scale: 1px = {worldScale}m</div>
            <div>Grid Cell Size: {gridWorldSize.toFixed(2)}m</div>
          </div>
        </div>

        {/* Apply to Other Rooms Button */}
        <div className="property-group">
          <button
            className="apply-grid-btn"
            onClick={() => {
              // Apply current grid settings to all custom rooms
              const customRooms = sceneObjects.filter(o => o.type === 'custom-room' && o.id !== obj.id);
              customRooms.forEach(room => {
                if (room.gridInfo) {
                  updateObject(room.id, {
                    gridInfo: {
                      ...room.gridInfo,
                      gridSize: currentGridSize,
                      lineColor: obj.gridInfo?.lineColor,
                      showSubGrid: obj.gridInfo?.showSubGrid
                    }
                  });
                }
              });
              console.log(`Applied grid settings to ${customRooms.length} other room(s)`);
            }}
          >
            Apply to All Rooms
          </button>
        </div>
      </div>
    );
  };

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
              onChange={(e) => changeWallThickness(obj.id, parseFloat(e.target.value))}
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
              onChange={(e) => toggleCeiling(obj.id, e.target.checked)}
            />
            Has Ceiling
          </label>
        </div>

        {/* Ceiling Height */}
        {housingComponent.hasCeiling && (
          <div className="property-group">
            <label>Ceiling Height:</label>
            <input
              type="number"
              value={housingComponent.ceilingHeight}
              onChange={(e) => updateHousingComponent(obj.id, { ceilingHeight: parseFloat(e.target.value) })}
              step="0.1"
              min="2.0"
              max="5.0"
              className="height-input"
            />
          </div>
        )}

        {/* Enhanced Ceiling Management */}
        {housingComponent.hasCeiling && (
          <>
            <div className="property-group">
              <label>Ceiling Type:</label>
              <select
                value={housingComponent.ceilingType || 'flat'}
                onChange={(e) => updateHousingComponent(obj.id, { ceilingType: e.target.value as any })}
                className="ceiling-type-select"
              >
                <option value="flat">Flat Ceiling</option>
                <option value="vaulted">Vaulted Ceiling</option>
                <option value="coffered">Coffered Ceiling</option>
                <option value="tray">Tray Ceiling</option>
                <option value="cathedral">Cathedral Ceiling</option>
                <option value="beam">Exposed Beam</option>
              </select>
            </div>

            <div className="property-group">
              <label>Ceiling Material:</label>
              <select
                value={housingComponent.ceilingMaterial || 'drywall'}
                onChange={(e) => updateHousingComponent(obj.id, { ceilingMaterial: e.target.value })}
                className="ceiling-material-select"
              >
                <option value="drywall">Drywall</option>
                <option value="plaster">Plaster</option>
                <option value="wood">Wood Planks</option>
                <option value="acoustic">Acoustic Tiles</option>
                <option value="metal">Metal</option>
                <option value="concrete">Concrete</option>
                <option value="tin">Tin Tiles</option>
              </select>
            </div>

            <div className="property-group">
              <label>Ceiling Thickness:</label>
              <div className="thickness-control">
                <input
                  type="range"
                  min="0.05"
                  max="0.3"
                  step="0.01"
                  value={housingComponent.ceilingThickness || 0.1}
                  onChange={(e) => updateHousingComponent(obj.id, { ceilingThickness: parseFloat(e.target.value) })}
                  className="thickness-slider"
                />
                <span className="thickness-value">{(housingComponent.ceilingThickness || 0.1).toFixed(2)}m</span>
              </div>
            </div>

            <div className="property-group">
              <label>Ceiling Features:</label>
              <div className="ceiling-features">
                <div className="feature-option">
                  <input
                    type="checkbox"
                    checked={housingComponent.ceilingFeatures?.hasLights || false}
                    onChange={(e) => updateHousingComponent(obj.id, { 
                      ceilingFeatures: { 
                        ...housingComponent.ceilingFeatures, 
                        hasLights: e.target.checked 
                      } 
                    })}
                  />
                  <label>Recessed Lighting</label>
                </div>
                <div className="feature-option">
                  <input
                    type="checkbox"
                    checked={housingComponent.ceilingFeatures?.hasFan || false}
                    onChange={(e) => updateHousingComponent(obj.id, { 
                      ceilingFeatures: { 
                        ...housingComponent.ceilingFeatures, 
                        hasFan: e.target.checked 
                      } 
                    })}
                  />
                  <label>Ceiling Fan</label>
                </div>
                <div className="feature-option">
                  <input
                    type="checkbox"
                    checked={housingComponent.ceilingFeatures?.hasSkylight || false}
                    onChange={(e) => updateHousingComponent(obj.id, { 
                      ceilingFeatures: { 
                        ...housingComponent.ceilingFeatures, 
                        hasSkylight: e.target.checked 
                      } 
                    })}
                  />
                  <label>Skylight</label>
                </div>
                <div className="feature-option">
                  <input
                    type="checkbox"
                    checked={housingComponent.ceilingFeatures?.hasBeams || false}
                    onChange={(e) => updateHousingComponent(obj.id, { 
                      ceilingFeatures: { 
                        ...housingComponent.ceilingFeatures, 
                        hasBeams: e.target.checked 
                      } 
                    })}
                  />
                  <label>Decorative Beams</label>
                </div>
              </div>
            </div>

            <div className="property-group">
              <label>Ceiling Actions:</label>
              <div className="ceiling-actions">
                <button
                  className="ceiling-action-btn"
                  onClick={() => {
                    // Auto-adjust ceiling height based on room type
                    const roomType = housingComponent.roomType || 'living-room';
                    const heightMap = {
                      'living-room': 2.7,
                      'bedroom': 2.4,
                      'kitchen': 2.4,
                      'bathroom': 2.4,
                      'dining-room': 2.7,
                      'office': 2.4,
                      'hallway': 2.4,
                      'garage': 3.0
                    };
                    const suggestedHeight = heightMap[roomType as keyof typeof heightMap] || 2.4;
                    updateHousingComponent(obj.id, { ceilingHeight: suggestedHeight });
                  }}
                >
                  📏 Auto-Height
                </button>
                <button
                  className="ceiling-action-btn"
                  onClick={() => {
                    // Match ceiling to connected rooms
                    console.log('Match ceiling to connected rooms');
                  }}
                >
                  🔗 Match Connected
                </button>
                <button
                  className="ceiling-action-btn"
                  onClick={() => {
                    // Preview ceiling changes
                    console.log('Preview ceiling changes');
                  }}
                >
                  👁️ Preview
                </button>
              </div>
            </div>
          </>
        )}

        {/* Floor Toggle */}
        <div className="property-group">
          <label>
            <input
              type="checkbox"
              checked={housingComponent.hasFloor}
              onChange={(e) => toggleFloor(obj.id, e.target.checked)}
            />
            Has Floor
          </label>
        </div>

        {/* Enhanced Floor Management */}
        {housingComponent.hasFloor && (
          <>
            <div className="property-group">
              <label>Floor Material:</label>
              <select
                value={housingComponent.floorMaterial || 'hardwood'}
                onChange={(e) => updateHousingComponent(obj.id, { floorMaterial: e.target.value })}
                className="floor-material-select"
              >
                <option value="hardwood">Hardwood</option>
                <option value="laminate">Laminate</option>
                <option value="tile">Tile</option>
                <option value="carpet">Carpet</option>
                <option value="concrete">Concrete</option>
                <option value="vinyl">Vinyl</option>
                <option value="marble">Marble</option>
                <option value="bamboo">Bamboo</option>
              </select>
            </div>

            <div className="property-group">
              <label>Floor Thickness:</label>
              <div className="thickness-control">
                <input
                  type="range"
                  min="0.02"
                  max="0.15"
                  step="0.005"
                  value={housingComponent.floorThickness || 0.05}
                  onChange={(e) => updateHousingComponent(obj.id, { floorThickness: parseFloat(e.target.value) })}
                  className="thickness-slider"
                />
                <span className="thickness-value">{(housingComponent.floorThickness || 0.05).toFixed(3)}m</span>
              </div>
            </div>

            <div className="property-group">
              <label>Floor Features:</label>
              <div className="floor-features">
                <div className="feature-option">
                  <input
                    type="checkbox"
                    checked={housingComponent.floorFeatures?.hasBaseboards || false}
                    onChange={(e) => updateHousingComponent(obj.id, { 
                      floorFeatures: { 
                        ...housingComponent.floorFeatures, 
                        hasBaseboards: e.target.checked 
                      } 
                    })}
                  />
                  <label>Baseboards</label>
                </div>
                <div className="feature-option">
                  <input
                    type="checkbox"
                    checked={housingComponent.floorFeatures?.hasHeating || false}
                    onChange={(e) => updateHousingComponent(obj.id, { 
                      floorFeatures: { 
                        ...housingComponent.floorFeatures, 
                        hasHeating: e.target.checked 
                      } 
                    })}
                  />
                  <label>Radiant Heating</label>
                </div>
                <div className="feature-option">
                  <input
                    type="checkbox"
                    checked={housingComponent.floorFeatures?.hasTransition || false}
                    onChange={(e) => updateHousingComponent(obj.id, { 
                      floorFeatures: { 
                        ...housingComponent.floorFeatures, 
                        hasTransition: e.target.checked 
                      } 
                    })}
                  />
                  <label>Transition Strips</label>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Room Type */}
        <div className="property-group">
          <label>Room Type:</label>
          <select
            value={housingComponent.roomType || 'living-room'}
            onChange={(e) => updateHousingComponent(obj.id, { roomType: e.target.value as any })}
            className="room-type-select"
          >
            <option value="living-room">Living Room</option>
            <option value="bedroom">Bedroom</option>
            <option value="kitchen">Kitchen</option>
            <option value="bathroom">Bathroom</option>
            <option value="dining-room">Dining Room</option>
            <option value="office">Office</option>
            <option value="hallway">Hallway</option>
            <option value="garage">Garage</option>
          </select>
        </div>

        {/* Walls List */}
        <div className="property-group">
          <label>Walls ({housingComponent.walls.length}):</label>
          <div className="walls-list">
            {housingComponent.walls.map((wall, index) => (
              <div 
                key={wall.id} 
                className={`wall-item ${selectedWallId === wall.id ? 'selected' : ''}`}
                onClick={() => setSelectedWallId(wall.id)}
              >
                <span className="wall-name">{wall.type} Wall {index + 1}</span>
                <span className="wall-info">
                  {wall.doors.length} doors, {wall.windows.length} windows
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Wall Properties */}
        {selectedWallId && renderSelectedWallProperties(obj.id, selectedWallId)}

        {/* Doors List */}
        <div className="property-group">
          <label>Doors ({housingComponent.doors.length}):</label>
          <div className="doors-list">
            {housingComponent.doors.map((door, index) => (
              <div 
                key={door.id} 
                className={`door-item ${selectedDoorId === door.id ? 'selected' : ''}`}
                onClick={() => setSelectedDoorId(door.id)}
              >
                <span className="door-name">{door.type} Door {index + 1}</span>
                <span className="door-info">
                  {door.width.toFixed(2)}×{door.height.toFixed(2)}m
                </span>
              </div>
            ))}
          </div>
          <button 
            className="add-component-btn"
            onClick={() => setHousingEditMode('door')}
          >
            + Add Door
          </button>
        </div>

        {/* Selected Door Properties */}
        {selectedDoorId && renderSelectedDoorProperties(obj.id, selectedDoorId)}

        {/* Windows List */}
        <div className="property-group">
          <label>Windows ({housingComponent.windows.length}):</label>
          <div className="windows-list">
            {housingComponent.windows.map((window, index) => (
              <div 
                key={window.id} 
                className={`window-item ${selectedWindowId === window.id ? 'selected' : ''}`}
                onClick={() => setSelectedWindowId(window.id)}
              >
                <span className="window-name">{window.type} Window {index + 1}</span>
                <span className="window-info">
                  {window.width.toFixed(2)}×{window.height.toFixed(2)}m
                </span>
              </div>
            ))}
          </div>
          <button 
            className="add-component-btn"
            onClick={() => setHousingEditMode('window')}
          >
            + Add Window
          </button>
        </div>

        {/* Selected Window Properties */}
        {selectedWindowId && renderSelectedWindowProperties(obj.id, selectedWindowId)}

        {/* Building Info */}
        <div className="property-group">
          <label>Building Information:</label>
          <div className="building-info">
            <div>Type: {housingComponent.housingType}</div>
            <div>Walls: {housingComponent.walls.length}</div>
            <div>Total Doors: {housingComponent.doors.length}</div>
            <div>Total Windows: {housingComponent.windows.length}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderSelectedWallProperties = (objectId: string, wallId: string) => {
    const wall = getSelectedWall(objectId);
    if (!wall) return null;

    return (
      <div className="property-group selected-wall-properties">
        <h5>Selected Wall Properties</h5>
        
        <div className="wall-property">
          <label>Wall Type:</label>
          <select
            value={wall.type}
            onChange={(e) => {
              // Update wall type with real-time preview
              const newType = e.target.value as any;
              // TODO: Implement wall type update with visual feedback
              console.log('Update wall type:', newType);
            }}
          >
            <option value="exterior">Exterior</option>
            <option value="interior">Interior</option>
            <option value="load-bearing">Load Bearing</option>
            <option value="partition">Partition</option>
          </select>
        </div>

        <div className="wall-property">
          <label>Wall Thickness:</label>
          <div className="wall-thickness-control">
            <input
              type="range"
              min="0.05"
              max="1.0"
              step="0.025"
              value={wall.thickness}
              onChange={(e) => {
                const newThickness = parseFloat(e.target.value);
                changeWallThickness(objectId, newThickness, wallId);
                // Real-time preview implementation
                const housingComponent = getHousingComponent(objectId);
                if (housingComponent) {
                  // Update the mesh in real-time
                  const sceneObject = sceneObjects.find(obj => obj.id === objectId);
                  if (sceneObject && sceneObject.mesh) {
                    // Force mesh regeneration with new thickness
                    sceneObject.mesh.dispose();
                    // The mesh will be regenerated by the scene manager
                  }
                }
              }}
              className="thickness-slider"
            />
            <span className="thickness-value">{wall.thickness.toFixed(3)}m</span>
          </div>
          <small className="thickness-hint">
            💡 Real-time preview active
          </small>
        </div>

        <div className="wall-property">
          <label>Wall Height:</label>
          <div className="height-control">
            <input
              type="number"
              value={wall.height}
              onChange={(e) => {
                // Update wall height with auto-adjust connected structures
                const newHeight = parseFloat(e.target.value);
                const housingComponent = getHousingComponent(objectId);
                if (housingComponent) {
                  // Update the specific wall height
                  const targetWall = housingComponent.walls.find(w => w.id === wallId);
                  if (targetWall) {
                    targetWall.height = newHeight;
                    updateHousingComponent(objectId, housingComponent);
                    
                    // Auto-adjust connected structures
                    targetWall.connectedWalls.forEach(connectedWallId => {
                      const connectedWall = housingComponent.walls.find(w => w.id === connectedWallId);
                      if (connectedWall) {
                        connectedWall.height = newHeight;
                      }
                    });
                    
                    // Update ceiling height if needed
                    if (housingComponent.hasCeiling) {
                      housingComponent.ceilingHeight = newHeight;
                    }
                    
                    // Force mesh regeneration
                    const sceneObject = sceneObjects.find(obj => obj.id === objectId);
                    if (sceneObject && sceneObject.mesh) {
                      sceneObject.mesh.dispose();
                    }
                  }
                }
              }}
              step="0.1"
              min="2.0"
              max="5.0"
              className="height-input"
            />
            <button
              className="auto-adjust-btn"
              onClick={() => {
                // Auto-adjust connected structures
                const housingComponent = getHousingComponent(objectId);
                if (housingComponent) {
                  const targetWall = housingComponent.walls.find(w => w.id === wallId);
                  if (targetWall) {
                    // Set all connected walls to the same height
                    const targetHeight = targetWall.height;
                    targetWall.connectedWalls.forEach(connectedWallId => {
                      const connectedWall = housingComponent.walls.find(w => w.id === connectedWallId);
                      if (connectedWall) {
                        connectedWall.height = targetHeight;
                      }
                    });
                    
                    // Update ceiling height
                    if (housingComponent.hasCeiling) {
                      housingComponent.ceilingHeight = targetHeight;
                    }
                    
                    updateHousingComponent(objectId, housingComponent);
                    
                    // Force mesh regeneration
                    const sceneObject = sceneObjects.find(obj => obj.id === objectId);
                    if (sceneObject && sceneObject.mesh) {
                      sceneObject.mesh.dispose();
                    }
                  }
                }
              }}
              title="Auto-adjust connected structures"
            >
              🔗
            </button>
          </div>
        </div>

        <div className="wall-property">
          <label>Wall Length:</label>
          <div className="length-display">
            <span className="length-value">
              {wall.startPoint.subtract(wall.endPoint).length().toFixed(2)}m
            </span>
            <button
              className="edit-length-btn"
              onClick={() => {
                // Enter wall length edit mode
                console.log('Enter wall length edit mode');
              }}
              title="Edit wall endpoints"
            >
              ✏️
            </button>
          </div>
        </div>

        <div className="wall-property">
          <label>Load Bearing:</label>
          <div className="load-bearing-control">
            <input
              type="checkbox"
              checked={wall.isLoadBearing}
              onChange={(e) => {
                // Update load bearing status with structural warnings
                const isLoadBearing = e.target.checked;
                if (!isLoadBearing && wall.connectedWalls.length > 0) {
                  // Show warning about connected walls
                  console.log('Warning: This wall supports connected structures');
                }
                // TODO: Implement load bearing update
                console.log('Update load bearing:', isLoadBearing);
              }}
            />
            {wall.isLoadBearing && wall.connectedWalls.length > 0 && (
              <span className="structural-warning">
                ⚠️ Supports {wall.connectedWalls.length} connected wall{wall.connectedWalls.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="wall-property">
          <label>Connected Walls:</label>
          <div className="connected-walls-list">
            {wall.connectedWalls.length === 0 ? (
              <span className="no-connections">No connections</span>
            ) : (
              wall.connectedWalls.map((connectedWallId, index) => (
                <div key={connectedWallId} className="connected-wall-item">
                  <span className="connected-wall-id">Wall {index + 1}</span>
                  <button
                    className="disconnect-btn"
                    onClick={() => {
                      // Disconnect wall
                      console.log('Disconnect wall:', connectedWallId);
                    }}
                    title="Disconnect this wall"
                  >
                    🔗⚡
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="wall-actions">
          <button
            className="wall-action-btn"
            onClick={() => {
              // Enter wall segment edit mode
              console.log('Enter wall segment edit mode');
            }}
          >
            🎯 Edit Segments
          </button>
          <button
            className="wall-action-btn"
            onClick={() => {
              // Split wall at midpoint
              console.log('Split wall at midpoint');
            }}
          >
            ✂️ Split Wall
          </button>
          <button
            className="wall-action-btn danger"
            onClick={() => {
              // Remove wall with confirmation
              if (window.confirm('Remove this wall? This action cannot be undone.')) {
                console.log('Remove wall');
              }
            }}
          >
            🗑️ Remove
          </button>
        </div>
      </div>
    );
  };

  const renderSelectedDoorProperties = (objectId: string, doorId: string) => {
    const door = getSelectedDoor(objectId);
    if (!door) return null;

    return (
      <div className="property-group selected-door-properties">
        <h5>Selected Door Properties</h5>
        
        <div className="door-property">
          <label>Door Type:</label>
          <select
            value={door.type}
            onChange={(e) => {
              // Update door type with auto-cutout regeneration
              const newType = e.target.value as any;
              // TODO: Implement door type update with CSG regeneration
              console.log('Update door type:', newType, '- regenerating cutout');
            }}
          >
            <option value="single">Single Door</option>
            <option value="double">Double Door</option>
            <option value="sliding">Sliding Door</option>
            <option value="french">French Door</option>
            <option value="garage">Garage Door</option>
          </select>
        </div>

        <div className="door-property">
          <label>Door Style:</label>
          <select
            value={door.material || 'wood'}
            onChange={(e) => {
              // Update door style/material
              console.log('Update door style:', e.target.value);
            }}
          >
            <option value="wood">Wood Panel</option>
            <option value="glass">Glass Panel</option>
            <option value="steel">Steel</option>
            <option value="composite">Composite</option>
            <option value="arched">Arched</option>
          </select>
        </div>

        <div className="door-property">
          <label>Dimensions:</label>
          <div className="dimension-controls">
            <div className="dimension-input">
              <label>Width:</label>
              <input
                type="number"
                value={door.width}
                onChange={(e) => {
                  const newWidth = parseFloat(e.target.value);
                  // TODO: Update door width with real-time cutout adjustment
                  console.log('Update door width:', newWidth);
                }}
                step="0.05"
                min="0.6"
                max="3.0"
                className="dimension-field"
              />
            </div>
            <div className="dimension-input">
              <label>Height:</label>
              <input
                type="number"
                value={door.height}
                onChange={(e) => {
                  const newHeight = parseFloat(e.target.value);
                  // TODO: Update door height with real-time cutout adjustment
                  console.log('Update door height:', newHeight);
                }}
                step="0.05"
                min="1.8"
                max="3.0"
                className="dimension-field"
              />
            </div>
            <div className="dimension-input">
              <label>Thickness:</label>
              <input
                type="number"
                value={door.thickness}
                onChange={(e) => {
                  const newThickness = parseFloat(e.target.value);
                  console.log('Update door thickness:', newThickness);
                }}
                step="0.005"
                min="0.02"
                max="0.1"
                className="dimension-field"
              />
            </div>
          </div>
        </div>

        <div className="door-property">
          <label>Position on Wall:</label>
          <div className="position-controls">
            <div className="position-slider">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={door.position.x} // Normalized position along wall
                onChange={(e) => {
                  const newPosition = parseFloat(e.target.value);
                  // TODO: Update door position with drag-and-drop preview
                  console.log('Update door position:', newPosition);
                }}
                className="position-range"
              />
              <span className="position-value">
                {(door.position.x * 100).toFixed(0)}%
              </span>
            </div>
            <button
              className="drag-position-btn"
              onClick={() => {
                // Enter drag-and-drop positioning mode
                const housingComponent = getHousingComponent(objectId);
                if (housingComponent) {
                  const targetDoor = housingComponent.doors.find(d => d.id === doorId);
                  if (targetDoor) {
                    // Enable drag mode for door positioning
                    setHousingEditMode('door');
                    setSelectedDoorId(doorId);
                    
                    // Create position guides for visual feedback
                    const wall = housingComponent.walls.find(w => w.id === targetDoor.wallId);
                    if (wall) {
                      // Visual feedback: show valid positions along the wall
                      console.log('Created position guides for door:', doorId, 'on wall:', wall.id);
                    }
                  }
                }
              }}
              title="Drag door position in 3D view"
            >
              🎯 Drag Position
            </button>
          </div>
        </div>

        <div className="door-property">
          <label>Door Operation:</label>
          <div className="operation-controls">
            <div className="operation-setting">
              <label>Hinge Direction:</label>
              <select
                value={door.hingeDirection}
                onChange={(e) => {
                  const newDirection = e.target.value as 'left' | 'right';
                  // TODO: Update hinge direction with visual feedback
                  console.log('Update hinge direction:', newDirection);
                }}
              >
                <option value="left">Left Hinge</option>
                <option value="right">Right Hinge</option>
              </select>
            </div>
            <div className="operation-setting">
              <label>Open Direction:</label>
              <select
                value={door.openDirection}
                onChange={(e) => {
                  const newDirection = e.target.value as 'inward' | 'outward';
                  // TODO: Update open direction with visual feedback
                  console.log('Update open direction:', newDirection);
                }}
              >
                <option value="inward">Inward</option>
                <option value="outward">Outward</option>
              </select>
            </div>
            <div className="operation-setting">
              <label>Currently Open:</label>
              <input
                type="checkbox"
                checked={door.isOpen}
                onChange={(e) => {
                  // Toggle door open/closed state
                  console.log('Toggle door open state:', e.target.checked);
                }}
              />
            </div>
          </div>
        </div>

        <div className="door-property">
          <label>Auto-Cutout:</label>
          <div className="cutout-controls">
            <button
              className="cutout-btn"
              onClick={() => {
                // Regenerate door cutout using CSG
                const housingComponent = getHousingComponent(objectId);
                if (housingComponent) {
                  const targetDoor = housingComponent.doors.find(d => d.id === doorId);
                  if (targetDoor) {
                    // Force regeneration of the wall mesh with updated cutout
                    updateHousingComponent(objectId, housingComponent);
                    
                    // Force mesh regeneration
                    const sceneObject = sceneObjects.find(obj => obj.id === objectId);
                    if (sceneObject && sceneObject.mesh) {
                      sceneObject.mesh.dispose();
                      console.log('Regenerated door cutout for door:', doorId);
                    }
                  }
                }
              }}
            >
              🔄 Regenerate Cutout
            </button>
            <button
              className="cutout-btn"
              onClick={() => {
                // Preview cutout without applying
                const housingComponent = getHousingComponent(objectId);
                if (housingComponent) {
                  const targetDoor = housingComponent.doors.find(d => d.id === doorId);
                  if (targetDoor) {
                    // Create a preview mesh to show the cutout
                    console.log('Preview cutout for door:', doorId);
                    // The preview would be implemented in the scene manager
                  }
                }
              }}
            >
              👁️ Preview Cutout
            </button>
          </div>
        </div>

        <div className="door-actions">
          <button
            className="door-action-btn"
            onClick={() => {
              // Duplicate door to another wall
              console.log('Duplicate door to another wall');
            }}
          >
            📋 Duplicate
          </button>
          <button
            className="door-action-btn"
            onClick={() => {
              // Convert door type (e.g., single to double)
              console.log('Convert door type');
            }}
          >
            🔄 Convert Type
          </button>
          <button
            className="remove-component-btn"
            onClick={() => {
              if (window.confirm('Remove this door? This will also remove the wall cutout.')) {
                removeDoor(objectId, doorId);
              }
            }}
          >
            🗑️ Remove Door
          </button>
        </div>
      </div>
    );
  };

  const renderSelectedWindowProperties = (objectId: string, windowId: string) => {
    const window = getSelectedWindow(objectId);
    if (!window) return null;

    return (
      <div className="property-group selected-window-properties">
        <h5>Selected Window Properties</h5>
        
        <div className="window-property">
          <label>Window Type:</label>
          <select
            value={window.type}
            onChange={(e) => {
              // Update window type with auto-cutout regeneration
              const newType = e.target.value as any;
              // TODO: Implement window type update with CSG regeneration
              console.log('Update window type:', newType, '- regenerating cutout');
            }}
          >
            <option value="single">Single Window</option>
            <option value="double">Double Window</option>
            <option value="bay">Bay Window</option>
            <option value="casement">Casement Window</option>
            <option value="sliding">Sliding Window</option>
            <option value="skylight">Skylight</option>
          </select>
        </div>

        <div className="window-property">
          <label>Window Style:</label>
          <select
            value={window.material || 'standard'}
            onChange={(e) => {
              // Update window style/material
              console.log('Update window style:', e.target.value);
            }}
          >
            <option value="standard">Standard</option>
            <option value="arched">Arched</option>
            <option value="circular">Circular</option>
            <option value="stained-glass">Stained Glass</option>
            <option value="frosted">Frosted</option>
          </select>
        </div>

        <div className="window-property">
          <label>Dimensions:</label>
          <div className="dimension-controls">
            <div className="dimension-input">
              <label>Width:</label>
              <input
                type="number"
                value={window.width}
                onChange={(e) => {
                  const newWidth = parseFloat(e.target.value);
                  // TODO: Update window width with real-time cutout adjustment
                  console.log('Update window width:', newWidth);
                }}
                step="0.05"
                min="0.3"
                max="3.0"
                className="dimension-field"
              />
            </div>
            <div className="dimension-input">
              <label>Height:</label>
              <input
                type="number"
                value={window.height}
                onChange={(e) => {
                  const newHeight = parseFloat(e.target.value);
                  // TODO: Update window height with real-time cutout adjustment
                  console.log('Update window height:', newHeight);
                }}
                step="0.05"
                min="0.3"
                max="2.5"
                className="dimension-field"
              />
            </div>
            <div className="dimension-input">
              <label>Sill Height:</label>
              <input
                type="number"
                value={window.sillHeight}
                onChange={(e) => {
                  const newSillHeight = parseFloat(e.target.value);
                  // TODO: Update sill height with real-time preview
                  console.log('Update sill height:', newSillHeight);
                }}
                step="0.05"
                min="0.3"
                max="1.5"
                className="dimension-field"
              />
            </div>
          </div>
        </div>

        <div className="window-property">
          <label>Position on Wall:</label>
          <div className="position-controls">
            <div className="position-slider">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={window.position.x} // Normalized position along wall
                onChange={(e) => {
                  const newPosition = parseFloat(e.target.value);
                  // TODO: Update window position with drag-and-drop preview
                  console.log('Update window position:', newPosition);
                }}
                className="position-range"
              />
              <span className="position-value">
                {(window.position.x * 100).toFixed(0)}%
              </span>
            </div>
            <button
              className="drag-position-btn"
              onClick={() => {
                // Enter drag-and-drop positioning mode
                console.log('Enter drag-and-drop positioning mode');
              }}
              title="Drag window position in 3D view"
            >
              🎯 Drag Position
            </button>
          </div>
        </div>

        <div className="window-property">
          <label>Frame Settings:</label>
          <div className="frame-controls">
            <div className="frame-setting">
              <label>Has Frame:</label>
              <input
                type="checkbox"
                checked={window.hasFrame}
                onChange={(e) => {
                  // Toggle frame with real-time preview
                  console.log('Toggle window frame:', e.target.checked);
                }}
              />
            </div>
            {window.hasFrame && (
              <div className="frame-setting">
                <label>Frame Thickness:</label>
                <input
                  type="number"
                  value={window.frameThickness}
                  onChange={(e) => {
                    const newThickness = parseFloat(e.target.value);
                    console.log('Update frame thickness:', newThickness);
                  }}
                  step="0.005"
                  min="0.02"
                  max="0.1"
                  className="dimension-field"
                />
              </div>
            )}
            <div className="frame-setting">
              <label>Openable:</label>
              <input
                type="checkbox"
                checked={window.isOpen || false}
                onChange={(e) => {
                  // Toggle window open/closed state
                  console.log('Toggle window open state:', e.target.checked);
                }}
              />
            </div>
          </div>
        </div>

        <div className="window-property">
          <label>Auto-Cutout:</label>
          <div className="cutout-controls">
            <button
              className="cutout-btn"
              onClick={() => {
                // Regenerate window cutout using CSG
                const housingComponent = getHousingComponent(objectId);
                if (housingComponent) {
                  const targetWindow = housingComponent.windows.find(w => w.id === windowId);
                  if (targetWindow) {
                    // Force regeneration of the wall mesh with updated cutout
                    updateHousingComponent(objectId, housingComponent);
                    
                    // Force mesh regeneration
                    const sceneObject = sceneObjects.find(obj => obj.id === objectId);
                    if (sceneObject && sceneObject.mesh) {
                      sceneObject.mesh.dispose();
                      console.log('Regenerated window cutout for window:', windowId);
                    }
                  }
                }
              }}
            >
              🔄 Regenerate Cutout
            </button>
            <button
              className="cutout-btn"
              onClick={() => {
                // Preview cutout without applying
                const housingComponent = getHousingComponent(objectId);
                if (housingComponent) {
                  const targetWindow = housingComponent.windows.find(w => w.id === windowId);
                  if (targetWindow) {
                    // Create a preview mesh to show the cutout
                    console.log('Preview cutout for window:', windowId);
                    // The preview would be implemented in the scene manager
                  }
                }
              }}
            >
              👁️ Preview Cutout
            </button>
          </div>
        </div>

        <div className="window-actions">
          <button
            className="window-action-btn"
            onClick={() => {
              // Duplicate window to another wall
              console.log('Duplicate window to another wall');
            }}
          >
            📋 Duplicate
          </button>
          <button
            className="window-action-btn"
            onClick={() => {
              // Convert window type (e.g., single to double)
              console.log('Convert window type');
            }}
          >
            🔄 Convert Type
          </button>
          <button
            className="remove-component-btn"
            onClick={() => {
              if (confirm('Remove this window? This will also remove the wall cutout.')) {
                removeWindow(objectId, windowId);
              }
            }}
          >
            🗑️ Remove Window
          </button>
        </div>
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

      {/* Bulk Scale Operations */}
      <div className="property-group">
        <label>Bulk Scale:</label>
        <div className="bulk-scale-controls">
          <button
            onClick={() => {
              selectedObjects.forEach(obj => {
                updateObject(obj.id, { scale: new Vector3(1, 1, 1) });
              });
            }}
            className="bulk-action-btn"
          >
            Reset Scale
          </button>
          <button
            onClick={() => {
              selectedObjects.forEach(obj => {
                updateObject(obj.id, { scale: obj.scale.scale(1.5) });
              });
            }}
            className="bulk-action-btn"
          >
            Scale Up 1.5x
          </button>
          <button
            onClick={() => {
              selectedObjects.forEach(obj => {
                updateObject(obj.id, { scale: obj.scale.scale(0.75) });
              });
            }}
            className="bulk-action-btn"
          >
            Scale Down 0.75x
          </button>
        </div>
      </div>

      {/* Bulk Visibility Operations */}
      <div className="property-group">
        <label>Bulk Visibility:</label>
        <div className="bulk-visibility-controls">
          <button
            onClick={() => {
              selectedObjects.forEach(obj => {
                setObjectVisibility(obj.id, true);
              });
            }}
            className="bulk-action-btn"
          >
            👁️ Show All
          </button>
          <button
            onClick={() => {
              selectedObjects.forEach(obj => {
                setObjectVisibility(obj.id, false);
              });
            }}
            className="bulk-action-btn"
          >
            🚫 Hide All
          </button>
          <button
            onClick={() => {
              selectedObjects.forEach(obj => {
                const currentVisibility = isObjectVisible(obj.id);
                setObjectVisibility(obj.id, !currentVisibility);
              });
            }}
            className="bulk-action-btn"
          >
            🔄 Toggle Visibility
          </button>
        </div>
      </div>

      {/* Bulk Lock Operations */}
      <div className="property-group">
        <label>Bulk Lock/Unlock:</label>
        <div className="bulk-lock-controls">
          <button
            onClick={() => {
              selectedObjects.forEach(obj => {
                setObjectLocked(obj.id, true);
              });
              clearSelection(); // Clear selection since locked objects can't be selected
            }}
            className="bulk-action-btn"
          >
            🔒 Lock All
          </button>
          <button
            onClick={() => {
              selectedObjects.forEach(obj => {
                setObjectLocked(obj.id, false);
              });
            }}
            className="bulk-action-btn"
          >
            🔓 Unlock All
          </button>
          <button
            onClick={() => {
              selectedObjects.forEach(obj => {
                const currentLocked = isObjectLocked(obj.id);
                setObjectLocked(obj.id, !currentLocked);
              });
            }}
            className="bulk-action-btn"
          >
            🔄 Toggle Lock
          </button>
        </div>
      </div>

      {/* Bulk Transform Operations */}
      <div className="property-group">
        <label>Bulk Transform:</label>
        <div className="bulk-transform-controls">
          <button
            onClick={() => {
              selectedObjects.forEach(obj => {
                updateObject(obj.id, { 
                  position: new Vector3(obj.position.x, 0, obj.position.z),
                  rotation: new Vector3(0, obj.rotation.y, 0)
                });
              });
            }}
            className="bulk-action-btn"
          >
            📐 Align to Ground
          </button>
          <button
            onClick={() => {
              selectedObjects.forEach(obj => {
                updateObject(obj.id, { rotation: new Vector3(0, 0, 0) });
              });
            }}
            className="bulk-action-btn"
          >
            🔄 Reset Rotation
          </button>
          <button
            onClick={() => {
              const center = selectedObjects.reduce((acc, obj) => {
                return acc.add(obj.position);
              }, new Vector3(0, 0, 0)).scale(1 / selectedObjects.length);
              
              selectedObjects.forEach(obj => {
                updateObject(obj.id, { position: center.clone() });
              });
            }}
            className="bulk-action-btn"
          >
            📍 Stack at Center
          </button>
        </div>
      </div>

      {/* Bulk Delete */}
      <div className="property-group">
        <label>Bulk Actions:</label>
        <div className="bulk-actions">
          <button
            onClick={() => {
              if (confirm(`Delete ${selectedObjects.length} selected objects?`)) {
                selectedObjects.forEach(obj => {
                  removeObject(obj.id);
                });
                clearSelection();
              }
            }}
            className="bulk-action-btn danger"
          >
            🗑️ Delete All ({selectedObjects.length})
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
              <span className="object-status">
                {!isObjectVisible(obj.id) && '🚫'}
                {isObjectLocked(obj.id) && '🔒'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

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
            {renderGridProperties(selectedObject)}
            {renderTextureProperties(selectedObject)}
            {renderNurbsProperties(selectedObject)}
            {renderHousingProperties(selectedObject)}
          </>
        ) : (
          renderMultiSelectProperties()
        )}
      </div>
    </div>
  );
};
