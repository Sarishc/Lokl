const { chromium, expect } = require('@playwright/test');

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);
const filePayload = { name: 'lokl-test.png', mimeType: 'image/png', buffer: png };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const baseUrl = process.env.RELEASE_E2E_BASE_URL || 'http://127.0.0.1:5173';
const appMode = process.env.VITE_APP_MODE || 'mock';
const isLiveSupabase = appMode === 'supabase';
const authMethod = process.env.RELEASE_E2E_AUTH || 'phone';
const testPhone = process.env.RELEASE_E2E_PHONE || (isLiveSupabase ? '' : '+919876543210');

function readOtpFromStdin() {
  if (process.env.RELEASE_E2E_OTP) return Promise.resolve(process.env.RELEASE_E2E_OTP);
  if (!isLiveSupabase) return Promise.resolve('123456');
  if (!process.stdin.isTTY) {
    throw new Error('Live Supabase release test needs RELEASE_E2E_OTP or an interactive terminal after requesting the SMS OTP.');
  }
  process.stdout.write(`Enter OTP sent to ${testPhone}: `);
  process.stdin.setEncoding('utf8');
  process.stdin.resume();
  return new Promise((resolve) => {
    process.stdin.once('data', (value) => {
      process.stdin.pause();
      resolve(value.trim());
    });
  });
}

async function completeOnboardingIfVisible(page) {
  const onboardingVisible = await page.getByRole('heading', { name: 'Complete your profile' }).isVisible().catch(() => false);
  if (!onboardingVisible) return false;
  await page.getByPlaceholder('Your full name').fill('Release Tester');
  await page.getByPlaceholder(/Tell your neighbours/).fill('Testing Lokl release flows.');
  // Step 5: locality/city are chosen via LocalityPicker (a real <select> pair,
  // not free text — see docs/audit/FINDINGS.md LOKL-042), which auto-applies its
  // first option the moment it renders with nothing set, so no interaction is
  // needed here for "Finish onboarding" to become enabled.
  await page.getByRole('button', { name: /finish onboarding/i }).click();
  await page.waitForLoadState('networkidle');
  await page.getByText(/items nearby/i).waitFor({ state: 'visible', timeout: 10_000 });
  return true;
}

async function authenticate(page) {
  async function acceptLegalIfPresent() {
    const checkbox = page.getByRole('checkbox').first();
    if (await checkbox.isVisible({ timeout: 1_000 }).catch(() => false)) await checkbox.check();
  }

  if (authMethod === 'google') {
    if (isLiveSupabase) {
      throw new Error('Live Google release testing requires an interactive browser/account. Use mock mode for automated Google coverage, then manually verify live OAuth.');
    }
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    if (await completeOnboardingIfVisible(page)) return;
    if (!page.url().includes('/auth')) return;
    await acceptLegalIfPresent();
    await page.getByRole('button', { name: /continue with google/i }).click();
    await page.waitForLoadState('networkidle');
    await Promise.race([
      page.getByRole('heading', { name: 'Complete your profile' }).waitFor({ state: 'visible', timeout: 10_000 }).catch(() => null),
      page.getByText(/items nearby/i).waitFor({ state: 'visible', timeout: 10_000 }).catch(() => null),
    ]);
    await completeOnboardingIfVisible(page);
    return;
  }
  if (!testPhone) {
    throw new Error('Live Supabase release test requires RELEASE_E2E_PHONE; refusing to send OTP to the mock hardcoded number.');
  }
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  if (await completeOnboardingIfVisible(page)) return;
  if (!page.url().includes('/auth')) return;
  await expect(page.getByRole('heading', { name: 'Lokl', exact: true })).toBeVisible();
  await page.getByPlaceholder('+91 98XXXXXXXX').fill(testPhone);
  await acceptLegalIfPresent();
  await page.getByRole('button', { name: /send otp/i }).click();
  const otpState = await Promise.race([
    page.getByPlaceholder('123456').waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'ready'),
    page.getByText(/Couldn.t send OTP/i).waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'send-error'),
  ]);
  if (otpState === 'send-error') {
    throw new Error('Supabase rejected OTP send because Auth > Providers > Phone has no SMS provider configured.');
  }
  const otp = await readOtpFromStdin();
  await page.getByPlaceholder('123456').fill(otp);
  await page.getByRole('button', { name: /verify/i }).click();
  await page.waitForLoadState('networkidle');
  const nextAuthState = await Promise.race([
    page.getByRole('heading', { name: 'Complete your profile' }).waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'onboarding').catch(() => null),
    page.getByText(/items nearby/i).waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'home').catch(() => null),
  ]);
  if (page.url().includes('/onboarding') || nextAuthState === 'onboarding') {
    await completeOnboardingIfVisible(page);
  }
}

