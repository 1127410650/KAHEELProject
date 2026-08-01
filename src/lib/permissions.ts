/** Fine-grained permissions. Enforced in the database (has_perm + RLS/RPC), mirrored here for UI. */
export const PERMISSIONS = [
  "users.manage",
  "projects.view_all",
  "projects.view_assigned",
  "projects.manage_supervisors",
  "requests.create",
  "requests.view_own",
  "requests.view_assigned",
  "requests.assign",
  "requests.process",
  "requests.approve",
  "requests.reject",
  "requests.reopen",
  "requests.execute",
  "requests.upload_files",
  "project_requests.view",
  "project_requests.create",
  "general_requests.view_assigned",
  "general_requests.manage",
  "request_messages.view_shared",
  "request_messages.view_internal",
  "custody.view_own",
  "custody.request_topup",
  "custody.execute_topup",
  "custody.request_movement",
  "custody.approve_movement",
  "custody.execute_movement",
  "payment.request",
  "payment.execute",
  "payment.view_sensitive",
  "project.request_create",
  "project.approve_create",
  "documents.request_upload",
  "documents.approve",
  "reminders.send",
  "reports.view",
  "invoice_verification.use",
  "invoices.save_verified",
  "invoices.review_extracted",
  "invoices.approve",
  "products.view",
  "products.manage",
  "products.merge",
  "prices.view",
  "prices.export",
  "property.view",
  "property.edit",
  "property.approve",
  "property_documents.view",
  "property_documents.upload",
  "property_documents.manage",
  "property_services.view",
  "property_services.update",
  "property_services.approve",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Permissions that need an explicit warning before granting (approval / sensitive documents). */
export const SENSITIVE_PERMISSIONS: Permission[] = [
  "property.approve",
  "property_documents.manage",
  "property_services.approve",
  "invoices.approve",
  "documents.approve",
];


/** Sensible defaults per role when the admin creates an account. */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  accountant: [...PERMISSIONS],
  employee: [
    "projects.view_assigned",
    "requests.create",
    "requests.view_assigned",
    "requests.process",
    "requests.upload_files",
    "project_requests.view",
    "general_requests.view_assigned",
    "request_messages.view_shared",
    "request_messages.view_internal",
    "reminders.send",
    "reports.view",
    "invoice_verification.use",
    "invoices.save_verified",
    "invoices.review_extracted",
    "products.view",
    "prices.view",
  ],
  supervisor: [
    "projects.view_assigned",
    "requests.create",
    "requests.view_own",
    "requests.upload_files",
    "project_requests.view",
    "project_requests.create",
    "request_messages.view_shared",
    "custody.view_own",
    "custody.request_topup",
    "custody.request_movement",
    "payment.request",
    "project.request_create",
    "documents.request_upload",
    "reminders.send",
  ],
};

/** Request scope — the isolation boundary for every request (single requests table). */
export const REQUEST_SCOPES = ["general", "project", "custody", "payment"] as const;
export type RequestScope = (typeof REQUEST_SCOPES)[number];

export const REQUEST_SCOPE_LABELS_AR: Record<RequestScope, string> = {
  general: "طلب عام",
  project: "طلب مرتبط بمشروع",
  custody: "طلب عهدة",
  payment: "طلب صرف دفعة",
};

export const REQUEST_SCOPE_LABELS_EN: Record<RequestScope, string> = {
  general: "General request",
  project: "Project request",
  custody: "Custody request",
  payment: "Payment request",
};

/** Project supervisor membership types. */
export const MEMBERSHIP_TYPES = ["primary", "partner", "site", "followup"] as const;
export type MembershipType = (typeof MEMBERSHIP_TYPES)[number];

export const MEMBERSHIP_LABELS_AR: Record<MembershipType, string> = {
  primary: "مشرف رئيسي",
  partner: "مشرف مشارك",
  site: "مشرف موقع",
  followup: "مشرف متابعة",
};

export const MEMBERSHIP_LABELS_EN: Record<MembershipType, string> = {
  primary: "Primary supervisor",
  partner: "Partner supervisor",
  site: "Site supervisor",
  followup: "Follow-up supervisor",
};

/** Message visibility inside a request conversation. */
export const MESSAGE_VISIBILITIES = ["shared", "internal", "requester_only"] as const;
export type MessageVisibility = (typeof MESSAGE_VISIBILITIES)[number];

