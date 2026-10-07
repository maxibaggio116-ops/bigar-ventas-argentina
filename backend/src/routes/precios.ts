import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const preciosRouter = Router();
preciosRouter.use(authenticate);

preciosRouter.get('/', asyncHandler(async (_req, res) => {
  const listas = await prisma.listaPrecio.findMany({
    include: { precios: { include: { producto: { select: { nombre: true, codigoInterno: true } } } } },
    orderBy: { nombre: 'asc' },
  });
  res.json(listas);
}));

preciosRouter.get('/:id', asyncHandler(async (req, res) => {
  const l = await prisma.listaPrecio.findUnique({
    where: { id: req.params.id },
    include: { precios: { include: { producto: true } } },
  });
  if (!l) return res.status(404).json({ error: 'Lista no encontrada' });
  res.json(l);
}));

preciosRouter.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { nombre, descripcion } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  const l = await prisma.listaPrecio.create({ data: { nombre, descripcion } });
  res.status(201).json(l);
}));

preciosRouter.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { nombre, descripcion } = req.body;
  const l = await prisma.listaPrecio.update({ where: { id: req.params.id }, data: { nombre, descripcion } });
  res.json(l);
}));

preciosRouter.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  await prisma.listaPrecio.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// Upsert precio de producto en lista
preciosRouter.post('/:id/precios', requireAdmin, asyncHandler(async (req, res) => {
  const { productoId, precio } = req.body;
  if (!productoId || !precio) return res.status(400).json({ error: 'productoId y precio requeridos' });
  await prisma.precioProducto.upsert({
    where: { listaPrecioId_productoId: { listaPrecioId: req.params.id, productoId } },
    update: { precio: Number(precio) },
    create: { listaPrecioId: req.params.id, productoId, precio: Number(precio) },
  });
  const l = await prisma.listaPrecio.findUnique({
    where: { id: req.params.id },
    include: { precios: { include: { producto: { select: { nombre: true, codigoInterno: true } } } } },
  });
  res.json(l);
}));

preciosRouter.delete('/:id/precios/:productoId', requireAdmin, asyncHandler(async (req, res) => {
  await prisma.precioProducto.delete({
    where: { listaPrecioId_productoId: { listaPrecioId: req.params.id, productoId: req.params.productoId } },
  });
  const l = await prisma.listaPrecio.findUnique({
    where: { id: req.params.id },
    include: { precios: { include: { producto: { select: { nombre: true, codigoInterno: true } } } } },
  });
  res.json(l);
}));
