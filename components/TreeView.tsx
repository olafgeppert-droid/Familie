// src/components/TreeView.tsx
import React, { useRef, useLayoutEffect, useState, useMemo, useEffect } from 'react';
import type { Person } from '../types';
import { hierarchy, tree, HierarchyPointNode } from 'd3-hierarchy';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import { linkHorizontal } from 'd3-shape';
import { UserIcon } from './Icons';
import { getGeneration, getGenerationName, generationBackgroundColors } from '../services/familyTreeService';

type Unit = {
  id: string;
  persons: Person[];      // 1 (Single) oder 2 (Partner)
  children: Unit[];
};
type TreeNode = Unit;

// ---- Layout-Parameter (vertikal bleibt gleich) ----
const MIN_NODE_WIDTH = 210;
const NODE_HEIGHT = 78;
const PARTNER_GAP = 16;
const H_GAP = 120;
const V_EXTRA = 90;

const Card: React.FC<{ p: Person; onClick: (p: Person) => void; offsetY?: number; width: number; isHighlighted?: boolean }> = ({ p, onClick, offsetY = 0, width, isHighlighted = false }) => {
  const g = getGeneration(p.code);
  const c = g > 0 ? generationBackgroundColors[(g - 1) % generationBackgroundColors.length] : '#FFFFFF';
  const partnerStyle = p.code.endsWith('x');

  return (
    <g transform={`translate(0,${offsetY})`} className="cursor-pointer" onClick={() => onClick(p)}>
      <rect
        width={width}
        height={NODE_HEIGHT}
        x={-width / 2}
        y={-NODE_HEIGHT / 2}
        rx="10"
        ry="10"
        fill={partnerStyle ? "#FAF0CA" : c}
        stroke={isHighlighted ? "#FF0000" : (partnerStyle ? "#F4D35E" : "#0D3B66")}
        strokeWidth={isHighlighted ? 4 : 2}
        className={isHighlighted ? "animate-pulse" : ""}
      />
      <foreignObject x={-width / 2} y={-NODE_HEIGHT / 2} width={width} height={NODE_HEIGHT}>
        <div className="w-full h-full flex items-center p-2 text-left">
          <div className="w-14 h-14 rounded-full bg-white/50 flex-shrink-0 flex items-center justify-center overflow-hidden mr-3 border-2 border-white/80">
            {p.photoUrl ? <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" /> : <UserIcon className="w-10 h-10 text-gray-500" />}
          </div>
          <div className="flex-grow overflow-hidden">
            <div className="text-sm font-bold truncate" style={{ color: "#0D3B66" }} title={`${p.code} / ${p.name}`}>
              {p.hasRing && <span className="mr-1" title="Ringbesitzer" style={{ textShadow: '0 0 3px gold' }}>💍</span>}
              {p.code} / {p.name}
            </div>
            <div className="text-xs text-gray-700 mt-1">
              * {p.birthDate ? new Date(p.birthDate).toLocaleDateString('de-DE') : '?'}
              {p.deathDate ? ` † ${new Date(p.deathDate).toLocaleDateString('de-DE')}` : ''}
            </div>
          </div>
        </div>
      </foreignObject>
    </g>
  );
};

const UnitNode: React.FC<{ node: HierarchyPointNode<TreeNode>; onEdit: (p: Person) => void; width: number; highlightedPersonId?: string }> = ({ node, onEdit, width, highlightedPersonId }) => {
  const { x, y, data } = node;
  const hasTwo = data.persons.length === 2;

  const topOffset = hasTwo ? -(NODE_HEIGHT / 2 + PARTNER_GAP / 2) : 0;
  const bottomOffset = hasTwo ? (NODE_HEIGHT / 2 + PARTNER_GAP / 2) : 0;

  return (
    <g transform={`translate(${y},${x})`}>
      {data.persons.length === 1 && (
        <Card 
          p={data.persons[0]} 
          onClick={onEdit} 
          offsetY={0} 
          width={width} 
          isHighlighted={data.persons[0].id === highlightedPersonId}
        />
      )}
      {data.persons.length === 2 && (
        <>
          <Card 
            p={data.persons[0]} 
            onClick={onEdit} 
            offsetY={topOffset} 
            width={width} 
            isHighlighted={data.persons[0].id === highlightedPersonId}
          />
          <Card 
            p={data.persons[1]} 
            onClick={onEdit} 
            offsetY={bottomOffset} 
            width={width} 
            isHighlighted={data.persons[1].id === highlightedPersonId}
          />
          <line
            x1={0}
            y1={topOffset + NODE_HEIGHT / 2 - 10}
            x2={0}
            y2={bottomOffset - NODE_HEIGHT / 2 + 10}
            stroke="#0D3B66"
            strokeWidth={2}
          />
        </>
      )}
    </g>
  );
};

interface TreeViewProps {
  people: Person[];
  onEdit: (p: Person) => void;
  searchTerm?: string;
}

export const TreeView: React.FC<TreeViewProps> = ({ people, onEdit, searchTerm = '' }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const [highlightedPersonId, setHighlightedPersonId] = useState<string | undefined>();
  const [zoomToPerson, setZoomToPerson] = useState<Person | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Vereinfachte Suche
  useEffect(() => {
    if (!searchTerm.trim()) {
      setHighlightedPersonId(undefined);
      setZoomToPerson(null);
      return;
    }

    const lowerCaseTerm = searchTerm.toLowerCase();
    const foundPerson = people.find(
      (p) =>
        p.name.toLowerCase().includes(lowerCaseTerm) ||
        p.code.toLowerCase().includes(lowerCaseTerm)
    );

    if (foundPerson) {
      setHighlightedPersonId(foundPerson.id);
      setZoomToPerson(foundPerson);
    }
  }, [searchTerm, people]);

  // Vereinfachte Baumstruktur
  const forest = useMemo(() => {
    if (!people || people.length === 0) return null;
    
    // Einfache Struktur: Jede Person ist ein eigener Knoten
    const simpleUnits: Unit[] = people.map(person => ({
      id: `u-${person.id}`,
      persons: [person],
      children: []
    }));

    // Einfache Eltern-Kind-Beziehungen
    people.forEach(person => {
      if (person.parentId) {
        const parentUnit = simpleUnits.find(u => u.persons[0].id === person.parentId);
        const childUnit = simpleUnits.find(u => u.persons[0].id === person.id);
        if (parentUnit && childUnit) {
          parentUnit.children.push(childUnit);
        }
      }
    });

    // Wurzeln finden (Personen ohne Eltern)
    const roots = simpleUnits.filter(unit => 
      !people.some(p => p.id === unit.persons[0].id && p.parentId)
    );

    const pseudoRoot: Unit = { id: 'root', persons: [], children: roots };
    return hierarchy<TreeNode>(pseudoRoot);
  }, [people]);

  // Vereinfachtes Layout
  const layout = useMemo(() => {
    if (!forest) return null;

    try {
      const t = tree<TreeNode>()
        .nodeSize([NODE_HEIGHT + V_EXTRA, MIN_NODE_WIDTH + H_GAP])
        .separation(() => 1.2);

      return t(forest);
    } catch (error) {
      console.error('Layout error:', error);
      return null;
    }
  }, [forest]);

  // Zoom zur gefundenen Person
  useEffect(() => {
    if (!zoomToPerson || !layout || !svgRef.current || !gRef.current) return;

    const nodes = layout.descendants().filter((n: any) => n.data.id !== 'root');
    const foundNode = nodes.find((n: any) => 
      n.data.persons.some((p: Person) => p.id === zoomToPerson.id)
    );

    if (foundNode) {
      const svg = select(svgRef.current);
      const g = select(gRef.current);
      
      const targetX = foundNode.x;
      const targetY = foundNode.y;
      
      const zoomBehavior = zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 5])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoomBehavior.transform as any, zoomIdentity
        .translate(-targetY + 400, -targetX + 300)
        .scale(1.5)
      );
    }
  }, [zoomToPerson, layout]);

  // ViewBox setzen
  useLayoutEffect(() => {
    if (!layout || !svgRef.current || !gRef.current) {
      setIsLoading(false);
      return;
    }

    try {
      const nodes = layout.descendants().filter((n: any) => n.data.id !== 'root');
      if (nodes.length === 0) {
        setIsLoading(false);
        return;
      }

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

      nodes.forEach((n: any) => {
        const top = n.x - NODE_HEIGHT/2;
        const bottom = n.x + NODE_HEIGHT/2;
        const left = n.y - MIN_NODE_WIDTH/2;
        const right = n.y + MIN_NODE_WIDTH/2;
        
        if (top < minX) minX = top;
        if (bottom > maxX) maxX = bottom;
        if (left < minY) minY = left;
        if (right > maxY) maxY = right;
      });

      const pad = 200;
      setViewBox(`${minY - pad} ${minX - pad} ${(maxY - minY) + 2 * pad} ${(maxX - minX) + 2 * pad}`);

      const svg = select(svgRef.current);
      const g = select(gRef.current);

      const zoomBehavior = zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 5])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoomBehavior as any);
      setIsLoading(false);

    } catch (error) {
      console.error('ViewBox error:', error);
      setIsLoading(false);
    }
  }, [layout]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-[70vh]">Lade Stammbaum...</div>;
  }

  if (!layout) {
    return <div className="text-gray-600 italic p-4">Keine Daten vorhanden oder Fehler beim Laden.</div>;
  }

  const nodes = layout.descendants().filter(n => n.data.id !== 'root');
  const links = layout.links().filter(l => l.source.data.id !== 'root' && l.target.data.id !== 'root');

  const linkPath = linkHorizontal<any, HierarchyPointNode<TreeNode>>()
    .x(d => d.y)
    .y(d => d.x);

  return (
    <div className="bg-white p-2 rounded-lg shadow-lg w-full h-[70vh]">
      {highlightedPersonId && (
        <div className="mb-2 p-2 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
          Gefundene Person wird hervorgehoben
        </div>
      )}
      
      <svg ref={svgRef} width="100%" height="100%" viewBox={viewBox}>
        <g ref={gRef}>
          {/* Verbindungslinien */}
          <g fill="none" stroke="#9AA6B2" strokeOpacity={0.85} strokeWidth={1.5}>
            {links.map((l, i) => (
              <path key={i} d={linkPath(l) || ''} />
            ))}
          </g>

          {/* Einheiten */}
          {nodes.map((n, i) => (
            <UnitNode 
              key={i} 
              node={n as HierarchyPointNode<TreeNode>} 
              onEdit={onEdit} 
              width={MIN_NODE_WIDTH} 
              highlightedPersonId={highlightedPersonId}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};
