import { expect, test } from '@playwright/test';

test('abrir el mapa, buscar un barrio y abrir su ficha', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Datos agregados por zona — no son precios de venta individuales')).toBeVisible();
  await expect(page.getByTestId('mapa')).toBeVisible();
  // Vue d'ensemble : chiffres de la ville et classement.
  await expect(page.getByText('Barcelona · ciudad')).toBeVisible();

  const buscador = page.getByRole('combobox', { name: /Buscar un barrio/ });
  await buscador.fill('Vila de Gràcia');
  await page.getByRole('option', { name: /la Vila de Gràcia/ }).click();

  const ficha = page.getByRole('article', { name: /Ficha de la Vila de Gràcia/ });
  await expect(ficha.getByRole('heading', { name: 'la Vila de Gràcia' })).toBeVisible();
  await expect(ficha.getByText(/€\/m²/).first()).toBeVisible();
  await expect(page).toHaveURL(/#b31$/);

  // Frise temporelle : revenir au premier trimestre publié.
  await page.getByRole('slider', { name: 'Periodo' }).fill('0');
  await expect(ficha.getByText(/2013/).first()).toBeVisible();
});

test('lien direct vers un barrio', async ({ page }) => {
  await page.goto('/#b21');
  await expect(page.getByRole('heading', { name: 'Pedralbes' })).toBeVisible();
});
