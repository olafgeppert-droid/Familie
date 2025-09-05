// src/services/validateData.ts

import { Person } from '../types';
import { getGeneration, generatePersonCode } from './familyTreeService';

export type ValidationError = {
  personId: string;
  message: string;
  severity: 'error' | 'warning';
  fix?: { type: string; payload?: any }; // Reparaturaktion (keine direkte Mutation!)
};

/**
 * Konsistenzprüfung aller Personen.
 * Blockiert Speichern/Import, solange Fehler vorhanden sind.
 * Liefert Liste von Fehlern inkl. optionaler Reparaturaktionen.
 * WICHTIG: Diese Funktion verändert die Eingabedaten NICHT direkt!
 */
export function validateData(people: Person[]): ValidationError[] {
  const errors: ValidationError[] = [];

  people.forEach(p => {
    // 1. Partnerprüfung
    if (p.partnerId) {
      const partner = people.find(pp => pp.id === p.partnerId);
      if (!partner) {
        errors.push({
          personId: p.id,
          message: `Partner von ${p.name} (${p.code}) nicht gefunden.`,
          severity: 'error',
          fix: { type: 'REMOVE_PARTNER', payload: { personId: p.id } }
        });
      } else if (partner.partnerId !== p.id) {
        errors.push({
          personId: p.id,
          message: `Partnerbeziehung zwischen ${p.name} und ${partner.name} ist nicht wechselseitig.`,
          severity: 'error',
          fix: { type: 'SET_PARTNER', payload: { personId: partner.id, partnerId: p.id } }
        });
      }
    }

    // 2. Codeprüfung (passt Code zur Elternstruktur?)
    if (p.parentId) {
      const parent = people.find(pp => pp.id === p.parentId);
      if (parent && !p.code.startsWith(parent.code)) {
        errors.push({
          personId: p.id,
          message: `Code ${p.code} passt nicht zu Elternteil ${parent.code}.`,
          severity: 'error',
          fix: { type: 'UPDATE_CODE', payload: { personId: p.id, newCode: generatePersonCode(p, people) } }
        });
      }
    } else if (p.code !== '1' && !p.code.endsWith('x')) {
      // Nur Stammeltern dürfen den Code "1" haben
      errors.push({
        personId: p.id,
        message: `Person ${p.name} hat keinen Elternteil, aber Code ${p.code}.`,
        severity: 'error',
      });
    }

    // 3. Generation prüfen
    const gen = getGeneration(p, people);
    if (p.generation !== gen) {
      errors.push({
        personId: p.id,
        message: `Generation von ${p.name} ist ${p.generation}, sollte aber ${gen} sein.`,
        severity: 'error',
        fix: { type: 'UPDATE_GENERATION', payload: { personId: p.id, newGeneration: gen } }
      });
    }

    // 4. Ringprüfung
    if (p.ringCode) {
      // Muss auf eigenen Code enden
      if (!p.ringCode.endsWith(p.code)) {
        errors.push({
          personId: p.id,
          message: `Ringcode ${p.ringCode} endet nicht mit eigenem Code ${p.code}.`,
          severity: 'error',
          fix: { type: 'CLEAR_RINGCODE', payload: { personId: p.id } }
        });
      }

      // Falls Elternteil verstorben: Ring muss vom Eltern-Ring stammen
      if (p.parentId) {
        const parent = people.find(pp => pp.id === p.parentId);
        if (parent?.ringCode) {
          const expectedPrefix = `${parent.ringCode} → `;
          if (!p.ringCode.startsWith(expectedPrefix)) {
            errors.push({
              personId: p.id,
              message: `Ringcode ${p.ringCode} von ${p.name} passt nicht zum Erblasser (${parent.name}, ${parent.ringCode}).`,
              severity: 'error',
              fix: { 
                type: 'UPDATE_RINGCODE', 
                payload: { 
                  personId: p.id, 
                  newRingCode: `${parent.ringCode} → ${p.code}` 
                } 
              }
            });
          }
        }
      }
    }
  });

  return errors;
}

/**
 * Wendet alle verfügbaren automatischen Reparaturen auf die Daten an.
 * Gibt die Anzahl der durchgeführten Reparaturen zurück.
 * Diese Funktion muss die Daten ebenfalls kopieren und dann zurückgeben.
 */
export function getAutoFixActions(people: Person[]): { type: string; payload: any }[] {
  const errors = validateData(people);
  const fixActions: { type: string; payload: any }[] = [];

  errors.forEach(err => {
    if (err.fix) {
      fixActions.push(err.fix);
    }
  });

  return fixActions;
}
