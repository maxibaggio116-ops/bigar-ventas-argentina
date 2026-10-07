import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Printer, Trash2, ChevronRight, ChevronLeft, MessageCircle, Truck, Pencil, FileText, Calendar, MapPin } from 'lucide-react';
import { api } from '../../utils/api';
import { Pedido, EstadoPedido, Transportista } from '../../types';
import { EstadoBadge } from '../../components/ui/EstadoBadge';
import { Modal } from '../../components/ui/Modal';
import { formatCurrency, formatDate, estadoLabel } from '../../utils/format';
import { clsx } from 'clsx';
import { calcularDistanciaDesdePlanta } from '../../utils/distancias';

const TRANSPORTISTAS: { value: Transportista; label: string }[] = [
  { value: 'KLUVER', label: 'Kluver' },
  { value: 'BONJOUR_TUNESSI', label: 'Bonjour Tunessi' },
  { value: 'LEZCANO', label: 'Lezcano' },
  { value: 'OTRO', label: 'Otro' },
];

const FLUJO: EstadoPedido[] = ['BORRADOR', 'CONFIRMADO', 'EN_PREPARACION', 'FACTURADO', 'DESPACHADO', 'ENTREGADO'];

function toInputDate(d?: Date | string | null) {
  if (!d) return new Date().toISOString().slice(0, 10);
  return new Date(d).toISOString().slice(0, 10);
}

