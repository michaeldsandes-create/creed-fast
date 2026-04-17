import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, UserPlus, Settings, LogOut, Menu, X, TrendingUp, ShieldAlert, DollarSign, Gem } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/clients', icon: Users, label: 'Clientes' },
  { path: '/loans', icon: DollarSign, label: 'Empréstimos' },
  { path: '/register', icon: UserPlus, label: 'Cadastrar' },
  { path: '/credit-intelligence', icon: Gem, label: 'Credit Intelligence' },
  { path: '/settings', icon: Settings, label: 'Configurações' },
];

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      const mockUser = localStorage.getItem('mockUser');
      if (mockUser) {
        setIsAdmin(true);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setUserEmail(user.email || null);

      // Check if user is the default admin email
      if (user.email === 'michaeldsandes@gmail.com') {
        setIsAdmin(true);
        return;
      }

      // Check if user has admin role in Supabase
      try {
        const { data, error } = await supabase.from('users').select('role').eq('id', user.id).single();
        if (data && data.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login'; // Force reload to clear state
  };

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto text-amber-500">
            <ShieldAlert size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Acesso Restrito</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Sua conta ({userEmail}) não tem permissão para acessar o painel administrativo.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all"
          >
            Sair e Trocar de Conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 flex-shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <TrendingUp className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-emerald-500 tracking-tighter italic leading-none">CREED-PRO</h1>
            <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Version 2.0 (Alpha)</span>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                location.pathname === item.path
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              )}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="px-4 py-3 mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Usuário</p>
            <p className="text-sm font-bold text-emerald-400 truncate">
              {userEmail || 'Administrador'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-slate-400 hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <TrendingUp className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-emerald-500 tracking-tighter italic leading-none">CREED-PRO</h1>
            <span className="text-[8px] font-bold text-slate-500 tracking-widest uppercase">Version 2.0 (Alpha)</span>
          </div>
        </div>
        <button onClick={() => setIsSidebarOpen(true)} className="text-slate-100">
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-[60] md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="fixed top-0 left-0 bottom-0 w-64 bg-slate-900 z-[70] md:hidden flex flex-col"
            >
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
                    <TrendingUp className="text-white" size={24} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-emerald-500 tracking-tighter italic leading-none">CREED-PRO</h1>
                    <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Version 2.0 (Alpha)</span>
                  </div>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400">
                  <X size={24} />
                </button>
              </div>
              <nav className="flex-1 px-4 space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                      location.pathname === item.path
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    )}
                  >
                    <item.icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                ))}
              </nav>
              <div className="p-4 border-t border-slate-800">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 w-full text-slate-400 hover:text-red-400 transition-colors"
                >
                  <LogOut size={20} />
                  <span className="font-medium">Sair</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 md:p-10 pt-20 md:pt-10 overflow-y-auto w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
