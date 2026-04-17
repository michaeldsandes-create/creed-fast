import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { mapSupabaseSettings } from './lib/supabase-mapper';
import { AppSettings } from './types';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import EditClient from './pages/EditClient';
import Loans from './pages/Loans';
import ClientDetails from './pages/ClientDetails';
import RegisterClient from './pages/RegisterClient';
import PublicRegister from './pages/PublicRegister';
import Login from './pages/Login';
import Settings from './pages/Settings';
import CreditIntelligence from './pages/CreditIntelligence';
import { LayoutDashboard, AlertCircle } from 'lucide-react';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout: O servidor não respondeu a tempo.')), 10000)
        );
        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any;
        if (error) throw error;
        setUser(session?.user ?? null);
      } catch (err: any) {
        console.error("Supabase auth initialization error:", err);
        setInitError(err.message || "Erro ao conectar com o servidor.");
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('settings').select('*').eq('id', 'app').single();
      if (data) {
        const settings = mapSupabaseSettings(data);
        
        // Apply theme
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark', 'claro', 'escuro');
        root.classList.add(settings.tema === 'claro' ? 'light' : 'dark');
        
        // Apply primary color
        if (settings.cor_primaria) {
          root.style.setProperty('--primary-color', settings.cor_primaria);
        }
      }
    };

    fetchSettings();

    const channel = supabase
      .channel('public:settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: 'id=eq.app' }, (payload) => {
        const settings = mapSupabaseSettings(payload.new);
        
        // Apply theme
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark', 'claro', 'escuro');
        root.classList.add(settings.tema === 'claro' ? 'light' : 'dark');
        
        // Apply primary color
        if (settings.cor_primaria) {
          root.style.setProperty('--primary-color', settings.cor_primaria);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
        <p className="text-slate-400 text-sm animate-pulse">Iniciando sistema...</p>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-6 text-center">
        <div className="bg-rose-500/10 p-4 rounded-full text-rose-500 mb-6">
          <AlertCircle size={48} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Erro de Conexão</h1>
        <p className="text-slate-400 max-w-md mb-8">
          Não foi possível conectar ao servidor do Supabase. Verifique se as chaves de API estão corretas e se o projeto está ativo.
        </p>
        <div className="bg-slate-800 p-4 rounded-xl text-xs font-mono text-rose-400 mb-8 max-w-full overflow-auto">
          {initError}
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-xl transition-all"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/register/:adminId" element={<PublicRegister />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={user ? <Layout /> : <Navigate to="/login" />}
          >
            <Route index element={<Dashboard />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetails />} />
            <Route path="clients/:id/edit" element={<EditClient />} />
            <Route path="loans" element={<Loans />} />
            <Route path="register" element={<RegisterClient />} />
            <Route path="credit-intelligence" element={<CreditIntelligence />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
