import React from 'react';
import { Button } from './ui/Button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/30 dark:bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="glass-panel bg-white/90 dark:bg-gray-900/90 rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all animate-in zoom-in-95 duration-200 border border-white/40 dark:border-white/10"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-red-100/50 dark:bg-red-900/20 flex items-center justify-center mb-4 text-red-500 dark:text-red-400 ring-4 ring-red-50 dark:ring-red-900/10">
            <AlertTriangle size={28} />
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {title}
          </h3>
          
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
            {message}
          </p>
          
          <div className="flex gap-3 w-full">
            <Button variant="secondary" onClick={onClose} fullWidth>
              {cancelLabel}
            </Button>
            <Button variant="destructive" onClick={onConfirm} fullWidth>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};