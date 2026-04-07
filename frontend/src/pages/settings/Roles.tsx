import { useState } from 'react';
import {
  Table, Button, Space, Tag, Modal, Form, Input, Checkbox, Row, Col,
  Popconfirm, Typography, Card, message, Collapse,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rolesApi } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

export default function RolesPage() {
  const qc   = useQueryClient();
  const can  = useAuthStore((s) => s.can);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<any>(null);
  const [form]                    = Form.useForm();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn:  () => rolesApi.list(),
  });

  const { data: permsByModule = {} } = useQuery({
    queryKey: ['permissions'],
    queryFn:  () => rolesApi.permissions(),
  });

  const saveMutation = useMutation({
    mutationFn: (values: any) => editing
      ? rolesApi.update(editing.id, values)
      : rolesApi.create(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      setModalOpen(false);
      form.resetFields();
      message.success(editing ? 'Rôle mis à jour' : 'Rôle créé');
      setEditing(null);
    },
    onError: (err: any) => message.error(err?.response?.data?.error || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rolesApi.remove(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['roles'] }); message.success('Supprimé'); },
    onError:    (err: any) => message.error(err?.response?.data?.error || 'Erreur'),
  });

  function openEdit(record: any) {
    setEditing(record);
    form.setFieldsValue({
      name:          record.name,
      description:   record.description,
      permissionIds: record.permissions?.map((rp: any) => rp.permission.id),
    });
    setModalOpen(true);
  }

  const columns = [
    { title: 'Nom', dataIndex: 'name', key: 'name', render: (v: string, r: any) => (
        <Space>
          <Text strong>{v}</Text>
          {r.isSystem && <Tag color="orange"><LockOutlined /> Système</Tag>}
        </Space>
      )},
    { title: 'Description', dataIndex: 'description', key: 'desc', render: (v: string) => <Text type="secondary">{v || '—'}</Text> },
    { title: 'Permissions', key: 'perms',
      render: (r: any) => <Tag>{r.permissions?.length || 0} permissions</Tag> },
    { title: 'Utilisateurs', key: 'users',
      render: (r: any) => <Tag color="blue">{r._count?.userRoles || 0}</Tag> },
    { title: 'Actions', key: 'actions', width: 120,
      render: (r: any) => can('kernel', 'MANAGE_ROLES') ? (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} />
          {!r.isSystem && (
            <Popconfirm title="Supprimer ce rôle ?" onConfirm={() => deleteMutation.mutate(r.id)}>
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>
          )}
        </Space>
      ) : null,
    },
  ];

  // Grouper les permissions par module pour l'affichage
  const permItems = Object.entries(permsByModule).map(([module, perms]: any) => ({
    key:      module,
    label:    <Text strong style={{ textTransform: 'capitalize' }}>{module}</Text>,
    children: (
      <Form.Item name="permissionIds" noStyle>
        <Checkbox.Group style={{ width: '100%' }}>
          <Row gutter={[8, 8]}>
            {perms.map((p: any) => (
              <Col span={12} key={p.id}>
                <Checkbox value={p.id}>
                  <Text style={{ fontSize: 12 }}>{p.action}</Text>
                </Checkbox>
              </Col>
            ))}
          </Row>
        </Checkbox.Group>
      </Form.Item>
    ),
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Rôles & Permissions</Title>
        {can('kernel', 'MANAGE_ROLES') && (
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
            Nouveau rôle
          </Button>
        )}
      </div>

      <Card>
        <Table
          dataSource={roles}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
        />
      </Card>

      <Modal
        title={editing ? 'Modifier le rôle' : 'Nouveau rôle'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
          <Form.Item name="name" label="Nom du rôle" rules={[{ required: true }]}>
            <Input disabled={editing?.isSystem} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Permissions" style={{ marginBottom: 0 }}>
            <Collapse items={permItems} size="small" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
