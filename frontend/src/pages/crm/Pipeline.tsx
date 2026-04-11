import { useState } from 'react';
import {
  Card, Button, Tag, Badge, Typography, Modal, Form, Input,
  InputNumber, Select, Drawer, Space, Empty, Spin, message, Avatar,
} from 'antd';
import { PlusOutlined, TrophyOutlined, CloseOutlined, CheckOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelineApi, contactsApi } from '../../api/crm';

const { Text, Title } = Typography;

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'blue', WON: 'green', LOST: 'red', CANCELLED: 'default',
};

export default function Pipeline() {
  const qc = useQueryClient();
  const [newLeadStageId, setNewLeadStageId] = useState<string | null>(null);
  const [selectedLead,   setSelectedLead]   = useState<any>(null);
  const [activityForm]                      = Form.useForm();
  const [leadForm]                          = Form.useForm();

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ['pipeline'],
    queryFn:  () => pipelineApi.getStages(),
    staleTime: 30_000,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-all'],
    queryFn:  () => contactsApi.list({ limit: 200 }).then((r: any) => r.data),
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['lead-activities', selectedLead?.id],
    queryFn:  () => selectedLead ? pipelineApi.getActivities(selectedLead.id) : Promise.resolve([]),
    enabled:  !!selectedLead,
  });

  const createLead = useMutation({
    mutationFn: (data: any) => pipelineApi.createLead(data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['pipeline'] }); setNewLeadStageId(null); leadForm.resetFields(); message.success('Lead créé'); },
    onError:    (e: any) => message.error(e?.response?.data?.error || 'Erreur'),
  });

  const updateLead = useMutation({
    mutationFn: ({ id, data }: any) => pipelineApi.updateLead(id, data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['pipeline'] }); message.success('Lead mis à jour'); },
  });

  const addActivity = useMutation({
    mutationFn: ({ leadId, data }: any) => pipelineApi.addActivity(leadId, data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['lead-activities', selectedLead?.id] }); activityForm.resetFields(); },
  });

  // Drag state
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);

  function onDragStart(leadId: string) {
    setDraggingLeadId(leadId);
  }

  function onDrop(stageId: string) {
    if (!draggingLeadId) return;
    updateLead.mutate({ id: draggingLeadId, data: { stageId } });
    setDraggingLeadId(null);
  }

  const totalValue = stages.flatMap((s: any) => s.leads).reduce((sum: number, l: any) => sum + Number(l.value || 0), 0);

  if (isLoading) return <Spin style={{ display: 'block', marginTop: 60 }} />;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Pipeline CRM</Title>
          <Text type="secondary">
            {stages.reduce((n: number, s: any) => n + s.leads.length, 0)} leads · {' '}
            {totalValue.toLocaleString('fr-MA')} MAD potentiels
          </Text>
        </div>
      </div>

      {/* Kanban */}
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16 }}>
        {stages.map((stage: any) => {
          const stageValue = stage.leads.reduce((s: number, l: any) => s + Number(l.value || 0), 0);
          return (
            <div
              key={stage.id}
              style={{ minWidth: 260, maxWidth: 260, flexShrink: 0 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(stage.id)}
            >
              {/* Column header */}
              <div style={{
                padding: '8px 12px', borderRadius: '8px 8px 0 0',
                background: stage.color + '18',
                borderTop: `3px solid ${stage.color}`,
                marginBottom: 8,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <Text strong style={{ fontSize: 13 }}>{stage.name}</Text>
                  <Badge count={stage.leads.length} style={{ marginLeft: 8, background: stage.color }} />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#888' }}>
                    {stageValue > 0 ? `${stageValue.toLocaleString('fr-MA')} MAD` : ''}
                  </div>
                </div>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120 }}>
                {stage.leads.length === 0 && (
                  <div style={{ padding: 24, textAlign: 'center', color: '#ccc', fontSize: 12 }}>
                    Aucun lead
                  </div>
                )}
                {stage.leads.map((lead: any) => (
                  <Card
                    key={lead.id}
                    size="small"
                    style={{ cursor: 'grab', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
                    styles={{ body: { padding: '10px 12px' } }}
                    draggable
                    onDragStart={() => onDragStart(lead.id)}
                    onClick={() => setSelectedLead(lead)}
                  >
                    <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>{lead.title}</Text>
                    {lead.contact && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Avatar size={18} style={{ background: '#1677ff', fontSize: 10 }}>
                          {lead.contact.firstName?.[0]}
                        </Avatar>
                        <Text style={{ fontSize: 12, color: '#555' }}>
                          {lead.contact.firstName} {lead.contact.lastName}
                          {lead.contact.company ? ` · ${lead.contact.company}` : ''}
                        </Text>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      {lead.value && (
                        <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>
                          {Number(lead.value).toLocaleString('fr-MA')} MAD
                        </Tag>
                      )}
                      <Tag style={{ fontSize: 11, margin: 0 }}>{lead.probability}%</Tag>
                    </div>
                  </Card>
                ))}

                {/* Ajouter un lead */}
                <Button
                  type="dashed" icon={<PlusOutlined />} size="small" block
                  style={{ borderColor: stage.color + '88', color: stage.color }}
                  onClick={() => { setNewLeadStageId(stage.id); leadForm.setFieldValue('stageId', stage.id); }}
                >
                  Ajouter
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal nouveau lead */}
      <Modal
        title="Nouveau lead"
        open={!!newLeadStageId}
        onCancel={() => { setNewLeadStageId(null); leadForm.resetFields(); }}
        onOk={() => leadForm.submit()}
        confirmLoading={createLead.isPending}
        destroyOnClose
      >
        <Form form={leadForm} layout="vertical"
          onFinish={(v) => createLead.mutate({ ...v, stageId: newLeadStageId })}>
          <Form.Item name="title" label="Titre du lead" rules={[{ required: true }]}>
            <Input placeholder="ex: Projet ERP Acme Corp" autoFocus />
          </Form.Item>
          <Form.Item name="contactId" label="Contact associé">
            <Select allowClear showSearch placeholder="Sélectionner un contact"
              filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
              options={contacts.map((c: any) => ({
                value: c.id,
                label: `${c.firstName} ${c.lastName}${c.company ? ` (${c.company})` : ''}`,
              }))} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="value" label="Valeur estimée (MAD)">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="probability" label="Probabilité (%)">
              <InputNumber min={0} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer détail lead */}
      <Drawer
        title={selectedLead?.title}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        width={420}
        extra={
          <Space>
            <Button size="small" icon={<TrophyOutlined />} type="primary"
              onClick={() => updateLead.mutate({ id: selectedLead.id, data: { status: 'WON' } })}>
              Gagné
            </Button>
            <Button size="small" danger
              onClick={() => updateLead.mutate({ id: selectedLead.id, data: { status: 'LOST' } })}>
              Perdu
            </Button>
          </Space>
        }
      >
        {selectedLead && (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Valeur</Text>
                  <div style={{ fontWeight: 600, fontSize: 18 }}>
                    {selectedLead.value ? `${Number(selectedLead.value).toLocaleString('fr-MA')} MAD` : '—'}
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Probabilité</Text>
                  <div style={{ fontWeight: 600, fontSize: 18 }}>{selectedLead.probability}%</div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Statut</Text>
                  <div><Tag color={STATUS_COLORS[selectedLead.status]}>{selectedLead.status}</Tag></div>
                </div>
              </div>
            </Card>

            <Title level={5}>Activités</Title>
            <Form form={activityForm} layout="inline" style={{ marginBottom: 12 }}
              onFinish={(v) => addActivity.mutate({ leadId: selectedLead.id, data: v })}>
              <Form.Item name="type" initialValue="NOTE" style={{ marginBottom: 0 }}>
                <Select size="small" style={{ width: 100 }}
                  options={[
                    { value: 'NOTE', label: 'Note' },
                    { value: 'CALL', label: 'Appel' },
                    { value: 'EMAIL', label: 'Email' },
                    { value: 'MEETING', label: 'RDV' },
                  ]} />
              </Form.Item>
              <Form.Item name="content" rules={[{ required: true }]} style={{ flex: 1, marginBottom: 0 }}>
                <Input placeholder="Ajouter une note..." size="small" />
              </Form.Item>
              <Button htmlType="submit" type="primary" size="small" icon={<CheckOutlined />} />
            </Form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activities.map((a: any) => (
                <div key={a.id} style={{
                  padding: '8px 12px', background: '#f9fafb', borderRadius: 8,
                  borderLeft: '3px solid #1677ff',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Tag style={{ fontSize: 10, margin: 0 }}>{a.type}</Tag>
                    <Text style={{ fontSize: 11, color: '#888' }}>
                      {new Date(a.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </div>
                  <Text style={{ fontSize: 13 }}>{a.content}</Text>
                  {a.user && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{a.user.firstName} {a.user.lastName}</div>}
                </div>
              ))}
              {activities.length === 0 && <Empty description="Aucune activité" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
