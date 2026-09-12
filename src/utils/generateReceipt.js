import jsPDF from "jspdf";

export const generateETIMSReceipt = (receipt) => {
  const {
    // -------------------------------------------------------
    // MODE
    // -------------------------------------------------------
    etims,

    // -------------------------------------------------------
    // BUSINESS
    // -------------------------------------------------------
    shopName="Yeli Farm and Nursery",
    shopTradeName,
    shopAddress,
    shopPin,
    shopTel,

    // -------------------------------------------------------
    // TRANSACTION
    // -------------------------------------------------------
    invoiceNo,
    kraInvoiceNumber,
    receiptNumber,
    receiptType = "TRAINING",
    transactionType = "SALE",
    receiptLabel = "TS",

    // -------------------------------------------------------
    // CUSTOMER
    // -------------------------------------------------------
    buyerName,
    buyerPin,
    buyerLocation,

    // -------------------------------------------------------
    // PAYMENT
    // -------------------------------------------------------
    paymentMethod = "",

    // -------------------------------------------------------
    // TOTALS
    // -------------------------------------------------------
    totalBeforeDiscount = 0,
    totalDiscount = 0,
    totalTax = 0,
    total = 0,

    // -------------------------------------------------------
    // TAX
    // -------------------------------------------------------

    // -------------------------------------------------------
    // ITEMS
    // -------------------------------------------------------
    itemCount,
    items,
    timestamp,

    // -------------------------------------------------------
    // eTIMS / SCU
    // -------------------------------------------------------
    cuInvoiceNo,
    cuDate,
    cuTime,
    itemCode="--",
    internalData,
    receiptSignature,
    qrBase64,

    // -------------------------------------------------------
    // OPTIONAL
    // -------------------------------------------------------
    kraLogoBase64,
  } = receipt;

  const rawTaxSummary = receipt.taxSummary || [];
  const taxSummary = Array.isArray(rawTaxSummary)
    ? rawTaxSummary
    : ["a", "b", "c", "a"].map((suffix) => {
        const defaultLabels = {
          a: "16% VAT",
          b: "8% VAT",
          c: "Zero rated",
          d: "Exempted",
        };
        const rate = rawTaxSummary[`tax_rate_${suffix}`];
        const rateLabel = rate !== undefined && rate !== null && rate !== ""
          ? defaultLabels[suffix] : `${String(rate).replace(/%$/, "")}% VAT`;

        return {
          label: rateLabel,
          rate: "",
          taxableAmount: rawTaxSummary[`taxable_amount_${suffix}`] ?? 0,
          taxAmount: rawTaxSummary[`tax_amount_${suffix}`] ?? 0,
        };
      });

  const date = timestamp.split("T")[0];
  const time = timestamp.split("T")[1].split(".")[0];

  /*
   * =========================================================
   * HELPERS
   * =========================================================
   */

  const safe = (value, fallback = "-") => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return fallback;
    }

    return String(value);
  };

  const money = (value) => {
    const number = Number(value || 0);

    return number.toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  /*
   * =========================================================
   * ESTIMATE RECEIPT HEIGHT
   * =========================================================
   *
   * Thermal receipts should ideally remain one continuous
   * page rather than creating page 2.
   */

  const estimatedItemHeight = items.reduce(
    (height, sale) => {
      const description = safe(
        sale.name,
        "Item"
      );

      const descriptionLines = Math.max(
        1,
        Math.ceil(description.length / 32)
      );

      return (
        height +
        9 +
        (descriptionLines - 1) * 3
      );
    },
    0
  );

  const taxHeight = etims
    ? Math.max(1, taxSummary.length) * 2
    : 0;

  const scUHeight = etims ? 25 : 0;

  const typeHeight = receiptType !== "Normal" && etims ? 6 : 0;

  const estimatedHeight =
    35 +                     // Header
    25 +                     // Receipt information
    10 +                     // Items header
    estimatedItemHeight +
    35 +                     // Totals
    taxHeight +
    scUHeight +
    + typeHeight +
    (etims && qrBase64 ? 35 : 15) +
    30;                      // Footer 

  const receiptHeight = Math.max(
    105,
    Math.ceil(etims ? estimatedHeight - 35 : estimatedHeight - 55 )
  );

  /*
   * =========================================================
   * PDF
   * =========================================================
   */

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, receiptHeight],
  });

  const PAGE_WIDTH = 80;
  const LEFT = 3;
  const RIGHT = 77;
  const CENTER = PAGE_WIDTH / 2;

  let y = 10;

  /*
   * =========================================================
   * DRAWING HELPERS
   * =========================================================
   */

  const drawLine = () => {
    doc.line(LEFT, y, RIGHT, y);
    y += 4;
  };

  const sectionHeading = (text) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(text, LEFT, y);

    y += 4;

    doc.setFont("helvetica", "normal");
  };

  /*
   * Label/value helper.
   *
   * Notice the explicit space after ":".
   *
   * Example:
   * PIN: P051234567A
   */

  const drawLabelValue = (
    label,
    value,
    x = LEFT,
    width = 35
  ) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);

    const labelText = `${label}: `;

    doc.text(
      labelText,
      x,
      y
    );

    const labelWidth =
      doc.getTextWidth(labelText);

    doc.setFont("helvetica", "normal");

    const valueLines =
      doc.splitTextToSize(
        safe(value),
        width - labelWidth
      );

    doc.text(
      valueLines,
      x + labelWidth,
      y
    );

    return Math.max(
      1,
      valueLines.length
    ) * 3;
  };

  /*
   * Two-column receipt information.
   */

  const drawTwoColumnRow = (
    leftLabel,
    leftValue,
    rightLabel,
    rightValue
  ) => {
    const rowY = y;

    const leftX = LEFT;
    const rightX = 42;

    const leftWidth = 36;
    const rightWidth = 35;

    const leftHeight = drawLabelValue(
      leftLabel,
      leftValue,
      leftX,
      leftWidth
    );

    /*
     * Reset Y so the right column starts at exactly
     * the same vertical position.
     */
    y = rowY;

    const rightHeight = drawLabelValue(
      rightLabel,
      rightValue,
      rightX,
      rightWidth
    );

    y = rowY + Math.max(
      leftHeight,
      rightHeight
    );
  };

  const drawRightTotal = (
    label,
    value,
    bold = false
  ) => {
    doc.setFont(
      "helvetica",
      bold ? "bold" : "normal"
    );

    doc.setFontSize(
      bold ? 8 : 6.5
    );

    doc.text(
      `${label}:`,
      35,
      y
    );

    doc.text(
      money(value),
      RIGHT,
      y,
      { align: "right" }
    );

    y += bold ? 4.5 : 3.5;
  };

  const drawLeftTotal = (
    label,
    value,
    bold = false
  ) => {
    doc.setFont(
      "helvetica",
      bold ? "bold" : "normal"
    );

    doc.setFontSize(
      bold ? 8 : 6.5
    );

    doc.text(
      `${label}:`,
      3,
      y
    );

    doc.text(
      money(value),
      RIGHT,
      y,
      { align: "right" }
    );

    y += bold ? 4.5 : 3.5;
  };

  /*
   * =========================================================
   * HEADER
   * =========================================================
   */

  if (kraLogoBase64 && etims) {
    try {
      doc.addImage(
        kraLogoBase64,
        "PNG",
        CENTER - 6,
        y,
        12,
        10
      );

      y += 12;
    } catch (error) {
      console.warn(
        "Unable to render KRA logo",
        error
      );
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);

  doc.text(
    safe(shopName),
    CENTER,
    y,
    { align: "center" }
  );

  y += 4;

  if (shopTradeName) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);

    doc.text(
      safe(shopTradeName),
      CENTER,
      y,
      { align: "center" }
    );

    y += 3;
  }

  if (shopAddress) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);

    const addressLines =
      doc.splitTextToSize(
        safe(shopAddress),
        70
      );

    doc.text(
      addressLines,
      CENTER,
      y,
      { align: "center" }
    );

    y +=
      addressLines.length * 2.7;
  }

  if (shopTel) {
    doc.setFontSize(6);

    doc.text(
      `Tel: ${safe(shopTel)}`,
      CENTER,
      y,
      { align: "center" }
    );

    y += 3;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);

  doc.text(
    `PIN: ${safe(shopPin)}`,
    CENTER,
    y,
    { align: "center" }
  );

  y += 4;

  drawLine();

  /*
   * =========================================================
   * RECEIPT TITLE
   * =========================================================
   */

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);

  const title =
    transactionType === "CREDIT NOTE"
      ? "CREDIT NOTE"
      : "TAX INVOICE";

  /*
   * For non-eTIMS sales this is simply a receipt.
   */
  const receiptTitle = etims
    ? title
    : "RECEIPT";

  doc.text(
    receiptTitle,
    CENTER,
    y,
    { align: "center" }
  );

  y += 4;

  /*
   * =========================================================
   * COPY / TRAINING / PROFORMA
   * =========================================================
   */

  if (
    etims &&
    receiptType !== "NORMAL"
  ) {/*
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);

    doc.text(
      receiptType,
      CENTER,
      y,
      { align: "center" }
    );

    y += 3.5;
*/
    doc.setFontSize(6);

    doc.text(
      "THIS IS NOT AN OFFICIAL RECEIPT",
      CENTER,
      y,
      { align: "center" }
    );

    y += 4;
  }

  /*
   * =========================================================
   * RECEIPT INFORMATION
   * =========================================================
   */

  sectionHeading("RECEIPT INFORMATION");

  /*
   * TWO COLUMN LAYOUT
   *
   * Left                      Right
   * ------------------------------------------------
   * Receipt No: 123           Date: 28/08/2026
   * Receipt Type: NORMAL      Time: 14:32:10
   * Customer: John Doe        Payment: CASH
   * Buyer PIN: P...           Items: 3
   */

  drawTwoColumnRow(
    "Receipt No",
    invoiceNo || receiptNumber,
    "Date",
    date
  );

  drawTwoColumnRow(
    "Receipt Type",
    receipt.receiptType || "NORMAL",
    "Time",
    time
  );

  const paymentMd = paymentMethod || items[0].paymentMethod || "Cash - Paid";

  drawTwoColumnRow(
    "Customer",
    buyerName || items[0].customerName || "Walk-in Customer",
    "Payment",
    `${paymentMd === "mpesa" ? `${paymentMd} - ${items[0]?.mpesaTransactionId}` : paymentMd}`
  );

  drawTwoColumnRow(
    "Buyer PIN",
    buyerPin || items[0]?.customerPin || "N/A",
    "Items",
    itemCount ?? items.length
  );

  if (etims) {
    drawTwoColumnRow(
      "Transaction",
      transactionType,
      "Label",
      receiptLabel
    );
  }

  if (buyerLocation) {
    y += 1;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);

    doc.text(
      "Location: ",
      LEFT,
      y
    );

    const labelWidth =
      doc.getTextWidth("Location: ");

    doc.setFont("helvetica", "normal");

    const locationLines =
      doc.splitTextToSize(
        safe(buyerLocation),
        72 - labelWidth
      );

    doc.text(
      locationLines,
      LEFT + labelWidth,
      y
    );

    y +=
      Math.max(
        1,
        locationLines.length
      ) * 3;
  }

  drawLine();

  /*
   * =========================================================
   * ITEMS
   * =========================================================
   */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);

  doc.text(
    "DESCRIPTION",
    LEFT,
    y
  );

  doc.text(
    "QTY",
    39,
    y,
    { align: "right" }
  );

  doc.text(
    "PRICE",
    49,
    y,
    { align: "right" }
  );

   doc.text(
    etims ? "TAXABLE" : "DISCOUNT",
    64,
    y,
    { align: "right" }
  );

  doc.text(
    "AMOUNT",
    RIGHT,
    y,
    { align: "right" }
  );

  y += 2;

  doc.line(
    LEFT,
    y,
    RIGHT,
    y
  );

  y += 3;

  /*
   * ---------------------------------------------------------
   * ITEM ROWS
   * ---------------------------------------------------------
   */

  items.forEach((sale, index) => {
    const name = safe(
      sale.name,
      "Item"
    );

    const quantity = Number(
      sale.quantity || sale.qty || 0
    );

    const amount = Number(
      sale.total_amount || sale.total || sale.qty * sale.sellingPrice || 0
    );

      const taxableAmount = Number(
      sale.taxable_amount ?? 0
    );

    const discount = Number(
      sale.discount ?? 0
    )

    /*
     * Use supplied unit price when available.
     * Don't unnecessarily reconstruct transaction values.
     */
    const unitPrice =
      (sale.unitPrice || sale.sellingPrice) !== undefined
        ? Number(sale.unit_price || sale.sellingPrice)
        : quantity > 0
          ? amount / quantity
          : 0;

    /*
     * Description
     */
    const descriptionLines =
      doc.splitTextToSize(
        name,
        36
      );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);

    doc.text(
      `${index + 1}. ${descriptionLines[0]}`,
      LEFT,
      y
    );

    y += 3;

    for (
      let i = 1;
      i < descriptionLines.length;
      i++
    ) {
      doc.text(
        descriptionLines[i],
        LEFT + 4,
        y
      );

      y += 3;
    }

    /*
     * Item metadata
     *
     * eTIMS: show tax designation / HS code
     * Normal receipt: don't show eTIMS tax information.
     */

    if (etims) {
      doc.setFontSize(5.5);

      doc.text(
        `Item Code: ${itemCode}`,
        LEFT + 4,
        y
      );
    }

    /*
     * Numbers
     */

    doc.setFontSize(6);

    doc.text(
      quantity.toFixed(2),
      39,
      y,
      { align: "right" }
    );

    doc.text(
      money(unitPrice),
      49,
      y,
      { align: "right" }
    );

    doc.text(
      money(etims ? taxableAmount : discount),
      64,
      y,
      { align: "right" }
    );

      doc.text(
      money(amount),
      RIGHT,
      y,
      { align: "right" }
    );

    y += 4;
  });

  drawLine();

  /*
   * =========================================================
   * TOTALS
   * =========================================================
   */

  y += 1;

   if (
    Number(totalDiscount || 0) !== 0
  ) {
    drawLeftTotal(
      "Subtotal Before Discount",
      totalBeforeDiscount,
      true
    );
  }

  if (
    Number(totalDiscount || 0) !== 0
  ) {
    drawLeftTotal(
      "Total Discount",
      -Math.abs(
        Number(totalDiscount)
      ),
      true
    );
  }

  etims && drawLine()

  /*
   * ---------------------------------------------------------
   * eTIMS TAX BREAKDOWN
   * ---------------------------------------------------------
   *
   * Only show tax information for eTIMS receipts.
   */

  if (
    etims &&
    taxSummary.length > 0
  ) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);

    doc.text(
      "RATE",
      LEFT,
      y
    );

    doc.text(
      "TAXABLE",
      48,
      y,
      { align: "right" }
    );

    doc.text(
      "TAX",
      RIGHT,
      y,
      { align: "right" }
    );

    y += 2;

    doc.line(
      LEFT,
      y,
      RIGHT,
      y
    );

    y += 3;

    taxSummary.forEach((tax) => {
      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.text(
        `${safe(tax.label)} ${safe(tax.rate)}`,
        LEFT,
        y
      );

      doc.text(
        money(tax.taxableAmount),
        48,
        y,
        { align: "right" }
      );

      doc.text(
        money(tax.taxAmount),
        RIGHT,
        y,
        { align: "right" }
      );

      y += 4;
    });

    y-=2;

    etims && drawLine() && (y -= 6);

    drawLeftTotal(
      "Total Tax",
      totalTax,
      true
    );
  }

  /*
   * ---------------------------------------------------------
   * GRAND TOTAL
   * ---------------------------------------------------------
   */

  if (etims) {
    drawLeftTotal(
    "Total to Pay",
    (total || items[0]?.bulkTotal || items[0].total),
    true
  );
}

  drawLeftTotal(
    etims
      ? "Total To Pay"
      : "Total",
    (total || items[0]?.bulkTotal || items[0].total),
    true
  );

  y -= 1.5;

  /*
   * =========================================================
   * eTIMS SCU INFORMATION
   * =========================================================
   *
   * Completely omitted for normal receipts.
   */

  if (etims) {
    drawLine();

    sectionHeading(
      "SCU INFORMATION"
    );

    drawTwoColumnRow(
      "Date",
      cuDate || saleDate,
      "Time",
      cuTime || saleTime
    );

    drawTwoColumnRow(
      "CU Invoice No",
      cuInvoiceNo,
      "KRA Invoice Number",
      kraInvoiceNumber,
    );

    /*
     * Internal Data
     */
    if (internalData) {
      y += 1;

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(6);

      doc.text(
        "Internal Data: ",
        LEFT,
        y
      );

      const labelWidth =
        doc.getTextWidth(
          "Internal Data: "
        );

      doc.setFont(
        "helvetica",
        "normal"
      );

      const internalLines =
        doc.splitTextToSize(
          safe(internalData),
          72 - labelWidth
        );

      doc.text(
        internalLines,
        LEFT + labelWidth,
        y
      );

      y +=
        Math.max(
          1,
          internalLines.length
        ) * 2.7 + 2;
    }

    /*
     * Receipt Signature
     */
    if (receiptSignature) {
      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(6);

      doc.text(
        "Receipt Signature: ",
        LEFT,
        y
      );

      const labelWidth =
        doc.getTextWidth(
          "Receipt Signature: "
        );

      doc.setFont(
        "helvetica",
        "normal"
      );

      const signatureLines =
        doc.splitTextToSize(
          safe(receiptSignature),
          72 - labelWidth
        );

      doc.text(
        signatureLines,
        LEFT + labelWidth,
        y
      );

      y +=
        Math.max(
          1,
          signatureLines.length
        ) * 2.7 + 2;
    }

    /*
     * -------------------------------------------------------
     * QR
     * -------------------------------------------------------
     */

    if (qrBase64) {
      y -= 2;

      try {
        const QR_SIZE = 27;

        doc.addImage(
          qrBase64,
          "PNG",
          CENTER - QR_SIZE / 2,
          y,
          QR_SIZE,
          QR_SIZE
        );

        y += QR_SIZE + 2;

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(5);

        doc.text(
          "Scan to verify this eTIMS receipt",
          CENTER,
          y,
          { align: "center" }
        );

        y += 2;
      } catch (error) {
        console.warn(
          "Unable to render eTIMS QR code",
          error
        );
      }
    }
  }

  /*
   * =========================================================
   * FOOTER
   * =========================================================
   */

  drawLine();

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(6.5);

  doc.text(
    "THANK YOU FOR YOUR BUSINESS",
    CENTER,
    y,
    { align: "center" }
  );

  y += 3;

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(5.5);

  doc.text(
    "We look forward to serving you again.",
    CENTER,
    y,
    { align: "center" }
  );

  /*
   * ---------------------------------------------------------
   * eTIMS footer reference
   * ---------------------------------------------------------
   */

  if (etims && cuInvoiceNo) {
    y += 4;

    doc.setFontSize(5);

    doc.text(
      `CU Invoice No: ${safe(cuInvoiceNo)}`,
      CENTER,
      y,
      { align: "center" }
    );
  }

  /*
   * =========================================================
   * PRINT
   * =========================================================
   */

  doc.autoPrint();

  window.open(
    doc.output("bloburl"),
    "_blank"
  );
};