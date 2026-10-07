import { useEffect, useState, useMemo } from 'react';
import { AlertTriangle, Clock, DollarSign, TrendingUp, RefreshCw, CheckCircle, Bell, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../../utils/api';
import { DeudoresData, DeudorItem, DeudorPagado } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, formatDate, plazoLabel } from '../../utils/format';
import { clsx } from 'clsx';

type Tab = 'pendientes' | 'pagados';

function msgRecordatorio(d: DeudorItem): string {
  const vencimiento = new Date(d.fechaVencimiento);
  const fechaStr = vencimiento.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const accion = d.vencido ? 'venció' : 'vence';
  const nroFactura = d.nroFactura ? `N° ${d.nroFactura}` : 'pendiente de número';
  return `Estimado ${d.cliente.razonSocial}, le habla el equipo de Bigar S.A. para recordarle que el día ${fechaStr} ${accion} la factura ${nroFactura}, muchas gracias.`;
}

export function DeudoresPage() {
  const [data, setData] = useState<DeudoresData | null>(null);
  const [pagados, setPagados] = useState<DeudorPagado[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('pendientes');
  const [marcandoPago, setMarcandoPago] = useState<string | null>(null);
  const [editandoFactura, setEditandoFactura] = useState<string | null>(null);
  const [nroFacturaEdit, setNroFacturaEdit] = useState<Record<string, string>>({});

  // Filtros
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroPlazo, setFiltroPlazo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTotalMin, setFiltroTotalMin] = useState('');
  const [filtroTotalMax, setFiltroTotalMax] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<DeudoresData>('/deudores'),
      api.get<DeudorPagado[]>('/deudores/pagados'),
    ]).then(([d, p]) => { setData(d); setPagados(p); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function marcarPagado(pedidoId: string) {
    setMarcandoPago(pedidoId);
    try {
      await api.patch(`/deudores/${pedidoId}/pagar`, {});
      load();
    } finally { setMarcandoPago(null); }
  }

  async function guardarNroFactura(pedidoId: string) {
    const nro = nroFacturaEdit[pedidoId] ?? '';
    setEditandoFactura(pedidoId);
    try {
      await api.patch(`/pedidos/${pedidoId}/factura`, { nroFactura: nro || null });
      load();
    } finally { setEditandoFactura(null); }
  }

  async function revertirPago(pedidoId: string) {
    setMarcandoPago(pedidoId);
    try {
      await api.patch(`/deudores/${pedidoId}/despagar`, {});
      load();
    } finally { setMarcandoPago(null); }
  }

  const kpis = data?.kpis;

  // Deudores filtrados
  const deudoresFiltrados = useMemo(() => {
    return (data?.deudores ?? []).filter(d => {
      if (filtroCliente && !d.cliente.razonSocial.toLowerCase().includes(filtroCliente.toLowerCase())) return false;
      if (filtroPlazo && d.cliente.plazoCredito !== filtroPlazo) return false;
      if (filtroEstado === 'vencido' && !d.vencido) return false;
      if (filtroEstado === 'en_plazo' && d.vencido) return false;
      if (filtroEstado === 'mora21' && d.diasVencido <= 21) return false;
      if (filtroEstado === 'proximo' && !d.proximoVencer) return false;
      if (filtroTotalMin && d.total < Number(filtroTotalMin)) return false;
      if (filtroTotalMax && d.total > Number(filtroTotalMax)) return false;
      return true;
    });
  }, [data, filtroCliente, filtroPlazo, filtroEstado, filtroTotalMin, filtroTotalMax]);

  const alertas5dias = (data?.deudores ?? []).filter(d => d.proximoVencer);

  function descargarXLSX(encabezados: string[], filas: (string | number)[][], anchos: number[], nombreArchivo: string, totalRow?: (string | number)[]) {
    const wb = XLSX.utils.book_new();
    const data: (string | number)[][] = [encabezados, ...filas];
    if (totalRow) data.push(totalRow);
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = anchos.map(w => ({ wch: w }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: encabezados.length - 1 } }) };
    XLSX.utils.book_append_sheet(wb, ws, 'Deudores');
    XLSX.writeFile(wb, nombreArchivo);
  }

  function exportarPendientes() {
    const encabezados = ['Nro Factura', 'Cliente', 'CUIT', 'Plazo', 'Fecha Facturado', 'Fecha Vencimiento', 'Total ($)', 'Días Transcurridos', 'Días Vencido', 'Estado'];
    const filas = deudoresFiltrados.map(d => [
      d.nroFactura ?? '',
      d.cliente.razonSocial,
      d.cliente.cuit ?? '',
      `${plazoLabel[d.cliente.plazoCredito]} (${d.plazo}d)`,
      formatDate(d.fechaFacturado),
      formatDate(d.fechaVencimiento),
      d.total,
      d.diasTranscurridos,
      d.diasVencido,
      d.diasVencido > 21 ? 'Mora +21d' : d.vencido ? 'Vencido' : d.proximoVencer ? 'Próx. vencer' : 'En plazo',
    ]);
    const totalDeuda = deudoresFiltrados.reduce((s, d) => s + d.total, 0);
    const totalRow = ['', 'TOTAL', '', '', '', '', totalDeuda, '', '', ''];
    descargarXLSX(encabezados, filas, [18, 35, 16, 18, 14, 16, 14, 14, 12, 14], `deudores_pendientes_${new Date().toISOString().slice(0,10)}.xlsx`, totalRow);
  }

  function exportarPagados() {
    const encabezados = ['Nro Factura', 'Cliente', 'CUIT', 'Plazo', 'Fecha Facturado', 'Fecha de Pago', 'Total ($)', 'Días hasta Pago'];
    const filas = pagados.map(p => [
      p.nroFactura ?? '',
      p.cliente.razonSocial,
      p.cliente.cuit ?? '',
      `${plazoLabel[p.cliente.plazoCredito]} (${p.plazo}d)`,
      formatDate(p.fechaFacturado),
      formatDate(p.fechaPago),
      p.total,
      p.diasTranscurridos,
    ]);
    const totalCobrado = pagados.reduce((s, p) => s + p.total, 0);
    const totalRow = ['', 'TOTAL', '', '', '', '', totalCobrado, ''];
    descargarXLSX(encabezados, filas, [18, 35, 16, 18, 14, 14, 14, 14], `deudores_pagados_${new Date().toISOString().slice(0,10)}.xlsx`, totalRow);
  }

  return (
    <div>
      <PageHeader
        title="Deudores"
        subtitle="Pedidos facturados pendientes de cobro"
        actions={
          <button onClick={load} className="btn-secondary" disabled={loading}>
            <RefreshCw className={clsx('w-4 h-4 mr-1.5', loading && 'animate-spin')} />
            Actualizar
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Alertas 5 días */}
          {alertas5dias.length > 0 && (
            <div className="mb-5 space-y-2">
              {alertas5dias.map(d => (
                <div key={d.pedidoId} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <Bell className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-800">
                      ⚠ Vence en {d.diasParaVencer} día{d.diasParaVencer !== 1 ? 's' : ''} — {d.cliente.razonSocial}
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5 truncate">{msgRecordatorio(d)}</p>
                  </div>
                  {d.cliente.whatsapp && (
                    <a
                      href={`https://wa.me/${d.cliente.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msgRecordatorio(d))}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex-shrink-0 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      📱 Enviar WA
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard title="Total adeudado" value={formatCurrency(kpis?.totalDeuda ?? 0)} subtitle={`${kpis?.totalDeudores ?? 0} facturas`} icon={DollarSign} color="orange" />
            <StatCard title="Facturas vencidas" value={String(kpis?.vencidos ?? 0)} subtitle={formatCurrency(kpis?.totalVencido ?? 0)} icon={AlertTriangle} color="purple" />
            <StatCard title="Superan 21 días" value={String(kpis?.superan21 ?? 0)} subtitle="con mora extendida" icon={TrendingUp} color="orange" />
            <StatCard title="Máx. morosidad" value={`${kpis?.maxMorosidad ?? 0} días`} subtitle={`Promedio: ${kpis?.promedioDias ?? 0} días`} icon={Clock} color="blue" />
          </div>

          {/* Tabs + botón descarga */}
          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
              <button onClick={() => setTab('pendientes')}
                className={clsx('px-4 py-2 text-sm font-medium rounded-lg transition-all',
                  tab === 'pendientes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                💳 Pendientes ({data?.deudores.length ?? 0})
              </button>
              <button onClick={() => setTab('pagados')}
                className={clsx('px-4 py-2 text-sm font-medium rounded-lg transition-all',
                  tab === 'pagados' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                ✅ Pagados ({pagados.length})
              </button>
            </div>
            <button
              onClick={tab === 'pendientes' ? exportarPendientes : exportarPagados}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Exportar Excel
            </button>
          </div>

          {/* ── TAB PENDIENTES ── */}
          {tab === 'pendientes' && (
            !deudoresFiltrados.length && !data?.deudores.length ? (
              <EmptyState icon={AlertTriangle} title="Sin deudores" description="No hay pedidos facturados pendientes de cobro." />
            ) : (
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2 hidden sm:table-cell">
                          <div>Nro Factura</div>
                          <div className="mt-1 h-7" />
                        </th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2">
                          <div>Cliente</div>
                          <input className="input py-0.5 text-xs font-normal mt-1 w-36" placeholder="Filtrar..." value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} />
                        </th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2 hidden md:table-cell">
                          <div>Plazo</div>
                          <select className="input py-0.5 text-xs font-normal mt-1 w-32" value={filtroPlazo} onChange={e => setFiltroPlazo(e.target.value)}>
                            <option value="">Todos</option>
                            <option value="CONTADO">Contado</option>
                            <option value="DIAS_21">21 días</option>
                            <option value="DIAS_30">30 días</option>
                            <option value="MAS_30">+30 días</option>
                          </select>
                        </th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2 hidden sm:table-cell">
                          <div>Facturado</div>
                          <div className="mt-1 h-7" />
                        </th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2">
                          <div>Total</div>
                          <div className="flex gap-1 mt-1">
                            <input className="input py-0.5 text-xs font-normal w-16" placeholder="Min" value={filtroTotalMin} onChange={e => setFiltroTotalMin(e.target.value)} />
                            <input className="input py-0.5 text-xs font-normal w-16" placeholder="Max" value={filtroTotalMax} onChange={e => setFiltroTotalMax(e.target.value)} />
                          </div>
                        </th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2">
                          <div>Días</div>
                          <div className="mt-1 h-7" />
                        </th>
                        <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2">
                          <div>Estado</div>
                          <select className="input py-0.5 text-xs font-normal mt-1 w-28" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                            <option value="">Todos</option>
                            <option value="en_plazo">En plazo</option>
                            <option value="proximo">Próx. vencer</option>
                            <option value="vencido">Vencido</option>
                            <option value="mora21">Mora +21d</option>
                          </select>
                        </th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {deudoresFiltrados.map((d: DeudorItem) => (
                        <tr key={d.pedidoId} className={clsx('hover:bg-gray-50 transition-colors',
                          d.diasVencido > 21 ? 'bg-red-50/40' : d.proximoVencer ? 'bg-amber-50/30' : '')}>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                className="input py-1 text-xs w-32 font-mono"
                                placeholder="Nro factura"
                                value={nroFacturaEdit[d.pedidoId] ?? d.nroFactura ?? ''}
                                onChange={e => setNroFacturaEdit(prev => ({ ...prev, [d.pedidoId]: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && guardarNroFactura(d.pedidoId)}
                              />
                              <button
                                onClick={() => guardarNroFactura(d.pedidoId)}
                                disabled={editandoFactura === d.pedidoId}
                                className="text-xs bg-gray-100 hover:bg-primary hover:text-white text-gray-600 px-2 py-1 rounded transition-colors"
                                title="Guardar"
                              >
                                {editandoFactura === d.pedidoId ? '...' : '✓'}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{d.cliente.razonSocial}</p>
                            {d.cliente.cuit && <p className="text-xs text-gray-400">{d.cliente.cuit}</p>}
                            {d.cliente.whatsapp && (
                              <a
                                href={`https://wa.me/${d.cliente.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msgRecordatorio(d))}`}
                                target="_blank" rel="noopener noreferrer"
                                className="text-xs text-green-600 hover:underline"
                              >
                                📱 Recordatorio WA
                              </a>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">
                            {plazoLabel[d.cliente.plazoCredito]} ({d.plazo}d)
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <p className="text-sm text-gray-500">{formatDate(d.fechaFacturado)}</p>
                            <p className="text-xs text-gray-400">Vence: {formatDate(d.fechaVencimiento)}</p>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{formatCurrency(d.total)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={clsx('text-sm font-bold',
                              d.diasVencido > 21 ? 'text-red-600' : d.vencido ? 'text-orange-600' : 'text-gray-700')}>
                              {d.diasTranscurridos}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {d.diasVencido > 21 ? (
                              <span className="badge-estado bg-red-100 text-red-700">Mora +21d</span>
                            ) : d.vencido ? (
                              <span className="badge-estado bg-orange-100 text-orange-700">Vencido</span>
                            ) : d.proximoVencer ? (
                              <span className="badge-estado bg-amber-100 text-amber-700">Próx. vencer</span>
                            ) : (
                              <span className="badge-estado bg-blue-100 text-blue-700">En plazo</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => marcarPagado(d.pedidoId)}
                              disabled={marcandoPago === d.pedidoId}
                              className="flex items-center gap-1.5 text-xs bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap disabled:opacity-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              {marcandoPago === d.pedidoId ? 'Marcando...' : 'Pagado'}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {deudoresFiltrados.length === 0 && (data?.deudores.length ?? 0) > 0 && (
                        <tr>
                          <td colSpan={8} className="px-5 py-8 text-center text-sm text-gray-400">
                            No hay resultados con los filtros aplicados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* ── TAB PAGADOS ── */}
          {tab === 'pagados' && (
            pagados.length === 0 ? (
              <EmptyState icon={CheckCircle} title="Sin pagos registrados" description="Cuando marques una factura como pagada aparecerá aquí." />
            ) : (
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Nro Factura', 'Cliente', 'Plazo', 'Facturado', 'Fecha de pago', 'Total', 'Días hasta pago', ''].map(h => (
                          <th key={h} className={clsx('text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3',
                            h === 'Total' || h === 'Días hasta pago' ? 'text-right' : 'text-left',
                            (h === 'Plazo') && 'hidden md:table-cell',
                            (h === 'Facturado') && 'hidden sm:table-cell',
                          )}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pagados.map(p => (
                        <tr key={p.pedidoId} className="hover:bg-gray-50">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                className="input py-1 text-xs w-32 font-mono"
                                placeholder="Nro factura"
                                value={nroFacturaEdit[p.pedidoId] ?? p.nroFactura ?? ''}
                                onChange={e => setNroFacturaEdit(prev => ({ ...prev, [p.pedidoId]: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && guardarNroFactura(p.pedidoId)}
                              />
                              <button
                                onClick={() => guardarNroFactura(p.pedidoId)}
                                disabled={editandoFactura === p.pedidoId}
                                className="text-xs bg-gray-100 hover:bg-primary hover:text-white text-gray-600 px-2 py-1 rounded transition-colors"
                                title="Guardar"
                              >
                                {editandoFactura === p.pedidoId ? '...' : '✓'}
                              </button>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <p className="text-sm font-medium text-gray-900">{p.cliente.razonSocial}</p>
                            {p.cliente.cuit && <p className="text-xs text-gray-400">{p.cliente.cuit}</p>}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-500 hidden md:table-cell">
                            {plazoLabel[p.cliente.plazoCredito]} ({p.plazo}d)
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-500 hidden sm:table-cell">{formatDate(p.fechaFacturado)}</td>
                          <td className="px-5 py-3 text-sm font-medium text-green-700">{formatDate(p.fechaPago)}</td>
                          <td className="px-5 py-3 text-sm font-semibold text-gray-900 text-right">{formatCurrency(p.total)}</td>
                          <td className="px-5 py-3 text-sm text-right text-gray-500">{p.diasTranscurridos} días</td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => revertirPago(p.pedidoId)}
                              disabled={marcandoPago === p.pedidoId}
                              className="text-xs text-gray-400 hover:text-orange-600 border border-gray-200 hover:border-orange-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                            >
                              {marcandoPago === p.pedidoId ? '...' : '↩ Revertir'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
