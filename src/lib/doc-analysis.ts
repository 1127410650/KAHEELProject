/**
 * Local (offline) document analysis rules — no paid API, no network calls.
 * Pure functions only: safe to import from a Web Worker and from the UI.
 */

export const ANALYZER_VERSION = "v1";

/* ------------------------------------------------------------------ types */

export type DocType =
  | "deed"
  | "registry"
  | "building_license"
  | "partition_report"
  | "plan_architectural"
  | "plan_structural"
  | "plan_electrical"
  | "plan_mechanical"
  | "contract"
  | "water_invoice"
  | "electricity_invoice"
  | "other_utility_invoice"
  | "payment_receipt"
  | "national_address"
  | "identity"
  | "engineering_report"
  | "certificate"
  | "site_photo"
  | "unknown";

export const DOC_TYPE_LABELS: Record<DocType, [string, string]> = {
  deed: ["صك ملكية", "Title deed"],
  registry: ["سجل عقاري", "Property registry"],
  building_license: ["رخصة بناء", "Building licence"],
  partition_report: ["محضر فرز", "Partition report"],
  plan_architectural: ["مخطط معماري", "Architectural plan"],
  plan_structural: ["مخطط إنشائي", "Structural plan"],
  plan_electrical: ["مخطط كهربائي", "Electrical plan"],
  plan_mechanical: ["مخطط ميكانيكي/صحي", "Mechanical/plumbing plan"],
  contract: ["عقد", "Contract"],
  water_invoice: ["فاتورة مياه", "Water invoice"],
  electricity_invoice: ["فاتورة كهرباء", "Electricity invoice"],
  other_utility_invoice: ["فاتورة خدمات أخرى", "Other utility invoice"],
  payment_receipt: ["إيصال سداد", "Payment receipt"],
  national_address: ["عنوان وطني", "National address"],
  identity: ["هوية / سجل تجاري", "ID / commercial register"],
  engineering_report: ["تقرير هندسي", "Engineering report"],
  certificate: ["شهادة", "Certificate"],
  site_photo: ["صورة موقع", "Site photo"],
  unknown: ["مستند غير معروف", "Unknown document"],
};

export type ExtractionMethod = "embedded_xml" | "pdf_text" | "qr" | "ocr" | "manual";

export const METHOD_LABELS: Record<ExtractionMethod, [string, string]> = {
  embedded_xml: ["XML مضمّن", "Embedded XML"],
  pdf_text: ["نص PDF", "PDF text"],
  qr: ["QR / باركود", "QR / barcode"],
  ocr: ["OCR محلي", "Local OCR"],
  manual: ["إدخال يدوي", "Manual"],
};

export type MatchState =
  | "match"
  | "close"
  | "different"
  | "missing_in_project"
  | "missing_in_document"
  | "needs_review";

export const MATCH_LABELS: Record<MatchState, [string, string]> = {
  match: ["مطابق", "Match"],
  close: ["متقارب", "Close"],
  different: ["مختلف", "Different"],
  missing_in_project: ["غير موجود في المشروع", "Missing in project"],
  missing_in_document: ["غير موجود في المستند", "Missing in document"],
  needs_review: ["يحتاج مراجعة", "Needs review"],
};

export interface ExtractedField {
  field_key: string;
  field_label: string;
  extracted_value: string;
  normalized_value: string | null;
  original_text: string;
  page_number: number;
  extraction_method: ExtractionMethod;
  confidence: number;
  is_sensitive: boolean;
}

export interface QrFinding {
  page: number;
  format: string;
  text: string;
  url: string | null;
  decoded: Record<string, string> | null;
}

export interface AnalyzeResult {
  documentType: DocType;
  pageCount: number;
  language: "ar" | "en" | "mixed";
  method: ExtractionMethod;
  rawText: string;
  fields: ExtractedField[];
  qr: QrFinding[];
  quick: boolean;
}

export type ProgressStage =
  | "preparing"
  | "extracting_text"
  | "ocr"
  | "extracting_fields"
  | "ready_for_review";

