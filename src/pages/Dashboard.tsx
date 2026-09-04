import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { mapSupabaseClient, mapSupabaseLoan } from '../lib/supabase-mapper';
import { Loan, Client } from '../types';
import { formatCurrency, cn, formatCpf, getLoanStatus } from '../lib/utils';
import { TrendingUp, Calendar, AlertTriangle, DollarSign, X, ArrowRight, CheckCircle, Clock, XCircle, AlertCircle, Users, MailCheck, Zap, PlusCircle, UserPlus, CreditCard, BarChart3, AlertOctagon, Wallet, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { startOfMonth, endOfMonth, isSameDay, format, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import { PaymentModal } from '../components/PaymentModal';
import { sendEmailNotification } from '../services/emailService';

export default function Dashboard() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [emailNotification, setEmailNotification] = useState<{show: boolean, clientName: string}>({show: false, clientName: ''});
  const [summaryModal, setSummaryModal] = useState<{
    isOpen: boolean;
    title: string;
    type: 'active' | 'month' | 'today' | 'overdue' | 'interest';
  }>({
    isOpen: false,
    title: '',
    type: 'active'
  });

  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    loan: Loan | null;
    clientId: string;
  }>({
    isOpen: false,
    loan: null,
    clientId: ''
  });

  useEffect(() => {
    const fetchLoans = async () => {
      try {
        const { data, error } = await supabase.from('loans').select('*');
        if (error) throw error;
        if (data) {
          setLoans(data.map(mapSupabaseLoan).map(l => ({ ...l, status: getLoanStatus(l) })));
        }
      } catch (err: any) {
        console.error('Error fetching loans:', err);
        setFetchError(err.message || 'Erro ao carregar empréstimos.');
      }
    };

    const fetchClients = async () => {
      try {
        const { data, error } = await supabase.from('clients').select('*');
        if (error) throw error;
        if (data) {
          setClients(data.map(mapSupabaseClient));
        }
      } catch (err: any) {
        console.error('Error fetching clients:', err);
        setFetchError(err.message || 'Erro ao carregar clientes.');
      } finally {
        setLoading(false);
      }
    };

    fetchLoans();
    fetchClients();

    const loansSub = supabase.channel(`loans-changes-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, fetchLoans)
      .subscribe();

    const clientsSub = supabase.channel(`clients-changes-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, fetchClients)
      .subscribe();

    return () => {
      supabase.removeChannel(loansSub);
      supabase.removeChannel(clientsSub);
    };
  }, []);

  const {
    activeLoans,
    totalActive,
    loansThisMonth,
    borrowedThisMonth,
    loansDueToday,
    overdueLoans,
    today,
    todayActions,
    next7Days,
    max7DaysAmount,
    cashflowData,
    totalInflow,
    totalOutflow,
    projectedBalance,
    topDebtors,
    interestToReceiveThisMonth,
    loansInterestThisMonth
  } = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const clientMap = new Map(clients.map(c => [c.id, c]));
    const clientIds = new Set(clientMap.keys());

    const activeLoans = loans.filter(l => (l.status === 'active' || l.status === 'overdue') && clientIds.has(l.clientId));
    const totalActive = activeLoans.reduce((acc, l) => acc + (l.remainingAmount || 0), 0);

    const loansThisMonth = loans.filter(l => {
      if (!clientIds.has(l.clientId)) return false;
      if (!l.startDate) return false;
      const date = l.startDate?.toDate ? l.startDate.toDate() : new Date(l.startDate);
      if (isNaN(date.getTime())) return false;
      return date >= monthStart && date <= monthEnd;
    });
    const borrowedThisMonth = loansThisMonth.reduce((acc, l) => acc + (l.principal || 0), 0);

    const loansDueToday = loans.filter(l => {
      if (!clientIds.has(l.clientId)) return false;
      if (!l.nextDueDate) return false;
      const date = l.nextDueDate?.toDate ? l.nextDueDate.toDate() : new Date(l.nextDueDate);
      if (isNaN(date.getTime())) return false;
      return isSameDay(date, now) && l.status !== 'paid';
    });

    const overdueLoans = loans.filter(l => l.status === 'overdue' && clientIds.has(l.clientId));

    const todayActions: { id: string, type: 'payment' | 'overdue' | 'due' | 'pending', title: string, subtitle: string, amount: number, date: Date, clientId: string, client?: Client, loan?: Loan }[] = [];
    
    loansDueToday.forEach(loan => {
      const client = clientMap.get(loan.clientId);
      if (client) todayActions.push({ id: `due-${loan.id}`, type: 'due', title: 'Pagamento Hoje', subtitle: client.name, amount: loan.principal, date: loan.nextDueDate?.toDate ? loan.nextDueDate.toDate() : new Date(), clientId: client.id, loan, client });
    });

    overdueLoans.slice(0, 3).forEach(loan => {
      const client = clientMap.get(loan.clientId);
      if (client) todayActions.push({ id: `overdue-${loan.id}`, type: 'overdue', title: 'Em Atraso', subtitle: client.name, amount: loan.principal, date: loan.nextDueDate?.toDate ? loan.nextDueDate.toDate() : new Date(), clientId: client.id, loan, client });
    });

    clients.filter(c => c.status === 'Aguardando caixa').slice(0, 2).forEach(client => {
      todayActions.push({ id: `pending-${client.id}`, type: 'pending', title: 'Aguardando Caixa', subtitle: client.name, amount: 0, date: new Date(), clientId: client.id, client });
    });

    const next7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const amount = activeLoans.filter(l => {
        if (!l.nextDueDate) return false;
        const dueDate = l.nextDueDate?.toDate ? l.nextDueDate.toDate() : new Date(l.nextDueDate);
        if (isNaN(dueDate.getTime())) return false;
        return isSameDay(dueDate, d);
      }).reduce((acc, l) => acc + (l.installmentValue || 0), 0);
      return { date: d, amount };
    });
    const max7DaysAmount = Math.max(...next7Days.map(d => d.amount), 1);

    const cashflowData = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      
      const inflow = activeLoans.filter(l => {
        if (!l.nextDueDate) return false;
        const dueDate = l.nextDueDate?.toDate ? l.nextDueDate.toDate() : new Date(l.nextDueDate);
        if (isNaN(dueDate.getTime())) return false;
        return isSameDay(dueDate, d);
      }).reduce((acc, l) => acc + (l.installmentValue || 0), 0);

      const outflow = i === 0 ? clients.filter(c => c.status === 'Aguardando caixa').reduce((acc, c) => acc + (c.requestedAmount || 0), 0) : 0;

      return {
        name: format(d, 'EEE', { locale: ptBR }),
        Entradas: inflow,
        Saídas: outflow,
        date: d
      };
    });

    const totalInflow = cashflowData.reduce((acc, day) => acc + day.Entradas, 0);
    const totalOutflow = cashflowData.reduce((acc, day) => acc + day.Saídas, 0);
    const projectedBalance = totalInflow - totalOutflow;

    const clientDebts = clients.map(client => {
      const clientLoans = activeLoans.filter(l => l.clientId === client.id);
      const totalDebt = clientLoans.reduce((acc, l) => acc + (l.remainingAmount || 0), 0);
      return { client, totalDebt };
    }).filter(c => c.totalDebt > 0);
    
    const topDebtors = clientDebts.sort((a, b) => b.totalDebt - a.totalDebt).slice(0, 3);

    const loansInterestThisMonth = activeLoans.filter(l => {
      if (!l.nextDueDate) return false;
      const dueDate = l.nextDueDate?.toDate ? l.nextDueDate.toDate() : new Date(l.nextDueDate);
      if (isNaN(dueDate.getTime())) return false;
      return dueDate <= monthEnd;
    });

    const interestToReceiveThisMonth = loansInterestThisMonth.reduce((acc, l) => {
      if (l.type === 'simple') {
        return acc + (l.installmentValue || 0);
      } else {
        return acc + ((l.interestRate || 0) / (l.installments || 1));
      }
    }, 0);

    return {
      activeLoans,
      totalActive,
      loansThisMonth,
      borrowedThisMonth,
      loansDueToday,
      overdueLoans,
      today,
      todayActions,
      next7Days,
      max7DaysAmount,
      cashflowData,
      totalInflow,
      totalOutflow,
      projectedBalance,
      topDebtors,
      interestToReceiveThisMonth,
      loansInterestThisMonth
    };
  }, [loans, clients]);

  const stats = [
    { 
      label: 'Capital Ativo', 
      value: formatCurrency(totalActive), 
      icon: DollarSign, 
      color: 'text-emerald-400', 
      bg: 'bg-emerald-500/10',
      gradient: 'from-emerald-500/20 to-emerald-900/20',
      shadow: 'shadow-emerald-500/20',
      type: 'active' as const
    },
    { 
      label: 'Emprestado no Mês', 
      value: formatCurrency(borrowedThisMonth), 
      icon: TrendingUp, 
      color: 'text-blue-400', 
      bg: 'bg-blue-500/10',
      gradient: 'from-blue-500/20 to-blue-900/20',
      shadow: 'shadow-blue-500/20',
      type: 'month' as const
    },
    { 
      label: 'Vencimentos Hoje', 
      value: loansDueToday.length, 
      icon: Calendar, 
      color: 'text-purple-400', 
      bg: 'bg-purple-500/10',
      gradient: 'from-purple-500/20 to-purple-900/20',
      shadow: 'shadow-purple-500/20',
      type: 'today' as const
    },
    { 
      label: 'Em Atraso', 
      value: overdueLoans.length, 
      icon: AlertTriangle, 
      color: 'text-rose-400', 
      bg: 'bg-rose-500/10',
      gradient: 'from-rose-500/20 to-rose-900/20',
      shadow: 'shadow-rose-500/20',
      type: 'overdue' as const
    },
    { 
      label: 'Receber no Mês', 
      value: formatCurrency(interestToReceiveThisMonth), 
      icon: Wallet, 
      color: 'text-amber-400', 
      bg: 'bg-amber-500/10',
      gradient: 'from-amber-500/20 to-amber-900/20',
      shadow: 'shadow-amber-500/20',
      type: 'interest' as const
    },
  ];

  const getSummaryData = () => {
    switch (summaryModal.type) {
      case 'active': return activeLoans;
      case 'month': return loansThisMonth;
      case 'today': return loansDueToday;
      case 'overdue': return overdueLoans;
      case 'interest': return loansInterestThisMonth;
      default: return [];
    }
  };

  const handleNotifyClient = async (client: Client) => {
    try {
      await supabase.from('clients').update({
        status: 'Aprovado'
      }).eq('id', client.id);
      
      // Fire and forget
      sendEmailNotification(
        client.email,
        `Crédito Liberado - CREED-FAST`,
        `Olá ${client.name}, seu crédito foi liberado! Já temos o valor disponível conforme solicitado.`
      );
      
      setEmailNotification({ show: true, clientName: client.name });
      setTimeout(() => setEmailNotification({ show: false, clientName: '' }), 5000);
    } catch (error) {
      console.error("Error notifying client:", error);
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-900 rounded-2xl border border-slate-800" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="h-96 bg-slate-900 rounded-2xl border border-slate-800" />
        <div className="h-96 bg-slate-900 rounded-2xl border border-slate-800" />
      </div>
    </div>;
  }

  if (fetchError) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-500">
          <AlertTriangle size={32} />
        </div>
        <h3 className="text-xl font-bold text-white">Erro ao carregar dados</h3>
        <p className="text-slate-400 max-w-md mx-auto">
          Ocorreu um problema ao buscar as informações do banco de dados. Verifique sua conexão ou as configurações do Supabase.
        </p>
        <div className="bg-slate-900 p-4 rounded-xl text-xs font-mono text-rose-400 overflow-auto max-w-full">
          {fetchError}
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-xl transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10 relative">
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
              <p className="font-bold">Email Enviado!</p>
              <p className="text-sm text-emerald-50">O cliente {emailNotification.clientName} foi notificado.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)] shrink-0">
            <LayoutDashboard className="text-emerald-500" size={32} />
          </div>
          <div>
            <h2 className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-emerald-400 bg-clip-text text-2xl font-black leading-none tracking-[0.08em] text-transparent drop-shadow-[0_0_18px_rgba(45,212,191,0.25)] md:text-3xl">
              PAINEL DE CONTROLE
            </h2>
            <p className="mt-2 text-sm font-medium tracking-wide text-slate-400 md:text-base">Visão geral do seu negócio de crédito</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
            onClick={() => setSummaryModal({ isOpen: true, title: stat.label, type: stat.type })}
            className={cn(
              "relative overflow-hidden rounded-3xl p-6 cursor-pointer transition-all duration-300 group",
              "bg-slate-900/80 backdrop-blur-xl border border-slate-800/50",
              "hover:-translate-y-2 hover:shadow-2xl",
              stat.shadow
            )}
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500", stat.gradient)} />
            
            <div className="relative z-10 flex flex-col h-full justify-between min-h-[140px]">
              <div className="flex items-center justify-between mb-4">
                <div className={cn("p-3 rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-lg shrink-0", stat.bg)}>
                  <stat.icon className={stat.color} size={24} />
                </div>
                <ArrowRight size={20} className="text-slate-600 group-hover:text-white transition-colors shrink-0" />
              </div>
              <div className="space-y-1.5 min-w-0">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest truncate">{stat.label}</p>
                <h3 className="max-w-full break-words text-base font-black leading-tight tracking-tight text-white sm:text-lg xl:text-xl">
                  {stat.value}
                </h3>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          {/* Ações do Dia */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 p-6 rounded-3xl shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 relative z-10 gap-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 rounded-xl shrink-0">
                  <Zap className="text-blue-400" size={24} />
                </div>
                Ações do Dia
              </h3>
              <div className="flex items-end gap-1 h-8 shrink-0" title="Previsão de recebimentos (7 dias)">
                {next7Days.map((day, i) => (
                  <div key={i} className="w-2 bg-slate-800 rounded-t-sm relative group">
                    <div 
                      className="absolute bottom-0 left-0 right-0 bg-blue-500 rounded-t-sm transition-all" 
                      style={{ height: day.amount > 0 ? `${Math.max(20, (day.amount / max7DaysAmount) * 100)}%` : '0%' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10">
              {todayActions.length > 0 ? (
                <div className="space-y-3">
                  {todayActions.slice(0, 4).map((action, i) => (
                    <Link 
                      key={action.id}
                      to={`/clients/${action.client.id}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-700/30 hover:border-blue-500/30 hover:bg-slate-800/60 transition-all duration-300 group gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-inner shrink-0",
                          action.type === 'overdue' ? "bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-rose-500/20" :
                          action.type === 'pending' ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-amber-500/20" :
                          "bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-blue-500/20"
                        )}>
                          {action.client.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate" title={action.client.name}>{action.client.name}</p>
                          <p className="text-[10px] font-medium text-slate-500 mt-0.5">
                            {action.type === 'overdue' ? 'Em atraso' : action.type === 'pending' ? 'Aguardando liberação' : 'Vence hoje'}
                          </p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right flex sm:block items-center justify-between w-full sm:w-auto">
                        {action.loan && (
                          <p className="text-sm font-black text-white tracking-tight">{formatCurrency(action.loan.installmentValue || 0)}</p>
                        )}
                        <ArrowRight size={16} className="text-slate-600 group-hover:text-blue-400 sm:inline-block sm:mt-1 shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="text-emerald-400" size={32} />
                  </div>
                  <h4 className="text-white font-bold mb-1">Nenhum vencimento hoje 👍</h4>
                  <p className="text-slate-400 text-sm mb-6">Sua carteira está em dia. O que deseja fazer?</p>
                  <div className="flex justify-center gap-3">
                    <Link to="/loans" className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white transition-colors flex flex-col items-center gap-2 flex-1 border border-slate-700/50 hover:border-emerald-500/30">
                      <PlusCircle size={20} className="text-emerald-400" />
                      <span className="text-xs font-bold">Novo Empréstimo</span>
                    </Link>
                    <Link to="/register" className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-white transition-colors flex flex-col items-center gap-2 flex-1 border border-slate-700/50 hover:border-blue-500/30">
                      <UserPlus size={20} className="text-blue-400" />
                      <span className="text-xs font-bold">Novo Cliente</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Inteligência Financeira */}
          <div className="bg-gradient-to-br from-indigo-900/40 via-purple-900/40 to-slate-900/80 backdrop-blur-xl border border-indigo-500/20 p-8 rounded-3xl shadow-2xl shadow-indigo-500/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full -mr-20 -mt-20 pointer-events-none transition-transform duration-700 group-hover:scale-150" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 blur-[100px] rounded-full -ml-20 -mb-20 pointer-events-none transition-transform duration-700 group-hover:scale-150" />
            
            <h3 className="text-lg md:text-xl font-bold text-white mb-8 flex flex-wrap items-center gap-3 relative z-10">
              <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30 shrink-0">
                <TrendingUp className="text-indigo-400" size={20} />
              </div>
              Inteligência Financeira
              <span className="ml-auto md:ml-auto text-[10px] font-bold uppercase tracking-widest bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30">Premium</span>
            </h3>
            
            {(() => {
              const totalOverdueAmount = overdueLoans.reduce((acc, l) => acc + (l.remainingAmount || 0), 0);
              const delinquencyRate = totalActive > 0 ? (totalOverdueAmount / totalActive) * 100 : 0;
              
              let healthStatus = 'Excelente';
              let healthColor = 'text-emerald-400';
              let healthSuggestion = 'Continue com a mesma política de crédito. O risco está muito bem controlado.';
              
              if (delinquencyRate > 15) {
                healthStatus = 'Crítico';
                healthColor = 'text-rose-500';
                healthSuggestion = 'Taxa de inadimplência muito alta. Suspenda novos empréstimos e foque na cobrança dos atrasados.';
              } else if (delinquencyRate > 5) {
                healthStatus = 'Atenção';
                healthColor = 'text-amber-500';
                healthSuggestion = 'Inadimplência subindo. Seja mais rigoroso na análise de crédito e reduza o limite para novos clientes.';
              }

              return (
                <div className="space-y-6 relative z-10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 backdrop-blur-md p-5 rounded-2xl border border-indigo-500/20 hover:border-indigo-500/40 transition-colors overflow-hidden">
                      <p className="text-[11px] font-bold text-indigo-300/70 uppercase tracking-widest mb-2 truncate">Inadimplência</p>
                      <p className={cn("text-xl md:text-2xl font-black tracking-tight drop-shadow-md whitespace-nowrap", healthColor)}>{delinquencyRate.toFixed(1)}%</p>
                    </div>
                    <div className="bg-slate-900/50 backdrop-blur-md p-5 rounded-2xl border border-indigo-500/20 hover:border-indigo-500/40 transition-colors overflow-hidden">
                      <p className="text-[11px] font-bold text-indigo-300/70 uppercase tracking-widest mb-2 truncate">Valor em Atraso</p>
                      <p className="text-lg md:text-xl font-black text-white tracking-tight drop-shadow-md whitespace-nowrap">{formatCurrency(totalOverdueAmount)}</p>
                    </div>
                  </div>
                  
                  <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-2xl border border-indigo-500/20">
                    <div className="flex items-center gap-3 mb-3">
                      <p className="text-sm font-bold text-slate-300">Saúde da Carteira:</p>
                      <span className={cn("text-sm font-bold px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700", healthColor)}>{healthStatus}</span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed font-medium">{healthSuggestion}</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 p-8 rounded-3xl shadow-xl relative overflow-hidden">
            <h3 className="text-lg md:text-xl font-bold text-white mb-8 flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-xl shrink-0">
                <Users className="text-blue-400" size={24} />
              </div>
              Status dos Clientes
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Em análise */}
              <div 
                onClick={() => setSelectedStatus(selectedStatus === 'Em análise' ? null : 'Em análise')}
                className={cn(
                  "bg-slate-800/50 backdrop-blur-md border p-5 rounded-2xl relative overflow-hidden group cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                  selectedStatus === 'Em análise' ? "border-blue-500/50 shadow-blue-500/10" : "border-slate-700/50 hover:border-blue-500/30"
                )}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-[30px] rounded-full -mr-8 -mt-8 pointer-events-none transition-transform duration-700 group-hover:scale-150" />
                <div className="flex justify-between items-start mb-3 relative z-10">
                  <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform shrink-0">
                    <Clock size={24} />
                  </div>
                  <span className="text-2xl font-black text-white tracking-tight">
                    {clients.filter(c => c.status === 'Em análise').length}
                  </span>
                </div>
                <div className="relative z-10">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">Em análise</h3>
                  <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${clients.length ? (clients.filter(c => c.status === 'Em análise').length / clients.length) * 100 : 0}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                    />
                  </div>
                </div>
              </div>

              {/* Aprovados */}
              <div 
                onClick={() => setSelectedStatus(selectedStatus === 'Aprovado' ? null : 'Aprovado')}
                className={cn(
                  "bg-slate-800/50 backdrop-blur-md border p-5 rounded-2xl relative overflow-hidden group cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                  selectedStatus === 'Aprovado' ? "border-emerald-500/50 shadow-emerald-500/10" : "border-slate-700/50 hover:border-emerald-500/30"
                )}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 blur-[30px] rounded-full -mr-8 -mt-8 pointer-events-none transition-transform duration-700 group-hover:scale-150" />
                <div className="flex justify-between items-start mb-3 relative z-10">
                  <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20 group-hover:scale-110 transition-transform shrink-0">
                    <CheckCircle size={24} />
                  </div>
                  <span className="text-2xl font-black text-white tracking-tight">
                    {clients.filter(c => c.status === 'Aprovado').length}
                  </span>
                </div>
                <div className="relative z-10">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-1">Aprovados</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Status final positivo</p>
                </div>
              </div>

              {/* Reprovados */}
              <div 
                onClick={() => setSelectedStatus(selectedStatus === 'Rejeitado' ? null : 'Rejeitado')}
                className={cn(
                  "bg-slate-800/50 backdrop-blur-md border p-5 rounded-2xl relative overflow-hidden group cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                  selectedStatus === 'Rejeitado' ? "border-rose-500/50 shadow-rose-500/10" : "border-slate-700/50 hover:border-rose-500/30"
                )}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 blur-[30px] rounded-full -mr-8 -mt-8 pointer-events-none transition-transform duration-700 group-hover:scale-150" />
                <div className="flex justify-between items-start mb-3 relative z-10">
                  <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/20 group-hover:scale-110 transition-transform shrink-0">
                    <XCircle size={24} />
                  </div>
                  <span className="text-2xl font-black text-white tracking-tight">
                    {clients.filter(c => c.status === 'Rejeitado').length}
                  </span>
                </div>
                <div className="relative z-10">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-1">Reprovados</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Sem ação necessária</p>
                </div>
              </div>

              {/* Aguardando caixa */}
              <div 
                onClick={() => setSelectedStatus(selectedStatus === 'Aguardando caixa' ? null : 'Aguardando caixa')}
                className={cn(
                  "bg-slate-800/50 backdrop-blur-md border p-5 rounded-2xl relative overflow-hidden group cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                  selectedStatus === 'Aguardando caixa' ? "border-amber-500/50 shadow-amber-500/10" : "border-slate-700/50 hover:border-amber-500/30"
                )}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 blur-[30px] rounded-full -mr-8 -mt-8 pointer-events-none transition-transform duration-700 group-hover:scale-150" />
                <div className="flex justify-between items-start mb-3 relative z-10">
                  <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform shrink-0">
                    <AlertCircle size={24} />
                  </div>
                  <span className="text-2xl font-black text-white tracking-tight">
                    {clients.filter(c => c.status === 'Aguardando caixa').length}
                  </span>
                </div>
                <div className="relative z-10">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-1">Aguardando caixa</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Aprovado, sem saldo</p>
                </div>
              </div>
            </div>

            {/* Expanded Client List */}
            <AnimatePresence>
              {selectedStatus && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-white">Clientes: {selectedStatus}</h4>
                      <button onClick={() => setSelectedStatus(null)} className="text-slate-500 hover:text-white transition-colors">
                        <X size={16} />
                      </button>
                    </div>
                    
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {clients.filter(c => c.status === selectedStatus).length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">Nenhum cliente neste status.</p>
                      ) : (
                        clients.filter(c => c.status === selectedStatus).map(client => (
                          <div key={client.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-slate-700/30 hover:border-slate-600 transition-colors gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                {client.name.charAt(0)}
                              </div>
                              <div>
                                <Link to={`/clients/${client.id}`} className="text-sm font-bold text-white hover:text-blue-400 transition-colors">
                                  {client.name}
                                </Link>
                                <p className="text-xs text-slate-500">{formatCpf(client.cpf)}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                              <div className="text-left sm:text-right shrink-0">
                                <p className="text-sm font-bold text-white whitespace-nowrap">{client.requestedAmount ? formatCurrency(client.requestedAmount) : '-'}</p>
                              </div>
                              
                              {selectedStatus === 'Aguardando caixa' && (
                                <button
                                  onClick={() => handleNotifyClient(client)}
                                  className="ml-2 p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg transition-all flex items-center gap-2"
                                  title="Avisar que há saldo e aprovar"
                                >
                                  <MailCheck size={16} />
                                  <span className="text-xs font-bold hidden sm:inline">Avisar Cliente</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Fluxo de Caixa */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 p-8 rounded-3xl shadow-xl relative overflow-hidden">
            <h3 className="text-lg md:text-xl font-bold text-white mb-6 flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 rounded-xl shrink-0">
                <BarChart3 className="text-emerald-400" size={24} />
              </div>
              Fluxo de Caixa (7 dias)
            </h3>
            
            <div className="h-48 mb-6 w-full" style={{ minHeight: 192 }}>
              <ResponsiveContainer width="99%" height="99%" minWidth={1} minHeight={1}>
                <BarChart data={cashflowData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value}`} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f8fafc' }}
                    itemStyle={{ fontSize: '14px', fontWeight: 'bold' }}
                    formatter={(value: number | string) => [formatCurrency(Number(value)), '']}
                  />
                  <Bar dataKey="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Saídas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 text-center flex flex-col justify-center">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Entradas</p>
                <p className="text-emerald-400 font-bold text-lg">{formatCurrency(totalInflow)}</p>
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 text-center flex flex-col justify-center">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Saídas</p>
                <p className="text-rose-400 font-bold text-lg">{formatCurrency(totalOutflow)}</p>
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50 text-center flex flex-col justify-center">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Saldo</p>
                <p className={cn("font-bold text-lg", projectedBalance >= 0 ? "text-indigo-400" : "text-rose-400")}>{formatCurrency(projectedBalance)}</p>
              </div>
            </div>
          </div>

          {/* Top Devedores */}
          {topDebtors.length > 0 && (
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 p-6 md:p-8 rounded-3xl shadow-xl relative overflow-hidden">
              <h3 className="text-lg md:text-xl font-bold text-white mb-6 flex items-center gap-3">
                <div className="p-3 bg-rose-500/10 rounded-xl shrink-0">
                  <AlertOctagon className="text-rose-400" size={24} />
                </div>
                Top Devedores
              </h3>
              
              <div className="space-y-3">
                {topDebtors.map(({ client, totalDebt }, index) => (
                  <div key={client.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-800/40 rounded-2xl border border-slate-700/30 hover:border-slate-600 transition-colors gap-3">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white relative shrink-0">
                        {client.name.charAt(0)}
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-slate-900">
                          {index + 1}
                        </div>
                      </div>
                      <div>
                        <Link to={`/clients/${client.id}`} className="text-sm font-bold text-white hover:text-rose-400 transition-colors">
                          {client.name}
                        </Link>
                        <p className="text-xs text-slate-500">{formatCpf(client.cpf)}</p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-bold text-rose-400">{formatCurrency(totalDebt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Summary Modal */}
      <AnimatePresence>
        {summaryModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSummaryModal({ ...summaryModal, isOpen: false })}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-slate-900/90 backdrop-blur-2xl border border-slate-700/50 rounded-3xl p-8 shadow-[0_0_40px_rgba(0,0,0,0.5)] max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-6 md:mb-8">
                <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">{summaryModal.title}</h3>
                <button 
                  onClick={() => setSummaryModal({ ...summaryModal, isOpen: false })}
                  className="p-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-full text-slate-400 hover:text-white transition-all shrink-0"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-4 no-scrollbar">
                {getSummaryData().map((loan: Loan) => {
                  const client = clients.find(c => c.id === loan.clientId);
                  const dueDate = loan.nextDueDate?.toDate ? loan.nextDueDate.toDate() : (loan.nextDueDate ? new Date(loan.nextDueDate) : new Date());
                  
                  return (
                    <div
                      key={loan.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-slate-700/30 hover:border-emerald-500/30 hover:bg-slate-800/60 transition-all duration-300 group gap-4"
                    >
                      <Link
                        to={`/clients/${loan.clientId}`}
                        onClick={() => setSummaryModal({ ...summaryModal, isOpen: false })}
                        className="flex items-center gap-4 flex-1 min-w-0"
                      >
                        <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-emerald-400 font-bold overflow-hidden shadow-inner border border-slate-600/50">
                          {client?.selfieUrl ? (
                            <img src={client.selfieUrl} alt={client.name} className="w-full h-full object-cover" />
                          ) : (
                            client?.name.charAt(0) || '?'
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors truncate">{client?.name || 'Cliente Excluído'}</p>
                          <p className="text-xs font-medium text-slate-500 mt-0.5 truncate">{client?.cpf ? formatCpf(client.cpf) : ''}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider truncate">
                            Vencimento: <span className="text-slate-300">{format(dueDate, "dd/MM/yyyy")}</span>
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 mt-2 sm:mt-0 pt-4 sm:pt-0 border-t border-slate-700/50 sm:border-0">
                        <div className="text-left sm:text-right shrink-0">
                          <p className="text-lg font-black text-white tracking-tight whitespace-nowrap">
                            {summaryModal.type === 'interest' 
                              ? formatCurrency(loan.type === 'simple' ? (loan.installmentValue || 0) : ((loan.interestRate || 0) / (loan.installments || 1)))
                              : formatCurrency(loan.remainingAmount)}
                          </p>
                          <p className={cn(
                            "text-[10px] font-bold uppercase tracking-widest mt-1 px-2 py-0.5 rounded-full inline-block",
                            loan.status === 'overdue' ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
                          )}>
                            {summaryModal.type === 'interest' ? 'Juros Mensal' : (loan.status === 'overdue' ? 'Atrasado' : 'Ativo')}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSummaryModal({ ...summaryModal, isOpen: false });
                            setPaymentModal({ isOpen: true, loan, clientId: loan.clientId });
                          }}
                          className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-lg shadow-emerald-600/20 hover:scale-105 hover:-translate-y-0.5 shrink-0"
                          title="Registrar Pagamento"
                        >
                          <DollarSign size={20} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {getSummaryData().length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-slate-500">Nenhum registro encontrado para este resumo.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PaymentModal
        isOpen={paymentModal.isOpen}
        onClose={() => setPaymentModal({ ...paymentModal, isOpen: false })}
        loan={paymentModal.loan}
        client={clients.find(c => c.id === paymentModal.clientId) || null}
      />
    </div>
  );
}
