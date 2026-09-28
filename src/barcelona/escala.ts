/**
 * Échelles de couleur de la carte.
 *
 * - Magnitude (€/m², prix, ventes) : une seule teinte, du clair au foncé, 6 classes
 *   par quantiles, calculés au choix sur la période affichée (meilleure lecture
 *   des écarts du moment) ou sur toutes les périodes (couleur comparable dans le temps).
 *   La hauteur 3D, elle, utilise toujours l'échelle de toutes les périodes : pendant
 *   l'animation, la ville « monte » avec les prix.
 * - Variation : divergente bleu (baisse) ↔ rouge (hausse), gris au centre, seuils fixes.
 */
import { cortesCuantiles } from '../../shared/stats.ts';
import type { Indicador } from './modelo.ts';

// Rampe bleue à une teinte, 6 classes (écarts de luminosité et contraste validés).
const AZUL = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#123f7a', '#0a2650'];
// En mode sombre, la magnitude monte vers la lumière.
const AZUL_OSCURO = ['#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb'];

const DIV_CLARO = ['#1c5cab', '#5598e7', '#b7d3f6', '#e9e8e4', '#f6c3b5', '#e4735c', '#b8321e'];
const DIV_OSCURO = ['#3987e5', '#2a5f9e', '#29466b', '#45443f', '#7a3b2f', '#c4533c', '#f08a6f'];

export const SIN_DATOS = { claro: '#d4d2cc', oscuro: '#34332f' };

export const CORTES_VARIACION = [-0.1, -0.03, -0.01, 0.01, 0.03, 0.1];

export interface Escala {
  cortes: number[];
  colores: string[];
  min: number;
  max: number;
  divergente: boolean;
}

export function crearEscala(ind: Indicador, valoresColor: number[], valoresAltura: number[], oscuro: boolean): Escala {
  if (ind === 'variacion') {
    return {
      cortes: CORTES_VARIACION,
      colores: oscuro ? DIV_OSCURO : DIV_CLARO,
      min: -0.25,
      max: 0.25,
      divergente: true,
    };
  }
  const cortes = cortesCuantiles(valoresColor, 6);
  const colores = oscuro ? AZUL_OSCURO : AZUL;
  let min = Infinity;
  let max = -Infinity;
  for (const x of valoresAltura) {
    if (x < min) min = x;
    if (x > max) max = x;
  }
  return {
    cortes,
    colores: colores.slice(colores.length - (cortes.length + 1)),
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 1,
    divergente: false,
  };
}

/** Hauteur de 0 à 1 (échelle linéaire bornée) ; la variation utilise sa valeur absolue. */
export function alturaNormalizada(e: Escala, x: number): number {
  if (e.divergente) return Math.min(1, Math.abs(x) / e.max);
  if (e.max === e.min) return 0.5;
  return Math.max(0, Math.min(1, (x - e.min) / (e.max - e.min)));
}

export function colorDe(e: Escala, x: number): string {
  let i = 0;
  while (i < e.cortes.length && x >= e.cortes[i]!) i++;
  return e.colores[i]!;
}
