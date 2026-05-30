import { test, expect } from '@playwright/test';

const ts = Date.now();
const USER = {
  email: `e2e_${ts}@test.com`,
  password: 'Test@1234!Secure',
  firstName: 'E2E',
  lastName: 'Playwright',
};

test.describe('Authentification', () => {
  test('Inscription → connexion → déconnexion', async ({ page }) => {
    // ── Inscription ─────────────────────────────────────────────
    await page.goto('/register');
    await page.getByLabel(/first name/i).fill(USER.firstName);
    await page.getByLabel(/last name/i).fill(USER.lastName);
    await page.getByLabel(/email/i).fill(USER.email);
    await page.getByLabel(/password/i).fill(USER.password);
    await page.getByRole('button', { name: /create account|register|s'inscrire/i }).click();

    // Doit arriver sur /notes après inscription
    await expect(page).toHaveURL(/\/notes/);

    // ── Déconnexion ──────────────────────────────────────────────
    await page.getByText(/sign out|déconnexion/i).click();
    await expect(page).toHaveURL(/\/login|\/$/);

    // ── Reconnexion ──────────────────────────────────────────────
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(USER.email);
    await page.getByLabel(/password/i).fill(USER.password);
    await page.getByRole('button', { name: /sign in|login|connexion/i }).click();
    await expect(page).toHaveURL(/\/notes/);
  });

  test('Connexion avec mauvais mot de passe → message d'erreur', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('nobody@example.com');
    await page.getByLabel(/password/i).fill('wrongpass');
    await page.getByRole('button', { name: /sign in|login|connexion/i }).click();
    await expect(page.getByText(/invalid|incorrect|erreur/i)).toBeVisible({ timeout: 5000 });
  });

  test('Mot de passe oublié → formulaire envoi', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByRole('button', { name: /send|envoyer/i }).click();
    // Message de confirmation (silencieux côté serveur)
    await expect(page.getByText(/sent|envoy|link/i)).toBeVisible({ timeout: 5000 });
  });
});
