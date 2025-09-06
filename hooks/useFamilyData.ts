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
  return JSON.stringify(state);
};

const deserializeState = (serializedState: string): AppState => {
  const parsed = JSON.parse(serializedState);
  
  // Sicherstellen, dass alle Felder den types.ts entsprechen
  return {
    ...parsed,
    people: parsed.people.map((person: any) => ({
      id: person.id || '',
      code: person.code || '',
      name: person.name || '',
      gender: person.gender || 'd',
      birthDate: person.birthDate || '',
      deathDate: person.deathDate || null,
      birthPlace: person.birthPlace || null,
      parentId: person.parentId || null,
      partnerId: person.partnerId || null,
      hasRing: person.hasRing || false,
      ringCode: person.ringCode || null,
      ringHistory: person.ringHistory || [],
      inheritedFrom: person.inheritedFrom || null,
      comment: person.comment || null,
      photoUrl: person.photoUrl || null,
    }))
  };
};

const saveStateToLocalStorage = (state: AppState) => {
  try {
    localStorage.setItem(STORAGE_KEY, serializeState(state));
    localStorage.setItem(SCHEMA_VERSION_KEY, STORAGE_SCHEMA_VERSION);
  } catch (e) {
    console.warn('Could not save state to local storage', e);
  }
};

