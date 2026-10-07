import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { asyncHandler } from '../utils/asyncHandler';

export const pedidoPublicoRouter = Router();

// Verificar cliente por nombre + whatsapp
pedidoPublicoRouter.post('/verificar', asyncHandler(async (req, res) => {
  const { nombre, whatsapp } = req.body;
  if (!nombre || !whatsapp) return res.status(400).json({ error: 'Nombre y WhatsApp requeridos' });

  // Normalizar número: solo dígitos
  const waNorm = whatsapp.replace(/\D/g, '');

  const clientes = await prisma.cliente.findMany({
    where: { activo: true },
    select: { id: true, razonSocial: true, whatsapp: true, listaPrecioId: true },
  });

  // Buscar coincidencia de nombre (contiene, case-insensitive) + whatsapp
  const match = clientes.find(c => {
    const nombreMatch = c.razonSocial.toLowerCase().includes(nombre.toLowerCase().trim()) ||
      nombre.toLowerCase().trim().includes(c.razonSocial.toLowerCase());
    const waCli = (c.whatsapp ?? '').replace(/\D/g, '');
    const waMatch = waCli.length > 0 && (waCli === waNorm || waCli.endsWith(waNorm) || waNorm.endsWith(waCli));
    return nombreMatch && waMatch;
  });

  if (!match) {
    return res.status(401).json({ error: 'No encontramos un cliente con ese nombre y número de WhatsApp. Verificá los datos o contactá a ventas.' });
  }

  res.json({ ok: true, cliente: { id: match.id, razonSocial: match.razonSocial, listaPrecioId: match.listaPrecioId } });
}));

// Catálogo público por categorías
pedidoPublicoRouter.get('/catalogo', asyncHandler(async (_req, res) => {
  const productos = await prisma.producto.findMany({
    where: { activo: true },
    include: { categoria: true, precios: { include: { listaPrecio: true } } },
    orderBy: [{ categoria: { nombre: 'asc' } }, { nombre: 'asc' }],
  });
  const listas = await prisma.listaPrecio.findMany({ orderBy: { nombre: 'asc' } });
  res.json({ productos, listas });
}));

// Crear pedido desde WhatsApp
pedidoPublicoRouter.post('/pedido', asyncHandler(async (req, res) => {
  const { nombreContacto, clienteId, listaPrecioId, items, notas } = req.body;

  if (!nombreContacto) return res.status(400).json({ error: 'Nombre de contacto requerido' });
  if (!items?.length) return res.status(400).json({ error: 'Al menos un producto requerido' });

  let cliente = null;
  if (clienteId) {
    cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  }

  const lp = listaPrecioId || cliente?.listaPrecioId;

  const itemsCalc: any[] = [];
  for (const item of items) {
    const prod = await prisma.producto.findUnique({ where: { id: item.productoId } });
    if (!prod) continue;
    const cantidad = Number(item.cantidad) || 1;
    const unidad = item.unidad || 'CAJA';
    let precio = prod.precioBase;
    if (lp) {
      const pp = await prisma.precioProducto.findUnique({
        where: { listaPrecioId_productoId: { listaPrecioId: lp, productoId: prod.id } },
      });
      if (pp) precio = pp.precio;
    }
    const cajas = unidad === 'PALLET' ? cantidad * prod.cajasPorPallet : cantidad;
    const subtotalItem = parseFloat((cajas * precio).toFixed(2));
    const totalPalletsItem = cajas / prod.cajasPorPallet;
    itemsCalc.push({ productoId: prod.id, cantidad, unidad, precioUnitario: precio, subtotal: subtotalItem, cajasPorPallet: prod.cajasPorPallet, _pallets: totalPalletsItem });
  }

  if (!itemsCalc.length) return res.status(400).json({ error: 'No se pudieron calcular los productos' });

  const subtotal = parseFloat(itemsCalc.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
  const iva = parseFloat((subtotal * 0.21).toFixed(2));
  const total = parseFloat((subtotal + iva).toFixed(2));
  const totalPallets = parseFloat(itemsCalc.reduce((s, i) => s + i._pallets, 0).toFixed(3));

  const pedido = await prisma.pedido.create({
    data: {
      clienteId: clienteId || undefined,
      listaPrecioId: lp || null,
      subtotal,
      iva,
      total,
      descuento: 0,
      totalPallets,
      origenWhatsapp: true,
      nombreContacto,
      notas,
      estado: 'BORRADOR',
      items: { create: itemsCalc.map(i => ({ productoId: i.productoId, cantidad: i.cantidad, unidad: i.unidad, precioUnitario: i.precioUnitario, subtotal: i.subtotal })) },
    },
    include: { cliente: true, items: { include: { producto: true } } },
  });

  res.status(201).json(pedido);
}));
