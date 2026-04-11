import { useState } from 'react';
import {
  Table, Button, Tag, Space, Avatar, Modal, Form, Input, Select,
  Popconfirm, Card, Typography, message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '../../api/crm';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'Manuel', WEBSITE: 'Site web', REFERRAL: 'Recommandation',
  LINKEDIN: 'LinkedIn', EMAIL_CAMPAIGN: 'Email', PHONE: 'Téléphone', OTHER: 'Autre',
};
const SOURCE_COLORS: Record<string, string> = {
  MANUAL: 'default', WEBSITE: 'blue', REFERRAL: 'green',
  LINKEDIN: 'geekblue', EMAIL_CAMPAIGN: 'orange', PHONE: 'purple', OTHER: 'default',
};

export default function Contacts() {
  const qc  = useQueryClient();
  const can = useAuthStore((s) => s.can);

  const [search,    setSearch]    = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<any>(null);
  const [form]                    = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search],
    queryFn:  () => contactsApi.list({ search: search || undefined }),
  });

  const saveMutation = useMutation({
    mutationFn: (values: any) => editing ? contactsApi.update(editing.id, values) : contactsApi.create(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      setModalOpen(false); form.resetFields(); setEditing(null);
      message.success(editing ? 'Contact mis à jour' : 'Contact créé');
    },
    onError: (err: any) => message.error(err?.response?.data?.error || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contactsApi.remove(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['contacts'] }); message.success('Supprimé'); },
  });

  function openEdit(r: any) {
    setEditing(r);
    form.setFieldsValue(r);
    setModalOpen(true);
  }

  const columns = [
    {
      title: 'Contact', key: 'name',
      render: (r: any) => (
        <Space>
          <Avatar style={{ background: '#1677ff' }}>
            {r.firstName?.[0]}{r.lastName?.[0]}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{r.firstName} {r.lastName}</div>
            {r.company && <div style={{ fontSize: 12, color: '#888' }}>{r.company}</div>}
          </div>
        </Space>
      ),
    },
    { title: 'Email',    dataIndex: 'email',  key: 'email',  render: (v: string) => v || '—' },
    { title: 'Téléphone',dataIndex: 'phone',  key: 'phone',  render: (v: string) => v || '—' },
    { title: 'Ville',    dataIndex: 'city',   key: 'city',   render: (v: string) => v || '—' },
    {
      title: 'Source', dataIndex: 'source', key: 'source',
      render: (v: string) => <Tag color={SOURCE_COLORS[v] || 'default'}>{SOURCE_LABELS[v] || v}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 100,
      render: (r: any) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} />
          {can('crm', 'DELETE') && (
            <Popconfirm title="Supprimer ce contact ?" onConfirm={() => deleteMutation.mutate(r.id)}>
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
        <Title level={4} style={{ margin: 0 }}>Contacts</Title>
        {can('crm', 'CREATE') && (
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
            Nouveau contact
          </Button>
        )}
      </div>

      <Card>
        <Input prefix={<SearchOutlined />} placeholder="Rechercher par nom, email, entreprise..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ width: 320, marginBottom: 16 }} allowClear />

        <Table dataSource={data?.data || []} columns={columns} rowKey="id"
          loading={isLoading} pagination={{ total: data?.total, pageSize: 20 }} />
      </Card>

      <Modal title={editing ? 'Modifier le contact' : 'Nouveau contact'}
        open={modalOpen} onCancel={() => { setModalOpen(false); setEditing(null); }}
        onOk={() => form.submit()} confirmLoading={saveMutation.isPending}
        width={640} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="firstName" label="Prénom" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="lastName" label="Nom" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="Téléphone">
              <Input />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="company" label="Entreprise">
              <Input />
            </Form.Item>
            <Form.Item name="jobTitle" label="Poste">
              <Input />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="city" label="Ville">
              <Input />
            </Form.Item>
            <Form.Item name="source" label="Source">
              <Select options={Object.entries(SOURCE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
