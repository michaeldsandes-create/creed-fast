import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  isLoading = false
}: ConfirmationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
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
            <button
              onClick={onClose}
              className="absolute right-6 top-6 text-slate-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center space-y-4">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mb-2",
                variant === 'danger' ? "bg-rose-500/10 text-rose-500" :
                variant === 'warning' ? "bg-amber-500/10 text-amber-500" :
                "bg-blue-500/10 text-blue-500"
              )}>
                <AlertTriangle size={32} />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">{title}</h3>
                <p className="text-slate-400 leading-relaxed">
                  {message}
                </p>
              </div>

              <div className="flex gap-3 w-full pt-4">
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={cn(
                    "flex-1 text-white font-bold py-4 rounded-xl transition-all shadow-lg disabled:opacity-50",
                    variant === 'danger' ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20" :
                    variant === 'warning' ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/20" :
                    "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
                  )}
                >
                  {isLoading ? 'Processando...' : confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
