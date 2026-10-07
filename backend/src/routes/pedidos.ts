import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

export const pedidosRouter = Router();
pedidosRouter.use(authenticate);

const FLUJO = ['BORRADOR','CONFIRMADO','EN_PREPARACION','FACTURADO','DESPACHADO','ENTREGADO'];

function calcTotales(items: any[], descuento: number) {
  // Productos pallet (esPallet=true) no suman en venta ni en conteo de pallets
  const itemsVenta = items.filter(i => !i.esPallet);
  const subtotal = itemsVenta.reduce((s, i) => s + i.subtotal, 0);
  const totalDesc = parseFloat((subtotal * (descuento / 100)).toFixed(2));
  const baseImponible = parseFloat((subtotal - totalDesc).toFixed(2));
  const iva = parseFloat((baseImponible * 0.21).toFixed(2));
  const total = parseFloat((baseImponible + iva).toFixed(2));
  const totalPallets = itemsVenta.reduce((s, i) => {
    const cajas = i.unidad === 'PALLET' ? i.cantidad * (i.cajasPorPallet || 1) : i.cantidad;
    return s + cajas / (i.cajasPorPallet || 1);
  }, 0);
  return { subtotal: parseFloat(subtotal.toFixed(2)), descuento, iva, total, totalPallets: parseFloat(totalPallets.toFixed(3)) };
}

pedidosRouter.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const { estado, clienteId, desde, hasta } = req.query;
  const pedidos = await prisma.pedido.findMany({
    where: {
      ...(estado && { estado: estado as string }),
      ...(clienteId && { clienteId: clienteId as string }),
      ...(desde && hasta && { fecha: { gte: new Date(desde as string), lte: new Date(new Date(hasta as string).setHours(23,59,59,999)) } }),
    },
    include: {
      cliente: { select: { razonSocial: true, cuit: true, plazoCredito: true } },
      listaPrecio: { select: { nombre: true } },
      _count: { select: { items: true } },
    },
    orderBy: { fecha: 'desc' },
  });
  res.json(pedidos);
}));

pedidosRouter.get('/:id', asyncHandler(async (req, res) => {
  const pedido = await prisma.pedido.findUnique({
    where: { id: req.params.id },
    include: {
      cliente: true,
      listaPrecio: true,
      items: { include: { producto: { include: { categoria: true } } } },
    },
  });
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json(pedido);
}));

pedidosRouter.post('/', asyncHandler(async (req: AuthRequest, res) => {
  const { clienteId, listaPrecioId, descuento = 0, notas, items, origenWhatsapp = false, nombreContacto, fecha } = req.body;
  if (!clienteId || !items?.length) return res.status(400).json({ error: 'clienteId e items requeridos' });

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente || !cliente.activo) return res.status(404).json({ error: 'Cliente no encontrado' });

  const lp = listaPrecioId || cliente.listaPrecioId;

  const itemsCalc: any[] = [];
  for (const item of items) {
    const prod = await prisma.producto.findUnique({ where: { id: item.productoId } });
    if (!prod) return res.status(400).json({ error: `Producto ${item.productoId} no encontrado` });
    const cantidad = Number(item.cantidad) || 0;
    const unidad = item.unidad || 'CAJA';
    let precioUnit = item.precioUnitario;
    if (!precioUnit && lp) {
      const pp = await prisma.precioProducto.findUnique({ where: { listaPrecioId_productoId: { listaPrecioId: lp, productoId: prod.id } } });
      precioUnit = pp?.precio ?? prod.precioBase;
    } else if (!precioUnit) {
      precioUnit = prod.precioBase;
    }
    const cajas = unidad === 'PALLET' ? cantidad * prod.cajasPorPallet : cantidad;
    const subtotal = parseFloat((cajas * precioUnit).toFixed(2));
    itemsCalc.push({ productoId: prod.id, cantidad, unidad, precioUnitario: precioUnit, subtotal, cajasPorPallet: prod.cajasPorPallet, esPallet: prod.esPallet });
  }

  const totales = calcTotales(itemsCalc, Number(descuento));

  const pedido = await prisma.pedido.create({
    data: {
      clienteId,
      listaPrecioId: lp || null,
      descuento: totales.descuento,
      subtotal: totales.subtotal,
      iva: totales.iva,
      total: totales.total,
      totalPallets: totales.totalPallets,
      notas,
      origenWhatsapp,
      nombreContacto,
      ...(fecha && { fecha: new Date(fecha) }),
      items: {
        create: itemsCalc.map(i => ({
          productoId: i.productoId,
          cantidad: i.cantidad,
          unidad: i.unidad,
          precioUnitario: i.precioUnitario,
          subtotal: i.subtotal,
        })),
      },
    },
    include: { cliente: true, listaPrecio: true, items: { include: { producto: true } } },
  });
  res.status(201).json(pedido);
}));

