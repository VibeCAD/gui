import React, { useState } from 'react';

interface ExportButtonProps {
  onExport: () => Promise<void>;
  disabled?: boolean;
  objectCount?: number;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ 
  onExport, 
  disabled = false,
  objectCount = 0 
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (isExporting || disabled || objectCount === 0) return;
    
    setIsExporting(true);
    setError(null);
    
    try {
      await onExport();
      // Success - error handling is done in the parent component
    } catch (err) {
      console.error('Export error:', err);
      setError('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const getButtonText = () => {
    if (isExporting) return 'Exporting...';
    if (objectCount === 0) return 'No Objects to Export';
    return `Export to STL (${objectCount} object${objectCount !== 1 ? 's' : ''})`;
  };

  const isButtonDisabled = disabled || isExporting || objectCount === 0;

  return (
    <div className="export-button-container">
      <button
        className={`export-button ${isButtonDisabled ? 'disabled' : ''}`}
        onClick={handleClick}
        disabled={isButtonDisabled}
        title={objectCount === 0 ? 'Add objects to the scene to export' : 'Export all objects as STL file'}
      >
        <span className="button-icon">💾</span>
        <span className="button-text">{getButtonText()}</span>
      </button>
      
      {error && (
        <div className="export-error">
          {error}
        </div>
      )}
    </div>
  );
}; 