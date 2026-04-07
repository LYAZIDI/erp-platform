import axios from 'axios';

let _accessToken: string | null = null;
let _isRefreshing = false;
let _queue: ((token: string | null) => void)[] = [];

export const setAccessToken = (t: string | null) => { _accessToken = t; };

const api = axios.create({ baseURL: '/api', timeout: 30_000 });

api.interceptors.request.use((config) => {
  if (_accessToken) config.headers.Authorization = `Bearer ${_accessToken}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      if (_isRefreshing) {
        return new Promise((resolve, reject) =>
          _queue.push((token) => {
            if (!token) return reject(error);
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          })
        );
      }
      original._retry = true;
      _isRefreshing = true;
      try {
        const rt = localStorage.getItem('refreshToken');
        if (!rt) throw new Error('no refresh token');
        const { data } = await axios.post('/api/auth/refresh', { refreshToken: rt });
        _accessToken = data.accessToken;
        localStorage.setItem('refreshToken', data.refreshToken);
        _queue.forEach((cb) => cb(data.accessToken));
        _queue = [];
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        _accessToken = null;
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('tenant');
        _queue.forEach((cb) => cb(null));
        _queue = [];
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        _isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  login:    (email: string, password: string, tenant: string) =>
    axios.post('/api/auth/login', { email, password, tenant }).then((r) => r.data),
  register: (tenantName: string, firstName: string, lastName: string, email: string, password: string) =>
    axios.post('/api/auth/register', { tenantName, firstName, lastName, email, password }).then((r) => r.data),
  refresh:  (refreshToken: string) =>
    axios.post('/api/auth/refresh', { refreshToken }).then((r) => r.data),
  logout:   (refreshToken: string) =>
    axios.post('/api/auth/logout', { refreshToken }),
  me:       () => api.get('/auth/me') as Promise<any>,
};

export const usersApi = {
  list:   (params?: any) => api.get('/users',      { params }) as Promise<any>,
  get:    (id: string)   => api.get(`/users/${id}`) as Promise<any>,
  create: (data: any)    => api.post('/users', data) as Promise<any>,
  update: (id: string, data: any) => api.patch(`/users/${id}`, data) as Promise<any>,
  remove: (id: string)   => api.delete(`/users/${id}`) as Promise<any>,
};

export const rolesApi = {
  list:        ()           => api.get('/roles') as Promise<any[]>,
  permissions: ()           => api.get('/roles/permissions') as Promise<Record<string, any[]>>,
  create:      (data: any)  => api.post('/roles', data) as Promise<any>,
  update:      (id: string, data: any) => api.patch(`/roles/${id}`, data) as Promise<any>,
  remove:      (id: string) => api.delete(`/roles/${id}`) as Promise<any>,
};

export const modulesApi = {
  list:   () => api.get('/modules') as Promise<any[]>,
  menu:   () => api.get('/modules/menu') as Promise<any[]>,
  toggle: (id: string, enabled: boolean) => api.post(`/modules/${id}/toggle`, { enabled }) as Promise<any>,
};
