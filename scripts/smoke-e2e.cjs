const { chromium, expect } = require('@playwright/test');

const baseUrl = process.env.RELEASE_E2E_BASE_URL || 'http://127.0.0.1:5173';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);
const filePayload = { name: 'lokl-smoke.png', mimeType: 'image/png', buffer: png };

async function completeOnboarding(page) {
  await expect(page.getByRole('heading', { name: 'Complete your profile' })).toBeVisible();
  await page.getByPlaceholder('Your full name').fill('Smoke Tester');
  await page.getByPlaceholder(/Tell your neighbours/).fill('Smoke testing the production gate.');
  // Step 2: locality/city are no longer pre-filled (see docs/audit/FINDINGS.md
  // LOKL-031) — Finish onboarding stays disabled until both are set.
  await page.getByPlaceholder('Koramangala').fill('Koramangala');
  await page.getByPlaceholder('Bengaluru').fill('Bengaluru');
  await page.getByRole('button', { name: /finish onboarding/i }).click();
  await page.getByText(/items nearby/i).waitFor({ state: 'visible', timeout: 10_000 });
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('Failed to load resource')) errors.push(text);
  });
  page.setDefaultTimeout(25_000);

  await page.goto(`${baseUrl}/privacy`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
  await expect(page.getByText(/Draft for human legal review/i)).toBeVisible();
  await page.goto(`${baseUrl}/terms`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Terms of Service' })).toBeVisible();

  await page.goto(`${baseUrl}/auth`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeDisabled();
  await page.getByPlaceholder('+91 98XXXXXXXX').fill('+919876543210');
  await expect(page.getByRole('button', { name: /send otp/i })).toBeDisabled();
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: /continue with google/i })).toBeEnabled();
  await page.getByRole('button', { name: /continue with google/i }).click();
  await completeOnboarding(page);

  await page.goto(`${baseUrl}/profile`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /edit profile/i }).click();
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles(filePayload);
  await page.locator('input').nth(1).fill('Smoke Tester Updated');
  await page.locator('textarea').fill('Updated by smoke verification.');
  await page.getByRole('button', { name: /save profile/i }).click();
  await expect(page.getByText('Smoke Tester Updated')).toBeVisible();

  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await page.locator('a[href^="/listing/"]').first().click();
  await page.waitForURL('**/listing/**');
  await page.getByRole('button', { name: 'Report listing' }).click();
  await page.getByPlaceholder('Reason').fill('Smoke admin report');
  await page.getByRole('button', { name: /submit report/i }).click();

  await page.goto(`${baseUrl}/admin`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Admin access' })).toBeVisible();
  await page.getByPlaceholder('Admin password').fill('123456');
  await page.getByRole('button', { name: /unlock admin/i }).click();
  await expect(page.getByRole('heading', { name: 'Moderation queue' })).toBeVisible();
  await expect(page.getByText('Smoke admin report')).toBeVisible();

  await page.goto(`${baseUrl}/profile`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /delete my account and data/i }).click();
  await page.getByRole('button', { name: /^Delete$/ }).click();
  await page.waitForURL('**/auth');
  await expect(page.getByRole('heading', { name: 'Lokl', exact: true })).toBeVisible();

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('smoke e2e pass: legal, consent gate, google auth, profile edit/avatar, admin queue, account deletion');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
