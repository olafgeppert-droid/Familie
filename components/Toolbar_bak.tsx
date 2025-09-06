
import React, { useState, useRef, useEffect } from 'react';
import { SearchIcon } from './Icons';

interface ToolbarProps {
    onAddPerson: () => void;
    onOpenFindDialog: () => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    onImport: (file: File) => void;
    onExport: (format: 'json' | 'csv') => void;
    onPrint: () => void;
    onUndo: () => void;
    canUndo: boolean;
    onRedo: () => void;
    canRedo: boolean;
}

const ActionButton: React.FC<{
    label: string;
    emoji: string;
    onClick: () => void;
    disabled?: boolean;
    className?: string;
}> = ({ label, emoji, onClick, disabled = false, className = '' }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center justify-center bg-gray-200 hover:bg-gray-300 border border-gray-300/50 text-gray-800 font-medium py-2 px-3 rounded-md shadow-md hover:shadow-lg active:shadow-inner active:bg-gray-400 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed w-44 ${className}`}
    >
        <span className="mr-2 text-lg">{emoji}</span>
        <span>{label}</span>
    </button>
);

export const Toolbar: React.FC<ToolbarProps> = (props) => {
    const { 
        onAddPerson, onOpenFindDialog, searchTerm, onSearchChange, onImport, 
        onExport, onPrint, onUndo, canUndo, onRedo, canRedo
    } = props;
    const [isExportMenuOpen, setExportMenuOpen] = useState(false);
    const importRef = React.useRef<HTMLInputElement>(null);
    const exportMenuRef = React.useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setExportMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleImportClick = () => {
        importRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            onImport(event.target.files[0]);
            event.target.value = '';
        }
    };

    return (
        <div className="bg-gray-100 border-b border-gray-200 p-3 print:hidden z-10">
            <div className="flex flex-col items-center justify-center gap-3">
                {/* --- Row 1: Main Actions --- */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <ActionButton emoji="➕" label="Neue Person" onClick={onAddPerson} />
                    <ActionButton emoji="✍️" label="Ändern/Löschen" onClick={onOpenFindDialog} />
                    <ActionButton emoji="🖨️" label="Drucken" onClick={onPrint} />
                    <ActionButton emoji="📥" label="Import" onClick={handleImportClick} />
                    <div className="relative" ref={exportMenuRef}>
                        <ActionButton emoji="📤" label="Export" onClick={() => setExportMenuOpen(!isExportMenuOpen)} />
                        {isExportMenuOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border animate-fade-in">
                                <button onClick={() => { onExport('json'); setExportMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Als JSON exportieren</button>
                                <button onClick={() => { onExport('csv'); setExportMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Als CSV exportieren</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- Row 2: Undo/Redo and Search --- */}
                <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-4xl">
                    <ActionButton emoji="↩️" label="Rückgängig" onClick={onUndo} disabled={!canUndo} />
                    <div className="relative flex-grow min-w-[250px] max-w-md">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Person suchen (Name/Code)"
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="bg-gray-200 border border-black rounded-md py-2 pl-10 pr-4 w-full h-full focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        />
                    </div>
                    <ActionButton emoji="↪️" label="Wiederholen" onClick={onRedo} disabled={!canRedo} />
                </div>
            </div>
            
            <input
                type="file"
                ref={importRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept=".json,.csv"
            />
        </div>
    );
};
