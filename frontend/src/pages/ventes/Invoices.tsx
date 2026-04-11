import { useState } from 'react';
import {
  Table, Button, Tag, Space, Card, Typography,
  Popconfirm, message, Tooltip, Modal, Input,
  Statistic, Row, Col, InputNumber, Form,
} from 'antd';
import {
  SendOutlined, DollarOutlined, SearchOutlined, EyeOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../../api/ventes';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'default', SENT: 'blue', PAID: 'success',
  PARTIALLY_PAID: 'orange', OVERDUE: 'red', CANCELLED: 'default',
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon', SENT: 'Envoyée', PAID: 'Payée',
  PARTIALLY_PAID: 'Partiel', OVERDUE: 'En retard', CANCELLED: 'Annulée',
};

export default function Invoices() {
  const qc  = useQueryClient();
  const can = useAuthStore((s) => s.can);
  const [search,         setSearch]         = useState('');
  const [detailInvoice,  setDetailInvoice]  = useState<any>(null);
  const [payInvoice,     setPayInvoice]     = useState<any>(null);
  const [payForm]                           = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', search],
    queryFn:  () => invoicesApi.list({ search: search || undefined }),
  });

  const { data: stats } = useQuery({
    queryKey: ['invoices-stats'],
    queryFn:  () => invoicesApi.stats(),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.send(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); message.success('Facture envoyée'); },
    onError:   (e: any) => message.error(e?.response?.data?.error || 'Erreur'),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount?: number }) => invoicesApi.pay(id, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoices-stats'] });
      message.success('Paiement enregistré');
      setPayInvoice(null);
      payForm.resetFields();
    },
    onError: (e: any) => message.error(e?.response?.data?.error || 'Erreur'),
  });

  const columns = [
    {
      title: 'Référence', dataIndex: 'reference', key: 'ref',
      render: (v: string, r: any) => (
        <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => setDetailInvoice(r)}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Client', key: 'contact',
      render: (r: any) => r.contact
        ? <span>{r.contact.firstName} {r.contact.lastName}{r.contact.company ? ` · ${r.contact.company}` : ''}</span>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Statut', dataIndex: 'status', key: 'status',
      render: (v: string) => <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v] || v}</Tag>,
    },
    {
      title: 'Total TTC', dataIndex: 'total', key: 'total', align: 'right' as const,
      render: (v: string) => <Text strong>{Number(v).toLocaleString('fr-MA')} MAD</Text>,
    },
    {
      title: 'Payé', dataIndex: 'paidAmount', key: 'paid', align: 'right' as const,
      render: (v: string) => <Text type="success">{Number(v).toLocaleString('fr-MA')} MAD</Text>,
    },
    {
      title: 'Échéance', dataIndex: 'dueDate', key: 'due',
      render: (v: string) => {
        if (!v) return '—';
        const isLate = dayjs(v).isBefore(dayjs()) ;
        return <Text type={isLate ? 'danger' : undefined}>{dayjs(v).format('DD/MM/YYYY')}</Text>;
      },
    },
    {
      title: 'Actions', key: 'actions', width: 120,
      render: (r: any) => (
        <Space>
          <Tooltip title="Voir détail">
            <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailInvoice(r)} />
          </Tooltip>
          {r.status === 'DRAFT' && can('ventes', 'UPDATE') && (
            <Tooltip title="Marquer envoyée">
              <Popconfirm title="Marquer cette facture comme envoyée ?" onConfirm={() => sendMutation.mutate(r.id)}>
                <Button size="small" icon={<SendOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
          {['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(r.status) && can('ventes', 'UPDATE') && (
            <Tooltip title="Enregistrer paiement">
              <Button size="small" type="primary" icon={<DollarOutlined />}
                onClick={() => { setPayInvoice(r); payForm.setFieldValue('amount', Number(r.total) - Number(r.paidAmount)); }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Factures</Title>
      </div>

      {/* KPI Stats */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          {[
            { title: 'Total facturé', value: stats.totalInvoiced, color: '#1677ff' },
            { title: 'Encaissé', value: stats.totalPaid, color: '#52c41a' },
            { title: 'En attente', value: stats.totalPending, color: '#faad14' },
            { title: 'En retard', value: stats.totalOverdue, color: '#ff4d4f' },
          ].map((kpi) => (
            <Col span={6} key={kpi.title}>
              <Card size="small">
                <Statistic
                  title={kpi.title}
                  value={kpi.value}
                  precision={2}
                  suffix="MAD"
                  valueStyle={{ color: kpi.color, fontSize: 18 }}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Card>
        <Input prefix={<SearchOutlined />} placeholder="Rechercher par référence, client..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ width: 320, marginBottom: 16 }} allowClear />

        <Table
          dataSource={data?.data || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ total: data?.total, pageSize: 20 }}
        />
      </Card>

      {/* Modal détail */}
      <Modal
        title={`Facture ${detailInvoice?.reference}`}
        open={!!detailInvoice}
        onCancel={() => setDetailInvoice(null)}
        footer={null}
        width={700}
        destroyOnClose
      >
        {detailInvoice && <InvoiceDetail invoice={detailInvoice} />}
      </Modal>

      {/* Modal paiement */}
      <Modal
        title={`Paiement — ${payInvoice?.reference}`}
        open={!!payInvoice}
        onCancel={() => { setPayInvoice(null); payForm.resetFields(); }}
        onOk={() => payForm.submit()}
        confirmLoading={payMutation.isPending}
        destroyOnClose
      >
        {payInvoice && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">Restant dû: </Text>
            <Text strong style={{ color: '#ff4d4f' }}>
              {(Number(payInvoice.total) - Number(payInvoice.paidAmount)).toFixed(2)} MAD
            </Text>
          </div>
        )}
        <Form form={payForm} layout="vertical"
          onFinish={(v) => payMutation.mutate({ id: payInvoice.id, amount: v.amount })}>
          <Form.Item name="amount" label="Montant encaissé (MAD)" rules={[{ required: true }]}>
            <InputNumber min={0.01} style={{ width: '100%' }} precision={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function InvoiceDetail({ invoice }: { invoice: any }) {
  const { data } = useQuery({
    queryKey: ['invoice-detail', invoice.id],
    queryFn:  () => invoicesApi.get(invoice.id),
  });
  const inv = data || invoice;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div><Text type="secondary">Statut</Text>
          <div><Tag color={STATUS_COLORS[inv.status]}>{STATUS_LABELS[inv.status]}</Tag></div></div>
        <div><Text type="secondary">Client</Text>
          <div>{inv.contact ? `${inv.contact.firstName} ${inv.contact.lastName}` : '—'}</div></div>
        <div><Text type="secondary">Échéance</Text>
          <div>{inv.dueDate ? dayjs(inv.dueDate).format('DD/MM/YYYY') : '—'}</div></div>
      </div>

      <Table
        size="small"
        dataSource={inv.lines || []}
        rowKey="id"
        pagination={false}
        columns={[
          { title: 'Description', dataIndex: 'description', key: 'desc' },
          { title: 'Qté', dataIndex: 'quantity', key: 'qty', align: 'right' as const },
          { title: 'P.U. HT', dataIndex: 'unitPrice', key: 'pu', align: 'right' as const,
            render: (v: string) => `${Number(v).toFixed(2)} MAD` },
          { title: 'TVA %', dataIndex: 'taxRate', key: 'tax', align: 'right' as const,
            render: (v: string) => `${Number(v)}%` },
          { title: 'Total TTC', dataIndex: 'total', key: 'total', align: 'right' as const,
            render: (v: string) => <Text strong>{Number(v).toFixed(2)} MAD</Text> },
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <div style={{ textAlign: 'right' }}>
          <div><Text type="secondary">Sous-total HT: </Text><Text>{Number(inv.subtotal).toFixed(2)} MAD</Text></div>
          <div><Text type="secondary">TVA: </Text><Text>{Number(inv.taxAmount).toFixed(2)} MAD</Text></div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
            Total TTC: <span style={{ color: '#1677ff' }}>{Number(inv.total).toFixed(2)} MAD</span>
          </div>
          {Number(inv.paidAmount) > 0 && (
            <div style={{ marginTop: 4 }}>
              <Text type="secondary">Payé: </Text>
              <Text type="success" strong>{Number(inv.paidAmount).toFixed(2)} MAD</Text>
            </div>
          )}
          {Number(inv.total) - Number(inv.paidAmount) > 0 && (
            <div>
              <Text type="secondary">Restant dû: </Text>
              <Text type="danger" strong>
                {(Number(inv.total) - Number(inv.paidAmount)).toFixed(2)} MAD
              </Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
