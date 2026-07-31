/** Fine-grained permissions. Enforced in the database (has_perm + RLS/RPC), mirrored here for UI. */
export const PERMISSIONS = [
  "users.manage",
  "projects.view_all",
  "projects.view_assigned",
  "requests.create",
  "requests.view_own",
  "requests.view_assigned",
  "requests.assign",
  "requests.process",
  "requests.approve",
  "requests.reject",
  "requests.reopen",
  "requests.upload_files",
  "custody.view_own",
  "custody.request_topup",
  "custody.execute_topup",
  "payment.request",
  "payment.execute",
  "project.request_create",
  "project.approve_create",
  "documents.request_upload",
  "documents.approve",
  "reminders.send",
  "reports.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Sensible defaults per role when the admin creates an account. */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  accountant: [...PERMISSIONS],
  employee: [
    "projects.view_assigned",
    "requests.create",
    "requests.view_assigned",
    "requests.process",
    "requests.upload_files",
    "reminders.send",
    "reports.view",
  ],
  supervisor: [
    "projects.view_assigned",
    "requests.create",
    "requests.view_own",
    "requests.upload_files",
    "custody.view_own",
    "custody.request_topup",
    "payment.request",
    "project.request_create",
    "documents.request_upload",
    "reminders.send",
  ],
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
  "payment.request": "طلب صرف دفعة",
  "payment.execute": "تنفيذ صرف الدفعة",
  "project.request_create": "طلب إضافة مشروع",
  "project.approve_create": "اعتماد إنشاء المشروع",
  "documents.request_upload": "طلب رفع مستندات",
  "documents.approve": "اعتماد المستندات",
  "reminders.send": "إرسال التذكيرات",
  "reports.view": "عرض التقارير",
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
  "payment.request": "Request payment",
  "payment.execute": "Execute payment",
  "project.request_create": "Request new project",
  "project.approve_create": "Approve project creation",
  "documents.request_upload": "Request document upload",
  "documents.approve": "Approve documents",
  "reminders.send": "Send reminders",
  "reports.view": "View reports",
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
