import { create } from 'zustand';

export type ToastKind = 'error' | 'success' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  code?: string;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    counter += 1;
    const id = counter;
    set({ toasts: [...get().toasts, { ...toast, id }] });
    window.setTimeout(() => get().dismiss(id), toast.kind === 'error' ? 8000 : 4500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = {
  error: (code: string | undefined, message: string): void =>
    useToastStore.getState().push({ kind: 'error', code, message }),
  success: (message: string): void => useToastStore.getState().push({ kind: 'success', message }),
  info: (message: string): void => useToastStore.getState().push({ kind: 'info', message }),
};
