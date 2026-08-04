// src/utils/toast.ts — Lightweight toast notification system
let toastContainer: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (toastContainer) return toastContainer;
  toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  toastContainer.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 9999;
    display: flex; flex-direction: column; gap: 8px; pointer-events: none;
  `;
  document.body.appendChild(toastContainer);
  return toastContainer;
}

function show(message: string, type: 'success' | 'error' | 'info' | 'warning') {
  const container = getContainer();
  const el = document.createElement('div');

  const colors = {
    success: { bg: '#f0fdf4', border: '#86efac', text: '#15803d', icon: '✅' },
    error:   { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', icon: '❌' },
    warning: { bg: '#fffbeb', border: '#fcd34d', text: '#d97706', icon: '⚠️' },
    info:    { bg: '#eff6ff', border: '#93c5fd', text: '#2563eb', icon: 'ℹ️' },
  };
  const c = colors[type];

  el.style.cssText = `
    padding: 12px 16px; border-radius: 10px; max-width: 360px;
    background: ${c.bg}; border: 1px solid ${c.border}; color: ${c.text};
    font-size: 14px; font-weight: 500; pointer-events: all;
    box-shadow: 0 4px 16px rgba(0,0,0,.1);
    display: flex; align-items: center; gap: 8px;
    animation: slideIn 200ms ease;
  `;
  el.innerHTML = `<span>${c.icon}</span><span>${message}</span>`;

  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
    document.head.appendChild(style);
  }

  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 300ms';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

export const toast = {
  success: (msg: string) => show(msg, 'success'),
  error:   (msg: string) => show(msg, 'error'),
  warning: (msg: string) => show(msg, 'warning'),
  info:    (msg: string) => show(msg, 'info'),
};
