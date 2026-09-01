const express = require('express');
const axios = require('axios');
const cors = require("cors");
const app = express();

app.use(cors({
  origin: "http://localhost:5003",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// PUT YOUR KRA SANDBOX CREDENTIALS HERE
const KRA_CONFIG = { 
  baseUrl: "https://etims-api-sbx.kra.go.ke", // change to prod: https://etims-api.kra.go.ke
  pin: "P051234567M",
  bhfId: "00", // Branch ID from KRA portal, usually 00 for head office
  dvcSrlNo: "YOUR_DEVICE_SERIAL", // from KRA
  token: "YOUR_BEARER_TOKEN" // you get after login
};

// 1. Helper: Convert QR URL to Base64 for jsPDF
async function qrUrlToBase64(qrUrl) {
  try {
    const response = await axios.get(qrUrl, { responseType: 'arraybuffer' });
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    return `data:image/png;base64,${base64}`;
  } catch (err) {
    console.error("QR Convert Error", err.message);
    return null;
  }
}

// 2. Main API: Create eTIMS Invoice
app.post('/api/etims/create-invoice', async (req, res) => {
  const { invoiceNo, buyer, items, paymentType } = req.body;

  // Calculate totals
  let taxblAmt = 0;
  let taxAmt = 0;
  const itemList = items.map((it, idx) => {
    const splyAmt = it.quantity * it.sellingPrice;
    const itemTax = splyAmt * 0;
    taxblAmt += splyAmt;
    taxAmt += itemTax;
    return {
      itemSeq: idx + 1,
      itemCd: it.itemCode || `ITEM00${idx+1}`, // your internal code
      itemClsCd: it.itemClsCd || "87083000", // must be from KRA Item list
      itemNm: it.name,
      qty: it.quantity,
      prc: it.sellingPrice,
      splyAmt: splyAmt,
      dcRt: 0,
      dcAmt: 0,
      isrccCd: null,
      isrccNm: null,
      isrcRt: null,
      isrcAmt: null,
      vatCatCd: "C", // A=16%, B=0%, C=exempt
      exciseTxCatCd: null,
      tlTaxblAmt: splyAmt,
      taxblAmt: splyAmt,
      taxAmt: itemTax,
      totAmt: splyAmt + itemTax
    };
  });

  const kraPayload = {
    trdInvcNo: invoiceNo,
    invcDt: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14), // YYYYMMDDHHMMSS
    trdPin: KRA_CONFIG.pin,
    bhfId: KRA_CONFIG.bhfId,
    custPin: buyer.pin || null,
    custNm: buyer.name,
    salesTyCd: buyer.pin ? "B" : "C", // B2B or B2C
    rcptTyCd: "S", // S=Sale
    pmtTyCd: paymentType || "01", // 01=Cash, 05=Mpesa, 03=Credit
    pmtNm: paymentType === "05" ? "M-PESA" : "CASH",
    salesSttsCd: "02", // 02=Approved
    cfmSch: "01",
    salesDt: new Date().toISOString().slice(0, 8).replace(/-/g, ''),
    totItemCnt: items.length,
    taxblAmtA: taxblAmt,
    taxAmtA: taxAmt,
    totAmt: taxblAmt + taxAmt,
    itemList: itemList
  };

  try {
    console.log(kraPayload);
    // Send to KRA
    const kraRes = await axios.post(
      `${KRA_CONFIG.baseUrl}/trnsSales/saveSales`,
      kraPayload,
      {
        headers: {
          'Authorization': `Bearer ${KRA_CONFIG.token}`,
          'Content-Type': 'application/json',
          'tin': KRA_CONFIG.pin,
          'bhfId': KRA_CONFIG.bhfId,
          'dvcSrlNo': KRA_CONFIG.dvcSrlNo
        }
      }
    );

    // KRA returns CU number and QR url
    const { cuInvcNo, qrCodeUrl, invcNo } = kraRes.data.data || kraRes.data;

    // Convert QR to base64 for your React frontend
    const qrBase64 = qrUrlToBase64 ? await qrUrlToBase64(qrCodeUrl) : null;

    return res.json({
      success: true,
      cuInvoiceNo: cuInvcNo,
      kraInvoiceNo: invcNo,
      qrUrl: qrCodeUrl,
      qrBase64: qrBase64, // send this directly to generateETIMSReceipt()
      kraPayload: kraRes.data
    });

  } catch (err) {
    console.error("KRA ERROR:", err.response?.data || err.message);
    return res.status(400).json({
      success: false,
      error: err.response?.data || err.message,
      kraPayload // for debugging
    });
  }
});

// 3. Pull Purchases (Supplier invoices sent to you)
app.get('/api/etims/purchases', async (req, res) => {
  try {
    const resp = await axios.get(
      `${KRA_CONFIG.baseUrl}/trnsPurchase/selectTrnsPurchaseSales`,
      {
        headers: {
          'Authorization': `Bearer ${KRA_CONFIG.token}`,
          'tin': KRA_CONFIG.pin,
          'bhfId': KRA_CONFIG.bhfId
        },
        params: { lastReqDt: "20200101" }
      }
    );
    res.json(resp.data);
  } catch (e) {
    res.status(400).json({ error: e.response?.data || e.message });
  }
});

app.listen(3000, () => console.log("eTIMS Backend running on 3000"));