import { useEffect } from 'react';
import { Drawer, Form, Input, Switch, Button, Space, Divider } from 'antd';
import { useDesignerStore } from '../store/designerStore';

const COLORS = [
  '#3B82F6','#22C55E','#EF4444','#F59E0B','#8B5CF6',
  '#EC4899','#14B8A6','#6B7280','#F97316','#0EA5E9',
];

export function StateEditor() {
  const [form] = Form.useForm();
  const selectedNodeId = useDesignerStore(s => s.selectedNodeId);
  const nodes          = useDesignerStore(s => s.nodes);
  const updateNodeData = useDesignerStore(s => s.updateNodeData);
  const deleteNode     = useDesignerStore(s => s.deleteNode);
  const selectNode     = useDesignerStore(s => s.selectNode);

  const node = nodes.find(n => n.id === selectedNodeId);

  useEffect(() => {
    if (node) form.setFieldsValue(node.data);
    else form.resetFields();
  }, [node, form]);

  if (!node) return null;

  const handleSave = () => {
    const values = form.getFieldsValue();
    updateNodeData(node.id, values);
    selectNode(null);
  };

  const selectedColor = Form.useWatch('color', form) || node.data.color;

  return (
    <Drawer
      title="Modifier l'état"
      open={!!selectedNodeId}
      onClose={() => selectNode(null)}
      width={360}
      footer={
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <Button danger onClick={() => { deleteNode(node.id); }}>Supprimer</Button>
          <Space>
            <Button onClick={() => selectNode(null)}>Annuler</Button>
            <Button type="primary" onClick={handleSave}>Enregistrer</Button>
          </Space>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={node.data}>
        <Form.Item label="Clé" name="key" rules={[{ required: true, message: 'La clé est requise' }]}>
          <Input placeholder="ex: open, won, draft" />
        </Form.Item>

        <Form.Item label="Label" name="label" rules={[{ required: true }]}>
          <Input placeholder="ex: Ouvert, Gagné, Brouillon" />
        </Form.Item>

        <Form.Item label="Couleur" name="color">
          <Input placeholder="#3B82F6" style={{ marginBottom: 8 }} />
        </Form.Item>

        {/* Color swatches */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {COLORS.map(c => (
            <div
              key={c}
              onClick={() => form.setFieldValue('color', c)}
              style={{
                width: 28, height: 28, borderRadius: 6, background: c,
                cursor: 'pointer',
                border: selectedColor === c ? '3px solid #1677ff' : '2px solid transparent',
                outline: selectedColor === c ? '2px solid white' : 'none',
                outlineOffset: -4,
              }}
            />
          ))}
        </div>

        <Divider />

        <Form.Item label="État initial" name="isInitial" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item label="État final (terminal)" name="isFinal" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item label="Icône" name="icon">
          <Input placeholder="ex: check-circle, trophy" />
        </Form.Item>

        <Form.Item label="Ordre de tri" name="sortOrder">
          <Input type="number" />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
