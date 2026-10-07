import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import https from 'https';

export const comexRouter = Router();
comexRouter.use(authenticate);

// Cotización USD/ARS desde API pública
comexRouter.get('/cotizacion', asyncHandler(async (_req, res) => {
  try {
    const data = await new Promise<any>((resolve, reject) => {
      const req = https.get('https://open.er-api.com/v6/latest/USD', (r) => {
        let body = '';
        r.on('data', c => body += c);
        r.on('end', () => {
          try { resolve(JSON.parse(body)); } catch { reject(new Error('Parse error')); }
        });
      });
      req.on('error', reject);
      req.setTimeout(5000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
    const ars = data?.rates?.ARS;
    if (!ars) throw new Error('No data');
    res.json({
      source: 'open.er-api.com',
      fecha: new Date().toISOString(),
      USD_ARS: parseFloat(ars.toFixed(4)),
      ARS_USD: parseFloat((1 / ars).toFixed(6)),
    });
  } catch {
    // Fallback con valor referencial
    res.json({
      source: 'fallback',
      fecha: new Date().toISOString(),
      USD_ARS: 1400,
      ARS_USD: 0.000714,
      nota: 'Cotización referencial - verificar conectividad',
    });
  }
}));

// Noticias de comercio internacional (RSS feed)
comexRouter.get('/noticias', asyncHandler(async (_req, res) => {
  // Mock de noticias con fuentes reales sugeridas
  const noticias = [
    { id: 1, titulo: 'ALADI publica nuevo informe de comercio regional', fuente: 'aladi.org', fecha: new Date(Date.now() - 86400000).toISOString(), url: 'https://www.aladi.org', categoria: 'Regulatorio' },
    { id: 2, titulo: 'BCRA publica tipo de cambio de referencia', fuente: 'bcra.gob.ar', fecha: new Date(Date.now() - 172800000).toISOString(), url: 'https://www.bcra.gob.ar', categoria: 'Tipo de cambio' },
    { id: 3, titulo: 'Nuevas medidas fitosanitarias para exportaciones alimentarias', fuente: 'senasa.gob.ar', fecha: new Date(Date.now() - 259200000).toISOString(), url: 'https://www.argentina.gob.ar/senasa', categoria: 'Regulatorio' },
    { id: 4, titulo: 'Exportaciones argentinas de jugos de frutas: panorama del sector', fuente: 'argentina.gob.ar', fecha: new Date(Date.now() - 345600000).toISOString(), url: 'https://www.argentina.gob.ar', categoria: 'Mercados' },
    { id: 5, titulo: 'Acuerdo MERCOSUR-UE: actualización de cronograma de desgravación', fuente: 'cancilleria.gob.ar', fecha: new Date(Date.now() - 432000000).toISOString(), url: 'https://www.cancilleria.gob.ar', categoria: 'Acuerdos comerciales' },
  ];
  const prediccion = {
    horizonte: '30 días',
    tendencia: 'ESTABLE',
    confianza: 72,
    factores: [
      'Dólar con presión alcista por contexto regional',
      'Demanda de jugos estable en mercados del Cono Sur',
      'Sin cambios arancelarios previstos en próximas semanas',
    ],
    recomendacion: 'Mantener contratos en USD. Considerar cobertura cambiaria para operaciones de largo plazo.',
  };
  res.json({ noticias, prediccion });
}));

// CRUD Operaciones
comexRouter.get('/operaciones', asyncHandler(async (_req, res) => {
  const ops = await prisma.comexOperacion.findMany({
    include: { documentos: true },
    orderBy: { fecha: 'desc' },
  });
  res.json(ops);
}));

comexRouter.get('/operaciones/:id', asyncHandler(async (req, res) => {
  const op = await prisma.comexOperacion.findUnique({
    where: { id: req.params.id },
    include: { documentos: true },
  });
  if (!op) return res.status(404).json({ error: 'Operación no encontrada' });
  res.json(op);
}));

comexRouter.post('/operaciones', asyncHandler(async (req, res) => {
  const { fecha, tipo, descripcion, proveedor, montoUSD, cotizacion, estado, notas, transportista, transporteCosto, transporteKm } = req.body;
  if (!descripcion || !montoUSD) return res.status(400).json({ error: 'descripcion y montoUSD requeridos' });
  const mUSD = Number(montoUSD);
  const cot = Number(cotizacion) || 0;
  const op = await prisma.comexOperacion.create({
    data: {
      fecha: fecha ? new Date(fecha) : new Date(),
      tipo: tipo || 'IMPORTACION',
      descripcion,
      proveedor,
      montoUSD: mUSD,
      cotizacion: cot,
      montoUYU: parseFloat((mUSD * cot).toFixed(2)),
      estado: estado || 'EN_PROCESO',
      notas,
      transportista: transportista || null,
      transporteCosto: transporteCosto != null ? Number(transporteCosto) : null,
      transporteKm: transporteKm != null ? Number(transporteKm) : null,
    },
    include: { documentos: true },
  });
  res.status(201).json(op);
}));

comexRouter.put('/operaciones/:id', asyncHandler(async (req, res) => {
  const { fecha, tipo, descripcion, proveedor, montoUSD, cotizacion, estado, notas, transportista, transporteCosto, transporteKm } = req.body;
  const mUSD = Number(montoUSD);
  const cot = Number(cotizacion) || 0;
  const op = await prisma.comexOperacion.update({
    where: { id: req.params.id },
    data: {
      ...(fecha && { fecha: new Date(fecha) }),
      ...(tipo && { tipo }),
      ...(descripcion && { descripcion }),
      proveedor,
      montoUSD: mUSD,
      cotizacion: cot,
      montoUYU: parseFloat((mUSD * cot).toFixed(2)),
      ...(estado && { estado }),
      notas,
      transportista: transportista || null,
      transporteCosto: transporteCosto != null ? Number(transporteCosto) : null,
      transporteKm: transporteKm != null ? Number(transporteKm) : null,
    },
    include: { documentos: true },
  });
  res.json(op);
}));

comexRouter.delete('/operaciones/:id', asyncHandler(async (req, res) => {
  await prisma.comexOperacion.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// Documentos
comexRouter.post('/operaciones/:id/documentos', asyncHandler(async (req, res) => {
  const { tipo, nombre, notas } = req.body;
  if (!tipo || !nombre) return res.status(400).json({ error: 'tipo y nombre requeridos' });
  const doc = await prisma.comexDocumento.create({
    data: { operacionId: req.params.id, tipo, nombre, notas },
  });
  res.status(201).json(doc);
}));

comexRouter.delete('/operaciones/:opId/documentos/:docId', asyncHandler(async (req, res) => {
  await prisma.comexDocumento.delete({ where: { id: req.params.docId } });
  res.json({ ok: true });
}));
