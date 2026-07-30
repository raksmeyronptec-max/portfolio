"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils/cn";
import { Icon, type IconName } from "./icon";
import { IconButton } from "./button";

/* ═══════════════════════════════════════════════════════════════════════════
   Toast notifications.

   Announcement strategy: the container is a single persistent live region.
   Errors go in an `assertive` region, everything else in a `polite` one, so a
   failure interrupts but a "Saved" message waits its turn. Creating a live
   region at the same time as inserting content into it is unreliable across
   screen readers, which is why the regions are always mounted.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ToastTone = "success" | "error" | "warning" | "info";

export type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** Milliseconds before auto-dismiss. Errors default to staying put. */
  duration?: number;
};

type ToastContextValue = {
  toasts: Toast[];
  show: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({
  children,
  dismissLabel,
}: {
  children: ReactNode;
  dismissLabel: string;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Errors persist: auto-dismissing a failure message can hide the only
      // explanation of what went wrong.
      const duration = toast.duration ?? (toast.tone === "error" ? 0 : 6000);

      setToasts((current) => [...current, { ...toast, id }]);

      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }

      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss]);

  const polite = toasts.filter((toast) => toast.tone !== "error");
  const assertive = toasts.filter((toast) => toast.tone === "error");

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
        data-print="hide"
      >
        <div
          role="status"
          aria-live="polite"
          aria-atomic="false"
          className="flex w-full max-w-sm flex-col gap-2"
        >
          {polite.map((toast) => (
            <ToastCard
              key={toast.id}
              toast={toast}
              onDismiss={dismiss}
              dismissLabel={dismissLabel}
            />
          ))}
        </div>

        <div
          role="alert"
          aria-live="assertive"
          aria-atomic="false"
          className="flex w-full max-w-sm flex-col gap-2"
        >
          {assertive.map((toast) => (
            <ToastCard
              key={toast.id}
              toast={toast}
              onDismiss={dismiss}
              dismissLabel={dismissLabel}
            />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside a ToastProvider.");
  }
  return context;
}

const toneConfig: Record<ToastTone, { icon: IconName; classes: string }> = {
  success: {
    icon: "checkCircle",
    classes: "border-success/30 bg-success-subtle text-success-foreground",
  },
  error: {
    icon: "alertCircle",
    classes: "border-danger/30 bg-danger-subtle text-danger-foreground",
  },
  warning: {
    icon: "alertTriangle",
    classes: "border-warning/30 bg-warning-subtle text-warning-foreground",
  },
  info: { icon: "info", classes: "border-info/30 bg-info-subtle text-info-foreground" },
};

function ToastCard({
  toast,
  onDismiss,
  dismissLabel,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
  dismissLabel: string;
}) {
  const { icon, classes } = toneConfig[toast.tone];

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-[--radius-md] border p-3.5",
        "shadow-[--shadow-md]",
        classes,
      )}
    >
      <Icon name={icon} size={18} className="mt-0.5" />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-small font-semibold">{toast.title}</p>
        {toast.description ? (
          <p className="text-[0.8125rem] opacity-90">{toast.description}</p>
        ) : null}
      </div>

      <IconButton
        icon="close"
        label={dismissLabel}
        size="sm"
        variant="ghost"
        onClick={() => onDismiss(toast.id)}
      />
    </div>
  );
}
