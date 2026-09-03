# nursery-management-system

## DigiTax eTIMS

The server uses DigiTax's Kenya API rather than calling KRA directly. Set the
following environment variables before starting the server:

```env
DIGITAX_API_KEY=your_api_key
# Optional; this is the documented default:
DIGITAX_BASE_URL=https://api.digitax.tech/ke/v2
```

`POST /api/etims/items` saves an item in DigiTax. The response includes the
DigiTax item object and its `id`; pass that ID as `digitaxItemId` (or `itemId`)
when calling the existing `POST /api/etims/create-invoice` endpoint.

The invoice endpoint still accepts the existing `{ invoiceNo, buyer, items,
paymentType }` request. Its legacy `cuInvoiceNo`, `kraInvoiceNo`, `qrUrl`,
`qrBase64`, and `kraPayload` response fields are retained, with DigiTax's
`serial_number`, `invoice_number`, and `etims_url` mapped into them.

API reference: [DigiTax Kenya API reference](https://ke.docs.digitax.tech/reference)
