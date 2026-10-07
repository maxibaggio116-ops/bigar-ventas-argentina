import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const deudoresRouter = Router();
deudoresRouter.use(authenticate);

const PLAZO_DIAS: Record<string, number> = {
  CONTADO: 0,
  DIAS_21: 21,
  DIAS_30: 30,
  MAS_30: 45,
};

deudoresRouter.get('/', asyncHandler(async (_req, res) => {
  const hoy = new Date();

  const pedidosFacturados = await prisma.pedido.findMany({
    where: { estado: { in: ['FACTURADO', 'DESPACHADO', 'ENTREGADO'] }, pagado: false },
    include: { cliente: { select: { razonSocial: true, cuit: true, plazoCredito: true, telefono: true, whatsapp: true } } },
    orderBy: { fechaFacturado: 'asc' },
  });

  const deudores = pedidosFacturados.map(p => {
    const fechaBase = p.fechaFacturado || p.fecha;
    const plazo = PLAZO_DIAS[p.cliente.plazoCredito] ?? 30;
    const diasTranscurridos = Math.floor((hoy.getTime() - fechaBase.getTime()) / (1000 * 60 * 60 * 24));
    const diasVencido = Math.max(0, diasTranscurridos - plazo);
    const diasParaVencer = plazo - diasTranscurridos;
    const fechaVencimiento = new Date(fechaBase.getTime() + plazo * 24 * 60 * 60 * 1000);
    const vencido = diasVencido > 0;
    const proximoVencer = !vencido && diasParaVencer <= 5;
    return {
      pedidoId: p.id,
      nroFactura: p.nroFactura,
      cliente: p.cliente,
      total: p.total,
      fechaFacturado: fechaBase,
      fechaVencimiento,
      plazo,
      diasTranscurridos,
      diasVencido,
      diasParaVencer,
      vencido,
      proximoVencer,
    };
  });

  // KPIs
  const totalDeuda = deudores.reduce((s, d) => s + d.total, 0);
  const vencidos = deudores.filter(d => d.vencido);
  const totalVencido = vencidos.reduce((s, d) => s + d.total, 0);
  const superan21 = deudores.filter(d => d.diasVencido > 21).length;
  const promedioDias = deudores.length > 0
    ? Math.round(deudores.reduce((s, d) => s + d.diasTranscurridos, 0) / deudores.length)
    : 0;
  const maxMorosidad = deudores.length > 0 ? Math.max(...deudores.map(d => d.diasVencido)) : 0;

  res.json({
    kpis: { totalDeudores: deudores.length, totalDeuda, vencidos: vencidos.length, totalVencido, superan21, promedioDias, maxMorosidad },
    deudores,
  });
}));

// GET /deudores/pagados — pedidos ya saldados
deudoresRouter.get('/pagados', asyncHandler(async (_req, res) => {
  const pagados = await prisma.pedido.findMany({
    where: { estado: { in: ['FACTURADO', 'DESPACHADO', 'ENTREGADO'] }, pagado: true },
    include: { cliente: { select: { razonSocial: true, cuit: true, plazoCredito: true } } },
    orderBy: { fechaPago: 'desc' },
  });
  const hoy = new Date();
  return res.json(pagados.map(p => {
    const fechaBase = p.fechaFacturado || p.fecha;
    const plazo = PLAZO_DIAS[p.cliente.plazoCredito] ?? 30;
    const diasTranscurridos = Math.floor((hoy.getTime() - fechaBase.getTime()) / (1000 * 60 * 60 * 24));
    return { pedidoId: p.id, nroFactura: p.nroFactura, cliente: p.cliente, total: p.total, fechaFacturado: fechaBase, fechaPago: p.fechaPago, plazo, diasTranscurridos };
  }));
}));

// PATCH /deudores/:pedidoId/pagar — marcar como pagado
deudoresRouter.patch('/:pedidoId/pagar', asyncHandler(async (req, res) => {
  const pedido = await prisma.pedido.findUnique({ where: { id: req.params.pedidoId } });
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  const updated = await prisma.pedido.update({
    where: { id: req.params.pedidoId },
    data: { pagado: true, fechaPago: new Date() },
  });
  res.json(updated);
}));

// PATCH /deudores/:pedidoId/despagar — revertir pago
deudoresRouter.patch('/:pedidoId/despagar', asyncHandler(async (req, res) => {
  const pedido = await prisma.pedido.findUnique({ where: { id: req.params.pedidoId } });
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  const updated = await prisma.pedido.update({
    where: { id: req.params.pedidoId },
    data: { pagado: false, fechaPago: null },
  });
  res.json(updated);
}));
