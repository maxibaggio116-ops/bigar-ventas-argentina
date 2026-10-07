import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get('/', asyncHandler(async (_req, res) => {
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
  const inicioMesAnt = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const finMesAnt = new Date(now.getFullYear(), now.getMonth(), 0);

  // Umbral: clientes sin pedidos en los últimos 45 días
  const hace45dias = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);

  const [mesCurrent, mesAnt, palletsMes, palletsMesAnt, pedidosPendientes, ultimosPedidos, clientesActivos] = await Promise.all([
    prisma.pedido.aggregate({
      where: { fecha: { gte: inicioMes }, estado: { notIn: ['CANCELADO'] } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.pedido.aggregate({
      where: { fecha: { gte: inicioMesAnt, lte: finMesAnt }, estado: { notIn: ['CANCELADO'] } },
      _sum: { total: true },
      _count: true,
    }),
    // Pallets mes actual
    prisma.pedido.aggregate({
      where: { fecha: { gte: inicioMes }, estado: { in: ['DESPACHADO', 'ENTREGADO', 'FACTURADO'] } },
      _sum: { totalPallets: true },
    }),
    // Pallets mes anterior
    prisma.pedido.aggregate({
      where: { fecha: { gte: inicioMesAnt, lte: finMesAnt }, estado: { in: ['DESPACHADO', 'ENTREGADO', 'FACTURADO'] } },
      _sum: { totalPallets: true },
    }),
    prisma.pedido.count({
      where: { estado: { in: ['BORRADOR', 'CONFIRMADO', 'EN_PREPARACION'] } },
    }),
    prisma.pedido.findMany({
      take: 8,
      orderBy: { fecha: 'desc' },
      include: { cliente: { select: { razonSocial: true } } },
    }),
    // Clientes activos con su último pedido
    prisma.cliente.findMany({
      where: { activo: true },
      select: {
        id: true,
        razonSocial: true,
        whatsapp: true,
        pedidos: {
          where: { estado: { notIn: ['CANCELADO'] } },
          orderBy: { fecha: 'desc' },
          take: 1,
          select: { fecha: true },
        },
      },
    }),
  ]);

  const ventasMes = mesCurrent._sum.total || 0;
  const ventasMesAnt = mesAnt._sum.total || 0;
  const tendenciaVentas = ventasMesAnt > 0
    ? parseFloat((((ventasMes - ventasMesAnt) / ventasMesAnt) * 100).toFixed(1))
    : null;

  const palletsMesVal = palletsMes._sum.totalPallets || 0;
  const palletsMesAntVal = palletsMesAnt._sum.totalPallets || 0;
  const tendenciaPallets = palletsMesAntVal > 0
    ? parseFloat((((palletsMesVal - palletsMesAntVal) / palletsMesAntVal) * 100).toFixed(1))
    : null;

  // Clientes que hace más de 45 días no hacen pedidos (o nunca hicieron)
  const clientesSilenciosos = clientesActivos
    .filter(c => {
      const ultimo = c.pedidos[0]?.fecha;
      return !ultimo || new Date(ultimo) < hace45dias;
    })
    .map(c => ({
      id: c.id,
      razonSocial: c.razonSocial,
      whatsapp: c.whatsapp,
      ultimoPedido: c.pedidos[0]?.fecha ?? null,
      diasSinPedido: c.pedidos[0]?.fecha
        ? Math.floor((now.getTime() - new Date(c.pedidos[0].fecha).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }))
    .sort((a, b) => (b.diasSinPedido ?? 9999) - (a.diasSinPedido ?? 9999))
    .slice(0, 8);

  res.json({
    ventasMes,
    palletsMes: palletsMesVal,
    pedidosMes: mesCurrent._count,
    pedidosPendientes,
    tendenciaVentas,
    tendenciaPallets,
    ultimosPedidos,
    clientesSilenciosos,
  });
}));
