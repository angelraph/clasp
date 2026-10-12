# Setup checklist

Do these in order. Keys go in `.env.local`, never in chat or in git.

## 1. PayPal Developer account
- Log in: https://developer.paypal.com/dashboard/
- No PayPal account? Sign up: https://www.paypal.com/webapps/mpp/account-selection?intent=developer
- Blocked in your country? Ask in the PayPal Discord (step 9).

## 2. Sandbox test accounts (all **United States**)
Create them at https://developer.paypal.com/dashboard/accounts → **Create account**.

| Name | Type | Purpose |
|---|---|---|
| Clasp Platform | Business | Your app runs under this account |
| Sam Seller | Business | Receives sale and rental money |
| Bella Buyer | Personal | Pays. Set a $5,000 balance under **…** → View/edit account |

Save each sandbox email and password. Log into them at https://www.sandbox.paypal.com

## 3. Sandbox app (API keys)
- https://developer.paypal.com/dashboard/applications/sandbox → **Create App**
- Type **Merchant**, linked to **Clasp Platform**
- Copy **Client ID** → `PAYPAL_CLIENT_ID` and **Secret** → `PAYPAL_CLIENT_SECRET`

## 4. OpenAI
- Key: https://platform.openai.com/api-keys → `OPENAI_API_KEY`
- Credit: https://platform.openai.com/settings/organization/billing/overview ($5–10 is plenty)

## 5. Render (hosting)
- Sign up with GitHub: https://dashboard.render.com/register
- Claim $50: https://credits-portal-mmdm.onrender.com/claim/paypal-ai-hackathon
- How credits apply: https://render.com/docs/credits

## 6. Channel3 (optional, week 4)
- https://trychannel3.com/developers, promo code `PAYPAL-HACKATHON-2026`

## 7. GitHub
- https://github.com/signup

## 8. Fill in your keys
```bash
cp .env.example .env.local
```
Then open `.env.local` and paste your values.

## 9. PayPal Discord
- https://discord.gg/sJ2G6DyvSK

## Later: webhooks (after the first Render deploy)
1. Open your sandbox app → **Webhooks** → **Add Webhook**
2. URL: `https://<your-render-app>.onrender.com/api/webhooks/paypal`
3. Events: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.AUTHORIZATION.CREATED`, `PAYMENT.AUTHORIZATION.VOIDED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DECLINED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.REFUNDED`, `CUSTOMER.DISPUTE.CREATED`, `CUSTOMER.DISPUTE.UPDATED`, `CUSTOMER.DISPUTE.RESOLVED`
4. Copy the **Webhook ID** → `PAYPAL_WEBHOOK_ID` on Render
