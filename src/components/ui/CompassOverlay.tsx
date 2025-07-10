import React from 'react';

interface CompassOverlayProps {
  className?: string;
}

export const CompassOverlay: React.FC<CompassOverlayProps> = ({ className = '' }) => {
  // For now, we'll show a static compass. In the future, this could be dynamic based on camera rotation
  // The compass shows world-space directions: North = +Z, East = +X, South = -Z, West = -X
  
  return (
    <div className={`fixed top-4 right-4 bg-black bg-opacity-70 rounded-lg p-3 text-white text-sm font-mono select-none pointer-events-none z-50 ${className}`}>
      <div className="flex flex-col items-center space-y-1">
        <div className="text-xs text-gray-300 mb-1">Compass</div>
        <div className="relative w-12 h-12">
          {/* Compass circle */}
          <div className="absolute inset-0 border-2 border-gray-400 rounded-full"></div>
          
          {/* North indicator */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1">
            <div className="w-0 h-0 border-l-2 border-r-2 border-b-3 border-transparent border-b-red-400"></div>
            <div className="text-xs text-red-400 font-bold text-center mt-0.5">N</div>
          </div>
          
          {/* East indicator */}
          <div className="absolute right-0 top-1/2 transform translate-x-1 -translate-y-1/2">
            <div className="w-0 h-0 border-t-2 border-b-2 border-l-3 border-transparent border-l-blue-400"></div>
            <div className="text-xs text-blue-400 font-bold text-center ml-1">E</div>
          </div>
          
          {/* South indicator */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1">
            <div className="text-xs text-green-400 font-bold text-center mb-0.5">S</div>
            <div className="w-0 h-0 border-l-2 border-r-2 border-t-3 border-transparent border-t-green-400"></div>
          </div>
          
          {/* West indicator */}
          <div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2">
            <div className="text-xs text-yellow-400 font-bold text-center mr-1">W</div>
            <div className="w-0 h-0 border-t-2 border-b-2 border-r-3 border-transparent border-r-yellow-400"></div>
          </div>
          
          {/* Center dot */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-gray-300 rounded-full"></div>
        </div>
        
        {/* Direction legend */}
        <div className="text-xs text-gray-400 text-center leading-tight">
          <div>N: +Z</div>
          <div>E: +X</div>
        </div>
      </div>
    </div>
  );
}; 