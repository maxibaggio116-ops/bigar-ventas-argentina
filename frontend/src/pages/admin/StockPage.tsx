import { useEffect, useState, useCallback } from 'react';
import { Package, RefreshCw, Edit3, Check, X, ChevronDown, ChevronRight, Clock, ArrowUpCircle, ArrowDownCircle, AlertCircle } from 'lucide-react';
import { api } from '../../utils/api';
import { StockItem, StockMovimiento } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../utils/format';

function tipoMovLabel(tipo: string) {
  if (tipo === 'FACTURACION') return 'Facturación';
  if (tipo === 'ENTRADA') return 'Entrada';
  return 'Ajuste manual';
}

function StockBadge({ disponible }: { disponible: number }) {
  if (disponible < 0) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
      <AlertCircle className="w-3 h-3" /> {disponible}
    </span>
  );
  if (disponible === 0) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
      {disponible}
    </span>
  );
  if (disponible < 10) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
      {disponible}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      {disponible}
    </span>
  );
}

interface EditState {
  productoId: string;
  value: string;
  descripcion: string;
  mode: 'set' | 'delta';
}

export function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [movimientos, setMovimientos] = useState<StockMovimiento[]>([]);
  const [loadingMov, setLoadingMov] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await api.get<StockItem[]>('/stock');
      setItems(data);
    } catch (e: any) {
      setError(e.message || 'Error al cargar stock');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleMovimientos(productoId: string) {
    if (expanded === productoId) {
      setExpanded(null);
      setMovimientos([]);
      return;
    }
    setExpanded(productoId);
    setLoadingMov(true);
    try {
      const data = await api.get<StockMovimiento[]>(`/stock/${productoId}/movimientos`);
      setMovimientos(data);
    } finally {
      setLoadingMov(false);
    }
  }

  function startEdit(item: StockItem) {
    setEdit({
      productoId: item.productoId,
      value: String(item.stockActual),
      descripcion: '',
      mode: 'set',
    });
  }

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    try {
      const payload: any = { descripcion: edit.descripcion || undefined };
      if (edit.mode === 'set') {
        payload.stockNuevo = Number(edit.value);
      } else {
        payload.delta = Number(edit.value);
      }
      await api.post(`/stock/${edit.productoId}/ajuste`, payload);
      setEdit(null);
      await load(true);
      // Refresh movimientos si está expandido
      if (expanded === edit.productoId) {
        const data = await api.get<StockMovimiento[]>(`/stock/${edit.productoId}/movimientos`);
        setMovimientos(data);
      }
    } catch (e: any) {
      setError(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const filtrados = items.filter(i =>
    !busqueda ||
    i.producto.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    i.producto.codigoInterno?.toLowerCase().includes(busqueda.toLowerCase()) ||
    i.producto.categoria?.toLowerCase().includes(busqueda.toLowerCase())
  );

  // KPIs
  const totalProductos = items.length;
  const sinStock = items.filter(i => i.stockActual <= 0).length;
  const conAlerta = items.filter(i => i.disponible < 0).length;
  const totalCajas = items.reduce((s, i) => s + Math.max(0, i.stockActual), 0);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Stock de Producto Terminado"
        subtitle="Inventario actual y movimientos"
        actions={
          <button onClick={() => load(true)} disabled={refreshing}
            className="btn-secondary flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
          {error}
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card py-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalProductos}</p>
          <p className="text-xs text-gray-500 mt-1">Productos</p>
        </div>
        <div className="card py-4 text-center">
          <p className="text-2xl font-bold text-green-600">{totalCajas.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Cajas en stock</p>
        </div>
        <div className="card py-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{sinStock}</p>
          <p className="text-xs text-gray-500 mt-1">Sin stock</p>
        </div>
        <div className="card py-4 text-center">
          <p className={`text-2xl font-bold ${conAlerta > 0 ? 'text-red-600' : 'text-gray-400'}`}>{conAlerta}</p>
          <p className="text-xs text-gray-500 mt-1">Disponible negativo</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input type="text" className="input" placeholder="Buscar por producto, código o categoría..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      {filtrados.length === 0 ? (
        <EmptyState icon={Package} title="Sin productos" description="No hay productos en el catálogo." />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3 w-8" />
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Producto</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3">Stock Real</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3 hidden md:table-cell">Reservado</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3">Disponible</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-3 hidden lg:table-cell">Últ. actualización</th>
                  <th className="px-3 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtrados.map(item => {
                  const isEditing = edit?.productoId === item.productoId;
                  const isExpanded = expanded === item.productoId;
                  const rowAlert = item.disponible < 0 ? 'bg-red-50' : item.disponible === 0 ? 'bg-orange-50/40' : '';

                  return (
                    <>
                      <tr key={item.productoId} className={`hover:bg-gray-50 transition-colors ${rowAlert}`}>
                        {/* Expand toggle */}
                        <td className="px-3 py-3">
                          <button onClick={() => toggleMovimientos(item.productoId)}
                            className="text-gray-400 hover:text-primary transition-colors">
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4" />
                              : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>

                        {/* Producto */}
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium text-gray-900">{item.producto.nombre}</p>
                          <p className="text-xs text-gray-400">
                            {item.producto.codigoInterno && <span className="mr-2">{item.producto.codigoInterno}</span>}
                            {item.producto.categoria && <span className="text-gray-300">• {item.producto.categoria}</span>}
                          </p>
                        </td>

                        {/* Stock Real — editable */}
                        <td className="px-3 py-3 text-center">
                          {isEditing ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setEdit(e => e ? { ...e, mode: e.mode === 'set' ? 'delta' : 'set' } : null)}
                                  className="text-xs px-1.5 py-0.5 rounded border border-gray-300 text-gray-500 hover:border-primary hover:text-primary transition-colors">
                                  {edit.mode === 'set' ? 'Valor' : 'Δ'}
                                </button>
                                <input
                                  type="number"
                                  className="input py-1 w-20 text-sm text-center"
                                  value={edit.value}
                                  onChange={e => setEdit(prev => prev ? { ...prev, value: e.target.value } : null)}
                                  autoFocus
                                />
                              </div>
                              <input
                                type="text"
                                className="input py-1 w-32 text-xs"
                                placeholder="Motivo (opc.)"
                                value={edit.descripcion}
                                onChange={e => setEdit(prev => prev ? { ...prev, descripcion: e.target.value } : null)}
                              />
                            </div>
                          ) : (
                            <span className="text-sm font-semibold text-gray-900">
                              {item.stockActual.toLocaleString()}
                            </span>
                          )}
                        </td>

                        {/* Reservado */}
                        <td className="px-3 py-3 text-center hidden md:table-cell">
                          <span className="text-sm text-blue-600 font-medium">
                            {item.reservado > 0 ? `-${item.reservado}` : '—'}
                          </span>
                        </td>

                        {/* Disponible */}
                        <td className="px-3 py-3 text-center">
                          <StockBadge disponible={item.disponible} />
                        </td>

                        {/* Última actualización */}
                        <td className="px-3 py-3 text-center hidden lg:table-cell">
                          <span className="text-xs text-gray-400">
                            {item.updatedAt ? formatDate(item.updatedAt) : '—'}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="px-3 py-3">
                          {isEditing ? (
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={saveEdit} disabled={saving}
                                className="text-green-600 hover:text-green-700 disabled:opacity-50">
                                <Check className="w-4 h-4" />
                              </button>
                              <button onClick={() => setEdit(null)}
                                className="text-gray-400 hover:text-gray-600">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(item)}
                              className="text-gray-400 hover:text-primary transition-colors flex items-center gap-1 ml-auto">
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Fila expandida — movimientos */}
                      {isExpanded && (
                        <tr key={`${item.productoId}-mov`} className="bg-gray-50/80">
                          <td colSpan={7} className="px-8 py-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Últimos movimientos
                            </p>
                            {loadingMov ? (
                              <p className="text-xs text-gray-400">Cargando...</p>
                            ) : movimientos.length === 0 ? (
                              <p className="text-xs text-gray-400">Sin movimientos registrados</p>
                            ) : (
                              <div className="space-y-1">
                                {movimientos.map(m => (
                                  <div key={m.id} className="flex items-center gap-3 text-xs">
                                    {m.cantidad > 0
                                      ? <ArrowUpCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                      : <ArrowDownCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                                    <span className={`font-semibold w-10 text-right ${m.cantidad > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {m.cantidad > 0 ? '+' : ''}{m.cantidad}
                                    </span>
                                    <span className="text-gray-500 bg-gray-200 rounded px-1.5 py-0.5">
                                      {tipoMovLabel(m.tipo)}
                                    </span>
                                    <span className="text-gray-600 flex-1">{m.descripcion}</span>
                                    <span className="text-gray-400 whitespace-nowrap">{formatDate(m.createdAt)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Leyenda */}
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> Disponible OK</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> Menos de 10</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" /> Sin stock</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Negativo (sobrecomprometido)</span>
            <span className="flex items-center gap-1.5 text-blue-500">Reservado = pedidos confirmados aún no facturados</span>
          </div>
        </div>
      )}

      {/* Info sobre modo de edición */}
      <p className="text-xs text-gray-400 mt-3">
        💡 Hacé clic en <Edit3 className="w-3 h-3 inline" /> para ajustar el stock. <strong>Valor</strong>: ingresá el stock real actual. <strong>Δ</strong>: ingresá la diferencia (+/−).
        Los pedidos facturados descuentan automáticamente.
      </p>
    </div>
  );
}
