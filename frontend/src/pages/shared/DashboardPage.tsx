import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Package2, TrendingUp, Clock, Plus, AlertTriangle, MessageCircle } from 'lucide-react';
import { api } from '../../utils/api';
import { DashboardData, Pedido, ClienteSilencioso } from '../../types';
import { StatCard } from '../../components/ui/StatCard';
import { EstadoBadge } from '../../components/ui/EstadoBadge';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatCurrency, formatDate } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardData>('/dashboard')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  })();

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${user?.nombre ?? 'Usuario'}`}
        subtitle="Resumen del mes en curso"
        actions={
          <Link to="/pedidos/nuevo" className="btn-primary">
            <Plus className="w-4 h-4 mr-1.5" />
            Nuevo Pedido
          </Link>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Ventas del mes"
          value={formatCurrency(data?.ventasMes ?? 0)}
          subtitle={`${data?.pedidosMes ?? 0} pedidos`}
          icon={TrendingUp}
          trend={data?.tendenciaVentas ?? undefined}
          color="green"
        />
        <StatCard
          title="Pallets despachados"
          value={(data?.palletsMes ?? 0).toFixed(1)}
          subtitle="mes en curso"
          icon={Package2}
          trend={data?.tendenciaPallets ?? undefined}
          color="blue"
        />
        <StatCard
          title="Pedidos del mes"
          value={String(data?.pedidosMes ?? 0)}
          subtitle={`${data?.pedidosPendientes ?? 0} pendientes`}
          icon={ShoppingCart}
          color="orange"
        />
      </div>

      {/* Alerta clientes silenciosos */}
      {data?.clientesSilenciosos && data.clientesSilenciosos.length > 0 && (
        <div className="card mb-6 border border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <h2 className="text-sm font-semibold text-amber-800">
              Clientes sin pedidos hace más de 45 días
            </h2>
            <span className="ml-auto text-xs text-amber-600 font-medium">
              {data.clientesSilenciosos.length} cliente{data.clientesSilenciosos.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {data.clientesSilenciosos.map((c: ClienteSilencioso) => (
              <div key={c.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.razonSocial}</p>
                  <p className="text-xs text-gray-400">
                    {c.diasSinPedido != null
                      ? `Último pedido hace ${c.diasSinPedido} días`
                      : 'Sin pedidos registrados'}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  {c.whatsapp && (
                    <a
                      href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${c.razonSocial}, le habla el equipo de Bigar S.A. ¿Le podemos hacer llegar un pedido?`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded-md font-medium transition-colors"
                    >
                      <MessageCircle className="w-3 h-3" />
                      WhatsApp
                    </a>
                  )}
                  <Link
                    to={`/pedidos/nuevo?clienteId=${c.id}`}
                    className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-2 py-1 rounded-md font-medium transition-colors"
                  >
                    + Pedido
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Pedidos recientes</h2>
          <Link to="/pedidos" className="text-sm text-primary hover:underline font-medium">
            Ver todos
          </Link>
        </div>

        {data?.ultimosPedidos && data.ultimosPedidos.length > 0 ? (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-2">Pedido</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-2">Cliente</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-2 hidden sm:table-cell">Fecha</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-2">Estado</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.ultimosPedidos.map((p: Pedido) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3">
                      <Link to={`/pedidos/${p.id}`} className="text-sm font-medium text-primary hover:underline">
                        #{p.id}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700 max-w-[160px] truncate">
                      {p.cliente?.razonSocial ?? '—'}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500 hidden sm:table-cell">
                      {formatDate(p.fecha)}
                    </td>
                    <td className="px-6 py-3">
                      <EstadoBadge estado={p.estado} />
                    </td>
                    <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                      {formatCurrency(p.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No hay pedidos aún</p>
            <Link to="/pedidos/nuevo" className="mt-3 text-sm text-primary hover:underline font-medium">
              Crear primer pedido
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
