import { Card, Row, Col, Statistic, Typography, Table, Tag, Space } from 'antd';
import {
  UserOutlined, TeamOutlined, AppstoreOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';

const { Title, Text } = Typography;

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);

  const recentActivity = [
    { key: 1, action: 'Connexion',           module: 'Kernel',       time: "À l'instant",  status: 'success' },
    { key: 2, action: 'Module CRM chargé',   module: 'CRM',          time: 'Il y a 1 min', status: 'info' },
    { key: 3, action: 'Module Ventes chargé',module: 'Ventes',       time: 'Il y a 1 min', status: 'info' },
  ];

  return (
    <div>
      {/* ── Bienvenue ── */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          Bonjour, {user?.firstName} 👋
        </Title>
        <Text type="secondary">
          {user?.tenant?.name} · Plan {user?.tenant?.plan}
        </Text>
      </div>

      {/* ── KPIs ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          { title: 'Utilisateurs',   value: 1, icon: <UserOutlined />,      color: '#1677ff' },
          { title: 'Rôles actifs',   value: 3, icon: <TeamOutlined />,      color: '#52c41a' },
          { title: 'Modules activés',value: 9, icon: <AppstoreOutlined />,  color: '#722ed1' },
          { title: 'Permissions',    value: 56, icon: <CheckCircleOutlined />, color: '#fa8c16' },
        ].map((kpi) => (
          <Col xs={24} sm={12} lg={6} key={kpi.title}>
            <Card>
              <Statistic
                title={kpi.title}
                value={kpi.value}
                prefix={<span style={{ color: kpi.color }}>{kpi.icon}</span>}
                valueStyle={{ color: kpi.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Modules disponibles ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Modules activés" extra={<Text type="secondary">9 / 9</Text>}>
            <Row gutter={[8, 8]}>
              {[
                { name: 'Noyau',       color: 'blue',   cat: 'Système'  },
                { name: 'CRM',         color: 'green',  cat: 'Métier'   },
                { name: 'Ventes',      color: 'green',  cat: 'Métier'   },
                { name: 'Achats',      color: 'green',  cat: 'Métier'   },
                { name: 'Stock',       color: 'green',  cat: 'Métier'   },
                { name: 'Comptabilité',color: 'gold',   cat: 'Finance'  },
                { name: 'RH',          color: 'purple', cat: 'RH'       },
                { name: 'Projets',     color: 'cyan',   cat: 'Métier'   },
                { name: 'Production',  color: 'orange', cat: 'Métier'   },
              ].map((m) => (
                <Col key={m.name}>
                  <Tag color={m.color} style={{ padding: '4px 10px', fontSize: 13 }}>
                    {m.name}
                  </Tag>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="Activité récente">
            <Table
              dataSource={recentActivity}
              pagination={false}
              size="small"
              columns={[
                { title: 'Action', dataIndex: 'action', key: 'action' },
                { title: 'Module', dataIndex: 'module', key: 'module',
                  render: (v) => <Tag>{v}</Tag> },
                { title: 'Heure', dataIndex: 'time', key: 'time',
                  render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
