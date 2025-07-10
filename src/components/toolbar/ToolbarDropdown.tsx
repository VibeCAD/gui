import React from 'react';
import { useSceneStore } from '../../state/sceneStore';

interface ToolbarDropdownProps {
    name: string;
    children: React.ReactNode;
}

export const ToolbarDropdown: React.FC<ToolbarDropdownProps> = ({ name, children }) => {
    const { activeDropdown } = useSceneStore();

    if (activeDropdown !== name) {
        return null;
    }

    return (
        <div className={`dropdown-menu show`}>
            {children}
        </div>
    );
};
