import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Check,
  Link2,
  Loader2,
  Network,
  Pause,
  PlugZap,
  Search,
  Store,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/marketplace/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { useActiveAccount } from "@/lib/mkt-account";
import {
  providerNetworkError,
  requestProviderRelation,
  respondProviderRelation,
  saveExternalIntegration,
  saveProviderProfile,
  useExternalIntegrations,
  useIntegrationCatalog,
  useProviderCategories,
  useProviderDirectory,
  useProviderProfile,
  useProviderRelations,
  type ProviderCapability,
  type ProviderDirectoryItem,
  type ProviderRelation,
  type ProviderRelationType,
} from "@/lib/mkt-provider-network";

export const Route = createFileRoute("/business/partners")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "حساب المتجر وشبكة مقدمي الخدمة — كَحيل" },
      {
        name: "description",
        content: "حدد فئة المتجر واربطه بمقدمي الخدمات والتكاملات الخارجية.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProviderNetworkPage,
});

const CAPABILITY_LABELS: Record<ProviderCapability, [string, string]> = {
  "catalog.products": ["منتجات", "Products"],
  "catalog.services": ["خدمات", "Services"],
  "orders.receive": ["استقبال طلبات", "Receive orders"],
  "bookings.receive": ["حجز مواعيد", "Bookings"],
  "delivery.request": ["طلب ناقلين", "Request carriers"],
  "delivery.provide": ["تقديم نقل", "Provide delivery"],
  "jobs.receive": ["استقبال مهام", "Receive jobs"],
  "quotes.receive": ["عروض أسعار", "Quotes"],
  "listings.publish": ["نشر إعلانات", "Publish listings"],
  "relationships.manage": ["شبكة شركاء", "Partner network"],
  "integrations.manage": ["تكامل خارجي", "Integrations"],
};

const RELATION_LABELS: Record<ProviderRelationType, [string, string]> = {
  delivery_partner: ["شريك نقل وتوصيل", "Delivery partner"],
  supplier: ["مورد", "Supplier"],
  subcontractor: ["مقاول فرعي", "Subcontractor"],
  service_partner: ["شريك خدمات", "Service partner"],
  referral_partner: ["شريك إحالات", "Referral partner"],
  integration_partner: ["شريك تكامل", "Integration partner"],
};

function suggestedRelation(provider: ProviderDirectoryItem): ProviderRelationType {
  if (["shipping_company", "courier"].includes(provider.category_code)) return "delivery_partner";
  if (["supplier", "factory", "warehouse"].includes(provider.category_code)) return "supplier";
  return "service_partner";
}

