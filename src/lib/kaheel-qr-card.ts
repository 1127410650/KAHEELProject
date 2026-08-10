/**
 * رمز QR لبروفايل المعلن + بطاقة A5 قابلة للطباعة بهوية كَحيل.
 *
 * التوليد كله في المتصفح عبر مكتبة `qrcode` الخفيفة ثم رسم البطاقة على
 * `canvas` بمقاس A5 حقيقي (148×210 مم بدقة 300dpi = 1748×2480px) لتُطبع
 * وتُعلَّق في المكتب. لا خدمة خارجية ولا رفع للصور.
 *
 * ألوان البطاقة قيم رقمية لأن `canvas` لا يقرأ رموز الهوية من CSS —
 * وهي نفس رموز كَحيل المعتمدة، ومصدرها الوحيد هذا الملف.
 */

import QRCode from "qrcode";

import kaheelLogo from "@/assets/kaheel-logo.png";

const BRAND = {
  purple: "#8A4FFF",
  ink: "#1B1230",
  muted: "#6B6480",
  lavender: "#F2F0FA",
  card: "#FFFFFF",
};

const A5 = { width: 1748, height: 2480 };

/** رمز QR شفاف الخلفية كصورة PNG بحجم كبير قابل للطباعة. */
export async function qrDataUrl(url: string, size = 1024): Promise<string> {
  return QRCode.toDataURL(url, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: BRAND.ink, light: "#FFFFFF" },
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface QrCardInput {
  advertiserName: string;
  /** نوع المعلن كما يظهر في البروفايل (مكتب عقاري / فندق / فرد). */
  advertiserType: string;
  city?: string | null;
  url: string;
  /** العبارة أسفل الرمز. */
  callToAction?: string;
}

/** بطاقة A5 كاملة كـ PNG dataURL. */
export async function buildQrCardPng(input: QrCardInput): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = A5.width;
  canvas.height = A5.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  // خلفية لافندر + شريط بنفسجي أعلى
  ctx.fillStyle = BRAND.lavender;
  ctx.fillRect(0, 0, A5.width, A5.height);
  const gradient = ctx.createLinearGradient(0, 0, A5.width, 380);
  gradient.addColorStop(0, BRAND.purple);
  gradient.addColorStop(1, "#B98CFF");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, A5.width, 380);

  // بطاقة بيضاء
  const pad = 110;
  roundedRect(ctx, pad, 270, A5.width - pad * 2, A5.height - 270 - pad, 56);
  ctx.fillStyle = BRAND.card;
  ctx.shadowColor = "rgba(27,18,48,0.14)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.textAlign = "center";
  ctx.direction = "rtl";

  // الشعار
  try {
    const logo = await loadImage(kaheelLogo);
    const logoW = 300;
    const logoH = (logo.height / logo.width) * logoW;
    ctx.drawImage(logo, (A5.width - logoW) / 2, 350, logoW, logoH);
  } catch {
    ctx.fillStyle = BRAND.purple;
    ctx.font = "bold 96px system-ui, sans-serif";
    ctx.fillText("كَحيل", A5.width / 2, 470);
  }

  // اسم المعلن ونوعه
  ctx.fillStyle = BRAND.ink;
  ctx.font = "bold 104px system-ui, sans-serif";
  ctx.fillText(input.advertiserName.slice(0, 28), A5.width / 2, 800);

  ctx.fillStyle = BRAND.muted;
  ctx.font = "600 60px system-ui, sans-serif";
  const sub = [input.advertiserType, input.city ?? ""].filter(Boolean).join(" — ");
  ctx.fillText(sub, A5.width / 2, 890);

  // الرمز
  const qr = await loadImage(await qrDataUrl(input.url, 1100));
  const qrSize = 920;
  const qrX = (A5.width - qrSize) / 2;
  const qrY = 990;
  roundedRect(ctx, qrX - 34, qrY - 34, qrSize + 68, qrSize + 68, 44);
  ctx.strokeStyle = BRAND.purple;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

  // عبارة الدعوة
  ctx.fillStyle = BRAND.purple;
  ctx.font = "bold 82px system-ui, sans-serif";
  ctx.fillText(input.callToAction ?? "امسح للحجز والتقييم", A5.width / 2, qrY + qrSize + 190);

  // الرابط والتذييل
  ctx.fillStyle = BRAND.muted;
  ctx.font = "500 46px system-ui, sans-serif";
  ctx.direction = "ltr";
  ctx.fillText(input.url.replace(/^https?:\/\//, ""), A5.width / 2, qrY + qrSize + 280);
  ctx.direction = "rtl";
  ctx.fillStyle = BRAND.ink;
  ctx.font = "600 52px system-ui, sans-serif";
  ctx.fillText("سوق كَحيل — kaheel.market", A5.width / 2, A5.height - pad - 70);

  return canvas.toDataURL("image/png");
}

/** تنزيل dataURL باسم ملف واضح. */
export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}