export const STAGE_LABELS: Record<ProgressStage, [string, string]> = {
  preparing: ["جارٍ التحضير", "Preparing"],
  extracting_text: ["جارٍ استخراج النص", "Extracting text"],
  ocr: ["جارٍ تنفيذ OCR", "Running OCR"],
  extracting_fields: ["جارٍ استخراج الحقول", "Extracting fields"],
  ready_for_review: ["جاهز للمراجعة", "Ready for review"],
};

export const ANALYSIS_STATUS_LABELS: Record<string, [string, string]> = {
  pending: ["بانتظار التحليل", "Pending"],
  preparing: ["جارٍ التحضير", "Preparing"],
  extracting_text: ["جارٍ استخراج النص", "Extracting text"],
  ocr: ["جارٍ تنفيذ OCR", "Running OCR"],
  extracting_fields: ["جارٍ استخراج الحقول", "Extracting fields"],
  ready_for_review: ["جاهز للمراجعة", "Ready for review"],
  partially_reviewed: ["تمت المراجعة جزئيًا", "Partially reviewed"],
  reviewed: ["تمت المراجعة", "Reviewed"],
  applied: ["تم تطبيق القيم", "Applied"],
  failed: ["فشل التحليل", "Failed"],
  cancelled: ["أُلغي بواسطة المستخدم", "Cancelled"],
};

/* ------------------------------------------------------- normalization */

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const HI_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Arabic-Indic / Persian digits -> western 0-9. Keeps everything else as is. */
export function toWesternDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (ch) => {
    const a = AR_DIGITS.indexOf(ch);
    if (a >= 0) return String(a);
    return String(HI_DIGITS.indexOf(ch));
  });
}

export function cleanSpaces(input: string): string {
  return input.replace(/[\u200e\u200f\u202a-\u202e]/g, "").replace(/\s+/g, " ").trim();
}

