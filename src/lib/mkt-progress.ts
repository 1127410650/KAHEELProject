/**
 * خطوات التحفيز الموحّدة («كمّل ملفك التجاري» / «فعّل صفحتك» / «أضف أول إعلان»).
 *
 * مصدر واحد لكل الصفحات حتى يبقى شريط التقدّم في الطبقة السابعة متطابقًا في كل
 * مكان. الاستعلام واحد وخفيف (عدّ فقط، بلا صفوف) ومخزّن خمس دقائق، ولا يظهر
 * الشريط أصلًا للزائر غير المسجّل — فلا شبكة ولا فراغ ولا هزّة.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useActiveAccount } from "@/lib/mkt-account";
import { useSession } from "@/lib/session";
import type { ProgressStep } from "@/components/marketplace/layout/PageStack";

export function useKaheelProgressSteps(): ProgressStep[] {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { session } = useSession();
  const { account } = useActiveAccount();
  const tenantId = account?.tenant_id ?? null;

  const counts = useQuery({
    queryKey: ["mkt", "progress-steps", account?.account_key ?? null],
    enabled: !!session && !!account,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const listings = await supabase
        .from("mkt_listings")
        .select("id", { count: "exact", head: true });
      const stores = await supabase
        .from("mkt_storefronts")
        .select("id", { count: "exact", head: true });
      return { listings: listings.count ?? 0, stores: stores.count ?? 0 };
    },
  });

  if (!session || !account) return [];

  const listings = counts.data?.listings ?? 0;
  const stores = counts.data?.stores ?? 0;

  return [
    {
      key: "business",
      label: ar ? "كمّل ملفك التجاري وبتوصلك هدية 🎁" : "Complete your business profile for a gift 🎁",
      href: tenantId ? "/business" : "/market-setup",
      done: !!tenantId,
    },
    {
      key: "store",
      label: ar ? "فعّل صفحتك وخلّي الناس يشوفوك" : "Activate your page so people find you",
      href: "/dashboard/store",
      done: stores > 0,
    },
    {
      key: "listing",
      label: ar ? "أضف أول إعلان — دقيقة وبتخلص" : "Add your first listing — takes a minute",
      href: "/my/listings",
      done: listings > 0,
    },
  ];
}
