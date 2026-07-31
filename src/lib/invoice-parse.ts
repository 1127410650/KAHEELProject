/**
 * Local extraction of invoice fields and line items from UBL XML or plain text.
 */
import type { InvoiceLineItem, PrintedInvoice, ExtractionMethod } from "./invoice-scan";

function textOf(parent: Element | Document, ...paths: string[]): string | undefined {
  for (const path of paths) {
    const nodes = parent.getElementsByTagName(path);
    for (let i = 0; i < nodes.length; i += 1) {
      const value = nodes[i]?.textContent?.trim();
      if (value) return value;
    }
    const local = path.includes(":") ? path.split(":").pop()! : path;
    const all = parent.getElementsByTagName("*");
    for (let i = 0; i < all.length; i += 1) {
      const node = all[i]!;
      if (node.localName === local && node.textContent?.trim()) return node.textContent.trim();
    }
  }
  return undefined;
}

function childrenByLocalName(parent: Element | Document, local: string): Element[] {
  const out: Element[] = [];
  const all = parent.getElementsByTagName("*");
  for (let i = 0; i < all.length; i += 1) {
    const node = all[i]!;
    if (node.localName === local) out.push(node);
  }
  return out;
}

function money(value?: string): string | undefined {
  if (!value) return undefined;
  const num = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num.toFixed(2) : undefined;
}

export function parseUblXml(xml: string): PrintedInvoice | null {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, "application/xml");
  } catch {
    return null;
  }
  if (doc.getElementsByTagName("parsererror").length > 0) return null;

  const parties = childrenByLocalName(doc, "AccountingSupplierParty");
  const buyerParties = childrenByLocalName(doc, "AccountingCustomerParty");
  const seller = parties[0];
  const buyer = buyerParties[0];

  const lineItems: InvoiceLineItem[] = [];
  const lineNodes = [
    ...childrenByLocalName(doc, "InvoiceLine"),
    ...childrenByLocalName(doc, "CreditNoteLine"),
  ];
  for (const line of lineNodes) {
    const itemNode = childrenByLocalName(line, "Item")[0];
    const priceNode = childrenByLocalName(line, "Price")[0];
    const taxNode = childrenByLocalName(line, "TaxTotal")[0];
    const categoryNode = itemNode ? childrenByLocalName(itemNode, "ClassifiedTaxCategory")[0] : undefined;
    const name = itemNode ? textOf(itemNode, "Name") : undefined;
    if (!name) continue;
    const quantityNode = childrenByLocalName(line, "InvoicedQuantity")[0] ??
      childrenByLocalName(line, "CreditedQuantity")[0];
    lineItems.push({
      name,
      ...(itemNode && textOf(itemNode, "Description")
        ? { description: textOf(itemNode, "Description")! }
        : {}),
      ...(quantityNode?.textContent
        ? { quantity: quantityNode.textContent.trim() }
        : {}),
      ...(quantityNode?.getAttribute("unitCode")
        ? { unit: quantityNode.getAttribute("unitCode")! }
        : {}),
      ...(priceNode && money(textOf(priceNode, "PriceAmount"))
        ? { unitPrice: money(textOf(priceNode, "PriceAmount"))! }
        : {}),
      ...(categoryNode && textOf(categoryNode, "Percent")
        ? { taxRate: textOf(categoryNode, "Percent")! }
        : {}),
      ...(taxNode && money(textOf(taxNode, "TaxAmount"))
        ? { taxAmount: money(textOf(taxNode, "TaxAmount"))! }
        : {}),
      ...(money(textOf(line, "LineExtensionAmount"))
        ? { netAmount: money(textOf(line, "LineExtensionAmount"))! }
        : {}),
      ...(taxNode && money(textOf(taxNode, "RoundingAmount"))
        ? { grossAmount: money(textOf(taxNode, "RoundingAmount"))! }
        : {}),
      ...(itemNode && textOf(itemNode, "ID") ? { sku: textOf(itemNode, "ID")! } : {}),
    });
  }

  const monetary = childrenByLocalName(doc, "LegalMonetaryTotal")[0];
  const taxTotals = childrenByLocalName(doc, "TaxTotal");
  const issueDate = textOf(doc, "IssueDate");
  const issueTime = textOf(doc, "IssueTime");

  const result: PrintedInvoice = {
    method: "xml",
    confidence: 1,
    lineItems,
    ...(seller && textOf(seller, "RegistrationName", "Name")
      ? { sellerName: textOf(seller, "RegistrationName", "Name")! }
      : {}),
    ...(seller && textOf(seller, "CompanyID") ? { vatNumber: textOf(seller, "CompanyID")! } : {}),
    ...(buyer && textOf(buyer, "RegistrationName", "Name")
      ? { buyerName: textOf(buyer, "RegistrationName", "Name")! }
      : {}),
    ...(buyer && textOf(buyer, "CompanyID")
      ? { buyerVatNumber: textOf(buyer, "CompanyID")! }
      : {}),
    ...(textOf(doc, "cbc:ID", "ID") ? { invoiceNo: textOf(doc, "cbc:ID", "ID")! } : {}),
    ...(textOf(doc, "UUID") ? { uuid: textOf(doc, "UUID")! } : {}),
    ...(textOf(doc, "InvoiceTypeCode")
      ? { invoiceTypeCode: textOf(doc, "InvoiceTypeCode")! }
      : {}),
    ...(issueDate ? { timestamp: issueTime ? `${issueDate}T${issueTime}` : issueDate } : {}),
    ...(textOf(doc, "DocumentCurrencyCode")
      ? { currency: textOf(doc, "DocumentCurrencyCode")! }
      : {}),
    ...(monetary && money(textOf(monetary, "TaxExclusiveAmount"))
      ? { netTotal: money(textOf(monetary, "TaxExclusiveAmount"))! }
      : {}),
    ...(monetary && money(textOf(monetary, "AllowanceTotalAmount"))
      ? { discount: money(textOf(monetary, "AllowanceTotalAmount"))! }
      : {}),
    ...(taxTotals[0] && money(textOf(taxTotals[0]!, "TaxAmount"))
      ? { vatTotal: money(textOf(taxTotals[0]!, "TaxAmount"))! }
      : {}),
    ...(monetary && money(textOf(monetary, "TaxInclusiveAmount"))
      ? { total: money(textOf(monetary, "TaxInclusiveAmount"))! }
      : {}),
    rawText: xml.slice(0, 4000),
  };

  return result;
}

