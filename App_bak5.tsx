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

// 🔽 Version aus package.json importieren
import packageJson from './package.json';

export interface AppColors {
  header: string;
  sidebar: string;
}

const defaultColors: AppColors = {
  header: '#1665d8', // brand-header
  sidebar: '#cae2fc', // brand-sidebar
};

const App: React.FC = () => {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useFamilyData();
  const { people } = state;
  const version = packageJson.version; // 🔽 Version aus package.json verwenden

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
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const [colors, setColors] = useState<AppColors>(() => {
    try {
      const storedColors = localStorage.getItem('appColors');
      return storedColors ? JSON.parse(storedColors) : defaultColors;
    } catch (e) {
      console.warn('Could not load colors from local storage', e);
      return defaultColors;
    }
  });

  // 🔄 forceUpdate Hook für sanfte Aktualisierung
  const [, setTick] = useState(0);
  const forceUpdate = () => setTick((t) => t + 1);

  useEffect(() => {
    try {
      localStorage.setItem('appColors', JSON.stringify(colors));
    } catch (e) {
      console.warn('Could not save colors to local storage', e);
    }
  }, [colors]);

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
    const foundPerson = people.find(
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

      const errors = validateData(state.people);
      if (errors.length > 0) {
        setValidationErrors(errors);
      }

      forceUpdate();
    }
  };

  const handleSavePerson = (personData: PersonFormData) => {
    if (personData.id) {
      const basePerson = { ...editingPerson!, ...personData };

      let newRingCode = basePerson.code;
      if (personData.inheritedFrom && personData.inheritedFrom !== basePerson.inheritedFrom) {
        const inheritedFromPerson = people.find((p) => p.code === personData.inheritedFrom);
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
      const tempId = `temp-${Date.now()}`;
      const newPersonBase: Person = {
        ...personData,
        id: tempId,
        code: '',
        ringCode: '',
        ringHistory: [],
      };

      const newCode = generatePersonCode(newPersonBase, people);
      newPersonBase.code = newCode;
      newPersonBase.ringCode = newCode;

      if (personData.inheritedFrom) {
        const inheritedFromPerson = people.find((p) => p.code === personData.inheritedFrom);
        if (inheritedFromPerson) {
          newPersonBase.ringCode = `${inheritedFromPerson.ringCode} → ${newPersonBase.code}`;
        }
      }

      const { updates } = getCodeRecalculation(newPersonBase, people);

      if (updates.length > 0) {
        dispatch({
          type: 'ADD_PERSON_WITH_RECALCULATION',
          payload: { newPerson: newPersonBase, updates },
        });
      } else {
        dispatch({ type: 'ADD_PERSON', payload: newPersonBase });
      }
    }

    const errors = validateData(state.people);
    if (errors.length > 0) {
      setValidationErrors(errors);
    }

    setPersonDialogOpen(false);
    forceUpdate();
  };

  const handleImport = async (file: File) => {
    try {
      const importedPeople = await importData(file);
      dispatch({ type: 'SET_DATA', payload: importedPeople });

      const errors = validateData(importedPeople);
      if (errors.length > 0) {
        setValidationErrors(errors);
      } else {
        alert('Daten erfolgreich importiert!');
      }

      forceUpdate();
    } catch (error) {
      console.error(error);
      alert(
        `Fehler beim Import: ${
          error instanceof Error ? error.message : 'Unbekannter Fehler'
        }`
      );
    }
  };

  const handleExport = (format: 'json' | 'csv') => {
    exportData(people, format);
  };

  // ⬇️ Fix: Personendaten wirklich leeren + zur TreeView wechseln
  const confirmReset = () => {
    dispatch({ type: 'RESET_PERSON_DATA' }); // vorher: RESET (gab’s nicht mehr)
    setResetDialogOpen(false);
    setSearchTerm('');
    setCurrentView('tree');       // gewünschter Wechsel zur Stammbaum-Ansicht
    setAppState('database');      // falls man aus Welcome/Info kommt
    forceUpdate();
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

    // 🔽 Filter zurücksetzen
    setSearchTerm('');

    const errors = validateData(state.people);
    if (errors.length > 0) {
      setValidationErrors(errors);
    }

    forceUpdate();
  };

  const filteredPeople = useMemo(() => {
    if (!searchTerm) return people;
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [people, searchTerm]);

  const MainView = () => {
    switch (currentView) {
      case 'tree':
        return <TreeView people={people} onEdit={handleEditPerson} />;
      case 'stats':
        return <StatisticsView people={people} />;
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
  };

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
              <MainView />
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
        people={people}
      />

      <HelpDialog isOpen={isHelpDialogOpen} onClose={() => setHelpDialogOpen(false)} />

      <SettingsDialog
        isOpen={isSettingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        onReset={() => {
          setSettingsDialogOpen(false);
          setResetDialogOpen(true); // Bestätigungsdialog – danach confirmReset()
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
