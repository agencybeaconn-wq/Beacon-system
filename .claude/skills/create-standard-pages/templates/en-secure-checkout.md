# Secure Checkout

_Last updated: {{last_updated}}_

At **{{client_name}}**, security is a top priority. We invest in technology, processes, and certified partners to protect every transaction made at **{{shop_url}}**. Learn the security layers in place.

## 1. SSL certificate and encryption

All traffic between your browser and our site is encrypted via **TLS 1.3** (Transport Layer Security), the most modern industry standard. This means:

- Personal, payment, and navigation data travel encrypted, inaccessible to third parties;
- Your browser displays a **padlock** next to the address — click it to view the certificate;
- Login passwords are stored with **cryptographic hashing** (bcrypt/argon2), not plain text.

## 2. Payment processing

We **do not process payments directly** on our servers. We use **PCI DSS Level 1 certified gateways** (the highest security standard in the financial industry), including:

- **Shopify Payments** (Stripe)
- **PayPal**
- **Klarna**
- **Afterpay / Clearpay**
- **Mercado Pago** (LatAm)

What this means for you:

- Card data goes directly to the gateway, encrypted end-to-end;
- {{client_name}} **never** sees full card number, CVV, or banking password;
- Suspicious transactions pass through automatic and manual fraud analysis.

## 3. Data we do NOT store

For your protection, we **never** store:

- Full credit card numbers
- Security codes (CVV/CVC)
- Banking passwords or app credentials
- PIX approval tokens after completion
- Biometric data

We only store the last 4 digits of the card (for refund identification) and the cardholder name, encrypted at rest with **AES-256**.

## 4. Fraud protection

All purchases undergo **automated fraud analysis** evaluating:

- Consistency between shipping postcode, billing address, and buyer's IP;
- Card history (previous attempts, global blocklists);
- Checkout velocity (bot patterns);
- Device and browser fingerprint;
- Pre-purchase navigation behavior;
- **3D Secure 2** authentication for high-value or high-risk transactions.

Suspicious orders may be **automatically blocked** or escalated to manual review (which can take up to 24h). For erroneous blocks, contact **{{support_email}}** for case review.

## 5. Authentication

We strongly recommend:

- **Strong password**: minimum 10 characters, mixing letters, numbers, symbols;
- **Do not reuse passwords** from other sites;
- **Enable 2FA** (two-factor authentication) where available;
- **Never share** your login or recovery codes.

## 6. Data protection compliance

We process personal data in accordance with:

- **GDPR** (EU Regulation 2016/679) for European Economic Area residents
- **UK GDPR** and Data Protection Act 2018 for UK residents
- **CCPA** (California Consumer Privacy Act) for California residents
- **LGPD** (Lei 13.709/18) for Brazilian residents

Key principles we follow:

- Minimal collection (only data strictly needed to execute the purchase);
- Declared and specific purposes;
- Appropriate legal bases (contract, consent, legitimate interest);
- Right to access, correct, delete, and port data — always available;
- Segregated storage systems with access control.

See full [Privacy Policy](/pages/privacy-policy).

## 7. Recognizing fake sites

If you find a site using the name {{client_name}} with a **domain different from {{shop_url}}**, it may be a scam attempt. Watch out for:

- URLs with spelling errors;
- Sponsored social media ads with suspiciously low prices;
- Emails asking for bank data or password confirmation;
- WhatsApp offers from unknown numbers claiming to be our official channel.

In doubt, check the **padlock** in your browser and the exact domain. **We never ask for password or CVV via email, WhatsApp, or phone.**

## 8. What to do if you suspect something

If you identify an unrecognized transaction, a suspicious email in our name, or unauthorized account access:

1. **Change your password** immediately at **{{shop_url}}/account**;
2. **Contact your bank** to block the card (if applicable);
3. **Notify us** at **{{support_email}}** with as much detail as possible (date, amount, order);
4. We initiate investigation within **24 business hours**.

## 9. Security team contact

- **General email:** {{support_email}}
- **DPO email (data protection):** {{dpo_email}}
- **Business hours:** {{business_hours}}

---

_Security certifications and partners updated on {{last_updated}}. This document is informative and does not replace guidance from competent authorities in case of fraud or security incident._