export function PedidoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [transportista, setTransportista] = useState<Transportista | ''>('');
  const [transporteCosto, setTransporteCosto] = useState('');
  const [transporteKm, setTransporteKm] = useState('');
  const [chofer, setChofer] = useState('');
  const [guardandoTransporte, setGuardandoTransporte] = useState(false);
  const [transporteGuardado, setTransporteGuardado] = useState(false);
  const [nroFactura, setNroFactura] = useState('');
  const [guardandoFactura, setGuardandoFactura] = useState(false);
  const [facturaGuardada, setFacturaGuardada] = useState(false);

  // Modal para confirmar fecha de facturación
  const [modalFacturar, setModalFacturar] = useState(false);
  const [fechaFacturacionInput, setFechaFacturacionInput] = useState(toInputDate(new Date()));

  // Fecha de facturación editable
  const [fechaFacturadoEdit, setFechaFacturadoEdit] = useState('');
  const [guardandoFechaFacturado, setGuardandoFechaFacturado] = useState(false);
  const [fechaFacturadoGuardada, setFechaFacturadoGuardada] = useState(false);

  useEffect(() => {
    api.get<Pedido>(`/pedidos/${id}`)
      .then(p => {
        setPedido(p);
        if (p.transportista) setTransportista(p.transportista);
        if (p.transporteCosto != null) setTransporteCosto(String(p.transporteCosto));
        if (p.transporteKm != null) {
          setTransporteKm(String(p.transporteKm));
        } else {
          // Auto-calcular km desde la planta según localidad del cliente
          const kmCalculado = calcularDistanciaDesdePlanta((p.cliente as any)?.localidad);
          if (kmCalculado !== null) setTransporteKm(String(kmCalculado));
        }
        if (p.chofer) setChofer(p.chofer);
        if (p.nroFactura) setNroFactura(p.nroFactura);
        if (p.fechaFacturado) setFechaFacturadoEdit(toInputDate(p.fechaFacturado));
      })
      .catch(() => navigate('/pedidos', { replace: true }))
      .finally(() => setLoading(false));
  }, [id]);

  // Avanzar estado normal (sin FACTURADO)
  async function avanzarEstado() {
    if (!pedido) return;
    const idx = FLUJO.indexOf(pedido.estado);
    if (idx < 0 || idx >= FLUJO.length - 1) return;
    const nuevoEstado = FLUJO[idx + 1];

    // Si el siguiente es FACTURADO, mostrar modal con fecha
    if (nuevoEstado === 'FACTURADO') {
      setFechaFacturacionInput(toInputDate(new Date()));
      setModalFacturar(true);
      return;
    }

    setCambiandoEstado(true);
    try {
      const updated = await api.patch<Pedido>(`/pedidos/${id}/estado`, { estado: nuevoEstado });
      setPedido(updated);
    } finally { setCambiandoEstado(false); }
  }

  // Confirmar facturación con fecha
  async function confirmarFacturar() {
    setCambiandoEstado(true);
    setModalFacturar(false);
    try {
      const updated = await api.patch<Pedido>(`/pedidos/${id}/estado`, {
        estado: 'FACTURADO',
        fechaFacturado: fechaFacturacionInput,
      });
      setPedido(updated);
      setFechaFacturadoEdit(toInputDate(updated.fechaFacturado));
    } finally { setCambiandoEstado(false); }
  }

  async function cancelarPedido() {
    setCambiandoEstado(true);
    try {
      const updated = await api.patch<Pedido>(`/pedidos/${id}/estado`, { estado: 'CANCELADO' });
      setPedido(updated);
    } finally { setCambiandoEstado(false); }
  }

  async function eliminarPedido() {
    try {
      await api.delete(`/pedidos/${id}`);
      navigate('/pedidos', { replace: true });
    } catch (e) { console.error(e); }
  }

  async function guardarNroFactura() {
    setGuardandoFactura(true);
    try {
      const updated = await api.patch<Pedido>(`/pedidos/${id}/factura`, { nroFactura: nroFactura || null });
      setPedido(updated);
      setFacturaGuardada(true);
      setTimeout(() => setFacturaGuardada(false), 2500);
    } finally { setGuardandoFactura(false); }
  }

  async function guardarFechaFacturado() {
    setGuardandoFechaFacturado(true);
    try {
      const updated = await api.patch<Pedido>(`/pedidos/${id}/factura`, { fechaFacturado: fechaFacturadoEdit });
      setPedido(updated);
      setFechaFacturadoGuardada(true);
      setTimeout(() => setFechaFacturadoGuardada(false), 2500);
    } finally { setGuardandoFechaFacturado(false); }
  }

  async function guardarTransporte() {
    if (!transportista) return;
    setGuardandoTransporte(true);
    try {
      const updated = await api.patch<Pedido>(`/pedidos/${id}/transporte`, {
        transportista,
        transporteCosto: transporteCosto ? Number(transporteCosto) : null,
        transporteKm: transporteKm ? Number(transporteKm) : null,
        chofer: chofer || null,
      });
      setPedido(updated);
      setTransporteGuardado(true);
      setTimeout(() => setTransporteGuardado(false), 2500);
    } finally { setGuardandoTransporte(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!pedido) return null;

  const idxEstado = FLUJO.indexOf(pedido.estado);
  const puedeAvanzar = idxEstado >= 0 && idxEstado < FLUJO.length - 1 && pedido.estado !== 'CANCELADO';
  const puedeRetroceder = idxEstado > 0 && pedido.estado !== 'CANCELADO' && pedido.estado !== 'ENTREGADO';
  const puedeCancelar = pedido.estado !== 'CANCELADO' && pedido.estado !== 'FACTURADO';
  const puedeEliminar = pedido.estado === 'BORRADOR' || pedido.estado === 'CANCELADO';

  const siguienteEstado = puedeAvanzar ? FLUJO[idxEstado + 1] : null;
  const estadoAnterior = puedeRetroceder ? FLUJO[idxEstado - 1] : null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/pedidos" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">Pedido #{pedido.id.slice(-6).toUpperCase()}</h1>
            <EstadoBadge estado={pedido.estado} />
            {pedido.origenWhatsapp && (
              <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                <MessageCircle className="w-3 h-3" />
                WhatsApp
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{formatDate(pedido.fecha)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="btn-secondary hidden sm:flex">
            <Printer className="w-4 h-4 mr-1.5" />
            Imprimir
          </button>
          {!['FACTURADO','DESPACHADO','ENTREGADO','CANCELADO'].includes(pedido.estado) && (
            <Link to={`/pedidos/${id}/editar`} className="btn-secondary flex items-center gap-1.5">
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">Editar</span>
            </Link>
          )}
          {puedeEliminar && (
            <button onClick={() => setConfirmDelete(true)} className="btn-secondary text-red-600 hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-5">
          {/* Datos */}
          <div className="card grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Cliente</p>
              {pedido.cliente ? (
                <>
                  <p className="font-semibold text-gray-900">{pedido.cliente.razonSocial}</p>
                  {pedido.cliente.cuit && <p className="text-sm text-gray-500">{pedido.cliente.cuit}</p>}
                  {pedido.cliente.localidad && <p className="text-sm text-gray-500">{pedido.cliente.localidad}</p>}
                </>
              ) : (
                <p className="font-semibold text-gray-900">{pedido.nombreContacto ?? '—'}</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Lista de precios</p>
              <p className="font-semibold text-gray-900">{pedido.listaPrecio?.nombre ?? 'Precio base'}</p>
              {pedido.descuento > 0 && (
                <p className="text-sm text-gray-500">Descuento: {pedido.descuento}%</p>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Productos</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-2">Producto</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-2">Cant.</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-2 hidden sm:table-cell">Precio unit.</th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pedido.items?.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-gray-900">{item.producto?.nombre}</p>
                        {item.producto?.codigoInterno && (
                          <p className="text-xs text-gray-400">{item.producto.codigoInterno}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-700 text-right">
                        {item.cantidad} {item.unidad}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500 text-right hidden sm:table-cell">
                        {formatCurrency(item.precioUnitario)}
                      </td>
                      <td className="px-5 py-3 text-sm font-semibold text-gray-900 text-right">
                        {formatCurrency(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notas */}
          {pedido.notas && (
            <div className="card">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notas</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{pedido.notas}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Totales */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Resumen</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatCurrency(pedido.subtotal)}</span>
              </div>
              {pedido.descuento > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Descuento ({pedido.descuento}%)</span>
                  <span className="text-red-600">-{formatCurrency(pedido.subtotal * pedido.descuento / 100)}</span>
                </div>
              )}
              {pedido.descuento > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Base imponible</span>
                  <span>{formatCurrency(pedido.subtotal - pedido.subtotal * pedido.descuento / 100)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">IVA (21%)</span>
                <span>{formatCurrency(pedido.iva ?? 0)}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between font-bold">
                <span>Total c/ IVA</span>
                <span className="text-lg">{formatCurrency(pedido.total)}</span>
              </div>
              {pedido.totalPallets !== undefined && (
                <div className="flex justify-between text-sm text-gray-500 pt-1">
                  <span>Pallets a devolver</span>
                  <span>{pedido.totalPallets?.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Nro de Factura + Fecha de facturación */}
          {['FACTURADO', 'DESPACHADO', 'ENTREGADO'].includes(pedido.estado) && (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-700">Facturación</h2>
              </div>

              {/* Fecha de facturación editable */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  <Calendar className="w-3 h-3 inline mr-1" />
                  Fecha de facturación
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    className="input text-sm flex-1"
                    value={fechaFacturadoEdit}
                    onChange={e => setFechaFacturadoEdit(e.target.value)}
                  />
                  <button
                    onClick={guardarFechaFacturado}
                    disabled={guardandoFechaFacturado || !fechaFacturadoEdit}
                    className="btn-primary text-sm px-3 py-2 whitespace-nowrap"
                  >
                    {guardandoFechaFacturado ? '...' : fechaFacturadoGuardada ? '✓' : 'OK'}
                  </button>
                </div>
              </div>

              {/* Número de factura */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Número de factura</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input text-sm flex-1"
                    placeholder="Ej: A-0001-00000123"
                    value={nroFactura}
                    onChange={e => setNroFactura(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && guardarNroFactura()}
                  />
                  <button
                    onClick={guardarNroFactura}
                    disabled={guardandoFactura}
                    className="btn-primary text-sm px-3 py-2 whitespace-nowrap"
                  >
                    {guardandoFactura ? '...' : facturaGuardada ? '✓' : 'OK'}
                  </button>
                </div>
                {pedido.nroFactura && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    Guardado: <span className="font-medium text-gray-600">{pedido.nroFactura}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Transporte */}
          {['DESPACHADO', 'ENTREGADO', 'FACTURADO'].includes(pedido.estado) && (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Truck className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-700">Transporte</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Empresa</label>
                  <select className="input text-sm" value={transportista} onChange={e => setTransportista(e.target.value as Transportista)}>
                    <option value="">Sin asignar</option>
                    {TRANSPORTISTAS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Costo ($)</label>
                  <input type="number" min={0} step={0.01} className="input text-sm" placeholder="0.00"
                    value={transporteCosto} onChange={e => setTransporteCosto(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                    Kilometraje (km)
                    {pedido.cliente && (pedido.cliente as any).localidad && calcularDistanciaDesdePlanta((pedido.cliente as any).localidad) !== null && (
                      <span className="flex items-center gap-0.5 text-blue-500 font-normal">
                        <MapPin className="w-3 h-3" />
                        calculado desde planta → {(pedido.cliente as any).localidad}
                      </span>
                    )}
                  </label>
                  <input type="number" min={0} step={1} className="input text-sm" placeholder="0"
                    value={transporteKm} onChange={e => setTransporteKm(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Chofer</label>
                  <input type="text" className="input text-sm" placeholder="Nombre del chofer"
                    value={chofer} onChange={e => setChofer(e.target.value)} />
                </div>
                <button onClick={guardarTransporte} disabled={guardandoTransporte || !transportista} className="btn-primary w-full text-sm py-2">
                  {guardandoTransporte ? 'Guardando...' : transporteGuardado ? '✓ Guardado' : 'Guardar transporte'}
                </button>
              </div>
            </div>
          )}

          {/* Acciones */}
          {(puedeAvanzar || puedeRetroceder || puedeCancelar) && (
            <div className="card space-y-2">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Acciones</h2>
              {puedeAvanzar && siguienteEstado && (
                <button onClick={avanzarEstado} disabled={cambiandoEstado}
                  className="btn-primary w-full flex items-center justify-center gap-2">
                  <ChevronRight className="w-4 h-4" />
                  {cambiandoEstado ? 'Actualizando...' : `Pasar a ${estadoLabel[siguienteEstado]}`}
                </button>
              )}
              {puedeRetroceder && estadoAnterior && (
                <button
                  onClick={() => {
                    setCambiandoEstado(true);
                    api.patch<Pedido>(`/pedidos/${id}/estado`, { estado: estadoAnterior })
                      .then(setPedido)
                      .finally(() => setCambiandoEstado(false));
                  }}
                  disabled={cambiandoEstado}
                  className="btn-secondary w-full flex items-center justify-center gap-2 text-gray-600"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {cambiandoEstado ? 'Actualizando...' : `Volver a ${estadoLabel[estadoAnterior]}`}
                </button>
              )}
              {puedeCancelar && (
                <button onClick={cancelarPedido} disabled={cambiandoEstado}
                  className="btn-secondary w-full text-red-600 hover:bg-red-50">
                  Cancelar pedido
                </button>
              )}
            </div>
          )}

          {/* Seguimiento */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Seguimiento</h2>
            <div className="space-y-2">
              {FLUJO.map((estado, i) => {
                const done = idxEstado >= i && pedido.estado !== 'CANCELADO';
                const current = idxEstado === i && pedido.estado !== 'CANCELADO';
                return (
                  <div key={estado} className="flex items-center gap-3">
                    <div className={clsx(
                      'w-2.5 h-2.5 rounded-full flex-shrink-0',
                      done ? (estado === 'FACTURADO' ? 'bg-emerald-500' : 'bg-primary') : 'bg-gray-200',
                      current && 'ring-2 ring-primary ring-offset-1'
                    )} />
                    <span className={clsx('text-sm', done ? 'text-gray-900 font-medium' : 'text-gray-400')}>
                      {estadoLabel[estado]}
                    </span>
                    {estado === 'FACTURADO' && pedido.fechaFacturado && (
                      <span className="text-xs text-gray-400 ml-auto">{formatDate(pedido.fechaFacturado)}</span>
                    )}
                  </div>
                );
              })}
              {pedido.estado === 'CANCELADO' && (
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                  <span className="text-sm text-red-600 font-medium">Cancelado</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: confirmar fecha de facturación */}
      <Modal open={modalFacturar} onClose={() => setModalFacturar(false)} title="Confirmar facturación" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          ¿En qué fecha se facturó el pedido <strong>#{pedido.id.slice(-6).toUpperCase()}</strong>?
        </p>
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de facturación</label>
          <input
            type="date"
            className="input w-full"
            value={fechaFacturacionInput}
            onChange={e => setFechaFacturacionInput(e.target.value)}
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setModalFacturar(false)} className="btn-secondary">Cancelar</button>
          <button onClick={confirmarFacturar} className="btn-primary">
            Confirmar Facturado
          </button>
        </div>
      </Modal>

      {/* Modal: confirmar eliminación */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Eliminar pedido" size="sm">
        <p className="text-sm text-gray-600 mb-6">
          ¿Eliminar el pedido <strong>#{pedido.id.slice(-6).toUpperCase()}</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setConfirmDelete(false)} className="btn-secondary">Cancelar</button>
          <button onClick={eliminarPedido} className="btn-primary bg-red-600 hover:bg-red-700">Eliminar</button>
        </div>
      </Modal>
    </div>
  );
}
