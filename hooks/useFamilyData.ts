// src/hooks/useFamilyData.ts
import { useReducer, useCallback } from 'react';
import type { AppState, Action, History, Person } from '../types';
import sampleData from '../services/sampleData';
import { validateData } from '../services/validateData';

const defaultState: AppState = { people: [] };

const saveStateToLocalStorage = (state: AppState) => {
  try {
    localStorage.setItem('familyTreeState', JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save state to local storage', e);
  }
};

const loadStateFromLocalStorage = (): AppState => {
  try {
    const serializedState = localStorage.getItem('familyTreeState');
    const hasBeenInitialized = localStorage.getItem('databaseHasBeenInitialized');

    if (serializedState === null) {
      if (hasBeenInitialized) return defaultState;
      localStorage.setItem('databaseHasBeenInitialized', 'true');
      const initialStateWithSample = { ...defaultState, people: sampleData };
      saveStateToLocalStorage(initialStateWithSample);
      return initialStateWithSample;
    }

    const parsedState = JSON.parse(serializedState);
    if (!parsedState.people) {
      if (hasBeenInitialized) return defaultState;
      localStorage.setItem('databaseHasBeenInitialized', 'true');
      const initialStateWithSample = { ...defaultState, people: sampleData };
      saveStateToLocalStorage(initialStateWithSample);
      return initialStateWithSample;
    }

    if (!hasBeenInitialized) {
      localStorage.setItem('databaseHasBeenInitialized', 'true');
    }
    return { ...defaultState, ...parsedState };
  } catch {
    console.warn('Could not load state from local storage');
    if (!localStorage.getItem('databaseHasBeenInitialized')) {
      localStorage.setItem('databaseHasBeenInitialized', 'true');
      const initialStateWithSample = { ...defaultState, people: sampleData };
      saveStateToLocalStorage(initialStateWithSample);
      return initialStateWithSample;
    }
    return defaultState;
  }
};

const initialState: AppState = loadStateFromLocalStorage();

/**
 * Hilfsfunktion: Stellt sicher, dass alle Codes konsistent bleiben.
 */
function normalizeCodes(people: Person[]): Person[] {
  return people.map(p => {
    // Code darf nur Zahlen + Buchstaben enthalten, optional mit "x" am Ende
    let validCode = p.code;
    if (!/^[0-9]+[A-Z0-9]*x?$/.test(validCode)) {
      // Fallback: repariere Code
      validCode = validCode.replace(/[^0-9A-Zx]/g, '');
      if (validCode === '') validCode = 'X';
    }

    // RingCode bleibt gekoppelt, falls identisch
    const ringCode = p.ringCode === p.code ? validCode : p.ringCode;

    return { ...p, code: validCode, ringCode };
  });
}

const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'ADD_PERSON': {
      const newPerson = action.payload;
      let updatedPeople = [...state.people];

      if (newPerson.partnerId) {
        updatedPeople = updatedPeople.map(p =>
          p.id === newPerson.partnerId ? { ...p, partnerId: newPerson.id } : p
        );
      }

      updatedPeople = [...updatedPeople, newPerson];
      return { ...state, people: normalizeCodes(updatedPeople) };
    }

    case 'ADD_PERSON_WITH_RECALCULATION': {
      const { newPerson, updates } = action.payload;
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
      updatedPeople = [...updatedPeople, newPerson];
      return { ...state, people: normalizeCodes(updatedPeople) };
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

      return { ...state, people: normalizeCodes(newPeople) };
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
          return next;
        });

      return { ...state, people: normalizeCodes(newPeople) };
    }

    case 'SET_DATA': {
      const next = { ...state, people: normalizeCodes(action.payload) };
      saveStateToLocalStorage(next);
      return next;
    }

    case 'RESET_PERSON_DATA': {
      const clearedState = { ...state, people: [] };
      saveStateToLocalStorage(clearedState);
      return clearedState;
    }

    case 'LOAD_SAMPLE_DATA': {
      localStorage.setItem('databaseHasBeenInitialized', 'true');
      const freshState = { ...defaultState, people: normalizeCodes(sampleData) };
      saveStateToLocalStorage(freshState);
      return freshState;
    }

    default:
      return state;
  }
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
