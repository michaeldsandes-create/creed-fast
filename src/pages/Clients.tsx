import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { mapSupabaseClient, mapClientToSupabase } from '../lib/supabase-mapper';
import { Client } from '../types';
import { Search, UserPlus, ExternalLink, Filter, CheckCircle, Clock, XCircle, AlertCircle, Trash2, Pencil, Users, MailCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatCpf, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmationModal from '../components/ConfirmationModal';
import { sendEmailNotification } from '../services/emailService';

const statusColors = {
  'Em análise': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'Aprovado': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'Rejeitado': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  'Aguardando caixa': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
};

const statusIcons = {
  'Em análise': Clock,
  'Aprovado': CheckCircle,
  'Rejeitado': XCircle,
  'Aguardando caixa': AlertCircle,
};

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; clientId: string | null }>({
    isOpen: false,
    clientId: null
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [availableCapital, setAvailableCapital] = useState(0);
  const [emailNotification, setEmailNotification] = useState<{show: boolean, clientName: string}>({show: false, clientName: ''});

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase.from('settings').select('*').eq('id', 'app').single();
      if (data) {
        setAvailableCapital(data.available_capital || 0);
      }
    };

    const fetchClients = async () => {
      const { data, error } = await supabase.from('clients').select('*');
      if (data) {
        setClients(data.map(mapSupabaseClient));
      }
      setLoading(false);
    };

    fetchSettings();
    fetchClients();

    const settingsSub = supabase.channel(`settings-changes-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: 'id=eq.app' }, fetchSettings)
      .subscribe();

    const clientsSub = supabase.channel(`clients-changes-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, fetchClients)
      .subscribe();

    return () => {
      supabase.removeChannel(settingsSub);
      supabase.removeChannel(clientsSub);
    };
  }, []);

  // Automation: Check if Aguardando Caixa can be approved
  useEffect(() => {
    const checkAguardandoCaixa = async () => {
      const aguardando = clients.filter(c => c.status === 'Aguardando caixa');
      
      const approvalPromises = aguardando.map(async (client) => {
        if (client.requestedAmount && availableCapital >= client.requestedAmount) {
          try {
            await supabase.from('clients').update({
              status: 'Aprovado',
              updated_at: new Date().toISOString()
            }).eq('id', client.id);
            
            // Show email notification
            setEmailNotification({ show: true, clientName: client.name });
            setTimeout(() => setEmailNotification({ show: false, clientName: '' }), 5000);
            
            // Send real email notification (fire and forget)
            sendEmailNotification(
              client.email,
              `Crédito Liberado - CREED-FAST`,
              `Olá ${client.name}, seu crédito foi liberado! Já temos o valor disponível conforme solicitado.`
            );
          } catch (error) {
            console.error("Error updating client status:", error);
          }
        }
      });
      
      if (approvalPromises.length > 0) {
        await Promise.all(approvalPromises);
      }
    };

    if (clients.length > 0 && availableCapital > 0) {
      checkAguardandoCaixa();
    }
  }, [clients, availableCapital]);

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                           c.cpf.includes(search) || 
                           c.email.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filterStatus ? c.status === filterStatus : true;
      return matchesSearch && matchesFilter;
    });
  }, [clients, search, filterStatus]);

  const handleDelete = async () => {
    if (!deleteModal.clientId) return;
    
    setIsDeleting(true);
    try {
      const clientToDelete = clients.find(c => c.id === deleteModal.clientId);
      if (clientToDelete) {
        // Audit log
        await supabase.from('deleted_clients').insert({
          original_id: clientToDelete.id,
          name: clientToDelete.name,
          cpf: clientToDelete.cpf,
        });
      }

      await supabase.from('clients').delete().eq('id', deleteModal.clientId);
      setDeleteModal({ isOpen: false, clientId: null });
    } catch (error) {
      console.error("Error deleting client:", error);
      alert("Erro ao excluir cliente. Verifique as permissões.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 relative">
      {/* Email Notification Toast */}
      <AnimatePresence>
        {emailNotification.show && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl shadow-emerald-500/20 flex items-center gap-4"
          >
            <div className="bg-white/20 p-2 rounded-full">
              <MailCheck size={24} />
            </div>
            <div>
              <p className="font-bold">Email Automático Enviado!</p>
              <p className="text-sm text-emerald-50">O crédito de {emailNotification.clientName} foi liberado.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shrink-0">
            <Users className="text-emerald-500" size={32} />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Status dos Clientes</h2>
            <p className="text-sm md:text-base text-slate-400 mt-1">Acompanhe e gerencie as solicitações em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Link
            to="/register"
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 w-full md:w-auto shrink-0"
          >
            <UserPlus size={24} />
            Novo Cliente
          </Link>
        </div>
      </header>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Em análise */}
        <div 
          onClick={() => setFilterStatus(filterStatus === 'Em análise' ? null : 'Em análise')}
          className={cn(
            "bg-slate-900/80 backdrop-blur-xl border p-6 rounded-3xl shadow-xl relative overflow-hidden group cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl",
            filterStatus === 'Em análise' ? "border-blue-500/50 shadow-blue-500/10" : "border-slate-800/50 hover:border-blue-500/30"
          )}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full -mr-10 -mt-10 pointer-events-none transition-transform duration-700 group-hover:scale-150" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform shrink-0">
              <Clock size={24} />
            </div>
            <span className="text-2xl md:text-3xl font-black text-white tracking-tight">
              {clients.filter(c => c.status === 'Em análise').length}
            </span>
          </div>
          <div className="relative z-10">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3">Em análise</h3>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${clients.length ? (clients.filter(c => c.status === 'Em análise').length / clients.length) * 100 : 0}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              />
            </div>
          </div>
        </div>

        {/* Aprovados */}
        <div 
          onClick={() => setFilterStatus(filterStatus === 'Aprovado' ? null : 'Aprovado')}
          className={cn(
            "bg-slate-900/80 backdrop-blur-xl border p-6 rounded-3xl shadow-xl relative overflow-hidden group cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl",
            filterStatus === 'Aprovado' ? "border-emerald-500/50 shadow-emerald-500/10" : "border-slate-800/50 hover:border-emerald-500/30"
          )}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[50px] rounded-full -mr-10 -mt-10 pointer-events-none transition-transform duration-700 group-hover:scale-150" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform shrink-0">
              <CheckCircle size={24} />
            </div>
            <span className="text-2xl md:text-3xl font-black text-white tracking-tight">
              {clients.filter(c => c.status === 'Aprovado').length}
            </span>
          </div>
          <div className="relative z-10">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Aprovados</h3>
            <p className="text-xs text-slate-500 font-medium">Status final positivo</p>
          </div>
        </div>

        {/* Reprovados */}
        <div 
          onClick={() => setFilterStatus(filterStatus === 'Rejeitado' ? null : 'Rejeitado')}
          className={cn(
            "bg-slate-900/80 backdrop-blur-xl border p-6 rounded-3xl shadow-xl relative overflow-hidden group cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl",
            filterStatus === 'Rejeitado' ? "border-rose-500/50 shadow-rose-500/10" : "border-slate-800/50 hover:border-rose-500/30"
          )}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-[50px] rounded-full -mr-10 -mt-10 pointer-events-none transition-transform duration-700 group-hover:scale-150" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-400 border border-rose-500/20 group-hover:scale-110 transition-transform shrink-0">
              <XCircle size={24} />
            </div>
            <span className="text-2xl md:text-3xl font-black text-white tracking-tight">
              {clients.filter(c => c.status === 'Rejeitado').length}
            </span>
          </div>
          <div className="relative z-10">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Reprovados</h3>
            <p className="text-xs text-slate-500 font-medium">Sem ação necessária</p>
          </div>
        </div>

        {/* Aguardando caixa */}
        <div 
          onClick={() => setFilterStatus(filterStatus === 'Aguardando caixa' ? null : 'Aguardando caixa')}
          className={cn(
            "bg-slate-900/80 backdrop-blur-xl border p-6 rounded-3xl shadow-xl relative overflow-hidden group cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl",
            filterStatus === 'Aguardando caixa' ? "border-amber-500/50 shadow-amber-500/10" : "border-slate-800/50 hover:border-amber-500/30"
          )}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[50px] rounded-full -mr-10 -mt-10 pointer-events-none transition-transform duration-700 group-hover:scale-150" />
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform shrink-0">
              <AlertCircle size={24} />
            </div>
            <span className="text-2xl md:text-3xl font-black text-white tracking-tight">
              {clients.filter(c => c.status === 'Aguardando caixa').length}
            </span>
          </div>
          <div className="relative z-10">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Aguardando caixa</h3>
            <p className="text-xs text-slate-500 font-medium">Aprovado, sem saldo</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 shrink-0" size={20} />
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 pl-11 pr-4 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">CPF</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Valor Solicitado</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <AnimatePresence mode="popLayout">
                {filteredClients.map((client) => {
                  const StatusIcon = statusIcons[client.status];
                  return (
                    <motion.tr
                      key={client.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-slate-800/50 transition-colors group"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-emerald-400 font-bold overflow-hidden shrink-0">
                            {client.selfieUrl ? (
                              <img src={client.selfieUrl} alt={client.name} className="w-full h-full object-cover" />
                            ) : (
                              client.name.charAt(0)
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{client.name}</p>
                            <p className="text-xs text-slate-500">{client.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-300 font-mono">
                        {formatCpf(client.cpf)}
                      </td>
                      <td className="px-6 py-5">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                          statusColors[client.status]
                        )}>
                          <StatusIcon size={14} />
                          {client.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-white">
                        {client.requestedAmount ? formatCurrency(client.requestedAmount) : 'N/A'}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            to={`/clients/${client.id}/edit`}
                            className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all shrink-0"
                            title="Editar"
                          >
                            <Pencil size={20} />
                          </Link>
                          <Link
                            to={`/clients/${client.id}`}
                            className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all shrink-0"
                            title="Ver detalhes"
                          >
                            <ExternalLink size={20} />
                          </Link>
                          <button
                            onClick={() => setDeleteModal({ isOpen: true, clientId: client.id })}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all shrink-0"
                            title="Excluir"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
          
          {filteredClients.length === 0 && !loading && (
            <div className="p-12 text-center">
              <div className="bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                <Search size={32} />
              </div>
              <h3 className="text-lg font-bold text-white">Nenhum cliente encontrado</h3>
              <p className="text-slate-400">Tente ajustar sua busca ou filtros.</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, clientId: null })}
        onConfirm={handleDelete}
        title="Excluir Cliente"
        message="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita e todos os dados associados serão removidos."
        confirmText="Excluir"
        isLoading={isDeleting}
      />
    </div>
  );
}
