import { useState, useEffect, useRef, useCallback } from 'react';
import { BarChart3, Download, FileSpreadsheet, Calendar, DatabaseBackup, ShieldCheck, Clock, Users, Package, FileText, ImageDown, RefreshCw } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { api } from '../../utils/api';
import { PageHeader } from '../../components/ui/PageHeader';
import { formatCurrency } from '../../utils/format';

type TabKey = 'ventas' | 'productos' | 'clientes' | 'clientes_detalle' | 'backup';
type Granularidad = 'auto' | 'dia' | 'bisemanal' | 'mes';

interface ChartData {
  tipo: 'line' | 'bar' | 'pie' | 'none';
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  yLabel: string;
}

const TABS: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
  { key: 'ventas', label: 'Ventas por período', icon: BarChart3 },
  { key: 'productos', label: 'Productos más vendidos', icon: FileSpreadsheet },
  { key: 'clientes', label: 'Ranking clientes', icon: Users },
  { key: 'clientes_detalle', label: 'Detalle por cliente', icon: FileSpreadsheet },
  { key: 'backup', label: 'Backup completo', icon: DatabaseBackup },
];

const BAR_COLORS = ['#166534', '#15803d', '#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];

const BACKUP_SHEETS = [
  { icon: Users, label: 'Clientes', desc: 'Todos los clientes con datos de contacto y crédito' },
  { icon: Package, label: 'Productos', desc: 'Catálogo completo con precios, categorías y stock' },
  { icon: FileSpreadsheet, label: 'Listas de Precios', desc: 'Precios por lista para cada producto' },
  { icon: FileText, label: 'Pedidos', desc: 'Todos los pedidos con estado, totales y transporte' },
  { icon: FileText, label: 'Items de Pedidos', desc: 'Detalle línea a línea de cada pedido' },
  { icon: Package, label: 'Stock y Movimientos', desc: 'Stock actual e historial de movimientos' },
  { icon: FileText, label: 'Comex', desc: 'Operaciones de importación y exportación' },
];

function getMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
}

function formatXAxis(value: string, tipo: TabKey) {
  if (tipo === 'ventas') {
    const d = new Date(value);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }
  return value;
}

