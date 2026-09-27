const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const entero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
  signDisplay: 'exceptZero',
});
const fecha = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' });
const milesEuros = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });

export const fmtEuros = (n: number) => euros.format(n);
export const fmtEurosM2 = (n: number) => `${entero.format(n)} €/m²`;
export const fmtEntero = (n: number) => entero.format(n);
export const fmtM2 = (n: number) => `${decimal.format(n)} m²`;
export const fmtPct = (n: number) => pct.format(n);
export const fmtFecha = (iso: string) => fecha.format(new Date(iso));
/** « 412 k€ » : pour les étiquettes courtes. */
export const fmtKEuros = (n: number) => `${milesEuros.format(n / 1000)} k€`;
