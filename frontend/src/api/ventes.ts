import api from './client';

export const productsApi = {
  list:   (params?: any) => api.get('/ventes/products',   { params }) as Promise<any[]>,
  create: (data: any)    => api.post('/ventes/products',   data) as Promise<any>,
  update: (id: string, data: any) => api.patch(`/ventes/products/${id}`, data) as Promise<any>,
  remove: (id: string)   => api.delete(`/ventes/products/${id}`) as Promise<any>,
};

export const quotesApi = {
  list:    (params?: any) => api.get('/ventes/quotes',       { params }) as Promise<any>,
  get:     (id: string)   => api.get(`/ventes/quotes/${id}`) as Promise<any>,
  create:  (data: any)    => api.post('/ventes/quotes',       data) as Promise<any>,
  update:  (id: string, data: any) => api.patch(`/ventes/quotes/${id}`, data) as Promise<any>,
  send:    (id: string)   => api.post(`/ventes/quotes/${id}/send`) as Promise<any>,
  confirm: (id: string)   => api.post(`/ventes/quotes/${id}/confirm`) as Promise<any>,
};

export const ordersApi = {
  list:    (params?: any) => api.get('/ventes/orders',       { params }) as Promise<any>,
  get:     (id: string)   => api.get(`/ventes/orders/${id}`) as Promise<any>,
  update:  (id: string, data: any) => api.patch(`/ventes/orders/${id}`, data) as Promise<any>,
  cancel:  (id: string)   => api.post(`/ventes/orders/${id}/cancel`) as Promise<any>,
  invoice: (id: string, data?: any) => api.post(`/ventes/orders/${id}/invoice`, data ?? {}) as Promise<any>,
};

export const invoicesApi = {
  list:    (params?: any) => api.get('/ventes/invoices',       { params }) as Promise<any>,
  get:     (id: string)   => api.get(`/ventes/invoices/${id}`) as Promise<any>,
  stats:   ()             => api.get('/ventes/invoices/stats/summary') as Promise<any>,
  send:    (id: string)   => api.post(`/ventes/invoices/${id}/send`) as Promise<any>,
  pay:     (id: string, amount?: number) => api.post(`/ventes/invoices/${id}/pay`, { amount }) as Promise<any>,
};
