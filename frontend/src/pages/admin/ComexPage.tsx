import { useEffect, useState } from 'react';
import { Plus, Trash2, FileText, Globe, TrendingUp, RefreshCw, ChevronDown, ChevronRight, ExternalLink, Truck } from 'lucide-react';
import { api } from '../../utils/api';
import { ComexOperacion, ComexDocumento, Cotizacion, TipoDocComex, Transportista } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { formatDate, formatCurrencyUSD } from '../../utils/format';
import { clsx } from 'clsx';

const TIPOS_DOC: TipoDocComex[] = ['BL', 'PL', 'FACTURA_COMERCIAL', 'CRT', 'OTRO'];
const TIPOS_DOC_LABEL: Record<TipoDocComex, string> = {
  BL: 'Bill of Lading', PL: 'Packing List', FACTURA_COMERCIAL: 'Factura Comercial', CRT: 'CRT', OTRO: 'Otro',
};
const ESTADO_COLOR: Record<string, string> = {
  EN_PROCESO: 'bg-blue-100 text-blue-800',
  COMPLETADA: 'bg-green-100 text-green-800',
  CANCELADA: 'bg-red-100 text-red-800',
};

type Tab = 'operaciones' | 'noticias';

const TRANSPORTISTAS_COMEX: { value: Transportista; label: string }[] = [
  { value: 'KLUVER', label: 'Kluver' },
  { value: 'BONJOUR_TUNESSI', label: 'Bonjour Tunessi' },
  { value: 'LEZCANO', label: 'Lezcano' },
  { value: 'OTRO', label: 'Otro' },
];

const defaultForm = { fecha: new Date().toISOString().split('T')[0], tipo: 'IMPORTACION', descripcion: '', proveedor: '', montoUSD: '', cotizacion: '', estado: 'EN_PROCESO', notas: '', transportista: '', transporteCosto: '', transporteKm: '' };

