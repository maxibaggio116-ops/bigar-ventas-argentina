import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import ExcelJS from 'exceljs';

export const reportesRouter = Router();
reportesRouter.use(authenticate);

reportesRouter.get('/excel', asyncHandler(async (req, res) => {
  const { tipo = 'ventas', from, to } = req.query;

  const dateFilter = from && to
    ? { gte: new Date(from as string), lte: new Date(new Date(to as string).setHours(23,59,59,999)) }
    : undefined;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Bigar S.A.';
  wb.created = new Date();
  const headerStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1B4332' } } };

  if (tipo === 'ventas') {
    const ws = wb.addWorksheet('Ventas');
    ws.columns = [
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Cliente', key: 'cliente', width: 30 },
      { header: 'Estado', key: 'estado', width: 16 },
      { header: 'Subtotal', key: 'subtotal', width: 14 },
      { header: 'Descuento %', key: 'desc', width: 12 },
      { header: 'Total', key: 'total', width: 14 },
      { header: 'Pallets', key: 'pallets', width: 10 },
      { header: 'Bultos (cajas)', key: 'bultos', width: 14 },
    ];
    ws.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));

    const pedidos = await prisma.pedido.findMany({
      where: { ...(dateFilter && { fecha: dateFilter }), estado: { not: 'CANCELADO' } },
      include: {
        cliente: { select: { razonSocial: true } },
        items: { include: { producto: { select: { cajasPorPallet: true, esPallet: true } } } },
      },
      orderBy: { fecha: 'desc' },
    });

    for (const p of pedidos) {
      // Calcular bultos totales: CAJA=cantidad directa, PALLET=cantidad*cajasPorPallet (excluye pallets informativos)
      const bultos = p.items.reduce((sum, item) => {
        if (item.producto?.esPallet) return sum; // Pallets Arlog: informativos, no suman
        if (item.unidad === 'PALLET') return sum + item.cantidad * (item.producto?.cajasPorPallet ?? 1);
        return sum + item.cantidad;
      }, 0);
      ws.addRow({ fecha: p.fecha.toLocaleDateString('es-AR'), cliente: p.cliente?.razonSocial ?? p.nombreContacto ?? '—',
        estado: p.estado, subtotal: p.subtotal, desc: p.descuento, total: p.total, pallets: p.totalPallets, bultos });
    }

  } else if (tipo === 'clientes') {
    const ws = wb.addWorksheet('Ranking Clientes');
    ws.columns = [
      { header: 'Cliente', key: 'cliente', width: 30 },
      { header: 'CUIT', key: 'cuit', width: 16 },
      { header: 'Pedidos', key: 'pedidos', width: 10 },
      { header: 'Total Comprado', key: 'total', width: 18 },
      { header: 'Plazo Crédito', key: 'plazo', width: 14 },
    ];
    ws.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));

    const clientes = await prisma.cliente.findMany({
      where: { activo: true },
      include: { pedidos: { where: { ...(dateFilter && { fecha: dateFilter }), estado: { not: 'CANCELADO' } }, select: { total: true } } },
      orderBy: { razonSocial: 'asc' },
    });

    for (const c of clientes.sort((a, b) =>
      b.pedidos.reduce((s, p) => s + p.total, 0) - a.pedidos.reduce((s, p) => s + p.total, 0)
    )) {
      ws.addRow({ cliente: c.razonSocial, cuit: c.cuit ?? '—', pedidos: c.pedidos.length,
        total: c.pedidos.reduce((s, p) => s + p.total, 0), plazo: c.plazoCredito });
    }

  } else if (tipo === 'clientes_detalle') {
    // ── Detalle por cliente: cajas/pallets por sabor y presentación ──────────────
    const ws = wb.addWorksheet('Detalle por Cliente');
    ws.columns = [
      { header: 'Cliente', key: 'cliente', width: 30 },
      { header: 'CUIT', key: 'cuit', width: 16 },
      { header: 'Producto', key: 'producto', width: 34 },
      { header: 'Código', key: 'codigo', width: 14 },
      { header: 'Cajas', key: 'cajas', width: 10 },
      { header: 'Pallets', key: 'pallets', width: 10 },
      { header: 'Total $', key: 'total', width: 16 },
    ];
    ws.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));

    const items = await prisma.itemPedido.findMany({
      where: {
        pedido: {
          ...(dateFilter && { fecha: dateFilter }),
          estado: { not: 'CANCELADO' },
        },
      },
      include: {
        pedido: { include: { cliente: { select: { razonSocial: true, cuit: true } } } },
        producto: { select: { nombre: true, codigoInterno: true, cajasPorPallet: true, esPallet: true } },
      },
    });

    // Agrupar por (clienteId, productoId)
    const byClienteProd = new Map<string, {
      cliente: string; cuit: string; producto: string; codigo: string;
      cajas: number; pallets: number; total: number;
    }>();

    for (const item of items) {
      if (item.producto.esPallet) continue; // Ignorar pallets arlog
      const clienteNombre = item.pedido.cliente?.razonSocial ?? '—';
      const clienteCuit = item.pedido.cliente?.cuit ?? '—';
      const key = `${item.pedido.clienteId}__${item.productoId}`;
      if (!byClienteProd.has(key)) {
        byClienteProd.set(key, { cliente: clienteNombre, cuit: clienteCuit, producto: item.producto.nombre, codigo: item.producto.codigoInterno ?? '', cajas: 0, pallets: 0, total: 0 });
      }
      const entry = byClienteProd.get(key)!;
      const cajasItem = item.unidad === 'PALLET' ? item.cantidad * item.producto.cajasPorPallet : item.cantidad;
      const palletsItem = item.unidad === 'PALLET' ? item.cantidad : item.cantidad / item.producto.cajasPorPallet;
      entry.cajas += cajasItem;
      entry.pallets += palletsItem;
      entry.total += item.subtotal;
    }

    // Ordenar por cliente → total desc
    const rows = [...byClienteProd.values()].sort((a, b) =>
      a.cliente.localeCompare(b.cliente) || b.total - a.total
    );

    let prevCliente = '';
    for (const row of rows) {
      // Línea separadora entre clientes
      if (prevCliente && row.cliente !== prevCliente) {
        ws.addRow({});
      }
      ws.addRow({
        cliente: row.cliente,
        cuit: row.cuit,
        producto: row.producto,
        codigo: row.codigo,
        cajas: Math.round(row.cajas),
        pallets: parseFloat(row.pallets.toFixed(2)),
        total: parseFloat(row.total.toFixed(2)),
      });
      prevCliente = row.cliente;
    }

    ws.autoFilter = { from: 'A1', to: 'G1' };

  } else if (tipo === 'productos') {
    const ws = wb.addWorksheet('Productos');
    ws.columns = [
      { header: 'Producto', key: 'nombre', width: 30 },
      { header: 'Código', key: 'codigo', width: 14 },
      { header: 'Cajas vendidas', key: 'cajas', width: 14 },
      { header: 'Total $', key: 'total', width: 16 },
    ];
    ws.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));

    const items = await prisma.itemPedido.findMany({
      where: { pedido: { ...(dateFilter && { fecha: dateFilter }), estado: { not: 'CANCELADO' } } },
      include: { producto: { select: { nombre: true, codigoInterno: true, cajasPorPallet: true } } },
    });

    const byProd = new Map<string, { nombre: string; codigo: string; cajas: number; total: number }>();
    for (const i of items) {
      const cajas = i.unidad === 'PALLET' ? i.cantidad * i.producto.cajasPorPallet : i.cantidad;
      const k = i.productoId;
      if (!byProd.has(k)) byProd.set(k, { nombre: i.producto.nombre, codigo: i.producto.codigoInterno ?? '', cajas: 0, total: 0 });
      byProd.get(k)!.cajas += cajas;
      byProd.get(k)!.total += i.subtotal;
    }

    for (const [, v] of [...byProd.entries()].sort((a, b) => b[1].cajas - a[1].cajas)) {
      ws.addRow({ nombre: v.nombre, codigo: v.codigo, cajas: v.cajas, total: parseFloat(v.total.toFixed(2)) });
    }
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="reporte-${tipo}-${Date.now()}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}));

