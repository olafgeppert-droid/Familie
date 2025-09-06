// src/hooks/useFamilyData.ts
import { useReducer, useCallback } from 'react';
import type { AppState, Action, History, Person } from '../types';
import sampleData from '../services/sampleData';
import { validateData } from '../services/validateData';

// Schema-Version für Datenmigration
const STORAGE_SCHEMA_VERSION = '1.0';
const STORAGE_KEY = 'familyTreeState';
const SCHEMA_VERSION_KEY = 'familyTreeSchemaVersion';
const INIT_FLAG_KEY = 'databaseHasBeenInitialized';

const defaultState: AppState = { people: [] };

// Serialisierungs-Hilfsfunktionen
const serializeState = (state: AppState): string => {
  return JSON.stringify({
    ...state,
    people: state.people.map(person => ({
      ...person,
      geburtsdatum: person.geburtsdatum.toISOString(), // Date to string
      // andere Date-Objekte hier ebenfalls konvertieren
    }))
  });
};

const deserializeState = (serializedState: string): AppState => {
  const parsed = JSON.parse(serializedState);
  return {
    ...parsed,
    people: parsed.people.map((person: any) => ({
      ...person,
      geburtsdatum: new Date(person.geburtsdatum), // string to Date
      // andere Date-Objekte hier ebenfalls konvertieren
    }))
  };
};

const saveStateToLocalStorage = (state: AppState) => {
  try {
    localStorage.setItem(STORAGE_KEY, serializeState(state));
    localStorage.setItem(SCHEMA_VERSION_KEY, STORAGE_SCHEMA_VERSION);
  } catch (e) {
    console.warn('Could not save state to local storage', e);
    // Fallback: Session Storage oder nur im Memory behalten
  }
};

const loadStateFromLocalStorage = (): AppState => {
  try {
    const serializedState = localStorage.getItem(STORAGE_KEY);
    const hasBeenInitialized = localStorage.getItem(INIT_FLAG_KEY);
    const storedSchemaVersion = localStorage.getItem(SCHEMA_VERSION_KEY);

    // Schema-Migration bei Bedarf hier implementieren
    if (storedSchemaVersion !== STORAGE_SCHEMA_VERSION) {
      console.log('Performing schema migration from', storedSchemaVersion, 'to', STORAGE_SCHEMA_VERSION);
      // Migrationslogik hier einfügen
    }

    if (serializedState === null) {
      // Erstinitialisierung
      if (!hasBeenInitialized) {
        localStorage.setItem(INIT_FLAG_KEY, 'true');
        const initialStateWithSample = { ...defaultState, people: sampleData };
        saveStateToLocalStorage(initialStateWithSample);
        return initialStateWithSample;
      }
      return defaultState;
    }

    // Daten vorhanden, deserialisieren
    const parsedState = deserializeState(serializedState);
    
    if (!hasBeenInitialized) {
      localStorage.setItem(INIT_FLAG_KEY, 'true');
    }

    return { ...defaultState, ...parsedState };
  } catch (error) {
    console.warn('Could not load state from local storage:', error);
    
    // Fehlerbehandlung: Zurücksetzen oder Fallback
    if (!localStorage.getItem(INIT_FLAG_KEY)) {
      localStorage.setItem(INIT_FLAG_KEY, 'true');
      const initialStateWithSample = { ...defaultState, people: sampleData };
      saveStateToLocalStorage(initialStateWithSample);
      return initialStateWithSample;
    }
    
    return defaultState;
  }
};

const initialState: AppState = loadStateFromLocalStorage();

// ... restliche Funktionen (generateUniqueId, normalizeCodes, cleanupReferences) bleiben gleich ...

const reducer = (state: AppState, action: Action): AppState => {
  let newState: AppState;

  switch (action.type) {
    case 'ADD_PERSON': {
      // ... existierende Logik ...
      newState = { ...state, people: cleanedPeople };
      break;
    }
    // ... andere cases ...
    default:
      return state;
  }

  // Zustand nach jeder Aktion speichern
  saveStateToLocalStorage(newState);
  return newState;
};

const historyReducer = (state: History, action: Action | { type: 'UNDO' } | { type: 'REDO' }): History => {
  const { past, present, future } = state;
  let newHistory: History;

  if (action.type === 'UNDO') {
    if (past.length === 0) return state;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    saveStateToLocalStorage(previous);
    newHistory = { past: newPast, present: previous, future: [present, ...future] };
  } 
  else if (action.type === 'REDO') {
    if (future.length === 0) return state;
    const next = future[0];
    const newFuture = future.slice(1);
    saveStateToLocalStorage(next);
    newHistory = { past: [...past, present], present: next, future: newFuture };
  }
  else {
    const newPresent = reducer(present, action as Action);
    if (present === newPresent) return state;
    saveStateToLocalStorage(newPresent);
    newHistory = { past: [...past, present], present: newPresent, future: [] };
  }

  return newHistory;
};

// ... export und useFamilyData Hook bleiben gleich ...
