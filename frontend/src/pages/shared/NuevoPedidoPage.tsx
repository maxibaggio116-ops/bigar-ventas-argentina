import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Trash2, Search, Package } from 'lucide-react';
import { api } from '../../utils/api';
import { Cliente, Producto, ListaPrecio } from '../../types';
import { formatCurrency } from '../../utils/format';

interface ItemLine {
  productoId: string;
  producto: Producto;
  cantidad: number;
  unidad: 'CAJA' | 'PALLET';
  precioUnitario: number;
}

function toInputDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function NuevoPedidoPage() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [listas, setListas] = useState<ListaPrecio[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [listaPrecioId, setListaPrecioId] = useState('');
  const [descuento, setDescuento] = useState(0);
  const [notas, setNotas] = useState('');
  const [fecha, setFecha] = useState(toInputDate(new Date()));
  const [items, setItems] = useState<ItemLine[]>([]);
  const [busquedaProd, setBusquedaProd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Cliente[]>('/clientes'),
      api.get<ListaPrecio[]>('/precios'),
      api.get<Producto[]>('/productos'),
    ]).then(([c, l, p]) => {
      setClientes(c);
      setListas(l);
      setProductos(p);
      if (l.length > 0) setListaPrecioId(l[0].id);
    }).catch(console.error);
  }, []);

  function handleClienteChange(id: string) {
    setClienteId(id);
    const c = clientes.find(cl => cl.id === id);
    if (c?.listaPrecioId) setListaPrecioId(c.listaPrecioId);
  }

  function getPrecio(prod: Producto): number {
    if (listaPrecioId) {
      const pp = prod.precios?.find(p => p.listaPrecioId === listaPrecioId);
      if (pp) return pp.precio;
    }
    return prod.precioBase;
  }

  function agregarProducto(prod: Producto) {
    if (items.find(i => i.productoId === prod.id)) return;
    setItems(prev => [...prev, {
      productoId: prod.id,
      producto: prod,
      cantidad: 1,
      unidad: 'CAJA',
      precioUnitario: getPrecio(prod),
    }]);
    setBusquedaProd('');
  }

  function actualizarItem(idx: number, field: keyof ItemLine, value: any) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, [field]: value };
    }));
  }

  const subtotal = items.reduce((acc, item) => {
    const cpp = item.producto.cajasPorPallet ?? 1;
    const cajas = item.unidad === 'PALLET' ? item.cantidad * cpp : item.cantidad;
    return acc + cajas * item.precioUnitario;
  }, 0);
  const totalDesc = subtotal * descuento / 100;
  const baseImponible = subtotal - totalDesc;
  const iva = baseImponible * 0.21;
  const total = baseImponible + iva;
  const totalPallets = items.reduce((acc, item) => {
    const cpp = item.producto.cajasPorPallet ?? 1;
    const cajas = item.unidad === 'PALLET' ? item.cantidad * cpp : item.cantidad;
    return acc + cajas / cpp;
  }, 0);

  const prodsFiltrados = productos.filter(p =>
    p.activo !== false && (
      p.nombre.toLowerCase().includes(busquedaProd.toLowerCase()) ||
      p.codigoInterno?.toLowerCase().includes(busquedaProd.toLowerCase())
    )
  ).slice(0, 8);

  async function handleSubmit() {
    if (!clienteId) { setError('Seleccioná un cliente'); return; }
    if (items.length === 0) { setError('Agregá al menos un producto'); return; }
    setError('');
    setSubmitting(true);
    try {
      const pedido = await api.post<{ id: string }>('/pedidos', {
        clienteId,
        listaPrecioId: listaPrecioId || undefined,
        descuento,
        notas: notas || undefined,
        fecha,
        items: items.map(item => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          unidad: item.unidad,
          precioUnitario: item.precioUnitario,
        })),
      });
      navigate(`/pedidos/${pedido.id}`);
    } catch (e: any) {
      setError(e.message || 'Error al crear el pedido');
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/pedidos" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Pedido</h1>
          <p className="text-sm text-gray-500 mt-0.5">Completá los datos para registrar el pedido</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Datos del pedido</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
                <select className="input" value={clienteId} onChange={e => handleClienteChange(e.target.value)}>
                  <option value="">Seleccioná un cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.razonSocial}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del pedido</label>
                <input type="date" className="input" value={fecha} onChange={e => setFecha(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lista de precios</label>
                <select className="input" value={listaPrecioId} onChange={e => setListaPrecioId(e.target.value)}>
                  <option value="">Sin lista (precio base)</option>
                  {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descuento global (%)</label>
                <input type="number" className="input" min={0} max={100} step={0.5}
                  value={descuento} onChange={e => setDescuento(Number(e.target.value))} />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea className="input h-20 resize-none" placeholder="Instrucciones de entrega..."
                value={notas} onChange={e => setNotas(e.target.value)} />
            </div>
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Agregar productos</h2>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" className="input pl-9" placeholder="Buscar producto..."
                value={busquedaProd} onChange={e => setBusquedaProd(e.target.value)} />
            </div>

            {busquedaProd && (
              <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                {prodsFiltrados.length === 0
                  ? <p className="px-4 py-3 text-sm text-gray-400">Sin resultados</p>
                  : prodsFiltrados.map(p => (
                    <button key={p.id} onClick={() => agregarProducto(p)}
                      disabled={!!items.find(i => i.productoId === p.id)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-left disabled:opacity-40">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                        <p className="text-xs text-gray-400">{p.codigoInterno}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(getPrecio(p))}</p>
                        <p className="text-xs text-gray-400">por caja</p>
                      </div>
                    </button>
                  ))
                }
              </div>
            )}

            {items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-100">
                    <tr>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2">Producto</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2">Unidad</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2">Cant.</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2">Precio/caja</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2">Subtotal</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((item, idx) => {
                      const cpp = item.producto.cajasPorPallet ?? 1;
                      const cajas = item.unidad === 'PALLET' ? item.cantidad * cpp : item.cantidad;
                      const sub = cajas * item.precioUnitario;
                      return (
                        <tr key={item.productoId}>
                          <td className="py-2 pr-3">
                            <p className="text-sm font-medium text-gray-900">{item.producto.nombre}</p>
                            <p className="text-xs text-gray-400">{item.producto.codigoInterno} · {cpp} cj/pallet</p>
                          </td>
                          <td className="py-2 pr-3">
                            <select className="input py-1 text-sm" value={item.unidad}
                              onChange={e => actualizarItem(idx, 'unidad', e.target.value as 'CAJA' | 'PALLET')}>
                              <option value="CAJA">Caja</option>
                              <option value="PALLET">Pallet</option>
                            </select>
                          </td>
                          <td className="py-2 pr-3">
                            <input type="number" min={1} className="input py-1 w-20 text-sm"
                              value={item.cantidad} onChange={e => actualizarItem(idx, 'cantidad', Number(e.target.value))} />
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <input type="number" min={0} step={0.01} className="input py-1 w-28 text-sm text-right"
                              value={item.precioUnitario} onChange={e => actualizarItem(idx, 'precioUnitario', Number(e.target.value))} />
                          </td>
                          <td className="py-2 text-right text-sm font-semibold text-gray-900 whitespace-nowrap">
                            {formatCurrency(sub)}
                          </td>
                          <td className="py-2 pl-2">
                            <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                              className="text-gray-300 hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="card sticky top-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Resumen</h2>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Productos</span>
                <span>{items.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {descuento > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Descuento ({descuento}%)</span>
                  <span className="text-red-600">-{formatCurrency(totalDesc)}</span>
                </div>
              )}
              {descuento > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Base imponible</span>
                  <span>{formatCurrency(baseImponible)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">IVA (21%)</span>
                <span>{formatCurrency(iva)}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between font-bold">
                <span>Total c/ IVA</span>
                <span className="text-lg">{formatCurrency(total)}</span>
              </div>
            </div>

            {totalPallets > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-700">Pallets a devolver</span>
                </div>
                <p className="text-2xl font-bold text-blue-800">
                  {totalPallets % 1 === 0 ? totalPallets.toFixed(0) : totalPallets.toFixed(2)}
                </p>
                <p className="text-xs text-blue-500 mt-0.5">No se cobran · solo se facturan para su retorno</p>
              </div>
            )}

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full py-3 text-base">
              {submitting ? 'Guardando...' : 'Crear pedido'}
            </button>
            <Link to="/pedidos" className="btn-secondary w-full mt-2 flex items-center justify-center">Cancelar</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
