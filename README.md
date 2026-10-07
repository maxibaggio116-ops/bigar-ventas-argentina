# Bigar S.A. — Gestión de Ventas

App web de gestión de ventas (jugos, Argentina).

- **Backend:** Node.js + Express + TypeScript + Prisma + PostgreSQL (`backend/`)
- **Frontend:** React + Vite + TypeScript + TailwindCSS (`frontend/`)
- **Deploy:** Railway (nixpacks, monorepo, ver `railway.toml`). En producción el backend sirve `frontend/dist`.
- **Health check:** `GET /health` → `{ "status": "ok" }`

## Datos iniciales

Se crean solos en cada arranque (`seed()` en `backend/src/index.ts`). Solo crea lo que falta y nunca pisa lo que cargó el admin.
Para cambiarlos, editá `backend/src/config.ts`.

| Usuario | Contraseña | Rol |
|---|---|---|
| admin@bigar.com.ar | admin123 | ADMIN |
| vendedor@bigar.com.ar | vendedor123 (o `VENDEDOR_PASSWORD`) | VENDEDOR |

- Categorías: Jugos, Bebidas, Logística
- Listas de precios: Lista A, Lista B, Lista C
- Productos: 10 jugos (Naranja, Manzana, Durazno, Pera, Multifruta en 1L y 2L), 2 aguas saborizadas y "Pallets Arlog" (esPallet).
  Precios base y pesos los carga el admin desde la app.
- No se precargan clientes.

Cambiá las contraseñas por defecto después del primer ingreso.

## Configuración Argentina

- IVA 21% (`IVA_TASA` en `backend/src/config.ts`; también en las páginas de pedido del frontend).
- Moneda ARS, formato `es-AR`. Comex cotiza USD→ARS. El campo `montoUYU` del schema se mantiene por compatibilidad y guarda el equivalente en **pesos argentinos**.
- Kilometraje de fletes: cargá las localidades habituales en `frontend/src/utils/distancias.ts` para que se complete solo.
- Número de WhatsApp de la empresa: `WHATSAPP_EMPRESA` en `frontend/src/pages/public/PedidoWhatsAppPage.tsx`.

## Desarrollo local

Requiere PostgreSQL. Copiá `backend/.env.example` a `backend/.env` y completá `DATABASE_URL` y `JWT_SECRET`.

```bash
cd backend && npm install && npx prisma db push && npm run dev
cd frontend && npm install && npm run dev
```

Frontend en http://localhost:5173 (proxy `/api` → http://localhost:3001).

## Deploy en Railway

1. Subí este repo a GitHub.
2. En Railway: nuevo proyecto → **Deploy from GitHub repo**.
3. Agregá el plugin **PostgreSQL**.
4. En el servicio de la app, variables:
   - `DATABASE_URL` = `${{ Postgres.DATABASE_URL }}`
   - `JWT_SECRET` = una cadena larga y aleatoria (**obligatoria**, sin ella no funciona el login)
   - `NODE_ENV` = `production`
   - Opcional: `VENDEDOR_PASSWORD`, `EMPRESA_DOMINIO`
5. El `startCommand` corre `prisma db push` y después levanta el servidor, que crea usuarios y catálogo inicial.
6. Health check path: `/health`.

Fechas de Excel tipo número: `new Date((serial - 25569) * 86400000)`.
