import React, { useState } from 'react';
import { Vector3 } from 'babylonjs';
import { useSceneStore } from '../../state/sceneStore';
import type { SceneObject, ParametricWallObject, Opening, DoorOpening, WindowOpening, RoundWindowOpening } from '../../types/types';

export const PropertiesPanel: React.FC = () => {
  const {
    sceneObjects,
    selectedObjectId,
    selectedObjectIds,
    tessellationQuality,
    controlPointVisualizations,
    selectedControlPointIndex,
    updateObject,
    setTessellationQuality,
    setSelectedControlPointIndex,
    getSelectedObject,
    getSelectedObjects,
    hasSelection,
    // Parametric wall actions
    updateParametricWall,
    addOpeningToWall,
    updateOpeningInWall,
    removeOpeningFromWall,
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

const renderParametricWallProperties = (obj: ParametricWallObject) => {
  const {
    updateParametricWall,
    addOpeningToWall,
    updateOpeningInWall,
    removeOpeningFromWall,
  } = useSceneStore.getState();

  const [wallParams, setWallParams] = useState(obj.params);

  // Update local state on prop change
  React.useEffect(() => {
    setWallParams(obj.params);
  }, [obj.params]);

  const handleParamChange = (field: keyof typeof wallParams, value: number) => {
    setWallParams(prev => ({ ...prev, [field]: value }));
  };

  const applyParamChanges = () => {
    updateParametricWall(obj.id, wallParams);
  };

  const handleOpeningPropertyChange = (openingId: string, field: 'width' | 'height' | 'radius', value: number) => {
      const updatedOpenings = wallParams.openings.map(o => o.id === openingId ? { ...o, [field]: value } : o);
      setWallParams(prev => ({ ...prev, openings: updatedOpenings }));
  };

  const handleOpeningPositionChange = (openingId: string, axis: 'x' | 'y' | 'z', value: number) => {
      const updatedOpenings = wallParams.openings.map(o => {
          if (o.id === openingId) {
              const newPosition = o.position.clone();
              (newPosition as any)[axis] = value;
              return { ...o, position: newPosition };
          }
          return o;
      });
      setWallParams(prev => ({ ...prev, openings: updatedOpenings }));
  }

  const applyOpeningChanges = (openingId: string) => {
    const opening = wallParams.openings.find(o => o.id === openingId);
    if (opening) updateOpeningInWall(obj.id, opening);
  };

  const handleAddOpening = (type: 'door' | 'window' | 'roundWindow') => {
      let newOpening: Omit<Opening, 'id'>;
      const wallHeight = wallParams.height;
      switch (type) {
          case 'door':
              // Place door on the floor
              newOpening = { type: 'door', width: 0.9, height: 2.1, position: new Vector3(0, (-wallHeight / 2) + (2.1 / 2), 0) } as Omit<DoorOpening, 'id'>;
              break;
          case 'window':
                newOpening = { type: 'window', width: 1.2, height: 1.2, position: new Vector3(0, 0, 0) } as Omit<WindowOpening, 'id'>;
                break;
          case 'roundWindow':
                newOpening = { type: 'roundWindow', radius: 0.5, position: new Vector3(0, 0, 0) } as Omit<RoundWindowOpening, 'id'>;
                break;
      }
    addOpeningToWall(obj.id, newOpening);
  };

  const handleRemoveOpening = (openingId: string) => {
    removeOpeningFromWall(obj.id, openingId);
  };

  return (
    <div className="properties-section">
      <h4>Parametric Wall Properties</h4>
      
      <div className="property-group">
        <label>Width:</label>
        <input
          type="number"
          value={wallParams.width}
          onChange={(e) => handleParamChange('width', parseFloat(e.target.value))}
          onBlur={applyParamChanges}
          step="0.1"
        />
      </div>
      
      <div className="property-group">
        <label>Height:</label>
        <input
          type="number"
          value={wallParams.height}
          onChange={(e) => handleParamChange('height', parseFloat(e.target.value))}
          onBlur={applyParamChanges}
          step="0.1"
        />
      </div>
      
      <div className="property-group">
        <label>Thickness:</label>
        <input
          type="number"
          value={wallParams.thickness}
          onChange={(e) => handleParamChange('thickness', parseFloat(e.target.value))}
          onBlur={applyParamChanges}
          step="0.1"
        />
      </div>
      
      <h5>Openings</h5>
      <div className="add-opening-buttons">
          <button onClick={() => handleAddOpening('door')}>Add Door</button>
          <button onClick={() => handleAddOpening('window')}>Add Window</button>
          <button onClick={() => handleAddOpening('roundWindow')}>Add Round Window</button>
      </div>
      {(wallParams.openings || []).map((opening) => (
        <div key={opening.id} className="opening-editor">
          <h6>{opening.type}</h6>
          <div className="property-group">
            <label>Position X:</label>
            <input
              type="number"
              value={opening.position.x.toFixed(2)}
              onChange={(e) => handleOpeningPositionChange(opening.id, 'x', parseFloat(e.target.value))}
              onBlur={() => applyOpeningChanges(opening.id)}
              step="0.1"
            />
          </div>
            <div className="property-group">
            <label>Position Y:</label>
            <input
              type="number"
              value={opening.position.y.toFixed(2)}
              onChange={(e) => handleOpeningPositionChange(opening.id, 'y', parseFloat(e.target.value))}
              onBlur={() => applyOpeningChanges(opening.id)}
              step="0.1"
            />
          </div>
          {'width' in opening && 
              <div className="property-group">
              <label>Width:</label>
              <input
                  type="number"
                  value={opening.width}
                  onChange={(e) => handleOpeningPropertyChange(opening.id, 'width', parseFloat(e.target.value))}
                  onBlur={() => applyOpeningChanges(opening.id)}
                  step="0.1"
              />
              </div>
          }
          {'height' in opening &&
              <div className="property-group">
              <label>Height:</label>
              <input
                  type="number"
                  value={opening.height}
                  onChange={(e) => handleOpeningPropertyChange(opening.id, 'height', parseFloat(e.target.value))}
                  onBlur={() => applyOpeningChanges(opening.id)}
                  step="0.1"
              />
              </div>
          }
          {'radius' in opening &&
              <div className="property-group">
              <label>Radius:</label>
              <input
                  type="number"
                  value={opening.radius}
                  onChange={(e) => handleOpeningPropertyChange(opening.id, 'radius', parseFloat(e.target.value))}
                  onBlur={() => applyOpeningChanges(opening.id)}
                  step="0.1"
              />
              </div>
          }
          <button onClick={() => handleRemoveOpening(opening.id)}>
            Remove
          </button>
        </div>
      ))}
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
            {selectedObject.type === 'parametric-wall' && renderParametricWallProperties(selectedObject as ParametricWallObject)}
          </>
        ) : (
          renderMultiSelectProperties()
        )}
      </div>
    </div>
  );
};