/* ------------------------------------------------------- plain text parsing */

const AR_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;

export function normalizeDigits(input: string): string {
  return input.replace(AR_DIGITS, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

/** Heuristic parse of a printed invoice's text layer or OCR output. */
export function parseInvoiceText(rawText: string, method: ExtractionMethod): PrintedInvoice {
  const text = normalizeDigits(rawText).replace(/[ \t]+/g, " ");
  const amount = "([0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?|[0-9]+(?:\\.[0-9]{1,2})?)";

  const vatNumber = firstMatch(text, [
    /(?:الرقم\s*الضريبي|رقم\s*التسجيل\s*الضريبي|VAT\s*(?:Reg(?:istration)?\.?\s*)?(?:No\.?|Number|#)?)\s*[:\-]?\s*(3\d{13}3)/i,
    /\b(3\d{13}3)\b/,
  ]);
  const total = firstMatch(text, [
    new RegExp(`(?:الإجمالي\\s*(?:مع|شامل)[^0-9]{0,20}|المجموع\\s*الكلي|Total\\s*(?:with|incl\\.?|including)[^0-9]{0,20}|Grand\\s*Total|Total\\s*Amount\\s*Due)\\s*[:\\-]?\\s*(?:SAR|ر\\.س|﷼)?\\s*${amount}`, "i"),
  ]);
  const vatTotal = firstMatch(text, [
    new RegExp(`(?:ضريبة\\s*القيمة\\s*المضافة|إجمالي\\s*الضريبة|VAT\\s*(?:Amount|Total)|Total\\s*VAT)\\s*(?:\\(?15%\\)?)?\\s*[:\\-]?\\s*(?:SAR|ر\\.س|﷼)?\\s*${amount}`, "i"),
  ]);
  const netTotal = firstMatch(text, [
    new RegExp(`(?:الإجمالي\\s*(?:قبل|بدون)[^0-9]{0,20}|المبلغ\\s*الخاضع\\s*للضريبة|Total\\s*(?:excl\\.?|before|excluding)[^0-9]{0,20}|Taxable\\s*Amount|Subtotal)\\s*[:\\-]?\\s*(?:SAR|ر\\.س|﷼)?\\s*${amount}`, "i"),
  ]);
  const invoiceNo = firstMatch(text, [
    /(?:رقم\s*الفاتورة|فاتورة\s*رقم|Invoice\s*(?:No\.?|Number|#))\s*[:\-]?\s*([A-Za-z0-9\-/]{3,32})/i,
  ]);
  const timestamp = firstMatch(text, [
    /\b(\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?)\b/,
    /\b(\d{2}\/\d{2}\/\d{4})\b/,
  ]);
  const sellerLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 3 && !/^[0-9\s.,:\-]+$/.test(line));

  const clean = (value?: string) => (value ? value.replace(/,/g, "") : undefined);

  return {
    method,
    confidence: method === "pdf-text" ? 0.75 : 0.5,
    lineItems: [],
    ...(sellerLine ? { sellerName: sellerLine.slice(0, 120) } : {}),
    ...(vatNumber ? { vatNumber } : {}),
    ...(invoiceNo ? { invoiceNo } : {}),
    ...(timestamp
      ? {
          timestamp: /\d{2}\/\d{2}\/\d{4}/.test(timestamp)
            ? timestamp.split("/").reverse().join("-")
            : timestamp,
        }
      : {}),
    ...(clean(netTotal) ? { netTotal: clean(netTotal)! } : {}),
    ...(clean(vatTotal) ? { vatTotal: clean(vatTotal)! } : {}),
    ...(clean(total) ? { total: clean(total)! } : {}),
    rawText: text.slice(0, 8000),
  };
}
