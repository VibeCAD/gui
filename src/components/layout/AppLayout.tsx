import React from 'react';
import { TopToolbar } from '../toolbar/TopToolbar';
import { AISidebar } from '../sidebar/AISidebar';

interface AppLayoutProps {
    children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
    return (
        <div className="app-container">
            <TopToolbar />
            <div className="main-content">
                {children}
            </div>
        </div>
    );
};
