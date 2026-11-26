import { useEffect, useEffectEvent } from 'react';

let openDialogs = 0;
let previousOverflow = '';

export default function useDialog(ref, onClose, enabled = true) {
  const close = useEffectEvent(() => onClose?.());
  useEffect(() => {
    if (!enabled || !ref.current) return;
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    if (openDialogs++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    const focusable = () => [...dialog.querySelectorAll(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
    )].filter(element => element.getClientRects().length > 0);
    const focusTimer = setTimeout(() => {
      if (!dialog.contains(document.activeElement)) (focusable()[0] || dialog).focus();
    }, 0);
    const handleKey = event => {
      if (!dialog.contains(event.target)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0] || dialog;
        const last = elements.at(-1) || dialog;
        if (!elements.length || (event.shiftKey && document.activeElement === first)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    dialog.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(focusTimer);
      dialog.removeEventListener('keydown', handleKey);
      if (--openDialogs === 0) document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [ref, enabled]);
}
