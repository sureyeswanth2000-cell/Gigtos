# E2E Booking Flow Execution Results

- Time: 2026-06-15T10:37:53.917Z
- Target: https://gigto.in
- Status: PASS
- Dev-auth role flows: disabled for production build
- Page/console errors: 0
- Ignored monitoring warnings: 2

## Steps

### 1. PASS Consumer service catalog renders launch services

- Duration: 1137 ms
- Detail: ok

### 2. PASS Protected booking route redirects to auth in production build

- Duration: 132 ms
- Detail: ok

### 3. PASS Protected worker dashboard redirects to auth in production build

- Duration: 39 ms
- Detail: ok

### 4. PASS Privacy and PWA public launch surfaces render

- Duration: 240 ms
- Detail: privacy + manifest ok

## Monitoring Warnings

- Loading the script 'https://cdn.razorpay.com/static/cx/razorpay-risk-detection/bundle.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://www.g
- Loading the script 'https://cdn.razorpay.com/static/cx/razorpay-risk-detection/bundle.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://www.g
