import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { mapClientToSupabase } from '../lib/supabase-mapper';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Copy, Check, Link as LinkIcon, Save, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { maskCurrency, unmaskCurrency, maskCpf, validateCpf, cn } from '../lib/utils';

export default function RegisterClient() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  
  // Form State
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [observation, setObservation] = useState('');

  // We don't have auth.currentUser?.uid directly here, but we can get it from Supabase if needed.
  // For now, we'll just use a placeholder or fetch it if necessary.
  const [userId, setUserId] = useState<string | null>(null);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const publicLink = `${window.location.origin}/register/${userId || 'default'}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    
    // Mask CEP
    const maskedCep = value.replace(/^(\d{5})(\d)/, '$1-$2');
    setCep(maskedCep);

    if (value.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${value}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setStreet(data.logradouro || '');
          setNeighborhood(data.bairro || '');
          setCity(data.localidade || '');
          setState(data.uf || '');
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanCpf = cpf.replace(/\D/g, '');
    if (!validateCpf(cleanCpf)) {
      setError('CPF inválido. Verifique os números digitados.');
      return;
    }

    setLoading(true);
    try {
      // Check if CPF already exists
      const { data: existingClients, error: checkError } = await supabase
        .from('clients')
        .select('id')
        .eq('cpf', cleanCpf);
      
      if (existingClients && existingClients.length > 0) {
        setError('Este CPF já está cadastrado no sistema.');
        setLoading(false);
        return;
      }

      const cleanEmail = email.trim();
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(cleanEmail)) {
        setError('Email inválido. Verifique o formato.');
        setLoading(false);
        return;
      }

      if (!cep || !street || !number || !neighborhood || !city || !state) {
        setError('Preencha todos os campos de endereço.');
        setLoading(false);
        return;
      }

      const fullAddress = `${street}, ${number}, ${neighborhood}, ${city} - ${state}, CEP: ${cep}`;

      const { error: insertError } = await supabase.from('clients').insert(mapClientToSupabase({
        id: '', // Supabase will generate this
        name,
        cpf: cleanCpf,
        email: cleanEmail,
        address: fullAddress,
        requestedAmount: unmaskCurrency(requestedAmount),
        monthlyIncome: unmaskCurrency(monthlyIncome),
        observation,
        status: 'Em análise',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      
      if (insertError) {
        console.error("Error registering client:", insertError);
        setError('Erro ao cadastrar cliente.');
        return;
      }
      
      navigate('/clients');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
            <UserPlus className="text-emerald-500" size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Cadastrar Cliente</h2>
            <p className="text-slate-400 mt-1">Adicione um novo cliente manualmente ou gere um link</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/clients')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors self-start md:self-auto"
        >
          <ArrowLeft size={24} />
          <span className="font-medium">Voltar</span>
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Manual Registration Form */}
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-8">
              <UserPlus className="text-emerald-500" size={24} />
              <h3 className="text-xl font-bold text-white">Cadastro Manual</h3>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">CPF</label>
                  <input
                    type="text"
                    required
                    value={cpf}
                    onChange={(e) => setCpf(maskCpf(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="cliente@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Valor Solicitado</label>
                  <input
                    type="text"
                    required
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(maskCurrency(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="R$ 0,00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Renda Mensal</label>
                  <input
                    type="text"
                    required
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(maskCurrency(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="R$ 0,00"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white border-b border-slate-800 pb-2">Endereço</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">CEP</label>
                    <input
                      type="text"
                      required
                      value={cep}
                      onChange={handleCepChange}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="00000-000"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Rua / Logradouro</label>
                    <input
                      type="text"
                      required
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Nome da rua"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Número</label>
                    <input
                      type="text"
                      required
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="123"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Bairro</label>
                    <input
                      type="text"
                      required
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Nome do bairro"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Cidade</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Nome da cidade"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Estado (UF)</label>
                    <input
                      type="text"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase())}
                      maxLength={2}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="UF"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Observação</label>
                <textarea
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  placeholder="Informações adicionais sobre o cliente..."
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  {loading ? 'Salvando...' : 'Salvar Cadastro'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>

        {/* Public Link Card */}
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-sm sticky top-10"
          >
            <div className="flex items-center gap-3 mb-6">
              <LinkIcon className="text-emerald-500" size={24} />
              <h3 className="text-xl font-bold text-white">Link de Cadastro</h3>
            </div>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              Envie este link para que o cliente realize o próprio cadastro. Os dados cairão automaticamente na aba "Em análise".
            </p>

            <div className="space-y-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 break-all text-xs font-mono text-emerald-400">
                {publicLink}
              </div>
              <button
                onClick={handleCopyLink}
                className={cn(
                  "w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all",
                  copied ? "bg-emerald-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-white"
                )}
              >
                {copied ? <Check size={20} /> : <Copy size={20} />}
                {copied ? 'Copiado!' : 'Copiar Link'}
              </button>
            </div>

            <div className="mt-10 pt-8 border-t border-slate-800">
              <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
                <p className="text-xs text-emerald-400 font-medium leading-relaxed">
                  <strong>Dica:</strong> Você pode encurtar este link ou criar um QR Code para facilitar o acesso do cliente.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
