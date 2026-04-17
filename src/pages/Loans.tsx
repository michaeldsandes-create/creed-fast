import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { mapSupabaseLoan, mapSupabaseClient, mapLoanToSupabase } from '../lib/supabase-mapper';
import { Loan, Client, LoanStatus } from '../types';
import { Search, Filter, CheckCircle, Clock, AlertCircle, TrendingUp, DollarSign, Users, Calendar, Plus, X, Loader2, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency, cn, unmaskCurrency, maskCurrency, formatCpf, getLoanStatus } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PaymentModal } from '../components/PaymentModal';

const statusColors = {
  'active': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'paid': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'overdue': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
};

const statusIcons = {
  'active': Clock,
  'paid': CheckCircle,
  'overdue': AlertCircle,
};

const statusLabels = {
  'active': 'Ativo',
  'paid': 'Pago',
  'overdue': 'Atrasado',
};

export default function Loans() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [clients, setClients] = useState<Record<string, Client>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<LoanStatus | null>(null);
  const [search, setSearch] = useState('');
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [error, setError] = useState('');

  // New Loan Form State
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, loanId: string | null}>({isOpen: false, loanId: null});
  const [selectedClientId, setSelectedClientId] = useState('');
  const [loanType, setLoanType] = useState<'simple' | 'installment'>('simple');
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('15');
  const [installments, setInstallments] = useState('1');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
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
      const { data, error } = await supabase.from('loans').select('*');
      if (data) {
        setLoans(data.map(mapSupabaseLoan).map(l => ({ ...l, status: getLoanStatus(l) })));
      }
      setLoading(false);
    };

    const fetchClients = async () => {
      const { data, error } = await supabase.from('clients').select('*');
      if (data) {
        const clientsMap: Record<string, Client> = {};
        data.map(mapSupabaseClient).forEach(c => {
          clientsMap[c.id] = c;
        });
        setClients(clientsMap);
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

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedClientId) {
      setError('Selecione um cliente.');
      return;
    }

    const p = unmaskCurrency(principal);
    if (p <= 0) {
      setError('O valor principal deve ser maior que zero.');
      return;
    }

    const r = loanType === 'simple' ? parseFloat(interestRate) : unmaskCurrency(interestRate);
    if (isNaN(r) || r < 0) {
      setError('A taxa de juros deve ser válida e maior ou igual a zero.');
      return;
    }

    if (!dueDate) {
      setError('Data de vencimento é obrigatória.');
      return;
    }

    const [year, month, day] = dueDate.split('-').map(Number);
    const nextDueDate = new Date(year, month - 1, day);

    if (isNaN(nextDueDate.getTime())) {
      setError('Data de vencimento inválida.');
      return;
    }

    setSaving(true);
    const inst = parseInt(installments) || 1;

    let totalAmount = p;
    let installmentValue = 0;

    if (loanType === 'simple') {
      totalAmount = p;
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
          clientId: selectedClientId,
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
          clientId: selectedClientId,
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
      }
      
      closeLoanModal();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const closeLoanModal = () => {
    setShowLoanModal(false);
    setEditingLoan(null);
    setPrincipal('');
    setSelectedClientId('');
    setInterestRate('15');
    setInstallments('1');
    setLoanType('simple');
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDueDate(d.toISOString().split('T')[0]);
    setError('');
  };

  const handleEditClick = (e: React.MouseEvent, loan: Loan) => {
    e.stopPropagation();
    setEditingLoan(loan);
    setSelectedClientId(loan.clientId);
    setLoanType(loan.type);
    setPrincipal(formatCurrency(loan.principal));
    setInterestRate(loan.type === 'simple' ? loan.interestRate.toString() : formatCurrency(loan.interestRate));
    setInstallments((loan.installments || 1).toString());
    
    if (loan.nextDueDate) {
      const d = loan.nextDueDate instanceof Date ? loan.nextDueDate : new Date(loan.nextDueDate);
      if (!isNaN(d.getTime())) {
        setDueDate(d.toISOString().split('T')[0]);
      }
    }
    
    setShowLoanModal(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, loanId: string) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, loanId });
  };
  
  const confirmDelete = async () => {
    if (!deleteModal.loanId) return;
    try {
      await supabase.from('loans').delete().eq('id', deleteModal.loanId);
      setDeleteModal({ isOpen: false, loanId: null });
    } catch (err) {
      console.error("Error deleting loan:", err);
    }
  };

  const { filteredLoans, validLoans, stats } = useMemo(() => {
    const valid = loans.filter(l => clients[l.clientId]);
    
    const filtered = valid.filter(loan => {
      const client = clients[loan.clientId];
      const matchesSearch = client.name.toLowerCase().includes(search.toLowerCase()) || 
                            client.cpf.includes(search);
      const matchesFilter = filterStatus ? loan.status === filterStatus : true;
      return matchesSearch && matchesFilter;
    });

    const calculatedStats = {
      totalActive: valid.filter(l => l.status === 'active').reduce((acc, l) => acc + (l.remainingAmount || 0), 0),
      totalPaid: valid.filter(l => l.status === 'paid').reduce((acc, l) => acc + (l.totalAmount || 0), 0),
      totalOverdue: valid.filter(l => l.status === 'overdue').reduce((acc, l) => acc + (l.remainingAmount || 0), 0),
      count: valid.length
    };

    return { filteredLoans: filtered, validLoans: valid, stats: calculatedStats };
  }, [loans, clients, search, filterStatus]);

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shrink-0">
            <DollarSign className="text-emerald-500" size={32} />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Empréstimos</h2>
            <p className="text-sm md:text-base text-slate-400 mt-1">Acompanhe todos os contratos e pagamentos</p>
          </div>
        </div>
        <button
          onClick={() => setShowLoanModal(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 w-full md:w-auto shrink-0"
        >
          <Plus size={24} className="shrink-0" />
          Novo Empréstimo
        </button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 shrink-0">
              <TrendingUp size={24} />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider truncate">Saldo Ativo</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-white whitespace-nowrap">{formatCurrency(stats.totalActive)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 shrink-0">
              <DollarSign size={24} />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider truncate">Total Recebido</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-white whitespace-nowrap">{formatCurrency(stats.totalPaid)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-500 shrink-0">
              <AlertCircle size={24} />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider truncate">Em Atraso</span>
          </div>
          <p className="text-xl md:text-2xl font-bold text-white whitespace-nowrap">{formatCurrency(stats.totalOverdue)}</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 shrink-0" size={20} />
            <input
              type="text"
              placeholder="Buscar por nome do cliente ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 pl-11 pr-4 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            <Filter className="text-slate-500 shrink-0" size={20} />
            <button
              onClick={() => setFilterStatus(null)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                !filterStatus ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800"
              )}
            >
              Todos
            </button>
            {(['active', 'paid', 'overdue'] as LoanStatus[]).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                  filterStatus === status ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800"
                )}
              >
                {statusLabels[status]}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1000px]">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Tipo / Juros</th>
                <th className="px-6 py-4">Valor Total</th>
                <th className="px-6 py-4">Restante</th>
                <th className="px-6 py-4">Vencimento</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <AnimatePresence mode="popLayout">
                {filteredLoans.map((loan) => {
                  const client = clients[loan.clientId];
                  const StatusIcon = statusIcons[loan.status];
                  return (
                    <motion.tr
                      key={loan.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-slate-800/50 transition-colors group cursor-pointer"
                      onClick={() => window.location.href = `/clients/${loan.clientId}`}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                            {client?.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{client?.name || 'Carregando...'}</p>
                            <p className="text-xs text-slate-500">{client?.cpf}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-1">
                          <p className="text-sm text-white font-medium">
                            {loan.type === 'simple' ? 'Simples' : 'Parcelado'}
                          </p>
                          <p className="text-xs text-emerald-500 font-bold">
                            {loan.interestRate}% ao mês
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-white">
                        {formatCurrency(loan.totalAmount)}
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-rose-400">
                        {formatCurrency(loan.remainingAmount)}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Calendar size={14} />
                          <span className="text-sm">
                            {loan.nextDueDate ? format(loan.nextDueDate.toDate ? loan.nextDueDate.toDate() : new Date(loan.nextDueDate), "dd 'de' MMM", { locale: ptBR }) : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                          statusColors[loan.status]
                        )}>
                          <StatusIcon size={14} />
                          {statusLabels[loan.status]}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          {loan.status !== 'paid' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPaymentModal({ isOpen: true, loan, clientId: loan.clientId });
                              }}
                              className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all shrink-0"
                              title="Registrar Pagamento"
                            >
                              <DollarSign size={20} />
                            </button>
                          )}
                          <button
                            onClick={(e) => handleEditClick(e, loan)}
                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all shrink-0"
                            title="Editar Empréstimo"
                          >
                            <Pencil size={20} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(e, loan.id)}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all shrink-0"
                            title="Excluir Empréstimo"
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
          
          {filteredLoans.length === 0 && !loading && (
            <div className="p-12 text-center">
              <div className="bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                <DollarSign size={32} />
              </div>
              <h3 className="text-lg font-bold text-white">Nenhum empréstimo encontrado</h3>
              <p className="text-slate-400">Tente ajustar sua busca ou filtros.</p>
            </div>
          )}
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
              onClick={closeLoanModal}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">{editingLoan ? 'Editar Empréstimo' : 'Novo Empréstimo'}</h3>
                <button onClick={closeLoanModal} className="text-slate-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSaveLoan} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Selecionar Cliente</label>
                  <select
                    required
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                  >
                    <option value="">Selecione um cliente...</option>
                    {Object.values(clients).map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name} - {formatCpf(client.cpf)}
                      </option>
                    ))}
                  </select>
                </div>

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
                  <div className="grid grid-cols-2 gap-4">
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
                    onClick={() => setShowLoanModal(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
                  >
                    {saving ? <Loader2 className="animate-spin mx-auto" size={24} /> : 'Confirmar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PaymentModal
        isOpen={paymentModal.isOpen}
        onClose={() => setPaymentModal({ ...paymentModal, isOpen: false })}
        loan={paymentModal.loan}
        client={clients[paymentModal.clientId]}
      />
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteModal({ isOpen: false, loanId: null })}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Excluir Empréstimo?</h3>
              <p className="text-slate-400 mb-8">
                Tem certeza que deseja excluir este empréstimo? Esta ação não poderá ser desfeita e todos os pagamentos vinculados também serão afetados.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setDeleteModal({ isOpen: false, loanId: null })}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 bg-rose-500 hover:bg-rose-400 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-rose-500/20"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
