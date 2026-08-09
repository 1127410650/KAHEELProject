/**
 * كتابة حقوق كَحيل داخل بايتات الصورة نفسها (metadata) — بلا مكتبات خارجية.
 *
 * لماذا يدويًا؟ لأن `canvas.toBlob` في المتصفح يمسح كل البيانات الوصفية، وأدوات
 * مثل exiftool لا تعمل داخل المتصفح. لذلك نُدخل حزمة XMP قياسية في الحاوية:
 *
 *  • PNG  → chunk نوع `iTXt` باسم `XML:com.adobe.xmp` + `tEXt` لحقل Copyright.
 *  • WebP → chunk نوع `XMP ` داخل RIFF (مع ترقية الملف إلى الصيغة الموسّعة
 *           VP8X عند الحاجة، والحفاظ على راية الشفافية).
 *  • JPEG → مقطع `APP1` بمساحة أسماء XMP بعد `SOI`.
 *
 * أي صيغة أخرى تُعاد كما هي بلا لمس. الزيادة في الحجم ثابتة (~1KB) ولا تلمس
 * وحدات البكسل، فالشفافية تبقى كما هي.
 */

export interface KaheelCopyrightFields {
  copyright: string;
  author: string;
  description: string;
}

export const KAHEEL_COPYRIGHT: KaheelCopyrightFields = {
  copyright: "© منصة كَحيل — KAHEEL Platform",
  author: "kaheel.market",
  description: "أصل بصري من منصة كَحيل — جميع الحقوق محفوظة",
};

const XMP_NS = "http://ns.adobe.com/xap/1.0/";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** حزمة XMP قياسية تقرأها Photoshop وexiftool وأدوات الأرشفة. */
export function buildXmpPacket(fields: KaheelCopyrightFields = KAHEEL_COPYRIGHT): string {
  const rights = escapeXml(fields.copyright);
  const author = escapeXml(fields.author);
  const description = escapeXml(fields.description);
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/">
   <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${rights}</rdf:li></rdf:Alt></dc:rights>
   <dc:creator><rdf:Seq><rdf:li>${author}</rdf:li></rdf:Seq></dc:creator>
   <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${description}</rdf:li></rdf:Alt></dc:description>
   <xmpRights:Marked>True</xmpRights:Marked>
   <xmpRights:WebStatement>https://kaheel.market/legal/copyright</xmpRights:WebStatement>
   <xmpRights:UsageTerms><rdf:Alt><rdf:li xml:lang="x-default">${rights}</rdf:li></rdf:Alt></xmpRights:UsageTerms>
   <photoshop:Credit>${author}</photoshop:Credit>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

const encoder = new TextEncoder();

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// ── PNG ──────────────────────────────────────────────────────────────────────

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1)
    crc = crcTable[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, payload: Uint8Array): Uint8Array {
  const typeBytes = encoder.encode(type);
  const body = concat([typeBytes, payload]);
  const out = new Uint8Array(body.length + 8);
  const view = new DataView(out.buffer);
  view.setUint32(0, payload.length);
  out.set(body, 4);
  view.setUint32(out.length - 4, crc32(body));
  return out;
}

function pngWithMetadata(bytes: Uint8Array, fields: KaheelCopyrightFields): Uint8Array | null {
  if (bytes.length < 12) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // آخر chunk في PNG هو IEND بطول 0 → 12 بايت.
  const tail = bytes.subarray(bytes.length - 12);
  const tailType = String.fromCharCode(tail[4]!, tail[5]!, tail[6]!, tail[7]!);
  if (tailType !== "IEND") return null;
  void view;

  const text = (keyword: string, value: string) =>
    pngChunk("tEXt", concat([encoder.encode(keyword), new Uint8Array([0]), encoder.encode(value)]));
  // iTXt: keyword \0 compressionFlag compressionMethod language \0 translated \0 text
  const xmp = pngChunk(
    "iTXt",
    concat([
      encoder.encode("XML:com.adobe.xmp"),
      new Uint8Array([0, 0, 0, 0, 0]),
      encoder.encode(buildXmpPacket(fields)),
    ]),
  );

  return concat([
    bytes.subarray(0, bytes.length - 12),
    text("Copyright", fields.copyright),
    text("Author", fields.author),
    text("Description", fields.description),
    xmp,
    bytes.subarray(bytes.length - 12),
  ]);
}

// ── WebP ─────────────────────────────────────────────────────────────────────

