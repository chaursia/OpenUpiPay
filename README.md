# ⚡ OpenPayUPI — Self-Hosted UPI Payment Gateway Microservice

<p align="center">
  <img src="public/globe.svg" width="80" height="80" alt="OpenPayUPI Logo" />
</p>

<p align="center">
  <strong>A production-grade, self-hosted UPI payment gateway microservice with dynamic QR allocation, real-time dual-channel verification (SMS & Email IMAP), and an interactive Admin Control Center.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.3.2-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/TailwindCSS-Soft_Brutalism-FFD60A?style=flat-square" alt="Tailwind" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture & How It Works](#-architecture--how-it-works)
- [Tech Stack](#-tech-stack)
- [Quick Start Guide](#-quick-start-guide)
- [Authentication Model](#-authentication-model)
- [API Reference](#-api-reference)
- [Payment Verification Channels](#-payment-verification-channels)
  - [1. SMS Interception (Termux / Android)](#1-sms-interception-termux--android)
  - [2. Email IMAP Interception (Gmail / Bank Alerts)](#2-email-imap-interception-gmail--bank-alerts)
  - [3. Manual UTR Submission](#3-manual-utr-submission)
  - [4. OCR Screenshot Processing](#4-ocr-screenshot-processing)
- [Outbound HMAC Webhook Verification](#-outbound-hmac-webhook-verification)
- [Cron & Maintenance Automation](#-cron--maintenance-automation)
- [Project Directory Structure](#-project-directory-structure)
- [License](#-license)

---

## 🚀 Overview

Traditional payment gateways charge high transaction fees (1.5%–3%) and impose strict merchant onboarding requirements. **OpenPayUPI** lets you accept instant peer-to-peer and merchant UPI payments directly to your bank account with **0% transaction fees**.

### Why OpenPayUPI?
- **Zero Merchant Fees**: Payments land directly in your UPI account.
- **Dynamic Decimal Matching**: Automatically appends unique tracking decimals (e.g. ₹100.07) to differentiate concurrent orders without collisions.
- **Dual-Channel Interception**: Automated real-time payment reconciliation using Termux SMS listener and Email IMAP scraper.
- **Idempotency & Deduplication**: Cryptographically hashes 12-digit UTR numbers to prevent replay attacks or duplicate credits.
- **Enterprise Admin Suite**: Bento grid live monitoring, VPA capacity rotation, API key manager, and manual review queue.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **Dynamic Decimal Allocation** | Scans active `PENDING` orders for a base amount and assigns the next available unique decimal suffix (`.01` to `.99`). |
| **VPA Load Balancer** | Rotates across multiple UPI addresses based on real-time transaction count and daily transaction limits. |
| **Dual-Channel Interceptor** | Intercepts payment confirmations from Android SMS forwarders (Termux) and IMAP bank alert emails. |
| **OCR Screenshot Parser** | Client-side screenshot upload powered by Tesseract.js to automatically extract 12-digit UTRs and amounts. |
| **HMAC-SHA256 Signed Webhooks** | Dispatches cryptographically signed webhook notifications to client applications upon payment confirmation. |
| **Protected Admin Control Center** | Built with Next.js 16 and Supabase Session Auth to monitor live transactions, VPAs, API keys, and dispute resolution. |

---

## 🏗 Architecture & How It Works

```
 Client App                        OpenPayUPI Gateway                      Detection Stack
     │                                     │                                      │
     │ 1. POST /api/v1/payment/create     │                                      │
     ├────────────────────────────────────►│                                      │
     │                                     │ Allocates Dynamic Suffix (e.g. ₹500.04)
     │                                     │ Rotates least-loaded active VPA      │
     │ 2. Returns UPI URI + SVG/Data QR   │                                      │
     │◄────────────────────────────────────┤                                      │
     │                                     │                                      │
     │ 3. Customer Scans QR & Pays via UPI │                                      │
     │                                     │◄────────── 4a. Termux SMS Webhook ───┤
     │                                     │◄────────── 4b. IMAP Email Poller ────┤
     │                                     │◄────────── 4c. Manual UTR / OCR ─────┤
     │                                     │                                      │
     │                                     │ Deduplicates UTR via SHA-256 ledger  │
     │                                     │ Updates order status to PAID         │
     │                                     │                                      │
     │ 5. HMAC-SHA256 Signed Callback      │                                      │
     │◄────────────────────────────────────┤                                      │
```

---

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack, Server Actions)
- **Database & Auth**: Supabase (PostgreSQL with RLS & Supabase SSR Auth)
- **Styling**: Tailwind CSS (Custom Soft Brutalism design system)
- **OCR Engine**: Tesseract.js (Client-side & Server-side extraction)
- **Email Protocol**: ImapFlow + Mailparser
- **Cryptography**: Node.js `crypto` (HMAC-SHA256) & QR Engine (`qrcode`)

---

## 📦 Quick Start Guide

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/chaursia/OpenUpiPay.git
cd OpenUpiPay
npm install
```

### 2. Configure Environment Variables
Copy the example environment template:
```bash
cp .env.local.example .env.local
```

Open `.env.local` and populate your credentials:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=your-random-cron-secret-here
NEXT_PUBLIC_CLIENT_API_KEY=client_k_your_key_here

# Email IMAP Scraper (Optional)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=your-email@gmail.com
IMAP_PASSWORD=your-google-app-password
IMAP_MAILBOX=INBOX
```

### 3. Initialize Database Schema
Execute the following SQL migrations in your **Supabase SQL Editor** in sequential order:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/seed.sql` *(Optional: populates test VPAs and API keys)*

### 4. Create Admin Account
In your **Supabase Dashboard** → **Authentication** → **Users** → Click **Add user** (or Invite user). Use this email & password to log in to the admin panel.

### 5. Launch Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** for the landing page or **[http://localhost:3000/admin](http://localhost:3000/admin)** for the Admin Control Center.

---

## 🔑 Authentication Model

OpenPayUPI implements distinct security boundaries for different client types:

| Header | Intended Caller | Purpose |
|---|---|---|
| `X-Client-Api-Key` | External Client Applications | Create orders, check status, submit manual UTR & OCR |
| `X-Device-Secret` | Android Termux Agent | Submit SMS payment webhooks & telemetry heartbeats |
| `x-cron-secret` | Vercel Cron / External Cron | Trigger cleanup and email polling jobs |
| `Supabase Session Cookie` | Admin Dashboard Users | Access `/admin/*` control center pages **and** all `/api/v1/admin/*` endpoints (enforced per-route) |

---

## 📡 API Reference

### 1. Create Payment Order
Generates a dynamic amount and UPI deep link QR code.

```http
POST /api/v1/payment/create
Content-Type: application/json
X-Client-Api-Key: client_k_your_api_key
```

#### Request Body
```json
{
  "baseAmount": 100.00,
  "orderIdExt": "ORD-2026-001",
  "callbackUrl": "https://yourapp.com/api/webhook/upi",
  "returnUrl": "https://yourapp.com/order/thanks",
  "expiresInMinutes": 15
}
```

> `callbackUrl` is your **server-to-server** webhook target. `returnUrl` is where the **customer's browser** is redirected after the hosted checkout confirms payment — it receives `?orderId=...&orderIdExt=...&status=PAID`. Both are optional.

#### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "orderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "orderIdExt": "ORD-2026-001",
    "baseAmount": 100.00,
    "dynamicAmount": 100.07,
    "upiUri": "upi://pay?pa=merchant@ybl&pn=OpenPayUPI&am=100.07&cu=INR&tn=ORDER-3fa85f64...",
    "qrCodeDataUrl": "data:image/png;base64,...",
    "vpa": "merchant@ybl",
    "payeeName": "Merchant Store",
    "expiresAt": "2026-08-25T04:30:00.000Z",
    "paymentPageUrl": "http://localhost:3000/pay/3fa85f64-5717-4562-b3fc-2c963f66afa6"
  }
}
```

---

### 2. SMS Payment Webhook
Called by Android / Termux forwarder upon receiving a bank credit SMS.

```http
POST /api/v1/webhook/sms
Content-Type: application/json
X-Device-Secret: device_k_your_device_secret
```

#### Request Body
```json
{
  "amount": 100.07,
  "utr": "123456789012",
  "rawText": "Dear Customer, A/C credited with Rs.100.07 by UPI Ref 123456789012",
  "deviceName": "Redmi-Note-Primary"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Payment verified via SMS",
  "orderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "orderIdExt": "ORD-2026-001"
}
```

---

### 3. Device Telemetry Heartbeat
Maintains active device status and reports battery telemetry.

```http
POST /api/v1/device/heartbeat
Content-Type: application/json
X-Device-Secret: device_k_your_device_secret
```

```json
{
  "deviceName": "Redmi-Note-Primary",
  "metadata": {
    "battery": 94,
    "networkType": "WiFi"
  }
}
```

---

### 4. Manual UTR Submission
Fallback endpoint for customers who completed payment but SMS/Email sync was delayed.

```http
POST /api/v1/payment/submit-utr
Content-Type: application/json
X-Client-Api-Key: client_k_your_api_key
```

```json
{
  "orderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "utr": "123456789012"
}
```

---

### 5. Payment Screenshot OCR Upload
Parses customer receipt screenshots using Tesseract.js.

```http
POST /api/v1/payment/ocr-upload
Content-Type: application/json
X-Client-Api-Key: client_k_your_api_key
```

```json
{
  "orderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "imageBase64": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD..."
}
```

---

### 6. Dynamic QR Code Endpoint
Serves an SVG QR code for any order.

```http
GET /api/v1/payment/qr/:orderId
```

---

### 7. Order Status (Public)
Lightweight status polling for the hosted checkout page. Returns only
non-sensitive fields; the order ID is an unguessable UUID.

```http
GET /api/v1/payment/status/:orderId
```

```json
{
  "success": true,
  "data": {
    "orderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "status": "PAID",
    "expiresAt": "2026-08-25T04:30:00.000Z",
    "returnUrl": "https://yourapp.com/order/thanks"
  }
}
```

Status values: `PENDING`, `PAID`, `EXPIRED`, `MANUAL_VERIFICATION`, `PARTIAL_PAID`.

---

## 🔍 Payment Verification Channels

### 1. SMS Interception (Termux / Android)
Deploy any Android phone with a SIM card receiving bank SMS alerts:
1. Install **Termux** and **Termux:API** from [F-Droid](https://f-droid.org/).
2. Grant SMS permissions to `Termux:API`.
3. Set up a bash listener loop:
```bash
while true; do
  # Fetch latest SMS & forward to OpenPayUPI
  LATEST_SMS=$(termux-sms-list -l 1 -t inbox | jq -r '.[0].body // ""')
  # Extract UTR (12 digits) & Amount
  # Send POST /api/v1/webhook/sms with X-Device-Secret
  sleep 5
done
```

---

### 2. Email IMAP Interception (Gmail / Bank Alerts)
OpenPayUPI can connect directly to your email provider over IMAP to parse payment notification emails.

1. Enable **2-Step Verification** on your Google Account.
2. Generate an **App Password** at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Set `IMAP_HOST=imap.gmail.com`, `IMAP_USER=you@gmail.com`, and `IMAP_PASSWORD=app_password` in `.env.local`.
4. Trigger or schedule `POST /api/v1/cron/email-poll`.

---

### 3. Manual UTR Submission
If automated channels are delayed, customers can enter their 12-digit UTR on `/pay/[orderId]`. The transaction is queued for admin approval or auto-matched if an alert arrives later.

---

### 4. OCR Screenshot Processing
Customers can upload a screenshot of their UPI confirmation screen. Tesseract.js extracts the numeric UTR and transaction amount for instant verification.

---

## 🔐 Outbound HMAC Webhook Verification

When an order is marked as `PAID`, OpenPayUPI dispatches a signed HTTP POST request to your `callbackUrl`.

### Headers Sent
```http
Content-Type: application/json
X-Webhook-Signature: sha256=<hmac_hex_digest>
```

### Payload Structure
```json
{
  "event": "payment.success",
  "orderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "orderIdExt": "ORD-2026-001",
  "amount": 100.00,
  "dynamicAmount": 100.07,
  "upiUtr": "123456789012",
  "verifiedVia": "SMS",
  "timestamp": "2026-08-25T04:20:00.000Z"
}
```

### Verification Code Samples

#### Node.js / TypeScript
```typescript
import { createHmac, timingSafeEqual } from "crypto";

function verifyWebhook(rawBody: string, signatureHeader: string, secretKey: string): boolean {
  const signature = signatureHeader.replace(/^sha256=/, "");
  const expected = createHmac("sha256", secretKey).update(rawBody).digest("hex");
  
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

#### Python
```python
import hmac
import hashlib

def verify_webhook(raw_body: bytes, signature_header: str, secret_key: str) -> bool:
    signature = signature_header.replace("sha256=", "")
    expected = hmac.new(secret_key.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected)
```

#### PHP
```php
function verifyWebhook($rawBody, $signatureHeader, $secretKey) {
    $signature = str_replace('sha256=', '', $signatureHeader);
    $expected = hash_hmac('sha256', $rawBody, $secretKey);
    return hash_equals($expected, $signature);
}
```

---

## ⏰ Cron & Maintenance Automation

Set up scheduled cron triggers (e.g. via Vercel Cron, GitHub Actions, or cron-job.org):

| Schedule | Endpoint | Header | Purpose |
|---|---|---|---|
| `* * * * *` (Every 1 min) | `POST /api/v1/cron/email-poll` | `x-cron-secret` | Scan unread IMAP emails for UPI receipts |
| `*/5 * * * *` (Every 5 min) | `POST /api/v1/cron/cleanup` | `x-cron-secret` | Mark overdue `PENDING` orders as `EXPIRED` |
| `0 0 * * *` (Midnight) | `POST /api/v1/cron/cleanup?resetVpas=true` | `x-cron-secret` | Reset VPA daily transaction counters to 0 |

#### Example `vercel.json`
```json
{
  "crons": [
    { "path": "/api/v1/cron/email-poll", "schedule": "* * * * *" },
    { "path": "/api/v1/cron/cleanup", "schedule": "*/5 * * * *" },
    { "path": "/api/v1/cron/cleanup?resetVpas=true", "schedule": "0 0 * * *" }
  ]
}
```

---

## 📁 Project Directory Structure

```
openpayupi/
├── app/
│   ├── admin/               # Admin Control Center (Bento Grid)
│   │   ├── keys/            # API Key Manager
│   │   ├── orders/          # Paginated Orders Table
│   │   ├── settings/        # Gateway Configuration & IMAP Tester
│   │   ├── vpas/            # VPA Rotation & Daily Caps
│   │   ├── layout.tsx       # Sidebar navigation + sign-out
│   │   └── page.tsx         # Real-time dashboard modules
│   ├── api/
│   │   ├── auth/signout/    # Session invalidation
│   │   └── v1/
│   │       ├── admin/       # CRUD endpoints (keys, vpas, orders, resolve, devices, email)
│   │       ├── cron/        # Automated maintenance (cleanup, email-poll)
│   │       ├── device/      # Telemetry heartbeat
│   │       ├── payment/     # Order creation, QR, manual UTR, OCR
│   │       └── webhook/     # SMS & Email webhook interceptors
│   ├── login/               # Supabase Email/Password login
│   ├── pay/[orderId]/       # Public customer checkout & QR interface
│   │   └── success/         # Payment receipt screen
│   ├── globals.css          # Soft Brutalism design tokens
│   ├── layout.tsx           # Global font & theme provider
│   └── page.tsx             # Public landing page
├── components/
│   ├── admin/               # LiveOrders, InfraHealth, VpaHealth, ManualQueue, ApiKeys
│   └── payment/             # PaymentPageClient
├── lib/
│   ├── auth/                # Client Key, Device Secret, & Cron middleware
│   ├── email/               # ImapFlow email scraper & regex parser
│   ├── ocr/                 # Tesseract.js image analyzer
│   ├── payment/             # Dynamic decimal allocator, VPA balancer, Webhooks
│   ├── supabase/            # Server & Browser Supabase clients
│   └── utils/               # UTR validator & SHA-256 hasher
├── proxy.ts                 # Next.js 16 Auth Proxy (Route guard)
├── supabase/
│   ├── migrations/          # PostgreSQL DDL & RLS policies
│   └── seed.sql             # Test dataset
└── types/
    └── database.ts          # TypeScript schema types
```

---

## 📄 License

This project is open-source software licensed under the [MIT License](LICENSE).
