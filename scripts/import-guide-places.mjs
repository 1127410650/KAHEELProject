#!/usr/bin/env node
/**
 * KAHEEL — Syria guide importer.
 *
 * Reads the «الجهات» sheet of كحيل_دليل_سوريا.xlsx and upserts it into
 * public.mkt_guide_places with the service-role key.
 *
 * Hard rule: any row containing a forbidden term in ANY cell is skipped and
 * counted; the database trigger is the second line of the same defence.
 *
 *   node scripts/import-guide-places.mjs /path/to/كحيل_دليل_سوريا.xlsx
 */
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const FORBIDDEN = ["الأسد", "الاسد", "assad"];
const SHEET = "الجهات";
const BATCH = 500;

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/import-guide-places.mjs <xlsx-path>");
  process.exit(1);
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

/** Arabic header → column. Unknown headers are ignored. */
const HEADER_MAP = {
  "معرّف السجل": "source_ref",
  "معرف السجل": "source_ref",
  "الاسم بالعربية": "name_ar",
  "الاسم بالإنجليزية": "name_en",
  القطاع: "sector",
  التصنيف: "category",
  "التصنيف الفرعي": "subcategory",
  المحافظة: "governorate",
  المدينة: "city",
  الحي: "district",
  العنوان: "address",
  "حالة العنوان": "address_status",
  "خط العرض": "latitude",
  "خط الطول": "longitude",
  الإحداثيات: "coords",
  "رابط الخريطة": "map_url",
  "حالة رابط الخريطة": "map_url_status",
  الهاتف: "phone",
  "حالة الهاتف": "phone_status",
  واتساب: "whatsapp",
  "حالة واتساب": "whatsapp_status",
  "رابط واتساب": "whatsapp_link",
  "رابط واتساب برسالة كحيل": "whatsapp_link",
  البريد: "email",
  "البريد الإلكتروني": "email",
  "الموقع الإلكتروني": "website",
  "أوقات الدوام": "opening_hours",
  النجوم: "stars",
  المصدر: "source_label",
  "نوع المصدر": "source_type",
  "تاريخ المصدر": "source_date",
  "حالة التحقق": "verification_status",
  "درجة الاكتمال": "completeness",
  ملاحظات: "notes",
};

const NUMERIC = new Set(["latitude", "longitude", "stars", "completeness"]);

function clean(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function slugify(name, ref, index) {
  const base = String(name ?? "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "place"}-${ref ?? index}`.toLowerCase();
}

function isForbidden(row) {
  const blob = Object.values(row).join(" ").toLowerCase();
  return FORBIDDEN.some((term) => blob.includes(term.toLowerCase()));
}

const workbook = XLSX.read(readFileSync(file), { type: "buffer" });
const sheetName = workbook.SheetNames.includes(SHEET) ? SHEET : workbook.SheetNames[0];
const raw = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let blocked = 0;
const rows = [];

raw.forEach((source, index) => {
  if (isForbidden(source)) {
    blocked += 1;
    return;
  }

  const row = { is_published: true };
  for (const [header, value] of Object.entries(source)) {
    const column = HEADER_MAP[header.trim()];
    if (!column) continue;
    if (column === "coords") {
      const [lat, lng] = String(value).split(/[,\s]+/);
      if (lat && lng) {
        row.latitude = Number(lat);
        row.longitude = Number(lng);
      }
      continue;
    }
    if (NUMERIC.has(column)) {
      const num = Number(String(value).replace(/[^\d.\-]/g, ""));
      row[column] = Number.isFinite(num) ? num : null;
      continue;
    }
    row[column] = clean(value);
  }

  if (!row.name_ar) return;
  if (!row.verification_status) row.verification_status = "unverified";
  row.slug = slugify(row.name_ar, row.source_ref, index);
  rows.push(row);
});

// Slugs must be unique even when two places share a name and lack a ref.
const seen = new Map();
for (const row of rows) {
  const count = (seen.get(row.slug) ?? 0) + 1;
  seen.set(row.slug, count);
  if (count > 1) row.slug = `${row.slug}-${count}`;
}

console.log(
  `sheet "${sheetName}": ${raw.length} rows read, ${rows.length} importable, ${blocked} blocked by the forbidden-term rule.`,
);

let inserted = 0;
for (let start = 0; start < rows.length; start += BATCH) {
  const chunk = rows.slice(start, start + BATCH);
  const { error } = await supabase
    .from("mkt_guide_places")
    .upsert(chunk, { onConflict: "slug" });
  if (error) {
    console.error(`batch at ${start} failed: ${error.message}`);
    process.exit(1);
  }
  inserted += chunk.length;
  console.log(`  upserted ${inserted}/${rows.length}`);
}

console.log(`done — ${inserted} records in mkt_guide_places, ${blocked} skipped.`);
