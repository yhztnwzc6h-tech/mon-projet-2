interface Props<T extends string> {
  etiqueta: string;
  valor: T;
  opciones: readonly { valor: T; texto: string }[];
  onChange: (v: T) => void;
}

/** Groupe de boutons exclusifs (accessible comme un groupe radio). */
export function Segmentado<T extends string>({ etiqueta, valor, opciones, onChange }: Props<T>) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">{etiqueta}</legend>
      <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
        {opciones.map((o) => (
          <label
            key={o.valor}
            className={`cursor-pointer rounded px-3 py-1 text-sm focus-within:ring-2 focus-within:ring-sky-500 ${
              o.valor === valor
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              name={etiqueta}
              value={o.valor}
              checked={o.valor === valor}
              onChange={() => onChange(o.valor)}
            />
            {o.texto}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
