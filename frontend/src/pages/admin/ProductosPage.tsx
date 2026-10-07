import { useEffect, useState } from 'react';
import { Package, Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../utils/api';
import { Producto, Categoria } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { formatCurrency } from '../../utils/format';

interface ProdForm {
  nombre: string; codigoInterno: string; descripcion: string;
  categoriaId: string; precioBase: number; pesoKg: number;
  cajasPorPallet: number; activo: boolean; esPallet: boolean;
}
const defaultForm: ProdForm = { nombre: '', codigoInterno: '', descripcion: '', categoriaId: '', precioBase: 0, pesoKg: 0, cajasPorPallet: 85, activo: true, esPallet: false };

const PALLETS_PRESET = [
  { label: '85 cajas — 1 litro', value: 85 },
  { label: '190 cajas — 200 ml', value: 190 },
];

export function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ProdForm>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Producto[]>('/productos'),
      api.get<Categoria[]>('/categorias'),
    ]).then(([p, c]) => { setProductos(p); setCategorias(c); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditId(null); setForm(defaultForm); setError(''); setModal(true);
  }
  function openEdit(p: Producto) {
    setEditId(p.id);
    setForm({ nombre: p.nombre, codigoInterno: p.codigoInterno ?? '', descripcion: p.descripcion ?? '',
      categoriaId: p.categoriaId ?? '', precioBase: p.precioBase, pesoKg: p.pesoKg ?? 0,
      cajasPorPallet: p.cajasPorPallet ?? 1, activo: p.activo ?? true, esPallet: p.esPallet ?? false });
    setError(''); setModal(true);
  }

  async function handleSubmit() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setError(''); setSubmitting(true);
    try {
      const payload = { ...form, categoriaId: form.categoriaId || undefined };
      if (editId) {
        const u = await api.put<Producto>(`/productos/${editId}`, payload);
        setProductos(prev => prev.map(p => p.id === editId ? u : p));
      } else {
        const c = await api.post<Producto>('/productos', payload);
        setProductos(prev => [c, ...prev]);
      }
      setModal(false);
    } catch (e: any) { setError(e.message || 'Error'); }
    finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/productos/${id}`);
      setProductos(prev => prev.map(p => p.id === id ? { ...p, activo: false } : p));
    } catch (e) { console.error(e); }
    finally { setConfirmDelete(null); }
  }

  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.codigoInterno?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const sf = (f: keyof ProdForm, v: any) => setForm(prev => ({ ...prev, [f]: v }));

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle={`${productos.length} producto${productos.length !== 1 ? 's' : ''}`}
        actions={
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4 mr-1.5" />Nuevo Producto
          </button>
        }
      />

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" className="input pl-9" placeholder="Buscar por nombre o código..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState icon={Package} title="Sin productos"
          description={busqueda ? 'No hay resultados.' : 'Aún no se cargaron productos.'}
          action={!busqueda ? <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4 mr-1.5" />Agregar primer producto</button> : undefined} />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Producto</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3 hidden sm:table-cell">Código</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3 hidden md:table-cell">Categoría</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Precio base</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3 hidden lg:table-cell">Cajas/Pallet</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtrados.map(p => (
                  <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${!p.activo ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                      {!p.activo && <span className="text-xs text-gray-400">Inactivo</span>}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500 hidden sm:table-cell">{p.codigoInterno ?? '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-500 hidden md:table-cell">{p.categoria?.nombre ?? '—'}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-gray-900 text-right">{formatCurrency(p.precioBase)}</td>
                    <td className="px-5 py-3 text-sm text-gray-500 text-right hidden lg:table-cell">{p.cajasPorPallet}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-primary transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setConfirmDelete(p.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar producto' : 'Nuevo producto'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input className="input" value={form.nombre} onChange={e => sf('nombre', e.target.value)} autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código interno</label>
              <input className="input" value={form.codigoInterno} onChange={e => sf('codigoInterno', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select className="input" value={form.categoriaId} onChange={e => sf('categoriaId', e.target.value)}>
                <option value="">Sin categoría</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio base ($)</label>
              <input type="number" min={0} step={0.01} className="input" value={form.precioBase} onChange={e => sf('precioBase', Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Peso por caja (kg)</label>
              <input type="number" min={0} step={0.001} className="input" value={form.pesoKg} onChange={e => sf('pesoKg', Number(e.target.value))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cajas por pallet</label>
              <div className="flex gap-2 mb-2">
                {PALLETS_PRESET.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => sf('cajasPorPallet', p.value)}
                    className={`flex-1 text-xs py-2 px-3 rounded-lg border font-medium transition-all ${
                      form.cajasPorPallet === p.value
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                type="number" min={1} className="input text-sm"
                value={form.cajasPorPallet}
                onChange={e => sf('cajasPorPallet', Number(e.target.value))}
                placeholder="O ingresá un valor personalizado"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea className="input h-16 resize-none" value={form.descripcion} onChange={e => sf('descripcion', e.target.value)} />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-2">
              {editId && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="activo" checked={form.activo} onChange={e => sf('activo', e.target.checked)} className="w-4 h-4 text-primary" />
                  <label htmlFor="activo" className="text-sm font-medium text-gray-700">Producto activo</label>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="esPallet" checked={form.esPallet} onChange={e => sf('esPallet', e.target.checked)} className="w-4 h-4 text-primary" />
                <label htmlFor="esPallet" className="text-sm font-medium text-gray-700">
                  Es pallet (solo para devolución — no suma en venta ni en pallets del viaje)
                </label>
              </div>
            </div>
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
          <div className="flex gap-3">
            <button onClick={handleSubmit} className="btn-primary" disabled={submitting}>
              {submitting ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear producto'}
            </button>
            <button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      </Modal>

      {/* Confirm delete */}
      <Modal open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} title="Desactivar producto" size="sm">
        <p className="text-sm text-gray-600 mb-6">
          ¿Desactivar <strong>{productos.find(p => p.id === confirmDelete)?.nombre}</strong>? El producto ya no aparecerá en nuevos pedidos.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setConfirmDelete(null)} className="btn-secondary">Cancelar</button>
          <button onClick={() => handleDelete(confirmDelete!)} className="btn-primary bg-red-600 hover:bg-red-700">Desactivar</button>
        </div>
      </Modal>
    </div>
  );
}
