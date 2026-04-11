import type { DesignerNode, DesignerEdge, DesignerMeta, ApiWorkflowDefinition } from '../types';

function isBackendId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function graphToApi(
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  meta: DesignerMeta
): Omit<ApiWorkflowDefinition, 'isActive'> {
  const states = nodes.map((n, i) => ({
    ...(isBackendId(n.id) ? { id: n.id } : {}),
    key: n.data.key,
    label: n.data.label,
    color: n.data.color,
    icon: n.data.icon,
    isInitial: n.data.isInitial,
    isFinal: n.data.isFinal,
    sortOrder: n.data.sortOrder ?? i,
  }));

  const transitions = edges.map((e, i) => ({
    ...(isBackendId(e.id) ? { id: e.id } : {}),
    key: e.data?.key || `t_${i}`,
    label: e.data?.label || '',
    fromStateKey: e.data?.fromStateKey || '',
    toStateKey: e.data?.toStateKey || '',
    requiredPermission: e.data?.requiredPermission || undefined,
    uiVariant: e.data?.uiVariant || 'default',
    sortOrder: e.data?.sortOrder ?? i,
    conditions: (e.data?.conditions || []).map((c, ci) => ({
      ...(c.id && isBackendId(c.id) ? { id: c.id } : {}),
      type: c.type,
      config: c.config,
      sortOrder: c.sortOrder ?? ci,
    })),
    actions: (e.data?.actions || []).map((a, ai) => ({
      ...(a.id && isBackendId(a.id) ? { id: a.id } : {}),
      type: a.type,
      config: a.config,
      sortOrder: a.sortOrder ?? ai,
    })),
  }));

  return {
    id: meta.definitionId || '',
    tenantId: meta.tenantId,
    entityType: meta.entityType,
    version: meta.version,
    label: meta.label,
    description: meta.description,
    states,
    transitions,
  };
}