function ProviderNetworkPage() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const { account } = useActiveAccount();
  const accountKey = account?.account_key ?? null;
  const categories = useProviderCategories();
  const profile = useProviderProfile(accountKey);
  const relations = useProviderRelations(accountKey, !!profile.data);
  const integrationCatalog = useIntegrationCatalog(!!profile.data);
  const integrations = useExternalIntegrations(accountKey, !!profile.data);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const directory = useProviderDirectory(query, categoryFilter);
  const [categoryCode, setCategoryCode] = useState("marketplace_seller");
  const [headlineAr, setHeadlineAr] = useState("");
  const [headlineEn, setHeadlineEn] = useState("");
  const [acceptsPartners, setAcceptsPartners] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [connectorCode, setConnectorCode] = useState("");
  const [connectorName, setConnectorName] = useState("");
  const [connectorDirection, setConnectorDirection] = useState<
    "inbound" | "outbound" | "bidirectional"
  >("outbound");

  useEffect(() => {
    const current = profile.data?.profile;
    if (!current) return;
    setCategoryCode(current.category_code);
    setHeadlineAr(current.headline_ar ?? "");
    setHeadlineEn(current.headline_en ?? "");
    setAcceptsPartners(current.accepts_partner_requests);
  }, [profile.data]);

  useEffect(() => {
    const first = integrationCatalog.data?.[0];
    if (!connectorCode && first) {
      setConnectorCode(first.code);
      setConnectorDirection(first.supported_directions[0] ?? "outbound");
    }
  }, [connectorCode, integrationCatalog.data]);

  const visibleProviders = useMemo(
    () => (directory.data ?? []).filter((row) => row.storefront_id !== profile.data?.storefront_id),
    [directory.data, profile.data?.storefront_id],
  );

  async function saveAccountType() {
    if (!accountKey) return;
    setBusy("profile");
    try {
      await saveProviderProfile({
        accountKey,
        categoryCode,
        headlineAr,
        headlineEn,
        acceptsPartnerRequests: acceptsPartners,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mkt", "provider-profile", accountKey] }),
        queryClient.invalidateQueries({ queryKey: ["mkt", "my-storefront", accountKey] }),
        queryClient.invalidateQueries({ queryKey: ["mkt", "store-overview", accountKey] }),
      ]);
      toast.success(locale === "ar" ? "تم حفظ نوع حساب المتجر." : "Store account type saved.");
    } catch (error) {
      toast.error(providerNetworkError(error, locale));
    } finally {
      setBusy(null);
    }
  }

  async function requestLink(provider: ProviderDirectoryItem) {
    if (!accountKey || !profile.data) return;
    const relationType = suggestedRelation(provider);
    setBusy(`provider:${provider.storefront_id}`);
    try {
      await requestProviderRelation({
        accountKey,
        targetStorefrontId: provider.storefront_id,
        relationType,
        scopes:
          relationType === "delivery_partner"
            ? ["deliveries", "status_updates"]
            : relationType === "supplier"
              ? ["catalog", "quotes"]
              : ["bookings", "quotes"],
      });
      await queryClient.invalidateQueries({ queryKey: ["mkt", "provider-relations", accountKey] });
      toast.success(locale === "ar" ? "أُرسل طلب الربط." : "Link request sent.");
    } catch (error) {
      toast.error(providerNetworkError(error, locale));
    } finally {
      setBusy(null);
    }
  }

  async function actOnRelation(
    relation: ProviderRelation,
    action: "accept" | "reject" | "pause" | "resume" | "end",
  ) {
    if (!accountKey) return;
    setBusy(`relation:${relation.id}`);
    try {
      await respondProviderRelation({ accountKey, relationId: relation.id, action });
      await queryClient.invalidateQueries({ queryKey: ["mkt", "provider-relations", accountKey] });
    } catch (error) {
      toast.error(providerNetworkError(error, locale));
    } finally {
      setBusy(null);
    }
  }

  async function addIntegration() {
    if (!accountKey || !connectorCode || !connectorName.trim()) return;
    setBusy("integration");
    try {
      await saveExternalIntegration({
        accountKey,
        integrationCode: connectorCode,
        displayName: connectorName,
        direction: connectorDirection,
      });
      setConnectorName("");
      await queryClient.invalidateQueries({
        queryKey: ["mkt", "external-integrations", accountKey],
      });
      toast.success(
        locale === "ar"
          ? "حُفظ موصل التكامل كمسودة آمنة."
          : "Integration connector saved as a secure draft.",
      );
    } catch (error) {
      toast.error(providerNetworkError(error, locale));
    } finally {
      setBusy(null);
    }
  }

  if (categories.isLoading || profile.isLoading) {
    return (
      <DashboardShell title={locale === "ar" ? "حساب المتجر والشبكة" : "Store account & network"}>
        <div className="space-y-3">
          <Skeleton className="h-40 rounded-[var(--r-card)]" />
          <Skeleton className="h-80 rounded-[var(--r-card)]" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={locale === "ar" ? "حساب المتجر والشبكة" : "Store account & network"}>
      <Tabs defaultValue="account" className="space-y-5">
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-[var(--r-card)] p-1">
          <TabsTrigger value="account" className="shrink-0">
            <Store className="me-1 size-4" />
            {locale === "ar" ? "نوع الحساب" : "Account type"}
          </TabsTrigger>
          <TabsTrigger value="network" className="shrink-0">
            <Network className="me-1 size-4" />
            {locale === "ar" ? "شبكة الشركاء" : "Partner network"}
          </TabsTrigger>
          <TabsTrigger value="integrations" className="shrink-0">
            <PlugZap className="me-1 size-4" />
            {locale === "ar" ? "التكامل الخارجي" : "Integrations"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-4">
          <Card className="overflow-hidden rounded-[var(--r-card)]">
            <CardHeader className="bg-gradient-to-br from-market-navy to-primary-deep text-white">
              <CardTitle className="flex items-center gap-2">
                <Boxes className="size-5 text-primary-foreground/75" />
                {locale === "ar" ? "فئة حساب المتجر" : "Store account category"}
              </CardTitle>
              <p className="text-sm leading-6 text-white/70">
                {locale === "ar"
                  ? "الفئة تحدد الوظائف المناسبة للحساب، مع بقاء متجر واحد وهوية واحدة وبيانات معزولة."
                  : "The category enables the right capabilities while keeping one store identity and isolated data."}
              </p>
            </CardHeader>
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="provider-category">
                    {locale === "ar" ? "نوع النشاط التشغيلي" : "Operating category"}
                  </Label>
                  <select
                    id="provider-category"
                    value={categoryCode}
                    onChange={(event) => setCategoryCode(event.target.value)}
                    className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {(categories.data ?? []).map((row) => (
                      <option key={row.code} value={row.code}>
                        {locale === "ar" ? row.name_ar : row.name_en}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="headline-ar">
                    {locale === "ar" ? "وصف مختصر" : "Arabic headline"}
                  </Label>
                  <Input
                    id="headline-ar"
                    value={headlineAr}
                    maxLength={160}
                    onChange={(event) => setHeadlineAr(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="headline-en">
                    {locale === "ar" ? "الوصف بالإنجليزية" : "English headline"}
                  </Label>
                  <Input
                    id="headline-en"
                    dir="ltr"
                    value={headlineEn}
                    maxLength={160}
                    onChange={(event) => setHeadlineEn(event.target.value)}
                  />
                </div>
              </div>
              <label className="flex items-center justify-between gap-4 rounded-[var(--r-card)] border p-4 text-sm">
                <span>
                  <span className="block font-bold">
                    {locale === "ar" ? "استقبال طلبات الربط" : "Accept partner requests"}
                  </span>
                  <span className="mt-1 block text-desc text-muted-foreground">
                    {locale === "ar"
                      ? "يمكن لمتاجر أخرى طلب ربط نقل أو توريد أو خدمات دون رؤية بياناتك الخاصة."
                      : "Other stores may request delivery, supply or service links without private-data access."}
                  </span>
                </span>
                <Switch checked={acceptsPartners} onCheckedChange={setAcceptsPartners} />
              </label>
              <Button onClick={() => void saveAccountType()} disabled={busy === "profile"}>
                {busy === "profile" ? <Loader2 className="me-1 size-4 animate-spin" /> : null}
                {profile.data
                  ? locale === "ar"
                    ? "حفظ نوع الحساب"
                    : "Save account type"
                  : locale === "ar"
                    ? "إنشاء حساب المتجر"
                    : "Create store account"}
              </Button>
            </CardContent>
          </Card>

          {profile.data?.category ? (
            <Card className="rounded-[var(--r-card)]">
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-desc text-muted-foreground">
                      {locale === "ar" ? "القدرات المفعلة" : "Enabled capabilities"}
                    </p>
                    <h2 className="mt-1 font-black">
                      {locale === "ar"
                        ? profile.data.category.name_ar
                        : profile.data.category.name_en}
                    </h2>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/business/store">
                      {locale === "ar" ? "فتح مركز المتجر" : "Open store center"}
                    </Link>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.data.category.capabilities.map((capability) => (
                    <Badge key={capability} variant="secondary">
                      {CAPABILITY_LABELS[capability]?.[locale === "ar" ? 0 : 1] ?? capability}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="network" className="space-y-5">
          {!profile.data ? (
            <Card className="rounded-[var(--r-card)] border-dashed">
              <CardContent className="p-8 text-center">
                <Store className="mx-auto size-9 text-primary" />
                <p className="mt-3 font-black">
                  {locale === "ar"
                    ? "حدد نوع حساب المتجر أولًا"
                    : "Choose the store account type first"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="rounded-[var(--r-card)]">
                <CardContent className="space-y-4 p-5">
                  <div>
                    <h2 className="font-black">
                      {locale === "ar" ? "ابحث عن شريك تشغيل" : "Find an operating partner"}
                    </h2>
                    <p className="mt-1 text-desc text-muted-foreground">
                      {locale === "ar"
                        ? "مثال: يربط المتجر شركة شحن، أو يربط المقاول موردًا، بعد قبول الطرف الآخر."
                        : "For example, a store links a carrier or a contractor links a supplier after acceptance."}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        className="ps-9"
                        placeholder={
                          locale === "ar" ? "اسم المتجر أو نوع الخدمة" : "Store or service"
                        }
                      />
                    </div>
                    <select
                      value={categoryFilter ?? ""}
                      onChange={(event) => setCategoryFilter(event.target.value || null)}
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="">{locale === "ar" ? "جميع الفئات" : "All categories"}</option>
                      {(categories.data ?? []).map((row) => (
                        <option key={row.code} value={row.code}>
                          {locale === "ar" ? row.name_ar : row.name_en}
                        </option>
                      ))}
                    </select>
                  </div>
                  {directory.isLoading ? (
                    <Skeleton className="h-32 rounded-[var(--r-card)]" />
                  ) : visibleProviders.length === 0 ? (
                    <p className="rounded-[var(--r-card)] border border-dashed p-6 text-center text-sm text-muted-foreground">
                      {locale === "ar"
                        ? "لا توجد حسابات منشورة مطابقة حاليًا."
                        : "No matching published accounts."}
                    </p>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {visibleProviders.map((provider) => {
                        const relationType = suggestedRelation(provider);
                        return (
                          <div
                            key={provider.storefront_id}
                            className="flex items-center gap-3 rounded-[var(--r-card)] border p-4"
                          >
                            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary">
                              {relationType === "delivery_partner" ? (
                                <Truck className="size-5 text-primary" />
                              ) : (
                                <Store className="size-5 text-primary" />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <Link
                                to="/stores/$slug"
                                params={{ slug: provider.slug }}
                                className="truncate font-black hover:text-primary"
                              >
                                {locale === "ar"
                                  ? provider.name_ar
                                  : provider.name_en || provider.name_ar}
                              </Link>
                              <p className="truncate text-desc text-muted-foreground">
                                {locale === "ar"
                                  ? provider.category_name_ar
                                  : provider.category_name_en}
                                {provider.city_name_ar
                                  ? ` · ${locale === "ar" ? provider.city_name_ar : provider.city_name_en || provider.city_name_ar}`
                                  : ""}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              disabled={busy === `provider:${provider.storefront_id}`}
                              onClick={() => void requestLink(provider)}
                            >
                              {busy === `provider:${provider.storefront_id}` ? (
                                <Loader2 className="me-1 size-4 animate-spin" />
                              ) : (
                                <Link2 className="me-1 size-4" />
                              )}
                              {RELATION_LABELS[relationType][locale === "ar" ? 0 : 1]}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-[var(--r-card)]">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {locale === "ar" ? "طلبات وروابط الشركاء" : "Partner requests and links"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {relations.isLoading ? (
                    <Skeleton className="h-28 rounded-[var(--r-card)]" />
                  ) : (relations.data ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {locale === "ar" ? "لا توجد روابط بعد." : "No provider links yet."}
                    </p>
                  ) : (
                    (relations.data ?? []).map((relation) => (
                      <div
                        key={relation.id}
                        className="flex flex-wrap items-center gap-3 rounded-[var(--r-card)] border p-4"
                      >
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/stores/$slug"
                            params={{ slug: relation.other_store_slug }}
                            className="font-black hover:text-primary"
                          >
                            {relation.other_store_name}
                          </Link>
                          <p className="mt-1 text-desc text-muted-foreground">
                            {RELATION_LABELS[relation.relation_type][locale === "ar" ? 0 : 1]} ·{" "}
                            {relation.direction === "incoming"
                              ? locale === "ar"
                                ? "وارد"
                                : "Incoming"
                              : locale === "ar"
                                ? "صادر"
                                : "Outgoing"}
                          </p>
                        </div>
                        <Badge variant={relation.status === "active" ? "default" : "secondary"}>
                          {relation.status}
                        </Badge>
                        {busy === `relation:${relation.id}` ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : null}
                        {relation.direction === "incoming" && relation.status === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => void actOnRelation(relation, "accept")}
                            >
                              <Check className="me-1 size-4" />
                              {locale === "ar" ? "قبول" : "Accept"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void actOnRelation(relation, "reject")}
                            >
                              <X className="me-1 size-4" />
                              {locale === "ar" ? "رفض" : "Reject"}
                            </Button>
                          </>
                        ) : relation.status === "active" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void actOnRelation(relation, "pause")}
                          >
                            <Pause className="me-1 size-4" />
                            {locale === "ar" ? "إيقاف" : "Pause"}
                          </Button>
                        ) : relation.status === "paused" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void actOnRelation(relation, "resume")}
                          >
                            {locale === "ar" ? "استئناف" : "Resume"}
                          </Button>
                        ) : null}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="integrations" className="space-y-5">
          <Card className="rounded-[var(--r-card)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PlugZap className="size-5 text-primary" />
                {locale === "ar" ? "إضافة تكامل خارجي" : "Add external integration"}
              </CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                {locale === "ar"
                  ? "يحفظ كَحيل تعريف الموصل فقط. المفاتيح وكلمات المرور لا تُكتب هنا وتُربط لاحقًا بخزنة أسرار من الخادم."
                  : "Kaheel stores connector metadata only. Keys and passwords are attached later through a server-side secret vault."}
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="connector-kind">
                  {locale === "ar" ? "نوع التكامل" : "Integration type"}
                </Label>
                <select
                  id="connector-kind"
                  value={connectorCode}
                  onChange={(event) => {
                    const next = event.target.value;
                    setConnectorCode(next);
                    const row = integrationCatalog.data?.find((item) => item.code === next);
                    setConnectorDirection(row?.supported_directions[0] ?? "outbound");
                  }}
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {(integrationCatalog.data ?? []).map((row) => (
                    <option key={row.code} value={row.code}>
                      {locale === "ar" ? row.name_ar : row.name_en}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="connector-name">
                  {locale === "ar" ? "اسم الموصل" : "Connector name"}
                </Label>
                <Input
                  id="connector-name"
                  value={connectorName}
                  maxLength={120}
                  onChange={(event) => setConnectorName(event.target.value)}
                  placeholder={
                    locale === "ar"
                      ? "مثال: شركة الشحن الرئيسية"
                      : "Example: Main shipping provider"
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="connector-direction">
                  {locale === "ar" ? "اتجاه المزامنة" : "Sync direction"}
                </Label>
                <select
                  id="connector-direction"
                  value={connectorDirection}
                  onChange={(event) =>
                    setConnectorDirection(event.target.value as typeof connectorDirection)
                  }
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {(
                    integrationCatalog.data?.find((item) => item.code === connectorCode)
                      ?.supported_directions ?? ["outbound"]
                  ).map((direction) => (
                    <option key={direction} value={direction}>
                      {direction}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Button
                  disabled={!profile.data || !connectorName.trim() || busy === "integration"}
                  onClick={() => void addIntegration()}
                >
                  {busy === "integration" ? <Loader2 className="me-1 size-4 animate-spin" /> : null}
                  {locale === "ar" ? "حفظ الموصل" : "Save connector"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            {(integrations.data ?? []).map((integration) => {
              const catalog = integrationCatalog.data?.find(
                (row) => row.code === integration.integration_code,
              );
              return (
                <Card key={integration.id} className="rounded-[var(--r-card)]">
                  <CardContent className="flex items-start gap-3 p-5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary">
                      <PlugZap className="size-5 text-primary" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black">{integration.display_name}</p>
                      <p className="mt-1 text-desc text-muted-foreground">
                        {catalog
                          ? locale === "ar"
                            ? catalog.name_ar
                            : catalog.name_en
                          : integration.integration_code}
                        {` · ${integration.direction}`}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="secondary">{integration.status}</Badge>
                        <Badge variant="outline">{integration.credentials_state}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {(integrations.data ?? []).length === 0 ? (
            <p className="rounded-[var(--r-card)] border border-dashed p-8 text-center text-sm text-muted-foreground">
              {locale === "ar" ? "لا توجد موصلات خارجية بعد." : "No external connectors yet."}
            </p>
          ) : null}
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}
