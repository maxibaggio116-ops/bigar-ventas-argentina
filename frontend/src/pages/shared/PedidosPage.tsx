import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, ShoppingCart, Filter, MessageCircle } from 'lucide-react';
import { api } from '../../utils/api';
import { Pedido, EstadoPedido } from '../../types';
import { EstadoBadge } from '../../components/ui/EstadoBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, formatDate, estadoLabel } from '../../utils/format';

const ESTADOS: EstadoPedido[] = ['BORRADOR', 'CONFIRMADO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO', 'FACTURADO', 'CANCELADO'];

export function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoPedido | ''>('');

  useEffect(() => {
    api.get<Pedido[]>('/pedidos')
      .then(setPedidos)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtrados = pedidos.filter(p => {
    const matchEstado = !estadoFiltro || p.estado === estadoFiltro;
    const matchBusqueda = !busqueda ||
      p.id.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.cliente?.razonSocial?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.nombreContacto?.toLowerCase().includes(busqueda.toLowerCase());
    return matchEstado && matchBusqueda;
  });

  return (
    <div>
      <PageHeader
        title="Pedidos"
        subtitle={`${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''} en total`}
        actions={
          <Link to="/pedidos/nuevo" className="btn-primary">
            <Plus className="w-4 h-4 mr-1.5" />
            Nuevo Pedido
          </Link>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" className="input pl-9" placeholder="Buscar por cliente o nombre..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select className="input pl-9 pr-8 appearance-none" value={estadoFiltro}
            onChange={e => setEstadoFiltro(e.target.value as EstadoPedido | '')}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(e => <option key={e} value={e}>{estadoLabel[e]}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Sin pedidos"
          description={busqueda || estadoFiltro ? 'No hay resultados.' : 'Aún no se registraron pedidos.'}
          action={!busqueda && !estadoFiltro ? (
            <Link to="/pedidos/nuevo" className="btn-primary">
              <Plus className="w-4 h-4 mr-1.5" />Crear primer pedido
            </Link>
          ) : undefined}
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Cliente</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3 hidden sm:table-cell">Fecha</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Estado</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtrados.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/pedidos/${p.id}`} className="text-sm font-medium text-primary hover:underline">
                          {p.cliente?.razonSocial ?? p.nombreContacto ?? `#${p.id.slice(-6).toUpperCase()}`}
                        </Link>
                        {p.origenWhatsapp && (
                          <MessageCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        )}
                      </div>
                      {p.cliente?.cuit && <p className="text-xs text-gray-400">{p.cliente.cuit}</p>}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500 hidden sm:table-cell">
                      {formatDate(p.fecha)}
                    </td>
                    <td className="px-5 py-3">
                      <EstadoBadge estado={p.estado} />
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold text-gray-900 text-right">
                      {formatCurrency(p.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
