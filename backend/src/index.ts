import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import { authRouter } from './routes/auth';
import { clientesRouter } from './routes/clientes';
import { productosRouter } from './routes/productos';
import { pedidosRouter } from './routes/pedidos';
import { preciosRouter } from './routes/precios';
import { reportesRouter } from './routes/reportes';
import { dashboardRouter } from './routes/dashboard';
import { deudoresRouter } from './routes/deudores';
import { comexRouter } from './routes/comex';
import { stockRouter } from './routes/stock';
import { transporteRouter } from './routes/transporte';
import { pedidoPublicoRouter } from './routes/pedidoPublico';
import { whatsappRouter } from './routes/whatsapp';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './utils/prisma';
import {
  ADMIN_EMAIL, VENDEDOR_EMAIL, VENDEDOR_PASSWORD,
  CATEGORIAS_INICIALES, LISTAS_INICIALES, PRODUCTOS_INICIALES,
} from './config';

dotenv.config();

async function seedDefaultUsers() {
  const hashAdmin = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: { email: ADMIN_EMAIL, password: hashAdmin, nombre: 'Administrador', rol: 'ADMIN' },
  });
  const hashVendedor = await bcrypt.hash(VENDEDOR_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: VENDEDOR_EMAIL },
    update: {},
    create: { email: VENDEDOR_EMAIL, password: hashVendedor, nombre: 'Vendedor', rol: 'VENDEDOR' },
  });
}

// Catálogo inicial: solo crea lo que falta, nunca modifica lo que cargó el admin
async function seedCatalogo() {
  for (const nombre of CATEGORIAS_INICIALES) {
    await prisma.categoria.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }
  for (const nombre of LISTAS_INICIALES) {
    await prisma.listaPrecio.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }
  for (const p of PRODUCTOS_INICIALES) {
    const existe = await prisma.producto.findFirst({ where: { nombre: p.nombre } });
    if (existe) continue;
    const categoria = await prisma.categoria.findUnique({ where: { nombre: p.categoria } });
    await prisma.producto.create({
      data: { nombre: p.nombre, categoriaId: categoria?.id, esPallet: p.esPallet ?? false },
    });
  }
}

async function seed() {
  try {
    await seedDefaultUsers();
    await seedCatalogo();
  } catch (e) {
    console.error('Seed error:', e);
  }
}

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors({
  origin: isProduction
    ? (process.env.FRONTEND_URL || true)
    : 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Public routes (no auth)
app.use('/api/pedido-publico', pedidoPublicoRouter);
app.use('/api/publico', pedidoPublicoRouter); // alias usado por el frontend
app.use('/api/whatsapp', whatsappRouter);

// Protected routes
app.use('/api/auth', authRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/productos', productosRouter);
app.use('/api/pedidos', pedidosRouter);
app.use('/api/precios', preciosRouter);
app.use('/api/reportes', reportesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/deudores', deudoresRouter);
app.use('/api/comex', comexRouter);
app.use('/api/stock', stockRouter);
app.use('/api/transporte', transporteRouter);

// Categorías shortcut
app.use('/api/categorias', (req, res, next) => {
  req.url = '/categorias/lista';
  productosRouter(req, res, next);
});

if (isProduction) {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));
  app.get('*', (_req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
}

app.use(errorHandler);

seed().then(() => {
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Servidor en http://0.0.0.0:${PORT}`);
  });
});
