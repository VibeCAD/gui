import React from 'react';
import { useSceneStore } from '../../state/sceneStore';
import './UndoRedoIndicator.css';

export const UndoRedoIndicator: React.FC = () => {
  const { canUndo, canRedo, undoHistory, redoHistory, undo, redo } = useSceneStore();

  const lastAction = undoHistory[undoHistory.length - 1];
  const lastUndoneAction = redoHistory[redoHistory.length - 1];

  return (
    <div className="undo-redo-indicator">
      <div className="undo-redo-buttons">
        <button 
          className={`undo-btn ${canUndo ? 'enabled' : 'disabled'}`}
          onClick={undo}
          disabled={!canUndo}
          title={canUndo ? `Undo ${lastAction?.type}` : 'Nothing to undo'}
        >
          ↶ Undo
        </button>
        
        <button 
          className={`redo-btn ${canRedo ? 'enabled' : 'disabled'}`}
          onClick={redo}
          disabled={!canRedo}
          title={canRedo ? `Redo ${lastUndoneAction?.type}` : 'Nothing to redo'}
        >
          ↷ Redo
        </button>
      </div>
      
      <div className="undo-redo-info">
        <span className="history-count">
          {undoHistory.length} action{undoHistory.length !== 1 ? 's' : ''} in history
        </span>
        {lastAction && (
          <span className="last-action">
            Last: {formatActionType(lastAction.type)}
          </span>
        )}
      </div>
      
      <div className="keyboard-hints">
        <span className="hint">⌘Z to undo</span>
        <span className="hint">⌘⇧Z to redo</span>
      </div>
    </div>
  );
};

const formatActionType = (type: string): string => {
  switch (type) {
    case 'ADD_OBJECT': return 'Add Object';
    case 'REMOVE_OBJECT': return 'Delete Object';
    case 'UPDATE_OBJECT': return 'Update Object';
    case 'SET_OBJECT_LOCKED': return 'Lock/Unlock';
    case 'SET_OBJECT_VISIBILITY': return 'Show/Hide';
    case 'BATCH_DELETE': return 'Delete Multiple';
    case 'BATCH_ADD': return 'Add Multiple';
    default: return type.replace(/_/g, ' ');
  }
}; 