import { useState } from 'react';
import {
  Table, Button, Space, Tag, Avatar, Modal, Form, Input, Select,
  Popconfirm, Typography, Card, message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, rolesApi } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

const { Title } = Typography;

export default function UsersPage() {
  const qc      = useQueryClient();
  const can     = useAuthStore((s) => s.can);
  const [search,    setSearch]    = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<any>(null);
  const [form]                    = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn:  () => usersApi.list({ search: search || undefined }),
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn:  () => rolesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (values: any) => editing
      ? usersApi.update(editing.id, values)
      : usersApi.create(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setModalOpen(false);
      form.resetFields();
      message.success(editing ? 'Utilisateur mis à jour' : 'Utilisateur créé');
      setEditing(null);
    },
    onError: (err: any) => message.error(err?.response?.data?.error || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['users'] }); message.success('Supprimé'); },
  });

  function openEdit(record: any) {
    setEditing(record);
    form.setFieldsValue({
      firstName: record.firstName,
      lastName:  record.lastName,
      email:     record.email,
      roleIds:   record.userRoles?.map((ur: any) => ur.role.id),
    });
    setModalOpen(true);
  }

  const columns = [
    {
      title: 'Utilisateur', key: 'user',
      render: (r: any) => (
        <Space>
          <Avatar style={{ background: '#1677ff' }}>{r.firstName?.[0]}{r.lastName?.[0]}</Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{r.firstName} {r.lastName}</div>
            <div style={{ color: '#888', fontSize: 12 }}>{r.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Rôles', dataIndex: 'userRoles', key: 'roles',
      render: (urs: any[]) => urs?.map((ur) => <Tag key={ur.role.id}>{ur.role.name}</Tag>),
    },
    {
      title: 'Statut', dataIndex: 'isActive', key: 'status',
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Actif' : 'Inactif'}</Tag>,
    },
    {
      title: 'Connexion', dataIndex: 'lastLoginAt', key: 'login',
      render: (v: string) => v ? new Date(v).toLocaleDateString('fr-FR') : <Tag>Jamais</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 120,
      render: (r: any) => (
        <Space>
          {can('kernel', 'MANAGE_USERS') && (
            <>
              <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} />
              {!r.isOwner && (
                <Popconfirm title="Supprimer cet utilisateur ?" onConfirm={() => deleteMutation.mutate(r.id)}>
                  <Button icon={<DeleteOutlined />} size="small" danger />
                </Popconfirm>
              )}
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Utilisateurs</Title>
        {can('kernel', 'MANAGE_USERS') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
            Nouvel utilisateur
          </Button>
        )}
      </div>

      <Card>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280, marginBottom: 16 }}
          allowClear
        />

        <Table
          dataSource={data?.data || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ total: data?.total, pageSize: 20 }}
        />
      </Card>

      {/* ── Modal créer / modifier ── */}
      <Modal
        title={editing ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="firstName" label="Prénom" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="lastName" label="Nom" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="email" label="Email"
            rules={[{ required: !editing }, { type: 'email' }]}>
            <Input disabled={!!editing} />
          </Form.Item>
          {!editing && (
            <Form.Item name="password" label="Mot de passe"
              rules={[{ required: true }, { min: 8 }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="roleIds" label="Rôles">
            <Select mode="multiple" placeholder="Sélectionner des rôles"
              options={roles.map((r: any) => ({ value: r.id, label: r.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
