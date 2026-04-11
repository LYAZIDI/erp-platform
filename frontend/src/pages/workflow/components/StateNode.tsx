import { memo, useCallback } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Dropdown } from 'antd';
import type { StateNodeData } from '../types';
import { useDesignerStore } from '../store/designerStore';

function contrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? '#000' : '#fff';
}

export const StateNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData    = data as StateNodeData;
  const updateNode  = useDesignerStore(s => s.updateNodeData);
  const deleteNode  = useDesignerStore(s => s.deleteNode);
  const selectNode  = useDesignerStore(s => s.selectNode);
  const isReadOnly  = useDesignerStore(s => s.isReadOnly);

  const textColor = contrastColor(nodeData.color || '#3B82F6');

  const menuItems = [
    { key: 'edit',     label: 'Modifier' },
    { key: 'initial',  label: nodeData.isInitial ? '✓ État initial' : 'Définir comme initial' },
    { key: 'final',    label: nodeData.isFinal   ? '✓ État final'   : 'Définir comme final' },
    { type: 'divider' as const },
    { key: 'delete',   label: 'Supprimer', danger: true },
  ];

  const handleMenu = useCallback(({ key }: { key: string }) => {
    if (key === 'edit')    { selectNode(id); return; }
    if (key === 'initial') { updateNode(id, { isInitial: !nodeData.isInitial }); return; }
    if (key === 'final')   { updateNode(id, { isFinal: !nodeData.isFinal }); return; }
    if (key === 'delete')  { deleteNode(id); return; }
  }, [id, nodeData, selectNode, updateNode, deleteNode]);

  return (
    <Dropdown menu={{ items: menuItems, onClick: handleMenu }} trigger={['contextMenu']} disabled={isReadOnly}>
      <div
        onDoubleClick={() => !isReadOnly && selectNode(id)}
        style={{
          width: 180,
          borderRadius: 10,
          border: selected ? '3px solid #1677ff' : '2px solid rgba(0,0,0,0.12)',
          overflow: 'hidden',
          boxShadow: selected ? '0 0 0 3px rgba(22,119,255,0.2)' : '0 2px 8px rgba(0,0,0,0.12)',
          cursor: 'pointer',
          background: '#fff',
          userSelect: 'none',
        }}
      >
        {/* Header */}
        <div style={{
          background: nodeData.color || '#3B82F6',
          padding: '10px 12px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
        }}>
          <span style={{ color: textColor, fontWeight: 700, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nodeData.label}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {nodeData.isInitial && (
              <span style={{ background: 'rgba(255,255,255,0.3)', color: textColor, borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 700 }}>▶</span>
            )}
            {nodeData.isFinal && (
              <span style={{ background: 'rgba(0,0,0,0.2)', color: textColor, borderRadius: 4, padding: '1px 5px', fontSize: 10, fontWeight: 700 }}>⬛</span>
            )}
          </div>
        </div>

        {/* Key */}
        <div style={{ padding: '6px 12px 8px', background: '#fff' }}>
          <code style={{ fontSize: 11, color: '#666' }}>{nodeData.key}</code>
        </div>

        <Handle type="target" position={Position.Left}  style={{ background: nodeData.color, border: '2px solid #fff', width: 10, height: 10 }} />
        <Handle type="source" position={Position.Right} style={{ background: nodeData.color, border: '2px solid #fff', width: 10, height: 10 }} />
      </div>
    </Dropdown>
  );
});

StateNode.displayName = 'StateNode';
