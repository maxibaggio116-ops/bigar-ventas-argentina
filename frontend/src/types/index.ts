export type Rol = 'ADMIN' | 'OPERADOR';
export type EstadoPedido =
  | 'BORRADOR' | 'CONFIRMADO' | 'EN_PREPARACION'
  | 'DESPACHADO' | 'ENTREGADO' | 'FACTURADO' | 'CANCELADO';
export type PlazoCredito = 'CONTADO' | 'DIAS_21' | 'DIAS_30' | 'MAS_30';
export type TipoDocComex = 'BL' | 'PL' | 'FACTURA_COMERCIAL' | 'CRT' | 'OTRO';

export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  role: Rol;
}

export interface Categoria {
  id: string;
  nombre: string;
}

export interface Producto {
  id: string;
  nombre: string;
  codigoInterno?: string;
  descripcion?: string;
  categoriaId?: string;
  categoria?: Categoria;
  precioBase: number;
  pesoKg?: number;
  cajasPorPallet: number;
  esPallet?: boolean;
  activo?: boolean;
  precios?: PrecioProducto[];
}

export interface PrecioProducto {
  listaPrecioId: string;
  listaPrecio?: { nombre: string };
  productoId: string;
  producto?: { nombre: string; codigoInterno?: string };
  precio: number;
}

export interface ListaPrecio {
  id: string;
  nombre: string;
  descripcion?: string;
  precios?: PrecioProducto[];
}

export interface Cliente {
  id: string;
  razonSocial: string;
  cuit?: string;
  email?: string;
  telefono?: string;
  whatsapp?: string;
  direccion?: string;
  localidad?: string;
  provincia?: string;
  condicionIva?: string;
  plazoCredito: PlazoCredito;
  listaPrecioId?: string;
  listaPrecio?: ListaPrecio;
  activo?: boolean;
}

export interface ItemPedido {
  id: string;
  productoId: string;
  producto?: Producto;
  cantidad: number;
  unidad: 'CAJA' | 'PALLET';
  precioUnitario: number;
  subtotal: number;
}

export type Transportista = 'KLUVER' | 'BONJOUR_TUNESSI' | 'LEZCANO' | 'OTRO';

export interface Pedido {
  id: string;
  fecha: string;
  estado: EstadoPedido;
  subtotal: number;
  descuento: number;
  iva: number;
  total: number;
  totalPallets?: number;
  notas?: string;
  origenWhatsapp?: boolean;
  nombreContacto?: string;
  fechaFacturado?: string;
  transportista?: Transportista | null;
  transporteCosto?: number | null;
  transporteKm?: number | null;
  chofer?: string | null;
  pesoReal?: number | null;
  nroFactura?: string | null;
  pagado?: boolean;
  fechaPago?: string | null;
  clienteId?: string;
  cliente?: Cliente;
  listaPrecioId?: string;
  listaPrecio?: ListaPrecio;
  items?: ItemPedido[];
}

export interface TransporteKPIs {
  kpis: {
    totalViajes: number;
    totalCosto: number;
    totalKm: number;
    totalPallets: number;
    promedioCostoPorKm: number;
    promedioCostoPorViaje: number;
  };
  porEmpresa: Record<string, { viajes: number; costo: number; km: number; pallets: number }>;
}

export const PALLET_KG = 1030;

export interface PesajeItem {
  id: string;
  fecha: string;
  estado: EstadoPedido;
  totalPallets: number;
  pesoTeorico: number | null;
  pesoReal: number | null;
  transportista: Transportista | null;
  chofer: string | null;
  cliente: { razonSocial: string };
}

export interface TransporteViaje {
  id: string;
  fecha: string;
  estado: EstadoPedido;
  transportista: Transportista;
  transporteCosto: number | null;
  transporteKm: number | null;
  chofer: string | null;
  totalPallets: number;
  total: number;
  cliente: { razonSocial: string; localidad?: string | null };
}

export interface ClienteSilencioso {
  id: string;
  razonSocial: string;
  whatsapp?: string | null;
  ultimoPedido?: string | null;
  diasSinPedido?: number | null;
}

export interface DashboardData {
  ventasMes: number;
  palletsMes: number;
  pedidosMes: number;
  pedidosPendientes: number;
  tendenciaVentas?: number | null;
  tendenciaPallets?: number | null;
  ultimosPedidos: Pedido[];
  clientesSilenciosos: ClienteSilencioso[];
}

// COMEX
export interface ComexDocumento {
  id: string;
  operacionId: string;
  tipo: TipoDocComex;
  nombre: string;
  notas?: string;
  createdAt: string;
}

export interface ComexOperacion {
  id: string;
  fecha: string;
  tipo: 'IMPORTACION' | 'EXPORTACION';
  descripcion: string;
  proveedor?: string;
  montoUSD: number;
  cotizacion: number;
  montoUYU: number;
  estado: 'EN_PROCESO' | 'COMPLETADA' | 'CANCELADA';
  notas?: string;
  transportista?: Transportista | null;
  transporteCosto?: number | null;
  transporteKm?: number | null;
  documentos?: ComexDocumento[];
  createdAt: string;
}

export interface Cotizacion {
  source: string;
  fecha: string;
  USD_ARS: number;
  ARS_USD: number;
  nota?: string;
}

// DEUDORES
export interface DeudorItem {
  pedidoId: string;
  nroFactura?: string | null;
  cliente: { razonSocial: string; cuit?: string; plazoCredito: PlazoCredito; telefono?: string; whatsapp?: string };
  total: number;
  fechaFacturado: string;
  fechaVencimiento: string;
  plazo: number;
  diasTranscurridos: number;
  diasVencido: number;
  diasParaVencer: number;
  vencido: boolean;
  proximoVencer: boolean;
}

export interface DeudorPagado {
  pedidoId: string;
  nroFactura?: string | null;
  cliente: { razonSocial: string; cuit?: string; plazoCredito: PlazoCredito };
  total: number;
  fechaFacturado: string;
  fechaPago: string;
  plazo: number;
  diasTranscurridos: number;
}

// STOCK
export interface StockItem {
  productoId: string;
  producto: {
    nombre: string;
    codigoInterno?: string;
    cajasPorPallet: number;
    categoria?: string;
  };
  stockActual: number;
  reservado: number;
  disponible: number;
  updatedAt: string | null;
}

export interface StockMovimiento {
  id: string;
  tipo: 'AJUSTE_MANUAL' | 'ENTRADA' | 'FACTURACION';
  cantidad: number;
  descripcion?: string;
  pedidoId?: string;
  createdAt: string;
}

export interface DeudoresData {
  kpis: {
    totalDeudores: number;
    totalDeuda: number;
    vencidos: number;
    totalVencido: number;
    superan21: number;
    promedioDias: number;
    maxMorosidad: number;
  };
  deudores: DeudorItem[];
}