export function ComexPage() {
  const [tab, setTab] = useState<Tab>('operaciones');
  const [operaciones, setOperaciones] = useState<ComexOperacion[]>([]);
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const [noticias, setNoticias] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cotLoading, setCotLoading] = useState(true);

  // Modal operación
  const [opModal, setOpModal] = useState(false);
  const [editOp, setEditOp] = useState<ComexOperacion | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Modal documento
  const [docModal, setDocModal] = useState(false);
  const [docOpId, setDocOpId] = useState('');
  const [docForm, setDocForm] = useState({ tipo: 'BL' as TipoDocComex, nombre: '', notas: '' });
  const [docSubmitting, setDocSubmitting] = useState(false);

  useEffect(() => {
    api.get<ComexOperacion[]>('/comex/operaciones').then(setOperaciones).catch(console.error).finally(() => setLoading(false));
    api.get<Cotizacion>('/comex/cotizacion').then(setCotizacion).catch(console.error).finally(() => setCotLoading(false));
    api.get('/comex/noticias').then(setNoticias).catch(console.error);
  }, []);

  function refreshCot() {
    setCotLoading(true);
    api.get<Cotizacion>('/comex/cotizacion').then(setCotizacion).catch(console.error).finally(() => setCotLoading(false));
  }

  function openCreate() {
    setEditOp(null);
    setForm({ ...defaultForm, cotizacion: cotizacion?.USD_ARS.toString() ?? '', fecha: new Date().toISOString().split('T')[0] });
    setError('');
    setOpModal(true);
  }

  function openEdit(op: ComexOperacion) {
    setEditOp(op);
    setForm({ fecha: op.fecha.split('T')[0], tipo: op.tipo, descripcion: op.descripcion, proveedor: op.proveedor ?? '',
      montoUSD: op.montoUSD.toString(), cotizacion: op.cotizacion.toString(), estado: op.estado, notas: op.notas ?? '',
      transportista: op.transportista ?? '', transporteCosto: op.transporteCosto != null ? String(op.transporteCosto) : '', transporteKm: op.transporteKm != null ? String(op.transporteKm) : '' });
    setError('');
    setOpModal(true);
  }

  async function handleOpSubmit() {
    if (!form.descripcion || !form.montoUSD) { setError('Descripción y monto son requeridos'); return; }
    setError(''); setSubmitting(true);
    try {
      const payload = { ...form, montoUSD: Number(form.montoUSD), cotizacion: Number(form.cotizacion),
        transportista: form.transportista || null,
        transporteCosto: form.transporteCosto ? Number(form.transporteCosto) : null,
        transporteKm: form.transporteKm ? Number(form.transporteKm) : null,
      };
      if (editOp) {
        const updated = await api.put<ComexOperacion>(`/comex/operaciones/${editOp.id}`, payload);
        setOperaciones(prev => prev.map(o => o.id === editOp.id ? updated : o));
      } else {
        const created = await api.post<ComexOperacion>('/comex/operaciones', payload);
        setOperaciones(prev => [created, ...prev]);
      }
      setOpModal(false);
    } catch (e: any) {
      setError(e.message || 'Error al guardar');
    } finally { setSubmitting(false); }
  }

  async function deleteOp(id: string) {
    if (!confirm('¿Eliminar esta operación?')) return;
    await api.delete(`/comex/operaciones/${id}`);
    setOperaciones(prev => prev.filter(o => o.id !== id));
  }

  function openDoc(opId: string) {
    setDocOpId(opId);
    setDocForm({ tipo: 'BL', nombre: '', notas: '' });
    setDocModal(true);
  }

  async function handleDocSubmit() {
    if (!docForm.nombre) return;
    setDocSubmitting(true);
    try {
      const doc = await api.post<ComexDocumento>(`/comex/operaciones/${docOpId}/documentos`, docForm);
      setOperaciones(prev => prev.map(o => o.id === docOpId
        ? { ...o, documentos: [...(o.documentos ?? []), doc] }
        : o
      ));
      setDocModal(false);
    } catch (e) { console.error(e); }
    finally { setDocSubmitting(false); }
  }

  async function deleteDoc(opId: string, docId: string) {
    await api.delete(`/comex/operaciones/${opId}/documentos/${docId}`);
    setOperaciones(prev => prev.map(o => o.id === opId
      ? { ...o, documentos: o.documentos?.filter(d => d.id !== docId) }
      : o
    ));
  }

  return (
    <div>
      <PageHeader title="Comercio Exterior" subtitle="Operaciones, cotización y seguimiento" />

      {/* Cotización */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card col-span-1 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">USD / ARS</p>
            {cotLoading ? (
              <div className="w-24 h-7 bg-gray-100 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-3xl font-bold text-gray-900">{cotizacion?.USD_ARS.toFixed(2)}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {cotizacion?.source === 'fallback' ? '⚠ Referencial' : `Fuente: ${cotizacion?.source}`}
            </p>
          </div>
          <button onClick={refreshCot} disabled={cotLoading} className="p-2 text-gray-400 hover:text-primary rounded-lg">
            <RefreshCw className={clsx('w-5 h-5', cotLoading && 'animate-spin')} />
          </button>
        </div>
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">ARS / USD</p>
            <p className="text-2xl font-bold text-gray-900">{cotizacion?.ARS_USD.toFixed(4)}</p>
            <p className="text-xs text-gray-400 mt-1">Última actualización: {cotizacion ? formatDate(cotizacion.fecha) : '—'}</p>
          </div>
          <TrendingUp className="w-8 h-8 text-gray-200" />
        </div>
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Operaciones activas</p>
            <p className="text-2xl font-bold text-gray-900">
              {operaciones.filter(o => o.estado === 'EN_PROCESO').length}
            </p>
            <p className="text-xs text-gray-400 mt-1">de {operaciones.length} totales</p>
          </div>
          <Globe className="w-8 h-8 text-gray-200" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 bg-gray-100 rounded-xl w-fit">
        {(['operaciones', 'noticias'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-4 py-2 text-sm font-medium rounded-lg transition-all capitalize',
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {t === 'operaciones' ? '📦 Operaciones' : '📰 Noticias & Predicción'}
          </button>
        ))}
      </div>

      {tab === 'operaciones' && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={openCreate} className="btn-primary">
              <Plus className="w-4 h-4 mr-1.5" />
              Nueva Operación
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : operaciones.length === 0 ? (
            <div className="card text-center py-12">
              <Globe className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No hay operaciones registradas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {operaciones.map(op => (
                <div key={op.id} className="card p-0 overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpanded(expanded === op.id ? null : op.id)}>
                    {expanded === op.id ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', op.tipo === 'IMPORTACION' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800')}>
                          {op.tipo}
                        </span>
                        <p className="text-sm font-semibold text-gray-900 truncate">{op.descripcion}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {op.proveedor && `${op.proveedor} · `}{formatDate(op.fecha)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900">{formatCurrencyUSD(op.montoUSD)}</p>
                      {op.montoUYU > 0 && <p className="text-xs text-gray-400">ARS {op.montoUYU.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</p>}
                    </div>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0', ESTADO_COLOR[op.estado])}>
                      {op.estado.replace('_', ' ')}
                    </span>
                    <div className="flex gap-1 ml-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(op)} className="p-1.5 text-gray-400 hover:text-primary rounded">✏️</button>
                      <button onClick={() => deleteOp(op.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {expanded === op.id && (
                    <div className="border-t border-gray-100 px-5 py-4">
                      {op.notas && <p className="text-sm text-gray-600 mb-3 italic">{op.notas}</p>}
                      {op.transportista && (
                        <div className="flex items-center gap-3 mb-3 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                          <Truck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="font-medium">{TRANSPORTISTAS_COMEX.find(t => t.value === op.transportista)?.label ?? op.transportista}</span>
                          {op.transporteKm != null && <span className="text-gray-400">{op.transporteKm} km</span>}
                          {op.transporteCosto != null && <span className="font-semibold text-gray-800">${op.transporteCosto.toLocaleString('es-UY', { minimumFractionDigits: 2 })}</span>}
                        </div>
                      )}
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Documentos ({op.documentos?.length ?? 0})
                      </p>
                      <div className="space-y-1.5 mb-3">
                        {op.documentos?.map(doc => (
                          <div key={doc.id} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="font-medium text-gray-700 text-xs bg-gray-200 px-1.5 py-0.5 rounded">
                              {TIPOS_DOC_LABEL[doc.tipo as TipoDocComex] ?? doc.tipo}
                            </span>
                            <span className="text-gray-600 flex-1 truncate">{doc.nombre}</span>
                            {doc.notas && <span className="text-xs text-gray-400 hidden sm:block">{doc.notas}</span>}
                            <button onClick={() => deleteDoc(op.id, doc.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {!op.documentos?.length && (
                          <p className="text-sm text-gray-400">Sin documentos agregados</p>
                        )}
                      </div>
                      <button onClick={() => openDoc(op.id)} className="text-sm text-primary hover:underline font-medium flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" />
                        Agregar documento
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'noticias' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Noticias */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Noticias de Comercio Internacional
            </h2>
            <div className="space-y-3">
              {noticias?.noticias?.map((n: any) => (
                <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer"
                  className="block p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors group">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{n.categoria}</span>
                      <p className="text-sm font-medium text-gray-900 mt-1.5 group-hover:text-primary transition-colors">{n.titulo}</p>
                      <p className="text-xs text-gray-400 mt-1">{n.fuente} · {formatDate(n.fecha)}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-primary flex-shrink-0 mt-1" />
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Predicción */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Predicción de Mercado
            </h2>
            {noticias?.prediccion ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Horizonte</p>
                    <p className="text-lg font-bold text-gray-900">{noticias.prediccion.horizonte}</p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Tendencia</p>
                    <p className={clsx('text-lg font-bold', noticias.prediccion.tendencia === 'ESTABLE' ? 'text-blue-600' : noticias.prediccion.tendencia === 'ALCISTA' ? 'text-green-600' : 'text-red-600')}>
                      {noticias.prediccion.tendencia}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Confianza</p>
                    <p className="text-lg font-bold text-gray-900">{noticias.prediccion.confianza}%</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Factores clave</p>
                  <ul className="space-y-1.5">
                    {noticias.prediccion.factores?.map((f: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-primary mt-0.5">•</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Recomendación</p>
                  <p className="text-sm text-gray-700">{noticias.prediccion.recomendacion}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Cargando predicción...</p>
            )}
          </div>
        </div>
      )}

      {/* Operación Modal */}
      <Modal open={opModal} onClose={() => setOpModal(false)} title={editOp ? 'Editar operación' : 'Nueva operación Comex'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input type="date" className="input" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select className="input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                <option value="IMPORTACION">Importación</option>
                <option value="EXPORTACION">Exportación</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
              <input className="input" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Importación jugos concentrados" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
              <input className="input" value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select className="input" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                <option value="EN_PROCESO">En Proceso</option>
                <option value="COMPLETADA">Completada</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto USD *</label>
              <input type="number" min="0" step="0.01" className="input" value={form.montoUSD} onChange={e => setForm(f => ({ ...f, montoUSD: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cotización (USD→ARS)</label>
              <input type="number" min="0" step="0.01" className="input" value={form.cotizacion}
                placeholder={cotizacion?.USD_ARS.toFixed(2)}
                onChange={e => setForm(f => ({ ...f, cotizacion: e.target.value }))} />
            </div>
            {form.montoUSD && form.cotizacion && (
              <div className="col-span-2 p-3 bg-green-50 rounded-lg text-sm text-gray-700">
                <span className="font-medium">Equivalente ARS: </span>
                {(Number(form.montoUSD) * Number(form.cotizacion)).toLocaleString('es-UY', { minimumFractionDigits: 2 })}
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea className="input h-16 resize-none" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
            </div>

            {/* Transporte */}
            <div className="col-span-2 border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-3">
                <Truck className="w-4 h-4" /> Transporte (opcional)
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Empresa</label>
                  <select className="input text-sm" value={form.transportista} onChange={e => setForm(f => ({ ...f, transportista: e.target.value }))}>
                    <option value="">Sin asignar</option>
                    {TRANSPORTISTAS_COMEX.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Costo ($)</label>
                  <input type="number" min={0} step={0.01} className="input text-sm" placeholder="0.00"
                    value={form.transporteCosto} onChange={e => setForm(f => ({ ...f, transporteCosto: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Km</label>
                  <input type="number" min={0} step={1} className="input text-sm" placeholder="0"
                    value={form.transporteKm} onChange={e => setForm(f => ({ ...f, transporteKm: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
          <div className="flex gap-3">
            <button onClick={handleOpSubmit} className="btn-primary" disabled={submitting}>
              {submitting ? 'Guardando...' : editOp ? 'Guardar cambios' : 'Crear operación'}
            </button>
            <button onClick={() => setOpModal(false)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      </Modal>

      {/* Documento Modal */}
      <Modal open={docModal} onClose={() => setDocModal(false)} title="Agregar documento" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de documento</label>
            <select className="input" value={docForm.tipo} onChange={e => setDocForm(f => ({ ...f, tipo: e.target.value as TipoDocComex }))}>
              {TIPOS_DOC.map(t => <option key={t} value={t}>{TIPOS_DOC_LABEL[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre / Referencia *</label>
            <input className="input" value={docForm.nombre} onChange={e => setDocForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: BL-2024-001" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <input className="input" value={docForm.notas} onChange={e => setDocForm(f => ({ ...f, notas: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <button onClick={handleDocSubmit} className="btn-primary" disabled={docSubmitting || !docForm.nombre}>
              {docSubmitting ? 'Guardando...' : 'Agregar'}
            </button>
            <button onClick={() => setDocModal(false)} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
