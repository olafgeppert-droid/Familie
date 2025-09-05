// src/services/validateData.ts

import { Person } from '../types';
import { getGeneration } from './familyTreeService';

export type ValidationError = {
  personId: string;
  message: string;
  severity: 'error' | 'warning';
};

/**
 * Konsistenzprüfung aller Personen.
 * Gibt eine Liste von Fehlern zurück.
 * Diese Funktion ist rein und verändert die Eingabedaten NICHT.
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
        });
      } else if (partner.partnerId !== p.id) {
        errors.push({
          personId: p.id,
          message: `Partnerbeziehung zwischen ${p.name} und ${partner.name} ist nicht wechselseitig.`,
          severity: 'error',
        });
      }
    }

    // 2. Codeprüfung (passt Code zur Elternstruktur?)
    if (p.parentId) {
      const parent = people.find(pp => pp.id === p.parentId);
      if (parent) {
        if (!p.code.startsWith(parent.code)) {
          errors.push({
            personId: p.id,
            message: `Code ${p.code} von ${p.name} passt nicht zum Eltern-Code ${parent.code}.`,
            severity: 'error',
          });
        }
      }
    }

    // 3. Generationsprüfung - ✅ KORRIGIERT
    try {
      const gen = getGeneration(p.code); // ✅ Nur den Code übergeben
      if (p.generation !== undefined && p.generation !== gen) {
        errors.push({
          personId: p.id,
          message: `Generationsnummer ${p.generation} von ${p.name} ist inkonsistent (erwartet: ${gen}).`,
          severity: 'error',
        });
      }
    } catch (error) {
      errors.push({
        personId: p.id,
        message: `Generationsberechnung für ${p.name} fehlgeschlagen.`,
        severity: 'error',
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
 * Gibt true zurück, wenn mindestens eine Reparatur durchgeführt wurde.
 */
export function autoFixData(people: Person[]): boolean {
  let hasFixed = false;
  // Hier würde die Logik zum Anwenden der Reparaturen stehen
  // Diese Funktion muss die Daten ebenfalls kopieren und dann zurückgeben
  return hasFixed;
}
