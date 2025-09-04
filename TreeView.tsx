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

// ---- Layout-Parameter (vertikal bleibt gleich) ----
const MIN_NODE_WIDTH = 210;        // frühere feste Breite: Mindestbreite
const NODE_HEIGHT = 78;
const PARTNER_GAP = 16;            // vertikaler Abstand zwischen Partnern
const H_GAP = 120;                 // Basisabstand zwischen den Generationen-Spalten (zusätzlich zu den Box-Breiten)
const V_EXTRA = 90;                // zusätzlicher vertikaler Abstand zwischen Zeilen

// Für Textmessung (Canvas)
let _measureCtx: CanvasRenderingContext2D | null = null;
const ensureMeasureCtx = () => {
  if (_measureCtx) return _measureCtx;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');
  // möglichst nah an unserer Card-Typografie
  ctx.font = '700 14px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
  _measureCtx = ctx;
  return _measureCtx;
};

const measureTextWidth = (text: string) => {
  const ctx = ensureMeasureCtx();
  return Math.ceil(ctx.measureText(text).width);
};

// Breite einer Personen-Card dynamisch aus Textinhalt ableiten
const cardWidthForPerson = (p: Person) => {
  // Kopfzeile in der Card: [💍] CODE / NAME  (bold, 14px)
  const head = `${p.hasRing ? '💍 ' : ''}${p.code} / ${p.name}`;
  const headW = measureTextWidth(head);

  // Layout-Puffer in der Card:
  // - padding links+rechts: p-2 => 8px * 2 = 16
  // - Avatarblock: 56px (w-14) + 12px margin (mr-3) + ~2px Rand => ~70
  // - kleine „Sicherheitsmarge“: 20
  const PADDING_X = 16;
  const AVATAR_BLOCK = 70;
  const SAFETY = 20;

  const computed = headW + PADDING_X + AVATAR_BLOCK + SAFETY;
  return Math.max(MIN_NODE_WIDTH, computed);
};

// Für Partner-Einheiten: Breite = max(Breiten beider Personen)
const unitWidth = (u: Unit) => {
  if (u.persons.length === 0) return MIN_NODE_WIDTH;
  if (u.persons.length === 1) return cardWidthForPerson(u.persons[0]);
  return Math.max(cardWidthForPerson(u.persons[0]), cardWidthForPerson(u.persons[1]));
};

const halfHeight = (u: Unit | TreeNode) =>
  (u.persons.length === 2) ? (NODE_HEIGHT + PARTNER_GAP / 2) : (NODE_HEIGHT / 2);

// Generation aus Code ableiten (Basis = Stammlinie, Partner tragen „x“)
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

