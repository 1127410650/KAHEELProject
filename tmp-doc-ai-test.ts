import {
  classify,
  compareValue,
  conflictSeverity,
  detectLanguage,
  extractFields,
  maskValue,
  normalizeDate,
  normalizeNumber,
  toWesternDigits,
} from "./src/lib/doc-analysis";

let pass = 0;
const fails: string[] = [];
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) pass += 1;
  else fails.push(`${name} ${extra}`);
  console.log(`${cond ? "PASS" : "FAIL"} :: ${name}${cond ? "" : " :: " + extra}`);
};
const get = (fs: ReturnType<typeof extractFields>, k: string) => fs.find((f) => f.field_key === k);

/* ---- 8/9 deed */
const deedText =
  "TEST-DOC-AI-01 صك ملكية إلكتروني رقم الصك: ٣١٠١٠٢٠٤٥٦٧ رقم العقار: 2233 تاريخ الإصدار: 12/05/2021 م " +
  "اسم المالك: عبدالله الشمري رقم الهوية: 1023456789 مساحة العقار: ١٢٥٠.٥ المدينة: الرياض الحي: العزيزية " +
  "رقم المخطط: 1444/ب رقم القطعة: 45 الشمالي: شارع 15 م";
const deedType = classify(deedText);
ok("08 doc type suggested (deed)", deedType.type === "deed", JSON.stringify(deedType));
const deedFields = extractFields([{ page: 1, text: deedText, method: "pdf_text" }], "deed");
ok("09a deed_no extracted + digits unified", get(deedFields, "deed.deed_no")?.extracted_value === "31010204567", get(deedFields, "deed.deed_no")?.extracted_value);
ok("09b land_area normalized", get(deedFields, "land.land_area")?.normalized_value === "1250.5");
ok("09c owner captured", !!get(deedFields, "owner.name"));
ok("17 original_text kept before normalization", (get(deedFields, "deed.deed_no")?.original_text ?? "").includes("٣١٠١٠٢٠٤٥٦٧"));
ok("23a page + method + confidence present", get(deedFields, "deed.deed_no")?.page_number === 1 && get(deedFields, "deed.deed_no")?.extraction_method === "pdf_text" && (get(deedFields, "deed.deed_no")?.confidence ?? 0) > 0);
ok("36-pre sensitive flagged", get(deedFields, "owner.id_no")?.is_sensitive === true && get(deedFields, "deed.deed_no")?.is_sensitive === true);

/* ---- 10 licence */
const licText =
  "TEST-DOC-AI-03 رخصة بناء رقم الرخصة: BL-99881 نوع الرخصة: إنشاء تاريخ الانتهاء: 01/07/2027 م " +
  "صاحب الرخصة: شركة تحقق مساحة البناء: 2,400.75 عدد الأدوار: 4 الأمانة: أمانة الرياض";
ok("10a licence type", classify(licText).type === "building_license");
const licFields = extractFields([{ page: 2, text: licText, method: "pdf_text" }], "building_license");
ok("10b licence_no", get(licFields, "license.license_no")?.extracted_value === "BL-99881");
ok("10c built_area normalized", get(licFields, "license.built_area")?.normalized_value === "2400.75");
ok("10d expiry date DD/MM/YYYY -> ISO", get(licFields, "license.expiry_date")?.normalized_value === "2027-07-01");
ok("23b page number retained", get(licFields, "license.license_no")?.page_number === 2);

/* ---- 11 partition */
const partText = "TEST-DOC-AI-04 محضر فرز وحدات عدد الوحدات: ١٢ رقم المخطط: 55/د";
ok("11a partition type", classify(partText).type === "partition_report");
const partFields = extractFields([{ page: 1, text: partText, method: "pdf_text" }], "partition_report");
ok("11b units count", get(partFields, "license.units_count")?.normalized_value === "12");

/* ---- 12 contract */
const contractText = "TEST-DOC-AI-05 عقد مقاولة هذا العقد بين الطرفين المقاول: مؤسسة البناء قيمة العقد: 500,000";
ok("12 contract type + contractor", classify(contractText).type === "contract" && !!get(extractFields([{ page: 1, text: contractText, method: "pdf_text" }], "contract"), "license.contractor"));

