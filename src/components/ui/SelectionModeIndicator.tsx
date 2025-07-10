import React, { useEffect, useState } from 'react';
import './SelectionModeIndicator.css';

interface SelectionModeIndicatorProps {
  isVisible: boolean;
}

export const SelectionModeIndicator: React.FC<SelectionModeIndicatorProps> = ({ isVisible }) => {
  const [isCtrlHeld, setIsCtrlHeld] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        setIsCtrlHeld(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        setIsCtrlHeld(false);
      }
    };

    // Handle focus events to reset state when window loses focus
    const handleBlur = () => {
      setIsCtrlHeld(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  if (!isVisible || !isCtrlHeld) {
    return null;
  }

  return (
    <div className="selection-mode-indicator">
      <div className="indicator-content">
        <span className="indicator-icon">⚡</span>
        <span className="indicator-text">Multi-Select Mode</span>
        <span className="indicator-hint">Click objects to add to selection</span>
      </div>
    </div>
  );
}; 