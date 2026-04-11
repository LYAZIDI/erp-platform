import { useCallback } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  BackgroundVariant, Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button, Space, Alert, Tag, Tooltip } from 'antd';
import { PlusOutlined, FullscreenOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { useDesignerStore } from '../store/designerStore';
import { useValidation } from '../hooks/useValidation';
import { StateNode } from './StateNode';
import { TransitionEdge } from './TransitionEdge';
import { StateEditor } from './StateEditor';
import { TransitionEditor } from './TransitionEditor';

const NODE_TYPES = { state: StateNode };
const EDGE_TYPES = { transition: TransitionEdge };

export function WorkflowCanvas() {
  const nodes          = useDesignerStore(s => s.nodes);
  const edges          = useDesignerStore(s => s.edges);
  const onNodesChange  = useDesignerStore(s => s.onNodesChange);
  const onEdgesChange  = useDesignerStore(s => s.onEdgesChange);
  const onConnect      = useDesignerStore(s => s.onConnect);
  const addStateNode   = useDesignerStore(s => s.addStateNode);
  const isReadOnly     = useDesignerStore(s => s.isReadOnly);
  const setReadOnly    = useDesignerStore(s => s.setReadOnly);
  const validationIssues = useDesignerStore(s => s.validationIssues);

  // Run validation hook
  useValidation();

  const errors   = validationIssues.filter(i => i.level === 'error');
  const warnings = validationIssues.filter(i => i.level === 'warning');
  const infos    = validationIssues.filter(i => i.level === 'info');

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: { id: string }) => {
    if (!isReadOnly) useDesignerStore.getState().selectEdge(edge.id);
  }, [isReadOnly]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={isReadOnly ? undefined : onNodesChange}
        onEdgesChange={isReadOnly ? undefined : onEdgesChange}
        onConnect={isReadOnly ? undefined : onConnect}
        onEdgeClick={onEdgeClick}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode={isReadOnly ? null : 'Delete'}
        nodesDraggable={!isReadOnly}
        nodesConnectable={!isReadOnly}
        elementsSelectable={!isReadOnly}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => (n.data as { color?: string }).color || '#3B82F6'}
          pannable zoomable
          style={{ border: '1px solid #e5e7eb', borderRadius: 8 }}
        />

        {/* Toolbar */}
        <Panel position="top-left">
          <Space>
            {!isReadOnly && (
              <Button
                icon={<PlusOutlined />}
                type="primary"
                onClick={addStateNode}
                size="small"
              >
                Ajouter un état
              </Button>
            )}
            <Tooltip title={isReadOnly ? 'Déverrouiller' : 'Verrouiller'}>
              <Button
                icon={isReadOnly ? <LockOutlined /> : <UnlockOutlined />}
                size="small"
                onClick={() => setReadOnly(!isReadOnly)}
              />
            </Tooltip>
            <Tooltip title="Ajuster la vue">
              <Button
                icon={<FullscreenOutlined />}
                size="small"
                onClick={() => {
                  // ReactFlow fitView via instance — handled by Controls button
                }}
              />
            </Tooltip>
          </Space>
        </Panel>

        {/* Validation panel */}
        {validationIssues.length > 0 && (
          <Panel position="bottom-left" style={{ maxWidth: 340, maxHeight: 200, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {errors.map((issue, i) => (
                <Alert key={`e${i}`} type="error" message={issue.message} banner style={{ fontSize: 11, padding: '2px 8px' }} />
              ))}
              {warnings.map((issue, i) => (
                <Alert key={`w${i}`} type="warning" message={issue.message} banner style={{ fontSize: 11, padding: '2px 8px' }} />
              ))}
              {infos.map((issue, i) => (
                <Alert key={`i${i}`} type="info" message={issue.message} banner style={{ fontSize: 11, padding: '2px 8px' }} />
              ))}
            </div>
          </Panel>
        )}

        {/* Status tags */}
        <Panel position="top-right">
          <Space size={4}>
            {errors.length > 0   && <Tag color="error">{errors.length} erreur{errors.length > 1 ? 's' : ''}</Tag>}
            {warnings.length > 0 && <Tag color="warning">{warnings.length} avertissement{warnings.length > 1 ? 's' : ''}</Tag>}
            {errors.length === 0 && warnings.length === 0 && (
              <Tag color="success">Valide</Tag>
            )}
            {isReadOnly && <Tag color="default">Lecture seule</Tag>}
          </Space>
        </Panel>
      </ReactFlow>

      {/* Editors */}
      <StateEditor />
      <TransitionEditor />
    </div>
  );
}
