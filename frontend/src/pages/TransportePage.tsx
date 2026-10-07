import { useEffect, useState } from 'react';
import { Truck, DollarSign, MapPin, Package, TrendingUp, Weight } from 'lucide-react';
import { api } from '../utils/api';
import { TransporteKPIs, TransporteViaje, Transportista, PesajeItem, PALLET_KG } from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import { clsx } from 'clsx';
import { calcularDistanciaDesdePlanta } from '../utils/distancias';

const EMPRESA_LABELS: Record<string, string> = {
  KLUVER: 'Kluver',
  BONJOUR_TUNESSI: 'Bonjour Tunessi',
  LEZCANO: 'Lezcano',
  OTRO: 'Otro',
};

const EMPRESA_COLORS: Record<string, string> = {
  KLUVER: 'bg-blue-100 text-blue-700',
  BONJOUR_TUNESSI: 'bg-purple-100 text-purple-700',
  LEZCANO: 'bg-orange-100 text-orange-700',
  OTRO: 'bg-gray-100 text-gray-700',
};

const EMPRESAS = ['KLUVER', 'BONJOUR_TUNESSI', 'LEZCANO', 'OTRO'] as const;

type Tab = 'kpis' | 'historial' | 'pesaje';

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="card flex items-start gap-4">
      <div className="p-2 bg-primary/10 rounded-lg text-primary flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export function TransportePage() {
  const [tab, setTab] = useState<Tab>('kpis');
  const [data, setData] = useState<TransporteKPIs | null>(null);
  const [viajes, setViajes] = useState<TransporteViaje[]>([]);
  const [pesaje, setPesaje] = useState<PesajeItem[]>([]);
  const [filtroEmpresa, setFiltroEmpresa] = useState<Transportista | ''>('');
  const [loading, setLoading] = useState(true);
  const [pesajeLoading, setPesajeLoading] = useState(false);
  const [pesoEdits, setPesoEdits] = useState<Record<string, string>>({});
  const [pesoTeoricoEdits, setPesoTeoricoEdits] = useState<Record<string, string>>({});
  const [guardandoPeso, setGuardandoPeso] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([
      api.get<TransporteKPIs>('/transporte/kpis'),
      api.get<TransporteViaje[]>('/transporte'),
    ]).then(([k, v]) => {
      setData(k);
      setViajes(v);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'pesaje' && pesaje.length === 0) {
      setPesajeLoading(true);
      api.get<PesajeItem[]>('/transporte/pesaje')
        .then(items => {
          setPesaje(items);
          const edits: Record<string, string> = {};
          const teoricoEdits: Record<string, string> = {};
          items.forEach(i => {
            if (i.pesoReal != null) edits[i.id] = String(i.pesoReal);
            if (i.pesoTeorico != null) teoricoEdits[i.id] = String(i.pesoTeorico);
          });
          setPesoEdits(edits);
          setPesoTeoricoEdits(teoricoEdits);
        })
        .finally(() => setPesajeLoading(false));
    }
  }, [tab]);

  async function guardarPeso(id: string) {
    setGuardandoPeso(prev => ({ ...prev, [id]: true }));
    try {
      const pesoReal = pesoEdits[id] !== undefined ? (pesoEdits[id] ? Number(pesoEdits[id]) : null) : undefined;
      const pesoTeorico = pesoTeoricoEdits[id] !== undefined ? (pesoTeoricoEdits[id] ? Number(pesoTeoricoEdits[id]) : null) : undefined;
      await api.patch(`/pedidos/${id}/peso`, { pesoReal, pesoTeorico });
      setPesaje(prev => prev.map(p => p.id === id
        ? { ...p, pesoReal: pesoReal ?? p.pesoReal, pesoTeorico: pesoTeorico ?? p.pesoTeorico }
        : p));
    } finally {
      setGuardandoPeso(prev => ({ ...prev, [id]: false }));
    }
  }

  const viajesFiltrados = filtroEmpresa ? viajes.filter(v => v.transportista === filtroEmpresa) : viajes;

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const kpis = data?.kpis;
  const porEmpresa = data?.porEmpresa ?? {};

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Truck className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transportes</h1>
          <p className="text-sm text-gray-500">KPIs, viajes y control de pesaje · 1 pallet = {PALLET_KG.toLocaleString()} kg</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-gray-100 rounded-xl w-fit">
        {([['kpis', '📊 KPIs'], ['historial', '🚚 Historial'], ['pesaje', '⚖️ Pesaje']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx('px-4 py-2 text-sm font-medium rounded-lg transition-all',
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB KPIs ── */}
      {tab === 'kpis' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard icon={<Truck className="w-5 h-5" />} label="Total viajes" value={String(kpis?.totalViajes ?? 0)} />
            <KpiCard
              icon={<DollarSign className="w-5 h-5" />}
              label="Gasto total"
              value={formatCurrency(kpis?.totalCosto ?? 0)}
              sub={kpis?.promedioCostoPorViaje ? `${formatCurrency(kpis.promedioCostoPorViaje)} / viaje` : undefined}
            />
            <KpiCard
              icon={<MapPin className="w-5 h-5" />}
              label="Km totales"
              value={`${(kpis?.totalKm ?? 0).toLocaleString('es-UY')} km`}
              sub={kpis?.promedioCostoPorKm ? `${formatCurrency(kpis.promedioCostoPorKm)} / km` : undefined}
            />
            <KpiCard icon={<Package className="w-5 h-5" />} label="Pallets despachados" value={(kpis?.totalPallets ?? 0).toFixed(1)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {EMPRESAS.map(empresa => {
              const e = porEmpresa[empresa] ?? { viajes: 0, costo: 0, km: 0, pallets: 0 };
              return (
                <div key={empresa} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${EMPRESA_COLORS[empresa]}`}>
                      {EMPRESA_LABELS[empresa]}
                    </span>
                    <span className="text-sm font-bold text-gray-700">{e.viajes} viajes</span>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Gasto total</span>
                      <span className="font-semibold">{formatCurrency(e.costo)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Km recorridos</span>
                      <span className="font-semibold">{e.km.toLocaleString('es-UY')} km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pallets</span>
                      <span className="font-semibold">{e.pallets.toFixed(1)}</span>
                    </div>
                    {e.km > 0 && (
                      <div className="flex justify-between text-xs pt-1 border-t border-gray-100">
                        <span className="text-gray-400">Costo / km</span>
                        <span className="text-gray-600">{formatCurrency(e.costo / e.km)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── TAB HISTORIAL ── */}
      {tab === 'historial' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Historial de viajes
            </h2>
            <select className="input py-1.5 text-sm" value={filtroEmpresa}
              onChange={e => setFiltroEmpresa(e.target.value as Transportista | '')}>
              <option value="">Todas las empresas</option>
              {EMPRESAS.map(e => <option key={e} value={e}>{EMPRESA_LABELS[e]}</option>)}
            </select>
          </div>
          {viajesFiltrados.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Truck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">
                {filtroEmpresa ? `No hay viajes con ${EMPRESA_LABELS[filtroEmpresa]}` : 'Aún no hay viajes registrados.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {['Pedido', 'Fecha', 'Cliente', 'Empresa', 'Chofer', 'Km', 'Costo', 'Pallets'].map(h => (
                      <th key={h} className={clsx('text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-2', h !== 'Pedido' && h !== 'Cliente' && h !== 'Empresa' && h !== 'Chofer' ? 'text-right' : 'text-left')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {viajesFiltrados.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-sm font-mono font-medium text-primary">#{v.id.slice(-6).toUpperCase()}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{formatDate(v.fecha)}</td>
                      <td className="px-5 py-3 text-sm text-gray-900">{v.cliente.razonSocial}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${EMPRESA_COLORS[v.transportista]}`}>
                          {EMPRESA_LABELS[v.transportista]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">{v.chofer ?? '—'}</td>
                      <td className="px-5 py-3 text-sm text-right text-gray-600">
                        {v.transporteKm != null
                          ? `${v.transporteKm} km`
                          : (() => {
                              const km = calcularDistanciaDesdePlanta(v.cliente.localidad);
                              return km != null
                                ? <span className="text-blue-400 italic">~{km} km</span>
                                : <span className="text-gray-300">—</span>;
                            })()
                        }
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-semibold text-gray-900">{v.transporteCosto != null ? formatCurrency(v.transporteCosto) : '—'}</td>
                      <td className="px-5 py-3 text-sm text-right text-gray-600">{v.totalPallets?.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB PESAJE ── */}
      {tab === 'pesaje' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <Weight className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-700">Control de pesaje</h2>
            <span className="text-xs text-gray-400 ml-1">— cada pallet = {PALLET_KG.toLocaleString()} kg</span>
          </div>
          {pesajeLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pesaje.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Weight className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No hay pedidos despachados aún.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-2">Pedido</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-2">Cliente</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-2">Empresa</th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-2">Chofer</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-2">Pallets</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-2">Peso teórico</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-2 w-44">Peso real (kg)</th>
                    <th className="px-5 py-2 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pesaje.map(item => {
                    const editReal = pesoEdits[item.id] ?? '';
                    const editTeorico = pesoTeoricoEdits[item.id] ?? '';
                    const pesoRealVal = editReal !== '' ? Number(editReal) : item.pesoReal;
                    const pesoTeoricoVal = editTeorico !== '' ? Number(editTeorico) : item.pesoTeorico;
                    const diff = pesoRealVal != null && pesoTeoricoVal != null ? pesoRealVal - pesoTeoricoVal : null;
                    const changed = editReal !== (item.pesoReal != null ? String(item.pesoReal) : '') ||
                      editTeorico !== (item.pesoTeorico != null ? String(item.pesoTeorico) : '');
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-sm font-mono font-medium text-primary">#{item.id.slice(-6).toUpperCase()}</td>
                        <td className="px-5 py-3 text-sm text-gray-900">{item.cliente.razonSocial}</td>
                        <td className="px-5 py-3">
                          {item.transportista ? (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${EMPRESA_COLORS[item.transportista]}`}>
                              {EMPRESA_LABELS[item.transportista]}
                            </span>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-600">{item.chofer ?? '—'}</td>
                        <td className="px-5 py-3 text-sm text-right text-gray-700">{item.totalPallets?.toFixed(1)}</td>
                        <td className="px-5 py-3 text-right">
                          <input
                            type="number" min={0} step={1}
                            className="input py-1 w-28 text-sm text-right"
                            placeholder="—"
                            value={editTeorico}
                            onChange={e => setPesoTeoricoEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                          />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              type="number" min={0} step={1}
                              className="input py-1 w-28 text-sm text-right"
                              placeholder="—"
                              value={editReal}
                              onChange={e => setPesoEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                            />
                            {diff != null && (
                              <span className={clsx('text-xs font-semibold whitespace-nowrap', diff > 50 ? 'text-red-500' : diff < -50 ? 'text-yellow-500' : 'text-green-600')}>
                                {diff > 0 ? '+' : ''}{diff.toFixed(0)} kg
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => guardarPeso(item.id)}
                            disabled={guardandoPeso[item.id] || !changed}
                            className="btn-primary py-1 px-3 text-xs disabled:opacity-40"
                          >
                            {guardandoPeso[item.id] ? '...' : 'Guardar'}
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
      )}
    </div>
  );
}