export const VISIBILITY_LABELS_AR: Record<MessageVisibility, string> = {
  shared: "رسالة مشتركة",
  internal: "ملاحظة داخلية",
  requester_only: "خاصة بمقدم الطلب",
};

export const VISIBILITY_LABELS_EN: Record<MessageVisibility, string> = {
  shared: "Shared message",
  internal: "Internal note",
  requester_only: "Requester only",
};


export const PERMISSION_LABELS_AR: Record<Permission, string> = {
  "users.manage": "إدارة المستخدمين",
  "projects.view_all": "عرض جميع المشاريع",
  "projects.view_assigned": "عرض المشاريع المسندة",
  "requests.create": "إنشاء طلب",
  "requests.view_own": "عرض طلباته",
  "requests.view_assigned": "عرض الطلبات المسندة",
  "requests.assign": "إسناد الطلبات",
  "requests.process": "معالجة الطلبات",
  "requests.approve": "الموافقة على الطلبات",
  "requests.reject": "رفض الطلبات",
  "requests.reopen": "إعادة فتح الطلبات",
  "requests.upload_files": "رفع ملفات الطلبات",
  "custody.view_own": "عرض عهدته",
  "custody.request_topup": "طلب إضافة رصيد",
  "custody.execute_topup": "تنفيذ إضافة الرصيد",
  "custody.request_movement": "طلب حركة عهدة",
  "custody.approve_movement": "اعتماد حركة العهدة",
  "custody.execute_movement": "تنفيذ حركة العهدة",
  "payment.request": "طلب صرف دفعة",
  "payment.execute": "تنفيذ صرف الدفعة",
  "project.request_create": "طلب إضافة مشروع",
  "project.approve_create": "اعتماد إنشاء المشروع",
  "documents.request_upload": "طلب رفع مستندات",
  "documents.approve": "اعتماد المستندات",
  "reminders.send": "إرسال التذكيرات",
  "reports.view": "عرض التقارير",
  "projects.manage_supervisors": "إدارة مشرفي المشروع",
  "requests.execute": "تنفيذ الطلبات",
  "project_requests.view": "عرض طلبات المشروع",
  "project_requests.create": "إنشاء طلب مشروع",
  "general_requests.view_assigned": "عرض الطلبات العامة المسندة",
  "general_requests.manage": "إدارة الطلبات العامة",
  "request_messages.view_shared": "عرض الرسائل المشتركة",
  "request_messages.view_internal": "عرض الملاحظات الداخلية",
  "payment.view_sensitive": "عرض البيانات المالية الحساسة",
  "invoice_verification.use": "استخدام التحقق من الفاتورة الضريبية",
  "invoices.save_verified": "حفظ الفاتورة المتحقق منها في النظام",
  "invoices.review_extracted": "مراجعة البيانات المستخرجة والبنود",
  "invoices.approve": "اعتماد أو رفض الفاتورة المتحقق منها",
  "products.view": "عرض المنتجات والأسعار",
  "products.manage": "إدارة المنتجات والكتالوج",
  "products.merge": "دمج المنتجات المتشابهة",
  "prices.view": "عرض سجل الأسعار",
  "prices.export": "تصدير تقارير الأسعار",
};

export const PERMISSION_LABELS_EN: Record<Permission, string> = {
  "users.manage": "Manage users",
  "projects.view_all": "View all projects",
  "projects.view_assigned": "View assigned projects",
  "requests.create": "Create request",
  "requests.view_own": "View own requests",
  "requests.view_assigned": "View assigned requests",
  "requests.assign": "Assign requests",
  "requests.process": "Process requests",
  "requests.approve": "Approve requests",
  "requests.reject": "Reject requests",
  "requests.reopen": "Reopen requests",
  "requests.upload_files": "Upload request files",
  "custody.view_own": "View own custody",
  "custody.request_topup": "Request custody top-up",
  "custody.execute_topup": "Execute custody top-up",
  "custody.request_movement": "Request custody movement",
  "custody.approve_movement": "Approve custody movement",
  "custody.execute_movement": "Execute custody movement",
  "payment.request": "Request payment",
  "payment.execute": "Execute payment",
  "project.request_create": "Request new project",
  "project.approve_create": "Approve project creation",
  "documents.request_upload": "Request document upload",
  "documents.approve": "Approve documents",
  "reminders.send": "Send reminders",
  "reports.view": "View reports",
  "projects.manage_supervisors": "Manage project supervisors",
  "requests.execute": "Execute requests",
  "project_requests.view": "View project requests",
  "project_requests.create": "Create project request",
  "general_requests.view_assigned": "View assigned general requests",
  "general_requests.manage": "Manage general requests",
  "request_messages.view_shared": "View shared messages",
  "request_messages.view_internal": "View internal notes",
  "payment.view_sensitive": "View sensitive financial data",
  "invoice_verification.use": "Use tax invoice verification",
  "invoices.save_verified": "Save a verified invoice to the system",
  "invoices.review_extracted": "Review extracted data and line items",
  "invoices.approve": "Approve or reject a verified invoice",
  "products.view": "View products and prices",
  "products.manage": "Manage products and catalog",
  "products.merge": "Merge similar products",
  "prices.view": "View price history",
  "prices.export": "Export price reports",
};

