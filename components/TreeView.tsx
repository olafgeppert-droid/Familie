
import React, { useRef, useLayoutEffect, useState, useMemo } from 'react';
import type { Person } from '../types';
// FIX: Changed from monolithic d3 import to modular imports to fix type errors.
import { hierarchy, tree, HierarchyPointNode } from 'd3-hierarchy';
import { select } from 'd3-selection';
import { zoom } from 'd3-zoom';
import { linkHorizontal } from 'd3-shape';
import { EditIcon, UserIcon } from './Icons';
import { getGeneration, getGenerationName, generationBackgroundColors } from '../services/familyTreeService';


interface TreeViewProps {
    people: Person[];
    onEdit: (person: Person) => void;
}

interface TreeNode extends Person {
    children?: TreeNode[];
    _partner?: TreeNode;
    _x?: number;
    _y?: number;
}

// FIX: Used HierarchyPointNode type from d3-hierarchy directly.
const Node: React.FC<{ node: HierarchyPointNode<TreeNode>; onEdit: (person: Person) => void; }> = ({ node, onEdit }) => {
    const { x, y, data } = node;
    const isPartner = data.code.endsWith('x');
    const generation = getGeneration(data.code);
    const bgColor = generation > 0 ? generationBackgroundColors[(generation - 1) % generationBackgroundColors.length] : '#FFFFFF';
    
    const nodeWidth = 240;
    const nodeHeight = 80;

    return (
        <g transform={`translate(${y},${x})`} className="cursor-pointer" onClick={() => onEdit(data)}>
            <rect
                width={nodeWidth}
                height={nodeHeight}
                x={-nodeWidth / 2}
                y={-nodeHeight / 2}
                rx="10"
                ry="10"
                fill={isPartner ? "#FAF0CA" : bgColor}
                stroke={isPartner ? "#F4D35E" : "#0D3B66"}
                strokeWidth="2"
            />
            <foreignObject x={-nodeWidth/2} y={-nodeHeight/2} width={nodeWidth} height={nodeHeight}>
                <div className="w-full h-full flex items-center p-2 text-left">
                    <div className="w-16 h-16 rounded-full bg-white/50 flex-shrink-0 flex items-center justify-center overflow-hidden mr-3 border-2 border-white/80">
                         {data.photoUrl ? (
                            <img src={data.photoUrl} alt={data.name} className="w-full h-full object-cover" />
                        ) : (
                            <UserIcon className="w-12 h-12 text-gray-500" />
                        )}
                    </div>
                    <div className="flex-grow overflow-hidden">
                        <div className="text-sm font-bold truncate w-full" style={{ color: "#0D3B66" }} title={`${data.code} / ${data.name}`}>
                             {data.hasRing && <span className="mr-1" title="Ringbesitzer" style={{ textShadow: '0 0 3px gold' }}>💍</span>}
                             {data.code} / {data.name}
                        </div>
                        <div className="text-xs text-gray-700 mt-1">
                            * {data.birthDate ? new Date(data.birthDate).toLocaleDateString('de-DE') : '?'}
                            {data.deathDate ? ` † ${new Date(data.deathDate).toLocaleDateString('de-DE')}` : ''}
                        </div>
                    </div>
                </div>
            </foreignObject>
             <g transform={`translate(${nodeWidth/2 - 12}, ${-nodeHeight/2 + 12})`} className="opacity-0 hover:opacity-100 transition-opacity">
                 <circle r="10" fill="rgba(0,0,0,0.1)" />
                 <EditIcon color="#333" width={12} height={12} x={-6} y={-6} />
             </g>
        </g>
    );
};

