import React from 'react';
import { useAuthStore } from '../store/auth.store';

// A printed care record has to say what it is, who it is about, which home it
// came from, when it was printed and by whom. Without that a page handed to an
// inspector or a family is an anonymous sheet of paper.
//
// Invisible on screen; only the print stylesheet reveals it.
export function PrintHeader({ title, subject, note }: {
  title: string;
  /** The resident, member of staff or period the page is about. */
  subject?: string | null;
  note?: string | null;
}) {
  const { user } = useAuthStore();
  const now = new Date();
  return (
    <div className="print-header">
      <p className="ph-title">{title}{subject ? ` — ${subject}` : ''}</p>
      <p className="ph-meta">
        {(user as any)?.careHomeName || 'CareVista'}
        {' · Printed '}
        {now.toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        {user ? ` by ${(user as any).firstName} ${(user as any).lastName}` : ''}
        {note ? ` · ${note}` : ''}
      </p>
    </div>
  );
}

/**
 * Print button. Hidden on paper (it is a .btn), visible on screen.
 * Kept deliberately dumb: the browser's own print dialog is what carers and
 * managers already know, and it gives them "save as PDF" for free.
 */
export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button type="button" className="btn btn-secondary btn-sm no-print"
      onClick={() => window.print()}>
      🖨 {label}
    </button>
  );
}

export default PrintHeader;