/** Request kinds available from the supervisor portal (all use the existing requests table). */
export const REQUEST_KINDS = [
  "custody_topup",
  "payment",
  "project_create",
  "project_service",
  "utility_meter",
  "document_upload",
  "general",
] as const;

export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_KIND_LABELS_AR: Record<RequestKind, string> = {
  custody_topup: "طلب إضافة رصيد للعهدة",
  payment: "طلب صرف دفعة",
  project_create: "طلب إضافة مشروع",
  project_service: "طلب خدمة للمشروع",
  utility_meter: "طلب تركيب عداد (مياه/كهرباء/صرف)",
  document_upload: "طلب إضافة مستندات أو صور",
  general: "طلب عام",
};

export const REQUEST_KIND_LABELS_EN: Record<RequestKind, string> = {
  custody_topup: "Custody top-up request",
  payment: "Payment request",
  project_create: "New project request",
  project_service: "Project service request",
  utility_meter: "Utility meter request",
  document_upload: "Documents/photos request",
  general: "General request",
};

/* ------------------------------------------------- permission groups (UI) */

export const PERMISSION_GROUPS = [
  "users",
  "projects",
  "supervisors",
  "custody",
  "requests",
  "documents",
  "invoices",
  "products",
  "reports",
  "system",
] as const;

export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

export const PERMISSION_GROUP_LABELS_AR: Record<PermissionGroup, string> = {
  users: "المستخدمون",
  projects: "المشاريع",
  supervisors: "المشرفون",
  custody: "العهدة",
  requests: "الطلبات",
  documents: "المستندات",
  invoices: "الموردون والفواتير",
  products: "المنتجات والأسعار",
  reports: "التقارير",
  system: "النظام",
};

export const PERMISSION_GROUP_LABELS_EN: Record<PermissionGroup, string> = {
  users: "Users",
  projects: "Projects",
  supervisors: "Supervisors",
  custody: "Custody",
  requests: "Requests",
  documents: "Documents",
  invoices: "Suppliers & invoices",
  products: "Products & prices",
  reports: "Reports",
  system: "System",
};

export const GROUPED_PERMISSIONS: Record<PermissionGroup, Permission[]> = {
  users: ["users.manage"],
  projects: [
    "projects.view_all",
    "projects.view_assigned",
    "project.request_create",
    "project.approve_create",
  ],
  supervisors: ["projects.manage_supervisors"],
  custody: [
    "custody.view_own",
    "custody.request_topup",
    "custody.request_movement",
    "custody.approve_movement",
    "custody.execute_movement",
    "custody.execute_topup",
  ],
  requests: [
    "requests.view_own",
    "requests.view_assigned",
    "project_requests.view",
    "general_requests.view_assigned",
    "request_messages.view_shared",
    "request_messages.view_internal",
    "requests.create",
    "project_requests.create",
    "requests.assign",
    "requests.process",
    "general_requests.manage",
    "requests.reopen",
    "requests.approve",
    "requests.reject",
    "requests.execute",
    "reminders.send",
  ],
  documents: ["documents.request_upload", "documents.approve", "requests.upload_files"],
  invoices: [
    "payment.request",
    "payment.execute",
    "payment.view_sensitive",
    "invoice_verification.use",
    "invoices.save_verified",
    "invoices.review_extracted",
    "invoices.approve",
  ],
  products: [
    "products.view",
    "products.manage",
    "products.merge",
    "prices.view",
    "prices.export",
  ],
  reports: ["reports.view"],
  system: [],
};
