/**
 * WhatsApp Chatbot API — Bigar S.A.
 *
 * Compatible con:
 *  - Twilio WhatsApp Sandbox: POST /api/whatsapp/webhook  (body: form-urlencoded, Body + From)
 *  - Meta Cloud API:          GET  /api/whatsapp/meta     (verificación hub)
 *                             POST /api/whatsapp/meta     (mensajes)
 *
 * Variables de entorno:
 *   WA_VERIFY_TOKEN   — token secreto para verificar webhook de Meta
 *   WA_TOKEN          — Bearer token de Meta Cloud API (para responder)
 *   WA_PHONE_ID       — Phone Number ID de Meta (para responder)
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export const whatsappRouter = Router();

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CarritoItem {
  productoId: string;
  nombre: string;
  cantidad: number;
  unidad: 'CAJA' | 'PALLET';
  precioUnitario: number;
  subtotal: number;
  cajasPorPallet: number;
}

type Estado =
  | 'INICIO'          // esperando nombre
  | 'ESPERANDO_WA'    // esperando número de whatsapp
  | 'VERIFICADO'      // cliente confirmado, mostrando categorías
  | 'EN_CATEGORIA'    // mostrando productos de una categoría
  | 'EN_CANTIDAD'     // esperando cantidad para un producto
  | 'EN_UNIDAD'       // esperando unidad (caja/pallet) — si tiene pallets
  | 'EN_CARRITO';     // carrito no vacío, opciones de acción

interface Session {
  estado: Estado;
  clienteId: string;
  clienteNombre: string;
  listaPrecioId: string | null;
  nombreIngresado: string;
  categorias: Array<{ id: string; nombre: string }>;
  productosCategoria: Array<{
    id: string;
    nombre: string;
    codigoInterno: string | null;
    precioBase: number;
    precioLista: number;
    cajasPorPallet: number;
  }>;
  productoSeleccionado: Session['productosCategoria'][0] | null;
  carrito: CarritoItem[];
  lastActivity: number;
}

// ─── Sesiones en memoria (TTL 45 min) ─────────────────────────────────────────

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 45 * 60 * 1000;

function getSession(phone: string): Session {
  const existing = sessions.get(phone);
  if (existing) {
    existing.lastActivity = Date.now();
    return existing;
  }
  const s: Session = {
    estado: 'INICIO',
    clienteId: '',
    clienteNombre: '',
    listaPrecioId: null,
    nombreIngresado: '',
    categorias: [],
    productosCategoria: [],
    productoSeleccionado: null,
    carrito: [],
    lastActivity: Date.now(),
  };
  sessions.set(phone, s);
  return s;
}

function resetSession(phone: string) {
  sessions.delete(phone);
}

// Limpieza periódica de sesiones vencidas
setInterval(() => {
  const now = Date.now();
  for (const [phone, s] of sessions.entries()) {
    if (now - s.lastActivity > SESSION_TTL_MS) sessions.delete(phone);
  }
}, 10 * 60 * 1000);

// ─── Helpers de texto ──────────────────────────────────────────────────────────

const formatMoney = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

const normalizePhone = (raw: string) => raw.replace(/\D/g, '');

function buildCategoriasMenu(session: Session): string {
  const lines = session.categorias.map((c, i) => `  ${i + 1}. ${c.nombre}`);
  return (
    `✅ Hola *${session.clienteNombre}*! Bienvenido/a al sistema de pedidos de *Bigar S.A.*\n\n` +
    `Seleccioná una *categoría* escribiendo su número:\n\n` +
    lines.join('\n') +
    `\n\n📋 Comandos útiles:\n  • *carrito* — ver lo que llevás\n  • *confirmar* — finalizar pedido\n  • *cancelar* — empezar de nuevo`
  );
}

function buildProductosMenu(session: Session, catNombre: string): string {
  const lines = session.productosCategoria.map((p, i) => {
    const precio = p.precioLista > 0 ? p.precioLista : p.precioBase;
    const cod = p.codigoInterno ? ` (${p.codigoInterno})` : '';
    return `  ${i + 1}. ${p.nombre}${cod} — ${formatMoney(precio)}/caja`;
  });
  return (
    `🍹 *${catNombre}*\n\n` +
    lines.join('\n') +
    `\n\n_Escribí el número del producto para agregarlo al carrito._\n` +
    `_O escribí *menu* para volver a las categorías._`
  );
}

function buildCarritoTexto(carrito: CarritoItem[]): string {
  if (carrito.length === 0) return '🛒 Tu carrito está vacío.';
  const lines = carrito.map((item, i) => {
    const unidStr = item.unidad === 'PALLET' ? `${item.cantidad} pallet(s)` : `${item.cantidad} caja(s)`;
    return `  ${i + 1}. ${item.nombre} — ${unidStr} — ${formatMoney(item.subtotal)}`;
  });
  const subtotal = carrito.reduce((s, i) => s + i.subtotal, 0);
  const iva = subtotal * 0.21;
  const total = subtotal + iva;
  return (
    `🛒 *Tu carrito:*\n\n` +
    lines.join('\n') +
    `\n\n  Subtotal:  ${formatMoney(subtotal)}\n` +
    `  IVA 21%:   ${formatMoney(iva)}\n` +
    `  *Total:    ${formatMoney(total)}*\n\n` +
    `Escribí *confirmar* para hacer el pedido o seguí eligiendo productos.`
  );
}

// ─── Lógica principal del bot ──────────────────────────────────────────────────

async function processMessage(phone: string, rawMsg: string): Promise<string> {
  const msg = rawMsg.trim();
  const msgLower = msg.toLowerCase();
  const session = getSession(phone);

  // Comandos globales (siempre disponibles)
  if (['cancelar', 'cancel', 'salir', 'exit'].includes(msgLower)) {
    resetSession(phone);
    return (
      `👋 Sesión cancelada. Para hacer un nuevo pedido escribí cualquier mensaje.\n\n` +
      `_Bigar S.A._`
    );
  }

  if (['carrito', 'ver carrito', 'mi carrito'].includes(msgLower)) {
    return buildCarritoTexto(session.carrito);
  }

  if (['menu', 'inicio', 'volver', 'categorias', 'categorías'].includes(msgLower) && session.estado !== 'INICIO' && session.estado !== 'ESPERANDO_WA') {
    session.estado = session.carrito.length > 0 ? 'EN_CARRITO' : 'VERIFICADO';
    return buildCategoriasMenu(session);
  }

  if (['confirmar', 'listo', 'ok', 'si', 'sí'].includes(msgLower) && session.carrito.length > 0 && session.estado !== 'INICIO' && session.estado !== 'ESPERANDO_WA') {
    return await confirmarPedido(phone, session);
  }

  // ── Estado INICIO: pedir nombre ──────────────────────────────────────────────
  if (session.estado === 'INICIO') {
    session.nombreIngresado = msg;
    session.estado = 'ESPERANDO_WA';
    return (
      `👋 Hola! Soy el asistente de pedidos de *Bigar S.A.*\n\n` +
      `Recibí tu nombre: *${msg}*\n\n` +
      `Ahora necesito verificar tu identidad. Por favor enviame tu *número de WhatsApp* registrado ` +
      `(con código de país, ej: 5493511234567):`
    );
  }

  // ── Estado ESPERANDO_WA: verificar cliente ────────────────────────────────────
  if (session.estado === 'ESPERANDO_WA') {
    const waNorm = normalizePhone(msg.length > 0 ? msg : phone);

    const clientes = await prisma.cliente.findMany({
      where: { activo: true },
      select: { id: true, razonSocial: true, whatsapp: true, listaPrecioId: true },
    });

    const nombre = session.nombreIngresado;
    const match = clientes.find(c => {
      const nameLow = c.razonSocial.toLowerCase();
      const namingMatch =
        nameLow.includes(nombre.toLowerCase()) ||
        nombre.toLowerCase().includes(nameLow);
      const waCli = (c.whatsapp ?? '').replace(/\D/g, '');
      const waMatch =
        waCli.length > 0 &&
        (waCli === waNorm || waCli.endsWith(waNorm) || waNorm.endsWith(waCli));
      return namingMatch && waMatch;
    });

    if (!match) {
      // dar una segunda oportunidad
      session.estado = 'INICIO';
      sessions.delete(phone);
      return (
        `❌ No encontramos ningún cliente con ese nombre y número de WhatsApp.\n\n` +
        `Verificá que el nombre y número estén registrados en nuestro sistema, ` +
        `o contactá a ventas. Cuando quieras intentar de nuevo, escribí cualquier mensaje.`
      );
    }

    // Cliente verificado — cargar categorías
    session.clienteId = match.id;
    session.clienteNombre = match.razonSocial;
    session.listaPrecioId = match.listaPrecioId;

    const categorias = await prisma.categoria.findMany({
      where: { productos: { some: { activo: true } } },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    });
    session.categorias = categorias;
    session.estado = 'VERIFICADO';

    return buildCategoriasMenu(session);
  }

  // ── Estado VERIFICADO: elegir categoría ──────────────────────────────────────
  if (session.estado === 'VERIFICADO' || session.estado === 'EN_CARRITO') {
    const idx = parseInt(msg) - 1;
    if (isNaN(idx) || idx < 0 || idx >= session.categorias.length) {
      return (
        `Por favor elegí una categoría escribiendo su número (1 a ${session.categorias.length}).\n\n` +
        session.categorias.map((c, i) => `  ${i + 1}. ${c.nombre}`).join('\n')
      );
    }
    const cat = session.categorias[idx];

    // Cargar productos de esa categoría con precios
    const productos = await prisma.producto.findMany({
      where: { activo: true, categoriaId: cat.id },
      include: {
        precios: { where: session.listaPrecioId ? { listaPrecioId: session.listaPrecioId } : undefined },
      },
      orderBy: { nombre: 'asc' },
    });

    session.productosCategoria = productos.map(p => ({
      id: p.id,
      nombre: p.nombre,
      codigoInterno: p.codigoInterno,
      precioBase: p.precioBase,
      precioLista: p.precios[0]?.precio ?? 0,
      cajasPorPallet: p.cajasPorPallet ?? 1,
    }));

    if (session.productosCategoria.length === 0) {
      return `No hay productos disponibles en esa categoría. Elegí otra:`;
    }

    session.estado = 'EN_CATEGORIA';
    return buildProductosMenu(session, cat.nombre);
  }

  // ── Estado EN_CATEGORIA: elegir producto ──────────────────────────────────────
  if (session.estado === 'EN_CATEGORIA') {
    const idx = parseInt(msg) - 1;
    if (isNaN(idx) || idx < 0 || idx >= session.productosCategoria.length) {
      return (
        `Escribí el número del producto que querés agregar (1 a ${session.productosCategoria.length}).`
      );
    }
    session.productoSeleccionado = session.productosCategoria[idx];
    const precio = session.productoSeleccionado.precioLista > 0
      ? session.productoSeleccionado.precioLista
      : session.productoSeleccionado.precioBase;

    // Si tiene pallets, preguntar unidad primero
    if (session.productoSeleccionado.cajasPorPallet > 1) {
      session.estado = 'EN_UNIDAD';
      return (
        `🍹 *${session.productoSeleccionado.nombre}*\n` +
        `Precio: ${formatMoney(precio)}/caja | ${session.productoSeleccionado.cajasPorPallet} cajas/pallet\n\n` +
        `¿En qué unidad querés pedir?\n  1. Cajas\n  2. Pallets`
      );
    }

    session.estado = 'EN_CANTIDAD';
    return (
      `🍹 *${session.productoSeleccionado.nombre}*\n` +
      `Precio: ${formatMoney(precio)}/caja\n\n` +
      `¿Cuántas *cajas* querés?`
    );
  }

  // ── Estado EN_UNIDAD: elegir caja/pallet ──────────────────────────────────────
  if (session.estado === 'EN_UNIDAD') {
    const prod = session.productoSeleccionado!;
    let unidad: 'CAJA' | 'PALLET';

    if (['1', 'caja', 'cajas'].includes(msgLower)) {
      unidad = 'CAJA';
    } else if (['2', 'pallet', 'pallets', 'palet', 'palets'].includes(msgLower)) {
      unidad = 'PALLET';
    } else {
      return `Escribí *1* para Cajas o *2* para Pallets.`;
    }

    // Guardar temporalmente la unidad en el producto seleccionado (truco: extendemos el objeto)
    (prod as any)._unidadTmp = unidad;
    session.estado = 'EN_CANTIDAD';
    const label = unidad === 'CAJA' ? 'cajas' : 'pallets';
    return `¿Cuántos/as *${label}* querés agregar?`;
  }

  // ── Estado EN_CANTIDAD: ingresar cantidad ──────────────────────────────────────
  if (session.estado === 'EN_CANTIDAD') {
    const cantidad = parseInt(msg);
    if (isNaN(cantidad) || cantidad <= 0) {
      return `Por favor ingresá una cantidad válida (número entero positivo).`;
    }

    const prod = session.productoSeleccionado!;
    const unidad: 'CAJA' | 'PALLET' = (prod as any)._unidadTmp ?? 'CAJA';
    const precio = prod.precioLista > 0 ? prod.precioLista : prod.precioBase;
    const cajas = unidad === 'PALLET' ? cantidad * prod.cajasPorPallet : cantidad;
    const subtotal = parseFloat((cajas * precio).toFixed(2));

    // Agregar o actualizar en carrito
    const existIdx = session.carrito.findIndex(i => i.productoId === prod.id && i.unidad === unidad);
    if (existIdx >= 0) {
      session.carrito[existIdx].cantidad += cantidad;
      session.carrito[existIdx].subtotal = parseFloat(
        ((session.carrito[existIdx].cantidad * (unidad === 'PALLET' ? prod.cajasPorPallet : 1)) * precio).toFixed(2)
      );
    } else {
      session.carrito.push({
        productoId: prod.id,
        nombre: prod.nombre,
        cantidad,
        unidad,
        precioUnitario: precio,
        subtotal,
        cajasPorPallet: prod.cajasPorPallet,
      });
    }

    session.productoSeleccionado = null;
    session.estado = 'EN_CARRITO';

    const unidStr = unidad === 'PALLET' ? `${cantidad} pallet(s)` : `${cantidad} caja(s)`;
    return (
      `✅ Agregado: *${prod.nombre}* — ${unidStr} — ${formatMoney(subtotal)}\n\n` +
      buildCarritoTexto(session.carrito) +
      `\n\nEscribí un número para elegir categoría y seguir agregando, o *confirmar* para finalizar.`
    );
  }

  // ── Fallback ──────────────────────────────────────────────────────────────────
  if (session.estado === 'VERIFICADO' || session.estado === 'EN_CARRITO') {
    return buildCategoriasMenu(session);
  }

  return (
    `No entendí tu mensaje. Escribí *menu* para ver las categorías, ` +
    `*carrito* para ver tu pedido, o *confirmar* para finalizar.`
  );
}

// ─── Confirmar pedido ──────────────────────────────────────────────────────────

async function confirmarPedido(phone: string, session: Session): Promise<string> {
  const { clienteId, listaPrecioId, carrito, clienteNombre } = session;

  if (carrito.length === 0) return '🛒 Tu carrito está vacío. Agregá productos primero.';

  const subtotal = parseFloat(carrito.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
  const iva = parseFloat((subtotal * 0.21).toFixed(2));
  const total = parseFloat((subtotal + iva).toFixed(2));
  const totalPallets = parseFloat(
    carrito.reduce((s, i) => {
      const cajas = i.unidad === 'PALLET' ? i.cantidad * i.cajasPorPallet : i.cantidad;
      return s + cajas / i.cajasPorPallet;
    }, 0).toFixed(3)
  );

  try {
    const pedido = await prisma.pedido.create({
      data: {
        clienteId: clienteId!,
        listaPrecioId: listaPrecioId || null,
        subtotal,
        iva,
        total,
        descuento: 0,
        totalPallets,
        origenWhatsapp: true,
        nombreContacto: clienteNombre,
        notas: `Pedido por WhatsApp desde ${phone}`,
        estado: 'BORRADOR',
        pagado: false,
        items: {
          create: carrito.map(i => ({
            productoId: i.productoId,
            cantidad: i.cantidad,
            unidad: i.unidad,
            precioUnitario: i.precioUnitario,
            subtotal: i.subtotal,
          })),
        },
      },
    });

    resetSession(phone);

    const resumen = carrito
      .map(i => {
        const unidStr = i.unidad === 'PALLET' ? `${i.cantidad} pallet(s)` : `${i.cantidad} caja(s)`;
        return `  • ${i.nombre} — ${unidStr}`;
      })
      .join('\n');

    return (
      `🎉 *¡Pedido confirmado!*\n\n` +
      `📋 Ref: #${pedido.id.slice(-6).toUpperCase()}\n\n` +
      resumen +
      `\n\n  Subtotal:  ${formatMoney(subtotal)}\n` +
      `  IVA 21%:   ${formatMoney(iva)}\n` +
      `  *Total:    ${formatMoney(total)}*\n\n` +
      `✅ Tu pedido fue recibido y será procesado por nuestro equipo.\n` +
      `¡Gracias por comprar en *Bigar S.A.*! 🍹`
    );
  } catch (err) {
    console.error('[WhatsApp] Error al crear pedido:', err);
    return `❌ Hubo un error al procesar tu pedido. Por favor contactá a ventas directamente.`;
  }
}

// ─── Twilio Webhook — POST /api/whatsapp/webhook ─────────────────────────────

whatsappRouter.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body: string = req.body?.Body ?? '';
    const from: string = req.body?.From ?? '';
    // Twilio from: "whatsapp:+5493511234567"
    const phone = normalizePhone(from.replace('whatsapp:', ''));

    if (!phone || !body) {
      res.set('Content-Type', 'text/xml');
      return res.send('<Response></Response>');
    }

    const reply = await processMessage(phone, body);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${reply.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message></Response>`;
    res.set('Content-Type', 'text/xml');
    res.send(twiml);
  } catch (err) {
    console.error('[WhatsApp Twilio]', err);
    res.set('Content-Type', 'text/xml');
    res.send('<Response><Message>Error interno. Intentá de nuevo.</Message></Response>');
  }
});

// ─── Meta Cloud API Webhook — GET /api/whatsapp/meta (verificación) ───────────

whatsappRouter.get('/meta', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.WA_VERIFY_TOKEN ?? 'jugos_verify_token';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp Meta] Webhook verificado');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ─── Meta Cloud API Webhook — POST /api/whatsapp/meta (mensajes) ──────────────

whatsappRouter.post('/meta', async (req: Request, res: Response) => {
  // Siempre responder 200 rápido a Meta
  res.sendStatus(200);

  try {
    const body = req.body;
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) return;

    const message = messages[0];
    if (message.type !== 'text') return; // solo texto por ahora

    const from: string = message.from; // número con código de país, ej: "5493511234567"
    const text: string = message.text?.body ?? '';

    if (!from || !text) return;

    const phone = normalizePhone(from);
    const reply = await processMessage(phone, text);

    // Enviar respuesta via Meta Graph API
    await sendMetaMessage(from, reply);
  } catch (err) {
    console.error('[WhatsApp Meta]', err);
  }
});

async function sendMetaMessage(to: string, text: string) {
  const token = process.env.WA_TOKEN;
  const phoneId = process.env.WA_PHONE_ID;

  if (!token || !phoneId) {
    console.warn('[WhatsApp Meta] WA_TOKEN o WA_PHONE_ID no configurados — respuesta no enviada');
    return;
  }

  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error('[WhatsApp Meta] Error al enviar mensaje:', err);
    }
  } catch (err) {
    console.error('[WhatsApp Meta] fetch error:', err);
  }
}

// ─── Estado de sesiones (debug) — GET /api/whatsapp/sessions ─────────────────

whatsappRouter.get('/sessions', (_req: Request, res: Response) => {
  const list = Array.from(sessions.entries()).map(([phone, s]) => ({
    phone,
    estado: s.estado,
    cliente: s.clienteNombre,
    carritoItems: s.carrito.length,
    lastActivity: new Date(s.lastActivity).toISOString(),
  }));
  res.json(list);
});
