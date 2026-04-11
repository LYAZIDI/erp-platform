import { useState } from 'react';
import {
  Table, Button, Tag, Space, Card, Typography,
  Popconfirm, message, Tooltip, Modal, Input,
} from 'antd';
import {
  FileTextOutlined, CloseCircleOutlined, SearchOutlined, EyeOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../api/ventes';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'blue', CONFIRMED: 'green', SHIPPED: 'cyan',
  DELIVERED: 'success', CANCELLED: 'red', INVOICED: 'purple',
};
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente', CONFIRMED: 'Confirmée', SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée', CANCELLED: 'Annulée', INVOICED: 'Facturée',
};

export default function Orders() {
  const qc  = useQueryClient();
  const can = useAuthStore((s) => s.can);
  const [search,      setSearch]      = useState('');
  const [detailOrder, setDetailOrder] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', search],
    queryFn:  () => ordersApi.list({ search: search || undefined }),
  });

  const invoiceMutation = useMutation({
    mutationFn: (id: string) => ordersApi.invoice(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); message.success('Facture créée'); },
    onError:   (e: any) => message.error(e?.response?.data?.error || 'Erreur'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => ordersApi.cancel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); message.success('Commande annulée'); },
    onError:   (e: any) => message.error(e?.response?.data?.error || 'Erreur'),
  });

  const columns = [
    {
      title: 'Référence', dataIndex: 'reference', key: 'ref',
      render: (v: string, r: any) => (
        <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => setDetailOrder(r)}>
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
      title: 'Devis', key: 'quote',
      render: (r: any) => r.quote ? <Text code style={{ fontSize: 12 }}>{r.quote.reference}</Text> : '—',
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
      title: 'Date', dataIndex: 'createdAt', key: 'created',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Actions', key: 'actions', width: 140,
      render: (r: any) => (
        <Space>
          <Tooltip title="Voir détail">
            <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailOrder(r)} />
          </Tooltip>
          {['PENDING', 'CONFIRMED', 'DELIVERED'].includes(r.status) && can('ventes', 'UPDATE') && (
            <Tooltip title="Générer facture">
              <Popconfirm title="Créer une facture pour cette commande ?" onConfirm={() => invoiceMutation.mutate(r.id)}>
                <Button size="small" type="primary" icon={<FileTextOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
          {['PENDING', 'CONFIRMED'].includes(r.status) && can('ventes', 'UPDATE') && (
            <Tooltip title="Annuler">
              <Popconfirm title="Annuler cette commande ?" onConfirm={() => cancelMutation.mutate(r.id)}>
                <Button size="small" danger icon={<CloseCircleOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Commandes</Title>
      </div>

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

      <Modal
        title={`Commande ${detailOrder?.reference}`}
        open={!!detailOrder}
        onCancel={() => setDetailOrder(null)}
        footer={null}
        width={700}
        destroyOnClose
      >
        {detailOrder && <OrderDetail order={detailOrder} />}
      </Modal>
    </div>
  );
}

function OrderDetail({ order }: { order: any }) {
  const { data } = useQuery({
    queryKey: ['order-detail', order.id],
    queryFn:  () => ordersApi.get(order.id),
  });
  const o = data || order;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div><Text type="secondary">Statut</Text>
          <div><Tag color={STATUS_COLORS[o.status]}>{STATUS_LABELS[o.status]}</Tag></div></div>
        <div><Text type="secondary">Client</Text>
          <div>{o.contact ? `${o.contact.firstName} ${o.contact.lastName}` : '—'}</div></div>
        <div><Text type="secondary">Date</Text>
          <div>{dayjs(o.createdAt).format('DD/MM/YYYY')}</div></div>
      </div>

      <Table
        size="small"
        dataSource={o.lines || []}
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
          <div><Text type="secondary">Sous-total HT: </Text><Text>{Number(o.subtotal).toFixed(2)} MAD</Text></div>
          <div><Text type="secondary">TVA: </Text><Text>{Number(o.taxAmount).toFixed(2)} MAD</Text></div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
            Total TTC: <span style={{ color: '#1677ff' }}>{Number(o.total).toFixed(2)} MAD</span>
          </div>
        </div>
      </div>
    </div>
  );
}