// ─── DATOS PARA GRÁFICO PREVIEW ───────────────────────────────────────────────
reportesRouter.get('/chart', asyncHandler(async (req, res) => {
  const { tipo = 'ventas', from, to, granularidad = 'auto' } = req.query;
  const dateFilter = from && to
    ? { gte: new Date(from as string), lte: new Date(new Date(to as string).setHours(23, 59, 59, 999)) }
    : undefined;

  if (tipo === 'ventas') {
    const pedidos = await prisma.pedido.findMany({
      where: { ...(dateFilter && { fecha: dateFilter }), estado: { not: 'CANCELADO' } },
      select: { fecha: true, total: true },
      orderBy: { fecha: 'asc' },
    });

    // Determinar agrupación según granularidad
    const rangoMs = from && to ? new Date(to as string).getTime() - new Date(from as string).getTime() : 0;
    let agrupacion: 'dia' | 'bisemanal' | 'mes';
    if (granularidad === 'dia') agrupacion = 'dia';
    else if (granularidad === 'bisemanal') agrupacion = 'bisemanal';
    else if (granularidad === 'mes') agrupacion = 'mes';
    else agrupacion = rangoMs > 60 * 24 * 60 * 60 * 1000 ? 'mes' : rangoMs > 30 * 24 * 60 * 60 * 1000 ? 'bisemanal' : 'dia';

    const map = new Map<string, number>();
    for (const p of pedidos) {
      const d = new Date(p.fecha);
      let key: string;
      if (agrupacion === 'mes') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else if (agrupacion === 'bisemanal') {
        // Quincenal: 1-15 o 16-fin
        const quincena = d.getDate() <= 15 ? '01' : '16';
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${quincena}`;
      } else {
        key = d.toISOString().slice(0, 10);
      }
      map.set(key, (map.get(key) || 0) + p.total);
    }
    const data = [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, total]) => ({ fecha, total: parseFloat(total.toFixed(2)) }));
    return res.json({ tipo: 'line', data, xKey: 'fecha', yKey: 'total', yLabel: 'Total ($)', agrupacion });
  }

  if (tipo === 'productos') {
    const items = await prisma.itemPedido.findMany({
      where: { pedido: { ...(dateFilter && { fecha: dateFilter }), estado: { not: 'CANCELADO' } } },
      include: { producto: { select: { nombre: true, codigoInterno: true, cajasPorPallet: true, esPallet: true } } },
    });
    const map = new Map<string, { nombre: string; cajas: number; total: number }>();
    for (const i of items) {
      if (i.producto.esPallet) continue;
      const cajas = i.unidad === 'PALLET' ? i.cantidad * i.producto.cajasPorPallet : i.cantidad;
      if (!map.has(i.productoId)) map.set(i.productoId, { nombre: i.producto.nombre, cajas: 0, total: 0 });
      map.get(i.productoId)!.cajas += cajas;
      map.get(i.productoId)!.total += i.subtotal;
    }
    const data = [...map.values()]
      .sort((a, b) => b.cajas - a.cajas)
      .slice(0, 12)
      .map(v => ({ nombre: v.nombre.length > 22 ? v.nombre.slice(0, 22) + '…' : v.nombre, cajas: Math.round(v.cajas), total: parseFloat(v.total.toFixed(2)) }));
    return res.json({ tipo: 'bar', data, xKey: 'nombre', yKey: 'cajas', yLabel: 'Cajas vendidas' });
  }

  if (tipo === 'clientes' || tipo === 'clientes_detalle') {
    const clientes = await prisma.cliente.findMany({
      where: { activo: true },
      include: { pedidos: { where: { ...(dateFilter && { fecha: dateFilter }), estado: { not: 'CANCELADO' } }, select: { total: true } } },
    });
    const todos = clientes
      .map(c => ({ nombre: c.razonSocial.length > 22 ? c.razonSocial.slice(0, 22) + '…' : c.razonSocial, total: parseFloat(c.pedidos.reduce((s, p) => s + p.total, 0).toFixed(2)) }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);
    // Top 10, el resto se agrupa como "Otros"
    const top = todos.slice(0, 10);
    const otros = todos.slice(10).reduce((s, c) => s + c.total, 0);
    const data = otros > 0 ? [...top, { nombre: 'Otros', total: parseFloat(otros.toFixed(2)) }] : top;
    return res.json({ tipo: 'pie', data, xKey: 'nombre', yKey: 'total', yLabel: 'Total comprado ($)' });
  }

  res.json({ tipo: 'none', data: [] });
}));

// ─── BACKUP COMPLETO ──────────────────────────────────────────────────────────
reportesRouter.get('/backup', asyncHandler(async (_req, res) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Bigar S.A.';
  wb.created = new Date();

  const HEAD = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1B4332' } }, alignment: { vertical: 'middle' as const } };
  const applyHead = (ws: ExcelJS.Worksheet) => ws.getRow(1).eachCell(cell => Object.assign(cell, HEAD));
  const fmt = (d: Date | null | undefined) => d ? d.toISOString().replace('T', ' ').slice(0, 19) : '';

  // ── 1. Clientes ─────────────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet('Clientes');
    ws.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Razón Social', key: 'razonSocial', width: 32 },
      { header: 'CUIT', key: 'cuit', width: 16 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Teléfono', key: 'telefono', width: 16 },
      { header: 'WhatsApp', key: 'whatsapp', width: 16 },
      { header: 'Dirección', key: 'direccion', width: 30 },
      { header: 'Localidad', key: 'localidad', width: 20 },
      { header: 'Provincia', key: 'provincia', width: 18 },
      { header: 'Cond. IVA', key: 'condicionIva', width: 22 },
      { header: 'Plazo Crédito', key: 'plazoCredito', width: 14 },
      { header: 'Lista de Precios', key: 'listaPrecio', width: 22 },
      { header: 'Activo', key: 'activo', width: 8 },
      { header: 'Creado', key: 'createdAt', width: 20 },
    ];
    applyHead(ws);
    const clientes = await prisma.cliente.findMany({ include: { listaPrecio: { select: { nombre: true } } }, orderBy: { razonSocial: 'asc' } });
    for (const c of clientes) {
      ws.addRow({ id: c.id, razonSocial: c.razonSocial, cuit: c.cuit ?? '', email: c.email ?? '', telefono: c.telefono ?? '', whatsapp: c.whatsapp ?? '', direccion: c.direccion ?? '', localidad: c.localidad ?? '', provincia: c.provincia ?? '', condicionIva: c.condicionIva, plazoCredito: c.plazoCredito, listaPrecio: c.listaPrecio?.nombre ?? '', activo: c.activo ? 'Sí' : 'No', createdAt: fmt(c.createdAt) });
    }
    ws.autoFilter = { from: 'A1', to: `N1` };
  }

  // ── 2. Productos ─────────────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet('Productos');
    ws.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Nombre', key: 'nombre', width: 32 },
      { header: 'Código Interno', key: 'codigo', width: 16 },
      { header: 'Descripción', key: 'descripcion', width: 36 },
      { header: 'Categoría', key: 'categoria', width: 20 },
      { header: 'Precio Base', key: 'precioBase', width: 14 },
      { header: 'Peso Kg', key: 'pesoKg', width: 10 },
      { header: 'Cajas/Pallet', key: 'cajasPorPallet', width: 12 },
      { header: 'Activo', key: 'activo', width: 8 },
    ];
    applyHead(ws);
    const productos = await prisma.producto.findMany({ include: { categoria: { select: { nombre: true } } }, orderBy: { nombre: 'asc' } });
    for (const p of productos) {
      ws.addRow({ id: p.id, nombre: p.nombre, codigo: p.codigoInterno ?? '', descripcion: p.descripcion ?? '', categoria: p.categoria?.nombre ?? '', precioBase: p.precioBase, pesoKg: p.pesoKg, cajasPorPallet: p.cajasPorPallet, activo: p.activo ? 'Sí' : 'No' });
    }
    ws.autoFilter = { from: 'A1', to: 'I1' };
  }

  // ── 3. Listas de Precios ──────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet('Listas de Precios');
    ws.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Nombre', key: 'nombre', width: 28 },
      { header: 'Descripción', key: 'descripcion', width: 40 },
      { header: 'Creado', key: 'createdAt', width: 20 },
    ];
    applyHead(ws);
    const listas = await prisma.listaPrecio.findMany({ orderBy: { nombre: 'asc' } });
    for (const l of listas) {
      ws.addRow({ id: l.id, nombre: l.nombre, descripcion: l.descripcion ?? '', createdAt: fmt(l.createdAt) });
    }
  }

  // ── 4. Precios por Lista ──────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet('Precios por Lista');
    ws.columns = [
      { header: 'Lista', key: 'lista', width: 24 },
      { header: 'Producto', key: 'producto', width: 32 },
      { header: 'Código', key: 'codigo', width: 14 },
      { header: 'Precio', key: 'precio', width: 14 },
    ];
    applyHead(ws);
    const precios = await prisma.precioProducto.findMany({ include: { listaPrecio: { select: { nombre: true } }, producto: { select: { nombre: true, codigoInterno: true } } }, orderBy: [{ listaPrecio: { nombre: 'asc' } }, { producto: { nombre: 'asc' } }] });
    for (const pp of precios) {
      ws.addRow({ lista: pp.listaPrecio.nombre, producto: pp.producto.nombre, codigo: pp.producto.codigoInterno ?? '', precio: pp.precio });
    }
    ws.autoFilter = { from: 'A1', to: 'D1' };
  }

  // ── 5. Pedidos ────────────────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet('Pedidos');
    ws.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Fecha', key: 'fecha', width: 20 },
      { header: 'Estado', key: 'estado', width: 16 },
      { header: 'Cliente', key: 'cliente', width: 30 },
      { header: 'Contacto', key: 'contacto', width: 22 },
      { header: 'Lista Precios', key: 'lista', width: 20 },
      { header: 'Subtotal', key: 'subtotal', width: 14 },
      { header: 'Descuento %', key: 'descuento', width: 12 },
      { header: 'IVA', key: 'iva', width: 14 },
      { header: 'Total', key: 'total', width: 14 },
      { header: 'Pallets', key: 'pallets', width: 10 },
      { header: 'WhatsApp', key: 'wa', width: 10 },
      { header: 'Notas', key: 'notas', width: 36 },
      { header: 'Fecha Facturado', key: 'fechaFacturado', width: 20 },
      { header: 'Pagado', key: 'pagado', width: 9 },
      { header: 'Fecha Pago', key: 'fechaPago', width: 20 },
      { header: 'Transportista', key: 'transportista', width: 18 },
      { header: 'Costo Transporte', key: 'transCosto', width: 16 },
      { header: 'Km', key: 'transKm', width: 10 },
      { header: 'Chofer', key: 'chofer', width: 18 },
      { header: 'Peso Real (kg)', key: 'pesoReal', width: 14 },
    ];
    applyHead(ws);
    const pedidos = await prisma.pedido.findMany({ include: { cliente: { select: { razonSocial: true } }, listaPrecio: { select: { nombre: true } } }, orderBy: { fecha: 'desc' } });
    for (const p of pedidos) {
      ws.addRow({ id: p.id, fecha: fmt(p.fecha), estado: p.estado, cliente: p.cliente?.razonSocial ?? '', contacto: p.nombreContacto ?? '', lista: p.listaPrecio?.nombre ?? '', subtotal: p.subtotal, descuento: p.descuento, iva: p.iva, total: p.total, pallets: p.totalPallets, wa: p.origenWhatsapp ? 'Sí' : 'No', notas: p.notas ?? '', fechaFacturado: fmt(p.fechaFacturado), pagado: p.pagado ? 'Sí' : 'No', fechaPago: fmt(p.fechaPago), transportista: p.transportista ?? '', transCosto: p.transporteCosto ?? '', transKm: p.transporteKm ?? '', chofer: p.chofer ?? '', pesoReal: p.pesoReal ?? '' });
    }
    ws.autoFilter = { from: 'A1', to: 'U1' };
  }

  // ── 6. Items de Pedidos ────────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet('Items de Pedidos');
    ws.columns = [
      { header: 'Pedido ID', key: 'pedidoId', width: 28 },
      { header: 'Fecha Pedido', key: 'fechaPedido', width: 20 },
      { header: 'Cliente', key: 'cliente', width: 28 },
      { header: 'Producto', key: 'producto', width: 30 },
      { header: 'Código', key: 'codigo', width: 14 },
      { header: 'Unidad', key: 'unidad', width: 10 },
      { header: 'Cantidad', key: 'cantidad', width: 10 },
      { header: 'Precio Unitario', key: 'precioUnitario', width: 16 },
      { header: 'Subtotal', key: 'subtotal', width: 14 },
    ];
    applyHead(ws);
    const items = await prisma.itemPedido.findMany({ include: { pedido: { include: { cliente: { select: { razonSocial: true } } } }, producto: { select: { nombre: true, codigoInterno: true } } }, orderBy: { pedido: { fecha: 'desc' } } });
    for (const i of items) {
      ws.addRow({ pedidoId: i.pedidoId, fechaPedido: fmt(i.pedido.fecha), cliente: i.pedido.cliente?.razonSocial ?? '', producto: i.producto.nombre, codigo: i.producto.codigoInterno ?? '', unidad: i.unidad, cantidad: i.cantidad, precioUnitario: i.precioUnitario, subtotal: i.subtotal });
    }
    ws.autoFilter = { from: 'A1', to: 'I1' };
  }

  // ── 7. Stock Actual ────────────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet('Stock');
    ws.columns = [
      { header: 'Producto', key: 'producto', width: 32 },
      { header: 'Código', key: 'codigo', width: 14 },
      { header: 'Categoría', key: 'categoria', width: 20 },
      { header: 'Stock Actual (cajas)', key: 'stock', width: 20 },
      { header: 'Actualizado', key: 'updatedAt', width: 20 },
    ];
    applyHead(ws);
    const stocks = await prisma.stock.findMany({ include: { producto: { include: { categoria: { select: { nombre: true } } } } }, orderBy: { producto: { nombre: 'asc' } } });
    for (const s of stocks) {
      ws.addRow({ producto: s.producto.nombre, codigo: s.producto.codigoInterno ?? '', categoria: s.producto.categoria?.nombre ?? '', stock: s.stockActual, updatedAt: fmt(s.updatedAt) });
    }
  }

  // ── 8. Movimientos de Stock ────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet('Movimientos Stock');
    ws.columns = [
      { header: 'Fecha', key: 'fecha', width: 20 },
      { header: 'Producto', key: 'producto', width: 30 },
      { header: 'Tipo', key: 'tipo', width: 18 },
      { header: 'Cantidad', key: 'cantidad', width: 12 },
      { header: 'Descripción', key: 'descripcion', width: 36 },
      { header: 'Pedido ID', key: 'pedidoId', width: 28 },
    ];
    applyHead(ws);
    const movs = await prisma.stockMovimiento.findMany({ include: { stock: { include: { producto: { select: { nombre: true } } } } }, orderBy: { createdAt: 'desc' } });
    for (const m of movs) {
      ws.addRow({ fecha: fmt(m.createdAt), producto: m.stock.producto.nombre, tipo: m.tipo, cantidad: m.cantidad, descripcion: m.descripcion ?? '', pedidoId: m.pedidoId ?? '' });
    }
    ws.autoFilter = { from: 'A1', to: 'F1' };
  }

  // ── 9. Comex ──────────────────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet('Comex');
    ws.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Fecha', key: 'fecha', width: 20 },
      { header: 'Tipo', key: 'tipo', width: 14 },
      { header: 'Descripción', key: 'descripcion', width: 36 },
      { header: 'Proveedor', key: 'proveedor', width: 24 },
      { header: 'Monto USD', key: 'montoUSD', width: 14 },
      { header: 'Cotización', key: 'cotizacion', width: 12 },
      { header: 'Monto ARS', key: 'montoUYU', width: 14 },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'Transportista', key: 'transportista', width: 18 },
      { header: 'Costo Trans.', key: 'transCosto', width: 14 },
      { header: 'Km', key: 'transKm', width: 10 },
      { header: 'Notas', key: 'notas', width: 36 },
    ];
    applyHead(ws);
    const ops = await prisma.comexOperacion.findMany({ orderBy: { fecha: 'desc' } });
    for (const o of ops) {
      ws.addRow({ id: o.id, fecha: fmt(o.fecha), tipo: o.tipo, descripcion: o.descripcion, proveedor: o.proveedor ?? '', montoUSD: o.montoUSD, cotizacion: o.cotizacion, montoUYU: o.montoUYU, estado: o.estado, transportista: o.transportista ?? '', transCosto: o.transporteCosto ?? '', transKm: o.transporteKm ?? '', notas: o.notas ?? '' });
    }
    ws.autoFilter = { from: 'A1', to: 'M1' };
  }

  // ── 10. Categorías ──────────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet('Categorías');
    ws.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Nombre', key: 'nombre', width: 28 },
      { header: 'Creado', key: 'createdAt', width: 20 },
    ];
    applyHead(ws);
    const cats = await prisma.categoria.findMany({ orderBy: { nombre: 'asc' } });
    for (const c of cats) {
      ws.addRow({ id: c.id, nombre: c.nombre, createdAt: fmt(c.createdAt) });
    }
  }

  const fechaHoy = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="backup-jugos-${fechaHoy}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}));
