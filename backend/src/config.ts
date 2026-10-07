// Datos de la empresa y valores iniciales. Ajustar acá según la empresa.
export const EMPRESA = process.env.EMPRESA_NOMBRE || 'Bigar S.A.';
export const DOMINIO = process.env.EMPRESA_DOMINIO || 'bigar.com.ar';

export const ADMIN_EMAIL = `admin@${DOMINIO}`;
export const VENDEDOR_EMAIL = `vendedor@${DOMINIO}`;
export const VENDEDOR_PASSWORD = process.env.VENDEDOR_PASSWORD || 'vendedor123';

export const IVA_TASA = 0.21; // IVA general Argentina

export const CATEGORIAS_INICIALES = ['Jugos', 'Bebidas', 'Logística'];
export const LISTAS_INICIALES = ['Lista A', 'Lista B', 'Lista C'];

// Precios base y pesos los carga el admin desde la app
export const PRODUCTOS_INICIALES: { nombre: string; categoria: string; esPallet?: boolean }[] = [
  { nombre: 'Jugo de Naranja 1L', categoria: 'Jugos' },
  { nombre: 'Jugo de Naranja 2L', categoria: 'Jugos' },
  { nombre: 'Jugo de Manzana 1L', categoria: 'Jugos' },
  { nombre: 'Jugo de Manzana 2L', categoria: 'Jugos' },
  { nombre: 'Jugo de Durazno 1L', categoria: 'Jugos' },
  { nombre: 'Jugo de Durazno 2L', categoria: 'Jugos' },
  { nombre: 'Jugo de Pera 1L', categoria: 'Jugos' },
  { nombre: 'Jugo de Pera 2L', categoria: 'Jugos' },
  { nombre: 'Jugo Multifruta 1L', categoria: 'Jugos' },
  { nombre: 'Jugo Multifruta 2L', categoria: 'Jugos' },
  { nombre: 'Agua saborizada Naranja 500ml', categoria: 'Bebidas' },
  { nombre: 'Agua saborizada Lima-Limón 500ml', categoria: 'Bebidas' },
  { nombre: 'Pallets Arlog', categoria: 'Logística', esPallet: true },
];