const Card: React.FC<{ p: Person; onClick: (p: Person) => void; offsetY?: number; width: number }> = ({ p, onClick, offsetY = 0, width }) => {
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
        stroke={partnerStyle ? "#F4D35E" : "#0D3B66"}
        strokeWidth={2}
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

const UnitNode: React.FC<{ node: HierarchyPointNode<TreeNode>; onEdit: (p: Person) => void; width: number; }> = ({ node, onEdit, width }) => {
  const { x, y, data } = node;
  const hasTwo = data.persons.length === 2;

  const topOffset = hasTwo ? -(NODE_HEIGHT / 2 + PARTNER_GAP / 2) : 0;
  const bottomOffset = hasTwo ? (NODE_HEIGHT / 2 + PARTNER_GAP / 2) : 0;

  return (
    <g transform={`translate(${y},${x})`}>
      {data.persons.length === 1 && (
        <Card p={data.persons[0]} onClick={onEdit} offsetY={0} width={width} />
      )}
      {data.persons.length === 2 && (
        <>
          <Card p={data.persons[0]} onClick={onEdit} offsetY={topOffset} width={width} />
          <Card p={data.persons[1]} onClick={onEdit} offsetY={bottomOffset} width={width} />
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

  // ----- Forest/Einheiten aufbauen -----
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

  // ----- Layout berechnen -----
  const layout = useMemo(() => {
    if (!forest) return null;

    // 1) D3-Tree nur für die vertikale Anordnung benutzen
    const vertical = NODE_HEIGHT + PARTNER_GAP + V_EXTRA;
    const t = tree<TreeNode>()
      .nodeSize([vertical, 1])  // y nutzen wir später selbst
      .separation((a, b) => {
        const ah = a.data.persons.length === 2 ? 2 : 1;
        const bh = b.data.persons.length === 2 ? 2 : 1;
        const base = (ah + bh) / 2;
        return (a.parent && b.parent && a.parent === b.parent) ? base : base + 0.6;
      });

    const laid = t(forest);

    // 2) Spaltenbreiten pro Generation bestimmen
    const nodes = laid.descendants().filter(n => n.data.id !== 'root');
    const gens = new Set<number>();
    const widthByUnit = new Map<string, number>();
    const maxWidthByGen = new Map<number, number>();

    nodes.forEach(n => {
      const u = n.data;
      const g = unitGeneration(u);
      if (g <= 0) return;
      gens.add(g);
      const w = unitWidth(u);
      widthByUnit.set(u.id, w);
      const prevMax = maxWidthByGen.get(g) ?? MIN_NODE_WIDTH;
      if (w > prevMax) maxWidthByGen.set(g, w);
    });

    const gensSorted = Array.from(gens).sort((a, b) => a - b);

    // 3) Spaltenzentren (y-Positionen) aus den Breiten + H_GAP berechnen
    const colCenterByGen = new Map<number, number>();
    let cursor = 0;
    gensSorted.forEach((g, idx) => {
      const w = maxWidthByGen.get(g) ?? MIN_NODE_WIDTH;
      if (idx === 0) {
        cursor = w / 2;
      } else {
        const prev = gensSorted[idx - 1];
        const wPrev = maxWidthByGen.get(prev) ?? MIN_NODE_WIDTH;
        cursor += (wPrev / 2) + H_GAP + (w / 2);
      }
      colCenterByGen.set(g, cursor);
    });

    // 4) y-Position jedes Knotens auf die passende Spalte der Generation setzen
    nodes.forEach(n => {
      const g = unitGeneration(n.data);
      if (g > 0) {
        const cx = colCenterByGen.get(g);
        if (cx != null) (n as any).y = cx;
      }
    });

    // Hilfswerte anhängen, damit wir sie später im Render haben
    (laid as any).__widthByUnit = widthByUnit;
    (laid as any).__colCenterByGen = colCenterByGen;
    (laid as any).__maxWidthByGen = maxWidthByGen;
    (laid as any).__gensSorted = gensSorted;

    return laid;
  }, [forest]);

  const [viewBox, setViewBox] = useState('0 0 1200 800');

  useLayoutEffect(() => {
    if (!layout || !svgRef.current || !gRef.current) return;

    const nodes = layout.descendants().filter((n: any) => n.data.id !== 'root');
    if (nodes.length === 0) return;

    const widthByUnit: Map<string, number> = (layout as any).__widthByUnit ?? new Map();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    nodes.forEach((n: any) => {
      const u: Unit = n.data;
      const w = widthByUnit.get(u.id) ?? MIN_NODE_WIDTH;
      const hh = halfHeight(u);
      const top = n.x - hh;
      const bottom = n.x + hh;
      const left = n.y - w / 2;
      const right = n.y + w / 2;
      if (top < minX) minX = top;
      if (bottom > maxX) maxX = bottom;
      if (left < minY) minY = left;
      if (right > maxY) maxY = right;
    });

    const headerSpace = 100;
    const pad = 160;

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

  // Header-Positionen jetzt direkt aus den Spaltenzentren der Generationen
  const colCenterByGen: Map<number, number> = (layout as any).__colCenterByGen ?? new Map();
  const gensSorted: number[] = (layout as any).__gensSorted ?? [];
  const widthByUnit: Map<string, number> = (layout as any).__widthByUnit ?? new Map();

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  nodes.forEach((n as any) => {
    const u: Unit = (n as any).data;
    const w = widthByUnit.get(u.id) ?? MIN_NODE_WIDTH;
    const hh = halfHeight(u);
    const top = (n as any).x - hh;
    const bottom = (n as any).x + hh;
    const left = (n as any).y - w / 2;
    const right = (n as any).y + w / 2;
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

          {/* Verbindungslinien */}
          <g fill="none" stroke="#9AA6B2" strokeOpacity={0.85} strokeWidth={1.5}>
            {links.map((l, i) => (
              <path key={i} d={linkPath({ source: l.source, target: l.target }) || ''} />
            ))}
          </g>

          {/* Spaltenlinien & Header */}
          {gensSorted.map((gen, i) => {
            const cx = colCenterByGen.get(gen)!;
            return (
              <g key={`hdr-${gen}`}>
                <line
                  x1={cx}
                  y1={minX - 160}
                  x2={cx}
                  y2={maxX + 160}
                  stroke="#E5E7EB"
                  strokeDasharray="6 6"
                  strokeWidth={1}
                  opacity={0.7}
                  pointerEvents="none"
                />
                <g transform={`translate(${cx},${headerY})`} pointerEvents="none">
                  <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    fontWeight="bold"
                    fontSize="18"
                    fill="#0D3B66"
                  >
                    {getGenerationName(gen)}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Einheiten */}
          {nodes.map((n, i) => {
            const u = n.data as Unit;
            const w = (layout as any).__widthByUnit?.get(u.id) ?? MIN_NODE_WIDTH;
            return (
              <UnitNode key={i} node={n as HierarchyPointNode<TreeNode>} onEdit={onEdit} width={w} />
            );
          })}
        </g>
      </svg>
    </div>
  );
};
