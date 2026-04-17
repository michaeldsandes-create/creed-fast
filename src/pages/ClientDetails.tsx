import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { mapSupabaseClient, mapSupabaseLoan, mapLoanToSupabase } from '../lib/supabase-mapper';
import { Client, Loan, ClientStatus, LoanType } from '../types';
import { formatCurrency, formatCpf, cn, getLoanStatus } from '../lib/utils';
import { 
  ArrowLeft, Plus, DollarSign, 
  Calendar, CheckCircle, Clock, XCircle, AlertCircle,
  History, TrendingUp, User, MapPin, FileText, Trash2, X, Loader2, Pencil, Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { sendEmailNotification } from '../services/emailService';
import { maskCurrency, unmaskCurrency } from '../lib/utils';
import ConfirmationModal from '../components/ConfirmationModal';
import { PaymentModal } from '../components/PaymentModal';
import { analyzeCredit, CreditAnalysisResult } from '../lib/credit-analysis';

const statusOptions: ClientStatus[] = ['Em análise', 'Aprovado', 'Rejeitado', 'Aguardando caixa'];

const statusColors = {
  'Em análise': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'Aprovado': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'Rejeitado': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  'Aguardando caixa': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

import { FinancialReportModal } from '../components/FinancialReportModal';

export default function ClientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [reportModal, setReportModal] = useState<{ isOpen: boolean; loan: Loan | null }>({ isOpen: false, loan: null });
  const [deleteClientModal, setDeleteClientModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean; loan: Loan | null }>({
    isOpen: false,
    loan: null
  });
  const [availableCapital, setAvailableCapital] = useState(0);
  const [analysis, setAnalysis] = useState<CreditAnalysisResult | null>(null);

  // Loan Form State
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [deleteLoanModal, setDeleteLoanModal] = useState<{isOpen: boolean, loanId: string | null}>({isOpen: false, loanId: null});
  const [loanType, setLoanType] = useState<LoanType>('simple');
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('15');
  const [installments, setInstallments] = useState('1');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  useEffect(() => {
    if (!id) return;

    const fetchClient = async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', id).single();
      if (data) {
        setClient(mapSupabaseClient(data));
      } else {
        navigate('/clients');
      }
    };

    const fetchLoans = async () => {
      const { data, error } = await supabase.from('loans').select('*').eq('client_id', id);
      if (data) {
        setLoans(data.map(mapSupabaseLoan).map(l => ({ ...l, status: getLoanStatus(l) })));
      }
      setLoading(false);
    };

    const fetchSettings = async () => {
      const { data, error } = await supabase.from('settings').select('*').eq('id', 'app').single();
      if (data) {
        setAvailableCapital(data.available_capital || 0);
      }
    };

    fetchClient();
    fetchLoans();
    fetchSettings();

    const clientSub = supabase.channel(`client-changes-${id}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `id=eq.${id}` }, fetchClient)
      .subscribe();

    const loansSub = supabase.channel(`client-loans-changes-${id}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans', filter: `client_id=eq.${id}` }, fetchLoans)
      .subscribe();

    const settingsSub = supabase.channel(`settings-changes-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: 'id=eq.app' }, fetchSettings)
      .subscribe();

    return () => {
      supabase.removeChannel(clientSub);
      supabase.removeChannel(loansSub);
      supabase.removeChannel(settingsSub);
    };
  }, [id, navigate]);

  useEffect(() => {
    if (client) {
      const p = unmaskCurrency(principal) || (client.requestedAmount || 0);
      const r = loanType === 'simple' ? parseFloat(interestRate || '15') : unmaskCurrency(interestRate || '0');
      const inst = parseInt(installments || '1');
      
      const result = analyzeCredit(client, p, inst, r, availableCapital, loans);
      setAnalysis(result);
    }
  }, [client, principal, installments, interestRate, loanType, availableCapital, loans]);

  const handleUpdateStatus = async (newStatus: ClientStatus) => {
    if (!id || !client) return;
    setSaving(true);
    try {
      await supabase.from('clients').update({
        status: newStatus,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      
      setClient({ ...client, status: newStatus });
      
      // Send real email notification (fire and forget)
      sendEmailNotification(
        client.email,
        `Atualização de Status - CREED-FAST`,
        `Olá ${client.name}, o status do seu cadastro foi atualizado para: ${newStatus}.`
      );
    } catch (err) {
      console.error("Error updating client status:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !client) return;
    setSaving(true);

    const p = unmaskCurrency(principal);
    const r = loanType === 'simple' ? parseFloat(interestRate) || 0 : unmaskCurrency(interestRate);
    const inst = parseInt(installments) || 1;

    if (!dueDate) {
      setError('Data de vencimento é obrigatória.');
      setSaving(false);
      return;
    }

    const [year, month, day] = dueDate.split('-').map(Number);
    const nextDueDate = new Date(year, month - 1, day);
    if (isNaN(nextDueDate.getTime())) {
      setError('Data de vencimento inválida.');
      setSaving(false);
      return;
    }

    let totalAmount = p;
    let installmentValue = 0;

    if (loanType === 'simple') {
      totalAmount = p; // Simple monthly interest is paid separately
      installmentValue = (p * r) / 100;
    } else {
      const totalInterest = r;
      totalAmount = p + totalInterest;
      installmentValue = totalAmount / inst;
    }

    try {
      if (editingLoan) {
        const amountPaid = editingLoan.totalAmount - editingLoan.remainingAmount;
        const newRemainingAmount = totalAmount - amountPaid;
        
        const { error: updateError } = await supabase.from('loans').update(mapLoanToSupabase({
          type: loanType,
          principal: p,
          interestRate: r,
          totalAmount,
          remainingAmount: newRemainingAmount,
          installments: inst,
          installmentValue,
          nextDueDate: nextDueDate,
        })).eq('id', editingLoan.id);
        
        if (updateError) {
          console.error("Error updating loan:", updateError);
          setError('Erro ao atualizar empréstimo.');
          setSaving(false);
          return;
        }
      } else {
        const { error: insertError } = await supabase.from('loans').insert(mapLoanToSupabase({
          id: '', // Supabase will generate this
          clientId: id,
          type: loanType,
          principal: p,
          interestRate: r,
          totalAmount,
          remainingAmount: totalAmount,
          installments: inst,
          installmentValue,
          status: 'active',
          startDate: new Date(),
          nextDueDate: nextDueDate,
        }));
        
        if (insertError) {
          console.error("Error saving loan:", insertError);
          setError('Erro ao salvar empréstimo.');
          setSaving(false);
          return;
        }
        
        // Send real email notification (fire and forget)
        sendEmailNotification(
          client.email,
          `Empréstimo Aprovado - CREED-FAST`,
          `Olá ${client.name}, seu empréstimo de ${formatCurrency(p)} foi aprovado e está ativo!`
        );
      }
      
      setShowLoanModal(false);
      setEditingLoan(null);
      setPrincipal('');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteLoan = async () => {
    if (!deleteLoanModal.loanId) return;
    try {
      await supabase.from('loans').delete().eq('id', deleteLoanModal.loanId);
      setDeleteLoanModal({ isOpen: false, loanId: null });
    } catch (err) {
      console.error("Error deleting loan:", err);
    }
  };

  const openEditLoanModal = (loan: Loan) => {
    setEditingLoan(loan);
    setLoanType(loan.type);
    setPrincipal(maskCurrency((loan.principal * 100).toFixed(0)));
    setInterestRate(loan.type === 'simple' ? loan.interestRate.toString() : maskCurrency((loan.interestRate * 100).toFixed(0)));
    setInstallments((loan.installments || 1).toString());
    
    if (loan.nextDueDate) {
      const date = loan.nextDueDate instanceof Date ? loan.nextDueDate : new Date(loan.nextDueDate);
      if (!isNaN(date.getTime())) {
        setDueDate(date.toISOString().split('T')[0]);
      }
    }
    
    setError('');
    setShowLoanModal(true);
  };

  const handleDeleteClient = async () => {
    if (!id || !client) return;
    setSaving(true);
    try {
      // Save to deleted_clients collection
      await supabase.from('deleted_clients').insert({
        original_id: id,
        name: client.name,
        cpf: client.cpf,
      });

      await supabase.from('clients').delete().eq('id', id);
      
      navigate('/clients');
    } catch (err) {
      console.error("Error deleting client:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleOverdue = async (loan: Loan) => {
    const isOverdueByDate = loan.nextDueDate && (() => {
      const dueDate = loan.nextDueDate instanceof Date ? loan.nextDueDate : new Date(loan.nextDueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return dueDate < today;
    })();

    if (isOverdueByDate) {
      try {
        sendEmailNotification(
          client?.email || '',
          `Aviso de Atraso - CREED-FAST`,
          `Olá ${client?.name}, identificamos um atraso no pagamento do seu empréstimo. Por favor, regularize sua situação.`
        );
        alert('Email de cobrança enviado com sucesso!');
      } catch (error) {
        console.error(error);
      }
      return;
    }

    const newStatus = loan.status === 'overdue' ? 'active' : 'overdue';
    try {
      await supabase.from('loans').update({
        status: newStatus
      }).eq('id', loan.id);
      
      if (newStatus === 'overdue') {
        sendEmailNotification(
          client?.email || '',
          `Aviso de Atraso - CREED-FAST`,
          `Olá ${client?.name}, identificamos um atraso no pagamento do seu empréstimo. Por favor, regularize sua situação.`
        );
      }
    } catch (error) {
      console.error("Error updating loan status:", error);
    }
  };

  if (loading || !client) {
    return <div className="animate-pulse space-y-8">
      <div className="h-10 w-48 bg-slate-800 rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 h-[600px] bg-slate-900 rounded-2xl" />
        <div className="lg:col-span-2 h-[600px] bg-slate-900 rounded-2xl" />
      </div>
    </div>;
  }

  return (
    <div className="space-y-8 pb-20">
      <header className="flex items-center justify-between">
        <button
          onClick={() => navigate('/clients')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={24} />
          <span className="font-medium">Voltar para Clientes</span>
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDeleteClientModal(true)}
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
            title="Excluir Cliente"
          >
            <Trash2 size={24} />
          </button>
          <span className={cn(
            "px-4 py-2 rounded-xl text-sm font-bold border",
            statusColors[client.status]
          )}>
            {client.status}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Client Info Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-sm">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-800 shadow-xl mb-4 overflow-hidden">
                {client.selfieUrl ? (
                  <img src={client.selfieUrl} alt={client.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-full h-full p-6 text-slate-600" />
                )}
              </div>
              <h3 className="text-2xl font-bold text-white">{client.name}</h3>
              <p className="text-slate-400 text-sm">{client.email}</p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <FileText className="text-slate-500 shrink-0 mt-1" size={18} />
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">CPF</p>
                  <p className="text-slate-200 font-mono">{formatCpf(client.cpf)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="text-slate-500 shrink-0 mt-1" size={18} />
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Endereço</p>
                  <p className="text-slate-200 text-sm">{client.address || 'Não informado'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="text-slate-500 shrink-0 mt-1" size={18} />
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Valor Solicitado</p>
                  <p className="text-slate-200 font-bold">{client.requestedAmount ? formatCurrency(client.requestedAmount) : 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <TrendingUp className="text-slate-500 shrink-0 mt-1" size={18} />
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Renda Mensal</p>
                  <p className="text-slate-200 font-bold">{client.monthlyIncome ? formatCurrency(client.monthlyIncome) : 'N/A'}</p>
                </div>
              </div>
              {client.observation && (
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Observação</p>
                  <p className="text-slate-300 text-sm italic">"{client.observation}"</p>
                </div>
              )}
            </div>

            <div className="mt-10 pt-8 border-t border-slate-800 space-y-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">Alterar Status</p>
              <div className="grid grid-cols-2 gap-2">
                {statusOptions.map(status => (
                  <button
                    key={status}
                    onClick={() => handleUpdateStatus(status)}
                    disabled={saving || client.status === status}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-bold transition-all border",
                      client.status === status 
                        ? "bg-slate-700 text-white border-slate-600" 
                        : "text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200"
                    )}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Loans and History */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Credit Analysis */}
          {analysis && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className={cn(
                    analysis.analise_credito.status === 'APROVADO' ? 'text-emerald-500' :
                    analysis.analise_credito.status === 'REPROVADO' ? 'text-rose-500' :
                    analysis.analise_credito.status === 'AGUARDANDO CAIXA' ? 'text-blue-500' :
                    'text-amber-500'
                  )} size={24} />
                  <h3 className="text-xl font-bold text-white">Análise de Crédito Inteligente</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">Score:</span>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-sm font-bold",
                    analysis.analise_credito.score >= 80 ? "bg-emerald-500/10 text-emerald-500" :
                    analysis.analise_credito.score >= 50 ? "bg-amber-500/10 text-amber-500" :
                    "bg-rose-500/10 text-rose-500"
                  )}>
                    {analysis.analise_credito.score}/100
                  </span>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Status Recomendado</p>
                    <p className={cn(
                      "text-lg font-bold",
                      analysis.analise_credito.status === 'APROVADO' ? 'text-emerald-500' :
                      analysis.analise_credito.status === 'REPROVADO' ? 'text-rose-500' :
                      analysis.analise_credito.status === 'AGUARDANDO CAIXA' ? 'text-blue-500' :
                      'text-amber-500'
                    )}>{analysis.analise_credito.status}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Motivo</p>
                    <p className="text-slate-300 text-sm">{analysis.analise_credito.motivo}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Sugestão do Sistema</p>
                    <p className="text-emerald-400 text-sm font-medium">{analysis.analise_credito.sugestao}</p>
                  </div>
                </div>
                <div className="space-y-4 bg-slate-800/30 p-4 rounded-xl border border-slate-800">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Histórico do Cliente</p>
                    <p className="text-slate-300 text-sm">{analysis.cliente.historico}</p>
                  </div>
                  {analysis.inadimplencia.classificacao !== 'Nenhuma' && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Risco de Inadimplência</p>
                      <p className="text-rose-500 text-sm font-bold">{analysis.inadimplencia.classificacao} ({analysis.inadimplencia.dias_atraso} dias)</p>
                      <ul className="mt-2 space-y-1">
                        {analysis.inadimplencia.acoes_sugeridas.map((acao, i) => (
                          <li key={i} className="text-xs text-slate-400 flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-slate-500" />
                            {acao}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Recomendação de Ajuste</p>
                    <p className="text-slate-300 text-sm">{analysis.sugestoes.recomendacao}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Loans */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="text-emerald-500" size={24} />
                <h3 className="text-xl font-bold text-white">Empréstimos Ativos</h3>
              </div>
              <button
                onClick={() => {
                  setError('');
                  setShowLoanModal(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
              >
                <Plus size={20} />
                Novo Empréstimo
              </button>
            </div>

            <div className="p-6">
              {loans.filter(l => l.status !== 'paid').length > 0 ? (
                <div className="space-y-4">
                  {loans.filter(l => l.status !== 'paid').map(loan => (
                    <div key={loan.id} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                            loan.type === 'simple' ? 'bg-purple-500/20 text-purple-400' : 'bg-emerald-500/20 text-emerald-400'
                          )}>
                            {loan.type === 'simple' ? 'Juros Mensal' : 'Parcelado'}
                          </span>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                            loan.status === 'overdue' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                          )}>
                            {loan.status === 'overdue' ? 'Em Atraso' : 'Em Dia'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-4">
                          <div className="min-w-[100px]">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Principal</p>
                            <p className="text-base font-bold text-white whitespace-nowrap">{formatCurrency(loan.principal)}</p>
                          </div>
                          <div className="min-w-[100px]">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Restante</p>
                            <p className="text-base font-bold text-emerald-400 whitespace-nowrap">{formatCurrency(loan.remainingAmount)}</p>
                          </div>
                          <div className="min-w-[60px]">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Juros</p>
                            <p className="text-base font-bold text-white whitespace-nowrap">{loan.interestRate}%</p>
                          </div>
                          <div className="min-w-[100px]">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Vencimento</p>
                            <p className="text-sm font-bold text-white whitespace-nowrap">
                              {loan.nextDueDate ? (loan.nextDueDate?.toDate ? format(loan.nextDueDate.toDate(), "dd/MM/yyyy") : format(new Date(loan.nextDueDate), "dd/MM/yyyy")) : 'N/A'}
                            </p>
                          </div>
                          <div className="min-w-[100px]">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Pagamento</p>
                            <p className="text-base font-bold text-white whitespace-nowrap">{formatCurrency(loan.installmentValue || 0)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0 md:w-48">
                        <button
                          onClick={() => setPaymentModal({ isOpen: true, loan })}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
                        >
                          Marcar Pago
                        </button>
                        <button
                          onClick={() => handleToggleOverdue(loan)}
                          className={cn(
                            "w-full px-4 py-2 rounded-xl text-sm font-bold transition-all",
                            loan.status === 'overdue' 
                              ? "bg-slate-700 hover:bg-slate-600 text-white" 
                              : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-500"
                          )}
                        >
                          {loan.status === 'overdue' 
                            ? (loan.nextDueDate && (() => {
                                const dueDate = loan.nextDueDate?.toDate ? loan.nextDueDate.toDate() : new Date(loan.nextDueDate);
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                return dueDate < today;
                              })() ? 'Cobrar Atraso' : 'Remover Atraso') 
                            : 'Marcar Atrasado'}
                        </button>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setReportModal({ isOpen: true, loan })}
                            className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center"
                            title="Relatório Financeiro"
                          >
                            <FileText size={20} />
                          </button>
                          <button
                            onClick={() => openEditLoanModal(loan)}
                            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center"
                            title="Editar Empréstimo"
                          >
                            <Pencil size={20} />
                          </button>
                          <button
                            onClick={() => setDeleteLoanModal({ isOpen: true, loanId: loan.id })}
                            className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center"
                            title="Excluir Empréstimo"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">
                  <p className="text-slate-500 font-medium">Nenhum empréstimo ativo para este cliente.</p>
                </div>
              )}
            </div>
          </div>

          {/* History */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-800 flex items-center gap-3">
              <History className="text-slate-400" size={24} />
              <h3 className="text-xl font-bold text-white">Histórico de Empréstimos</h3>
            </div>
            <div className="p-6">
              {loans.filter(l => l.status === 'paid').length > 0 ? (
                <div className="space-y-4">
                  {loans.filter(l => l.status === 'paid').map(loan => (
                    <div key={loan.id} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-800">
                      <div>
                        <p className="text-sm font-bold text-white">{loan.type === 'simple' ? 'Juros Mensal' : 'Parcelado'}</p>
                        <p className="text-xs text-slate-500">
                          {loan.startDate?.toDate ? format(loan.startDate.toDate(), "dd 'de' MMMM, yyyy", { locale: ptBR }) : (loan.startDate ? format(new Date(loan.startDate), "dd 'de' MMMM, yyyy", { locale: ptBR }) : 'Data indisponível')}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="text-sm font-bold text-emerald-500">{formatCurrency(loan.principal)}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Quitado</p>
                        </div>
                        <button
                          onClick={() => setReportModal({ isOpen: true, loan })}
                          className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg transition-colors"
                          title="Relatório Financeiro"
                        >
                          <FileText size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-slate-500 text-sm">Nenhum histórico disponível.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loan Modal */}
      <AnimatePresence>
        {showLoanModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowLoanModal(false);
                setEditingLoan(null);
                setPrincipal('');
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-white mb-6">
                {editingLoan ? 'Editar Empréstimo' : 'Novo Empréstimo'}
              </h3>
              
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/50 text-rose-500 p-4 rounded-xl flex items-center gap-3 mb-6">
                  <AlertCircle size={20} />
                  <p className="text-sm font-bold">{error}</p>
                </div>
              )}

              <form onSubmit={handleSaveLoan} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setLoanType('simple')}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all text-left",
                      loanType === 'simple' ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-800/50 hover:border-slate-700"
                    )}
                  >
                    <p className={cn("text-sm font-bold mb-1", loanType === 'simple' ? "text-emerald-400" : "text-slate-400")}>Mensal Simples</p>
                    <p className="text-[10px] text-slate-500 leading-tight">Juros fixos mensais sem abater o capital.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoanType('installment')}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all text-left",
                      loanType === 'installment' ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-800/50 hover:border-slate-700"
                    )}
                  >
                    <p className={cn("text-sm font-bold mb-1", loanType === 'installment' ? "text-emerald-400" : "text-slate-400")}>Parcelado</p>
                    <p className="text-[10px] text-slate-500 leading-tight">Capital + Juros divididos em parcelas fixas.</p>
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Valor do Capital</label>
                    <input
                      type="text"
                      required
                      value={principal}
                      onChange={(e) => setPrincipal(maskCurrency(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                        {loanType === 'simple' ? 'Juros (%)' : 'Juros Total'}
                      </label>
                      <div className="relative">
                        <input
                          type={loanType === 'simple' ? "number" : "text"}
                          required
                          value={interestRate}
                          onChange={(e) => setInterestRate(loanType === 'simple' ? e.target.value : maskCurrency(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder={loanType === 'simple' ? "0" : "R$ 0,00"}
                        />
                        {loanType === 'simple' && (
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">%</span>
                        )}
                      </div>
                    </div>
                    {loanType === 'installment' && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Parcelas</label>
                        <input
                          type="number"
                          required
                          value={installments}
                          onChange={(e) => setInstallments(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Data de Vencimento</label>
                    <input
                      type="date"
                      required
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Total a Pagar:</span>
                    <span className="text-lg font-bold text-white">
                      {formatCurrency(
                        loanType === 'simple' 
                          ? unmaskCurrency(principal || '0') 
                          : unmaskCurrency(principal || '0') + unmaskCurrency(interestRate || '0')
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">
                      {loanType === 'simple' ? 'Juros Mensal:' : 'Valor da Parcela:'}
                    </span>
                    <span className="text-lg font-bold text-emerald-400">
                      {formatCurrency(
                        loanType === 'simple'
                          ? (unmaskCurrency(principal || '0') * parseFloat(interestRate || '0') / 100)
                          : (unmaskCurrency(principal || '0') + unmaskCurrency(interestRate || '0')) / parseInt(installments || '1')
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLoanModal(false);
                      setEditingLoan(null);
                      setPrincipal('');
                    }}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
                  >
                    {saving ? 'Salvando...' : 'Confirmar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={deleteLoanModal.isOpen}
        onClose={() => setDeleteLoanModal({ isOpen: false, loanId: null })}
        onConfirm={confirmDeleteLoan}
        title="Excluir Empréstimo"
        message="Tem certeza que deseja excluir este empréstimo? Esta ação não pode ser desfeita e removerá o empréstimo do histórico do cliente."
        confirmText="Excluir Empréstimo"
        cancelText="Cancelar"
      />

      <ConfirmationModal
        isOpen={deleteClientModal}
        onClose={() => setDeleteClientModal(false)}
        onConfirm={handleDeleteClient}
        title="Excluir Cliente"
        message="Tem certeza que deseja excluir este cliente e todos os seus dados? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        isLoading={saving}
      />

      <PaymentModal
        isOpen={paymentModal.isOpen}
        onClose={() => setPaymentModal({ ...paymentModal, isOpen: false })}
        loan={paymentModal.loan}
        client={client}
      />

      {reportModal.loan && (
        <FinancialReportModal
          isOpen={reportModal.isOpen}
          onClose={() => setReportModal({ isOpen: false, loan: null })}
          client={client}
          loan={reportModal.loan}
        />
      )}
    </div>
  );
}
