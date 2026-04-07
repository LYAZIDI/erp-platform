import { Card, Row, Col, Switch, Tag, Typography, Spin, message, Badge } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { modulesApi } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

const categoryLabels: Record<string, string> = {
  system:   'Système',
  business: 'Métier',
  finance:  'Finance',
  hr:       'Ressources Humaines',
};

const categoryColors: Record<string, string> = {
  system:   'blue',
  business: 'green',
  finance:  'gold',
  hr:       'purple',
};

export default function ModulesPage() {
  const qc  = useQueryClient();
  const can = useAuthStore((s) => s.can);

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ['modules'],
    queryFn:  () => modulesApi.list(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      modulesApi.toggle(id, enabled),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['modules'] }); qc.invalidateQueries({ queryKey: ['menu'] }); },
    onError:   (err: any) => message.error(err?.response?.data?.error || 'Erreur'),
  });

  if (isLoading) return <Spin />;

  // Grouper par catégorie
  const grouped = modules.reduce((acc: any, mod: any) => {
    const cat = mod.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(mod);
    return acc;
  }, {});

  return (
    <div>
      <Title level={4} style={{ marginBottom: 4 }}>Gestion des modules</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Activez ou désactivez les modules disponibles pour votre espace de travail.
      </Text>

      {Object.entries(grouped).map(([category, mods]: any) => (
        <div key={category} style={{ marginBottom: 32 }}>
          <div style={{ marginBottom: 12 }}>
            <Tag color={categoryColors[category] || 'default'} style={{ fontSize: 13 }}>
              {categoryLabels[category] || category}
            </Tag>
          </div>
          <Row gutter={[16, 16]}>
            {mods.map((mod: any) => (
              <Col xs={24} sm={12} lg={8} key={mod.id}>
                <Card
                  style={{
                    borderLeft: `4px solid ${mod.isEnabled ? '#1677ff' : '#d9d9d9'}`,
                    opacity: mod.isCore ? 0.85 : 1,
                  }}
                  styles={{ body: { padding: '16px 20px' } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text strong>{mod.name}</Text>
                        <Tag style={{ fontSize: 11 }}>v{mod.version}</Tag>
                        {mod.isCore && <Tag color="orange" style={{ fontSize: 10 }}>Core</Tag>}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{mod.description}</Text>
                      {mod.dependencies?.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            Requis : {mod.dependencies.join(', ')}
                          </Text>
                        </div>
                      )}
                    </div>

                    <Switch
                      checked={mod.isEnabled}
                      disabled={mod.isCore || !can('kernel', 'MANAGE_MODULES') || toggleMutation.isPending}
                      onChange={(checked) => toggleMutation.mutate({ id: mod.id, enabled: checked })}
                      style={{ marginLeft: 12 }}
                    />
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ))}
    </div>
  );
}
