import { useEffect, useState } from 'react';
import { TrendingUp, Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../../utils/api';
import { ListaPrecio, Producto } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { formatCurrency } from '../../utils/format';

export function PreciosPage() {
  const [listas, setListas] = useState<ListaPrecio[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [listaModal, setListaModal] = useState(false);
  const [listaEditId, setListaEditId] = useState<string | null>(null);
  const [listaNombre, setListaNombre] = useState('');
  const [listaDesc, setListaDesc] = useState('');
  const [listaSubmitting, setListaSubmitting] = useState(false);
  const [listaError, setListaError] = useState('');

  const [precioModal, setPrecioModal] = useState(false);
  const [precioListaId, setPrecioListaId] = useState('');
  const [precioProductoId, setPrecioProductoId] = useState('');
  const [precioValor, setPrecioValor] = useState(0);
  const [precioSubmitting, setPrecioSubmitting] = useState(false);
  const [precioError, setPrecioError] = useState('');

  const [confirmDeleteLista, setConfirmDeleteLista] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<ListaPrecio[]>('/precios'),
      api.get<Producto[]>('/productos'),
    ]).then(([l, p]) => { setListas(l); setProductos(p); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  function openCreateLista() {
    setListaEditId(null); setListaNombre(''); setListaDesc(''); setListaError(''); setListaModal(true);
  }
  function openEditLista(l: ListaPrecio) {
    setListaEditId(l.id); setListaNombre(l.nombre); setListaDesc(l.descripcion ?? ''); setListaError(''); setListaModal(true);
  }

  async function handleListaSubmit() {
    if (!listaNombre.trim()) { setListaError('El nombre es obligatorio'); return; }
    setListaError(''); setListaSubmitting(true);
    try {
      const payload = { nombre: listaNombre, descripcion: listaDesc || undefined };
      if (listaEditId) {
        const u = await api.put<ListaPrecio>(`/precios/${listaEditId}`, payload);
        setListas(prev => prev.map(l => l.id === listaEditId ? { ...l, ...u } : l));
      } else {
        const c = await api.post<ListaPrecio>('/precios', payload);
        setListas(prev => [...prev, c]);
      }
      setListaModal(false);
    } catch (e: any) { setListaError(e.message || 'Error'); }
    finally { setListaSubmitting(false); }
  }

  async function handleDeleteLista(id: string) {
    try {
      await api.delete(`/precios/${id}`);
      setListas(prev => prev.filter(l => l.id !== id));
    } catch (e) { console.error(e); }
    finally { setConfirmDeleteLista(null); }
  }

  function openAddPrecio(listaId: string) {
    setPrecioListaId(listaId); setPrecioProductoId(''); setPrecioValor(0); setPrecioError(''); setPrecioModal(true);
  }

  async function handlePrecioSubmit() {
    if (!precioProductoId) { setPrecioError('Seleccioná un producto'); return; }
    if (precioValor <= 0) { setPrecioError('Ingresá un precio válido'); return; }
    setPrecioError(''); setPrecioSubmitting(true);
    try {
      const updated = await api.post<ListaPrecio>(`/precios/${precioListaId}/precios`, {
        productoId: precioProductoId, precio: precioValor,
      });
      setListas(prev => prev.map(l => l.id === precioListaId ? updated : l));
      setPrecioModal(false);
    } catch (e: any) { setPrecioError(e.message || 'Error'); }
    finally { setPrecioSubmitting(false); }
  }

  async function removePrecio(listaId: string, productoId: string) {
    try {
      const updated = await api.delete<ListaPrecio>(`/precios/${listaId}/precios/${productoId}`);
      setListas(prev => prev.map(l => l.id === listaId ? updated : l));
    } catch (e) { console.error(e); }
  }

  return (
    <div>
      <PageHeader
        title="Listas de Precios"
        subtitle={`${listas.length} lista${listas.length !== 1 ? 's' : ''} configuradas`}
        actions={
          <button onClick={openCreateLista} className="btn-primary">
            <Plus className="w-4 h-4 mr-1.5" />Nueva Lista
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : listas.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Sin listas de precios" description="Creá listas para manejar precios diferenciados."
          action={<button onClick={openCreateLista} className="btn-primary"><Plus className="w-4 h-4 mr-1.5" />Crear primera lista</button>} />
      ) : (
        <div className="space-y-4">
          {listas.map(lista => (
            <div key={lista.id} className="card p-0 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === lista.id ? null : lista.id)}>
                {expanded === lista.id
                  ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{lista.nombre}</p>
                  {lista.descripcion && <p className="text-xs text-gray-400">{lista.descripcion}</p>}
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {lista.precios?.length ?? 0} precios
                </span>
                <div className="flex items-center gap-1 ml-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openEditLista(lista)} className="p-1.5 text-gray-400 hover:text-primary rounded">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setConfirmDeleteLista(lista.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expanded === lista.id && (
                <div className="border-t border-gray-100">
                  {lista.precios && lista.precios.length > 0 ? (
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-2">Producto</th>
                          <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-2">Precio</th>
                          <th className="px-5 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {lista.precios.map(pp => (
                          <tr key={pp.productoId} className="hover:bg-gray-50">
                            <td className="px-5 py-2.5 text-sm text-gray-700">
                              {pp.producto?.nombre ?? `Producto ${pp.productoId.slice(-4)}`}
                              {pp.producto?.codigoInterno && (
                                <span className="ml-2 text-xs text-gray-400">{pp.producto.codigoInterno}</span>
                              )}
                            </td>
                            <td className="px-5 py-2.5 text-sm font-semibold text-gray-900 text-right">
                              {formatCurrency(pp.precio)}
                            </td>
                            <td className="px-5 py-2.5 text-right">
                              <button onClick={() => removePrecio(lista.id, pp.productoId)}
                                className="text-gray-300 hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="px-5 py-4 text-sm text-gray-400">Sin precios configurados.</p>
                  )}
                  <div className="px-5 py-3 border-t border-gray-100">
                    <button onClick={() => openAddPrecio(lista.id)}
                      className="text-sm text-primary hover:underline font-medium flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" />Agregar precio
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lista Modal */}
      <Modal open={listaModal} onClose={() => setListaModal(false)}
        title={listaEditId ? 'Editar lista' : 'Nueva lista de precios'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input className="input" value={listaNombre} onChange={e => setListaNombre(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <input className="input" value={listaDesc} onChange={e => setListaDesc(e.target.value)} />
          </div>
          {listaError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{listaError}</div>}
          <div className="flex gap-3">
            <button onClick={handleListaSubmit} className="btn-primary" disabled={listaSubmitting}>
              {listaSubmitting ? 'Guardando...' : listaEditId ? 'Guardar' : 'Crear lista'}
            </button>
            <button onClick={() => setListaModal(false)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      </Modal>

      {/* Precio Modal */}
      <Modal open={precioModal} onClose={() => setPrecioModal(false)} title="Agregar precio" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Producto *</label>
            <select className="input" value={precioProductoId} onChange={e => setPrecioProductoId(e.target.value)}>
              <option value="">Seleccioná un producto</option>
              {productos.filter(p => p.activo !== false).map(p => (
                <option key={p.id} value={p.id}>{p.nombre} {p.codigoInterno ? `(${p.codigoInterno})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio por caja ($) *</label>
            <input type="number" min={0} step={0.01} className="input" value={precioValor}
              onChange={e => setPrecioValor(Number(e.target.value))} />
          </div>
          {precioError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{precioError}</div>}
          <div className="flex gap-3">
            <button onClick={handlePrecioSubmit} className="btn-primary" disabled={precioSubmitting}>
              {precioSubmitting ? 'Guardando...' : 'Agregar precio'}
            </button>
            <button onClick={() => setPrecioModal(false)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      </Modal>

      {/* Confirm delete */}
      <Modal open={confirmDeleteLista !== null} onClose={() => setConfirmDeleteLista(null)} title="Eliminar lista" size="sm">
        <p className="text-sm text-gray-600 mb-6">¿Eliminar esta lista de precios? Esta acción no se puede deshacer.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setConfirmDeleteLista(null)} className="btn-secondary">Cancelar</button>
          <button onClick={() => handleDeleteLista(confirmDeleteLista!)} className="btn-primary bg-red-600 hover:bg-red-700">Eliminar</button>
        </div>
      </Modal>
    </div>
  );
}
