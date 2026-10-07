import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Layout as AppLayout } from './components/layout/Layout';
import { LoginPage } from './pages/shared/LoginPage';
import { DashboardPage } from './pages/shared/DashboardPage';
import { PedidosPage } from './pages/shared/PedidosPage';
import { NuevoPedidoPage } from './pages/shared/NuevoPedidoPage';
import { PedidoDetallePage } from './pages/shared/PedidoDetallePage';
import { EditarPedidoPage } from './pages/shared/EditarPedidoPage';
import { ClientesPage } from './pages/admin/ClientesPage';
import { ClienteFormPage } from './pages/admin/ClienteFormPage';
import { ProductosPage } from './pages/admin/ProductosPage';
import { PreciosPage } from './pages/admin/PreciosPage';
import { ReportesPage } from './pages/admin/ReportesPage';
import { DeudoresPage } from './pages/admin/DeudoresPage';
import { ComexPage } from './pages/admin/ComexPage';
import { StockPage } from './pages/admin/StockPage';
import { TransportePage } from './pages/TransportePage';
import { PedidoWhatsAppPage } from './pages/public/PedidoWhatsAppPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/pedir" element={<PedidoWhatsAppPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/pedidos" element={<PedidosPage />} />
              <Route path="/pedidos/nuevo" element={<NuevoPedidoPage />} />
              <Route path="/pedidos/:id" element={<PedidoDetallePage />} />
              <Route path="/pedidos/:id/editar" element={<EditarPedidoPage />} />
              <Route path="/clientes" element={<ClientesPage />} />
              <Route path="/clientes/nuevo" element={<ClienteFormPage />} />
              <Route path="/clientes/:id/editar" element={<ClienteFormPage />} />
              <Route path="/productos" element={<ProductosPage />} />
              <Route path="/precios" element={<PreciosPage />} />
              <Route path="/stock" element={<StockPage />} />
              <Route path="/deudores" element={<DeudoresPage />} />
              <Route path="/comex" element={<ComexPage />} />
              <Route path="/transporte" element={<TransportePage />} />
              <Route path="/reportes" element={<ReportesPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
