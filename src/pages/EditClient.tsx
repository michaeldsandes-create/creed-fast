import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { mapSupabaseClient, mapClientToSupabase } from '../lib/supabase-mapper';
import { Client, ClientStatus } from '../types';
import { Save, ArrowLeft, User, Mail, CreditCard, MapPin, FileText, Loader2 } from 'lucide-react';
import { maskCurrency, unmaskCurrency, maskCpf, cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function EditClient() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpf: '',
    address: '',
    requestedAmount: '',
    monthlyIncome: '',
    observation: '',
    status: 'Em análise' as ClientStatus
  });

  useEffect(() => {
    const fetchClient = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase.from('clients').select('*').eq('id', id).single();
        if (data) {
          const clientData = mapSupabaseClient(data);
          setFormData({
            name: clientData.name,
            email: clientData.email,
            cpf: clientData.cpf,
            address: clientData.address || '',
            requestedAmount: maskCurrency(((clientData.requestedAmount || 0) * 100).toFixed(0)),
            monthlyIncome: maskCurrency(((clientData.monthlyIncome || 0) * 100).toFixed(0)),
            observation: clientData.observation || '',
            status: clientData.status
          });
        } else {
          navigate('/clients');
        }
      } catch (error) {
        console.error("Error fetching client:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchClient();
  }, [id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError('');

    const cleanCpf = formData.cpf.replace(/\D/g, '');
    if (cleanCpf.length < 11) {
      setError('CPF inválido. Digite os 11 números.');
      return;
    }

    const cleanEmail = formData.email.trim();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      setError('Email inválido. Verifique o formato.');
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase.from('clients').update(mapClientToSupabase({
        ...formData,
        cpf: cleanCpf,
        email: cleanEmail,
        requestedAmount: unmaskCurrency(formData.requestedAmount),
        monthlyIncome: unmaskCurrency(formData.monthlyIncome),
        updatedAt: new Date()
      })).eq('id', id);
      
      if (updateError) {
        console.error("Error updating client:", updateError);
        setError('Erro ao atualizar cliente.');
        return;
      }
      
      navigate(`/clients/${id}`);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Editar Cliente</h2>
            <p className="text-slate-400 mt-1">Atualize as informações do cliente</p>
          </div>
        </div>
      </header>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Basic Info */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <User className="text-emerald-500" size={20} />
                <h3 className="text-lg font-bold text-white">Informações Básicas</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Nome Completo</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    placeholder="Ex: João Silva"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      placeholder="joao@exemplo.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">CPF</label>
                  <div className="relative">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input
                      required
                      type="text"
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: maskCpf(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Loan Info */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="text-emerald-500" size={20} />
                <h3 className="text-lg font-bold text-white">Dados da Solicitação</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Valor Solicitado</label>
                  <input
                    required
                    type="text"
                    value={formData.requestedAmount}
                    onChange={(e) => setFormData({ ...formData, requestedAmount: maskCurrency(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3 px-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    placeholder="R$ 0,00"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Renda Mensal</label>
                  <input
                    required
                    type="text"
                    value={formData.monthlyIncome}
                    onChange={(e) => setFormData({ ...formData, monthlyIncome: maskCurrency(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3 px-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    placeholder="R$ 0,00"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ClientStatus })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all appearance-none"
                  >
                    <option value="Em análise">Em análise</option>
                    <option value="Aprovado">Aprovado</option>
                    <option value="Rejeitado">Rejeitado</option>
                    <option value="Aguardando caixa">Aguardando caixa</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 ml-1">Endereço</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      placeholder="Rua, Número, Bairro, Cidade"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-2">
            <label className="text-sm font-medium text-slate-400 ml-1">Observações</label>
            <textarea
              value={formData.observation}
              onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all min-h-[100px]"
              placeholder="Alguma observação importante sobre o cliente..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-8 py-3 rounded-2xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-12 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
          >
            {saving ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Save size={20} />
            )}
            Salvar Alterações
          </button>
        </div>
      </form>
    </div>
  );
}