function riffChunk(fourcc: string, payload: Uint8Array): Uint8Array {
  const padded = payload.length % 2 === 1;
  const out = new Uint8Array(8 + payload.length + (padded ? 1 : 0));
  out.set(encoder.encode(fourcc), 0);
  new DataView(out.buffer).setUint32(4, payload.length, true);
  out.set(payload, 8);
  return out;
}

function webpWithMetadata(bytes: Uint8Array, fields: KaheelCopyrightFields): Uint8Array | null {
  const tag = (at: number) =>
    String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);
  if (bytes.length < 20 || tag(0) !== "RIFF" || tag(8) !== "WEBP") return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const xmp = riffChunk("XMP ", encoder.encode(buildXmpPacket(fields)));

  const first = tag(12);
  if (first === "VP8X") {
    // موسّع أصلًا: نرفع راية XMP ونُلحق الحزمة في النهاية.
    const out = concat([bytes, xmp]);
    out[20] = out[20]! | 0x04; // flags byte داخل حمولة VP8X
    new DataView(out.buffer).setUint32(4, out.length - 8, true);
    return out;
  }

  // ملف بسيط (VP8/VP8L): نبني حاوية موسّعة حتى يصحّ وجود XMP.
  const bodyLength = view.getUint32(16, true);
  const body = bytes.subarray(12, Math.min(bytes.length, 20 + bodyLength + (bodyLength % 2)));
  let width = 0;
  let height = 0;
  let hasAlpha = false;
  if (first === "VP8L") {
    const b = 21; // بعد fourcc(4)+size(4)+signature(1) داخل الحمولة
    const bits =
      bytes[b]! | (bytes[b + 1]! << 8) | (bytes[b + 2]! << 16) | (bytes[b + 3]! << 24);
    width = (bits & 0x3fff) + 1;
    height = ((bits >>> 14) & 0x3fff) + 1;
    hasAlpha = ((bits >>> 28) & 1) === 1;
  } else if (first === "VP8 ") {
    // keyframe header: 3 بايت frame tag + 3 بايت start code + الأبعاد
    const b = 20 + 6;
    width = (bytes[b]! | (bytes[b + 1]! << 8)) & 0x3fff;
    height = (bytes[b + 2]! | (bytes[b + 3]! << 8)) & 0x3fff;
  } else {
    return null;
  }
  if (!width || !height) return null;

  const vp8x = new Uint8Array(10);
  vp8x[0] = 0x04 | (hasAlpha ? 0x10 : 0); // XMP + Alpha
  const w = width - 1;
  const h = height - 1;
  vp8x[4] = w & 0xff;
  vp8x[5] = (w >>> 8) & 0xff;
  vp8x[6] = (w >>> 16) & 0xff;
  vp8x[7] = h & 0xff;
  vp8x[8] = (h >>> 8) & 0xff;
  vp8x[9] = (h >>> 16) & 0xff;

  const header = new Uint8Array(12);
  header.set(encoder.encode("RIFF"), 0);
  header.set(encoder.encode("WEBP"), 8);
  const out = concat([header, riffChunk("VP8X", vp8x), body, xmp]);
  new DataView(out.buffer).setUint32(4, out.length - 8, true);
  return out;
}

// ── JPEG ─────────────────────────────────────────────────────────────────────

function jpegWithMetadata(bytes: Uint8Array, fields: KaheelCopyrightFields): Uint8Array | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const payload = concat([
    encoder.encode(XMP_NS),
    new Uint8Array([0]),
    encoder.encode(buildXmpPacket(fields)),
  ]);
  if (payload.length + 2 > 0xffff) return null;
  const segment = new Uint8Array(payload.length + 4);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment[2] = ((payload.length + 2) >>> 8) & 0xff;
  segment[3] = (payload.length + 2) & 0xff;
  segment.set(payload, 4);
  return concat([bytes.subarray(0, 2), segment, bytes.subarray(2)]);
}

/**
 * يكتب حقوق كَحيل في بايتات الصورة. يُعيد نفس المدخل بلا تغيير إن كانت الصيغة
 * غير مدعومة أو فشل التحليل — فلا يخرب أصلًا أبدًا.
 */
export async function embedKaheelCopyright(
  blob: Blob,
  fields: KaheelCopyrightFields = KAHEEL_COPYRIGHT,
): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let out: Uint8Array | null = null;
  try {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) out = pngWithMetadata(bytes, fields);
    else if (bytes[0] === 0x52 && bytes[1] === 0x49) out = webpWithMetadata(bytes, fields);
    else if (bytes[0] === 0xff && bytes[1] === 0xd8) out = jpegWithMetadata(bytes, fields);
  } catch {
    out = null;
  }
  if (!out) return blob;
  return new Blob([out as unknown as BlobPart], { type: blob.type });
}
