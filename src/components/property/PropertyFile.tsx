import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { PropertyCard } from "@/components/property/PropertyCard";
import { PropertySection } from "@/components/property/PropertySection";
import { PropertyServices } from "@/components/property/PropertyServices";
import { PropertyDocuments } from "@/components/property/PropertyDocuments";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import {
  BOUNDARY_SIDES,
  PARTITION_PART_TYPES,
  PLAN_TYPES,
  UNIT_STATUSES,
  labelOf,
  maskId,
  pick,
} from "@/lib/property";

const TABS: [string, [string, string]][] = [
  ["overview", ["نظرة عامة", "Overview"]],
  ["land", ["الأرض والموقع", "Land"]],
  ["deed", ["الصك والملكية", "Deed"]],
  ["owners", ["الملاك", "Owners"]],
  ["license", ["رخصة البناء", "License"]],
  ["contracts", ["العقود والأطراف", "Contracts"]],
  ["plans", ["المخططات", "Plans"]],
  ["units", ["الوحدات", "Units"]],
  ["partition", ["محاضر الفرز", "Partition"]],
  ["services", ["الخدمات والعدادات", "Services"]],
  ["documents", ["المستندات", "Documents"]],
  ["boundaries", ["الحدود والإحداثيات", "Boundaries"]],
  ["completion", ["اكتمال الملف", "Completion"]],
];

