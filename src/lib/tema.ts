import { useEffect, useState } from 'react';

/**
 * Thème sombre actif ? Suit `data-theme` sur la racine s'il est défini
 * (choix explicite de l'hôte), sinon la préférence du système.
 */
function calcular(): boolean {
  const forzado = document.documentElement.getAttribute('data-theme');
  if (forzado === 'dark') return true;
  if (forzado === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useTemaOscuro(): boolean {
  const [oscuro, setOscuro] = useState(calcular);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const actualizar = () => setOscuro(calcular());
    mq.addEventListener('change', actualizar);
    const obs = new MutationObserver(actualizar);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', actualizar);
      obs.disconnect();
    };
  }, []);
  return oscuro;
}
