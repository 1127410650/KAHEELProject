import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, ClipboardList, FolderKanban, Mail, Repeat2, User, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useAccounts, sortAccounts, type Account } from "@/hooks/use-accounts";

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({
    meta: [
      { title: "حسابي الشخصي — تحقّق | My account — Tahqaq" },
      {
        name: "description",
        content: "لوحة الحساب الشخصي: طلباتك ودعواتك وتنبيهاتك وعهدتك الخاصة دون أي بيانات للشركات.",
      },
      { property: "og:title", content: "حسابي الشخصي — تحقّق" },
      { property: "og:description", content: "Your personal dashboard on Tahqaq." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PersonalDashboard;
});

function PersonalDashboard() {
  return null;
}
