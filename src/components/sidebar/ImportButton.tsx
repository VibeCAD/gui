import React, { useRef, useState } from 'react';
import { useSceneStore } from '../../state/sceneStore';

interface ImportButtonProps {
  onImport: (file: File) => Promise<void>;
  disabled?: boolean;
}

export const ImportButton: React.FC<ImportButtonProps> = ({ onImport, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const { isImporting } = useSceneStore();

  const handleClick = () => {
    setLocalError(null);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await onImport(file);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Failed to import file');
    }

    // Reset input to allow selecting the same file again
    event.target.value = '';
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.stl,.obj"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      
      <button 
        onClick={handleClick} 
        className="import-button"
        disabled={disabled || isImporting}
      >
        {isImporting ? (
          <>
            <span>⏳</span>
            Importing...
          </>
        ) : (
          <>
            <span>📥</span>
            Import 3D Model
          </>
        )}
      </button>

      {localError && (
        <div className="import-error">
          {localError}
        </div>
      )}
    </>
  );
}; 