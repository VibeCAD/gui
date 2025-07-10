import React from 'react';
import { useSceneStore } from '../../state/sceneStore';
import { ToolbarDropdown } from './ToolbarDropdown';

export const TopToolbar: React.FC = () => {
    const { activeDropdown, setActiveDropdown, selectedObjectId, walls, enterAddOpeningMode } = useSceneStore();
    const { undo, redo } = (useSceneStore as any).temporal.getState();

    const toggleDropdown = (dropdownName: string) => {
        setActiveDropdown(activeDropdown === dropdownName ? null : dropdownName);
    };

    const handleAddOpening = (type: 'door' | 'window') => {
        if (selectedObjectId) {
            enterAddOpeningMode(selectedObjectId, type);
            setActiveDropdown(null); // Close dropdown after action
        } else {
            alert("Please select a wall first.");
        }
    };

    const isWallSelected = walls.some(wall => wall.id === selectedObjectId);

    return (
        <div className="top-toolbar">
            <div className="toolbar-menu">
                <div className="toolbar-brand">VibeCad</div>
                <div className="toolbar-item">
                    <button onClick={() => undo()}>Undo</button>
                    <button onClick={() => redo()}>Redo</button>
                </div>
                <div className="toolbar-item">
                    <button 
                        className="toolbar-button"
                        onClick={() => toggleDropdown('create-opening')}
                    >
                        Openings <span className="dropdown-arrow">▼</span>
                    </button>
                    <ToolbarDropdown name="create-opening">
                        <div className="dropdown-section">
                            <div className="dropdown-section-title">Add Opening</div>
                            <div className="dropdown-grid">
                                <button 
                                    className="dropdown-button" 
                                    onClick={() => handleAddOpening('door')}
                                    disabled={!isWallSelected}
                                    title={isWallSelected ? "Add a door to the selected wall" : "Select a wall to add a door"}
                                >
                                    <span className="dropdown-icon">🚪</span>
                                    Add Door
                                </button>
                                <button 
                                    className="dropdown-button"
                                    onClick={() => handleAddOpening('window')}
                                    disabled={!isWallSelected}
                                    title={isWallSelected ? "Add a window to the selected wall" : "Select a wall to add a window"}
                                >
                                    <span className="dropdown-icon">🪟</span>
                                    Add Window
                                </button>
                            </div>
                        </div>
                    </ToolbarDropdown>
                </div>
            </div>
        </div>
    );
};
