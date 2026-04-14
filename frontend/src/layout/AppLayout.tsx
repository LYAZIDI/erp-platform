import { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography, Badge, Spin } from 'antd';
import {
  DashboardOutlined, SettingOutlined, TeamOutlined, LogoutOutlined,
  UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined, AppstoreOutlined,
  BellOutlined, ApartmentOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { modulesApi } from '../api/client';
import { useAuthStore } from '../store/authStore';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

// Map d'icônes Ant Design par nom
const iconMap: Record<string, React.ReactNode> = {
  DashboardOutlined:      <DashboardOutlined />,
  TeamOutlined:           <TeamOutlined />,
  SettingOutlined:        <SettingOutlined />,
  AppstoreOutlined:       <AppstoreOutlined />,
  ContactsOutlined:       <TeamOutlined />,
  ShoppingCartOutlined:   <AppstoreOutlined />,
  OrderedListOutlined:    <AppstoreOutlined />,
  AccountBookOutlined:    <AppstoreOutlined />,
  FileTextOutlined:       <AppstoreOutlined />,
  InboxOutlined:          <AppstoreOutlined />,
  BuildOutlined:          <AppstoreOutlined />,
  ProjectOutlined:        <AppstoreOutlined />,
  UserOutlined:           <UserOutlined />,
  FunnelPlotOutlined:     <AppstoreOutlined />,
  TrophyOutlined:         <AppstoreOutlined />,
  ShopOutlined:           <AppstoreOutlined />,
};

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate  = useNavigate();
  const location  = useLocation();
  const user      = useAuthStore((s) => s.user);
  const logout    = useAuthStore((s) => s.logout);

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ['menu'],
    queryFn:  () => modulesApi.menu(),
    staleTime: 5 * 60 * 1000,
  });

  const sidebarItems = [
    {
      key:   '/dashboard',
      icon:  <DashboardOutlined />,
      label: 'Tableau de bord',
    },
    {
      key:   '/workflow/designer',
      icon:  <ApartmentOutlined />,
      label: 'Workflow Designer',
    },
    ...menuItems.map((item: any) => ({
      key:      item.path,
      icon:     iconMap[item.icon] || <AppstoreOutlined />,
      label:    item.label,
      children: item.children?.map((c: any) => ({
        key:   c.path,
        label: c.label,
      })),
    })),
  ];

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />,  label: 'Mon profil' },
    { key: 'settings',icon: <SettingOutlined />,label: 'Paramètres' },
    { type: 'divider' as const },
    { key: 'logout',  icon: <LogoutOutlined />, label: 'Déconnexion', danger: true },
  ];

  function handleUserMenu({ key }: { key: string }) {
    if (key === 'logout') { logout(); navigate('/login'); }
    if (key === 'settings') navigate('/settings');
  }

  const selectedKey = '/' + location.pathname.split('/').slice(1, 3).join('/');

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <Sider
        collapsible collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{ background: '#001529' }}
        width={220}
      >
        {/* Logo */}
        <div style={{
          height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.08)', gap: 8,
        }}>
          <div style={{
            width: 32, height: 32, background: '#1677ff', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>E</span>
          </div>
          {!collapsed && (
            <Text style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>
              {user?.tenant?.name || 'ERP'}
            </Text>
          )}
        </div>

        {isLoading ? (
          <div style={{ padding: 24, textAlign: 'center' }}><Spin /></div>
        ) : (
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={sidebarItems}
            onClick={({ key }) => navigate(key)}
            style={{ borderRight: 0, marginTop: 8, overflowY: 'auto', height: 'calc(100vh - 56px)' }}
          />
        )}
      </Sider>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <Layout>
        {/* ── Header ── */}
        <Header style={{
          padding: '0 24px', background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)', position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {collapsed
              ? <MenuUnfoldOutlined onClick={() => setCollapsed(false)} style={{ fontSize: 18, cursor: 'pointer' }} />
              : <MenuFoldOutlined   onClick={() => setCollapsed(true)}  style={{ fontSize: 18, cursor: 'pointer' }} />
            }
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge count={0} showZero={false}>
              <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
            </Badge>

            <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenu }} placement="bottomRight">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <Avatar style={{ background: '#1677ff' }}>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Avatar>
                {!collapsed && (
                  <div style={{ lineHeight: 1.2 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div style={{ color: '#888', fontSize: 11 }}>
                      {user?.roles?.[0] || 'Utilisateur'}
                    </div>
                  </div>
                )}
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* ── Content ── */}
        <Content style={{ margin: 24, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
