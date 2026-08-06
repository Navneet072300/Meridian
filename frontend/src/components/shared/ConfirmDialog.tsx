import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { PremiumButton, PremiumDialog } from './UIPrimitives';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  confirmLabel?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText,
  confirmLabel,
  cancelText = 'Cancel',
  variant = 'danger',
  danger,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const actualConfirmText = confirmLabel || confirmText || 'Confirm';
  const isDanger = danger || variant === 'danger';

  return (
    <PremiumDialog isOpen={isOpen} onClose={onCancel} title={title}>
      <div className="space-y-4 font-sans">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} />
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed pt-1">
            {message}
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <PremiumButton variant="outline" onClick={onCancel} disabled={loading}>
            {cancelText}
          </PremiumButton>
          <PremiumButton
            variant={isDanger ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={loading}
          >
            {actualConfirmText}
          </PremiumButton>
        </div>
      </div>
    </PremiumDialog>
  );
}
