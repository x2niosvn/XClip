import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        let icon = <Info className="w-4 h-4 text-indigo-400" />;
        let borderClass = 'border-indigo-500/30';

        if (toast.type === 'success') {
          icon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
          borderClass = 'border-emerald-500/30';
        } else if (toast.type === 'error') {
          icon = <AlertCircle className="w-4 h-4 text-red-400" />;
          borderClass = 'border-red-500/30';
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle className="w-4 h-4 text-amber-400" />;
          borderClass = 'border-amber-500/30';
        }

        return (
          <div
            key={toast.id}
            onClick={() => onDismiss(toast.id)}
            className={`pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-zinc-900/95 border ${borderClass} shadow-xl backdrop-blur-md text-xs text-zinc-200 animate-slide-up cursor-pointer`}
          >
            {icon}
            <span className="flex-1 font-medium">{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
};
