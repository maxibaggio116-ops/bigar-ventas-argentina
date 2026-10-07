import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const productosRouter = Router();
productosRouter.use(authenticate);

productosRouter.get('/', asyncHandler(async (_req, res) => {
  const productos = await prisma.producto.findMany({
    include: { categoria: true, precios: { include: { listaPrecio: true } } },
    orderBy: { nombre: 'asc' },
  });
  res.json(productos);
}));

productosRouter.get('/:id', asyncHandler(async (req, res) => {
  const p = await prisma.producto.findUnique({
    where: { id: req.params.id },
    include: { categoria: true, precios: { include: { listaPrecio: true } } },
  });
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(p);
}));

productosRouter.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { nombre, codigoInterno, descripcion, categoriaId, precioBase, pesoKg, cajasPorPallet, esPallet } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  const p = await prisma.producto.create({
    data: { nombre, codigoInterno, descripcion, categoriaId, precioBase: Number(precioBase) || 0,
      pesoKg: Number(pesoKg) || 0, cajasPorPallet: Number(cajasPorPallet) || 1, esPallet: Boolean(esPallet) },
    include: { categoria: true },
  });
  res.status(201).json(p);
}));

productosRouter.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { nombre, codigoInterno, descripcion, categoriaId, precioBase, pesoKg, cajasPorPallet, activo, esPallet } = req.body;
  const p = await prisma.producto.update({
    where: { id: req.params.id },
    // Solo actualiza los campos enviados
    data: { nombre, codigoInterno, descripcion, categoriaId, activo,
      precioBase: precioBase !== undefined ? Number(precioBase) : undefined,
      pesoKg: pesoKg !== undefined ? Number(pesoKg) : undefined,
      cajasPorPallet: cajasPorPallet !== undefined ? Number(cajasPorPallet) : undefined,
      esPallet: esPallet !== undefined ? Boolean(esPallet) : undefined },
    include: { categoria: true },
  });
  res.json(p);
}));

productosRouter.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  await prisma.producto.update({ where: { id: req.params.id }, data: { activo: false } });
  res.json({ ok: true });
}));

// Categorías
productosRouter.get('/categorias/lista', asyncHandler(async (_req, res) => {
  const cats = await prisma.categoria.findMany({ orderBy: { nombre: 'asc' } });
  res.json(cats);
}));
