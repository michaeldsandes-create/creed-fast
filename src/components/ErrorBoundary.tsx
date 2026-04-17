import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'Ocorreu um erro inesperado.';
      let isPermissionError = false;

      try {
        const parsedError = JSON.parse(this.state.error?.message || '');
        if (parsedError.error?.includes('permission-denied')) {
          isPermissionError = true;
          errorMessage = 'Você não tem permissão para acessar estes dados. Verifique se você está logado com a conta correta.';
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Ops! Algo deu errado</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                {errorMessage}
              </p>
            </div>
            
            {isPermissionError && (
              <div className="bg-slate-800/50 p-4 rounded-xl text-left">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Dica</p>
                <p className="text-xs text-slate-400">
                  Tente sair e entrar novamente com o e-mail <strong>michaeldsandes@gmail.com</strong>.
                </p>
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} />
              Recarregar Sistema
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