pedidosRouter.put('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { clienteId, listaPrecioId, descuento = 0, notas, items, fecha } = req.body;
  if (!clienteId || !items?.length) return res.status(400).json({ error: 'clienteId e items requeridos' });

  const pedido = await prisma.pedido.findUnique({ where: { id: req.params.id } });
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

  const BLOQUEADOS = ['FACTURADO', 'DESPACHADO', 'ENTREGADO', 'CANCELADO'];
  if (BLOQUEADOS.includes(pedido.estado))
    return res.status(400).json({ error: `No se puede editar un pedido en estado ${pedido.estado}` });

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente || !cliente.activo) return res.status(404).json({ error: 'Cliente no encontrado' });

  const lp = listaPrecioId || cliente.listaPrecioId;

  const itemsCalc: any[] = [];
  for (const item of items) {
    const prod = await prisma.producto.findUnique({ where: { id: item.productoId } });
    if (!prod) return res.status(400).json({ error: `Producto ${item.productoId} no encontrado` });
    const cantidad = Number(item.cantidad) || 0;
    const unidad = item.unidad || 'CAJA';
    let precioUnit = item.precioUnitario;
    if (!precioUnit && lp) {
      const pp = await prisma.precioProducto.findUnique({ where: { listaPrecioId_productoId: { listaPrecioId: lp, productoId: prod.id } } });
      precioUnit = pp?.precio ?? prod.precioBase;
    } else if (!precioUnit) {
      precioUnit = prod.precioBase;
    }
    const cajas = unidad === 'PALLET' ? cantidad * prod.cajasPorPallet : cantidad;
    const subtotal = parseFloat((cajas * precioUnit).toFixed(2));
    itemsCalc.push({ productoId: prod.id, cantidad, unidad, precioUnitario: precioUnit, subtotal, cajasPorPallet: prod.cajasPorPallet, esPallet: prod.esPallet });
  }

  const totales = calcTotales(itemsCalc, Number(descuento));

  // Borrar items existentes y recrear
  await prisma.itemPedido.deleteMany({ where: { pedidoId: req.params.id } });

  const updated = await prisma.pedido.update({
    where: { id: req.params.id },
    data: {
      clienteId,
      listaPrecioId: lp || null,
      descuento: totales.descuento,
      subtotal: totales.subtotal,
      iva: totales.iva,
      total: totales.total,
      totalPallets: totales.totalPallets,
      notas,
      ...(fecha && { fecha: new Date(fecha) }),
      items: {
        create: itemsCalc.map(i => ({
          productoId: i.productoId,
          cantidad: i.cantidad,
          unidad: i.unidad,
          precioUnitario: i.precioUnitario,
          subtotal: i.subtotal,
        })),
      },
    },
    include: { cliente: true, listaPrecio: true, items: { include: { producto: true } } },
  });

  res.json(updated);
}));

