'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquarePlus, X } from 'lucide-react';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import {
  getSupabaseBrowser,
  hasSupabaseConfigClient,
} from '@/lib/supabase/browser';
import { useAppStore } from '@/store/app';
import { cn } from '@/lib/utils';

/**
 * Feedback modal form. Submissions go straight into public.feedback via the
 * anon browser client — the table's RLS allows anon INSERT but no public
 * SELECT, so this is a write-only channel; the project owner reads rows in the
 * Supabase dashboard.
 *
 * The trigger lives in two places: a floating bottom-right button on desktop
 * (hidden on mobile so it doesn't cover the bottom tab bar) and a button in the
 * top nav on mobile. Both flip `feedbackOpen` in the store, which this widget
 * reads to show the modal.
 *
 * Renders nothing when Supabase isn't configured (no env vars) so a misconfig
 * never surfaces a dead button.
 */

const CATEGORIES = [
  { value: '', label: 'General' },
  { value: 'bug', label: 'Bug' },
  { value: 'idea', label: 'Idea' },
  { value: 'other', label: 'Other' },
] as const;

export function FeedbackWidget() {
  // Hooks must run unconditionally; we gate on config only for what we render.
  const [configured] = useState(() => hasSupabaseConfigClient());
  const open = useAppStore((s) => s.feedbackOpen);
  const setOpen = useAppStore((s) => s.setFeedbackOpen);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);

  const pathname = usePathname();
  const { address } = useAccount();

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const titleId = useId();
  const messageId = useId();
  const categoryId = useId();
  const emailId = useId();

  const close = useCallback(() => {
    setOpen(false);
    // Return focus to the trigger so keyboard users aren't dropped at <body>.
    triggerRef.current?.focus();
  }, [setOpen]);

  const reset = useCallback(() => {
    setMessage('');
    setCategory('');
    setEmail('');
  }, []);

  // Escape closes; focus the textarea on open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    // Defer focus so the element is mounted/painted.
    const id = window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(id);
    };
  }, [open, close]);

  // Focus trap — keep Tab / Shift+Tab cycling inside the dialog while open.
  useEffect(() => {
    if (!open) return;
    function onTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onTab);
    return () => window.removeEventListener('keydown', onTab);
  }, [open]);

  const trimmed = message.trim();
  const canSubmit = trimmed.length > 0 && !pending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setPending(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.from('feedback').insert({
        message: trimmed.slice(0, 2000),
        category: category || null,
        email: email.trim() || null,
        wallet_address: address ?? null,
        page_path: pathname || null,
        user_agent:
          typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });
      if (error) throw error;

      toast.success('Thanks for the feedback!');
      reset();
      close();
    } catch (err) {
      console.error('[feedback] submit failed', err);
      toast.error('Could not send feedback. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (!configured) return null;

  return (
    <>
      {/* Floating trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          // Desktop only — on mobile the trigger lives in the top nav so it
          // doesn't float over the bottom tab bar (Markets/Portfolio/…).
          'press-scale fixed bottom-4 right-4 z-40 hidden items-center gap-2 sm:inline-flex',
          'rounded-full border border-line bg-bg-elev px-4 py-2.5 shadow-lg',
          'text-sm font-medium text-text hover:bg-surface-hover transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
        )}
      >
        <MessageSquarePlus className="h-4 w-4 text-brand" aria-hidden="true" />
        Feedback
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 animate-fade-in"
          onClick={close}
        >
          <div
            ref={dialogRef}
            className="w-full max-w-md rounded-xl border border-line bg-bg-elev p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2
                id={titleId}
                className="text-md font-semibold text-text"
              >
                Send feedback
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="press-scale rounded-md p-1 text-text-muted hover:bg-surface-hover hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-1 text-xs text-text-dim">
              Found a bug or have an idea? Let us know — we read everything.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label
                  htmlFor={messageId}
                  className="block text-xs font-medium text-text-muted"
                >
                  Message
                </label>
                <textarea
                  ref={textareaRef}
                  id={messageId}
                  required
                  rows={4}
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What's on your mind?"
                  className={cn(
                    'w-full resize-none rounded-md border border-line bg-bg-subtle px-3 py-2',
                    'text-sm text-text placeholder:text-text-dim',
                    'focus:outline-none focus:ring-2 focus:ring-brand/60'
                  )}
                />
                <div className="text-right text-[11px] tabular-nums text-text-dim">
                  {trimmed.length}/2000
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor={categoryId}
                  className="block text-xs font-medium text-text-muted"
                >
                  Category{' '}
                  <span className="font-normal text-text-dim">(optional)</span>
                </label>
                <select
                  id={categoryId}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={cn(
                    'w-full rounded-md border border-line bg-bg-subtle px-3 py-2',
                    'text-sm text-text',
                    'focus:outline-none focus:ring-2 focus:ring-brand/60'
                  )}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor={emailId}
                  className="block text-xs font-medium text-text-muted"
                >
                  Email{' '}
                  <span className="font-normal text-text-dim">
                    (optional, if you want a reply)
                  </span>
                </label>
                <input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={cn(
                    'w-full rounded-md border border-line bg-bg-subtle px-3 py-2',
                    'text-sm text-text placeholder:text-text-dim',
                    'focus:outline-none focus:ring-2 focus:ring-brand/60'
                  )}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={close}
                  className="press-scale flex-1 rounded-md border border-line bg-surface py-2.5 text-sm font-medium text-text hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={cn(
                    'press-scale flex-[1.5] rounded-md py-2.5 text-sm font-semibold text-white transition-colors',
                    'bg-brand hover:bg-brand/90 glow-brand',
                    'disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                >
                  {pending ? 'Sending…' : 'Send feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