/** Real-estate project file: 13 tabs over the property tables. */
export function PropertyFile({ projectId }: { projectId: string }) {
  const { locale } = useI18n();
  const { isAccountant, can } = useSession();

  const canEdit = isAccountant || can("property.edit" as never);
  const canApprove = isAccountant || can("property.approve" as never);
  const canUpload = isAccountant || can("property_documents.upload" as never);
  const canManageDocs = isAccountant || can("property_documents.manage" as never);
  const sensitive = isAccountant || can("payment.view_sensitive");

  return (
    <div className="page-safe space-y-3">
      <Tabs defaultValue="overview" className="min-w-0">
        <div className="no-scrollbar w-full max-w-full overflow-x-auto overflow-y-hidden pb-1 lg:overflow-visible">
          <TabsList className="h-auto w-max gap-1 whitespace-nowrap p-1 lg:w-full lg:flex-wrap lg:justify-start">
            {TABS.map(([key, label]) => (
              <TabsTrigger key={key} value={key} className="h-8 w-auto shrink-0 whitespace-nowrap px-2.5 text-xs">
                {pick(locale, label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-3 min-w-0">
          <PropertyCard projectId={projectId} />
        </TabsContent>

        <TabsContent value="land" className="mt-3 min-w-0">
          <PropertySection
            table="property_land"
            projectId={projectId}
            single
            canEdit={canEdit}
            title={["بيانات الأرض والموقع", "Land & location"]}
            fields={[
              { name: "region", label: ["المنطقة", "Region"] },
              { name: "amanah", label: ["الأمانة", "Amanah"] },
              { name: "municipality", label: ["البلدية", "Municipality"] },
              { name: "city", label: ["المدينة", "City"] },
              { name: "district", label: ["الحي", "District"] },
              { name: "plan_no", label: ["رقم المخطط", "Plan no."] },
              { name: "block_no", label: ["رقم البلك", "Block no."] },
              { name: "parcel_no", label: ["رقم القطعة", "Parcel no."] },
              { name: "property_no", label: ["رقم العقار", "Property no."] },
              { name: "land_use", label: ["استخدام الأرض", "Land use"] },
              { name: "land_area", label: ["المساحة (م²)", "Area (m²)"], type: "number" },
              { name: "street_name", label: ["الشارع", "Street"] },
              { name: "street_width", label: ["عرض الشارع", "Street width"], type: "number" },
              { name: "national_address", label: ["العنوان الوطني", "National address"] },
              { name: "postal_code", label: ["الرمز البريدي", "Postal code"] },
              { name: "additional_no", label: ["الرقم الإضافي", "Additional no."] },
              { name: "latitude", label: ["خط العرض", "Latitude"], type: "number" },
              { name: "longitude", label: ["خط الطول", "Longitude"], type: "number" },
              { name: "map_url", label: ["رابط الخريطة", "Map link"], wide: true },
              { name: "notes", label: ["ملاحظات", "Notes"], type: "textarea" },
            ]}
            primary={(r) =>
              `${(r["district"] as string) ?? "—"} · ${(r["plan_no"] as string) ?? "—"}/${
                (r["parcel_no"] as string) ?? "—"
              }`
            }
            secondary={(r) => `${(r["city"] as string) ?? "—"}`}
            details={(r) => [
              { label: locale === "ar" ? "المنطقة" : "Region", value: (r["region"] as string) ?? "—" },
              { label: locale === "ar" ? "الأمانة" : "Amanah", value: (r["amanah"] as string) ?? "—" },
              { label: locale === "ar" ? "البلدية" : "Municipality", value: (r["municipality"] as string) ?? "—" },
              { label: locale === "ar" ? "المساحة (م²)" : "Area (m²)", value: (r["land_area"] as number) ?? "—" },
              { label: locale === "ar" ? "استخدام الأرض" : "Land use", value: (r["land_use"] as string) ?? "—" },
              { label: locale === "ar" ? "العنوان الوطني" : "National address", value: (r["national_address"] as string) ?? "—" },
              { label: locale === "ar" ? "الإحداثيات" : "Coordinates", value: `${(r["latitude"] as number) ?? "—"}, ${(r["longitude"] as number) ?? "—"}` },
              { label: locale === "ar" ? "ملاحظات" : "Notes", value: (r["notes"] as string) ?? "—", hideIfEmpty: true },
            ]}
          />
        </TabsContent>

        <TabsContent value="deed" className="mt-3 min-w-0">
          <PropertySection
            table="property_deeds"
            projectId={projectId}
            canEdit={canEdit}
            canDelete={isAccountant}
            title={["الصكوك ووثائق الملكية", "Deeds & ownership documents"]}
            hint={["الإصدار الجديد يُضاف دون حذف الإصدار السابق.", "A new version never deletes the previous one."]}
            fields={[
              { name: "deed_no", label: ["رقم الصك", "Deed no."], required: true },
              { name: "registry_property_no", label: ["رقم العقار بالسجل", "Registry property no."] },
              { name: "copy_no", label: ["رقم النسخة", "Copy no."] },
              { name: "issuer", label: ["جهة الإصدار", "Issuer"] },
              { name: "deed_date", label: ["تاريخ الصك", "Deed date"], type: "date" },
              { name: "issue_date", label: ["تاريخ الإصدار", "Issue date"], type: "date" },
              { name: "owner_registry_no", label: ["رقم هوية المالك بالسجل", "Owner registry id"] },
              { name: "verify_url", label: ["رابط التحقق", "Verification link"], wide: true },
              { name: "notes", label: ["ملاحظات", "Notes"], type: "textarea" },
            ]}
            primary={(r) => `${locale === "ar" ? "صك" : "Deed"} ${(r["deed_no"] as string) ?? "—"}`}
            secondary={(r) => `v${String(r["version"])} · ${formatDate(r["deed_date"] as string)}`}
            details={(r) => [
              { label: locale === "ar" ? "رقم الصك" : "Deed no.", value: (r["deed_no"] as string) ?? "—" },
              { label: locale === "ar" ? "الإصدار" : "Version", value: String(r["version"]) },
              { label: locale === "ar" ? "الحالة" : "Status", value: String(r["doc_status"]) },
              { label: locale === "ar" ? "جهة الإصدار" : "Issuer", value: (r["issuer"] as string) ?? "—" },
              { label: locale === "ar" ? "تاريخ الصك" : "Deed date", value: formatDate(r["deed_date"] as string) },
              { label: locale === "ar" ? "رابط التحقق" : "Verification", value: (r["verify_url"] as string) ?? "—", hideIfEmpty: true },
            ]}
          />
        </TabsContent>

        <TabsContent value="owners" className="mt-3 min-w-0">
          <PropertySection
            table="property_owners"
            projectId={projectId}
            canEdit={canEdit}
            canDelete={isAccountant}
            title={["الملاك ونسب التملك", "Owners & shares"]}
            hint={["مجموع النسب لا يتجاوز 100%.", "Total shares cannot exceed 100%."]}
            fields={[
              { name: "full_name", label: ["اسم المالك", "Owner name"], required: true },
              { name: "id_type", label: ["نوع الهوية", "Id type"] },
              { name: "id_number", label: ["رقم الهوية", "Id number"] },
              { name: "nationality", label: ["الجنسية", "Nationality"] },
              { name: "share_percent", label: ["نسبة التملك %", "Share %"], type: "number", required: true },
              { name: "ownership_start", label: ["بداية التملك", "Ownership start"], type: "date" },
              { name: "ownership_end", label: ["نهاية التملك", "Ownership end"], type: "date" },
              { name: "purchase_date", label: ["تاريخ الشراء", "Purchase date"], type: "date" },
              { name: "transfer_value", label: ["قيمة الإفراغ", "Transfer value"], type: "number" },
              { name: "notes", label: ["ملاحظات", "Notes"], type: "textarea" },
            ]}
            primary={(r) => String(r["full_name"])}
            secondary={(r) => `${String(r["share_percent"])}%`}
            details={(r) => [
              { label: locale === "ar" ? "نسبة التملك" : "Share", value: `${String(r["share_percent"])}%` },
              {
                label: locale === "ar" ? "رقم الهوية" : "Id number",
                value: sensitive ? ((r["id_number"] as string) ?? "—") : maskId(r["id_number"] as string),
              },
              { label: locale === "ar" ? "الجنسية" : "Nationality", value: (r["nationality"] as string) ?? "—" },
              { label: locale === "ar" ? "بداية التملك" : "Start", value: formatDate(r["ownership_start"] as string) },
              {
                label: locale === "ar" ? "قيمة الإفراغ" : "Transfer value",
                value: sensitive ? ((r["transfer_value"] as number) ?? "—") : "—",
                hideIfEmpty: true,
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="license" className="mt-3 min-w-0">
          <PropertySection
            table="property_licenses"
            projectId={projectId}
            canEdit={canEdit}
            canDelete={isAccountant}
            title={["رخص البناء", "Building licenses"]}
            fields={[
              { name: "license_no", label: ["رقم الرخصة", "License no."], required: true },
              { name: "license_type", label: ["نوع الرخصة", "License type"] },
              { name: "license_status", label: ["حالة الرخصة", "License status"] },
              { name: "municipality", label: ["البلدية", "Municipality"] },
              { name: "issue_date", label: ["تاريخ الإصدار", "Issue date"], type: "date" },
              { name: "expiry_date", label: ["تاريخ الانتهاء", "Expiry date"], type: "date" },
              { name: "building_type", label: ["نوع المبنى", "Building type"] },
              { name: "building_use", label: ["استخدام المبنى", "Building use"] },
              { name: "built_area", label: ["المساحة المبنية", "Built area"], type: "number" },
              { name: "floors_count", label: ["عدد الأدوار", "Floors"], type: "number" },
              { name: "units_count", label: ["عدد الوحدات", "Units"], type: "number" },
              { name: "design_office", label: ["المكتب الهندسي", "Design office"] },
              { name: "supervision_office", label: ["مكتب الإشراف", "Supervision office"] },
              { name: "contractor", label: ["المقاول", "Contractor"] },
              { name: "fees", label: ["الرسوم", "Fees"], type: "number" },
              { name: "payment_no", label: ["رقم السداد", "Payment no."] },
              { name: "conditions", label: ["الشروط", "Conditions"], type: "textarea" },
            ]}
            primary={(r) => `${locale === "ar" ? "رخصة" : "License"} ${(r["license_no"] as string) ?? "—"}`}
            secondary={(r) => formatDate(r["issue_date"] as string)}
            details={(r) => [
              { label: locale === "ar" ? "الحالة" : "Status", value: (r["license_status"] as string) ?? "—" },
              { label: locale === "ar" ? "تاريخ الانتهاء" : "Expiry", value: formatDate(r["expiry_date"] as string) },
              { label: locale === "ar" ? "المساحة المبنية" : "Built area", value: (r["built_area"] as number) ?? "—" },
              { label: locale === "ar" ? "الأدوار / الوحدات" : "Floors / units", value: `${(r["floors_count"] as number) ?? "—"} / ${(r["units_count"] as number) ?? "—"}` },
              { label: locale === "ar" ? "المكتب الهندسي" : "Design office", value: (r["design_office"] as string) ?? "—" },
              { label: locale === "ar" ? "المقاول" : "Contractor", value: (r["contractor"] as string) ?? "—" },
              { label: locale === "ar" ? "رقم السداد" : "Payment no.", value: (r["payment_no"] as string) ?? "—" },
            ]}
          />
        </TabsContent>

        <TabsContent value="contracts" className="mt-3 min-w-0">
          <PropertySection
            table="property_contracts"
            projectId={projectId}
            canEdit={canEdit}
            canDelete={isAccountant}
            title={["العقود والأطراف", "Contracts & parties"]}
            fields={[
              { name: "title", label: ["عنوان العقد", "Contract title"], required: true },
              { name: "contract_no", label: ["رقم العقد", "Contract no."] },
              { name: "contract_type", label: ["نوع العقد", "Contract type"] },
              { name: "contract_date", label: ["تاريخ العقد", "Contract date"], type: "date" },
              { name: "start_date", label: ["تاريخ البداية", "Start date"], type: "date" },
              { name: "end_date", label: ["تاريخ النهاية", "End date"], type: "date" },
              { name: "amount", label: ["قيمة العقد", "Amount"], type: "number" },
              { name: "owner_name", label: ["المالك", "Owner"] },
              { name: "contractor", label: ["المقاول", "Contractor"] },
              { name: "engineering_office", label: ["المكتب الهندسي", "Engineering office"] },
              { name: "supervision_office", label: ["مكتب الإشراف", "Supervision office"] },
              { name: "insurance_company", label: ["شركة التأمين", "Insurance company"] },
              { name: "inspection_body", label: ["جهة الفحص", "Inspection body"] },
              { name: "notes", label: ["ملاحظات", "Notes"], type: "textarea" },
            ]}
            primary={(r) => String(r["title"])}
            secondary={(r) => `${(r["contract_no"] as string) ?? "—"} · v${String(r["version"])}`}
            details={(r) => [
              { label: locale === "ar" ? "نوع العقد" : "Type", value: (r["contract_type"] as string) ?? "—" },
              { label: locale === "ar" ? "التاريخ" : "Date", value: formatDate(r["contract_date"] as string) },
              {
                label: locale === "ar" ? "القيمة" : "Amount",
                value: sensitive ? ((r["amount"] as number) ?? "—") : "—",
                hideIfEmpty: true,
              },
              { label: locale === "ar" ? "المقاول" : "Contractor", value: (r["contractor"] as string) ?? "—" },
              { label: locale === "ar" ? "مكتب الإشراف" : "Supervision", value: (r["supervision_office"] as string) ?? "—" },
            ]}
          />
        </TabsContent>

        <TabsContent value="plans" className="mt-3 min-w-0">
          <PropertySection
            table="property_plans"
            projectId={projectId}
            canEdit={canEdit}
            canDelete={isAccountant}
            title={["المخططات", "Plans"]}
            fields={[
              { name: "name", label: ["اسم المخطط", "Plan name"], required: true },
              { name: "plan_type", label: ["نوع المخطط", "Plan type"], type: "select", options: PLAN_TYPES },
              { name: "plan_no", label: ["رقم المخطط", "Plan no."] },
              { name: "revision_no", label: ["رقم المراجعة", "Revision"] },
              { name: "issue_date", label: ["تاريخ الإصدار", "Issue date"], type: "date" },
              { name: "design_office", label: ["المكتب الهندسي", "Design office"] },
              { name: "notes", label: ["ملاحظات", "Notes"], type: "textarea" },
            ]}
            primary={(r) => String(r["name"])}
            secondary={(r) => `${labelOf(locale, PLAN_TYPES, r["plan_type"] as string)} · v${String(r["version"])}`}
            details={(r) => [
              { label: locale === "ar" ? "النوع" : "Type", value: labelOf(locale, PLAN_TYPES, r["plan_type"] as string) },
              { label: locale === "ar" ? "رقم المخطط" : "Plan no.", value: (r["plan_no"] as string) ?? "—" },
              { label: locale === "ar" ? "تاريخ الإصدار" : "Issue date", value: formatDate(r["issue_date"] as string) },
              { label: locale === "ar" ? "المكتب الهندسي" : "Design office", value: (r["design_office"] as string) ?? "—" },
            ]}
          />
        </TabsContent>

        <TabsContent value="units" className="mt-3 min-w-0">
          <PropertySection
            table="property_units"
            projectId={projectId}
            canEdit={canEdit}
            canDelete={isAccountant}
            title={["الوحدات العقارية", "Property units"]}
            fields={[
              { name: "unit_no", label: ["رقم الوحدة", "Unit no."], required: true },
              { name: "unit_type", label: ["نوع الوحدة", "Unit type"] },
              { name: "floor", label: ["الدور", "Floor"] },
              { name: "orientation", label: ["الاتجاه", "Orientation"] },
              { name: "total_area", label: ["المساحة الكلية", "Total area"], type: "number" },
              { name: "private_area", label: ["المساحة الخاصة", "Private area"], type: "number" },
              { name: "shared_area", label: ["المساحة المشتركة", "Shared area"], type: "number" },
              { name: "land_share_percent", label: ["نسبة حصة الأرض %", "Land share %"], type: "number" },
              { name: "status", label: ["الحالة", "Status"], type: "select", options: UNIT_STATUSES },
              { name: "current_owner", label: ["المالك الحالي", "Current owner"] },
              { name: "notes", label: ["ملاحظات", "Notes"], type: "textarea" },
            ]}
            primary={(r) => `${locale === "ar" ? "وحدة" : "Unit"} ${String(r["unit_no"])}`}
            secondary={(r) => labelOf(locale, UNIT_STATUSES, r["status"] as string)}
            details={(r) => [
              { label: locale === "ar" ? "النوع" : "Type", value: (r["unit_type"] as string) ?? "—" },
              { label: locale === "ar" ? "الدور" : "Floor", value: (r["floor"] as string) ?? "—" },
              { label: locale === "ar" ? "المساحة الكلية" : "Total area", value: (r["total_area"] as number) ?? "—" },
              { label: locale === "ar" ? "حصة الأرض" : "Land share", value: (r["land_share_percent"] as number) ?? "—" },
              { label: locale === "ar" ? "المالك الحالي" : "Owner", value: (r["current_owner"] as string) ?? "—" },
            ]}
          />
        </TabsContent>

        <TabsContent value="partition" className="mt-3 min-w-0">
          <PropertySection
            table="property_partition_reports"
            projectId={projectId}
            canEdit={canEdit}
            canDelete={isAccountant}
            title={["محاضر الفرز", "Partition reports"]}
            fields={[
              { name: "report_no", label: ["رقم المحضر", "Report no."], required: true },
              { name: "request_no", label: ["رقم الطلب", "Request no."] },
              { name: "approved_at", label: ["تاريخ الاعتماد", "Approved on"], type: "date" },
              { name: "deed_no", label: ["رقم الصك", "Deed no."] },
              { name: "deed_area", label: ["مساحة الصك", "Deed area"], type: "number" },
              { name: "license_no", label: ["رقم الرخصة", "License no."] },
              { name: "engineering_office", label: ["المكتب الهندسي", "Engineering office"] },
              { name: "notes", label: ["ملاحظات", "Notes"], type: "textarea" },
            ]}
            primary={(r) => `${locale === "ar" ? "محضر" : "Report"} ${(r["report_no"] as string) ?? "—"}`}
            secondary={(r) => formatDate(r["approved_at"] as string)}
            details={(r) => [
              { label: locale === "ar" ? "رقم الطلب" : "Request no.", value: (r["request_no"] as string) ?? "—" },
              { label: locale === "ar" ? "رقم الصك" : "Deed no.", value: (r["deed_no"] as string) ?? "—" },
              { label: locale === "ar" ? "مساحة الصك" : "Deed area", value: (r["deed_area"] as number) ?? "—" },
              { label: locale === "ar" ? "المكتب الهندسي" : "Office", value: (r["engineering_office"] as string) ?? "—" },
            ]}
          />
        </TabsContent>

        <TabsContent value="services" className="mt-3 min-w-0">
          <PropertyServices
            projectId={projectId}
            canEdit={canEdit}
            canApprove={canApprove}
            isAccountant={isAccountant}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-3 min-w-0">
          <PropertyDocuments
            projectId={projectId}
            canUpload={canUpload}
            canManage={canManageDocs}
            isAccountant={isAccountant}
          />
        </TabsContent>

        <TabsContent value="boundaries" className="mt-3 space-y-3">
          <PropertySection
            table="property_boundaries"
            projectId={projectId}
            canEdit={canEdit}
            canDelete={canEdit}
            title={["حدود العقار", "Property boundaries"]}
            fields={[
              { name: "side", label: ["الجهة", "Side"], type: "select", required: true, options: BOUNDARY_SIDES },
              { name: "description", label: ["الوصف", "Description"], wide: true },
              { name: "length_m", label: ["الطول (م)", "Length (m)"], type: "number" },
              { name: "setback_m", label: ["الارتداد (م)", "Setback (m)"], type: "number" },
              { name: "projection_m", label: ["البروز (م)", "Projection (m)"], type: "number" },
              { name: "notes", label: ["ملاحظات", "Notes"], type: "textarea" },
            ]}
            primary={(r) => labelOf(locale, BOUNDARY_SIDES, r["side"] as string)}
            secondary={(r) => `${(r["length_m"] as number) ?? "—"} ${locale === "ar" ? "م" : "m"}`}
            details={(r) => [
              { label: locale === "ar" ? "الوصف" : "Description", value: (r["description"] as string) ?? "—" },
              { label: locale === "ar" ? "الطول" : "Length", value: (r["length_m"] as number) ?? "—" },
              { label: locale === "ar" ? "الارتداد" : "Setback", value: (r["setback_m"] as number) ?? "—" },
              { label: locale === "ar" ? "البروز" : "Projection", value: (r["projection_m"] as number) ?? "—" },
            ]}
          />
          <PropertySection
            table="property_coordinates"
            projectId={projectId}
            canEdit={canEdit}
            canDelete={canEdit}
            title={["نقاط الإحداثيات", "Coordinate points"]}
            fields={[
              { name: "label", label: ["اسم النقطة", "Point label"] },
              { name: "latitude", label: ["خط العرض", "Latitude"], type: "number", required: true },
              { name: "longitude", label: ["خط الطول", "Longitude"], type: "number", required: true },
              { name: "notes", label: ["ملاحظات", "Notes"], type: "textarea" },
            ]}
            primary={(r) => (r["label"] as string) ?? "—"}
            secondary={(r) => `${String(r["latitude"])}, ${String(r["longitude"])}`}
            details={(r) => [
              { label: locale === "ar" ? "خط العرض" : "Latitude", value: String(r["latitude"]) },
              { label: locale === "ar" ? "خط الطول" : "Longitude", value: String(r["longitude"]) },
            ]}
          />
        </TabsContent>

        <TabsContent value="completion" className="mt-3 min-w-0">
          <PropertyCard projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
