import { useState } from 'react';
import {
  Table, Button, Space, Card, Typography, Modal, Form,
  Input, InputNumber, Select, Popconfirm, message, Tag,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../../api/ventes';
import { useAuthStore } from '../../store/authStore';

const { Title } = Typography;

const TYPE_LABELS: Record<string, string> = { PRODUCT: 'Produit', SERVICE: 'Service' };
const TYPE_COLORS: Record<string, string> = { PRODUCT: 'blue', SERVICE: 'green' };

export default function Products() {
  const qc  = useQueryClient();
  const can = useAuthStore((s) => s.can);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<any>(null);
  const [form]                    = Form.useForm();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn:  () => productsApi.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (values: any) =>
      editing ? productsApi.update(editing.id, values) : productsApi.create(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setModalOpen(false); form.resetFields(); setEditing(null);
      message.success(editing ? 'Produit mis à jour' : 'Produit créé');
    },
    onError: (e: any) => message.error(e?.response?.data?.error || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); message.success('Supprimé'); },
    onError:   (e: any) => message.error(e?.response?.data?.error || 'Erreur'),
  });

  function openEdit(r: any) {
    setEditing(r);
    form.setFieldsValue(r);
    setModalOpen(true);
  }

  const columns = [
    { title: 'Référence', dataIndex: 'reference', key: 'ref',
      render: (v: string) => v || '—' },
    { title: 'Nom', dataIndex: 'name', key: 'name', render: (v: string) => <strong>{v}</strong> },
    {
      title: 'Type', dataIndex: 'type', key: 'type',
      render: (v: string) => <Tag color={TYPE_COLORS[v]}>{TYPE_LABELS[v] || v}</Tag>,
    },
    {
      title: 'Prix HT', dataIndex: 'unitPrice', key: 'price', align: 'right' as const,
      render: (v: string) => `${Number(v).toFixed(2)} MAD`,
    },
    {
      title: 'TVA', dataIndex: 'taxRate', key: 'tax', align: 'right' as const,
      render: (v: string) => `${Number(v)}%`,
    },
    { title: 'Unité', dataIndex: 'unit', key: 'unit', render: (v: string) => v || '—' },
    {
      title: 'Actions', key: 'actions', width: 100,
      render: (r: any) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} />
          {can('ventes', 'DELETE') && (
            <Popconfirm title="Supprimer ce produit ?" onConfirm={() => deleteMutation.mutate(r.id)}>
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Produits & Services</Title>
        {can('ventes', 'CREATE') && (
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
            Nouveau produit
          </Button>
        )}
      </div>

      <Card>
        <Table
          dataSource={products as any[]}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title={editing ? 'Modifier le produit' : 'Nouveau produit'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="name" label="Nom" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="reference" label="Référence interne">
              <Input placeholder="ex: PROD-001" />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="type" label="Type" initialValue="PRODUCT">
              <Select options={[
                { value: 'PRODUCT', label: 'Produit' },
                { value: 'SERVICE', label: 'Service' },
              ]} />
            </Form.Item>
            <Form.Item name="unitPrice" label="Prix HT (MAD)" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} precision={2} />
            </Form.Item>
            <Form.Item name="taxRate" label="TVA (%)" initialValue={20}>
              <InputNumber min={0} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="unit" label="Unité">
              <Input placeholder="ex: pcs, h, kg" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
