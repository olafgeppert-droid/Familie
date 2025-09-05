// src/services/validateData.ts

import { Person } from '../types';
import { getGeneration } from './familyTreeService';

export type ValidationError = {
  personId: string;
  message: string;
  severity: 'error' | 'warning';
};

/**
 * Einfache und stabile Konsistenzprüfung
 */
export function validateData(people: Person[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // Sicherheitscheck
  if (!people || !Array.isArray(people)) {
    return [{
      personId: 'system-error',
      message: 'Ungültige Datenstruktur',
      severity: 'error'
    }];
  }

  people.forEach(p => {
    if (!p || !p.id) return; // Skip invalid entries

    // 1. Einfache Partnerprüfung
    if (p.partnerId) {
      const partner = people.find(pp => pp.id === p.partnerId);
      if (!partner) {
        errors.push({
          personId: p.id,
          message: `Partner von ${p.name} nicht gefunden.`,
          severity: 'warning', // ✅ Nur Warning, kein Error
        });
      }
    }

    // 2. Einfache Codeprüfung
    if (p.parentId) {
      const parent = people.find(pp => pp.id === p.parentId);
      if (parent && p.code && !p.code.startsWith(parent.code)) {
        errors.push({
          personId: p.id,
          message: `Code ${p.code} passt nicht zu Eltern-Code ${parent.code}.`,
          severity: 'warning',
        });
      }
    }

    // 3. Einfache Generationsprüfung (nur wenn generation existiert)
    if (p.generation !== undefined && p.generation !== null) {
      try {
        const gen = getGeneration(p.code);
        if (p.generation !== gen) {
          errors.push({
            personId: p.id,
            message: `Generation ${p.generation} sollte ${gen} sein.`,
            severity: 'warning',
          });
        }
      } catch (error) {
        // Silent fail - nicht kritisch
      }
    }

    // 4. Einfache Ringprüfung
    if (p.ringCode && p.code && !p.ringCode.endsWith(p.code)) {
      errors.push({
        personId: p.id,
        message: `Ringcode endet nicht mit eigenem Code.`,
        severity: 'warning',
      });
    }
  });

  return errors;
}

export function autoFixData(people: Person[]): boolean {
  return false; // Keine Auto-Fixes initially
}
