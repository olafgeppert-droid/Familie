import React, { useRef, useLayoutEffect, useState, useMemo } from 'react';
import type { Person } from '../types';
import { hierarchy, tree, HierarchyPointNode } from 'd3-hierarchy';
import { select } from 'd3-selection';
import { zoom } from 'd3-zoom';
import { linkHorizontal } from 'd3-shape';
import { EditIcon, UserIcon } from './Icons';
import { getGeneration, getGenerationName, generationBackgroundColors } from '../services/familyTreeService';

type TreeNode = Person & {
  children?: TreeNode[];
  _partner?: TreeNode;
};

const Node: React.FC<{ node: HierarchyPointNode<TreeNode>; onEdit: (p: Person) => void; }> = ({ node, onEdit }) => {
  const { x, y, data } = node;
  const isPartner = data.code.endsWith('x');
  const generation = getGeneration(data.code);
  const bgColor = generation > 0 ? generationBackgroundColors[(generation - 1) % generationBackgroundColors.length] : '#FFFFFF';

  const nodeWidth = 240;
  const nodeHeight = 80;
  const gap = 18; // Abstand zwischen zwei Partner-Karten

  // Hilfskarte für eine Person
  const Card: React.FC<{ p: TreeNode; offsetX: number }> = ({ p, offsetX }) => {
    const g = getGeneration(p.code);
    const c = g > 0 ? generationBackgroundColors[(g - 1) % generationBackgroundColors.length] : '#FFFFFF';
    const partnerStyle = p.code.endsWith('x');
    return (
      <g transform={`translate(${offsetX},0)`} className="cursor-pointer" onClick={() => onEdit(p)}>
        <rect
          width={nodeWidth}
          height={nodeHeight}
          x={-nodeWidth / 2}
          y={-nodeHeight / 2}
          rx="10"
          ry="10"
          fill={partnerStyle ? "#FAF0CA" : c}
          stroke={partnerStyle ? "#F4D35E" : "#0D3B66"}
          strokeWidth="2"
        />
        <foreignObject x={-nodeWidth/2} y={-nodeHeight/2} width={nodeWidth} height={nodeHeight}>
          <div className="w-full h-full flex items-center p-2 text-left">
            <div className="w-16 h-16 rounded-full bg-white/50 flex-shrink-0 flex items-center justify-center overflow-hidden mr-3 border-2 border-white/80">
              {p.photoUrl ? <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" /> : <UserIcon className="w-12 h-12 text-gray-500" />}
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
            <EditIcon className="w-4 h-4 ml-2 text-gray-600" />
          </div>
        </foreignObject>
      </g>
    );
  };

  // Render: Person + ggf. Partner nebendran
  return (
    <g transform={`translate(${y},${x})`}>
      <Card p={data} offsetX={0} />
      {data._partner && <Card p={data._partner} offsetX={nodeWidth/2 + gap} />}
      {/* Verbindende Linie zwischen den Partnerkarten */}
      {data._partner && (
        <line
          x1={nodeWidth/2 - 6} y1={0}
          x2={nodeWidth/2 + gap + 6} y2={0}
          stroke="#0D3B66" strokeWidth={2}
        />
      )}
    </g>
  );
};

export const TreeView: React.FC<{ people: Person[]; onEdit: (p: Person) => void; }> = ({ people, onEdit }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);

  const hierarchyData = useMemo(() => {
    if (people.length === 0) return null;

    const map: Map<string, TreeNode> = new Map(people.map(p => [p.id, { ...p, children: [] }]));

    const roots: TreeNode[] = [];

    people.forEach(person => {
      const node = map.get(person.id)!;

      // Partner-Verlinkung
      if (person.partnerId) {
        const partner = map.get(person.partnerId);
        if (partner) {
          node._partner = partner;
          partner._partner = node;
        }
      }

      // Kind dem Elternknoten zuordnen (Partner selbst nicht als Root)
      if (person.parentId) {
        const parent = map.get(person.parentId);
        if (parent) parent.children!.push(node);
        else if (!person.code.endsWith('x')) roots.push(node);
      } else {
        if (!person.code.endsWith('x')) roots.push(node);
      }
    });

    const progenitor = roots.find(r => r.code === '1') || roots[0];
    if (!progenitor) return null;

    return hierarchy(progenitor);
  }, [people]);

  const treeLayout = useMemo(() => {
    if (!hierarchyData) return null;
    return tree<TreeNode>().nodeSize([120, 300])(hierarchyData);
  }, [hierarchyData]);

  const [viewBox, setViewBox] = useState('0 0 1000 800');

  useLayoutEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const svg = select(svgRef.current);
    const g = select(gRef.current);

    const handleZoom = zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 2]).on('zoom', (event) => {
      g.attr('transform', event.transform);
    });

    svg.call(handleZoom as any);

    const initialTransform = `translate(${500}, ${400}) scale(0.8)`;
    g.attr('transform', initialTransform);
    setViewBox('0 0 1000 800');

    return () => {
      svg.on('.zoom', null);
    };
  }, []);

  if (!treeLayout) {
    return <div className="text-gray-600 italic p-4">Keine Daten vorhanden.</div>;
  }

  const nodes = treeLayout.descendants();
  const links = treeLayout.links();

  const linkPathGenerator = linkHorizontal<any, HierarchyPointNode<TreeNode>>()
    .x(d => d.y)
    .y(d => d.x);

  return (
    <div className="bg-white p-2 rounded-lg shadow-lg animate-fade-in w-full h-[70vh]">
      <svg ref={svgRef} width="100%" height="100%" viewBox={viewBox}>
        <g ref={gRef}>
          {/* Kanten (Eltern-Kind) */}
          <g fill="none" stroke="#999" strokeOpacity="0.6" strokeWidth="1.5">
            {links.map((link, i) => (
              <path key={i} d={linkPathGenerator({ source: link.source, target: link.target }) || ''} />
            ))}
          </g>

          {/* Knoten */}
          {nodes.map((node, idx) => (
            <Node key={idx} node={node} onEdit={onEdit} />
          ))}
        </g>
      </svg>
      <div className="px-2 py-1 text-xs text-gray-700">
        <span className="font-semibold">Stammeltern</span> · {getGenerationName(1)} – Partner werden neben der Person angezeigt.
      </div>
    </div>
  );
};
