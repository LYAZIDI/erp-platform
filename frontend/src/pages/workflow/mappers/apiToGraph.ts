import type { ApiWorkflowDefinition, DesignerNode, DesignerEdge, DesignerMeta } from '../types';

function autoLayout(nodes: DesignerNode[]): DesignerNode[] {
  const COL_W = 220, ROW_H = 160, START_X = 80, START_Y = 80;
  const initial = nodes.filter(n => n.data.isInitial);
  const finals  = nodes.filter(n => n.data.isFinal);
  const middle  = nodes.filter(n => !n.data.isInitial && !n.data.isFinal);
  const ordered = [...initial, ...middle, ...finals];
  return ordered.map((n, i) => ({
    ...n,
    position: { x: START_X + (i % 4) * COL_W, y: START_Y + Math.floor(i / 4) * ROW_H },
  }));
}

export function apiToGraph(def: ApiWorkflowDefinition): {
  meta: DesignerMeta;
  nodes: DesignerNode[];
  edges: DesignerEdge[];
} {
  const nodes: DesignerNode[] = def.states.map((s) => ({
    id: s.id || s.key,
    type: 'state' as const,
    position: { x: 0, y: 0 },
    data: {
      key: s.key,
      label: s.label,
      color: s.color || '#3B82F6',
      icon: s.icon || '',
      isInitial: s.isInitial,
      isFinal: s.isFinal,
      sortOrder: s.sortOrder,
    },
  }));

  const edges: DesignerEdge[] = def.transitions.map((t) => {
    const sourceNode = nodes.find(n => n.data.key === t.fromStateKey);
    const targetNode = nodes.find(n => n.data.key === t.toStateKey);
    return {
      id: t.id || t.key,
      type: 'transition' as const,
      source: sourceNode?.id || t.fromStateKey,
      target: targetNode?.id || t.toStateKey,
      data: {
        key: t.key,
        label: t.label,
        fromStateKey: t.fromStateKey,
        toStateKey: t.toStateKey,
        requiredPermission: t.requiredPermission || '',
        uiVariant: t.uiVariant || 'default',
        sortOrder: t.sortOrder,
        conditions: t.conditions || [],
        actions: t.actions || [],
      },
    };
  });

  return {
    meta: {
      definitionId: def.id,
      tenantId: def.tenantId,
      entityType: def.entityType,
      label: def.label || '',
      description: '',
      version: def.version,
    },
    nodes: autoLayout(nodes),
    edges,
  };
}
