import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { mapClientToSupabase } from '../lib/supabase-mapper';
import { Camera, CheckCircle, AlertCircle, Save, User, Mail, FileText, MapPin, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { maskCurrency, unmaskCurrency, maskCpf, validateCpf, cn } from '../lib/utils';

export default function PublicRegister() {
  const { adminId } = useParams();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
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
  const [observation, setObservation] = useState('');
  const [selfie, setSelfie] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelfie(reader.result as string);
      };
      reader.readAsDataURL(file);
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

      if (checkError) {
        throw checkError;
      }
      
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

      if (!selfie) {
        setError('Por favor, tire uma selfie para continuar.');
        setLoading(false);
        return;
      }

      const fullAddress = `${street}, ${number}, ${neighborhood}, ${city} - ${state}, CEP: ${cep}`;

      // Upload selfie to storage
      const fileExt = selfie.split(';')[0].split('/')[1];
      const fileName = `${cleanCpf}-${Date.now()}.${fileExt}`;
      const filePath = `selfies/${fileName}`;

      // Convert base64 to blob
      const base64Data = selfie.split(',')[1];
      const res = await fetch(`data:image/${fileExt};base64,${base64Data}`);
      const blob = await res.blob();

      const { error: uploadError } = await supabase.storage
        .from('selfies')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('selfies')
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase.from('clients').insert(mapClientToSupabase({
        name,
        cpf: cleanCpf,
        email: cleanEmail,
        address: fullAddress,
        requestedAmount: unmaskCurrency(requestedAmount),
        observation,
        selfieUrl: publicUrl,
        status: 'Em análise',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      
      if (insertError) {
        throw insertError;
      }
      
      setSuccess(true);
    } catch (err) {
      console.error("Error registering client:", err);
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-emerald-500" size={40} />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Cadastro Enviado!</h2>
          <p className="text-slate-400 leading-relaxed mb-8">
            Seus dados foram recebidos com sucesso. Nossa equipe analisará sua solicitação em um prazo de 3 a 5 dias úteis.
          </p>
          <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
            <p className="text-xs text-slate-500 font-medium">Você receberá uma notificação por email assim que houver uma atualização no seu status.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-emerald-500 tracking-tighter mb-2 italic">CREED-PRO</h1>
          <p className="text-slate-400">Solicitação de Crédito Rápido e Seguro</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl flex items-center gap-3 mb-8">
              <AlertCircle size={20} />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="flex flex-col items-center mb-10">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-32 h-32 rounded-full bg-slate-800 border-4 border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 transition-all overflow-hidden group relative"
              >
                {selfie ? (
                  <img src={selfie} alt="Selfie" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Camera className="text-slate-500 group-hover:text-emerald-500 transition-colors" size={32} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Tirar Selfie</span>
                  </>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="text-white" size={24} />
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                capture="user" 
                className="hidden" 
              />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-4">Foto do Rosto (Obrigatório)</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                  <User size={14} /> Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Seu nome completo"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                  <FileText size={14} /> CPF
                </label>
                <input
                  type="text"
                  required
                  value={cpf}
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                  <Mail size={14} /> Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="seu@email.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                  <DollarSign size={14} /> Valor Solicitado
                </label>
                <input
                  type="text"
                  required
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(maskCurrency(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
                <MapPin size={16} className="text-emerald-500" /> Endereço
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">CEP</label>
                  <input
                    type="text"
                    required
                    value={cep}
                    onChange={handleCepChange}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="UF"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Observação (Opcional)</label>
              <textarea
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                placeholder="Alguma informação adicional?"
              />
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-5 rounded-2xl transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 text-lg"
              >
                <Save size={24} />
                {loading ? 'Enviando...' : 'Enviar Solicitação'}
              </button>
            </div>
          </form>
        </motion.div>
        
        <p className="text-center text-slate-500 text-xs mt-8">
          Ao enviar, você concorda com nossos termos de análise de crédito.
        </p>
      </div>
    </div>
  );
}