/** DD/MM/YYYY only when the calendar can be told apart with confidence. */
export function normalizeDate(raw: string): { value: string | null; calendar: "hijri" | "gregorian" | "unknown" } {
  const text = toWesternDigits(raw);
  const m = /(\d{1,4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,4})/.exec(text);
  if (!m) return { value: null, calendar: "unknown" };
  let [, a, b, c] = m as unknown as [string, string, string, string];
  let year = Number(c.length === 4 ? c : a);
  const day = Number(c.length === 4 ? a : c);
  const month = Number(b);
  if (!year || !month || month > 12 || !day || day > 31) return { value: null, calendar: "unknown" };
  const hijriHint = /هـ|هجري/.test(raw);
  const gregHint = /م\b|ميلادي/.test(raw);
  const calendar: "hijri" | "gregorian" | "unknown" =
    hijriHint || (year >= 1300 && year <= 1500)
      ? "hijri"
      : gregHint || (year >= 1900 && year <= 2200)
        ? "gregorian"
        : "unknown";
  if (calendar === "unknown") return { value: null, calendar };
  if (calendar === "hijri") {
    // Approximate Umm al-Qura conversion is not reliable enough to auto-apply.
    return { value: null, calendar };
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  void a;
  void b;
  return { value: `${year}-${pad(month)}-${pad(day)}`, calendar };
}

export function normalizeNumber(raw: string): string | null {
  const text = toWesternDigits(raw).replace(/[,،]/g, "").replace(/[^\d.]/g, "");
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? String(n) : null;
}

/* ------------------------------------------------------- classification */

const TYPE_HINTS: [DocType, RegExp, number][] = [
  ["deed", /صك\s*(ملكية|إلكتروني)|وثيقة\s*ملكية|رقم\s*الصك/, 0.9],
  ["registry", /السجل\s*العقاري|سجل\s*عقاري/, 0.85],
  ["building_license", /رخصة\s*(بناء|إنشاء)|رقم\s*الرخصة|رخصة\s*البناء/, 0.9],
  ["partition_report", /محضر\s*فرز|فرز\s*وحدات/, 0.9],
  ["plan_architectural", /مخطط\s*معماري|architectural/i, 0.75],
  ["plan_structural", /مخطط\s*إنشائي|structural/i, 0.75],
  ["plan_electrical", /مخطط\s*كهربائي|electrical\s*plan/i, 0.75],
  ["plan_mechanical", /مخطط\s*(ميكانيكي|صحي)|mechanical|plumbing/i, 0.7],
  ["contract", /عقد\s*(مقاولة|بيع|إشراف|توريد|اتفاقية)|هذا\s*العقد/, 0.8],
  ["water_invoice", /(شركة\s*المياه|المياه\s*الوطنية|فاتورة\s*مياه)/, 0.85],
  ["electricity_invoice", /(الشركة\s*السعودية\s*للكهرباء|فاتورة\s*كهرباء|كهرباء)/, 0.8],
  ["payment_receipt", /إيصال\s*سداد|سداد\s*فاتورة|تم\s*السداد/, 0.7],
  ["national_address", /العنوان\s*الوطني|الرقم\s*الإضافي/, 0.7],
  ["identity", /الهوية\s*الوطنية|سجل\s*تجاري|إقامة/, 0.65],
  ["engineering_report", /تقرير\s*(هندسي|فني)/, 0.7],
  ["certificate", /شهادة\s*(إتمام|إشغال|سلامة)/, 0.7],
  ["other_utility_invoice", /فاتورة/, 0.4],
];

export function classify(text: string): { type: DocType; confidence: number } {
  const t = cleanSpaces(toWesternDigits(text));
  if (!t) return { type: "unknown", confidence: 0 };
  let best: { type: DocType; confidence: number } = { type: "unknown", confidence: 0 };
  for (const [type, re, score] of TYPE_HINTS) {
    if (re.test(t) && score > best.confidence) best = { type, confidence: score };
  }
  return best;
}

export function detectLanguage(text: string): "ar" | "en" | "mixed" {
  const ar = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const en = (text.match(/[A-Za-z]/g) ?? []).length;
  if (ar > en * 3) return "ar";
  if (en > ar * 3) return "en";
  return "mixed";
}

/* --------------------------------------------------------- field rules */

type Kind = "text" | "number" | "date";

interface Rule {
  key: string;
  label: [string, string];
  patterns: RegExp[];
  kind?: Kind;
  sensitive?: boolean;
  types?: DocType[];
}

const N = "([^\\n|,؛;]{1,60})";

const RULES: Rule[] = [
  // ---- deed / registry
  { key: "deed.deed_no", label: ["رقم الصك", "Deed no"], patterns: [/رقم\s*الصك\s*[:：]?\s*([\d\u0660-\u0669/\-]{4,30})/], sensitive: true, types: ["deed", "registry"] },
  { key: "deed.registry_property_no", label: ["رقم العقار", "Property no"], patterns: [/رقم\s*العقار\s*[:：]?\s*([\d\u0660-\u0669/\-]{3,30})/], sensitive: true, types: ["deed", "registry"] },
  { key: "deed.copy_no", label: ["رقم النسخة", "Copy no"], patterns: [/رقم\s*النسخة\s*[:：]?\s*([\d\u0660-\u0669]{1,10})/], types: ["deed", "registry"] },
  { key: "deed.issue_date", label: ["تاريخ الإصدار", "Issue date"], patterns: [/تاريخ\s*الإصدار\s*[:：]?\s*([\d\u0660-\u0669/\-.]{6,14}\s*(هـ|م)?)/], kind: "date", types: ["deed", "registry"] },
  { key: "deed.deed_date", label: ["تاريخ الوثيقة", "Deed date"], patterns: [/تاريخ\s*(الصك|الوثيقة)\s*[:：]?\s*([\d\u0660-\u0669/\-.]{6,14}\s*(هـ|م)?)/], kind: "date", types: ["deed", "registry"] },
  { key: "deed.issuer", label: ["جهة الإصدار", "Issuer"], patterns: [new RegExp(`(?:جهة\\s*الإصدار|كتابة\\s*العدل)\\s*[:：]?\\s*${N}`)], types: ["deed", "registry"] },
  { key: "deed.doc_status", label: ["حالة الوثيقة", "Document status"], patterns: [new RegExp(`حالة\\s*(?:الصك|الوثيقة)\\s*[:：]?\\s*${N}`)], types: ["deed", "registry"] },
  { key: "deed.verify_url", label: ["رابط التحقق", "Verification link"], patterns: [/(https?:\/\/[^\s"'<>]{6,200})/], types: ["deed", "registry"] },
  { key: "owner.name", label: ["المالك", "Owner"], patterns: [new RegExp(`(?:اسم\\s*المالك|المالك)\\s*[:：]?\\s*${N}`)], types: ["deed", "registry"] },
  { key: "owner.id_no", label: ["رقم الهوية / السجل", "ID / register no"], patterns: [/(?:رقم\s*الهوية|السجل\s*التجاري|رقم\s*السجل)\s*[:：]?\s*([\d\u0660-\u0669]{7,15})/], sensitive: true },
  { key: "owner.share", label: ["نسبة التملك", "Ownership share"], patterns: [/(?:نسبة\s*التملك|الحصة)\s*[:：]?\s*([\d\u0660-\u0669.]{1,6})\s*%?/], kind: "number" },
  { key: "land.land_area", label: ["مساحة الأرض", "Land area"], patterns: [/(?:مساحة\s*(?:العقار|الأرض)|المساحة)\s*[:：]?\s*([\d\u0660-\u0669.,]{2,15})/], kind: "number", sensitive: true },
  { key: "land.city", label: ["المدينة", "City"], patterns: [new RegExp(`المدينة\\s*[:：]?\\s*${N}`)] },
  { key: "land.district", label: ["الحي", "District"], patterns: [new RegExp(`الحي\\s*[:：]?\\s*${N}`)] },
  { key: "land.plan_no", label: ["رقم المخطط", "Plan no"], patterns: [/رقم\s*المخطط\s*[:：]?\s*([\w\u0660-\u0669/\-]{1,25})/] },
  { key: "land.block_no", label: ["رقم البلك", "Block no"], patterns: [/(?:رقم\s*)?البلك\s*[:：]?\s*([\w\u0660-\u0669/\-]{1,15})/] },
  { key: "land.parcel_no", label: ["رقم القطعة", "Parcel no"], patterns: [/رقم\s*(?:القطعة|قطعة\s*الأرض)\s*[:：]?\s*([\w\u0660-\u0669/\-]{1,20})/] },
  { key: "land.land_use", label: ["استعمال العقار", "Land use"], patterns: [new RegExp(`(?:استعمال\\s*العقار|الاستخدام)\\s*[:：]?\\s*${N}`)] },
  { key: "land.street_name", label: ["الشارع", "Street"], patterns: [new RegExp(`(?:الشارع|اسم\\s*الشارع)\\s*[:：]?\\s*${N}`)] },
  { key: "land.street_width", label: ["عرض الشارع", "Street width"], patterns: [/عرض\s*الشارع\s*[:：]?\s*([\d\u0660-\u0669.,]{1,8})/], kind: "number" },
  { key: "boundary.north", label: ["الحد الشمالي", "North boundary"], patterns: [new RegExp(`(?:الحد\\s*)?الشمالي\\s*[:：]?\\s*${N}`)] },
  { key: "boundary.south", label: ["الحد الجنوبي", "South boundary"], patterns: [new RegExp(`(?:الحد\\s*)?الجنوبي\\s*[:：]?\\s*${N}`)] },
  { key: "boundary.east", label: ["الحد الشرقي", "East boundary"], patterns: [new RegExp(`(?:الحد\\s*)?الشرقي\\s*[:：]?\\s*${N}`)] },
  { key: "boundary.west", label: ["الحد الغربي", "West boundary"], patterns: [new RegExp(`(?:الحد\\s*)?الغربي\\s*[:：]?\\s*${N}`)] },

  // ---- building licence
  { key: "license.license_no", label: ["رقم الرخصة", "Licence no"], patterns: [/رقم\s*الرخصة\s*[:：]?\s*([\w\u0660-\u0669/\-]{3,30})/], sensitive: true, types: ["building_license"] },
  { key: "license.license_type", label: ["نوع الرخصة", "Licence type"], patterns: [new RegExp(`نوع\\s*الرخصة\\s*[:：]?\\s*${N}`)], types: ["building_license"] },
  { key: "license.request_type", label: ["نوع الطلب", "Request type"], patterns: [new RegExp(`نوع\\s*الطلب\\s*[:：]?\\s*${N}`)], types: ["building_license"] },
  { key: "license.license_status", label: ["حالة الرخصة", "Licence status"], patterns: [new RegExp(`حالة\\s*الرخصة\\s*[:：]?\\s*${N}`)], types: ["building_license"] },
  { key: "license.amanah", label: ["الأمانة", "Amanah"], patterns: [new RegExp(`الأمانة\\s*[:：]?\\s*${N}`)], types: ["building_license"] },
  { key: "license.municipality", label: ["البلدية", "Municipality"], patterns: [new RegExp(`البلدية\\s*[:：]?\\s*${N}`)], types: ["building_license"] },
  { key: "license.issue_date", label: ["تاريخ إصدار الرخصة", "Licence issue date"], patterns: [/تاريخ\s*(?:الإصدار|إصدار\s*الرخصة)\s*[:：]?\s*([\d\u0660-\u0669/\-.]{6,14}\s*(هـ|م)?)/], kind: "date", types: ["building_license"] },
  { key: "license.expiry_date", label: ["تاريخ الانتهاء", "Expiry date"], patterns: [/تاريخ\s*(?:الانتهاء|انتهاء\s*الرخصة)\s*[:：]?\s*([\d\u0660-\u0669/\-.]{6,14}\s*(هـ|م)?)/], kind: "date", types: ["building_license"] },
  { key: "license.holder_name", label: ["صاحب الرخصة", "Licence holder"], patterns: [new RegExp(`(?:صاحب\\s*الرخصة|طالب\\s*الترخيص)\\s*[:：]?\\s*${N}`)], types: ["building_license"] },
  { key: "license.holder_id", label: ["هوية صاحب الرخصة", "Holder ID"], patterns: [/(?:هوية\s*صاحب\s*الرخصة|رقم\s*هوية\s*المالك)\s*[:：]?\s*([\d\u0660-\u0669]{7,15})/], sensitive: true, types: ["building_license"] },
  { key: "license.building_type", label: ["نوع البناء", "Building type"], patterns: [new RegExp(`نوع\\s*البناء\\s*[:：]?\\s*${N}`)], types: ["building_license"] },
  { key: "license.building_use", label: ["استخدام المبنى", "Building use"], patterns: [new RegExp(`(?:استخدام\\s*المبنى|الاستخدام)\\s*[:：]?\\s*${N}`)], types: ["building_license"] },
  { key: "license.built_area", label: ["مساحة البناء", "Built area"], patterns: [/(?:مساحة\s*البناء|إجمالي\s*مساحة\s*البناء)\s*[:：]?\s*([\d\u0660-\u0669.,]{2,15})/], kind: "number", types: ["building_license"] },
  { key: "license.build_ratio", label: ["نسبة البناء", "Build ratio"], patterns: [/نسبة\s*البناء\s*[:：]?\s*([\d\u0660-\u0669.,]{1,8})/], kind: "number", types: ["building_license"] },
  { key: "license.floors_count", label: ["عدد الأدوار", "Floors"], patterns: [/عدد\s*(?:الأدوار|الطوابق)\s*[:：]?\s*([\d\u0660-\u0669]{1,3})/], kind: "number", types: ["building_license"] },
  { key: "license.units_count", label: ["عدد الوحدات", "Units"], patterns: [/عدد\s*الوحدات\s*[:：]?\s*([\d\u0660-\u0669]{1,4})/], kind: "number" },
  { key: "license.design_office", label: ["المكتب الهندسي المصمم", "Design office"], patterns: [new RegExp(`(?:المكتب\\s*الهندسي|المكتب\\s*المصمم)\\s*[:：]?\\s*${N}`)] },
  { key: "license.supervision_office", label: ["مكتب الإشراف", "Supervision office"], patterns: [new RegExp(`(?:مكتب\\s*الإشراف|المكتب\\s*المشرف)\\s*[:：]?\\s*${N}`)] },
  { key: "license.contractor", label: ["المقاول", "Contractor"], patterns: [new RegExp(`المقاول\\s*[:：]?\\s*${N}`)] },
  { key: "license.fees", label: ["الرسوم", "Fees"], patterns: [/الرسوم\s*[:：]?\s*([\d\u0660-\u0669.,]{1,15})/], kind: "number", types: ["building_license"] },
  { key: "license.payment_no", label: ["رقم السداد", "Payment no"], patterns: [/رقم\s*(?:السداد|الفاتورة\s*للسداد)\s*[:：]?\s*([\d\u0660-\u0669]{4,30})/] },
  { key: "license.payment_date", label: ["تاريخ السداد", "Payment date"], patterns: [/تاريخ\s*السداد\s*[:：]?\s*([\d\u0660-\u0669/\-.]{6,14}\s*(هـ|م)?)/], kind: "date" },

  // ---- partition report / units (suggestions only)
  { key: "partition.report_no", label: ["رقم محضر الفرز", "Partition report no"], patterns: [/(?:رقم\s*محضر\s*الفرز|محضر\s*فرز\s*رقم)\s*[:：]?\s*([\w\u0660-\u0669/\-]{1,25})/], types: ["partition_report"] },
  { key: "partition.request_no", label: ["رقم الطلب", "Request no"], patterns: [/رقم\s*الطلب\s*[:：]?\s*([\w\u0660-\u0669/\-]{1,25})/], types: ["partition_report"] },
  { key: "partition.approval_date", label: ["تاريخ الاعتماد", "Approval date"], patterns: [/تاريخ\s*الاعتماد\s*[:：]?\s*([\d\u0660-\u0669/\-.]{6,14}\s*(هـ|م)?)/], kind: "date", types: ["partition_report"] },
  { key: "unit.total_area", label: ["المساحة الإجمالية للوحدة", "Unit total area"], patterns: [/المساحة\s*الإجمالية\s*[:：]?\s*([\d\u0660-\u0669.,]{2,15})/], kind: "number", types: ["partition_report"] },
  { key: "unit.private_area", label: ["المساحة الخاصة", "Private area"], patterns: [/المساحة\s*الخاصة\s*[:：]?\s*([\d\u0660-\u0669.,]{2,15})/], kind: "number", types: ["partition_report"] },
  { key: "unit.shared_area", label: ["المساحة المشتركة", "Shared area"], patterns: [/المساحة\s*المشتركة\s*[:：]?\s*([\d\u0660-\u0669.,]{2,15})/], kind: "number", types: ["partition_report"] },

  // ---- contract (informational only, no legal interpretation)
  { key: "contract.contract_no", label: ["رقم العقد", "Contract no"], patterns: [/رقم\s*العقد\s*[:：]?\s*([\w\u0660-\u0669/\-]{1,30})/], types: ["contract"] },
  { key: "contract.contract_type", label: ["نوع العقد", "Contract type"], patterns: [new RegExp(`نوع\\s*العقد\\s*[:：]?\\s*${N}`)], types: ["contract"] },
  { key: "contract.contract_date", label: ["تاريخ العقد", "Contract date"], patterns: [/تاريخ\s*العقد\s*[:：]?\s*([\d\u0660-\u0669/\-.]{6,14}\s*(هـ|م)?)/], kind: "date", types: ["contract"] },
  { key: "contract.value", label: ["قيمة العقد", "Contract value"], patterns: [/(?:قيمة\s*العقد|إجمالي\s*قيمة\s*العقد)\s*[:：]?\s*([\d\u0660-\u0669.,]{2,18})/], kind: "number", types: ["contract"] },
  { key: "contract.duration", label: ["مدة العقد", "Duration"], patterns: [new RegExp(`مدة\\s*العقد\\s*[:：]?\\s*${N}`)], types: ["contract"] },

  // ---- plans: title block text only
  { key: "plan.project_name", label: ["اسم المشروع", "Project name"], patterns: [new RegExp(`(?:اسم\\s*المشروع|PROJECT)\\s*[:：]?\\s*${N}`, "i")] },
  { key: "plan.plan_no", label: ["رقم المخطط", "Drawing no"], patterns: [/(?:رقم\s*اللوحة|DRAWING\s*NO|SHEET\s*NO)\s*[:：]?\s*([\w\u0660-\u0669/\-]{1,25})/i] },
  { key: "plan.revision", label: ["رقم الإصدار", "Revision"], patterns: [/(?:رقم\s*الإصدار|REV(?:ISION)?)\s*[:：]?\s*([\w\u0660-\u0669/\-]{1,12})/i] },
  { key: "plan.scale", label: ["المقياس", "Scale"], patterns: [/(?:المقياس|SCALE)\s*[:：]?\s*([\w\u0660-\u0669:/\s]{1,15})/i] },
  { key: "plan.engineer", label: ["المهندس", "Engineer"], patterns: [new RegExp(`(?:المهندس|ENGINEER)\\s*[:：]?\\s*${N}`, "i")] },

  // ---- utility invoices
  { key: "service.provider", label: ["اسم الجهة", "Provider"], patterns: [new RegExp(`(?:شركة|مقدم\\s*الخدمة)\\s*[:：]?\\s*${N}`)] },
  { key: "service.account_no", label: ["رقم الحساب", "Account no"], patterns: [/رقم\s*(?:الحساب|حساب\s*الخدمة)\s*[:：]?\s*([\d\u0660-\u0669\-]{4,30})/], sensitive: true },
  { key: "service.meter_no", label: ["رقم العداد", "Meter no"], patterns: [/رقم\s*العداد\s*[:：]?\s*([\w\u0660-\u0669\-]{3,30})/], sensitive: true },
  { key: "service.subscription_no", label: ["رقم الاشتراك", "Subscription no"], patterns: [/رقم\s*الاشتراك\s*[:：]?\s*([\d\u0660-\u0669\-]{3,30})/] },
  { key: "service.invoice_no", label: ["رقم الفاتورة", "Invoice no"], patterns: [/رقم\s*الفاتورة\s*[:：]?\s*([\w\u0660-\u0669\-]{3,30})/] },
  { key: "service.invoice_date", label: ["تاريخ الفاتورة", "Invoice date"], patterns: [/تاريخ\s*الفاتورة\s*[:：]?\s*([\d\u0660-\u0669/\-.]{6,14}\s*(هـ|م)?)/], kind: "date" },
  { key: "service.period", label: ["فترة الفاتورة", "Billing period"], patterns: [new RegExp(`(?:فترة\\s*الفاتورة|الفترة)\\s*[:：]?\\s*${N}`)] },
  { key: "service.amount", label: ["المبلغ", "Amount"], patterns: [/(?:المبلغ\s*الإجمالي|الإجمالي|المبلغ)\s*[:：]?\s*([\d\u0660-\u0669.,]{1,15})/], kind: "number" },
  { key: "service.tax", label: ["الضريبة", "VAT"], patterns: [/(?:ضريبة\s*القيمة\s*المضافة|الضريبة)\s*[:：]?\s*([\d\u0660-\u0669.,]{1,15})/], kind: "number" },
  { key: "service.due_date", label: ["تاريخ الاستحقاق", "Due date"], patterns: [/تاريخ\s*الاستحقاق\s*[:：]?\s*([\d\u0660-\u0669/\-.]{6,14}\s*(هـ|م)?)/], kind: "date" },
  { key: "service.address", label: ["عنوان الخدمة", "Service address"], patterns: [new RegExp(`(?:عنوان\\s*الخدمة|العنوان)\\s*[:：]?\\s*${N}`)] },
  { key: "service.payment_no", label: ["رقم السداد", "SADAD no"], patterns: [/(?:رقم\s*السداد|فاتورة\s*سداد)\s*[:：]?\s*([\d\u0660-\u0669]{4,30})/] },
];

/** Fields that always require an explicit review, whatever the confidence is. */
export const SENSITIVE_FIELD_KEYS = RULES.filter((r) => r.sensitive).map((r) => r.key);

function methodConfidence(method: ExtractionMethod): number {
  if (method === "embedded_xml") return 0.95;
  if (method === "qr") return 0.9;
  if (method === "pdf_text") return 0.75;
  if (method === "manual") return 1;
  return 0.5; // OCR
}

export function confidenceBand(value: number | null | undefined): "high" | "medium" | "low" {
  const v = Number(value ?? 0);
  if (v >= 0.8) return "high";
  if (v >= 0.55) return "medium";
  return "low";
}

export const CONFIDENCE_LABELS: Record<"high" | "medium" | "low", [string, string]> = {
  high: ["عالية", "High"],
  medium: ["متوسطة", "Medium"],
  low: ["منخفضة", "Low"],
};

/**
 * Applies the local rule set to page text. Never throws — an empty result means
 * "could not extract automatically", not "bad document".
 */
export function extractFields(
  pages: { page: number; text: string; method: ExtractionMethod }[],
  docType: DocType,
): ExtractedField[] {
  const out = new Map<string, ExtractedField>();
  for (const page of pages) {
    const text = cleanSpaces(page.text);
    if (!text) continue;
    for (const rule of RULES) {
      if (rule.types && !rule.types.includes(docType)) continue;
      if (out.has(rule.key)) continue;
      for (const pattern of rule.patterns) {
        const m = pattern.exec(text);
        if (!m) continue;
        const captured = (m[m.length - 1] ?? m[1] ?? "").trim();
        const value = cleanSpaces(toWesternDigits(captured));
        if (!value || value.length < 1) continue;
        let normalized: string | null = value;
        let penalty = 0;
        if (rule.kind === "date") {
          normalized = normalizeDate(captured).value;
          if (!normalized) penalty = 0.15;
        } else if (rule.kind === "number") {
          normalized = normalizeNumber(captured);
          if (!normalized) penalty = 0.15;
        }
        const start = Math.max(0, m.index - 20);
        out.set(rule.key, {
          field_key: rule.key,
          field_label: rule.label[0],
          extracted_value: value,
          normalized_value: normalized,
          original_text: text.slice(start, Math.min(text.length, m.index + m[0].length + 20)),
          page_number: page.page,
          extraction_method: page.method,
          confidence: Math.max(0.2, methodConfidence(page.method) - penalty),
          is_sensitive: !!rule.sensitive,
        });
        break;
      }
    }
  }
  return [...out.values()];
}

/* --------------------------------------------------------- comparison */

/**
 * Measurement-like fields tolerate rounding differences. Identifiers (deed no,
 * licence no, ID no, meter no, counts) must match exactly — a 1% tolerance would
 * silently treat two different deed numbers as identical.
 */
export function allowsNumericTolerance(fieldKey: string): boolean {
  return /(area|amount|tax|fees|ratio|width|share)$/.test(fieldKey);
}

export function compareValue(
  documentValue: string | null,
  projectValue: string | null,
  numericTolerance = false,
): MatchState {
  const a = documentValue ? cleanSpaces(toWesternDigits(documentValue)).toLowerCase() : "";
  const b = projectValue ? cleanSpaces(toWesternDigits(projectValue)).toLowerCase() : "";
  if (!a && !b) return "needs_review";
  if (!a) return "missing_in_document";
  if (!b) return "missing_in_project";
  if (a === b) return "match";
  if (numericTolerance) {
    const na = Number(a.replace(/[^\d.]/g, ""));
    const nb = Number(b.replace(/[^\d.]/g, ""));
    if (Number.isFinite(na) && Number.isFinite(nb) && na > 0 && nb > 0) {
      const diff = Math.abs(na - nb) / Math.max(na, nb);
      if (diff <= 0.01) return "match";
      if (diff <= 0.05) return "close";
      return "different";
    }
  }
  if (/^[\d.]+$/.test(a) && /^[\d.]+$/.test(b)) return "different";
  if (a.includes(b) || b.includes(a)) return "close";
  return "different";
}

/** Conflicts that must be resolved before any bulk apply. */
export const HIGH_SEVERITY_KEYS = [
  "deed.deed_no",
  "deed.registry_property_no",
  "land.plan_no",
  "land.parcel_no",
  "land.land_area",
  "license.license_no",
  "owner.name",
  "owner.id_no",
  "service.meter_no",
];

export function conflictSeverity(fieldKey: string): "low" | "medium" | "high" {
  if (HIGH_SEVERITY_KEYS.includes(fieldKey)) return "high";
  if (fieldKey.startsWith("license.") || fieldKey.startsWith("land.")) return "medium";
  return "low";
}

/** Sensitive values are masked in the UI for users without the sensitive permission. */
export function maskValue(fieldKey: string, value: string | null, allowed: boolean): string {
  if (!value) return "—";
  if (allowed) return value;
  if (!/id_no|holder_id|deed_no|meter_no|account_no/.test(fieldKey)) return value;
  return value.length <= 4 ? value : `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}
