import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { User, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let authPromise;
      if (isSignUp) {
        authPromise = supabase.auth.signUp({
          email,
          password,
        });
      } else {
        authPromise = supabase.auth.signInWithPassword({
          email,
          password,
        });
      }

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: O servidor demorou muito para responder. Se o seu projeto Supabase estava pausado, ele pode estar acordando agora. Tente novamente.')), 60000)
      );

      const { data, error } = await Promise.race([authPromise, timeoutPromise]) as any;

      if (error) {
        console.error("Supabase auth error:", error);
        if (error.message.includes('Email not confirmed')) {
          setError('⚠️ Confirmação de email pendente! Por favor, verifique sua caixa de entrada (e o spam) e clique no link para confirmar sua conta antes de entrar.');
        } else if (error.message.includes('Invalid login credentials')) {
          setError('Email ou senha incorretos. Se você não tem uma conta, clique em "Criar uma conta".');
        } else if (error.message.includes('User already registered')) {
          setError('Este email já está cadastrado. Trocamos para a tela de Login para você entrar.');
          setIsSignUp(false);
        } else {
          setError(`Erro: ${error.message}`);
        }
      } else if (data.session) {
        window.location.href = '/';
      } else if (isSignUp && data.user) {
        setError('Conta criada com sucesso! Você já pode fazer login (ou verifique seu email se a confirmação estiver ativada no Supabase).');
        setIsSignUp(false);
      }
    } catch (err) {
      console.error("Auth exception:", err);
      const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro ao tentar autenticar.';
      const debugInfo = ` (URL: ${import.meta.env.VITE_SUPABASE_URL})`;
      setError(errorMessage + (errorMessage.includes('Failed to fetch') ? debugInfo : ''));
    } finally {
      setLoading(false);
    }
  };

  // Particles generation
  const particles = Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    size: Math.random() * 4 + 2,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * 5,
  }));

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950 font-sans">
      
      {/* 3D Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none perspective-[1000px]">
        
        {/* Particles */}
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-white/20 blur-[1px]"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.x}%`,
              top: `${p.y}%`,
            }}
            animate={{
              y: [0, -100, 0],
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              ease: "linear",
              delay: p.delay,
            }}
          />
        ))}

        {/* 3D Credit Card */}
        <motion.div
          className="absolute top-10 -right-20 md:top-1/4 md:right-1/4 w-48 h-32 md:w-64 md:h-40 rounded-2xl bg-gradient-to-tr from-emerald-500/40 to-teal-500/40 border border-white/10 backdrop-blur-md shadow-[0_0_50px_rgba(16,185,129,0.3)] flex flex-col justify-between p-4 md:p-6"
          animate={{
            rotateX: [10, -10, 10],
            rotateY: [-20, 20, -20],
            y: [-15, 15, -15],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="flex justify-between items-center" style={{ transform: 'translateZ(20px)' }}>
            <div className="w-8 h-6 md:w-10 md:h-8 bg-yellow-400/50 rounded-md backdrop-blur-sm shadow-inner" />
            <div className="text-white/70 font-black italic tracking-widest text-sm md:text-lg drop-shadow-md">FAST</div>
          </div>
          <div className="space-y-2 md:space-y-3" style={{ transform: 'translateZ(30px)' }}>
            <div className="h-2 md:h-2.5 w-3/4 bg-white/30 rounded-full shadow-sm" />
            <div className="h-2 md:h-2.5 w-1/2 bg-white/20 rounded-full shadow-sm" />
          </div>
        </motion.div>

        {/* Floating Coins */}
        <motion.div
          className="absolute bottom-10 -left-10 md:bottom-1/4 md:left-1/4 w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-yellow-300 to-amber-600 shadow-[0_0_30px_rgba(245,158,11,0.4)] border-2 border-yellow-200/50 flex items-center justify-center"
          animate={{
            rotateY: [0, 360],
            y: [10, -10, 10],
          }}
          transition={{
            rotateY: { duration: 4, repeat: Infinity, ease: "linear" },
            y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
          }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="w-10 h-10 md:w-14 md:h-14 rounded-full border border-yellow-200/30 flex items-center justify-center" style={{ transform: 'translateZ(10px)' }}>
            <span className="text-yellow-100 font-black text-xl md:text-2xl drop-shadow-md">$</span>
          </div>
        </motion.div>
        
        <motion.div
          className="absolute top-1/3 left-2 md:left-1/3 w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-emerald-300 to-teal-600 shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-emerald-200/50 flex items-center justify-center blur-[1px]"
          animate={{
            rotateY: [360, 0],
            y: [-15, 15, -15],
            x: [-10, 10, -10],
          }}
          transition={{
            rotateY: { duration: 5, repeat: Infinity, ease: "linear" },
            y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
            x: { duration: 6, repeat: Infinity, ease: "easeInOut" },
          }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-emerald-200/30 flex items-center justify-center" style={{ transform: 'translateZ(5px)' }}>
            <span className="text-emerald-100 font-black text-xs md:text-sm drop-shadow-sm">$</span>
          </div>
        </motion.div>
      </div>

      {/* Login Form */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="text-center mb-10">
          <motion.h1 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-emerald-200 tracking-tight drop-shadow-lg"
          >
            Fast Credit
          </motion.h1>
          <motion.p 
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-emerald-200/70 mt-2 text-sm font-medium"
          >
            O futuro financeiro em suas mãos
          </motion.p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className={`border p-3 rounded-xl text-sm font-medium text-center backdrop-blur-md ${
                error.includes('sucesso') 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {error}
            </motion.div>
          )}

          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="relative group"
          >
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-emerald-300/50 group-focus-within:text-emerald-300 transition-colors" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail"
              className="w-full bg-white/5 border border-white/10 text-white placeholder-emerald-200/30 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-transparent focus:bg-white/10 transition-all backdrop-blur-md shadow-inner"
              required
            />
          </motion.div>

          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="relative group"
          >
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-emerald-300/50 group-focus-within:text-emerald-300 transition-colors" />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="w-full bg-white/5 border border-white/10 text-white placeholder-emerald-200/30 rounded-2xl py-4 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-transparent focus:bg-white/10 transition-all backdrop-blur-md shadow-inner"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-emerald-300/50 hover:text-emerald-300 transition-colors focus:outline-none"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </motion.div>

          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            type="submit"
            disabled={loading}
            className="w-full relative group overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Aguarde...</span>
              </>
            ) : (
              <>
                <span>{isSignUp ? 'Criar Conta' : 'Login'}</span>
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </motion.button>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center mt-6 flex flex-col gap-3"
          >
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="text-emerald-300/90 hover:text-emerald-100 text-sm font-medium transition-colors"
            >
              {isSignUp ? 'Já tem uma conta? Faça login' : 'Não tem uma conta? Criar uma conta'}
            </button>
            {!isSignUp && (
              <a href="#" className="text-emerald-300/50 hover:text-emerald-200 text-xs font-medium transition-colors">
                Esqueceu a senha?
              </a>
            )}
          </motion.div>
        </form>
      </motion.div>
    </div>
  );
}