const loadStateFromLocalStorage = (): AppState => {
  try {
    const serializedState = localStorage.getItem(STORAGE_KEY);
    const hasBeenInitialized = localStorage.getItem(INIT_FLAG_KEY);
    const storedSchemaVersion = localStorage.getItem(SCHEMA_VERSION_KEY);

    // Schema-Migration bei Bedarf
    if (storedSchemaVersion !== STORAGE_SCHEMA_VERSION) {
      console.log('Performing schema migration from', storedSchemaVersion, 'to', STORAGE_SCHEMA_VERSION);
    }

    if (serializedState === null) {
      if (hasBeenInitialized) return defaultState;
      localStorage.setItem(INIT_FLAG_KEY, 'true');
      const initialStateWithSample = { ...defaultState, people: sampleData };
      saveStateToLocalStorage(initialStateWithSample);
      return initialStateWithSample;
    }

    try {
      const parsedState = deserializeState(serializedState);
      if (!parsedState.people) {
        if (hasBeenInitialized) return defaultState;
        localStorage.setItem(INIT_FLAG_KEY, 'true');
        const initialStateWithSample = { ...defaultState, people: sampleData };
        saveStateToLocalStorage(initialStateWithSample);
        return initialStateWithSample;
      }

      if (!hasBeenInitialized) {
        localStorage.setItem(INIT_FLAG_KEY, 'true');
      }
      return { ...defaultState, ...parsedState };
    } catch (parseError) {
      console.error('Error parsing stored data:', parseError);
      return defaultState;
    }
  } catch {
    console.warn('Could not load state from local storage');
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

// Hilfsfunktion zur Generierung einer eindeutigen ID
const generateUniqueId = (existingPeople: Person[]): string => {
  const maxId = existingPeople.reduce((max, person) => {
    const numId = parseInt(person.id) || 0;
    return Math.max(max, numId);
  }, 0);
  return (maxId + 1).toString();
};

/**
 * Hilfsfunktion: Stellt sicher, dass alle Codes konsistent bleiben.
 */
function normalizeCodes(people: Person[]): Person[] {
  return people.map(p => {
    let validCode = p.code;
    if (!/^[0-9]+[A-Z0-9]*x?$/.test(validCode)) {
      validCode = validCode.replace(/[^0-9A-Zx]/g, '');
      if (validCode === '') validCode = 'X';
    }

    const ringCode = p.ringCode === p.code ? validCode : p.ringCode;

    return { ...p, code: validCode, ringCode };
  });
}

/**
 * Hilfsfunktion: Bereinigt ungültige Referenzen
 */
function cleanupReferences(people: Person[]): Person[] {
  const validIds = new Set(people.map(p => p.id));
  
  return people.map(person => ({
    ...person,
    partnerId: person.partnerId && validIds.has(person.partnerId) ? person.partnerId : null,
    parentId: person.parentId && validIds.has(person.parentId) ? person.parentId : null,
    inheritedFrom: person.inheritedFrom && validIds.has(person.inheritedFrom) ? person.inheritedFrom : null,
  }));
}

const reducer = (state: AppState, action: Action): AppState => {
  let newState: AppState = state;

  switch (action.type) {
    case 'ADD_PERSON': {
      const newPerson = action.payload;
      
      const personWithId = {
        ...newPerson,
        id: newPerson.id && newPerson.id.trim() !== '' 
          ? newPerson.id 
          : generateUniqueId(state.people)
      };

      let updatedPeople = [...state.people];

      if (personWithId.partnerId) {
        updatedPeople = updatedPeople.map(p =>
          p.id === personWithId.partnerId ? { ...p, partnerId: personWithId.id } : p
        );
      }

      updatedPeople = [...updatedPeople, personWithId];
      const normalizedPeople = normalizeCodes(updatedPeople);
      const cleanedPeople = cleanupReferences(normalizedPeople);
      newState = { ...state, people: cleanedPeople };
      break;
    }

    case 'ADD_PERSON_WITH_RECALCULATION': {
      const { newPerson, updates } = action.payload;
      
      const personWithId = {
        ...newPerson,
        id: newPerson.id && newPerson.id.trim() !== '' 
          ? newPerson.id 
          : generateUniqueId(state.people)
      };

      let updatedPeople = state.people.map(p => {
        const update = updates.find(u => u.id === p.id);
        if (update) {
          const shouldUpdateRingCode = p.ringCode === p.code;
          return {
            ...p,
            code: update.code,
            ringCode: shouldUpdateRingCode ? update.code : p.ringCode,
          };
        }
        return p;
      });
      
      updatedPeople = [...updatedPeople, personWithId];
      const normalizedPeople = normalizeCodes(updatedPeople);
      const cleanedPeople = cleanupReferences(normalizedPeople);
      newState = { ...state, people: cleanedPeople };
      break;
    }

    case 'UPDATE_PERSON': {
      const updatedPerson = action.payload;
      const originalPerson = state.people.find(p => p.id === updatedPerson.id);
      if (!originalPerson) return state;

      const oldPartnerId = originalPerson.partnerId;
      const newPartnerId = updatedPerson.partnerId;

      let newPeople = state.people.map(p => {
        if (p.id === updatedPerson.id) return updatedPerson;
        if (p.id === oldPartnerId) return { ...p, partnerId: null };
        if (p.id === newPartnerId) return { ...p, partnerId: updatedPerson.id };
        return p;
      });

      const normalizedPeople = normalizeCodes(newPeople);
      const cleanedPeople = cleanupReferences(normalizedPeople);
      newState = { ...state, people: cleanedPeople };
      break;
    }

    case 'DELETE_PERSON': {
      const personIdToDelete = action.payload;
      const personToDelete = state.people.find(p => p.id === personIdToDelete);
      const partnerIdToUnlink = personToDelete?.partnerId ?? null;

      let newPeople = state.people
        .filter(p => p.id !== personIdToDelete)
        .map(p => {
          const next = { ...p };
          if (next.parentId === personIdToDelete) next.parentId = null;
          if (next.id === partnerIdToUnlink) next.partnerId = null;
          if (next.partnerId === personIdToDelete) next.partnerId = null;
          if (next.inheritedFrom === personIdToDelete) next.inheritedFrom = null;
          return next;
        });

      const normalizedPeople = normalizeCodes(newPeople);
      const cleanedPeople = cleanupReferences(normalizedPeople);
      newState = { ...state, people: cleanedPeople };
      break;
    }

    case 'SET_DATA': {
      const normalizedPeople = normalizeCodes(action.payload);
      const cleanedPeople = cleanupReferences(normalizedPeople);
      newState = { ...state, people: cleanedPeople };
      break;
    }

    case 'RESET_PERSON_DATA': {
      newState = { ...state, people: [] };
      break;
    }

    case 'LOAD_SAMPLE_DATA': {
      localStorage.setItem(INIT_FLAG_KEY, 'true');
      const normalizedPeople = normalizeCodes(sampleData);
      const cleanedPeople = cleanupReferences(normalizedPeople);
      newState = { ...defaultState, people: cleanedPeople };
      break;
    }

    default:
      return state;
  }

  // Zustand nach jeder Aktion speichern
  saveStateToLocalStorage(newState);
  return newState;
};

const historyReducer = (state: History, action: Action | { type: 'UNDO' } | { type: 'REDO' }): History => {
  const { past, present, future } = state;

  if (action.type === 'UNDO') {
    if (past.length === 0) return state;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    saveStateToLocalStorage(previous);
    return { past: newPast, present: previous, future: [present, ...future] };
  }

  if (action.type === 'REDO') {
    if (future.length === 0) return state;
    const next = future[0];
    const newFuture = future.slice(1);
    saveStateToLocalStorage(next);
    return { past: [...past, present], present: next, future: newFuture };
  }

  const newPresent = reducer(present, action as Action);
  if (present === newPresent) return state;

  saveStateToLocalStorage(newPresent);

  return { past: [...past, present], present: newPresent, future: [] };
};

export const useFamilyData = () => {
  const [state, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initialState,
    future: [],
  });

  const { present, past, future } = state;

  const validationErrors = validateData(present.people);

  const dispatchWithHistory = useCallback((action: Action) => {
    dispatch(action);
  }, []);

  const undo = useCallback(() => {
    if (past.length > 0) dispatch({ type: 'UNDO' });
  }, [past]);

  const redo = useCallback(() => {
    if (future.length > 0) dispatch({ type: 'REDO' });
  }, [future]);

  return {
    state: present,
    dispatch: dispatchWithHistory,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    validationErrors,
  };
};
