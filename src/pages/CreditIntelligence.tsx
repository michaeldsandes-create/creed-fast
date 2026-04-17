import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { mapSupabaseClient, mapSupabaseLoan, mapPaymentToSupabase, mapSupabasePayment } from '../lib/supabase-mapper';
import { Client, Loan, Payment } from '../types';
import { formatCurrency, cn, getLoanStatus } from '../lib/utils';
import { Gem, Info, ShieldCheck, ShieldAlert, Shield, ShieldQuestion, X, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { differenceInDays } from 'date-fns';

const BASE_LIMIT = 2500;

interface ClientIntelligence {
  client: Client;
  totalBorrowed: number;
  totalLoans: number;
  onTimePercentage: number;
  lateCount: number;
  avgLateDays: number;
  score: number;
  classification: 'Ouro' | 'Bom' | 'Médio' | 'Risco';
  suggestedLimit: number;
}

export default function CreditIntelligence() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientIntelligence | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: clientsData } = await supabase.from('clients').select('*');
      if (clientsData) setClients(clientsData.map(mapSupabaseClient));

      const { data: loansData } = await supabase.from('loans').select('*');
      if (loansData) setLoans(loansData.map(mapSupabaseLoan));

      const { data: paymentsData } = await supabase.from('payments').select('*');
      if (paymentsData) setPayments(paymentsData.map(mapSupabasePayment));
    };

    fetchData();

    const clientsChannel = supabase
      .channel('public:clients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        fetchData();
      })
      .subscribe();

    const loansChannel = supabase
      .channel('public:loans')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => {
        fetchData();
      })
      .subscribe();

    const paymentsChannel = supabase
      .channel('public:payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(clientsChannel);
      supabase.removeChannel(loansChannel);
      supabase.removeChannel(paymentsChannel);
    };
  }, []);

  useEffect(() => {
    if (clients.length > 0 && loans.length > 0) {
      setLoading(false);
    } else {
      const timer = setTimeout(() => setLoading(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [clients, loans]);

  const intelligenceData = useMemo(() => {
    const data: ClientIntelligence[] = clients.map(client => {
      const clientLoans = loans.filter(l => l.clientId === client.id);
      const totalBorrowed = clientLoans.reduce((acc, l) => acc + (l.principal || 0), 0);
      const totalLoans = clientLoans.length;
      
      let onTimeCount = 0;
      let lateCount = 0;
      let totalLateDays = 0;
      let totalInstallmentsEvaluated = 0;

      clientLoans.forEach(loan => {
        const loanPayments = payments.filter(p => p.loanId === loan.id);
        
        // Evaluate based on payments and current status
        loanPayments.forEach(payment => {
          totalInstallmentsEvaluated++;
          if (payment.isLate) {
            lateCount++;
            totalLateDays += payment.daysLate || 0;
          } else {
            onTimeCount++;
          }
        });

        // If loan is currently overdue
        if (loan.status === 'overdue') {
          totalInstallmentsEvaluated++;
          lateCount++;
          if (loan.nextDueDate) {
            const dueDate = loan.nextDueDate instanceof Date ? loan.nextDueDate : new Date(loan.nextDueDate);
            if (!isNaN(dueDate.getTime())) {
              const days = differenceInDays(new Date(), dueDate);
              totalLateDays += Math.max(0, days);
            }
          }
        }
      });

      // If no history, give a neutral score
      let onTimePercentage = 100;
      if (totalInstallmentsEvaluated > 0) {
        onTimePercentage = (onTimeCount / totalInstallmentsEvaluated) * 100;
      } else {
        // New clients start neutral
        onTimePercentage = 80; 
      }

      const avgLateDays = lateCount > 0 ? totalLateDays / lateCount : 0;

      // Calculate Score (0-100)
      let score = onTimePercentage;
      score -= (lateCount * 2); // Penalty for each late payment
      score -= (avgLateDays * 0.5); // Penalty for average late days
      score = Math.max(0, Math.min(100, score));

      // Classification
      let classification: 'Ouro' | 'Bom' | 'Médio' | 'Risco' = 'Médio';
      let suggestedLimit = BASE_LIMIT * 0.5;

      if (score >= 95) {
        classification = 'Ouro';
        suggestedLimit = BASE_LIMIT;
      } else if (score >= 85) {
        classification = 'Bom';
        suggestedLimit = BASE_LIMIT * 0.8;
      } else if (score >= 70) {
        classification = 'Médio';
        suggestedLimit = BASE_LIMIT * 0.5;
      } else {
        classification = 'Risco';
        suggestedLimit = BASE_LIMIT * 0.2;
      }

      return {
        client,
        totalBorrowed,
        totalLoans,
        onTimePercentage,
        lateCount,
        avgLateDays,
        score,
        classification,
        suggestedLimit
      };
    });

    return data.sort((a, b) => b.score - a.score);
  }, [clients, loans, payments]);

  const chartData = useMemo(() => {
    const counts = { Ouro: 0, Bom: 0, Médio: 0, Risco: 0 };
    intelligenceData.forEach(d => counts[d.classification]++);
    
    return [
      { name: 'Ouro', value: counts.Ouro, color: '#10b981' }, // emerald-500
      { name: 'Bom', value: counts.Bom, color: '#3b82f6' }, // blue-500
      { name: 'Médio', value: counts.Médio, color: '#eab308' }, // yellow-500
      { name: 'Risco', value: counts.Risco, color: '#f43f5e' }, // rose-500
    ].filter(d => d.value > 0);
  }, [intelligenceData]);

  const filteredData = intelligenceData.filter(d => {
    const name = d.client.name || '';
    const cpf = d.client.cpf || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           cpf.includes(searchTerm);
  });

  const getBadgeColor = (classification: string) => {
    switch (classification) {
      case 'Ouro': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Bom': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Médio': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Risco': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getIcon = (classification: string) => {
    switch (classification) {
      case 'Ouro': return <ShieldCheck size={16} className="text-emerald-400" />;
      case 'Bom': return <Shield size={16} className="text-blue-400" />;
      case 'Médio': return <ShieldQuestion size={16} className="text-amber-400" />;
      case 'Risco': return <ShieldAlert size={16} className="text-rose-400" />;
      default: return <Shield size={16} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
              <Gem className="text-indigo-400" size={32} />
            </div>
            Credit Intelligence
          </h1>
          <p className="text-slate-400 mt-2 font-medium">Análise estratégica e limites personalizados automáticos.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Classificação */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 p-6 rounded-3xl shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6">Distribuição da Carteira</h3>
          <div className="h-64 w-full" style={{ minHeight: 256 }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="99%" height="99%" minWidth={1} minHeight={1}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f8fafc' }}
                    itemStyle={{ fontSize: '14px', fontWeight: 'bold' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    formatter={(value, entry: any) => {
                      const total = chartData.reduce((acc, d) => acc + d.value, 0);
                      const percentage = total > 0 ? ((entry.payload.value / total) * 100).toFixed(0) : 0;
                      return `${value} (${entry.payload.value} - ${percentage}%)`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                Sem dados suficientes
              </div>
            )}
          </div>
        </div>

        {/* Critérios */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 p-6 rounded-3xl shadow-xl lg:col-span-2">
          <h3 className="text-lg font-bold text-white mb-6">Critérios & Limites Sugeridos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-800/40 border border-emerald-500/20 p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="text-emerald-400" size={20} />
                <h4 className="font-bold text-emerald-400">Cliente Ouro</h4>
              </div>
              <p className="text-xs text-slate-400 mb-3">95%+ em dia. Raros ou nenhum atraso.</p>
              <div className="bg-slate-900/50 p-2 rounded-lg text-center border border-slate-700/50">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 block mb-1">Limite Sugerido</span>
                <span className="font-bold text-white">Até 100% (R$ 2.500)</span>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-blue-500/20 p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="text-blue-400" size={20} />
                <h4 className="font-bold text-blue-400">Cliente Bom</h4>
              </div>
              <p className="text-xs text-slate-400 mb-3">85% a 95% em dia. Atrasos leves.</p>
              <div className="bg-slate-900/50 p-2 rounded-lg text-center border border-slate-700/50">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 block mb-1">Limite Sugerido</span>
                <span className="font-bold text-white">Até 80% (R$ 2.000)</span>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-amber-500/20 p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <ShieldQuestion className="text-amber-400" size={20} />
                <h4 className="font-bold text-amber-400">Cliente Médio</h4>
              </div>
              <p className="text-xs text-slate-400 mb-3">70% a 85% em dia. Atrasos ocasionais.</p>
              <div className="bg-slate-900/50 p-2 rounded-lg text-center border border-slate-700/50">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 block mb-1">Limite Sugerido</span>
                <span className="font-bold text-white">Até 50% (R$ 1.250)</span>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-rose-500/20 p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="text-rose-400" size={20} />
                <h4 className="font-bold text-rose-400">Cliente de Risco</h4>
              </div>
              <p className="text-xs text-slate-400 mb-3">&lt; 70% em dia. Atrasos frequentes.</p>
              <div className="bg-slate-900/50 p-2 rounded-lg text-center border border-slate-700/50">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 block mb-1">Limite Sugerido</span>
                <span className="font-bold text-white">Até 20% (R$ 500) ou Bloqueado</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lista Inteligente */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-xl font-bold text-white">Lista de Clientes Inteligente</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-950/50">
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800/50">Cliente</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800/50">Classificação</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800/50">Score</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800/50">Pagamentos em Dia</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800/50">Limite Sugerido</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((data) => (
                <tr 
                  key={data.client.id} 
                  onClick={() => setSelectedClient(data)}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer group"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-white group-hover:bg-indigo-500/20 transition-colors">
                        {data.client.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{data.client.name}</p>
                        <p className="text-xs text-slate-500">{data.client.cpf}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border", getBadgeColor(data.classification))}>
                      {getIcon(data.classification)}
                      {data.classification}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full", data.score >= 85 ? "bg-emerald-500" : data.score >= 70 ? "bg-amber-500" : "bg-rose-500")}
                          style={{ width: `${data.score}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-white">{data.score.toFixed(0)}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-medium text-slate-300">{data.onTimePercentage.toFixed(1)}%</span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-bold text-white">{formatCurrency(data.suggestedLimit)}</span>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes */}
      <AnimatePresence>
        {selectedClient && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedClient(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border", getBadgeColor(selectedClient.classification))}>
                    {getIcon(selectedClient.classification)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedClient.client.name}</h2>
                    <p className="text-sm text-slate-400">Relatório de Inteligência</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedClient(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Score</p>
                    <p className="text-2xl font-black text-white">{selectedClient.score.toFixed(0)}<span className="text-sm text-slate-500 font-medium">/100</span></p>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Empréstimos</p>
                    <p className="text-2xl font-black text-white">{selectedClient.totalLoans}</p>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Atrasos</p>
                    <p className={cn("text-2xl font-black", selectedClient.lateCount > 0 ? "text-rose-400" : "text-emerald-400")}>{selectedClient.lateCount}</p>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Atraso Médio</p>
                    <p className={cn("text-2xl font-black", selectedClient.avgLateDays > 5 ? "text-rose-400" : "text-white")}>
                      {selectedClient.avgLateDays.toFixed(0)} <span className="text-sm font-medium text-slate-500">dias</span>
                    </p>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Em Dia</p>
                    <p className="text-2xl font-black text-white">{selectedClient.onTimePercentage.toFixed(0)}%</p>
                  </div>
                </div>

                <div className="bg-indigo-500/10 border border-indigo-500/20 p-6 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-[50px] rounded-full -mr-10 -mt-10 pointer-events-none" />
                  
                  <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Gem size={16} />
                    Recomendação do Sistema
                  </h3>
                  
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-slate-400 mb-1">Limite Sugerido</p>
                      <p className="text-3xl font-black text-white">{formatCurrency(selectedClient.suggestedLimit)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400 mb-1">Nível de Risco</p>
                      <p className={cn("text-lg font-bold", 
                        selectedClient.classification === 'Ouro' ? "text-emerald-400" :
                        selectedClient.classification === 'Bom' ? "text-blue-400" :
                        selectedClient.classification === 'Médio' ? "text-amber-400" : "text-rose-400"
                      )}>
                        {selectedClient.classification === 'Ouro' ? 'Muito Baixo' :
                         selectedClient.classification === 'Bom' ? 'Baixo' :
                         selectedClient.classification === 'Médio' ? 'Moderado' : 'Alto'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {selectedClient.classification === 'Ouro' && "Cliente altamente confiável. Histórico excelente de pagamentos. Pode receber o limite máximo e ter aprovação automática."}
                      {selectedClient.classification === 'Bom' && "Cliente confiável com bom histórico. Pode aumentar o limite gradualmente conforme mantém o padrão de pagamento."}
                      {selectedClient.classification === 'Médio' && "Cliente apresenta atrasos ocasionais. Recomenda-se cautela na liberação de novos valores. Manter limite reduzido."}
                      {selectedClient.classification === 'Risco' && "Cliente com histórico frequente de atrasos. Risco alto de inadimplência. Recomenda-se bloquear novos créditos ou liberar apenas valores muito baixos."}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