pedidosRouter.patch('/:id/estado', asyncHandler(async (req: AuthRequest, res) => {
  const { estado, fechaFacturado } = req.body;
  const allowed = [...FLUJO, 'CANCELADO'];
  if (!allowed.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });

  const actual = await prisma.pedido.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { producto: true } } },
  });
  if (!actual) return res.status(404).json({ error: 'Pedido no encontrado' });

  const data: any = { estado };
  if (estado === 'FACTURADO') data.fechaFacturado = fechaFacturado ? new Date(fechaFacturado) : new Date();
  // Si retrocede desde FACTURADO, limpiar fecha de facturación y nro
  if (actual.estado === 'FACTURADO' && FLUJO.indexOf(estado) < FLUJO.indexOf('FACTURADO')) {
    data.fechaFacturado = null;
    data.nroFactura = null;
  }

  const pedido = await prisma.pedido.update({
    where: { id: req.params.id },
    data,
    include: { cliente: true, listaPrecio: true, items: { include: { producto: true } } },
  });

  // Al facturar: descontar stock
  if (estado === 'FACTURADO') {
    for (const item of pedido.items) {
      const cajas = item.unidad === 'PALLET'
        ? item.cantidad * (item.producto.cajasPorPallet ?? 1)
        : item.cantidad;
      const stockRec = await prisma.stock.upsert({
        where: { productoId: item.productoId },
        create: { productoId: item.productoId, stockActual: -cajas },
        update: { stockActual: { decrement: cajas } },
      });
      await prisma.stockMovimiento.create({
        data: {
          stockId: stockRec.id,
          tipo: 'FACTURACION',
          cantidad: -cajas,
          descripcion: `Facturación pedido #${pedido.id.slice(-6).toUpperCase()}`,
          pedidoId: pedido.id,
        },
      });
    }
  }

  // Al retroceder desde FACTURADO: restaurar stock
  if (actual.estado === 'FACTURADO' && FLUJO.indexOf(estado) < FLUJO.indexOf('FACTURADO')) {
    for (const item of actual.items) {
      const cajas = item.unidad === 'PALLET'
        ? item.cantidad * (item.producto.cajasPorPallet ?? 1)
        : item.cantidad;
      const stockRec = await prisma.stock.upsert({
        where: { productoId: item.productoId },
        create: { productoId: item.productoId, stockActual: cajas },
        update: { stockActual: { increment: cajas } },
      });
      await prisma.stockMovimiento.create({
        data: {
          stockId: stockRec.id,
          tipo: 'AJUSTE_MANUAL',
          cantidad: cajas,
          descripcion: `Reversión facturación pedido #${actual.id.slice(-6).toUpperCase()}`,
          pedidoId: actual.id,
        },
      });
    }
  }

  res.json(pedido);
}));

pedidosRouter.patch('/:id/factura', asyncHandler(async (req: AuthRequest, res) => {
  const { nroFactura, fechaFacturado } = req.body;
  const pedido = await prisma.pedido.findUnique({ where: { id: req.params.id } });
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  const FACTURABLES = ['FACTURADO', 'DESPACHADO', 'ENTREGADO'];
  if (!FACTURABLES.includes(pedido.estado))
    return res.status(400).json({ error: 'El pedido no está facturado' });
  const updated = await prisma.pedido.update({
    where: { id: req.params.id },
    data: {
      nroFactura: nroFactura?.toString().trim() || null,
      ...(fechaFacturado && { fechaFacturado: new Date(fechaFacturado) }),
    },
  });
  res.json(updated);
}));

pedidosRouter.patch('/:id/peso', asyncHandler(async (req: AuthRequest, res) => {
  const { pesoReal, pesoTeorico } = req.body;
  const pedido = await prisma.pedido.findUnique({ where: { id: req.params.id } });
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  const updated = await prisma.pedido.update({
    where: { id: req.params.id },
    data: {
      ...(pesoReal !== undefined && { pesoReal: pesoReal != null ? Number(pesoReal) : null }),
      ...(pesoTeorico !== undefined && { pesoTeorico: pesoTeorico != null ? Number(pesoTeorico) : null }),
    },
  });
  res.json(updated);
}));

pedidosRouter.patch('/:id/transporte', asyncHandler(async (req: AuthRequest, res) => {
  const { transportista, transporteCosto, transporteKm, chofer } = req.body;
  const pedido = await prisma.pedido.findUnique({ where: { id: req.params.id } });
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  const DESPACHADOS = ['DESPACHADO', 'ENTREGADO', 'FACTURADO'];
  if (!DESPACHADOS.includes(pedido.estado))
    return res.status(400).json({ error: 'Solo se puede asignar transporte a pedidos despachados o posteriores' });
  const updated = await prisma.pedido.update({
    where: { id: req.params.id },
    data: {
      transportista: transportista || null,
      transporteCosto: transporteCosto != null ? Number(transporteCosto) : null,
      transporteKm: transporteKm != null ? Number(transporteKm) : null,
      chofer: chofer || null,
    },
    include: { cliente: true, listaPrecio: true, items: { include: { producto: true } } },
  });
  res.json(updated);
}));

pedidosRouter.delete('/:id', asyncHandler(async (req, res) => {
  const pedido = await prisma.pedido.findUnique({ where: { id: req.params.id } });
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (!['BORRADOR', 'CANCELADO'].includes(pedido.estado))
    return res.status(400).json({ error: 'Solo se pueden eliminar pedidos en borrador o cancelados' });
  await prisma.pedido.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));
