import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const clientesRouter = Router();
clientesRouter.use(authenticate);

clientesRouter.get('/', asyncHandler(async (_req, res) => {
  const clientes = await prisma.cliente.findMany({
    where: { activo: true },
    include: { listaPrecio: true },
    orderBy: { razonSocial: 'asc' },
  });
  res.json(clientes);
}));

clientesRouter.get('/:id', asyncHandler(async (req, res) => {
  const c = await prisma.cliente.findUnique({
    where: { id: req.params.id },
    include: { listaPrecio: true, pedidos: { orderBy: { fecha: 'desc' }, take: 20 } },
  });
  if (!c) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json(c);
}));

clientesRouter.post('/', asyncHandler(async (req, res) => {
  const { razonSocial, cuit, email, telefono, whatsapp, direccion, localidad, provincia,
    condicionIva, plazoCredito, listaPrecioId } = req.body;
  if (!razonSocial) return res.status(400).json({ error: 'Razón social requerida' });
  const c = await prisma.cliente.create({
    data: { razonSocial, cuit, email, telefono, whatsapp, direccion, localidad, provincia,
      condicionIva, plazoCredito, listaPrecioId },
    include: { listaPrecio: true },
  });
  res.status(201).json(c);
}));

clientesRouter.put('/:id', asyncHandler(async (req, res) => {
  const { razonSocial, cuit, email, telefono, whatsapp, direccion, localidad, provincia,
    condicionIva, plazoCredito, listaPrecioId, activo } = req.body;
  const c = await prisma.cliente.update({
    where: { id: req.params.id },
    data: { razonSocial, cuit, email, telefono, whatsapp, direccion, localidad, provincia,
      condicionIva, plazoCredito, listaPrecioId, activo },
    include: { listaPrecio: true },
  });
  res.json(c);
}));

clientesRouter.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.cliente.update({ where: { id: req.params.id }, data: { activo: false } });
  res.json({ ok: true });
}));
