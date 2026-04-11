import { memo, useCallback } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from '@xyflow/react';
import { Dropdown, Badge } from 'antd';
import type { TransitionEdgeData } from '../types';
import { useDesignerStore } from '../store/designerStore';

const VARIANT_COLORS: Record<string, string> = {
  default: '#6B7280',
  primary: '#1677ff',
  success: '#22C55E',
  danger:  '#EF4444',
  warning: '#F59E0B',
};

export const TransitionEdge = memo(({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected,
}: EdgeProps) => {
  const edgeData   = data as TransitionEdgeData;
  const selectEdge = useDesignerStore(s => s.selectEdge);
  const deleteEdge = useDesignerStore(s => s.deleteEdge);
  const isReadOnly = useDesignerStore(s => s.isReadOnly);

  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const color = VARIANT_COLORS[edgeData?.uiVariant || 'default'] || '#6B7280';

  const menuItems = [
    { key: 'edit',   label: 'Modifier' },
    { type: 'divider' as const },
    { key: 'delete', label: 'Supprimer', danger: true },
  ];

  const handleMenu = useCallback(({ key }: { key: string }) => {
    if (key === 'edit')   selectEdge(id);
    if (key === 'delete') deleteEdge(id);
  }, [id, selectEdge, deleteEdge]);

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{ stroke: color, strokeWidth: selected ? 3 : 2, strokeDasharray: selected ? '6 3' : undefined }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <Dropdown menu={{ items: menuItems, onClick: handleMenu }} trigger={['contextMenu', 'click']} disabled={isReadOnly}>
            <div
              onDoubleClick={() => !isReadOnly && selectEdge(id)}
              style={{
                background: '#fff',
                border: `2px solid ${color}`,
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 600,
                color,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: selected ? `0 0 0 2px ${color}40` : '0 1px 4px rgba(0,0,0,0.12)',
                whiteSpace: 'nowrap',
              }}
            >
              {edgeData?.label || edgeData?.key}
              {(edgeData?.conditions?.length || 0) > 0 && (
                <Badge count={edgeData.conditions.length} size="small" color="#6B7280" title="Conditions" />
              )}
              {(edgeData?.actions?.length || 0) > 0 && (
                <Badge count={edgeData.actions.length} size="small" color={color} title="Actions" />
              )}
            </div>
          </Dropdown>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

TransitionEdge.displayName = 'TransitionEdge';
