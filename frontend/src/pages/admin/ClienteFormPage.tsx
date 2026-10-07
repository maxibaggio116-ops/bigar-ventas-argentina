import { useEffect, useState, FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../utils/api';
import { Cliente, ListaPrecio, PlazoCredito } from '../../types';
import { plazoLabel } from '../../utils/format';

const PLAZOS: PlazoCredito[] = ['CONTADO', 'DIAS_21', 'DIAS_30', 'MAS_30'];

export function ClienteFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [form, setForm] = useState({
    razonSocial: '',
    cuit: '',
    email: '',
    telefono: '',
    whatsapp: '',
    direccion: '',
    localidad: '',
    provincia: '',
    condicionIva: 'RESPONSABLE_INSCRIPTO',
    plazoCredito: 'CONTADO' as PlazoCredito,
    listaPrecioId: '',
  });
  const [listas, setListas] = useState<ListaPrecio[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<ListaPrecio[]>('/precios').then(setListas).catch(console.error);
    if (!isEditing) return;
    api.get<Cliente>(`/clientes/${id}`)
      .then(c => setForm({
        razonSocial: c.razonSocial,
        cuit: c.cuit ?? '',
        email: c.email ?? '',
        telefono: c.telefono ?? '',
        whatsapp: c.whatsapp ?? '',
        direccion: c.direccion ?? '',
        localidad: c.localidad ?? '',
        provincia: c.provincia ?? '',
        condicionIva: c.condicionIva ?? 'RESPONSABLE_INSCRIPTO',
        plazoCredito: c.plazoCredito ?? 'CONTADO',
        listaPrecioId: c.listaPrecioId ?? '',
      }))
      .catch(() => navigate('/clientes'))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (field: keyof typeof form, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.razonSocial.trim()) { setError('La razón social es obligatoria'); return; }
    setError('');
    setSubmitting(true);
    try {
      const payload = { ...form, listaPrecioId: form.listaPrecioId || undefined };
      if (isEditing) {
        await api.put(`/clientes/${id}`, payload);
      } else {
        await api.post('/clientes', payload);
      }
      navigate('/clientes');
    } catch (e: any) {
      setError(e.message || 'Error al guardar');
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/clientes" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Editar cliente' : 'Nuevo cliente'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isEditing ? 'Modificá los datos del cliente' : 'Completá los datos del nuevo cliente'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Razón social *</label>
            <input className="input" value={form.razonSocial} onChange={e => set('razonSocial', e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CUIT</label>
            <input className="input" placeholder="XX-XXXXXXXX-X" value={form.cuit} onChange={e => set('cuit', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Condición IVA</label>
            <select className="input" value={form.condicionIva} onChange={e => set('condicionIva', e.target.value)}>
              <option value="RESPONSABLE_INSCRIPTO">Responsable Inscripto</option>
              <option value="MONOTRIBUTO">Monotributo</option>
              <option value="EXENTO">Exento</option>
              <option value="CONSUMIDOR_FINAL">Consumidor Final</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plazo de crédito</label>
            <select className="input" value={form.plazoCredito} onChange={e => set('plazoCredito', e.target.value as PlazoCredito)}>
              {PLAZOS.map(p => <option key={p} value={p}>{plazoLabel[p]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lista de precios asignada</label>
            <select className="input" value={form.listaPrecioId} onChange={e => set('listaPrecioId', e.target.value)}>
              <option value="">Sin lista asignada</option>
              {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input className="input" value={form.telefono} onChange={e => set('telefono', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
            <input className="input" placeholder="+54 9 XXX XXX XXXX" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input className="input" value={form.direccion} onChange={e => set('direccion', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Localidad</label>
            <input className="input" value={form.localidad} onChange={e => set('localidad', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
            <input className="input" value={form.provincia} onChange={e => set('provincia', e.target.value)} />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear cliente'}
          </button>
          <Link to="/clientes" className="btn-secondary">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}