export function ReportesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('ventas');
  const [dateRange, setDateRange] = useState(getMonthRange());
  const [downloading, setDownloading] = useState(false);
  const [backupDownloading, setBackupDownloading] = useState(false);
  const [backupOk, setBackupOk] = useState(false);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [granularidad, setGranularidad] = useState<Granularidad>('auto');
  const chartRef = useRef<HTMLDivElement>(null);

  const loadChart = useCallback(async () => {
    if (activeTab === 'backup') return;
    setChartLoading(true);
    try {
      const params = new URLSearchParams({ tipo: activeTab, from: dateRange.from, to: dateRange.to, granularidad });
      const data = await api.get<ChartData>(`/reportes/chart?${params}`);
      setChartData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setChartLoading(false);
    }
  }, [activeTab, dateRange, granularidad]);

  useEffect(() => {
    loadChart();
  }, [loadChart]);

  async function downloadReport() {
    setDownloading(true);
    try {
      const params = new URLSearchParams({ tipo: activeTab, from: dateRange.from, to: dateRange.to });
      const blob = await api.download(`/reportes/excel?${params}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-${activeTab}-${dateRange.from}-${dateRange.to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  }

  async function downloadBackup() {
    setBackupDownloading(true);
    setBackupOk(false);
    try {
      const blob = await api.download('/reportes/backup');
      const fecha = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-jugos-${fecha}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupOk(true);
      setTimeout(() => setBackupOk(false), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setBackupDownloading(false);
    }
  }

  function downloadChart() {
    if (!chartRef.current) return;
    const svg = chartRef.current.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = svg.clientWidth || 800;
    canvas.height = svg.clientHeight || 400;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.download = `grafico-${activeTab}-${dateRange.from}-${dateRange.to}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }

  const DESCS: Record<TabKey, string> = {
    ventas: 'Evolucion de ventas en el periodo seleccionado.',
    productos: 'Top productos por cajas vendidas en el periodo.',
    clientes: 'Participacion de cada cliente en las ventas del periodo (torta).',
    clientes_detalle: 'Ranking de clientes por monto total (el Excel detalla sabor por sabor).',
    backup: '',
  };

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Graficos y exportacion en Excel" />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reportes normales */}
      {activeTab !== 'backup' && (
        <div className="space-y-5">
          {/* Filtros + descarga */}
          <div className="card max-w-2xl">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">{TABS.find(t => t.key === activeTab)?.label}</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><Calendar className="w-3.5 h-3.5 inline mr-1" />Desde</label>
                <input type="date" className="input" value={dateRange.from}
                  onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><Calendar className="w-3.5 h-3.5 inline mr-1" />Hasta</label>
                <input type="date" className="input" value={dateRange.to}
                  onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4">{DESCS[activeTab]}</p>
            <button onClick={downloadReport} disabled={downloading} className="btn-primary w-full py-3">
              <Download className="w-4 h-4 mr-2" />
              {downloading ? 'Generando archivo...' : 'Descargar Excel'}
            </button>
          </div>

          {/* Grafico preview */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Vista previa del reporte
              </h3>
              <div className="flex items-center gap-2">
                {activeTab === 'ventas' && (
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    {(['auto', 'dia', 'bisemanal', 'mes'] as Granularidad[]).map(g => (
                      <button key={g} onClick={() => setGranularidad(g)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${granularidad === g ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        {g === 'auto' ? 'Auto' : g === 'dia' ? 'Dia' : g === 'bisemanal' ? 'Quincenal' : 'Mes'}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={loadChart} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors" title="Actualizar">
                  <RefreshCw className={`w-4 h-4 ${chartLoading ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={downloadChart} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                  <ImageDown className="w-3.5 h-3.5" />
                  Descargar imagen
                </button>
              </div>
            </div>

            {chartLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !chartData || chartData.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <BarChart3 className="w-10 h-10 mb-2 text-gray-200" />
                <p className="text-sm">Sin datos para el periodo seleccionado</p>
              </div>
            ) : (
              <div ref={chartRef}>
                {chartData.tipo === 'pie' ? (
                  /* Torta de clientes */
                  <ResponsiveContainer width="100%" height={360}>
                    <PieChart>
                      <Pie
                        data={chartData.data}
                        dataKey={chartData.yKey}
                        nameKey={chartData.xKey}
                        cx="50%"
                        cy="50%"
                        outerRadius={130}
                        innerRadius={55}
                        paddingAngle={2}
                        label={({ percent }: { percent: number }) =>
                          percent > 0.04 ? `${(percent * 100).toFixed(1)}%` : ''
                        }
                        labelLine={false}
                      >
                        {chartData.data.map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name]} />
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        iconType="circle"
                        iconSize={10}
                        formatter={(value: string) => (
                          <span style={{ fontSize: 11, color: '#374151' }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={340}>
                    {chartData.tipo === 'line' ? (
                      <LineChart data={chartData.data} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey={chartData.xKey} tick={{ fontSize: 11 }} angle={-35} textAnchor="end"
                          tickFormatter={v => formatXAxis(String(v), activeTab)} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(Number(v) / 1000).toFixed(0)}k`} width={70} />
                        <Tooltip formatter={(v: number) => [formatCurrency(v), chartData.yLabel]} labelFormatter={l => `Periodo: ${l}`} />
                        <Line type="monotone" dataKey={chartData.yKey} stroke="#166534" strokeWidth={2.5} dot={{ r: 3, fill: '#166534' }} activeDot={{ r: 5 }} />
                      </LineChart>
                    ) : (
                      <BarChart data={chartData.data} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }}
                          tickFormatter={v => chartData.yKey === 'total' ? `$${(v / 1000).toFixed(0)}k` : String(v)} />
                        <YAxis type="category" dataKey={chartData.xKey} tick={{ fontSize: 11 }} width={130} />
                        <Tooltip formatter={(v: number) => [
                          chartData.yKey === 'total' ? formatCurrency(v) : `${v} cajas`,
                          chartData.yLabel,
                        ]} />
                        <Bar dataKey={chartData.yKey} radius={[0, 4, 4, 0]}>
                          {chartData.data.map((_, i) => (
                            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backup completo */}
      {activeTab === 'backup' && (
        <div className="max-w-2xl space-y-5">
          <div className="card border-2 border-primary/20">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <DatabaseBackup className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Backup semanal de datos</h2>
                <p className="text-sm text-gray-500 mt-0.5">Descarga toda la informacion del sistema en un unico archivo Excel con multiples hojas. Recomendamos hacerlo una vez por semana.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
              {BACKUP_SHEETS.map((sheet, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 rounded-lg">
                  <sheet.icon className="w-4 h-4 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{sheet.label}</p>
                    <p className="text-xs text-gray-400">{sheet.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            {backupOk ? (
              <div className="flex items-center gap-2 justify-center py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 font-medium text-sm">
                <ShieldCheck className="w-5 h-5" />Backup descargado correctamente!
              </div>
            ) : (
              <button onClick={downloadBackup} disabled={backupDownloading} className="btn-primary w-full py-3 text-base">
                {backupDownloading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Generando backup...</>
                  : <><Download className="w-5 h-5 mr-2" />Descargar Backup Completo</>}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Clock, color: 'blue', title: 'Frecuencia', desc: 'Recomendamos descargar el backup todos los lunes' },
              { icon: ShieldCheck, color: 'green', title: 'Seguridad', desc: 'Guardalo en Google Drive o disco externo' },
              { icon: FileSpreadsheet, color: 'amber', title: 'Formato', desc: 'Excel con 10 hojas, filtros y columnas ordenadas' },
            ].map((c, i) => (
              <div key={i} className="card flex items-start gap-3">
                <div className={`w-9 h-9 bg-${c.color}-50 rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <c.icon className={`w-4 h-4 text-${c.color}-600`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{c.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