export const TreeView: React.FC<TreeViewProps> = ({ people, onEdit }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const gRef = useRef<SVGGElement>(null);

    const hierarchyData = useMemo(() => {
        if (people.length === 0) return null;

        const peopleMap: Map<string, TreeNode> = new Map(people.map(p => [p.id, { ...p, children: [] }]));
        const roots: TreeNode[] = [];
        
        people.forEach(person => {
            const node = peopleMap.get(person.id)!;
            
            if (person.partnerId) {
                const partner = peopleMap.get(person.partnerId);
                if(partner) {
                    partner._partner = node;
                    node._partner = partner;
                }
            }
            
            if (person.parentId) {
                const parent = peopleMap.get(person.parentId);
                if (parent) {
                    parent.children!.push(node);
                } else {
                    if (!person.code.endsWith('x')) roots.push(node);
                }
            } else {
                 if (!person.code.endsWith('x')) roots.push(node);
            }
        });
        
        const progenitor = roots.find(r => r.code === '1') || roots[0];
        if (!progenitor) return null;
        
        // FIX: Replaced d3.hierarchy with imported hierarchy function.
        return hierarchy(progenitor);
    }, [people]);
    
    const treeLayout = useMemo(() => {
        if (!hierarchyData) return null;
        // FIX: Replaced d3.tree with imported tree function.
        return tree<TreeNode>().nodeSize([120, 300])(hierarchyData);
    }, [hierarchyData]);
    
    const [viewBox, setViewBox] = useState('0 0 1000 800');

    useLayoutEffect(() => {
        if (!svgRef.current || !gRef.current || !treeLayout) return;

        // FIX: Replaced d3.select with imported select function.
        const svg = select(svgRef.current);
        // FIX: Replaced d3.select with imported select function.
        const g = select(gRef.current);
        
        const { x, y, width, height } = (g.node() as SVGGElement).getBBox();
        const padding = 100;
        setViewBox(`${x - padding} ${y - padding} ${width + padding * 2} ${height + padding * 2}`);

        // FIX: Replaced d3.zoom with imported zoom function and renamed variable to avoid conflict.
        const zoomBehavior = zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 2])
            .on("zoom", (event) => {
                g.attr("transform", event.transform.toString());
            });

        svg.call(zoomBehavior);

    }, [treeLayout]);

    const generationHeaders = useMemo(() => {
        if (!treeLayout) return [];
        
        const depths = new Map<number, { yPos: number; xPositions: number[] }>();
        treeLayout.descendants().forEach(node => {
            if (!depths.has(node.depth)) {
                depths.set(node.depth, { yPos: node.y, xPositions: [] });
            }
            depths.get(node.depth)!.xPositions.push(node.x);
        });
        
        return Array.from(depths.entries()).map(([depth, data]) => ({
            name: getGenerationName(depth + 1),
            yPos: data.yPos,
            xPos: Math.min(...data.xPositions) - 100, // Position above the top node of the generation
        }));
    }, [treeLayout]);

    if (people.length === 0) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-lg text-center text-gray-500 animate-fade-in">
                <p>Keine Personen erfasst. Fügen Sie eine Person hinzu, um zu beginnen.</p>
            </div>
        );
    }
    
    if (!treeLayout) {
        return (
             <div className="bg-white p-6 rounded-lg shadow-lg text-center text-gray-500 animate-fade-in">
                <p>Stammvater (Code '1') nicht gefunden. Der Stammbaum kann nicht angezeigt werden.</p>
            </div>
        );
    }

    const nodes = treeLayout.descendants();
    const links = treeLayout.links();

    // FIX: Replaced d3.linkHorizontal with imported linkHorizontal function and HierarchyPointNode type.
    const linkPathGenerator = linkHorizontal<any, HierarchyPointNode<TreeNode>>()
        .x(d => d.y)
        .y(d => d.x);
        
    return (
        <div className="bg-white p-2 rounded-lg shadow-lg animate-fade-in w-full h-[70vh]">
            <svg ref={svgRef} width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
                <g ref={gRef}>
                    {generationHeaders.map(({ name, yPos, xPos }) => (
                         <text
                            key={name}
                            transform={`translate(${yPos}, ${xPos})`}
                            textAnchor="middle"
                            className="font-bold text-lg text-gray-500 fill-current"
                        >
                            {name}
                        </text>
                    ))}

                    {links.map((link, i) => (
                         <path
                            key={i}
                            fill="none"
                            stroke="#ccc"
                            strokeWidth="2"
                            d={linkPathGenerator({ source: link.source, target: link.target }) || ''}
                         />
                    ))}
                    {nodes.map((node, i) => (
                        <Node key={node.data.id || i} node={node} onEdit={onEdit} />
                    ))}
                </g>
            </svg>
        </div>
    );
};