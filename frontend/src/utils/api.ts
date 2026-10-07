import axios, { AxiosRequestConfig } from 'axios';

const instance = axios.create({ baseURL: '/api' });

instance.interceptors.request.use(config => {
  const token = localStorage.getItem('jdu_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

instance.interceptors.response.use(
  r => r,
  err => {
    // En el login, un 401 es "credenciales inválidas": se muestra el error sin redirigir
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('jdu_token');
      window.location.href = '/login';
    }
    const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Error desconocido';
    return Promise.reject(new Error(message));
  }
);

export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    instance.get<T>(url, config).then(r => r.data),

  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    instance.post<T>(url, data, config).then(r => r.data),

  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    instance.put<T>(url, data, config).then(r => r.data),

  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    instance.patch<T>(url, data, config).then(r => r.data),

  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    instance.delete<T>(url, config).then(r => r.data),

  download: (url: string, config?: AxiosRequestConfig): Promise<Blob> =>
    instance.get(url, { ...config, responseType: 'blob' }).then(r => r.data),
};
