import { useEffect, useState } from 'react';

const EVT = 'zibeuro:toast';

export function toast(message: string) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: message }));
}

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: number | undefined;
    const on = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      window.clearTimeout(t);
      t = window.setTimeout(() => setMsg(null), 2600);
    };
    window.addEventListener(EVT, on);
    return () => {
      window.removeEventListener(EVT, on);
      window.clearTimeout(t);
    };
  }, []);
  return (
    <div className="toast-wrap" aria-live="polite">
      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
