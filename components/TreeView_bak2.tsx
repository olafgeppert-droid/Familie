
// src/components/TreeView.tsx
import React, { useRef, useLayoutEffect, useState, useMemo } from 'react';
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

// Anpassungen: Boxen größer & Spalten breiter
const NODE_WIDTH = 280;
const NODE_HEIGHT = 95;
const PARTNER_GAP = 20; // vertikaler Abstand zwischen Partnern

const halfHeight = (u: Unit | TreeNode) =>
  (u.persons.length === 2) ? (NODE_HEIGHT + PARTNER_GAP / 2) : (NODE_HEIGHT / 2);

// Generation nur aus Code ableiten
const unitGeneration = (u: Unit): number => {
  if (!u.persons.length) return 0;
  const base = u.persons.find(p => !p.code.endsWith('x')) ?? u.persons[0];
  return getGeneration(base.code);
};

const median = (arr: number[]) => {
  if (arr.length === 0) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};

const Card: React.FC<{ p: Person; onClick: (p: Person) => void; offsetY?: number }> = ({ p, onClick, offsetY = 0 }) => {
  const g = getGeneration(p.code);
  const c = g > 0 ? generationBackgroundColors[(g - 1) % generationBackgroundColors.length] : '#FFFFFF';
  const partnerStyle = p.code.endsWith('x');

  return (
    <g transform={`translate(0,${offsetY})`} className="cursor-pointer" onClick={() => onClick(p)}>
      <rect
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        x={-NODE_WIDTH / 2}
        y={-NODE_HEIGHT / 2}
        rx="12"
        ry="12"
        fill={partnerStyle ? "#FAF0CA" : c}
        stroke={partnerStyle ? "#F4D35E" : "#0D3B66"}
        strokeWidth={2}
      />
      <foreignObject x={-NODE_WIDTH / 2} y={-NODE_HEIGHT / 2} width={NODE_WIDTH} height={NODE_HEIGHT}>
        <div className="w-full h-full flex items-center p-2 text-left">
          <div className="w-16 h-16 rounded-full bg-white/50 flex-shrink-0 flex items-center justify-center overflow-hidden mr-3 border-2 border-white/80">
            {p.photoUrl ? <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" /> : <UserIcon className="w-12 h-12 text-gray-500" />}
          </div>
          <div className="flex-grow overflow-hidden">
            <div className="text-base font-bold" style={{ color: "#0D3B66", whiteSpace: "nowrap" }} title={`${p.code} / ${p.name}`}>
              {p.hasRing && <span className="mr-1" title="Ringbesitzer" style={{ textShadow: '0 0 3px gold' }}>💍</span>}
              {p.code} / {p.name}
            </div>
            <div className="text-sm text-gray-700 mt-1">
              * {p.birthDate ? new Date(p.birthDate).toLocaleDateString('de-DE') : '?'}
              {p.deathDate ? ` † ${new Date(p.deathDate).toLocaleDateString('de-DE')}` : ''}
            </div>
          </div>
        </div>
      </foreignObject>
    </g>
  );
};

const UnitNode: React.FC<{ node: HierarchyPointNode<TreeNode>; onEdit: (p: Person) => void; }> = ({ node, onEdit }) => {
  const { x, y, data } = node;
  const hasTwo = data.persons.length === 2;

  const topOffset = hasTwo ? -(NODE_HEIGHT / 2 + PARTNER_GAP / 2) : 0;
  const bottomOffset = hasTwo ? (NODE_HEIGHT / 2 + PARTNER_GAP / 2) : 0;

  return (
    <g transform={`translate(${y},${x})`}>
      {data.persons.length === 1 && (
        <Card p={data.persons[0]} onClick={onEdit} offsetY={0} />
      )}
      {data.persons.length === 2 && (
        <>
          <Card p={data.persons[0]} onClick={onEdit} offsetY={topOffset} />
          <Card p={data.persons[1]} onClick={onEdit} offsetY={bottomOffset} />
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

export const TreeView: React.FC<{ people: Person[]; onEdit: (p: Person) => void; }> = ({ people, onEdit }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);

  const forest = useMemo(() => {
    if (!people || people.length === 0) return null;

    const byId = new Map<string, Person>(people.map(p => [p.id, p]));
    const paired = new Set<string>();
    const unitsById = new Map<string, Unit>();

    const makeUnitIdForPair = (a: Person, b: Person) => {
      const [id1, id2] = [a.id, b.id].sort();
      return `u-${id1}-${id2}`;
    };

    // Partner-Einheiten bilden (einseitige oder zweiseitige Verknüpfung reicht)
    people.forEach(p => {
      if (!p.partnerId) return;
      const partner = byId.get(p.partnerId);
      if (!partner) return;
      const uid = makeUnitIdForPair(p, partner);
      if (unitsById.has(uid)) return;

      // Reihenfolge: nicht-x nach oben, x nach unten
      const top = p.code.endsWith('x') ? partner : p;
      const bottom = p.code.endsWith('x') ? p : partner;

      unitsById.set(uid, { id: uid, persons: [top, bottom], children: [] });
      paired.add(p.id);
      paired.add(partner.id);
    });

    // Singles (keine Partner-Einheit)
    people.forEach(p => {
      if (paired.has(p.id)) return;
      const uid = `u-${p.id}`;
      if (!unitsById.has(uid)) unitsById.set(uid, { id: uid, persons: [p], children: [] });
    });

    const unitOfPerson = (pid: string): Unit | undefined => {
      const direct = unitsById.get(`u-${pid}`);
      if (direct) return direct;
      for (const u of unitsById.values()) {
        if (u.persons.some(pp => pp.id === pid)) return u;
      }
      return undefined;
    };

    const hasParent = new Map<string, boolean>();
    for (const u of unitsById.values()) hasParent.set(u.id, false);

    const pushChild = (parent: Unit, child: Unit) => {
      if (parent === child) return;
      if (!parent.children.some(c => c.id === child.id)) parent.children.push(child);
    };

    // Eltern-Kind-Zuordnung auf Einheitsebene
    people.forEach(p => {
      if (!p.parentId) return;
      const parentUnit = unitOfPerson(p.parentId);
      const childUnit = unitOfPerson(p.id);
      if (!parentUnit || !childUnit) return;
      pushChild(parentUnit, childUnit);
      hasParent.set(childUnit.id, true);
    });

    // Wurzeln (Einheiten ohne Eltern)
    const roots: Unit[] = [];
    for (const u of unitsById.values()) {
      if (!hasParent.get(u.id)) roots.push(u);
    }

    const pseudoRoot: Unit = { id: 'root', persons: [], children: roots };
    return hierarchy<TreeNode>(pseudoRoot);
  }, [people]);

  const layout = useMemo(() => {
    if (!forest) return null;

    const vertical = NODE_HEIGHT + PARTNER_GAP + 100;
    const horizontal = NODE_WIDTH + 220;

    const t = tree<TreeNode>()
      .nodeSize([vertical, horizontal])
      .separation((a, b) => {
        const ah = a.data.persons.length === 2 ? 2 : 1;
        const bh = b.data.persons.length === 2 ? 2 : 1;
        const base = (ah + bh) / 2;
        return (a.parent && b.parent && a.parent === b.parent) ? base : base + 0.6;
      });

    return t(forest);
  }, [forest]);

  const [viewBox, setViewBox] = useState('0 0 1400 900');

  useLayoutEffect(() => {
    if (!layout || !svgRef.current || !gRef.current) return;

    const all = layout.descendants().filter(n => n.data.id !== 'root');
    if (all.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    all.forEach(n => {
      const hh = halfHeight(n.data);
      const top = n.x - hh;
      const bottom = n.x + hh;
      const left = n.y - NODE_WIDTH / 2;
      const right = n.y + NODE_WIDTH / 2;
      if (top < minX) minX = top;
      if (bottom > maxX) maxX = bottom;
      if (left < minY) minY = left;
      if (right > maxY) maxY = right;
    });

    const headerSpace = 100;
    const pad = 200;

    setViewBox(`${minY - pad} ${minX - pad - headerSpace} ${(maxY - minY) + 2 * pad} ${(maxX - minX) + 2 * pad + headerSpace}`);

    const svg = select(svgRef.current);
    const g = select(gRef.current);

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 20])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.on('.zoom', null);
    svg.call(zoomBehavior as any);
    svg.call(zoomBehavior.transform as any, zoomIdentity);

    return () => { svg.on('.zoom', null); };
  }, [layout]);

  if (!layout) {
    return <div className="text-gray-600 italic p-4">Keine Daten vorhanden.</div>;
  }

  const nodes = layout.descendants().filter(n => n.data.id !== 'root');
  const links = layout.links().filter(l => l.source.data.id !== 'root');

  const linkPath = linkHorizontal<any, HierarchyPointNode<TreeNode>>()
    .x(d => d.y)
    .y(d => d.x);

  const genToYs = new Map<number, number[]>();
  nodes.forEach(n => {
    const gen = unitGeneration(n.data);
    if (gen <= 0) return;
    const arr = genToYs.get(gen) ?? [];
    arr.push(n.y);
    genToYs.set(gen, arr);
  });

  const headers = Array.from(genToYs.entries())
    .map(([gen, ys]) => ({ gen, x: median(ys) }))
    .sort((a, b) => a.x - b.x);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  nodes.forEach(n => {
    const hh = halfHeight(n.data);
    const top = n.x - hh;
    const bottom = n.x + hh;
    const left = n.y - NODE_WIDTH / 2;
    const right = n.y + NODE_WIDTH / 2;
    if (top < minX) minX = top;
    if (bottom > maxX) maxX = bottom;
    if (left < minY) minY = left;
    if (right > maxY) maxY = right;
  });
  const headerY = minX - 70;
  const bgPad = 400;

  return (
    <div className="bg-white p-2 rounded-lg shadow-lg animate-fade-in w-full h-[70vh]">
      <svg ref={svgRef} width="100%" height="100%" viewBox={viewBox}>
        <g ref={gRef}>
          <rect
            x={minY - bgPad}
            y={minX - bgPad - 160}
            width={(maxY - minY) + 2 * bgPad}
            height={(maxX - minX) + 2 * bgPad + 220}
            fill="transparent"
            pointerEvents="all"
          />

          {headers.map((h, i) => (
            <line
              key={`vline-${i}`}
              x1={h.x}
              y1={minX - 160}
              x2={h.x}
              y2={maxX + 160}
              stroke="#E5E7EB"
              strokeDasharray="6 6"
              strokeWidth={1}
              opacity={0.7}
              pointerEvents="none"
            />
          ))}

          <g fill="none" stroke="#9AA6B2" strokeOpacity={0.85} strokeWidth={1.5}>
            {links.map((l, i) => (
              <path key={i} d={linkPath({ source: l.source, target: l.target }) || ''} />
            ))}
          </g>

          {headers.map((h, i) => (
            <g key={`hdr-${i}`} transform={`translate(${h.x},${headerY})`} pointerEvents="none">
              <text
                x={0}
                y={0}
                textAnchor="middle"
                fontWeight="bold"
                fontSize="18"
                fill="#0D3B66"
              >
                {getGenerationName(h.gen)}
              </text>
            </g>
          ))}

          {nodes.map((n, i) => (
            <UnitNode key={i} node={n as HierarchyPointNode<TreeNode>} onEdit={onEdit} />
          ))}
        </g>
      </svg>
    </div>
  );
};
