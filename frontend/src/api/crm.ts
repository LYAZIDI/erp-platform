import api from './client';

export const contactsApi = {
  list:   (params?: any) => api.get('/crm/contacts',   { params }) as Promise<any>,
  get:    (id: string)   => api.get(`/crm/contacts/${id}`) as Promise<any>,
  create: (data: any)    => api.post('/crm/contacts',   data) as Promise<any>,
  update: (id: string, data: any) => api.patch(`/crm/contacts/${id}`, data) as Promise<any>,
  remove: (id: string)   => api.delete(`/crm/contacts/${id}`) as Promise<any>,
};

export const pipelineApi = {
  getStages:      ()           => api.get('/crm/pipeline') as Promise<any[]>,
  getLeads:       (params?: any) => api.get('/crm/leads', { params }) as Promise<any>,
  createLead:     (data: any)  => api.post('/crm/leads',  data) as Promise<any>,
  updateLead:     (id: string, data: any) => api.patch(`/crm/leads/${id}`, data) as Promise<any>,
  getActivities:  (id: string) => api.get(`/crm/leads/${id}/activities`) as Promise<any[]>,
  addActivity:    (id: string, data: any) => api.post(`/crm/leads/${id}/activities`, data) as Promise<any>,
  reorderStages:  (stages: any[]) => api.patch('/crm/stages', { stages }) as Promise<any>,
};
