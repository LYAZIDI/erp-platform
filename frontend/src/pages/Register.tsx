import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert, Steps } from 'antd';
import { authApi } from '../api/client';
import { setAccessToken } from '../api/client';
import { useAuthStore } from '../store/authStore';

const { Title, Text } = Typography;

export default function Register() {
  const navigate   = useNavigate();
  const init       = useAuthStore((s) => s.init);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleFinish(values: any) {
    setError('');
    setLoading(true);
    try {
      const data = await authApi.register(
        values.tenantName, values.firstName, values.lastName, values.email, values.password
      );
      setAccessToken(data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      await init();
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1677ff08 0%, #f0f2f5 100%)',
    }}>
      <Card style={{ width: 460, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 48, height: 48, background: '#1677ff', borderRadius: 12,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: 20 }}>E</span>
          </div>
          <Title level={3} style={{ margin: 0 }}>Créer votre espace ERP</Title>
          <Text type="secondary">Gratuit · Aucune carte bancaire requise</Text>
        </div>

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

        <Form layout="vertical" onFinish={handleFinish}>
          <Form.Item name="tenantName" label="Nom de votre entreprise"
            rules={[{ required: true, min: 2 }]}>
            <Input placeholder="Acme Corp" autoFocus />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="firstName" label="Prénom" rules={[{ required: true }]}>
              <Input placeholder="Jean" />
            </Form.Item>
            <Form.Item name="lastName" label="Nom" rules={[{ required: true }]}>
              <Input placeholder="Dupont" />
            </Form.Item>
          </div>

          <Form.Item name="email" label="Email professionnel"
            rules={[{ required: true }, { type: 'email' }]}>
            <Input placeholder="jean@acme.com" />
          </Form.Item>

          <Form.Item name="password" label="Mot de passe"
            rules={[{ required: true }, { min: 8, message: '8 caractères minimum' }]}>
            <Input.Password placeholder="8 caractères minimum" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={loading} block size="large">
            Créer mon espace de travail
          </Button>
        </Form>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Text type="secondary">Déjà inscrit ? </Text>
          <Button type="link" onClick={() => navigate('/login')} style={{ padding: 0 }}>
            Se connecter
          </Button>
        </div>
      </Card>
    </div>
  );
}
