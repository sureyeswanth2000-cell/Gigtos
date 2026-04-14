# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\rideWorkflow.spec.js >> Full ride workflow: region lead, driver, user
- Location: tests\e2e\rideWorkflow.spec.js:21:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('input[type="email"]')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - banner [ref=e3]:
    - link "🏠 Gigtos" [ref=e4] [cursor=pointer]:
      - /url: /Gigtos
      - generic [ref=e5]: 🏠
      - generic [ref=e6]: Gigtos
    - generic [ref=e7]:
      - button "Toggle brightness" [ref=e8] [cursor=pointer]:
        - generic [ref=e11]: 🔆
      - button "🔐 Login" [ref=e12] [cursor=pointer]
  - generic "Click to re-detect" [ref=e15] [cursor=pointer]:
    - img [ref=e16]
    - generic [ref=e18]: Vijayawada
    - generic [ref=e19]: ▼
  - main [ref=e20]:
    - generic [ref=e24]:
      - generic [ref=e25]: Premium Platform
      - heading "Gigtos" [level=1] [ref=e26]
      - paragraph [ref=e27]: The future of gig work is here.
      - generic [ref=e28]:
        - generic [ref=e29]:
          - generic [ref=e30]: Email or Phone
          - textbox "name@email.com or phone" [ref=e31]
        - generic [ref=e32]:
          - generic [ref=e33]: Password
          - generic [ref=e34]:
            - textbox "••••••••" [ref=e35]
            - button "SHOW" [ref=e36] [cursor=pointer]
        - button "Sign In" [ref=e37] [cursor=pointer]
        - generic [ref=e38]: New to Gigtos? Create account
  - contentinfo [ref=e39]:
    - generic [ref=e40]:
      - generic [ref=e41]:
        - generic [ref=e42]:
          - generic [ref=e43]:
            - generic [ref=e44]: 🏠
            - generic [ref=e45]: Gigtos
          - paragraph [ref=e46]: Connecting skilled workers with opportunities. The future of the gig economy, built for speed and trust.
          - generic [ref=e47]:
            - link "𝕏" [ref=e48] [cursor=pointer]:
              - /url: https://x.com
            - link "📸" [ref=e49] [cursor=pointer]:
              - /url: https://instagram.com
            - link "💼" [ref=e50] [cursor=pointer]:
              - /url: https://linkedin.com
        - generic [ref=e51]:
          - heading "Platform" [level=4] [ref=e52]
          - link "Browse Jobs" [ref=e53] [cursor=pointer]:
            - /url: /Gigtos/jobs
          - link "Sign In" [ref=e54] [cursor=pointer]:
            - /url: /Gigtos/auth
          - link "Services" [ref=e55] [cursor=pointer]:
            - /url: /Gigtos/service
        - generic [ref=e56]:
          - heading "Support" [level=4] [ref=e57]
          - link "Help Center" [ref=e58] [cursor=pointer]:
            - /url: /Gigtos
          - link "Contact Us" [ref=e59] [cursor=pointer]:
            - /url: /Gigtos
          - link "FAQs" [ref=e60] [cursor=pointer]:
            - /url: /Gigtos
        - generic [ref=e61]:
          - heading "Legal" [level=4] [ref=e62]
          - link "Terms of Service" [ref=e63] [cursor=pointer]:
            - /url: /Gigtos
          - link "Privacy Policy" [ref=e64] [cursor=pointer]:
            - /url: /Gigtos
          - link "Security" [ref=e65] [cursor=pointer]:
            - /url: /Gigtos
      - generic [ref=e66]:
        - paragraph [ref=e67]: © 2026 Gigtos. All rights reserved.
        - generic [ref=e68]:
          - generic [ref=e69]: ✨ Premium Platform
          - generic [ref=e70]: 🛡️ Verified Workers
```

# Test source

```ts
  1  | // tests/e2e/rideWorkflow.spec.js
  2  | // Playwright E2E test for Gigtos ride workflow
  3  | const { test, expect } = require('@playwright/test');
  4  | 
  5  | const REGION_EMAIL = 'region@gmail.com';
  6  | const REGION_PASS = '101010';
  7  | const USER_PHONE = '1234567892';
  8  | const USER_PASS = '101010';
  9  | const WORKER_EMAIL = 'diverworker@gmail.com';
  10 | const WORKER_PASS = '101010';
  11 | 
  12 | // Helper: login as email/password
  13 | async function login(page, email, password) {
  14 |   await page.goto('/Gigtos/auth');
> 15 |   await page.fill('input[type="email"]', email);
     |              ^ Error: page.fill: Test timeout of 60000ms exceeded.
  16 |   await page.fill('input[type="password"]', password);
  17 |   await page.click('button:has-text("Sign In")');
  18 |   await page.waitForTimeout(2000);
  19 | }
  20 | 
  21 | test('Full ride workflow: region lead, driver, user', async ({ page }) => {
  22 |   // 1. Region lead logs in and approves driver
  23 |   await login(page, REGION_EMAIL, REGION_PASS);
  24 |   await page.goto('/Gigtos/admin/bookings');
  25 |   // Simulate approval (customize selector as needed)
  26 |   // await page.click('button:has-text("Approve")');
  27 |   await page.waitForTimeout(1000);
  28 |   await page.context().clearCookies();
  29 | 
  30 |   // 2. Worker logs in and registers as driver
  31 |   await login(page, WORKER_EMAIL, WORKER_PASS);
  32 |   await page.goto('/Gigtos/worker/dashboard');
  33 |   // Simulate driver registration and license upload if needed
  34 |   // await page.click('button:has-text("Register as Driver")');
  35 |   // await page.setInputFiles('input[type="file"]', 'path/to/license.jpg');
  36 |   await page.waitForTimeout(1000);
  37 |   await page.context().clearCookies();
  38 | 
  39 |   // 3. User logs in and books a ride
  40 |   await login(page, USER_PHONE, USER_PASS);
  41 |   await page.goto('/Gigtos/ride-booking');
  42 |   await page.fill('input[placeholder="Enter pickup location"]', 'Test Pickup');
  43 |   await page.fill('input[placeholder="Enter drop location"]', 'Test Drop');
  44 |   // Simulate map selection if possible
  45 |   // await page.click('.user-location-map');
  46 |   await page.click('button:has-text("Book Ride")');
  47 |   await expect(page.locator('text=Ride request created')).toBeVisible();
  48 | });
  49 | 
```