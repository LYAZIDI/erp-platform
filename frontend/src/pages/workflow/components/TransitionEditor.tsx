import { useEffect } from 'react';
import { Drawer, Form, Input, Select, Button, Space, Divider, Card, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useDesignerStore } from '../store/designerStore';
import { BUILT_IN_CONDITIONS, BUILT_IN_ACTIONS } from '../types';
import type { ApiConditionConfig, ApiActionConfig } from '../types';

const { Text } = Typography;

const UI_VARIANTS = [
  { value: 'default', label: 'Défaut (gris)' },
  { value: 'primary', label: 'Primaire (bleu)' },
  { value: 'success', label: 'Succès (vert)' },
  { value: 'danger',  label: 'Danger (rouge)' },
  { value: 'warning', label: 'Avertissement (orange)' },
];

function ConfigForm({ config, schema, onChange }: {
  config: Record<string, unknown>;
  schema: { key: string; label: string; type: 'text' | 'select'; options?: string[]; placeholder?: string }[];
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {schema.map(f => (
        <div key={f.key}>
          <Text type="secondary" style={{ fontSize: 11 }}>{f.label}</Text>
          {f.type === 'select' ? (
            <Select
              size="small" style={{ width: '100%', marginTop: 2 }}
              value={String(config[f.key] || '')}
              onChange={v => onChange(f.key, v)}
              options={(f.options || []).map(o => ({ value: o, label: o }))}
            />
          ) : (
            <Input
              size="small" style={{ marginTop: 2 }}
              placeholder={f.placeholder}
              value={String(config[f.key] || '')}
              onChange={e => onChange(f.key, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function TransitionEditor() {
  const [form] = Form.useForm();
  const selectedEdgeId = useDesignerStore(s => s.selectedEdgeId);
  const edges          = useDesignerStore(s => s.edges);
  const updateEdgeData = useDesignerStore(s => s.updateEdgeData);
  const deleteEdge     = useDesignerStore(s => s.deleteEdge);
  const selectEdge     = useDesignerStore(s => s.selectEdge);

  const edge = edges.find(e => e.id === selectedEdgeId);

  useEffect(() => {
    if (edge) form.setFieldsValue(edge.data);
    else form.resetFields();
  }, [edge, form]);

  if (!edge || !edge.data) return null;
  const d = edge.data;

  const handleSave = () => {
    const values = form.getFieldsValue();
    updateEdgeData(edge.id, values);
    selectEdge(null);
  };

  // Conditions
  const conditions: ApiConditionConfig[] = d.conditions || [];
  const actions: ApiActionConfig[]        = d.actions    || [];

  const addCondition = () => {
    const schema = BUILT_IN_CONDITIONS[0];
    updateEdgeData(edge.id, {
      conditions: [...conditions, { type: schema.type, config: {}, sortOrder: conditions.length }],
    });
  };

  const updateConditionType = (i: number, type: string) => {
    const updated = [...conditions];
    updated[i] = { ...updated[i], type, config: {} };
    updateEdgeData(edge.id, { conditions: updated });
  };

  const updateConditionConfig = (i: number, key: string, value: string) => {
    const updated = [...conditions];
    updated[i] = { ...updated[i], config: { ...updated[i].config, [key]: value } };
    updateEdgeData(edge.id, { conditions: updated });
  };

  const removeCondition = (i: number) => {
    updateEdgeData(edge.id, { conditions: conditions.filter((_, ci) => ci !== i) });
  };

  const addAction = () => {
    const schema = BUILT_IN_ACTIONS[0];
    updateEdgeData(edge.id, {
      actions: [...actions, { type: schema.type, config: {}, sortOrder: actions.length }],
    });
  };

  const updateActionType = (i: number, type: string) => {
    const updated = [...actions];
    updated[i] = { ...updated[i], type, config: {} };
    updateEdgeData(edge.id, { actions: updated });
  };

  const updateActionConfig = (i: number, key: string, value: string) => {
    const updated = [...actions];
    updated[i] = { ...updated[i], config: { ...updated[i].config, [key]: value } };
    updateEdgeData(edge.id, { actions: updated });
  };

  const removeAction = (i: number) => {
    updateEdgeData(edge.id, { actions: actions.filter((_, ai) => ai !== i) });
  };

  return (
    <Drawer
      title="Modifier la transition"
      open={!!selectedEdgeId}
      onClose={() => selectEdge(null)}
      width={420}
      footer={
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Button danger onClick={() => { deleteEdge(edge.id); }}>Supprimer</Button>
          <Space>
            <Button onClick={() => selectEdge(null)}>Annuler</Button>
            <Button type="primary" onClick={handleSave}>Enregistrer</Button>
          </Space>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={d}>
        <Form.Item label="Clé" name="key" rules={[{ required: true }]}>
          <Input placeholder="ex: win, lose, approve" />
        </Form.Item>
        <Form.Item label="Label" name="label" rules={[{ required: true }]}>
          <Input placeholder="ex: Marquer Gagné" />
        </Form.Item>
        <Form.Item label="Permission requise" name="requiredPermission">
          <Input placeholder="ex: PERM_CRM_WRITE" />
        </Form.Item>
        <Form.Item label="Variante UI" name="uiVariant">
          <Select options={UI_VARIANTS} />
        </Form.Item>
      </Form>

      <Divider orientation="left">
        Conditions ({conditions.length}) <Text type="secondary" style={{ fontSize: 11 }}>Toutes doivent passer</Text>
      </Divider>

      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        {conditions.map((c, i) => {
          const schema = BUILT_IN_CONDITIONS.find(s => s.type === c.type) || BUILT_IN_CONDITIONS[0];
          return (
            <Card
              key={i} size="small"
              extra={<Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => removeCondition(i)} />}
              title={
                <Select
                  size="small" style={{ width: '100%' }}
                  value={c.type}
                  onChange={v => updateConditionType(i, v)}
                  options={BUILT_IN_CONDITIONS.map(s => ({ value: s.type, label: s.label }))}
                />
              }
            >
              <ConfigForm
                config={c.config}
                schema={schema.fields}
                onChange={(k, v) => updateConditionConfig(i, k, v)}
              />
            </Card>
          );
        })}
        <Button icon={<PlusOutlined />} size="small" block onClick={addCondition}>Ajouter une condition</Button>
      </Space>

      <Divider orientation="left">Actions ({actions.length})</Divider>

      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        {actions.map((a, i) => {
          const schema = BUILT_IN_ACTIONS.find(s => s.type === a.type) || BUILT_IN_ACTIONS[0];
          return (
            <Card
              key={i} size="small"
              extra={<Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => removeAction(i)} />}
              title={
                <Select
                  size="small" style={{ width: '100%' }}
                  value={a.type}
                  onChange={v => updateActionType(i, v)}
                  options={BUILT_IN_ACTIONS.map(s => ({ value: s.type, label: s.label }))}
                />
              }
            >
              <ConfigForm
                config={a.config}
                schema={schema.fields}
                onChange={(k, v) => updateActionConfig(i, k, v)}
              />
            </Card>
          );
        })}
        <Button icon={<PlusOutlined />} size="small" block onClick={addAction}>Ajouter une action</Button>
      </Space>
    </Drawer>
  );
}
