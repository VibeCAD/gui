import React from 'react';
import { Vector3 } from 'babylonjs';
import { useSceneStore } from '../../state/sceneStore';
import type { SceneObject, ModularHousingObject, Door, Window, Wall } from '../../types/types';

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
              // Update wall type logic would go here
              console.log('Update wall type:', e.target.value);
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
          <input
            type="number"
            value={wall.thickness}
            onChange={(e) => changeWallThickness(objectId, parseFloat(e.target.value), wallId)}
            step="0.05"
            min="0.1"
            max="1.0"
          />
        </div>

        <div className="wall-property">
          <label>Wall Height:</label>
          <input
            type="number"
            value={wall.height}
            onChange={(e) => {
              // Update wall height logic would go here
              console.log('Update wall height:', e.target.value);
            }}
            step="0.1"
            min="2.0"
            max="5.0"
          />
        </div>

        <div className="wall-property">
          <label>Load Bearing:</label>
          <input
            type="checkbox"
            checked={wall.isLoadBearing}
            onChange={(e) => {
              // Update load bearing status
              console.log('Update load bearing:', e.target.checked);
            }}
          />
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
              // Update door type logic would go here
              console.log('Update door type:', e.target.value);
            }}
          >
            <option value="single">Single</option>
            <option value="double">Double</option>
            <option value="sliding">Sliding</option>
            <option value="french">French</option>
            <option value="garage">Garage</option>
          </select>
        </div>

        <div className="door-property">
          <label>Width:</label>
          <input
            type="number"
            value={door.width}
            onChange={(e) => {
              // Update door width logic would go here
              console.log('Update door width:', e.target.value);
            }}
            step="0.1"
            min="0.6"
            max="3.0"
          />
        </div>

        <div className="door-property">
          <label>Height:</label>
          <input
            type="number"
            value={door.height}
            onChange={(e) => {
              // Update door height logic would go here
              console.log('Update door height:', e.target.value);
            }}
            step="0.1"
            min="1.8"
            max="3.0"
          />
        </div>

        <div className="door-property">
          <label>Hinge Direction:</label>
          <select
            value={door.hingeDirection}
            onChange={(e) => {
              // Update hinge direction logic would go here
              console.log('Update hinge direction:', e.target.value);
            }}
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </div>

        <div className="door-property">
          <label>Open Direction:</label>
          <select
            value={door.openDirection}
            onChange={(e) => {
              // Update open direction logic would go here
              console.log('Update open direction:', e.target.value);
            }}
          >
            <option value="inward">Inward</option>
            <option value="outward">Outward</option>
          </select>
        </div>

        <button 
          className="remove-component-btn"
          onClick={() => removeDoor(objectId, doorId)}
        >
          Remove Door
        </button>
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
              // Update window type logic would go here
              console.log('Update window type:', e.target.value);
            }}
          >
            <option value="single">Single</option>
            <option value="double">Double</option>
            <option value="bay">Bay</option>
            <option value="casement">Casement</option>
            <option value="sliding">Sliding</option>
            <option value="skylight">Skylight</option>
          </select>
        </div>

        <div className="window-property">
          <label>Width:</label>
          <input
            type="number"
            value={window.width}
            onChange={(e) => {
              // Update window width logic would go here
              console.log('Update window width:', e.target.value);
            }}
            step="0.1"
            min="0.5"
            max="3.0"
          />
        </div>

        <div className="window-property">
          <label>Height:</label>
          <input
            type="number"
            value={window.height}
            onChange={(e) => {
              // Update window height logic would go here
              console.log('Update window height:', e.target.value);
            }}
            step="0.1"
            min="0.5"
            max="2.5"
          />
        </div>

        <div className="window-property">
          <label>Sill Height:</label>
          <input
            type="number"
            value={window.sillHeight}
            onChange={(e) => {
              // Update sill height logic would go here
              console.log('Update sill height:', e.target.value);
            }}
            step="0.1"
            min="0.5"
            max="1.5"
          />
        </div>

        <div className="window-property">
          <label>Has Frame:</label>
          <input
            type="checkbox"
            checked={window.hasFrame}
            onChange={(e) => {
              // Update frame status logic would go here
              console.log('Update has frame:', e.target.checked);
            }}
          />
        </div>

        <button 
          className="remove-component-btn"
          onClick={() => removeWindow(objectId, windowId)}
        >
          Remove Window
        </button>
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
