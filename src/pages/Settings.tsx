import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { mapSupabaseSettings, mapSettingsToSupabase } from '../lib/supabase-mapper';
import { AppSettings, Loan, Client } from '../types';
import { Palette, Moon, Sun, Save, Check, Shield, Bell, Info, UserX, Calendar, DollarSign, Settings as SettingsIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatCurrency } from '../lib/utils';
import { format } from 'date-fns';

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>({
    cor_primaria: '#10b981',
    tema: 'escuro',
    notificacao_email: false,
    biometria: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletedClients, setDeletedClients] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase.from('settings').select('*').eq('id', 'app').single();
        if (data) {
          setSettings(mapSupabaseSettings(data));
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }

      try {
        const { data, error } = await supabase.from('deleted_clients').select('*');
        if (data) {
          setDeletedClients(data);
        }
      } catch (error) {
        console.error("Error fetching deleted clients:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    setSaving(true);
    try {
      await supabase.from('settings').upsert({ id: 'app', ...mapSettingsToSupabase(newSettings), updated_at: new Date().toISOString() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="h-10 w-48 bg-slate-800 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="h-64 bg-slate-900 rounded-2xl" />
        <div className="h-64 bg-slate-900 rounded-2xl" />
      </div>
    </div>;
  }

  return (
    <div className="space-y-10 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
        {errorMsg && (
          <div className="absolute top-full mt-2 right-0 bg-rose-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-bold z-50">
            {errorMsg}
          </div>
        )}
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
            <SettingsIcon className="text-emerald-500" size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Configurações</h2>
            <p className="text-slate-400 mt-1">Personalize sua experiência e ajustes do sistema</p>
          </div>
        </div>
        <div className={cn(
          "px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg w-full md:w-auto",
          saved ? "bg-emerald-600 text-white" : "bg-emerald-600/10 text-emerald-500 border border-emerald-500/20"
        )}>
          {saved ? <Check size={24} /> : saving ? <Save className="animate-pulse" size={24} /> : <Save size={24} />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Ajustes Automáticos'}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Appearance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-8">
            <Palette className="text-emerald-500" size={24} />
            <h3 className="text-xl font-bold text-white">Aparência</h3>
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Tema do Sistema</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleSave({ ...settings, tema: 'claro' })}
                  className={cn(
                    "p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all",
                    settings.tema === 'claro' ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-800/50 hover:border-slate-700"
                  )}
                >
                  <Sun className={settings.tema === 'claro' ? "text-emerald-400" : "text-slate-500"} size={24} />
                  <span className={cn("text-sm font-bold", settings.tema === 'claro' ? "text-emerald-400" : "text-slate-400")}>Claro</span>
                </button>
                <button
                  onClick={() => handleSave({ ...settings, tema: 'escuro' })}
                  className={cn(
                    "p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all",
                    settings.tema === 'escuro' ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-800/50 hover:border-slate-700"
                  )}
                >
                  <Moon className={settings.tema === 'escuro' ? "text-emerald-400" : "text-slate-500"} size={24} />
                  <span className={cn("text-sm font-bold", settings.tema === 'escuro' ? "text-emerald-400" : "text-slate-400")}>Escuro</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Cor Primária</label>
              <div className="flex flex-wrap gap-4">
                {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(color => (
                  <button
                    key={color}
                    onClick={() => handleSave({ ...settings, cor_primaria: color })}
                    className={cn(
                      "w-10 h-10 rounded-full border-4 transition-all",
                      settings.cor_primaria === color ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Security & Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-8"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="text-emerald-500" size={24} />
              <h3 className="text-xl font-bold text-white">Segurança</h3>
            </div>
            <div className="space-y-4">
              <button 
                onClick={() => handleSave({ ...settings, notificacao_email: !settings.notificacao_email })}
                className="w-full flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700 hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Bell className="text-slate-400" size={20} />
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">Notificações por Email</p>
                    <p className="text-xs text-slate-500">Avisar clientes sobre status</p>
                  </div>
                </div>
                <div className={cn(
                  "w-12 h-6 rounded-full relative transition-colors",
                  settings.notificacao_email ? "bg-emerald-600" : "bg-slate-700"
                )}>
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                    settings.notificacao_email ? "right-1" : "left-1"
                  )} />
                </div>
              </button>
              <button
                onClick={async () => {
                  const newValue = !settings.biometria;
                  
                  if (newValue) {
                    // Request biometric auth
                    if (window.PublicKeyCredential) {
                      try {
                        // Just a dummy check to see if platform authenticator is available
                        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                        if (!available) {
                          setErrorMsg("Dispositivo não compatível com biometria.");
                          setTimeout(() => setErrorMsg(null), 3000);
                          return;
                        }
                      } catch (e) {
                        setErrorMsg("Dispositivo não compatível com biometria.");
                        setTimeout(() => setErrorMsg(null), 3000);
                        return;
                      }
                    } else {
                      setErrorMsg("Dispositivo não compatível com biometria.");
                      setTimeout(() => setErrorMsg(null), 3000);
                      return;
                    }
                  }
                  
                  handleSave({ ...settings, biometria: newValue });
                }}
                className="w-full flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700 hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Shield className="text-slate-400" size={20} />
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">Acesso Biométrico</p>
                    <p className="text-xs text-slate-500">Proteção extra no mobile</p>
                  </div>
                </div>
                <div className={cn(
                  "w-12 h-6 rounded-full relative transition-colors",
                  settings.biometria ? "bg-emerald-600" : "bg-slate-700"
                )}>
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all",
                    settings.biometria ? "right-1" : "left-1"
                  )} />
                </div>
              </button>
            </div>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <Info className="text-emerald-500" size={24} />
              <h3 className="text-xl font-bold text-white">Sobre o CREED-FAST</h3>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              Version 2.0.0 (Alpha)<br />
              Desenvolvido para gestão eficiente de crédito e cobrança. Todos os dados são criptografados e armazenados com segurança.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Clientes Excluídos */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-sm"
      >
        <div className="flex items-center gap-3 mb-6">
          <UserX className="text-rose-500" size={24} />
          <h3 className="text-xl font-bold text-white">Clientes Excluídos</h3>
        </div>
        
        {deletedClients.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum cliente excluído encontrado.</p>
        ) : (
          <div className="space-y-4">
            {deletedClients.map(client => {
              const deletedDate = client.deletedAt?.toDate ? client.deletedAt.toDate() : new Date();
              const totalBorrowed = client.loans?.reduce((acc: number, l: any) => acc + (l.principal || 0), 0) || 0;
              
              return (
                <div key={client.id} className="flex flex-col p-4 bg-slate-800/30 rounded-2xl border border-slate-800 gap-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
                        {client.selfieUrl ? (
                          <img src={client.selfieUrl} alt={client.name} className="w-full h-full object-cover" />
                        ) : (
                          <UserX className="text-slate-500" size={20} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{client.name}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <Calendar size={12} />
                          <span>Excluído em: {format(deletedDate, "dd/MM/yyyy")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-slate-500 mb-1">Total Pego</p>
                        <p className="text-sm font-bold text-white flex items-center gap-1 justify-end">
                          <DollarSign size={14} className="text-emerald-500" />
                          {formatCurrency(totalBorrowed)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 mb-1">Empréstimos</p>
                        <span className="text-sm font-bold text-slate-300">
                          {client.loans?.length || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {client.loans && client.loans.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Histórico de Empréstimos</p>
                      <div className="space-y-2">
                        {client.loans.map((loan: any) => {
                          const loanDate = loan.startDate?.toDate ? loan.startDate.toDate() : (loan.startDate ? new Date(loan.startDate) : null);
                          return (
                            <div key={loan.id} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                              <div>
                                <p className="text-sm font-bold text-white">{loan.type === 'simple' ? 'Juros Mensal' : 'Parcelado'}</p>
                                <p className="text-xs text-slate-500">
                                  {loanDate ? format(loanDate, "dd/MM/yyyy") : 'Data indisponível'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-emerald-400">{formatCurrency(loan.principal)}</p>
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                                  {loan.status === 'paid' ? 'Pago' : (loan.status === 'overdue' ? 'Em Atraso' : 'Ativo')}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
