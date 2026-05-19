import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import Login             from './pages/Login';
import DashboardDueno    from './pages/DashboardDueno';
import DashboardVendedor from './pages/DashboardVendedor';
import GestionRifas      from './pages/GestionRifas';
import GestionVendedores from './pages/GestionVendedores';
import BuscarNumero      from './pages/BuscarNumero';
import NumeroGrid        from './pages/NumeroGrid';
import Historial         from './pages/Historial';
import Caja              from './pages/Caja';
import DisenoTicket         from './pages/DisenoTicket';
import Plantillas            from './pages/Plantillas';
import GeneradorPDFTickets  from './pages/GeneradorPDFTickets';
import ImprimirBoletos     from './pages/ImprimirBoletos';
import ClientePublico       from './pages/ClientePublico';
import GestionReservas   from './pages/GestionReservas';
import Tasas             from './pages/Tasas';
import WhatsApp          from './pages/WhatsApp';   // ← NUEVO

function PrivateRoute({ children, rol }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="d-flex align-items-center justify-content-center" style={{ height: '100vh', background: '#0a0a0a' }}>
      <div className="jd-spinner"></div>
    </div>
  );
  if (!user) return <Navigate to="/login" />;
  if (rol && user.rol !== rol) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />

      {/* Redirección raíz según rol */}
      <Route path="/" element={
        <PrivateRoute>
          {user?.rol === 'dueno'
            ? <Navigate to="/dashboard" />
            : <Navigate to="/vender" />}
        </PrivateRoute>
      } />

      {/* ── DUEÑO ── */}
      <Route path="/dashboard"     element={<PrivateRoute rol="dueno"><DashboardDueno /></PrivateRoute>} />
      <Route path="/rifas"         element={<PrivateRoute rol="dueno"><GestionRifas /></PrivateRoute>} />
      <Route path="/vendedores"    element={<PrivateRoute rol="dueno"><GestionVendedores /></PrivateRoute>} />
      <Route path="/numeros"       element={<PrivateRoute rol="dueno"><NumeroGrid /></PrivateRoute>} />
      <Route path="/historial"     element={<PrivateRoute rol="dueno"><Historial /></PrivateRoute>} />
      <Route path="/caja"          element={<PrivateRoute rol="dueno"><Caja /></PrivateRoute>} />
      <Route path="/reservas"      element={<PrivateRoute rol="dueno"><GestionReservas /></PrivateRoute>} />
      <Route path="/tasas"         element={<PrivateRoute rol="dueno"><Tasas /></PrivateRoute>} />
      <Route path="/generador-pdf" element={<PrivateRoute rol="dueno"><GeneradorPDFTickets /></PrivateRoute>} />
      <Route path="/imprimir-boletos" element={<PrivateRoute rol="dueno"><ImprimirBoletos /></PrivateRoute>} />

      {/* ── WHATSAPP BUSINESS (nuevo módulo) ── */}
      <Route path="/whatsapp"      element={<PrivateRoute rol="dueno"><WhatsApp /></PrivateRoute>} />

      {/* PÚBLICA — sin autenticación */}
      <Route path="/comprar" element={<ClientePublico />} />

      {/* ── DISEÑO DE TICKETS (sistema de plantillas) ── */}
      <Route path="/plantillas"        element={<PrivateRoute rol="dueno"><Plantillas /></PrivateRoute>} />
      <Route path="/plantillas/nueva"  element={<PrivateRoute rol="dueno"><DisenoTicket /></PrivateRoute>} />
      <Route path="/plantillas/:id"    element={<PrivateRoute rol="dueno"><DisenoTicket /></PrivateRoute>} />

      {/* Compatibilidad: /diseno-ticket redirige a /plantillas */}
      <Route path="/diseno-ticket" element={<Navigate to="/plantillas" replace />} />

      {/* ── VENDEDOR ── */}
      <Route path="/vender"        element={<PrivateRoute><BuscarNumero /></PrivateRoute>} />
      <Route path="/mis-ventas"    element={<PrivateRoute><Historial /></PrivateRoute>} />
      <Route path="/mi-dashboard"  element={<PrivateRoute><DashboardVendedor /></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <ToastContainer
          position="top-right"
          autoClose={3500}
          theme="dark"
          toastStyle={{ background: '#181818', border: '1px solid #2a2a2a', fontFamily: "'Rajdhani', sans-serif", fontWeight: 600 }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
