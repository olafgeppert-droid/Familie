import React, { useState, useMemo } from 'react';
import type { Person } from '../types';
import {
  getGeneration,
  getGenerationName,
  generationBackgroundColors,
} from '../services/familyTreeService';
import { UserIcon } from './Icons';

interface TableViewProps {
  people: Person[];
  onEdit: (person: Person) => void;
  searchTerm: string;
}

type SortConfig =
  | { key: keyof Person; direction: 'ascending' | 'descending' }
  | null;

const getGenderIcon = (gender: 'm' | 'f' | 'd') => {
  switch (gender) {
    case 'm':
      return '♂';
    case 'f':
      return '♀';
    case 'd':
      return '⚥';
    default:
      return '';
  }
};

// Hilfsfunktion: Textbreite messen
const measureTextWidth = (text: string, font = '14px Arial') => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = font;
  return ctx.measureText(text).width;
};

export const TableView: React.FC<TableViewProps> = ({
  people,
  onEdit,
  searchTerm,
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'code',
    direction: 'ascending',
  });

  const peopleMap = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people]
  );

  const sortedPeople = useMemo(() => {
    let sortablePeople = [...people];
    if (sortConfig !== null) {
      sortablePeople.sort((a, b) => {
        const genA = getGeneration(a.code);
        const genB = getGeneration(b.code);

        if (genA !== genB) {
          return sortConfig.direction === 'ascending'
            ? genA - genB
            : genB - genA;
        }

        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (
          aValue === undefined ||
          bValue === undefined ||
          aValue === null ||
          bValue === null
        )
          return 0;

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortablePeople;
  }, [people, sortConfig]);

  const requestSort = (key: keyof Person) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'ascending'
    ) {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof Person) => {
    if (!sortConfig || sortConfig.key !== key) {
      return ' ↕';
    }
    return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight || !text) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark
              key={i}
              className="bg-brand-accent text-brand-dark p-0"
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const headers = [
    'Foto',
    'Gen',
    'Pers.-Code',
    'Ring-Code',
    'Name',
    'Geburtsdatum',
    'Geburtsort',
    'Todesdatum',
    'Eltern-Code',
    'Partner-Code',
    'Geerbt von',
    'Kommentar',
  ];

  const keyMap: (keyof Person | null)[] = [
    null,
    'code',
    'code',
    'ringCode',
    'name',
    'birthDate',
    'birthPlace',
    'deathDate',
    null,
    null,
    'inheritedFrom',
    'comment',
  ];

  // Dynamische Breite ermitteln
  const columnWidth = useMemo(() => {
    let max = 0;

    // Alle Werte prüfen
    sortedPeople.forEach((p) => {
      headers.forEach((header, idx) => {
        let val = '';
        switch (keyMap[idx]) {
          case 'code':
            val = p.code || '';
            break;
          case 'ringCode':
            val = p.ringCode || '';
            break;
          case 'name':
            val = p.name || '';
            break;
          case 'birthDate':
            val = p.birthDate
              ? new Date(p.birthDate).toLocaleDateString('de-DE')
              : '';
            break;
          case 'birthPlace':
            val = p.birthPlace || '';
            break;
          case 'deathDate':
            val = p.deathDate
              ? new Date(p.deathDate).toLocaleDateString('de-DE')
              : '';
            break;
          case 'inheritedFrom':
            val = p.inheritedFrom || '';
            break;
          case 'comment':
            val = p.comment || '';
            break;
          default:
            break;
        }
        max = Math.max(max, measureTextWidth(val));
      });
    });

    // Auch Headertexte messen
    headers.forEach((h) => {
      max = Math.max(max, measureTextWidth(h));
    });

    return max + 40; // Padding
  }, [sortedPeople, headers]);

  let lastGeneration = -1;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg animate-fade-in">
      <h2 className="text-2xl font-bold mb-4 text-brand-primary">
        Personenübersicht
      </h2>

      {/* Scrollbare Box */}
      <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
        <table className="min-w-full divide-y divide-gray-200" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {headers.map((header, index) => {
                const sortKey = keyMap[index];
                return (
                  <th
                    key={header}
                    scope="col"
                    style={{ width: columnWidth }}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-50"
                  >
                    {sortKey ? (
                      <button
                        onClick={() => requestSort(sortKey)}
                        className="flex items-center font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {header}
                        <span className="ml-1">
                          {getSortIndicator(sortKey)}
                        </span>
                      </button>
                    ) : (
                      header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {sortedPeople.map((person) => {
              const parent = person.parentId
                ? peopleMap.get(person.parentId)
                : null;
              const partner = person.partnerId
                ? peopleMap.get(person.partnerId)
                : null;
              // Fix: inheritedFrom ist ein Code → auflösen in Person
              const inheritedFrom = person.inheritedFrom
                ? people.find(p => p.code === person.inheritedFrom)
                : null;
              const generation = getGeneration(person.code);

              const rowStyle =
                generation > 0
                  ? {
                      backgroundColor:
                        generationBackgroundColors[
                          (generation - 1) %
                            generationBackgroundColors.length
                        ],
                    }
                  : {};

              const showHeader =
                generation > 0 && generation !== lastGeneration;
              if (showHeader) {
                lastGeneration = generation;
              }

              return (
                <React.Fragment key={person.id}>
                  {showHeader && (
                    <tr className="bg-gray-200 sticky top-[49px] z-[9]">
                      <td
                        colSpan={headers.length}
                        className="px-6 py-2 text-sm font-bold text-gray-800"
                      >
                        {getGenerationName(generation)}
                      </td>
                    </tr>
                  )}

                  <tr
                    onDoubleClick={() => onEdit(person)}
                    className="hover:brightness-95 transition-all duration-150 cursor-pointer"
                    style={rowStyle}
                  >
                    {/* Foto */}
                    <td style={{ width: columnWidth }} className="px-6 py-4 whitespace-nowrap">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                        {person.photoUrl ? (
                          <img
                            src={person.photoUrl}
                            alt={person.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <UserIcon className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                    </td>

                    {/* Generation */}
                    <td style={{ width: columnWidth }} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {generation > 0 ? generation : ''}
                    </td>

                    {/* Personen-Code */}
                    <td style={{ width: columnWidth }} className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700">
                      {highlightText(person.code, searchTerm)}
                    </td>

                    {/* Ring-Code */}
                    <td style={{ width: columnWidth }} className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700 flex items-center">
                      <span
                        className="inline-block w-6 text-center"
                        title={person.hasRing ? 'Ringbesitzer' : undefined}
                      >
                        {person.hasRing ? (
                          <span style={{ textShadow: '0 0 3px gold' }}>
                            💍
                          </span>
                        ) : (
                          ''
                        )}
                      </span>
                      {highlightText(person.ringCode, searchTerm)}
                    </td>

                    {/* Name + Gender */}
                    <td style={{ width: columnWidth }} className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      <strong className="mr-2">
                        {getGenderIcon(person.gender)}
                      </strong>
                      {highlightText(person.name, searchTerm)}
                    </td>

                    {/* Geburtsdatum */}
                    <td style={{ width: columnWidth }} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {person.birthDate
                        ? new Date(person.birthDate).toLocaleDateString('de-DE')
                        : ''}
                    </td>

                    {/* Geburtsort */}
                    <td style={{ width: columnWidth }} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {person.birthPlace || ''}
                    </td>

                    {/* Todesdatum */}
                    <td style={{ width: columnWidth }} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {person.deathDate
                        ? new Date(person.deathDate).toLocaleDateString('de-DE')
                        : ''}
                    </td>

                    {/* Eltern-Code */}
                    <td style={{ width: columnWidth }} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono" title={parent?.name}>
                      {parent?.code || ''}
                    </td>

                    {/* Partner-Code */}
                    <td style={{ width: columnWidth }} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono" title={partner?.name}>
                      {partner?.code || ''}
                    </td>

                    {/* Geerbt von */}
                    <td style={{ width: columnWidth }} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono" title={inheritedFrom?.name}>
                      {inheritedFrom?.code || ''}
                    </td>

                    {/* Kommentar */}
                    <td style={{ width: columnWidth }} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate" title={person.comment || ''}>
                      {person.comment || ''}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