async function ensureFirstListingSaved(page) {
  const firstListing = page.locator('a[href^="/listing/"]').first();
  await expect(firstListing).toBeVisible();
  if (await firstListing.getByLabel('Remove from wishlist').isVisible({ timeout: 1_000 }).catch(() => false)) return;
  await firstListing.getByLabel('Save listing').click();
  await expect(page.getByText(/Saved to wishlist/i)).toBeVisible({ timeout: 10_000 });
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

  await authenticate(page);
  await expect(page.getByRole('heading', { name: 'Lokl', exact: true })).toBeVisible();
  await expect(page.getByText(/items nearby/i)).toBeVisible();

  await ensureFirstListingSaved(page);
  await page.goto(`${baseUrl}/saved`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Wishlist' })).toBeVisible();
  await expect(page.locator('a[href^="/listing/"]').first()).toBeVisible();

  await page.goto(`${baseUrl}/explore`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder(/search phones/i).fill(isLiveSupabase ? 'Mobiles' : 'table');
  await delay(500);
  await expect(page.locator('a[href^="/listing/"]').first()).toBeVisible();
  await page.getByRole('button').filter({ hasText: /map view/i }).click();
  await expect(page.getByText(/Map view is ready/i)).toBeVisible();

  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await page.locator('a[href^="/listing/"]').first().click();
  await page.waitForURL('**/listing/**');
  await expect(page.getByRole('button', { name: 'Share listing' })).toBeVisible();
  await page.getByRole('button', { name: 'Report listing' }).click();
  await page.getByPlaceholder('Reason').fill('Release test report');
  await page.getByRole('button', { name: /submit report/i }).click();
  await page.getByRole('button', { name: /chat with seller/i }).click();
  await page.waitForURL('**/chats/**');
  await expect(page.getByPlaceholder('Type a message')).toBeVisible();

  await page.getByPlaceholder('Type a message').fill('Is this still available for pickup today?');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('p').filter({ hasText: 'Is this still available for pickup today?' }).first()).toBeVisible();
  await page.getByRole('button', { name: /make an offer/i }).click();
  await page.getByPlaceholder('Offer amount in Rs').fill('1234');
  await page.getByRole('button', { name: /send offer/i }).click();
  await expect(page.getByText('₹1,234').first()).toBeVisible();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /share image/i }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(filePayload);
  await expect(page.locator('img[alt="shared"]').last()).toBeVisible({ timeout: 20_000 });

  await page.goto(`${baseUrl}/sell`, { waitUntil: 'networkidle' });
  await page.locator('input[type="file"][multiple]').setInputFiles(filePayload);
  await expect(page.locator('img[alt="draft"]').first()).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByPlaceholder(/iPhone 13 mini/i).fill('Release Test Lamp');
  await page.getByPlaceholder(/What makes it worth buying/i).fill('Automated release test listing with image upload.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('input[type="number"]').first().fill('999');
  await page.getByRole('button', { name: 'Continue' }).click();
  // Step 5 (LOKL-042): the posting flow's location step is a LocalityPicker, not
  // free text or raw lat/lng fields — actually exercise changing it, not just the
  // auto-applied default, then confirm the choice survives through to the posted
  // listing (not just that the button became clickable).
  await page.getByLabel('City').selectOption('Mumbai');
  await expect(page.getByLabel('Locality')).toHaveValue('Bandra West');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /post listing/i }).click();
  await page.waitForURL('**/listing/**');
  await expect(page.getByRole('heading', { name: 'Release Test Lamp' })).toBeVisible();
  await expect(page.getByText('Approximate area · Bandra West')).toBeVisible();

  await page.getByRole('button', { name: /edit listing/i }).click();
  await expect(page.getByRole('heading', { name: /edit listing/i })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByPlaceholder(/iPhone 13 mini/i).fill('Release Test Lamp Updated');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Release Test Lamp Updated')).toBeVisible();
  await page.getByRole('button', { name: /save listing/i }).click();
  await page.waitForURL('**/listing/**');
  await expect(page.getByRole('heading', { name: 'Release Test Lamp Updated' })).toBeVisible();
  await page.getByRole('button', { name: /delete/i }).click();
  await page.getByRole('button', { name: /^Delete$/ }).last().click();
  await page.waitForURL('**/profile');

  await page.goto(`${baseUrl}/notifications`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  await page.goto(`${baseUrl}/profile`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.waitForURL('**/auth');
  await authenticate(page);
  await expect(page.getByRole('heading', { name: 'Lokl', exact: true })).toBeVisible();

  await browser.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('release e2e pass: auth, onboarding, save, search/map, report, chat, text/offer/image, sell upload, post, edit, delete, notifications, logout, sign-in');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
