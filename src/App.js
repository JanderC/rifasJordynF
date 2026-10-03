import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import Login             from './pages/Login';
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
import Legal                from './pages/Legal';
import GestionReservas   from './pages/GestionReservas';
import Tasas             from './pages/Tasas';
import WhatsApp          from './pages/WhatsApp';   // ← NUEVO
import Configuracion     from './pages/Configuracion';
import ListaVendedores   from './pages/ListaVendedores';
import CuentasBancarias  from './pages/CuentasBancarias';
import { LOGIN_PATH, rutaInicio } from './config/rutas';

// Sin sesión se manda a la página pública (nunca al login, para no revelar su ruta)
function PrivateRoute({ children, rol }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="d-flex align-items-center justify-content-center" style={{ height: '100vh', background: '#0a0a0a' }}>
      <div className="jd-spinner"></div>
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  if (rol && user.rol !== rol) return <Navigate to={rutaInicio(user)} replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      {/* Login administrativo en ruta privada; /login ya no existe */}
      <Route path={LOGIN_PATH} element={!user ? <Login /> : <Navigate to={rutaInicio(user)} replace />} />

      {/* Página principal del dominio: la tienda pública donde los clientes compran sus números */}
      <Route path="/" element={<ClientePublico />} />

      {/* ── DUEÑO ── */}
      {/* La pantalla principal del dueño quedó fuera: /dashboard manda a /rifas.
          Se deja el redirect para que ningún enlace o marcador viejo se rompa. */}
      <Route path="/dashboard"     element={<Navigate to="/rifas" replace />} />
      <Route path="/rifas"         element={<PrivateRoute rol="dueno"><GestionRifas /></PrivateRoute>} />
      <Route path="/vendedores"    element={<PrivateRoute rol="dueno"><GestionVendedores /></PrivateRoute>} />
      <Route path="/numeros"       element={<PrivateRoute rol="dueno"><NumeroGrid /></PrivateRoute>} />
      <Route path="/historial"     element={<PrivateRoute rol="dueno"><Historial /></PrivateRoute>} />
      <Route path="/caja"          element={<PrivateRoute rol="dueno"><Caja /></PrivateRoute>} />
      <Route path="/reservas"      element={<PrivateRoute rol="dueno"><GestionReservas /></PrivateRoute>} />
      <Route path="/tasas"         element={<PrivateRoute rol="dueno"><Tasas /></PrivateRoute>} />
      <Route path="/cuentas-bancarias" element={<PrivateRoute rol="dueno"><CuentasBancarias /></PrivateRoute>} />
      <Route path="/lista-vendedores" element={<PrivateRoute rol="dueno"><ListaVendedores /></PrivateRoute>} />
      <Route path="/configuracion" element={<PrivateRoute rol="dueno"><Configuracion /></PrivateRoute>} />
      <Route path="/generador-pdf"element={<PrivateRoute rol="dueno"><GeneradorPDFTickets /></PrivateRoute>} />
      <Route path="/imprimir-boletos" element={<PrivateRoute rol="dueno"><ImprimirBoletos /></PrivateRoute>} />

      {/* ── WHATSAPP BUSINESS (nuevo módulo) ── */}
      <Route path="/whatsapp"      element={<PrivateRoute rol="dueno"><WhatsApp /></PrivateRoute>} />

      {/* PÚBLICA — sin autenticación */}
      <Route path="/comprar" element={<Navigate to="/" replace />} />
      <Route path="/terminos"    element={<Legal />} />
      <Route path="/privacidad"  element={<Legal />} />
      <Route path="/aviso-legal" element={<Legal />} />

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

      <Route path="*" element={<Navigate to="/" replace />} />
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