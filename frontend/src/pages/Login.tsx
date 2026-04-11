import { useState, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert, Divider } from 'antd';
import { UserOutlined, LockOutlined, BankOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';

const { Title, Text } = Typography;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const login    = useAuthStore((s) => s.login);
  const from     = (location.state as { from?: string })?.from || '/';
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleFinish(values: { email: string; password: string; tenant: string }) {
    setError('');
    setLoading(true);
    try {
      await login(values.email, values.password, values.tenant);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1677ff08 0%, #f0f2f5 100%)',
    }}>
      <Card style={{ width: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, background: '#1677ff', borderRadius: 12,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: 20 }}>E</span>
          </div>
          <Title level={3} style={{ margin: 0 }}>ERP Platform</Title>
          <Text type="secondary">Connectez-vous à votre espace</Text>
        </div>

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

        <Form layout="vertical" onFinish={handleFinish} autoComplete="off">
          <Form.Item
            name="tenant"
            label="Espace de travail"
            rules={[{ required: true, message: 'Entrez votre identifiant entreprise' }]}
          >
            <Input prefix={<BankOutlined />} placeholder="ex: acme-corp" autoFocus />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true }, { type: 'email', message: 'Email invalide' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="vous@exemple.com" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Mot de passe"
            rules={[{ required: true }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="••••••••" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={loading} block size="large">
            Se connecter
          </Button>
        </Form>

        <Divider />
        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">Pas encore de compte ? </Text>
          <Button type="link" onClick={() => navigate('/register')} style={{ padding: 0 }}>
            Créer un espace de travail
          </Button>
        </div>

        <div style={{ marginTop: 16, padding: 12, background: '#f6f8ff', borderRadius: 8, fontSize: 12, color: '#666' }}>
          <strong>Demo :</strong> tenant = <code>demo</code> · email = <code>admin@demo.com</code> · mdp = <code>Admin123!</code>
        </div>
      </Card>
    </div>
  );
}
