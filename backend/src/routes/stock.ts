import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const stockRouter = Router();
stockRouter.use(authenticate);

// Estados de pedidos "activos" que reservan stock (aún no facturados)
const ESTADOS_RESERVA = ['CONFIRMADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO'];

// GET /stock — lista todos los productos con su stock actual y reservado
stockRouter.get('/', asyncHandler(async (_req, res) => {
  // Todos los productos activos
  const productos = await prisma.producto.findMany({
    where: { activo: true },
    include: { stock: true, categoria: true },
    orderBy: { nombre: 'asc' },
  });

  // Items en pedidos activos (reservados, no facturados)
  const itemsReservados = await prisma.itemPedido.findMany({
    where: { pedido: { estado: { in: ESTADOS_RESERVA } } },
    include: { producto: { select: { cajasPorPallet: true } } },
  });

  // Agrupar reservados por productoId (en cajas)
  const reservaMap: Record<string, number> = {};
  for (const item of itemsReservados) {
    const cajas = item.unidad === 'PALLET'
      ? item.cantidad * item.producto.cajasPorPallet
      : item.cantidad;
    reservaMap[item.productoId] = (reservaMap[item.productoId] ?? 0) + cajas;
  }

  const result = productos.map(p => {
    const stockActual = p.stock?.stockActual ?? 0;
    const reservado = reservaMap[p.id] ?? 0;
    return {
      productoId: p.id,
      producto: {
        nombre: p.nombre,
        codigoInterno: p.codigoInterno,
        cajasPorPallet: p.cajasPorPallet,
        categoria: p.categoria?.nombre,
      },
      stockActual,
      reservado,
      disponible: stockActual - reservado,
      updatedAt: p.stock?.updatedAt ?? null,
    };
  });

  res.json(result);
}));

// GET /stock/:productoId/movimientos — historial de movimientos de un producto
stockRouter.get('/:productoId/movimientos', asyncHandler(async (req, res) => {
  const stock = await prisma.stock.findUnique({
    where: { productoId: req.params.productoId },
    include: {
      movimientos: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });
  if (!stock) return res.json([]);
  res.json(stock.movimientos);
}));

// POST /stock/:productoId/ajuste — ajuste manual del stock
// Body: { stockNuevo: number, descripcion?: string } → establece el valor absoluto
// Body: { delta: number, descripcion?: string } → suma/resta al valor actual
stockRouter.post('/:productoId/ajuste', asyncHandler(async (req, res) => {
  const { productoId } = req.params;
  const { stockNuevo, delta, descripcion } = req.body;

  const producto = await prisma.producto.findUnique({ where: { id: productoId } });
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

  // Obtener o crear registro de stock
  const stockActual = await prisma.stock.upsert({
    where: { productoId },
    create: { productoId, stockActual: 0 },
    update: {},
  });

  let cantidad: number;
  let nuevoStock: number;

  if (typeof stockNuevo === 'number') {
    // Ajuste absoluto: el usuario ingresa el valor real actual
    cantidad = stockNuevo - stockActual.stockActual;
    nuevoStock = stockNuevo;
  } else if (typeof delta === 'number') {
    // Ajuste relativo
    cantidad = delta;
    nuevoStock = stockActual.stockActual + delta;
  } else {
    return res.status(400).json({ error: 'Debe enviar stockNuevo o delta' });
  }

  // Actualizar stock y crear movimiento
  const [updated] = await prisma.$transaction([
    prisma.stock.update({
      where: { productoId },
      data: { stockActual: nuevoStock },
    }),
    prisma.stockMovimiento.create({
      data: {
        stockId: stockActual.id,
        tipo: cantidad > 0 ? 'ENTRADA' : 'AJUSTE_MANUAL',
        cantidad,
        descripcion: descripcion || 'Ajuste manual',
      },
    }),
  ]);

  res.json({ productoId, stockActual: updated.stockActual });
}));
