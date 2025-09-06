// src/hooks/useFamilyData.ts
import { useReducer, useCallback } from 'react';
import type { AppState, Action, History, Person } from '../types';
import sampleData from '../services/sampleData';
import { validateData } from '../services/validateData';

const defaultState: AppState = { people: [] };

// 🔧 Foto-Komprimierungsfunktion
const compressImage = async (base64String: string, maxSizeKB = 50): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Bestimme die maximale Größe
      const maxPixels = (maxSizeKB * 1024) / 0.75; // 0.75 bytes per pixel approx
      const scaleFactor = Math.sqrt(maxPixels / (img.width * img.height));
      
      const canvas = document.createElement('canvas');
      const width = Math.round(img.width * scaleFactor);
      const height = Math.round(img.height * scaleFactor);
      
      // Mindestgröße von 100px beibehalten
      if (width < 100 || height < 100) {
        resolve(base64String); // Original behalten wenn zu klein
        return;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      
      // Hochqualitatives Scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      
      // Als JPEG mit guter Qualität speichern
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(base64String); // Fallback zum Original
            return;
          }
          
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(base64String); // Fallback
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        0.8 // Gute Qualität
      );
    };
    
    img.onerror = () => resolve(base64String); // Fallback zum Original
    img.src = base64String;
  });
};

// 🔧 Prüfe ob Base64-String ein Bild ist
const isBase64Image = (str: string): boolean => {
  return typeof str === 'string' && str.startsWith('data:image/') && str.includes('base64,');
};

// 🔧 Komprimiere alle Fotos im State
const compressAllPhotos = async (state: AppState): Promise<AppState> => {
  // Nur komprimieren wenn Fotos vorhanden
  const hasPhotos = state.people.some(person => person.photoUrl && isBase64Image(person.photoUrl));
  if (!hasPhotos) return state;

  const compressedPeople = await Promise.all(
    state.people.map(async (person) => {
      if (person.photoUrl && isBase64Image(person.photoUrl)) {
        try {
          // Prüfe ob das Foto bereits klein genug ist (< 150KB)
          const base64Data = person.photoUrl.split(',')[1];
          const sizeKB = (base64Data.length * 0.75) / 1024;
          
          if (sizeKB < 150) {
            return person; // Bereits klein genug
          }
          
          const compressedPhoto = await compressImage(person.photoUrl);
          return { ...person, photoUrl: compressedPhoto };
        } catch (error) {
          console.warn('Foto-Komprimierung fehlgeschlagen für', person.name, error);
          return person; // Bei Fehler Original behalten
        }
      }
      return person;
    })
  );
  
  return { ...state, people: compressedPeople };
};

// 🔧 ANGEPASSTE saveStateToLocalStorage Funktion
const saveStateToLocalStorage = async (state: AppState) => {
  try {
    // Komprimiere Fotos vor dem Speichern
    const compressedState = await compressAllPhotos(state);
    const serializedState = JSON.stringify(compressedState);
    
    // Prüfe ob LocalStorage voll ist
    if (serializedState.length > 4.5 * 1024 * 1024) {
      console.warn('LocalStorage fast voll, komprimiere stärker...');
      
      // Stärkere Komprimierung für große States
      const stronglyCompressedState = await compressAllPhotos({
        ...state,
        people: state.people.map(p => ({
          ...p,
          photoUrl: p.photoUrl && isBase64Image(p.photoUrl) 
            ? p.photoUrl
            : p.photoUrl
        }))
      });
      
      localStorage.setItem('familyTreeState', JSON.stringify(stronglyCompressedState));
    } else {
      localStorage.setItem('familyTreeState', serializedState);
    }
  } catch (e) {
    console.warn('Could not save state to local storage', e);
    
    // Fallback: Versuche ohne Fotos zu speichern
    try {
      const stateWithoutPhotos = {
        ...state,
        people: state.people.map(p => ({ ...p, photoUrl: null }))
      };
      localStorage.setItem('familyTreeState', JSON.stringify(stateWithoutPhotos));
    } catch (fallbackError) {
      console.error('Auch Fallback-Speicherung fehlgeschlagen:', fallbackError);
    }
  }
};

