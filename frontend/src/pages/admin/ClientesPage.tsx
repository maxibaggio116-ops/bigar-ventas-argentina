import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Users, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../utils/api';
import { Cliente } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { plazoLabel } from '../../utils/format';

export function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    api.get<Cliente[]>('/clientes')
      .then(setClientes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    try {
      await api.delete(`/clientes/${id}`);
      setClientes(prev => prev.filter(c => c.id !== id));
    } catch (e) { console.error(e); }
    finally { setConfirmDelete(null); }
  }

  const filtrados = clientes.filter(c =>
    c.razonSocial.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.cuit?.includes(busqueda) ||
    c.localidad?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${clientes.length} cliente${clientes.length !== 1 ? 's' : ''} registrados`}
        actions={
          <Link to="/clientes/nuevo" className="btn-primary">
            <Plus className="w-4 h-4 mr-1.5" />
            Nuevo Cliente
          </Link>
        }
      />

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          className="input pl-9"
          placeholder="Buscar por razón social, CUIT o localidad..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin clientes"
          description={busqueda ? 'No hay resultados.' : 'Aún no se registraron clientes.'}
          action={!busqueda ? (
            <Link to="/clientes/nuevo" className="btn-primary">
              <Plus className="w-4 h-4 mr-1.5" />
              Agregar primer cliente
            </Link>
          ) : undefined}
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Razón social</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3 hidden sm:table-cell">CUIT</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3 hidden md:table-cell">Localidad</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3 hidden lg:table-cell">Plazo</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtrados.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-gray-900">{c.razonSocial}</p>
                      {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                      {c.whatsapp && <p className="text-xs text-green-600">📱 {c.whatsapp}</p>}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500 hidden sm:table-cell">{c.cuit ?? '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-500 hidden md:table-cell">{c.localidad ?? '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-500 hidden lg:table-cell">
                      {plazoLabel[c.plazoCredito] ?? c.plazoCredito}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/clientes/${c.id}/editar`} className="text-gray-400 hover:text-primary transition-colors">
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button onClick={() => setConfirmDelete(c.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} title="Dar de baja cliente" size="sm">
        <p className="text-sm text-gray-600 mb-6">
          ¿Confirmas que querés dar de baja a <strong>{clientes.find(c => c.id === confirmDelete)?.razonSocial}</strong>?
          El cliente se desactiva pero sus pedidos se conservan.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setConfirmDelete(null)} className="btn-secondary">Cancelar</button>
          <button onClick={() => handleDelete(confirmDelete!)} className="btn-primary bg-red-600 hover:bg-red-700">Dar de baja</button>
        </div>
      </Modal>
    </div>
  );
}
