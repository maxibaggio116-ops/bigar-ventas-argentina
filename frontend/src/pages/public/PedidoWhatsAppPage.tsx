import { useEffect, useState } from 'react';
import { Droplets, Plus, Minus, Trash2, ShoppingCart, Send, CheckCircle, ArrowRight, ArrowLeft, Lock } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

interface ProductoPublico {
  id: string;
  nombre: string;
  codigoInterno?: string;
  precioBase: number;
  cajasPorPallet: number;
  categoria?: { nombre: string };
  precios?: { listaPrecioId: string; precio: number }[];
}

interface ItemCarrito {
  producto: ProductoPublico;
  cantidad: number;
  unidad: 'CAJA' | 'PALLET';
}

interface ClienteVerificado {
  id: string;
  razonSocial: string;
  listaPrecioId?: string | null;
}

const API = '/api/publico';
const WHATSAPP_EMPRESA = '5490000000000';

type Step = 'login' | 'productos' | 'resumen';

export function PedidoWhatsAppPage() {
  // Login
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [errorLogin, setErrorLogin] = useState('');
  const [cliente, setCliente] = useState<ClienteVerificado | null>(null);

  // Catálogo
  const [productos, setProductos] = useState<ProductoPublico[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Carrito
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [notas, setNotas] = useState('');

  // UI
  const [step, setStep] = useState<Step>('login');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    fetch(`${API}/catalogo`)
      .then(r => r.json())
      .then(d => {
        const prods: ProductoPublico[] = d.productos || [];
        setProductos(prods);
        const cats = [...new Set(prods.map(p => p.categoria?.nombre ?? 'General'))].sort();
        setCategorias(cats);
        if (cats.length > 0) setCategoriaActiva(cats[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function getPrecio(prod: ProductoPublico): number {
    if (cliente?.listaPrecioId) {
      const pp = prod.precios?.find(p => p.listaPrecioId === cliente.listaPrecioId);
      if (pp) return pp.precio;
    }
    return prod.precioBase;
  }

  async function verificarCliente() {
    if (!nombre.trim() || !whatsapp.trim()) {
      setErrorLogin('Ingresá tu nombre y número de WhatsApp.');
      return;
    }
    setErrorLogin('');
    setVerificando(true);
    try {
      const r = await fetch(`${API}/verificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), whatsapp: whatsapp.trim() }),
      });
      const data = await r.json();
      if (!r.ok) { setErrorLogin(data.error || 'No se pudo verificar'); return; }
      setCliente(data.cliente);
      setStep('productos');
    } catch {
      setErrorLogin('Error de conexión. Intentá de nuevo.');
    } finally { setVerificando(false); }
  }

  function getCantidad(prodId: string): number {
    return carrito.find(i => i.producto.id === prodId)?.cantidad ?? 0;
  }

  function getUnidad(prodId: string): 'CAJA' | 'PALLET' {
    return carrito.find(i => i.producto.id === prodId)?.unidad ?? 'CAJA';
  }

  function cambiarCantidad(prod: ProductoPublico, delta: number, unidad?: 'CAJA' | 'PALLET') {
    setCarrito(prev => {
      const exist = prev.find(i => i.producto.id === prod.id);
      const u = unidad ?? exist?.unidad ?? 'CAJA';
      const nueva = (exist?.cantidad ?? 0) + delta;
      if (nueva <= 0) return prev.filter(i => i.producto.id !== prod.id);
      if (exist) return prev.map(i => i.producto.id === prod.id ? { ...i, cantidad: nueva, unidad: u } : i);
      return [...prev, { producto: prod, cantidad: nueva, unidad: u }];
    });
  }

  function setUnidad(prodId: string, unidad: 'CAJA' | 'PALLET') {
    setCarrito(prev => prev.map(i => i.producto.id === prodId ? { ...i, unidad } : i));
  }

  function quitarItem(prodId: string) {
    setCarrito(prev => prev.filter(i => i.producto.id !== prodId));
  }

  const subtotal = carrito.reduce((acc, item) => {
    const precio = getPrecio(item.producto);
    const cajas = item.unidad === 'PALLET' ? item.cantidad * item.producto.cajasPorPallet : item.cantidad;
    return acc + cajas * precio;
  }, 0);
  const iva = subtotal * 0.21;
  const total = subtotal + iva;

  const prodsCat = productos.filter(p => (p.categoria?.nombre ?? 'General') === categoriaActiva);

  function generarMensaje(): string {
    const lineas = [
      `🛒 *PEDIDO — Bigar S.A.*`,
      ``,
      `*Cliente:* ${cliente?.razonSocial}`,
      ``,
      `*PRODUCTOS:*`,
      ...carrito.map(item => {
        const precio = getPrecio(item.producto);
        const cajas = item.unidad === 'PALLET' ? item.cantidad * item.producto.cajasPorPallet : item.cantidad;
        return `• ${item.producto.nombre}: ${item.cantidad} ${item.unidad}(s) — ${formatCurrency(cajas * precio)}`;
      }),
      ``,
      `Subtotal: ${formatCurrency(subtotal)}`,
      `IVA (21%): ${formatCurrency(iva)}`,
      `*TOTAL: ${formatCurrency(total)}*`,
      ...(notas ? [``, `📝 Notas: ${notas}`] : []),
    ];
    return lineas.join('\n');
  }

  async function enviarPedido() {
    if (!cliente || carrito.length === 0) return;
    setEnviando(true);
    try {
      await fetch(`${API}/pedido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreContacto: cliente.razonSocial,
          clienteId: cliente.id,
          listaPrecioId: cliente.listaPrecioId,
          notas: notas || undefined,
          items: carrito.map(i => ({ productoId: i.producto.id, cantidad: i.cantidad, unidad: i.unidad })),
        }),
      });
      const msg = encodeURIComponent(generarMensaje());
      window.open(`https://wa.me/${WHATSAPP_EMPRESA}?text=${msg}`, '_blank');
      setEnviado(true);
    } catch (e) { console.error(e); }
    finally { setEnviando(false); }
  }

  // ── ENVIADO ──
  if (enviado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Pedido enviado!</h1>
          <p className="text-gray-500 text-sm mb-6">Se abrió WhatsApp para confirmar con el equipo de ventas.</p>
          <button onClick={() => { setEnviado(false); setCarrito([]); setStep('productos'); setNotas(''); }}
            className="btn-primary w-full">Hacer otro pedido</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      {/* Header */}
      <div className="bg-primary text-white px-4 py-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-9 h-9 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
            <Droplets className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm leading-tight">Bigar S.A.</p>
            {cliente ? (
              <p className="text-xs text-green-200">Hola, {cliente.razonSocial} 👋</p>
            ) : (
              <p className="text-xs text-green-200">Pedidos en línea</p>
            )}
          </div>
          {carrito.length > 0 && step === 'productos' && (
            <button onClick={() => setStep('resumen')}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 rounded-xl px-3 py-1.5 transition-colors">
              <ShoppingCart className="w-4 h-4" />
              <span className="text-sm font-bold">{carrito.length}</span>
            </button>
          )}
        </div>
      </div>

      {/* Indicador de pasos */}
      <div className="max-w-lg mx-auto px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          {(['login', 'productos', 'resumen'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                step === s ? 'bg-primary text-white' :
                (['login', 'productos', 'resumen'].indexOf(step) > i) ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400')}>
                {(['login', 'productos', 'resumen'].indexOf(step) > i) ? '✓' : i + 1}
              </div>
              <span className={clsx('text-xs font-medium', step === s ? 'text-primary' : 'text-gray-400')}>
                {s === 'login' ? 'Verificación' : s === 'productos' ? 'Productos' : 'Confirmar'}
              </span>
              {i < 2 && <div className="flex-1 h-px bg-gray-200" />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4 pb-24">

        {/* ── STEP LOGIN ── */}
        {step === 'login' && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Lock className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Identificate</h2>
              <p className="text-sm text-gray-500 mt-1">Ingresá tu nombre y número de WhatsApp para continuar.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre o Razón Social</label>
                <input
                  className="input text-base"
                  placeholder="Ej: Supermercado Pérez"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && verificarCliente()}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tu número de WhatsApp</label>
                <input
                  className="input text-base"
                  placeholder="Ej: 099123456"
                  type="tel"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && verificarCliente()}
                />
                <p className="text-xs text-gray-400 mt-1">Debe coincidir con el número cargado en el sistema.</p>
              </div>

              {errorLogin && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                  {errorLogin}
                </div>
              )}

              <button
                onClick={verificarCliente}
                disabled={verificando || !nombre.trim() || !whatsapp.trim()}
                className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {verificando ? 'Verificando...' : (<>Continuar <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP PRODUCTOS ── */}
        {step === 'productos' && (
          <>
            {/* Categorías */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {categorias.map(cat => (
                <button key={cat} onClick={() => setCategoriaActiva(cat)}
                  className={clsx('flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all',
                    categoriaActiva === cat ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-primary/40')}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Productos de la categoría */}
            {loading ? (
              <div className="text-center py-8"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : (
              <div className="space-y-3">
                {prodsCat.map(prod => {
                  const cant = getCantidad(prod.id);
                  const unidad = getUnidad(prod.id);
                  const precio = getPrecio(prod);
                  const cajas = unidad === 'PALLET' ? cant * prod.cajasPorPallet : cant;
                  return (
                    <div key={prod.id} className={clsx('bg-white rounded-2xl shadow-sm p-4 transition-all', cant > 0 && 'ring-2 ring-primary/30')}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{prod.nombre}</p>
                          {prod.codigoInterno && <p className="text-xs text-gray-400">{prod.codigoInterno}</p>}
                          <p className="text-sm font-bold text-primary mt-1">{formatCurrency(precio)} / caja</p>
                          {cant > 0 && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Subtotal: {formatCurrency(cajas * precio)}
                            </p>
                          )}
                        </div>
                        {cant === 0 ? (
                          <button
                            onClick={() => cambiarCantidad(prod, 1)}
                            className="flex-shrink-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white shadow-md hover:bg-primary/90 transition-colors">
                            <Plus className="w-5 h-5" />
                          </button>
                        ) : (
                          <button onClick={() => quitarItem(prod.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {cant > 0 && (
                        <div className="flex items-center gap-2">
                          <select
                            className="input py-1.5 text-sm flex-1"
                            value={unidad}
                            onChange={e => setUnidad(prod.id, e.target.value as 'CAJA' | 'PALLET')}
                          >
                            <option value="CAJA">Cajas</option>
                            <option value="PALLET">Pallets ({prod.cajasPorPallet} cjs)</option>
                          </select>
                          <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-2 py-1">
                            <button onClick={() => cambiarCantidad(prod, -1)} className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-primary rounded-lg">
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center text-sm font-bold text-gray-900">{cant}</span>
                            <button onClick={() => cambiarCantidad(prod, 1)} className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-primary rounded-lg">
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {prodsCat.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-8">No hay productos en esta categoría.</p>
                )}
              </div>
            )}

            {/* Botón ir al resumen */}
            {carrito.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-xl">
                <div className="max-w-lg mx-auto">
                  <button onClick={() => setStep('resumen')}
                    className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    Ver pedido ({carrito.length} producto{carrito.length !== 1 ? 's' : ''}) — {formatCurrency(total)}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── STEP RESUMEN ── */}
        {step === 'resumen' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <button onClick={() => setStep('productos')} className="text-gray-400 hover:text-gray-600">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="font-semibold text-gray-900">Revisá tu pedido</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {carrito.map(item => {
                  const precio = getPrecio(item.producto);
                  const cajas = item.unidad === 'PALLET' ? item.cantidad * item.producto.cajasPorPallet : item.cantidad;
                  return (
                    <div key={item.producto.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{item.producto.nombre}</p>
                        <p className="text-xs text-gray-400">{item.cantidad} {item.unidad}(s) × {formatCurrency(precio)}/caja</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(cajas * precio)}</p>
                      <button onClick={() => quitarItem(item.producto.id)} className="text-gray-300 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-4 bg-gray-50 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>IVA 21%</span><span>{formatCurrency(iva)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
                  <span>Total c/ IVA</span><span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Notas u observaciones (opcional)</label>
              <textarea className="input h-20 resize-none text-sm" placeholder="Instrucciones de entrega, condiciones..."
                value={notas} onChange={e => setNotas(e.target.value)} />
            </div>

            <button onClick={enviarPedido} disabled={enviando || carrito.length === 0}
              className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2 rounded-2xl shadow-lg">
              <Send className="w-5 h-5" />
              {enviando ? 'Enviando...' : 'Confirmar y enviar por WhatsApp'}
            </button>
            <p className="text-xs text-gray-400 text-center">
              Los precios son orientativos y pueden variar al confirmar.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function clsx(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