const loadStateFromLocalStorage = (): AppState => {
  try {
    const serializedState = localStorage.getItem('familyTreeState');
    const hasBeenInitialized = localStorage.getItem('databaseHasBeenInitialized');

    if (serializedState !== null) {
      try {
        const parsedState = JSON.parse(serializedState);
        if (parsedState && parsedState.people !== undefined) {
          if (!hasBeenInitialized) {
            localStorage.setItem('databaseHasBeenInitialized', 'true');
          }
          return parsedState;
        }
      } catch (parseError) {
        console.warn('Error parsing stored data, using default:', parseError);
      }
    }

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

// Hilfsfunktion zur Generierung einer eindeutigen ID
const generateUniqueId = (existingPeople: Person[]): string => {
  const maxId = existingPeople.reduce((max, person) => {
    const numId = parseInt(person.id) || 0;
    return Math.max(max, numId);
  }, 0);
  return (maxId + 1).toString();
};

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

function cleanupReferences(people: Person[]): Person[] {
  const validIds = new Set(people.map(p => p.id));
  
  return people.map(person => ({
    ...person,
    partnerId: person.partnerId && validIds.has(person.partnerId) ? person.partnerId : null,
    parentId: person.parentId && validIds.has(person.parentId) ? person.parentId : null,
  }));
}

// 🔧 Hilfsfunktion für wechselseitige Partner-Updates
const updateReciprocalPartners = (people: Person[], updatedPerson: Person, originalPerson: Person | null): Person[] => {
  return people.map(p => {
    // Aktuelle Person aktualisieren
    if (p.id === updatedPerson.id) {
      return updatedPerson;
    }

    const oldPartnerId = originalPerson?.partnerId;
    const newPartnerId = updatedPerson.partnerId;

    // Alten Partner zurücksetzen (wenn nicht mehr Partner)
    if (oldPartnerId && p.id === oldPartnerId && oldPartnerId !== newPartnerId) {
      return { ...p, partnerId: null };
    }

    // Neuen Partner setzen (wenn gewechselt)
    if (newPartnerId && p.id === newPartnerId && newPartnerId !== oldPartnerId) {
      return { ...p, partnerId: updatedPerson.id };
    }

    // Partner-Consistenz prüfen: Wenn Person Partner von jemandem ist, muss diese Person auch Partner zurück haben
    if (p.partnerId && p.partnerId === updatedPerson.id && updatedPerson.partnerId !== p.id) {
      // Auto-Korrektur: Partner-Beziehung synchronisieren
      return { ...p, partnerId: null };
    }

    return p;
  });
};

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

      // ✅ Wechselseitige Partner-Zuweisung
      if (personWithId.partnerId) {
        updatedPeople = updatedPeople.map(p =>
          p.id === personWithId.partnerId 
            ? { ...p, partnerId: personWithId.id } // Partner zurück setzen
            : p
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
      
      // ✅ Wechselseitige Partner-Zuweisung auch für neue Personen
      if (personWithId.partnerId) {
        updatedPeople = updatedPeople.map(p =>
          p.id === personWithId.partnerId 
            ? { ...p, partnerId: personWithId.id }
            : p
        );
      }
      
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

      // ✅ Wechselseitige Partner-Updates
      const updatedPeople = updateReciprocalPartners(state.people, updatedPerson, originalPerson);

      const normalizedPeople = normalizeCodes(updatedPeople);
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
          if (next.id === partnerIdToUnlink) next.partnerId = null; // Partner zurücksetzen
          if (next.partnerId === personIdToDelete) next.partnerId = null;
          return next;
        });

      const normalizedPeople = normalizeCodes(newPeople);
      const cleanedPeople = cleanupReferences(normalizedPeople);
      newState = { ...state, people: cleanedPeople };
      break;
    }

    case 'SET_DATA': {
      const cleanedPeople = cleanupReferences(action.payload);
      newState = { people: cleanedPeople };
      
      // ✅ SOFORT und EINMALIG speichern
      saveStateToLocalStorage(newState);
      return newState;
    }

    case 'RESET_PERSON_DATA': {
      newState = { ...state, people: [] };
      break;
    }

    case 'LOAD_SAMPLE_DATA': {
      localStorage.setItem('databaseHasBeenInitialized', 'true');
      const normalizedPeople = normalizeCodes(sampleData);
      const cleanedPeople = cleanupReferences(normalizedPeople);
      newState = { ...defaultState, people: cleanedPeople };
      break;
    }

    default:
      return state;
  }

  // ✅ Nach jeder anderen Aktion speichern
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
