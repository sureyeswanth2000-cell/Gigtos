// Playwright E2E test for Gigtos ride workflow
import { test, expect } from '@playwright/test';

const REGION_EMAIL = 'region@gmail.com';
const REGION_PASS = '101010';
const USER_PHONE = '1234567892';
const USER_PASS = '101010';
const WORKER_EMAIL = 'diverworker@gmail.com';
const WORKER_PASS = '101010';

// Helper: login as email/password
async function login(page, email, password) {
  await page.goto('/Gigtos/auth');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Sign In")');
  await page.waitForTimeout(2000);
}

test('Full ride workflow: region lead, driver, user', async ({ page }) => {
  // 1. Region lead logs in and approves driver
  await login(page, REGION_EMAIL, REGION_PASS);
  await page.goto('/Gigtos/admin/bookings');
  // Simulate approval (customize selector as needed)
  // await page.click('button:has-text("Approve")');
  await page.waitForTimeout(1000);
  await page.context().clearCookies();

  // 2. Worker logs in and registers as driver
  await login(page, WORKER_EMAIL, WORKER_PASS);
  await page.goto('/Gigtos/worker/dashboard');
  // Simulate driver registration and license upload if needed
  // await page.click('button:has-text("Register as Driver")');
  // await page.setInputFiles('input[type="file"]', 'path/to/license.jpg');
  await page.waitForTimeout(1000);
  await page.context().clearCookies();

  // 3. User logs in and books a ride
  await login(page, USER_PHONE, USER_PASS);
  await page.goto('/Gigtos/ride-booking');
  await page.fill('input[placeholder="Enter pickup location"]', 'Test Pickup');
  await page.fill('input[placeholder="Enter drop location"]', 'Test Drop');
  // Simulate map selection if possible
  // await page.click('.user-location-map');
  await page.click('button:has-text("Book Ride")');
  await expect(page.locator('text=Ride request created')).toBeVisible();
});
// Playwright E2E test for Gigtos ride workflow
import { test, expect } from '@playwright/test';

const REGION_EMAIL = 'region@gmail.com';
const REGION_PASS = '101010';
const USER_PHONE = '1234567892';
const USER_PASS = '101010';
const WORKER_EMAIL = 'diverworker@gmail.com';
const WORKER_PASS = '101010';

// Helper: login as email/password
async function login(page, email, password) {
  await page.goto('/Gigtos/auth');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Sign In")');
  await page.waitForTimeout(2000);
}

test('Full ride workflow: region lead, driver, user', async ({ page }) => {
  // 1. Region lead logs in and approves driver
  await login(page, REGION_EMAIL, REGION_PASS);
  await page.goto('/Gigtos/admin/bookings');
  // Simulate approval (customize selector as needed)
  // await page.click('button:has-text("Approve")');
  await page.waitForTimeout(1000);
  await page.context().clearCookies();

  // 2. Worker logs in and registers as driver
  await login(page, WORKER_EMAIL, WORKER_PASS);
  await page.goto('/Gigtos/worker/dashboard');
  // Simulate driver registration and license upload if needed
  // await page.click('button:has-text("Register as Driver")');
  // await page.setInputFiles('input[type="file"]', 'path/to/license.jpg');
  await page.waitForTimeout(1000);
  await page.context().clearCookies();

  // 3. User logs in and books a ride
  await login(page, USER_PHONE, USER_PASS);
  await page.goto('/Gigtos/ride-booking');
  await page.fill('input[placeholder="Enter pickup location"]', 'Test Pickup');
  await page.fill('input[placeholder="Enter drop location"]', 'Test Drop');
  // Simulate map selection if possible
  // await page.click('.user-location-map');
  await page.click('button:has-text("Book Ride")');
  await expect(page.locator('text=Ride request created')).toBeVisible();
});
