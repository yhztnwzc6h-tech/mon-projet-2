import { useEffect, useRef, useState } from 'react';

/** Nombre qui glisse vers sa nouvelle valeur (désactivé si l'utilisateur réduit les animations). */
export function NumeroAnimado({ valor, formato }: { valor: number; formato: (n: number) => string }) {
  const [mostrado, setMostrado] = useState(valor);
  const desde = useRef(valor);

  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reducido) {
      desde.current = valor;
      return;
    }
    const inicio = desde.current;
    const t0 = performance.now();
    let raf = 0;
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / 700);
      const e = 1 - (1 - k) ** 3;
      const x = inicio + (valor - inicio) * e;
      setMostrado(x);
      desde.current = x;
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [valor, reducido]);

  return <span className="tabular-nums">{formato(reducido ? valor : mostrado)}</span>;
}
