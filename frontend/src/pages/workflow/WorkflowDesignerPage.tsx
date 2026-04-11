import { useState, useCallback } from 'react';
import {
  Layout, Button, Input, Space, Typography, Drawer, List, Tag,
  Tooltip, message, Popconfirm, Spin, Empty,
} from 'antd';
import {
  SaveOutlined, FolderOpenOutlined, PlusOutlined, DeleteOutlined,
  ExclamationCircleOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useDesignerStore } from './store/designerStore';
import { WorkflowCanvas } from './components/WorkflowCanvas';
import { apiToGraph } from './mappers/apiToGraph';
import { graphToApi } from './mappers/graphToApi';
import type { ApiWorkflowDefinition } from './types';

const { Header, Content } = Layout;
const { Text, Title } = Typography;

// ── API helpers ──────────────────────────────────────────────────────────────

async function fetchDefinitions(entityType: string): Promise<ApiWorkflowDefinition[]> {
  const params = entityType ? `?entityType=${encodeURIComponent(entityType)}` : '';
  const res = await fetch(`/wf-api/workflow-definitions${params}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function saveDefinition(payload: Omit<ApiWorkflowDefinition, 'isActive'>): Promise<ApiWorkflowDefinition> {
  const url = payload.id
    ? `/wf-api/workflow-definitions/${payload.id}`
    : '/wf-api/workflow-definitions';
  const method = payload.id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

async function deleteDefinition(id: string): Promise<void> {
  const res = await fetch(`/wf-api/workflow-definitions/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function WorkflowDesignerPage() {
  const [msg, ctxHolder] = message.useMessage();

  const nodes    = useDesignerStore(s => s.nodes);
  const edges    = useDesignerStore(s => s.edges);
  const meta     = useDesignerStore(s => s.meta);
  const isDirty  = useDesignerStore(s => s.isSaving);
  const isSaving = useDesignerStore(s => s.isSaving);
  const validationIssues = useDesignerStore(s => s.validationIssues);
  const { updateMeta, loadGraph, resetGraph, setIsSaving, setSaveError, markSaved } = useDesignerStore.getState();

  const [listOpen, setListOpen]     = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [definitions, setDefinitions] = useState<ApiWorkflowDefinition[]>([]);
  const [filterEntity, setFilterEntity] = useState('');

  const hasErrors = validationIssues.some(i => i.level === 'error');

  // ── Load list ──────────────────────────────────────────────────────────────
  const openList = useCallback(async () => {
    setListOpen(true);
    setListLoading(true);
    try {
      const defs = await fetchDefinitions(filterEntity);
      setDefinitions(defs);
    } catch (e: unknown) {
      msg.error('Impossible de charger les définitions');
    } finally {
      setListLoading(false);
    }
  }, [filterEntity, msg]);

  const handleLoadDef = useCallback((def: ApiWorkflowDefinition) => {
    const { meta: m, nodes: n, edges: e } = apiToGraph(def);
    loadGraph(n, e, m);
    setListOpen(false);
    msg.success(`Workflow "${def.label}" chargé`);
  }, [loadGraph, msg]);

  const handleDeleteDef = useCallback(async (def: ApiWorkflowDefinition) => {
    try {
      await deleteDefinition(def.id);
      setDefinitions(prev => prev.filter(d => d.id !== def.id));
      msg.success('Workflow supprimé');
    } catch {
      msg.error('Erreur lors de la suppression');
    }
  }, [msg]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (hasErrors) {
      msg.error('Corrigez les erreurs de validation avant de sauvegarder');
      return;
    }
    if (!meta.entityType.trim()) {
      msg.error('Le type d\'entité est requis');
      return;
    }
    if (!meta.label.trim()) {
      msg.error('Le libellé du workflow est requis');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const payload = graphToApi(nodes, edges, meta);
      const saved   = await saveDefinition(payload);
      const { meta: m, nodes: n, edges: e } = apiToGraph(saved);
      loadGraph(n, e, m);
      markSaved();
      msg.success('Workflow sauvegardé avec succès');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Erreur inconnue';
      setSaveError(errMsg);
      msg.error(`Erreur: ${errMsg}`);
    } finally {
      setIsSaving(false);
    }
  }, [hasErrors, meta, nodes, edges, setIsSaving, setSaveError, loadGraph, markSaved, msg]);

  // ── New ────────────────────────────────────────────────────────────────────
  const handleNew = useCallback(() => {
    resetGraph();
    msg.info('Nouveau workflow créé');
  }, [resetGraph, msg]);

  return (
    <Layout style={{ height: 'calc(100vh - 112px)', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      {ctxHolder}

      {/* ── Toolbar Header ─────────────────────────────────────────────────── */}
      <Header style={{
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        padding: '0 16px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        {/* Meta fields */}
        <Space size={8} style={{ flex: 1 }}>
          <Input
            placeholder="Type d'entité (ex: lead)"
            value={meta.entityType}
            onChange={e => updateMeta({ entityType: e.target.value })}
            style={{ width: 160 }}
            size="small"
          />
          <Input
            placeholder="Libellé du workflow"
            value={meta.label}
            onChange={e => updateMeta({ label: e.target.value })}
            style={{ width: 220 }}
            size="small"
          />
          <Input
            placeholder="Description (optionnel)"
            value={meta.description}
            onChange={e => updateMeta({ description: e.target.value })}
            style={{ width: 240 }}
            size="small"
          />
          {meta.definitionId && (
            <Tag color="blue" style={{ fontSize: 10 }}>
              v{meta.version} · {meta.definitionId.slice(0, 8)}…
            </Tag>
          )}
        </Space>

        {/* Actions */}
        <Space size={8}>
          <Tooltip title="Nouveau workflow">
            <Button icon={<PlusOutlined />} size="small" onClick={handleNew}>
              Nouveau
            </Button>
          </Tooltip>

          <Tooltip title="Ouvrir un workflow existant">
            <Button icon={<FolderOpenOutlined />} size="small" onClick={openList}>
              Ouvrir
            </Button>
          </Tooltip>

          <Tooltip title={hasErrors ? 'Erreurs de validation — sauvegarde impossible' : 'Sauvegarder'}>
            <Button
              icon={<SaveOutlined />}
              type="primary"
              size="small"
              onClick={handleSave}
              loading={isSaving}
              disabled={hasErrors}
            >
              Sauvegarder
            </Button>
          </Tooltip>
        </Space>

        {/* Validation indicator */}
        {validationIssues.length > 0 ? (
          <Tooltip title={validationIssues.map(i => i.message).join('\n')}>
            <ExclamationCircleOutlined
              style={{ color: hasErrors ? '#ef4444' : '#f59e0b', fontSize: 16, cursor: 'default' }}
            />
          </Tooltip>
        ) : (
          <CheckCircleOutlined style={{ color: '#22c55e', fontSize: 16 }} />
        )}
      </Header>

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <Content style={{ position: 'relative', overflow: 'hidden' }}>
        <WorkflowCanvas />
      </Content>

      {/* ── Definition list drawer ─────────────────────────────────────────── */}
      <Drawer
        title="Workflows enregistrés"
        open={listOpen}
        onClose={() => setListOpen(false)}
        width={440}
        extra={
          <Space>
            <Input
              placeholder="Filtrer par type d'entité"
              value={filterEntity}
              onChange={e => setFilterEntity(e.target.value)}
              size="small"
              style={{ width: 180 }}
            />
            <Button size="small" onClick={openList}>Rafraîchir</Button>
          </Space>
        }
      >
        {listLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : definitions.length === 0 ? (
          <Empty description="Aucun workflow trouvé" />
        ) : (
          <List
            dataSource={definitions}
            renderItem={(def) => (
              <List.Item
                key={def.id}
                actions={[
                  <Button
                    key="load"
                    type="primary"
                    size="small"
                    onClick={() => handleLoadDef(def)}
                  >
                    Charger
                  </Button>,
                  <Popconfirm
                    key="del"
                    title="Supprimer ce workflow ?"
                    onConfirm={() => handleDeleteDef(def)}
                    okText="Oui"
                    cancelText="Non"
                  >
                    <Button danger size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{def.label}</Text>
                      <Tag color="geekblue">{def.entityType}</Tag>
                      <Tag>v{def.version}</Tag>
                      {def.isActive
                        ? <Tag color="success">Actif</Tag>
                        : <Tag color="default">Inactif</Tag>
                      }
                    </Space>
                  }
                  description={
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {def.states.length} état{def.states.length > 1 ? 's' : ''} ·{' '}
                      {def.transitions.length} transition{def.transitions.length > 1 ? 's' : ''}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </Layout>
  );
}
