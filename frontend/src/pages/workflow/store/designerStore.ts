import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import type { NodeChange, EdgeChange, Connection } from '@xyflow/react';
import type { DesignerNode, DesignerEdge, DesignerMeta, ValidationIssue, StateNodeData, TransitionEdgeData } from '../types';

let _nodeCounter = 1;
let _edgeCounter = 1;

interface DesignerState {
  nodes: DesignerNode[];
  edges: DesignerEdge[];
  meta: DesignerMeta;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isReadOnly: boolean;
  isSaving: boolean;
  saveError: string | null;
  isDirty: boolean;
  validationIssues: ValidationIssue[];

  // React Flow handlers
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // Node operations
  addStateNode: () => void;
  updateNodeData: (id: string, data: Partial<StateNodeData>) => void;
  deleteNode: (id: string) => void;
  selectNode: (id: string | null) => void;

  // Edge operations
  updateEdgeData: (id: string, data: Partial<TransitionEdgeData>) => void;
  deleteEdge: (id: string) => void;
  selectEdge: (id: string | null) => void;

  // Meta
  updateMeta: (meta: Partial<DesignerMeta>) => void;

  // Load / reset
  loadGraph: (nodes: DesignerNode[], edges: DesignerEdge[], meta: DesignerMeta) => void;
  resetGraph: () => void;

  // Status
  setReadOnly: (v: boolean) => void;
  setIsSaving: (v: boolean) => void;
  setSaveError: (err: string | null) => void;
  markSaved: () => void;
  setValidationIssues: (issues: ValidationIssue[]) => void;
}

const DEFAULT_META: DesignerMeta = {
  definitionId: null,
  tenantId: '',
  entityType: '',
  label: 'Nouveau Workflow',
  description: '',
  version: 1,
};

export const useDesignerStore = create<DesignerState>()(
  immer((set) => ({
    nodes: [],
    edges: [],
    meta: { ...DEFAULT_META },
    selectedNodeId: null,
    selectedEdgeId: null,
    isReadOnly: false,
    isSaving: false,
    saveError: null,
    isDirty: false,
    validationIssues: [],

    onNodesChange: (changes) =>
      set((s) => { s.nodes = applyNodeChanges(changes, s.nodes) as DesignerNode[]; s.isDirty = true; }),

    onEdgesChange: (changes) =>
      set((s) => { s.edges = applyEdgeChanges(changes, s.edges) as DesignerEdge[]; s.isDirty = true; }),

    onConnect: (connection) =>
      set((s) => {
        const id = `edge-${_edgeCounter++}`;
        const fromKey = s.nodes.find(n => n.id === connection.source)?.data.key || connection.source || '';
        const toKey   = s.nodes.find(n => n.id === connection.target)?.data.key || connection.target || '';
        s.edges = addEdge({
          ...connection,
          id,
          type: 'transition',
          data: {
            key: `transition_${_edgeCounter}`,
            label: 'Nouvelle Transition',
            fromStateKey: fromKey,
            toStateKey: toKey,
            requiredPermission: '',
            uiVariant: 'default',
            sortOrder: 0,
            conditions: [],
            actions: [],
          } as TransitionEdgeData,
        }, s.edges) as DesignerEdge[];
        s.isDirty = true;
      }),

    addStateNode: () =>
      set((s) => {
        const idx = _nodeCounter++;
        const id = `state-${idx}`;
        const COLORS = ['#3B82F6','#22C55E','#EF4444','#F59E0B','#8B5CF6','#EC4899'];
        s.nodes.push({
          id,
          type: 'state',
          position: { x: 100 + (idx % 4) * 220, y: 100 + Math.floor(idx / 4) * 160 },
          data: {
            key: `state_${idx}`,
            label: `État ${idx}`,
            color: COLORS[idx % COLORS.length],
            icon: '',
            isInitial: false,
            isFinal: false,
            sortOrder: idx,
          },
        } as DesignerNode);
        s.isDirty = true;
      }),

    updateNodeData: (id, data) =>
      set((s) => {
        const node = s.nodes.find(n => n.id === id);
        if (node) { Object.assign(node.data, data); s.isDirty = true; }
      }),

    deleteNode: (id) =>
      set((s) => {
        s.nodes = s.nodes.filter(n => n.id !== id);
        s.edges = s.edges.filter(e => e.source !== id && e.target !== id);
        if (s.selectedNodeId === id) s.selectedNodeId = null;
        s.isDirty = true;
      }),

    selectNode: (id) => set((s) => { s.selectedNodeId = id; s.selectedEdgeId = null; }),

    updateEdgeData: (id, data) =>
      set((s) => {
        const edge = s.edges.find(e => e.id === id);
        if (edge) { Object.assign(edge.data!, data); s.isDirty = true; }
      }),

    deleteEdge: (id) =>
      set((s) => {
        s.edges = s.edges.filter(e => e.id !== id);
        if (s.selectedEdgeId === id) s.selectedEdgeId = null;
        s.isDirty = true;
      }),

    selectEdge: (id) => set((s) => { s.selectedEdgeId = id; s.selectedNodeId = null; }),

    updateMeta: (meta) =>
      set((s) => { Object.assign(s.meta, meta); s.isDirty = true; }),

    loadGraph: (nodes, edges, meta) =>
      set((s) => { s.nodes = nodes; s.edges = edges; s.meta = meta; s.isDirty = false; s.selectedNodeId = null; s.selectedEdgeId = null; }),

    resetGraph: () =>
      set((s) => { s.nodes = []; s.edges = []; s.meta = { ...DEFAULT_META }; s.isDirty = false; s.selectedNodeId = null; s.selectedEdgeId = null; }),

    setReadOnly:  (v) => set((s) => { s.isReadOnly = v; }),
    setIsSaving:  (v) => set((s) => { s.isSaving = v; }),
    setSaveError: (e) => set((s) => { s.saveError = e; }),
    markSaved:    ()  => set((s) => { s.isDirty = false; s.saveError = null; }),
    setValidationIssues: (issues) => set((s) => { s.validationIssues = issues; }),
  }))
);
