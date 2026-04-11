import { useState, useEffect } from 'react';
import {
  Form, Input, Button, Select, InputNumber, Table, Card,
  Typography, Space, Divider, message, DatePicker,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { quotesApi, productsApi } from '../../api/ventes';
import { contactsApi } from '../../api/crm';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface Props {
  onSuccess: (quote: any) => void;
  onCancel:  () => void;
}

export default function QuoteForm({ onSuccess, onCancel }: Props) {
  const qc   = useQueryClient();
  const [form] = Form.useForm();
  const [lines, setLines] = useState<any[]>([
    { id: Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: 20 }
  ]);

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-all'],
    queryFn:  () => contactsApi.list({ limit: 200 }).then((r: any) => r.data),
  });
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn:  () => productsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => quotesApi.create(data),
    onSuccess:  (quote) => { qc.invalidateQueries({ queryKey: ['quotes'] }); onSuccess(quote); },
    onError:    (e: any) => message.error(e?.response?.data?.error || 'Erreur'),
  });

  const calcLine = (l: any) => {
    const sub = (l.quantity || 0) * (l.unitPrice || 0);
    const tax = sub * ((l.taxRate || 0) / 100);
    return { subtotal: sub, taxAmount: tax, total: sub + tax };
  };

  const totals = lines.reduce((acc, l) => {
    const t = calcLine(l);
    return { subtotal: acc.subtotal + t.subtotal, taxAmount: acc.taxAmount + t.taxAmount, total: acc.total + t.total };
  }, { subtotal: 0, taxAmount: 0, total: 0 });

  function setLine(id: number, field: string, value: any) {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }

  function addLine() {
    setLines((prev) => [...prev, { id: Date.now(), description: '', quantity: 1, unitPrice: 0, taxRate: 20 }]);
  }

  function removeLine(id: number) {
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function selectProduct(lineId: number, productId: string) {
    const p = products.find((p: any) => p.id === productId);
    if (!p) return;
    setLines((prev) => prev.map((l) => l.id === lineId
      ? { ...l, productId, description: p.name, unitPrice: Number(p.unitPrice), taxRate: Number(p.taxRate) }
      : l
    ));
  }

  function handleFinish(values: any) {
    createMutation.mutate({
      contactId:  values.contactId,
      expiryDate: values.expiryDate ? values.expiryDate.toISOString() : undefined,
      notes:      values.notes,
      lines:      lines.map((l, i) => ({
        productId:   l.productId,
        description: l.description,
        quantity:    l.quantity,
        unitPrice:   l.unitPrice,
        taxRate:     l.taxRate,
        sortOrder:   i,
      })),
    });
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleFinish}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Form.Item name="contactId" label="Client">
          <Select allowClear showSearch placeholder="Sélectionner un contact"
            filterOption={(input, opt) => (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            options={contacts.map((c: any) => ({
              value: c.id,
              label: `${c.firstName} ${c.lastName}${c.company ? ` · ${c.company}` : ''}`,
            }))} />
        </Form.Item>
        <Form.Item name="expiryDate" label="Date d'expiration">
          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY"
            disabledDate={(d) => d && d.isBefore(dayjs())} />
        </Form.Item>
        <Form.Item name="notes" label="Notes internes">
          <Input.TextArea rows={1} />
        </Form.Item>
      </div>

      {/* Lignes */}
      <div style={{ marginBottom: 8, fontWeight: 600 }}>Lignes du devis</div>
      <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 3fr 1fr 1.5fr 1fr 40px',
          gap: 8, padding: '8px 12px', background: '#fafafa',
          borderBottom: '1px solid #f0f0f0', fontSize: 12, fontWeight: 600, color: '#666',
        }}>
          <span>Produit</span><span>Description</span><span>Qté</span>
          <span>P.U. HT</span><span>TVA %</span><span></span>
        </div>
        {lines.map((line) => {
          const t = calcLine(line);
          return (
            <div key={line.id} style={{
              display: 'grid', gridTemplateColumns: '2fr 3fr 1fr 1.5fr 1fr 40px',
              gap: 8, padding: '8px 12px', borderBottom: '1px solid #f5f5f5', alignItems: 'center',
            }}>
              <Select size="small" allowClear placeholder="Produit (opt.)" value={line.productId}
                onChange={(v) => selectProduct(line.id, v)}
                options={products.map((p: any) => ({ value: p.id, label: p.name }))} />
              <Input size="small" value={line.description}
                onChange={(e) => setLine(line.id, 'description', e.target.value)}
                placeholder="Description *" />
              <InputNumber size="small" min={0.001} value={line.quantity} style={{ width: '100%' }}
                onChange={(v) => setLine(line.id, 'quantity', v)} />
              <InputNumber size="small" min={0} value={line.unitPrice} style={{ width: '100%' }}
                onChange={(v) => setLine(line.id, 'unitPrice', v)} />
              <InputNumber size="small" min={0} max={100} value={line.taxRate} style={{ width: '100%' }}
                onChange={(v) => setLine(line.id, 'taxRate', v)} />
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeLine(line.id)} />
            </div>
          );
        })}
        <div style={{ padding: '8px 12px' }}>
          <Button type="dashed" icon={<PlusOutlined />} size="small" onClick={addLine}>
            Ajouter une ligne
          </Button>
        </div>
      </div>

      {/* Totaux */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Card size="small" style={{ minWidth: 240 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text type="secondary">Sous-total HT</Text>
            <Text>{totals.subtotal.toFixed(2)} MAD</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text type="secondary">TVA</Text>
            <Text>{totals.taxAmount.toFixed(2)} MAD</Text>
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text strong>Total TTC</Text>
            <Text strong style={{ fontSize: 16, color: '#1677ff' }}>{totals.total.toFixed(2)} MAD</Text>
          </div>
        </Card>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button onClick={onCancel}>Annuler</Button>
        <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
          Créer le devis
        </Button>
      </div>
    </Form>
  );
}
