import { Routes, Route, Navigate } from 'react-router-dom';
import POS from './pages/POS';
import Crops from './pages/Crops';
import Batches from './pages/Batches';
import Sales from './pages/Sales';
import Purchase from './pages/Purchase';
import Customers from './pages/Customers';
import Users from './pages/Users';
import UserLogin from './components/UserLogin';
import Navbar from './components/Navbar';
import BusinessSettings from './pages/BusinessSettings';
import { useAuth } from './context/AuthContext';
import { useBusinessConfig } from './config';
import './index.css';


function RequireAuth({ children }) {
  const { currentUser, loading } = useAuth();
  const { config } = useBusinessConfig();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-500 font-medium">
        <div className="animate-spin mr-2">🌿</div> Loading {config.systemName}...
      </div>
    );
  }
  return currentUser ? children : <Navigate to="/login" replace />;
}

function CropsRoute({ children }) {
  const { currentUser, loading, canViewStock } = useAuth();
  if (loading) return null;
  return currentUser && canViewStock ? children : <Navigate to="/" replace />;
}

function AdminRoute({ children }) {
  const { currentUser, loading, isAdmin } = useAuth();
  if (loading) return null;
  return currentUser && isAdmin ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { currentUser } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 min-w-[420px] text-slate-800 flex flex-col lg:flex-row">
      {currentUser && <Navbar />}
      <main className="flex-1 min-w-0 p-4 lg:p-8 max-w-7xl mx-auto w-full">
        <Routes>
          <Route path="/login" element={<UserLogin />} />
          <Route path="/" element={<RequireAuth><POS /></RequireAuth>} />
          <Route path="/crops" element={<CropsRoute><Crops /></CropsRoute>} />
          <Route path="/batches" element={<CropsRoute><Batches /></CropsRoute>} />
          <Route path="/purchase" element={<RequireAuth><Purchase /></RequireAuth>} />
          <Route path="/sales" element={<RequireAuth><Sales /></RequireAuth>} />
          <Route path="/customers" element={<RequireAuth><Customers /></RequireAuth>} />
          <Route path="/users" element={<AdminRoute><Users /></AdminRoute>} />
          <Route path="/settings" element={<AdminRoute><BusinessSettings /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}