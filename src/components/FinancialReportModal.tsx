import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, Download } from 'lucide-react';
import { Client, Loan, Payment } from '../types';
import { supabase } from '../lib/supabase';
import { mapSupabasePayment } from '../lib/supabase-mapper';
import { formatCurrency, formatCpf } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

interface FinancialReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  loan: Loan;
}

export function FinancialReportModal({ isOpen, onClose, client, loan }: FinancialReportModalProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchPayments = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('payments')
          .select('*')
          .eq('loan_id', loan.id)
          .order('date', { ascending: false });
          
        if (error) throw error;
        
        if (data) {
          setPayments(data.map(mapSupabasePayment));
        }
      } catch (error) {
        console.error("Error fetching payments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [isOpen, loan.id]);

  if (!isOpen) return null;

  const handlePrint = async () => {
    const element = document.getElementById('financial-report-content');
    if (!element) return;

    setIsGenerating(true);
    try {
      // Temporarily adjust styles for better PDF rendering
      const originalStyle = element.style.cssText;
      element.style.width = '800px';
      element.style.padding = '40px';
      element.style.backgroundColor = '#ffffff';

      const dataUrl = await toPng(element, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      // Restore original styles
      element.style.cssText = originalStyle;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Relatorio_${client.name.replace(/\s+/g, '_')}_${format(new Date(), 'ddMMyyyy')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Fallback to window.print() if it fails
      window.print();
    } finally {
      setIsGenerating(false);
    }
  };

  // Calculate client rating
  const isOverdue = loan.status === 'overdue';
  const hasPaid = payments.length > 0;
  let clientRating = 'Novo (Sem histórico)';
  if (isOverdue) {
    clientRating = 'Risco Alto (Atrasado)';
  } else if (loan.status === 'paid') {
    clientRating = 'Ouro (Excelente)';
  } else if (hasPaid) {
    clientRating = 'Prata (Bom)';
  }

  const totalPaid = payments.reduce((acc, curr) => acc + curr.amount, 0);

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    if (date.toDate) {
      return format(date.toDate(), 'dd/MM/yyyy', { locale: ptBR });
    }
    return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 print:p-0 print:static print:z-auto print:block">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm print:hidden"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl bg-white text-slate-900 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:rounded-none print:w-full"
        >
          {/* Header Actions (Hidden in print) */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 print:hidden">
            <h2 className="text-lg font-bold text-slate-800">Relatório Financeiro</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                disabled={isGenerating}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Gerando PDF...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Salvar PDF
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Report Content */}
          <div id="financial-report-content" className="p-8 sm:p-12 overflow-y-auto print:overflow-visible print:p-0 bg-white">
            
            {/* Report Header */}
            <div className="text-center mb-10 border-b-2 border-slate-800 pb-6">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-widest mb-2">
                Histórico Financeiro do Cliente
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                Documento Oficial • Emitido em {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>

            {/* Client Data */}
            <div className="mb-10">
              <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wider border-b border-slate-300 pb-2 mb-4">
                Dados do Cliente
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                <div>
                  <span className="text-slate-500 font-medium block text-xs uppercase tracking-wider">Nome Completo</span>
                  <span className="font-bold text-slate-900">{client.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block text-xs uppercase tracking-wider">CPF</span>
                  <span className="font-bold text-slate-900">{formatCpf(client.cpf)}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block text-xs uppercase tracking-wider">Email</span>
                  <span className="font-bold text-slate-900">{client.email}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block text-xs uppercase tracking-wider">Endereço</span>
                  <span className="font-bold text-slate-900">{client.address || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block text-xs uppercase tracking-wider">Classificação do Cliente</span>
                  <span className="font-bold text-slate-900">{clientRating}</span>
                </div>
              </div>
            </div>

            {/* Contract Info */}
            <div className="mb-10">
              <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wider border-b border-slate-300 pb-2 mb-4">
                Informações do Contrato
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm bg-slate-50 p-6 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 font-medium block text-xs uppercase tracking-wider mb-1">Valor Emprestado</span>
                  <span className="text-xl font-black text-slate-900">{formatCurrency(loan.principal)}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block text-xs uppercase tracking-wider mb-1">Data do Contrato</span>
                  <span className="font-bold text-slate-900">{formatDate(loan.startDate)}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block text-xs uppercase tracking-wider mb-1">Tipo do Empréstimo</span>
                  <span className="font-bold text-slate-900">
                    {loan.type === 'simple' 
                      ? 'Juros Mensal' 
                      : `Parcelado (${loan.installments || 1}x de ${formatCurrency(loan.installmentValue || 0)})`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block text-xs uppercase tracking-wider mb-1">Situação Atual</span>
                  <span className="font-bold text-slate-900 uppercase">
                    {loan.status === 'active' ? 'Em aberto' : loan.status === 'paid' ? 'Quitado' : 'Atrasado'}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment History */}
            <div className="mb-10">
              <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wider border-b border-slate-300 pb-2 mb-4">
                Histórico de Pagamentos
              </h2>
              {loading ? (
                <div className="text-center py-8 text-slate-500">Carregando pagamentos...</div>
              ) : payments.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                  Nenhum pagamento registrado para este contrato.
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg">Data</th>
                      <th className="px-4 py-3">Descrição</th>
                      <th className="px-4 py-3 text-right rounded-tr-lg">Valor Pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{formatDate(payment.date)}</td>
                        <td className="px-4 py-3 text-slate-600">Pagamento de parcela/juros</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(payment.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Financial Summary */}
            <div className="mb-10">
              <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wider border-b border-slate-300 pb-2 mb-4">
                Resumo Financeiro
              </h2>
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-1 bg-emerald-50 border border-emerald-200 p-6 rounded-lg">
                  <span className="text-emerald-700 font-medium block text-xs uppercase tracking-wider mb-1">Total Pago até o Momento</span>
                  <span className="text-2xl font-black text-emerald-700">{formatCurrency(totalPaid)}</span>
                </div>
              </div>
            </div>

            {/* Observations */}
            <div className="mt-16 pt-8 border-t border-slate-300 text-center">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">Observações</h3>
              <p className="text-sm text-slate-500 italic">
                "Este documento representa o histórico financeiro atualizado do cliente junto ao sistema."
              </p>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
