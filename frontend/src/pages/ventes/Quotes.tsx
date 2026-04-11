import { useState } from 'react';
import {
  Table, Button, Tag, Space, Card, Typography, Modal,
  Popconfirm, message, Tooltip, Input,
} from 'antd';
import {
  PlusOutlined, SendOutlined, CheckCircleOutlined,
  EyeOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotesApi } from '../../api/ventes';
import { useAuthStore } from '../../store/authStore';
import QuoteForm from './QuoteForm';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'default', SENT: 'blue', ACCEPTED: 'green',
  REFUSED: 'red', EXPIRED: 'orange',
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon', SENT: 'Envoyé', ACCEPTED: 'Accepté',
  REFUSED: 'Refusé', EXPIRED: 'Expiré',
};

export default function Quotes() {
  const qc  = useQueryClient();
  const can = useAuthStore((s) => s.can);
  const [search,     setSearch]     = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailQuote, setDetailQuote] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', search],
    queryFn:  () => quotesApi.list({ search: search || undefined }),
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => quotesApi.send(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); message.success('Devis envoyé'); },
    onError:   (e: any) => message.error(e?.response?.data?.error || 'Erreur'),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => quotesApi.confirm(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); message.success('Commande créée'); },
    onError:   (e: any) => message.error(e?.response?.data?.error || 'Erreur'),
  });

  const columns = [
    {
      title: 'Référence', dataIndex: 'reference', key: 'ref',
      render: (v: string, r: any) => (
        <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => setDetailQuote(r)}>
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
      title: 'Total TTC', dataIndex: 'total', key: 'total',
      align: 'right' as const,
      render: (v: string) => <Text strong>{Number(v).toLocaleString('fr-MA')} MAD</Text>,
    },
    {
      title: 'Expiration', dataIndex: 'expiryDate', key: 'expiry',
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Créé le', dataIndex: 'createdAt', key: 'created',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Actions', key: 'actions', width: 140,
      render: (r: any) => (
        <Space>
          <Tooltip title="Voir détail">
            <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailQuote(r)} />
          </Tooltip>
          {r.status === 'DRAFT' && can('ventes', 'UPDATE') && (
            <Tooltip title="Marquer envoyé">
              <Popconfirm title="Marquer ce devis comme envoyé ?" onConfirm={() => sendMutation.mutate(r.id)}>
                <Button size="small" icon={<SendOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
          {['DRAFT', 'SENT'].includes(r.status) && can('ventes', 'UPDATE') && (
            <Tooltip title="Confirmer → Commande">
              <Popconfirm title="Confirmer et créer une commande ?" onConfirm={() => confirmMutation.mutate(r.id)}>
                <Button size="small" type="primary" icon={<CheckCircleOutlined />} />
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
        <Title level={4} style={{ margin: 0 }}>Devis</Title>
        {can('ventes', 'CREATE') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Nouveau devis
          </Button>
        )}
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

      {/* Modal création */}
      <Modal
        title="Nouveau devis"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        width={900}
        destroyOnClose
      >
        <QuoteForm
          onSuccess={() => { setCreateOpen(false); qc.invalidateQueries({ queryKey: ['quotes'] }); }}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      {/* Modal détail */}
      <Modal
        title={`Devis ${detailQuote?.reference}`}
        open={!!detailQuote}
        onCancel={() => setDetailQuote(null)}
        footer={null}
        width={700}
        destroyOnClose
      >
        {detailQuote && <QuoteDetail quote={detailQuote} />}
      </Modal>
    </div>
  );
}

function QuoteDetail({ quote }: { quote: any }) {
  const { data } = useQuery({
    queryKey: ['quote-detail', quote.id],
    queryFn:  () => quotesApi.get(quote.id),
  });
  const q = data || quote;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div><Text type="secondary">Statut</Text><div><Tag color={STATUS_COLORS[q.status]}>{STATUS_LABELS[q.status]}</Tag></div></div>
        <div><Text type="secondary">Client</Text>
          <div>{q.contact ? `${q.contact.firstName} ${q.contact.lastName}` : '—'}</div></div>
        <div><Text type="secondary">Expiration</Text>
          <div>{q.expiryDate ? dayjs(q.expiryDate).format('DD/MM/YYYY') : '—'}</div></div>
      </div>

      <Table
        size="small"
        dataSource={q.lines || []}
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 16 }}>
        <div style={{ textAlign: 'right' }}>
          <div><Text type="secondary">Sous-total HT: </Text><Text>{Number(q.subtotal).toFixed(2)} MAD</Text></div>
          <div><Text type="secondary">TVA: </Text><Text>{Number(q.taxAmount).toFixed(2)} MAD</Text></div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
            Total TTC: <span style={{ color: '#1677ff' }}>{Number(q.total).toFixed(2)} MAD</span>
          </div>
        </div>
      </div>

      {q.notes && (
        <div style={{ marginTop: 12, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
          <Text type="secondary">Notes: </Text><Text>{q.notes}</Text>
        </div>
      )}
    </div>
  );
}