/* ---- 13 plan title block, no engineering judgement */
const planText = "TEST-DOC-AI-06 مخطط معماري المكتب الهندسي: مكتب الرياض رقم المخطط: A-101 المدينة: الرياض";
const planType = classify(planText);
const planFields = extractFields([{ page: 1, text: planText, method: "pdf_text" }], planType.type);
ok("13a plan type", planType.type === "plan_architectural");
ok("13b title block only, no verdict field", !!get(planFields, "land.plan_no") && !planFields.some((f) => /approved|verdict|compliance|مطابق/i.test(f.field_key)));

/* ---- 14 utility invoice */
const waterText = "TEST-DOC-AI-07 فاتورة مياه شركة المياه الوطنية رقم العداد: 55443322 المبلغ: ١٢٣.٥٠ تاريخ الاستحقاق: 20/03/2026 م رقم السداد: 998877665544";
ok("14a water invoice type", classify(waterText).type === "water_invoice");
const waterFields = extractFields([{ page: 1, text: waterText, method: "pdf_text" }], "water_invoice");
ok("14b meter/amount/sadad", !!get(waterFields, "service.meter_no") && get(waterFields, "service.amount")?.normalized_value === "123.5" && !!get(waterFields, "service.payment_no"));
const elecText = "TEST-DOC-AI-08 فاتورة كهرباء الشركة السعودية للكهرباء رقم الحساب: 1122334455 المبلغ: 890,25";
ok("14c electricity invoice type", classify(elecText).type === "electricity_invoice");
void elecText;

/* ---- 16 digits */
ok("16 arabic + persian digits unified", toWesternDigits("٠١٢٣٤٥٦٧٨٩ ۹۸۷") === "0123456789 987");

/* ---- 18 hijri/gregorian */
ok("18a hijri detected, not converted", (() => { const r = normalizeDate("14/11/1445 هـ"); return r.calendar === "hijri" && r.value === null; })());
ok("18b gregorian normalized", normalizeDate("05/02/2026 م").value === "2026-02-05");
ok("18c ambiguous year left unresolved", (() => { const r = normalizeDate("05/02/26"); return r.calendar === "unknown" && r.value === null; })());
ok("16b number normalization", normalizeNumber("١,٢٥٠.٧٥") === "1250.75");
ok("43-pre language detection", detectLanguage("صك ملكية") === "ar" && detectLanguage("Title deed number") === "en");

/* ---- source order: XML > PDF text > OCR */
const orderPages = [
  { page: 1, text: "رقم الصك: 111111 مساحة العقار: 100", method: "embedded_xml" as const },
  { page: 1, text: "رقم الصك: 222222 مساحة العقار: 200", method: "pdf_text" as const },
  { page: 1, text: "رقم الصك: 333333 مساحة العقار: 300", method: "ocr" as const },
];
const ordered = extractFields(orderPages, "deed");
ok("ORDER xml wins over pdf_text and ocr", get(ordered, "deed.deed_no")?.extracted_value === "111111" && get(ordered, "deed.deed_no")?.extraction_method === "embedded_xml");
const ordered2 = extractFields(orderPages.slice(1), "deed");
ok("ORDER pdf_text wins over ocr", get(ordered2, "deed.deed_no")?.extracted_value === "222222" && get(ordered2, "deed.deed_no")?.extraction_method === "pdf_text");
ok("ORDER ocr confidence lower than pdf_text", (get(extractFields([orderPages[2]!], "deed"), "deed.deed_no")?.confidence ?? 1) < (get(ordered2, "deed.deed_no")?.confidence ?? 0));

/* ---- 19-22 comparison + conflicts */
ok("19 compare match/missing", compareValue("31010204567", "31010204567") === "match" && compareValue("123", null) === "missing_in_project");
ok("20 deed no difference detected", compareValue("31010204567", "31010204999") === "different" && conflictSeverity("deed.deed_no") === "high");
ok("21 land area difference detected", compareValue("1250.5", "980") === "different" && conflictSeverity("land.land_area") === "high");
ok("21b close values flagged not silently matched", compareValue("1250", "1210", true) === "close");
ok("22 licence/plan/parcel differences high severity", conflictSeverity("license.license_no") === "high" && conflictSeverity("land.plan_no") === "high" && conflictSeverity("land.parcel_no") === "high");

/* ---- 36 masking helper */
ok("36 mask without permission", maskValue("owner.id_no", "1023456789", false) === "******6789" && maskValue("owner.id_no", "1023456789", true) === "1023456789");

console.log(`\nRESULT ${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log("FAILED:", fails); process.exit(1); }
