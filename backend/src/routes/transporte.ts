import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const transporteRouter = Router();
transporteRouter.use(authenticate);

export const PALLET_KG = 1030;
const TRANSPORTISTAS = ['KLUVER', 'BONJOUR_TUNESSI', 'LEZCANO', 'OTRO'];

// GET /api/transporte/kpis — KPIs generales
transporteRouter.get('/kpis', asyncHandler(async (_req, res) => {
  const pedidos = await prisma.pedido.findMany({
    where: { transportista: { not: null } },
    select: {
      transportista: true,
      transporteCosto: true,
      transporteKm: true,
      totalPallets: true,
      fecha: true,
      cliente: { select: { razonSocial: true } },
    },
    orderBy: { fecha: 'desc' },
  });

  // También incluir operaciones Comex con transporte
  const comexOps = await prisma.comexOperacion.findMany({
    where: { transportista: { not: null } },
    select: { transportista: true, transporteCosto: true, transporteKm: true },
  });

  const allItems = [
    ...pedidos.map(p => ({ transportista: p.transportista!, costo: p.transporteCosto || 0, km: p.transporteKm || 0, pallets: p.totalPallets || 0 })),
    ...comexOps.map(c => ({ transportista: c.transportista!, costo: c.transporteCosto || 0, km: c.transporteKm || 0, pallets: 0 })),
  ];

  const totalViajes = allItems.length;
  const totalCosto = allItems.reduce((s, p) => s + p.costo, 0);
  const totalKm = allItems.reduce((s, p) => s + p.km, 0);
  const totalPallets = pedidos.reduce((s, p) => s + (p.totalPallets || 0), 0);

  const porEmpresa: Record<string, { viajes: number; costo: number; km: number; pallets: number }> = {};
  for (const t of TRANSPORTISTAS) {
    porEmpresa[t] = { viajes: 0, costo: 0, km: 0, pallets: 0 };
  }

  for (const item of allItems) {
    const key = item.transportista;
    if (!porEmpresa[key]) porEmpresa[key] = { viajes: 0, costo: 0, km: 0, pallets: 0 };
    porEmpresa[key].viajes += 1;
    porEmpresa[key].costo += item.costo;
    porEmpresa[key].km += item.km;
    porEmpresa[key].pallets += item.pallets;
  }

  res.json({
    kpis: {
      totalViajes,
      totalCosto: parseFloat(totalCosto.toFixed(2)),
      totalKm: parseFloat(totalKm.toFixed(1)),
      totalPallets: parseFloat(totalPallets.toFixed(2)),
      promedioCostoPorKm: totalKm > 0 ? parseFloat((totalCosto / totalKm).toFixed(2)) : 0,
      promedioCostoPorViaje: totalViajes > 0 ? parseFloat((totalCosto / totalViajes).toFixed(2)) : 0,
    },
    porEmpresa,
  });
}));

// GET /api/transporte/pesaje — pedidos despachados con peso teórico y real
transporteRouter.get('/pesaje', asyncHandler(async (_req, res) => {
  const pedidos = await prisma.pedido.findMany({
    where: { estado: { in: ['DESPACHADO', 'ENTREGADO', 'FACTURADO'] } },
    select: {
      id: true,
      fecha: true,
      estado: true,
      totalPallets: true,
      pesoTeorico: true,
      pesoReal: true,
      transportista: true,
      chofer: true,
      cliente: { select: { razonSocial: true } },
    },
    orderBy: { fecha: 'desc' },
  });
  res.json(pedidos.map(p => ({
    ...p,
    pesoTeorico: p.pesoTeorico ?? null,
  })));
}));

// GET /api/transporte — lista de viajes registrados
transporteRouter.get('/', asyncHandler(async (req, res) => {
  const { transportista, desde, hasta } = req.query;
  const pedidos = await prisma.pedido.findMany({
    where: {
      transportista: { not: null },
      ...(transportista && { transportista: transportista as string }),
      ...(desde && hasta && {
        fecha: {
          gte: new Date(desde as string),
          lte: new Date(new Date(hasta as string).setHours(23, 59, 59, 999)),
        },
      }),
    },
    select: {
      id: true,
      fecha: true,
      estado: true,
      transportista: true,
      transporteCosto: true,
      transporteKm: true,
      chofer: true,
      totalPallets: true,
      total: true,
      cliente: { select: { razonSocial: true, localidad: true } },
    },
    orderBy: { fecha: 'desc' },
  });
  res.json(pedidos);
}));
