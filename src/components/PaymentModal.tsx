import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { mapPaymentToSupabase } from '../lib/supabase-mapper';
import { Loan, Client } from '../types';
import { formatCurrency, unmaskCurrency, maskCurrency, cn } from '../lib/utils';
import { startOfDay, isBefore, differenceInDays } from 'date-fns';
import { calcularJurosAtraso, TipoCliente } from '../lib/interestCalculator';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
  client: Client | null;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, loan, client }) => {
  const [paymentType, setPaymentType] = useState<'full' | 'partial' | 'interest'>('full');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [jurosAtraso, setJurosAtraso] = useState(0);
  const [diasAtraso, setDiasAtraso] = useState(0);

  useEffect(() => {
    if (loan) {
      setPaymentType('full');
      setPaymentAmount('');
      
      // Calcular juros por atraso
      if (loan.nextDueDate && client) {
        try {
          const dueDate = loan.nextDueDate instanceof Date ? loan.nextDueDate : new Date(loan.nextDueDate);
          const startDate = loan.startDate instanceof Date ? loan.startDate : new Date(loan.startDate || Date.now());
          
          const tipoCliente: TipoCliente = client.clientType || 'medio';
          
          const resultado = calcularJurosAtraso({
            data_emprestimo: startDate,
            data_vencimento: dueDate,
            data_pagamento: new Date(), // Data atual
            tipo_cliente: tipoCliente
          });
          
          setDiasAtraso(resultado.dias_atraso);
          setJurosAtraso(resultado.valor_juros_total);
        } catch (e) {
          console.error("Erro ao calcular juros:", e);
          setDiasAtraso(0);
          setJurosAtraso(0);
        }
      } else {
        setDiasAtraso(0);
        setJurosAtraso(0);
      }
    }
  }, [loan, client]);

  const totalOwed = (loan?.remainingAmount || 0) + jurosAtraso;

  const handleMarkAsPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan || !client) return;
    setSaving(true);

    const amount = paymentType === 'full' ? totalOwed : unmaskCurrency(paymentAmount);
    
    // If it's an interest-only payment, the principal (remainingAmount) doesn't change
    const newRemaining = paymentType === 'interest' 
      ? loan.remainingAmount 
      : Math.max(0, totalOwed - amount);
      
    const isFullyPaid = newRemaining === 0;

    // Calculate next due date (30 days from current nextDueDate)
    let currentDueDate = loan.nextDueDate instanceof Date ? loan.nextDueDate : (loan.nextDueDate ? new Date(loan.nextDueDate) : new Date());
    if (isNaN(currentDueDate.getTime())) {
      currentDueDate = new Date();
    }
    const nextDueDate = new Date(currentDueDate);
    nextDueDate.setDate(nextDueDate.getDate() + 30);

    const today = startOfDay(new Date());
    const isLate = isBefore(startOfDay(currentDueDate), today);
    const daysLate = isLate ? differenceInDays(today, startOfDay(currentDueDate)) : 0;

    const isNowActive = !isFullyPaid && !isBefore(startOfDay(nextDueDate), today);

    try {
      const { error: updateError } = await supabase.from('loans').update({
        status: isFullyPaid ? 'paid' : (isNowActive ? 'active' : loan.status),
        remaining_amount: newRemaining,
        next_due_date: isFullyPaid ? (loan.nextDueDate instanceof Date ? loan.nextDueDate.toISOString() : loan.nextDueDate) : nextDueDate.toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', loan.id);
      
      if (updateError) {
        console.error("Error updating loan:", updateError);
        setSaving(false);
        return;
      }
      
      const { error: insertError } = await supabase.from('payments').insert(mapPaymentToSupabase({
        id: '', // Supabase will generate this
        loanId: loan.id,
        clientId: client.id,
        amount: amount,
        jurosAtrasoPago: paymentType === 'full' ? jurosAtraso : Math.min(amount, jurosAtraso),
        date: new Date(),
        status: 'paid',
        type: paymentType,
        isLate: diasAtraso > 0,
        daysLate: diasAtraso
      }));
      
      if (insertError) {
        console.error("Error saving payment:", insertError);
        setSaving(false);
        return;
      }
      
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !loan) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-white">Registrar Pagamento</h3>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleMarkAsPaid} className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setPaymentType('full')}
                className={cn(
                  "p-3 rounded-2xl border-2 transition-all text-left",
                  paymentType === 'full' ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-800/50 hover:border-slate-700"
                )}
              >
                <p className={cn("text-xs font-bold mb-1", paymentType === 'full' ? "text-emerald-400" : "text-slate-400")}>Total</p>
                <p className="text-[9px] text-slate-500 leading-tight">Quitar saldo total</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentType('partial');
                  setPaymentAmount(maskCurrency(((loan.installmentValue || 0) * 100).toFixed(0)));
                }}
                className={cn(
                  "p-3 rounded-2xl border-2 transition-all text-left",
                  paymentType === 'partial' ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-800/50 hover:border-slate-700"
                )}
              >
                <p className={cn("text-xs font-bold mb-1", paymentType === 'partial' ? "text-emerald-400" : "text-slate-400")}>Parcial</p>
                <p className="text-[9px] text-slate-500 leading-tight">Abater do capital</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentType('interest');
                  // Calculate monthly interest based on principal and rate
                  const monthlyInterest = loan.type === 'simple' 
                    ? (loan.installmentValue || (loan.principal * (loan.interestRate / 100)))
                    : ((loan.interestRate || 0) / (loan.installments || 1));
                  setPaymentAmount(maskCurrency((monthlyInterest * 100).toFixed(0)));
                }}
                className={cn(
                  "p-3 rounded-2xl border-2 transition-all text-left",
                  paymentType === 'interest' ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-800/50 hover:border-slate-700"
                )}
              >
                <p className={cn("text-xs font-bold mb-1", paymentType === 'interest' ? "text-emerald-400" : "text-slate-400")}>Juros</p>
                <p className="text-[9px] text-slate-500 leading-tight">Apenas juros mensal</p>
              </button>
            </div>

            {paymentType !== 'full' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Valor Pago</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(maskCurrency(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="R$ 0,00"
                />
              </div>
            )}

            <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Saldo Atual:</span>
                <span className="text-white font-bold">{formatCurrency(loan.remainingAmount)}</span>
              </div>
              
              {diasAtraso > 0 && (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-rose-400">Dias de Atraso:</span>
                    <span className="text-rose-400 font-bold">{diasAtraso} dias</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-rose-400">Juros por Atraso:</span>
                    <span className="text-rose-400 font-bold">+ {formatCurrency(jurosAtraso)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Pagamento:</span>
                <span className="text-emerald-400 font-bold">
                  - {formatCurrency(paymentType === 'full' ? totalOwed : unmaskCurrency(paymentAmount))}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-700 flex justify-between items-center">
                <span className="text-sm font-bold text-white">Novo Saldo:</span>
                <span className="text-lg font-bold text-white">
                  {formatCurrency(paymentType === 'interest' ? loan.remainingAmount : Math.max(0, totalOwed - (paymentType === 'full' ? totalOwed : unmaskCurrency(paymentAmount))))}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
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
    </AnimatePresence>
  );
};
