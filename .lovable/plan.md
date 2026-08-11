# Plan - Automatic Order Chat Trigger

Implement automated messaging between buyer and seller upon successful payment for digital assets to jumpstart the fulfillment conversation.

## User Review Required

> [!IMPORTANT]
> The automated messages will be sent as standard Direct Messages (DMs) between the two users. Should these messages be tagged with the `order_id` in the database to link them to the specific transaction?

## Proposed Changes

### Backend Logic (Settlement)

#### `src/lib/payments/settle.server.ts`
- Modify `settleOrder` to detect successful payments.
- For all paid orders (both instant and manual escrow), trigger the automated conversation:
    - Insert a message from **Buyer to Seller**: `hey i just paid for [Product Name] please deliver as soon as possible.`
    - Insert an automated reply from **Seller to Buyer**: `Thank you for your payment!. We are preparing your order and will ship it as soon as possible. Thank you and we will make sure everything goes smoothly.`
- Ensure these messages are inserted with the correct `sender_id`, `recipient_id`, and `order_id`.

#### `src/lib/marketplace.functions.ts`
- Update the `createOrder` server function (used for Wallet payments) to also trigger these messages when the order is successfully created/paid via wallet.

## Verification Plan

### Automated Tests
- Perform a test purchase using the Oventric Wallet (if balance available) or simulate a successful gateway return.
- Verify that a new message thread (or new messages in an existing thread) appears between the buyer and seller.
- Verify the content of both messages matches the requested copy exactly.

### Manual Verification
- Check the "Messages" tab in the app preview after a successful checkout to see the triggered conversation.
