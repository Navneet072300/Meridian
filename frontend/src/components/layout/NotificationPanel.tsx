import React, { useEffect, useRef } from 'react';
import { Bell, X, CheckCheck, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotificationStore, type Notification, type NotifType } from '../../store/notificationStore';

function timeAgo(d: Date) {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

const TYPE_ICON: Record<NotifType, React.ReactNode> = {
  info:    <Info size={15} className="text-blue-500" />,
  success: <CheckCircle2 size={15} className="text-emerald-500" />,
  warning: <AlertTriangle size={15} className="text-amber-500" />,
  error:   <XCircle size={15} className="text-rose-500" />,
};

const TYPE_BORDER: Record<NotifType, string> = {
  info:    'border-l-blue-500',
  success: 'border-l-emerald-500',
  warning: 'border-l-amber-500',
  error:   'border-l-rose-500',
};

function NotifRow({ n }: { n: Notification }) {
  const { markRead, deleteNotif } = useNotificationStore();
  return (
    <div
      onClick={() => !n.read && markRead(n.id)}
      className={`flex items-start gap-3 p-3 transition-colors cursor-pointer border-l-2 ${
        n.read ? 'border-l-transparent bg-transparent' : `${TYPE_BORDER[n.type]} bg-purple-500/5 dark:bg-purple-500/10`
      }`}
    >
      <div className="flex-shrink-0 mt-0.5">{TYPE_ICON[n.type]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs ${n.read ? 'font-medium text-zinc-700 dark:text-zinc-300' : 'font-semibold text-zinc-900 dark:text-zinc-100'} truncate`}>
            {n.title}
          </span>
          <span className="text-[10px] text-zinc-400 flex-shrink-0">{timeAgo(n.timestamp)}</span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
          {n.message}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          deleteNotif(n.id);
        }}
        title="Delete"
        className="text-zinc-400 hover:text-rose-500 p-1 transition-colors flex-shrink-0"
      >
        <X size={13} />
      </button>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: Props) {
  const { notifications, markAllRead } = useNotificationStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-full right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-white/10 dark:border-white/10 border-zinc-200 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl shadow-2xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3.5 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notifications</span>
              {hasUnread && (
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                  {notifications.filter((n) => !n.read).length} new
                </span>
              )}
            </div>
            {hasUnread && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
              >
                <CheckCheck size={13} /> Mark read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                No notifications right now
              </div>
            ) : (
              notifications.map((n) => <NotifRow key={n.id} n={n} />)
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-2.5 border-t border-zinc-200 dark:border-zinc-800 text-center bg-zinc-50/50 dark:bg-zinc-950/40">
              <button
                type="button"
                onClick={() =>
                  useNotificationStore
                    .getState()
                    .notifications.forEach((n) => useNotificationStore.getState().deleteNotif(n.id))
                }
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                Clear all notifications
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function NotificationBell({ onClick }: { onClick: () => void }) {
  const unread = useNotificationStore((s) => s.unreadCount());
  return (
    <button
      type="button"
      title="Notifications"
      onClick={onClick}
      className="relative p-2 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-purple-500/40 transition-all"
    >
      <Bell size={16} />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-md shadow-rose-500/30">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}
