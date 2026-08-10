import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { reverseGeocodeImpl, type ReverseGeocodeResult } from "./geo-reverse.server";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  locale: z.enum(["ar", "en"]).default("ar"),
});

/** عام بالكامل: لا يقرأ ولا يكتب أي بيانات مستخدم. */
export const reverseGeocode = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<ReverseGeocodeResult> =>
    reverseGeocodeImpl(data.lat, data.lng, data.locale),
  );
