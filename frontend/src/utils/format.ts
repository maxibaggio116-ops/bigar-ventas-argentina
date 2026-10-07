import { EstadoPedido, PlazoCredito } from '../types';

export const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);

export const formatCurrencyUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

export const formatDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatDatetime = (d: string | Date) =>
  new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const formatCUIT = (c: string) => c.replace(/(\d{2})(\d{8})(\d{1})/, '$1-$2-$3');

export const estadoLabel: Record<EstadoPedido, string> = {
  BORRADOR: 'Borrador',
  CONFIRMADO: 'Confirmado',
  EN_PREPARACION: 'En Preparación',
  DESPACHADO: 'Despachado',
  ENTREGADO: 'Entregado',
  FACTURADO: 'Facturado',
  CANCELADO: 'Cancelado',
};

export const estadoColor: Record<EstadoPedido, string> = {
  BORRADOR: 'bg-gray-100 text-gray-700',
  CONFIRMADO: 'bg-blue-100 text-blue-800',
  EN_PREPARACION: 'bg-purple-100 text-purple-800',
  DESPACHADO: 'bg-indigo-100 text-indigo-800',
  ENTREGADO: 'bg-green-100 text-green-800',
  FACTURADO: 'bg-emerald-100 text-emerald-800',
  CANCELADO: 'bg-red-100 text-red-800',
};

export const plazoLabel: Record<PlazoCredito, string> = {
  CONTADO: 'Contado',
  DIAS_21: '21 días',
  DIAS_30: '30 días',
  MAS_30: 'Más de 30 días',
};
