// src/App.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { TableView } from './components/TableView';
import { TreeView } from './components/TreeView';
import { StatisticsView } from './components/StatisticsView';
import { PersonDialog } from './components/PersonDialog';
import { HelpDialog } from './components/HelpDialog';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { useFamilyData } from './hooks/useFamilyData';
import type { Person, View, PersonFormData } from './types';
import { generatePersonCode, getCodeRecalculation } from './services/familyTreeService';
import { exportData, importData } from './services/dataService';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { FindPersonDialog } from './components/FindPersonDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { printView } from './services/printService';
import { WelcomeScreen } from './components/WelcomeScreen';
import { WappenInfo } from './components/WappenInfo';
import { validateData } from './services/validateData';
import { ValidationDialog } from './components/ValidationDialog';

import type { ValidationError } from './services/validateData';
import packageJson from './package.json';

export interface AppColors {
  header: string;
  sidebar: string;
}

const defaultColors: AppColors = {
  header: '#1665d8',
  sidebar: '#cae2fc',
};

const App: React.FC = () => {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useFamilyData();
  const version = packageJson.version;

  const [appState, setAppState] = useState<'welcome' | 'info' | 'database'>('welcome');
  const [currentView, setCurrentView] = useState<View>('table');
  const [isPersonDialogOpen, setPersonDialogOpen] = useState(false);
  const [isHelpDialogOpen, setHelpDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isResetDialogOpen, setResetDialogOpen] = useState(false);
  const [isFindPersonDialogOpen, setFindPersonDialogOpen] = useState(false);
  const [isLoadSampleDataDialogOpen, setLoadSampleDataDialogOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const [colors, setColors] = useState<AppColors>(() => {
    try {
      const storedColors = localStorage.getItem('appColors');
      return storedColors ? JSON.parse(storedColors) : defaultColors;
    } catch (e) {
      console.warn('Could not load colors from local storage', e);
      return defaultColors;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('appColors', JSON.stringify(colors));
    } catch (e) {
      console.warn('Could not save colors to local storage', e);
    }
  }, [colors]);

  // Validation after data changes - ONLY when in database mode
  useEffect(() => {
    if (appState === 'database') {
      try {
        const errors = validateData(state.people);
        setValidationErrors(errors);
      } catch (error) {
        console.error('Validation error:', error);
        setValidationErrors([{
          personId: 'validation-error',
          message: 'Fehler bei der Datenvalidierung',
          severity: 'error'
        }]);
      }
    } else {
      setValidationErrors([]);
    }
  }, [state.people, appState]);

  // ✅ Debug-Funktion zum Zurücksetzen
  const resetApp = () => {
    if (confirm('Wirklich alle Daten zurücksetzen und Willkommens-Bildschirm anzeigen?')) {
      localStorage.removeItem('familyTreeState');
      localStorage.removeItem('databaseHasBeenInitialized');
      localStorage.removeItem('appColors');
      window.location.reload();
    }
  };

  const handleAddPerson = () => {
    setEditingPerson(null);
    setPersonDialogOpen(true);
  };

  const handleEditPerson = (person: Person) => {
    setEditingPerson(person);
    setPersonDialogOpen(true);
  };

  const handleFindAndOpenForEditing = (term: string) => {
    if (!term.trim()) {
      alert('Bitte gib einen Namen oder Code ein.');
      return;
    }
    const lowerCaseTerm = term.toLowerCase();
    const foundPerson = state.people.find(
      (p) =>
        p.name.toLowerCase().includes(lowerCaseTerm) ||
        p.code.toLowerCase().includes(lowerCaseTerm)
    );

    if (foundPerson) {
      handleEditPerson(foundPerson);
    } else {
      alert(`Keine Person mit dem Namen oder Code "${term}" gefunden.`);
    }
    setFindPersonDialogOpen(false);
  };

  const handleDeleteRequest = (person: Person) => {
    setPersonToDelete(person);
    setPersonDialogOpen(false);
  };

  const confirmDeletePerson = () => {
    if (personToDelete) {
      dispatch({ type: 'DELETE_PERSON', payload: personToDelete.id });
      setPersonToDelete(null);
      setCurrentView('table');
    }
  };

  const handleSavePerson = (personData: PersonFormData) => {
    // Geschlecht direkt übernehmen
    const gender = personData.gender;

    if (personData.id) {
      // Bearbeiten einer bestehenden Person
      const basePerson = { ...editingPerson!, ...personData, gender };

      let newRingCode = basePerson.code;
      if (personData.inheritedFrom && personData.inheritedFrom !== basePerson.inheritedFrom) {
        const inheritedFromPerson = state.people.find((p) => p.code === personData.inheritedFrom);
        if (inheritedFromPerson) {
          newRingCode = `${inheritedFromPerson.ringCode} → ${basePerson.code}`;
        }
      } else if (!personData.inheritedFrom) {
        newRingCode = basePerson.code;
      } else {
        newRingCode = basePerson.ringCode;
      }

      const updatedPerson: Person = { ...basePerson, ringCode: newRingCode };
      dispatch({ type: 'UPDATE_PERSON', payload: updatedPerson });
    } else {
      // ✅ KORRIGIERT: Keine temporäre ID verwenden
      const newPersonBase: Omit<Person, 'id'> = {
        ...personData,
        code: '',
        ringCode: '',
        ringHistory: [],
        gender,
      };

      const newCode = generatePersonCode(newPersonBase, state.people);
      
      // ✅ RICHTIG: ID wird vom Reducer/State verwaltet
      const newPerson: Person = {
        ...newPersonBase,
        id: '', // Leere ID - wird im Reducer gesetzt
        code: newCode,
        ringCode: newCode,
      };

      if (personData.inheritedFrom) {
        const inheritedFromPerson = state.people.find((p) => p.code === personData.inheritedFrom);
        if (inheritedFromPerson) {
          newPerson.ringCode = `${inheritedFromPerson.ringCode} → ${newPerson.code}`;
        }
      }

      const { updates } = getCodeRecalculation(newPerson, state.people);

      if (updates.length > 0) {
        dispatch({
          type: 'ADD_PERSON_WITH_RECALCULATION',
          payload: { newPerson, updates },
        });
      } else {
        dispatch({ type: 'ADD_PERSON', payload: newPerson });
      }
    }

    setPersonDialogOpen(false);
    setCurrentView('table');
  };

  const handleImport = async (file: File) => {
    try {
      const importedPeople = await importData(file);
      dispatch({ type: 'SET_DATA', payload: importedPeople });
      setCurrentView('table');
      setAppState('database'); // ✅ Explizit in Datenbank-Modus wechseln
      alert('Daten erfolgreich importiert!');
    } catch (error) {
      console.error(error);
      alert(`Fehler beim Import: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  };

  const handleExport = (format: 'json' | 'csv') => {
    exportData(state.people, format);
  };

  const confirmReset = () => {
    dispatch({ type: 'RESET_PERSON_DATA' });
    setResetDialogOpen(false);
    setSearchTerm('');
    setCurrentView('table');
    setAppState('database');
  };

  const handlePrint = () => {
    const printDateElement = document.querySelector('#printable-area .print-header p');
    if (printDateElement) {
      printDateElement.textContent = `Stand: ${new Date().toLocaleString('de-DE')} | Version ${version}`;
    }
    printView('printable-area');
  };

  const handleLoadSampleDataRequest = () => {
    setSettingsDialogOpen(false);
    setLoadSampleDataDialogOpen(true);
  };

  const confirmLoadSampleData = () => {
    dispatch({ type: 'LOAD_SAMPLE_DATA' });
    setLoadSampleDataDialogOpen(false);
    setSearchTerm('');
    setCurrentView('table');
    setAppState('database');
  };

  const filteredPeople = useMemo(() => {
    if (!searchTerm) return state.people;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return state.people.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerSearchTerm) ||
        p.code.toLowerCase().includes(lowerSearchTerm)
    );
  }, [state.people, searchTerm]);

  const MainViewComponent = useMemo(() => {
    switch (currentView) {
      case 'tree':
        return <TreeView people={state.people} onEdit={handleEditPerson} />;
      case 'stats':
        return <StatisticsView people={state.people} />;
      case 'table':
      default:
        return (
          <TableView
            people={filteredPeople}
            onEdit={handleEditPerson}
            searchTerm={searchTerm}
          />
        );
    }
  }, [currentView, state.people, filteredPeople, searchTerm]);

  if (appState === 'welcome') {
    return (
      <WelcomeScreen
        onShowDatabase={() => setAppState('database')}
        onShowInfo={() => setAppState('info')}
        version={version}
      />
    );
  }

  if (appState === 'info') {
    return <WappenInfo onShowDatabase={() => setAppState('database')} />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Header version={version} color={colors.header} />

      <div className="flex-grow flex overflow-hidden">
        <Sidebar
          currentView={currentView}
          onSetView={setCurrentView}
          onHelp={() => setHelpDialogOpen(true)}
          onSettings={() => setSettingsDialogOpen(true)}
          onGoToWelcome={() => setAppState('welcome')}
          onResetApp={resetApp} // ✅ Reset-Funktion hinzufügen
          color={colors.sidebar}
        />
        <div className="flex-grow flex flex-col overflow-hidden">
          <Toolbar
            onAddPerson={handleAddPerson}
            onOpenFindDialog={() => setFindPersonDialogOpen(true)}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onImport={handleImport}
            onExport={handleExport}
            onPrint={handlePrint}
            onUndo={undo}
            canUndo={canUndo}
            onRedo={redo}
            canRedo={canRedo}
          />
          <main className="flex-grow p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <div id="printable-area">
              <div className="print-header hidden">
                <h1 className="text-3xl font-bold text-center">
                  Wappenringe der Familie GEPPERT
                </h1>
                <p className="text-center text-sm"></p>
              </div>
              {MainViewComponent}
            </div>
          </main>
        </div>
      </div>

      <PersonDialog
        isOpen={isPersonDialogOpen}
        onClose={() => setPersonDialogOpen(false)}
        onSave={handleSavePerson}
        onDelete={handleDeleteRequest}
        person={editingPerson}
        people={state.people}
      />

      <HelpDialog isOpen={isHelpDialogOpen} onClose={() => setHelpDialogOpen(false)} />

      <SettingsDialog
        isOpen={isSettingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        onReset={() => {
          setSettingsDialogOpen(false);
          setResetDialogOpen(true);
        }}
        onLoadSampleData={handleLoadSampleDataRequest}
        colors={colors}
        onColorsChange={setColors}
      />

      <ConfirmationDialog
        isOpen={!!personToDelete}
        onClose={() => setPersonToDelete(null)}
        onConfirm={confirmDeletePerson}
        title="Person löschen"
        message={`Möchtest du "${personToDelete?.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />

      <ConfirmationDialog
        isOpen={isResetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        onConfirm={confirmReset}
        title="Alle Personendaten löschen"
        message="Sollen wirklich alle Personen gelöscht werden?"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />

      <ConfirmationDialog
        isOpen={isLoadSampleDataDialogOpen}
        onClose={() => setLoadSampleDataDialogOpen(false)}
        onConfirm={confirmLoadSampleData}
        title="Beispieldaten laden"
        message="Achtung: Dies überschreibt deine gesamte aktuelle Datenbank! Möchtest du fortfahren? Es wird empfohlen, vorher deine Daten zu exportieren."
        confirmButtonClass="bg-yellow-500 hover:bg-yellow-600"
      />

      <FindPersonDialog
        isOpen={isFindPersonDialogOpen}
        onClose={() => setFindPersonDialogOpen(false)}
        onFind={handleFindAndOpenForEditing}
      />

      <ValidationDialog
        isOpen={validationErrors.length > 0}
        errors={validationErrors}
        onClose={() => setValidationErrors([])}
      />
    </div>
  );
};

export default App;
