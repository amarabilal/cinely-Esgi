import { test, expect, Page } from '@playwright/test';

const ts = Date.now();
const USER = {
  email: `notes_${ts}@test.com`,
  password: 'Test@1234!Secure',
  firstName: 'Notes',
  lastName: 'Tester',
};

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|login|connexion/i }).click();
  await expect(page).toHaveURL(/\/notes/, { timeout: 8000 });
}

async function register(page: Page, user: typeof USER) {
  await page.goto('/register');
  await page.getByLabel(/first name/i).fill(user.firstName);
  await page.getByLabel(/last name/i).fill(user.lastName);
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole('button', { name: /create|register|s'inscrire/i }).click();
  await expect(page).toHaveURL(/\/notes/, { timeout: 8000 });
}

test.describe('Gestion des notes', () => {
  test.beforeEach(async ({ page }) => {
    await register(page, USER).catch(() => loginAs(page, USER.email, USER.password));
  });

  test('Créer une note + saisir du contenu', async ({ page }) => {
    await page.getByRole('button', { name: /new note|\+ new/i }).click();
    const titleInput = page.locator('input[placeholder*="title" i]');
    await titleInput.fill('Ma Note E2E');
    // Cliquer dans l'éditeur Tiptap et saisir
    await page.locator('.prose-editor, [contenteditable="true"]').first().click();
    await page.keyboard.type('Contenu de test E2E Playwright');
    // Attendre l'autosave (1.5s debounce + sauvegarde)
    await page.waitForTimeout(3000);
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5000 });
  });

  test('Recherche plein texte', async ({ page }) => {
    // Créer une note avec un contenu unique
    await page.getByRole('button', { name: /new note|\+ new/i }).click();
    await page.locator('input[placeholder*="title" i]').fill('Note Recherchable');
    await page.locator('.prose-editor, [contenteditable="true"]').first().click();
    await page.keyboard.type('motcleunique12345');
    await page.waitForTimeout(3000);

    // Rechercher
    await page.getByPlaceholder(/search/i).fill('motcleunique');
    await page.waitForTimeout(500);
    await expect(page.getByText('Note Recherchable')).toBeVisible({ timeout: 5000 });
  });

  test('Historique des versions → restauration', async ({ page }) => {
    await page.getByRole('button', { name: /new note|\+ new/i }).click();
    const title = page.locator('input[placeholder*="title" i]');
    await title.fill('Note Versioning');
    await page.locator('.prose-editor, [contenteditable="true"]').first().click();
    await page.keyboard.type('Version initiale');
    await page.waitForTimeout(3000);

    // Ouvrir l'historique
    await page.getByRole('button', { name: /history|historique/i }).click();
    await expect(page.getByText(/version history|historique/i)).toBeVisible();
  });

  test('Dashboard → affiche les statistiques', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/total notes|notes/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/favorites|favoris/i)).toBeVisible();
  });

  test('Pages publiques accessibles sans connexion', async ({ page }) => {
    // Ne pas être connecté
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());

    await page.goto('/');
    await expect(page.getByText(/get started|commencer/i)).toBeVisible();

    await page.goto('/features');
    await expect(page.getByText(/features|fonctionnalités/i).first()).toBeVisible();

    await page.goto('/security');
    await expect(page.getByText(/security|sécurité/i).first()).toBeVisible();

    await page.goto('/legal/cgu');
    await expect(page.getByText(/conditions/i)).toBeVisible();
  });
});

test.describe('Partage de note (lecture seule)', () => {
  const OWNER = { email: `owner_${ts}@test.com`, password: 'Test@1234!Secure', firstName: 'Owner', lastName: 'One' };
  const GUEST = { email: `guest_${ts}@test.com`, password: 'Test@1234!Secure', firstName: 'Guest', lastName: 'Two' };

  test('Owner partage en READ → Guest voit la note en lecture seule', async ({ browser }) => {
    // Session Owner
    const ownerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    await register(ownerPage, OWNER);

    // Créer une note
    await ownerPage.getByRole('button', { name: /new note|\+ new/i }).click();
    await ownerPage.locator('input[placeholder*="title" i]').fill('Note Partagée');
    await ownerPage.waitForTimeout(2000);

    // Session Guest — inscription
    const guestCtx = await browser.newContext();
    const guestPage = await guestCtx.newPage();
    await register(guestPage, GUEST);

    // Owner : partage avec Guest en READ
    await ownerPage.getByRole('button', { name: /share|partager/i }).first().click();
    await ownerPage.locator('input[type="email"]').fill(GUEST.email);
    await ownerPage.selectOption('select', 'READ');
    await ownerPage.getByRole('button', { name: /^share$/i }).click();
    await ownerPage.waitForTimeout(1000);

    // Guest : voit la note dans "Shared with me"
    await guestPage.getByText(/shared with me|partagé/i).click();
    await expect(guestPage.getByText('Note Partagée')).toBeVisible({ timeout: 8000 });

    // Guest : éditeur désactivé (lecture seule)
    await guestPage.getByText('Note Partagée').click();
    await expect(guestPage.getByText(/read only|lecture seule/i)).toBeVisible({ timeout: 5000 });

    await ownerCtx.close();
    await guestCtx.close();
  });
});
