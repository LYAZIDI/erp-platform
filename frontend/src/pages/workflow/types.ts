import type { Node, Edge } from '@xyflow/react';

// ── API types (workflow-platform backend) ─────────────────────────────────────

export interface ApiWorkflowDefinition {
  id: string;
  tenantId: string;
  entityType: string;
  version: number;
  label: string;
  description?: string;
  isActive: boolean;
  states: ApiWorkflowState[];
  transitions: ApiWorkflowTransition[];
}

export interface ApiWorkflowState {
  id?: string;
  key: string;
  label: string;
  color?: string;
  icon?: string;
  isInitial: boolean;
  isFinal: boolean;
  sortOrder: number;
}

export interface ApiWorkflowTransition {
  id?: string;
  key: string;
  label: string;
  fromStateKey: string;
  toStateKey: string;
  requiredPermission?: string;
  uiVariant?: string;
  sortOrder: number;
  conditions: ApiConditionConfig[];
  actions: ApiActionConfig[];
}

export interface ApiConditionConfig {
  id?: string;
  type: string;
  config: Record<string, unknown>;
  sortOrder: number;
}

export interface ApiActionConfig {
  id?: string;
  type: string;
  config: Record<string, unknown>;
  sortOrder: number;
}

// ── Designer graph types ──────────────────────────────────────────────────────

export interface StateNodeData extends Record<string, unknown> {
  key: string;
  label: string;
  color: string;
  icon: string;
  isInitial: boolean;
  isFinal: boolean;
  sortOrder: number;
}

export interface TransitionEdgeData extends Record<string, unknown> {
  key: string;
  label: string;
  fromStateKey: string;
  toStateKey: string;
  requiredPermission: string;
  uiVariant: string;
  sortOrder: number;
  conditions: ApiConditionConfig[];
  actions: ApiActionConfig[];
}

export type DesignerNode = Node<StateNodeData, 'state'>;
export type DesignerEdge = Edge<TransitionEdgeData>;

export interface DesignerMeta {
  definitionId: string | null;
  tenantId: string;
  entityType: string;
  label: string;
  description: string;
  version: number;
}

export interface ValidationIssue {
  level: 'error' | 'warning' | 'info';
  message: string;
  nodeId?: string;
  edgeId?: string;
}

// ── Built-in condition/action schemas ────────────────────────────────────────

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'select';
  options?: string[];
  placeholder?: string;
}

export interface ConfigSchema {
  type: string;
  label: string;
  fields: ConfigField[];
}

export const BUILT_IN_CONDITIONS: ConfigSchema[] = [
  {
    type: 'field_not_empty',
    label: 'Champ entité non vide',
    fields: [{ key: 'field', label: 'Nom du champ', type: 'text', placeholder: 'ex: contactId' }],
  },
  {
    type: 'payload_field_not_empty',
    label: 'Champ payload non vide',
    fields: [{ key: 'field', label: 'Nom du champ', type: 'text', placeholder: 'ex: lostReason' }],
  },
  {
    type: 'field_comparison',
    label: 'Comparaison de champ',
    fields: [
      { key: 'field', label: 'Champ', type: 'text' },
      { key: 'operator', label: 'Opérateur', type: 'select', options: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'] },
      { key: 'value', label: 'Valeur', type: 'text' },
    ],
  },
  {
    type: 'role_check',
    label: 'Vérification de rôle',
    fields: [{ key: 'role', label: 'Rôle requis', type: 'text', placeholder: 'ex: ADMIN' }],
  },
];

export const BUILT_IN_ACTIONS: ConfigSchema[] = [
  {
    type: 'set_field',
    label: 'Définir un champ',
    fields: [
      { key: 'field', label: 'Champ cible', type: 'text' },
      { key: 'value', label: 'Valeur', type: 'text', placeholder: '__NOW__, __USER_ID__ ou valeur fixe' },
    ],
  },
  {
    type: 'copy_payload_field',
    label: 'Copier champ payload',
    fields: [
      { key: 'from', label: 'Source', type: 'text' },
      { key: 'to', label: 'Destination', type: 'text' },
    ],
  },
  {
    type: 'emit_event',
    label: 'Émettre un événement',
    fields: [{ key: 'eventType', label: 'Type événement', type: 'text', placeholder: 'ex: lead.won' }],
  },
];
