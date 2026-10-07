import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, ShoppingCart, TrendingUp,
  BarChart3, X, Droplets, AlertTriangle, Globe, Boxes, Truck,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps { open: boolean; onClose: () => void; }

const linksAll = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true, adminOnly: false },
  { to: '/pedidos', icon: ShoppingCart, label: 'Pedidos', adminOnly: false },
  { to: '/clientes', icon: Users, label: 'Clientes', adminOnly: false },
  { to: '/productos', icon: Package, label: 'Productos', adminOnly: true },
  { to: '/precios', icon: TrendingUp, label: 'Listas de Precios', adminOnly: true },
  { to: '/stock', icon: Boxes, label: 'Stock', adminOnly: false },
  { to: '/deudores', icon: AlertTriangle, label: 'Deudores', adminOnly: false },
  { to: '/comex', icon: Globe, label: 'Comex', adminOnly: false },
  { to: '/transporte', icon: Truck, label: 'Transportes', adminOnly: false },
  { to: '/reportes', icon: BarChart3, label: 'Reportes', adminOnly: false },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const links = linksAll.filter(l => !l.adminOnly || isAdmin);

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={onClose} />
      )}
      <aside className={clsx(
        'fixed lg:static inset-y-0 left-0 z-30 flex flex-col bg-primary text-white transition-all duration-300',
        open ? 'w-64' : 'w-0 lg:w-16 overflow-hidden'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-green-900 min-h-[64px]">
          <div className="flex-shrink-0 w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <Droplets className="w-5 h-5 text-white" />
          </div>
          {open && (
            <div className="overflow-hidden">
              <p className="font-bold text-sm leading-tight whitespace-nowrap">Bigar S.A.</p>
              <p className="text-xs text-green-300 whitespace-nowrap">Gestión de Ventas</p>
            </div>
          )}
          <button onClick={onClose} className="ml-auto lg:hidden text-green-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {links.map(({ to, icon: Icon, label, exact, adminOnly: _ }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors text-sm font-medium',
                isActive ? 'bg-green-900 text-white' : 'text-green-200 hover:bg-green-900 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {open && <span className="whitespace-nowrap">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        {open && user && (
          <div className="px-4 py-4 border-t border-green-900">
            <p className="text-xs text-green-300">Conectado como</p>
            <p className="text-sm font-medium truncate">{user.nombre}</p>
            <span className="text-xs bg-green-900 px-2 py-0.5 rounded-full mt-1 inline-block">
              {user.role === 'ADMIN' ? 'Administrador' : 'Operador'}
            </span>
          </div>
        )}
      </aside>
    </>
  );
}
