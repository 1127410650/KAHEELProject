export const LIVE_DEMO_VISIBLE = true;

export type LiveDemoRoleId =
  "customer" | "store" | "clinic" | "barber" | "station" | "carrier" | "platform";

export type LiveDemoTone = "blue" | "amber" | "emerald" | "rose" | "violet" | "cyan" | "slate";

export interface LiveDemoMetric {
  labelAr: string;
  labelEn: string;
  value: string;
  hintAr: string;
  hintEn: string;
}

export interface LiveDemoQueueItem {
  titleAr: string;
  titleEn: string;
  metaAr: string;
  metaEn: string;
  statusAr: string;
  statusEn: string;
  state: "active" | "waiting" | "done";
}

export interface LiveDemoRole {
  id: LiveDemoRoleId;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  accountAr: string;
  accountEn: string;
  badgeAr: string;
  badgeEn: string;
  tone: LiveDemoTone;
  primaryActionAr: string;
  primaryActionEn: string;
  actionDoneAr: string;
  actionDoneEn: string;
  metrics: LiveDemoMetric[];
  queue: LiveDemoQueueItem[];
  capabilitiesAr: string[];
  capabilitiesEn: string[];
}

export const LIVE_DEMO_ROLES: LiveDemoRole[] = [
  {
    id: "customer",
    titleAr: "حساب العميل",
    titleEn: "Customer account",
    subtitleAr: "تصفح وشراء وحجز ومتابعة من مكان واحد",
    subtitleEn: "Browse, order, book, and track in one place",
    accountAr: "سارة العتيبي",
    accountEn: "Sarah Alotaibi",
    badgeAr: "حساب شخصي",
    badgeEn: "Personal account",
    tone: "blue",
    primaryActionAr: "تأكيد الموعد التجريبي",
    primaryActionEn: "Confirm demo booking",
    actionDoneAr: "تم تثبيت الموعد في العرض",
    actionDoneEn: "The booking is confirmed in the demo",
    metrics: [
      {
        labelAr: "طلبات نشطة",
        labelEn: "Active orders",
        value: "3",
        hintAr: "طلبان في التوصيل",
        hintEn: "Two in delivery",
      },
      {
        labelAr: "حجوزات",
        labelEn: "Bookings",
        value: "2",
        hintAr: "أقربها اليوم 6:30",
        hintEn: "Next at 6:30 PM",
      },
      {
        labelAr: "المفضلة",
        labelEn: "Favorites",
        value: "14",
        hintAr: "4 إعلانات جديدة",
        hintEn: "Four new listings",
      },
      {
        labelAr: "طلبات عروض",
        labelEn: "Quote requests",
        value: "1",
        hintAr: "بانتظار عرضين",
        hintEn: "Waiting for two quotes",
      },
    ],
    queue: [
      {
        titleAr: "موعد فحص أسنان",
        titleEn: "Dental checkup",
        metaAr: "عيادات كَحيل · اليوم 6:30 م",
        metaEn: "Kaheel Clinics · Today 6:30 PM",
        statusAr: "بانتظار التأكيد",
        statusEn: "Awaiting confirmation",
        state: "active",
      },
      {
        titleAr: "طلب مقاضي أسبوعي",
        titleEn: "Weekly grocery order",
        metaAr: "متجر البيت · 12 صنفًا",
        metaEn: "Home Market · 12 items",
        statusAr: "مع الناقل",
        statusEn: "With carrier",
        state: "waiting",
      },
      {
        titleAr: "صيانة مكيف",
        titleEn: "AC maintenance",
        metaAr: "بيت الخبرة · زيارة منزلية",
        metaEn: "Service House · Home visit",
        statusAr: "مكتمل",
        statusEn: "Completed",
        state: "done",
      },
    ],
    capabilitiesAr: [
      "السوق والإعلانات",
      "المقاضي والطلبات",
      "الحجوزات والمواعيد",
      "المحادثات والمفضلة",
    ],
    capabilitiesEn: [
      "Marketplace listings",
      "Groceries and orders",
      "Bookings and appointments",
      "Messages and favorites",
    ],
  },
  {
    id: "store",
    titleAr: "حساب المتجر",
    titleEn: "Store account",
    subtitleAr: "كتالوج وإعلانات وطلبات وشركاء توصيل",
    subtitleEn: "Catalog, listings, orders, and delivery partners",
    accountAr: "متجر البيت",
    accountEn: "Home Market",
    badgeAr: "تجزئة ومقاضي",
    badgeEn: "Retail and groceries",
    tone: "amber",
    primaryActionAr: "تسليم الطلب للناقل",
    primaryActionEn: "Hand order to carrier",
    actionDoneAr: "أُرسل الطلب إلى شركة المسار في العرض",
    actionDoneEn: "The order was handed to Al-Masar in the demo",
    metrics: [
      {
        labelAr: "طلبات اليوم",
        labelEn: "Today orders",
        value: "28",
        hintAr: "+18% عن أمس",
        hintEn: "+18% from yesterday",
      },
      {
        labelAr: "الكتالوج",
        labelEn: "Catalog",
        value: "186",
        hintAr: "172 متاحًا",
        hintEn: "172 available",
      },
      {
        labelAr: "إعلانات مرتبطة",
        labelEn: "Linked listings",
        value: "12",
        hintAr: "3 مميزة",
        hintEn: "Three featured",
      },
      {
        labelAr: "شركاء نشطون",
        labelEn: "Active partners",
        value: "4",
        hintAr: "ناقلان وموردان",
        hintEn: "Two carriers, two suppliers",
      },
    ],
    queue: [
      {
        titleAr: "طلب #G-2048",
        titleEn: "Order #G-2048",
        metaAr: "12 صنفًا · 286 ر.س",
        metaEn: "12 items · SAR 286",
        statusAr: "جاهز للتسليم",
        statusEn: "Ready for handoff",
        state: "active",
      },
      {
        titleAr: "توريد منتجات ألبان",
        titleEn: "Dairy supply",
        metaAr: "المورد: غذاء المدينة",
        metaEn: "Supplier: City Foods",
        statusAr: "يصل غدًا",
        statusEn: "Arrives tomorrow",
        state: "waiting",
      },
      {
        titleAr: "حملة نهاية الأسبوع",
        titleEn: "Weekend campaign",
        metaAr: "3 إعلانات ممولة",
        metaEn: "Three promoted listings",
        statusAr: "نشطة",
        statusEn: "Active",
        state: "done",
      },
    ],
    capabilitiesAr: [
      "إدارة المنتجات والمخزون",
      "ربط الإعلان بالمنتج",
      "طلبات وشحن وتحصيل",
      "موردون وناقلون",
    ],
    capabilitiesEn: [
      "Products and inventory",
      "Listing-to-item links",
      "Orders, shipping, collection",
      "Suppliers and carriers",
    ],
  },
  {
    id: "clinic",
    titleAr: "حساب العيادة",
    titleEn: "Clinic account",
    subtitleAr: "أطباء وخدمات ومواعيد وفروع",
    subtitleEn: "Doctors, services, bookings, and branches",
    accountAr: "عيادات كَحيل",
    accountEn: "Kaheel Clinics",
    badgeAr: "صحة وعيادات",
    badgeEn: "Health and clinics",
    tone: "emerald",
    primaryActionAr: "قبول موعد سارة",
    primaryActionEn: "Accept Sarah's booking",
    actionDoneAr: "تم تأكيد الموعد وإشعار العميل في العرض",
    actionDoneEn: "The booking and customer notification are confirmed in the demo",
    metrics: [
      {
        labelAr: "مواعيد اليوم",
        labelEn: "Today bookings",
        value: "34",
        hintAr: "6 متاحة",
        hintEn: "Six slots available",
      },
      {
        labelAr: "أطباء",
        labelEn: "Doctors",
        value: "12",
        hintAr: "9 متاحون",
        hintEn: "Nine available",
      },
      {
        labelAr: "خدمات",
        labelEn: "Services",
        value: "27",
        hintAr: "5 تخصصات",
        hintEn: "Five specialties",
      },
      { labelAr: "فروع", labelEn: "Branches", value: "3", hintAr: "الرياض", hintEn: "Riyadh" },
    ],
    queue: [
      {
        titleAr: "سارة العتيبي",
        titleEn: "Sarah Alotaibi",
        metaAr: "فحص أسنان · 6:30 م",
        metaEn: "Dental checkup · 6:30 PM",
        statusAr: "طلب جديد",
        statusEn: "New request",
        state: "active",
      },
      {
        titleAr: "محمد الحربي",
        titleEn: "Mohammed Alharbi",
        metaAr: "استشارة عامة · 7:00 م",
        metaEn: "General consultation · 7:00 PM",
        statusAr: "مؤكد",
        statusEn: "Confirmed",
        state: "waiting",
      },
      {
        titleAr: "ريم خالد",
        titleEn: "Reem Khaled",
        metaAr: "متابعة جلدية · 5:45 م",
        metaEn: "Dermatology follow-up · 5:45 PM",
        statusAr: "وصلت",
        statusEn: "Checked in",
        state: "done",
      },
    ],
    capabilitiesAr: ["ملفات الأطباء", "جدولة الفروع", "حجز ودفع عربون", "تنبيهات ومتابعة"],
    capabilitiesEn: [
      "Doctor profiles",
      "Branch scheduling",
      "Booking and deposits",
      "Alerts and follow-up",
    ],
  },
  {
    id: "barber",
    titleAr: "حساب الحلاق",
    titleEn: "Barber account",
    subtitleAr: "مواعيد وطابور حي وخدمات سريعة",
    subtitleEn: "Appointments, live queue, and express services",
    accountAr: "صالون مِقص",
    accountEn: "Miqas Barber",
    badgeAr: "حلاقة وعناية",
    badgeEn: "Barber and care",
    tone: "rose",
    primaryActionAr: "استدعاء العميل التالي",
    primaryActionEn: "Call the next customer",
    actionDoneAr: "تم تحديث الدور إلى العميل التالي في العرض",
    actionDoneEn: "The live queue advanced in the demo",
    metrics: [
      {
        labelAr: "في الطابور",
        labelEn: "In queue",
        value: "7",
        hintAr: "متوسط 18 دقيقة",
        hintEn: "18 min average",
      },
      {
        labelAr: "مواعيد اليوم",
        labelEn: "Today bookings",
        value: "19",
        hintAr: "14 مكتملة",
        hintEn: "14 completed",
      },
      {
        labelAr: "كراسي متاحة",
        labelEn: "Available chairs",
        value: "2",
        hintAr: "من أصل 6",
        hintEn: "Out of six",
      },
      {
        labelAr: "خدمات",
        labelEn: "Services",
        value: "11",
        hintAr: "3 باقات",
        hintEn: "Three packages",
      },
    ],
    queue: [
      {
        titleAr: "الدور A-17",
        titleEn: "Queue A-17",
        metaAr: "قص شعر ولحية · كرسي 3",
        metaEn: "Hair and beard · Chair 3",
        statusAr: "قيد الخدمة",
        statusEn: "In service",
        state: "active",
      },
      {
        titleAr: "الدور A-18",
        titleEn: "Queue A-18",
        metaAr: "قص شعر · 15 دقيقة",
        metaEn: "Haircut · 15 minutes",
        statusAr: "التالي",
        statusEn: "Next",
        state: "waiting",
      },
      {
        titleAr: "الدور A-16",
        titleEn: "Queue A-16",
        metaAr: "باقة عناية",
        metaEn: "Care package",
        statusAr: "مكتمل",
        statusEn: "Completed",
        state: "done",
      },
    ],
    capabilitiesAr: ["طابور حي", "حجز مسبق", "إدارة الكراسي", "باقات وعروض"],
    capabilitiesEn: ["Live queue", "Advance booking", "Chair management", "Packages and offers"],
  },
  {
    id: "station",
    titleAr: "حساب المحطة",
    titleEn: "Service station account",
    subtitleAr: "خدمات مركبات وحجوزات وتكاملات تشغيل",
    subtitleEn: "Vehicle services, bookings, and operational integrations",
    accountAr: "محطة المسار",
    accountEn: "Al-Masar Station",
    badgeAr: "محطة وخدمات مركبات",
    badgeEn: "Station and vehicle services",
    tone: "violet",
    primaryActionAr: "بدء خدمة المركبة",
    primaryActionEn: "Start vehicle service",
    actionDoneAr: "انتقلت المركبة إلى قيد الخدمة في العرض",
    actionDoneEn: "The vehicle moved to in-service in the demo",
    metrics: [
      {
        labelAr: "مركبات الآن",
        labelEn: "Vehicles now",
        value: "9",
        hintAr: "3 قيد الخدمة",
        hintEn: "Three in service",
      },
      {
        labelAr: "حجوزات",
        labelEn: "Bookings",
        value: "16",
        hintAr: "لهذا اليوم",
        hintEn: "For today",
      },
      {
        labelAr: "خدمات",
        labelEn: "Services",
        value: "18",
        hintAr: "غسيل وصيانة",
        hintEn: "Wash and maintenance",
      },
      {
        labelAr: "تكاملات",
        labelEn: "Integrations",
        value: "3",
        hintAr: "2 متصلة",
        hintEn: "Two connected",
      },
    ],
    queue: [
      {
        titleAr: "تويوتا لاندكروزر",
        titleEn: "Toyota Land Cruiser",
        metaAr: "غسيل شامل · مسار 2",
        metaEn: "Full wash · Bay 2",
        statusAr: "جاهزة للبدء",
        statusEn: "Ready to start",
        state: "active",
      },
      {
        titleAr: "هيونداي سوناتا",
        titleEn: "Hyundai Sonata",
        metaAr: "تغيير زيت · مسار 1",
        metaEn: "Oil change · Bay 1",
        statusAr: "قيد الخدمة",
        statusEn: "In service",
        state: "waiting",
      },
      {
        titleAr: "فورد إكسبلورر",
        titleEn: "Ford Explorer",
        metaAr: "فحص سريع",
        metaEn: "Express check",
        statusAr: "مكتمل",
        statusEn: "Completed",
        state: "done",
      },
    ],
    capabilitiesAr: ["طابور المركبات", "حجز الخدمات", "إدارة المسارات", "ربط نقاط البيع"],
    capabilitiesEn: ["Vehicle queue", "Service booking", "Bay management", "POS integrations"],
  },
  {
    id: "carrier",
    titleAr: "حساب شركة الشحن",
    titleEn: "Carrier account",
    subtitleAr: "شراكات متاجر وشحنات وتتبع وتحصيل",
    subtitleEn: "Store partnerships, shipments, tracking, and collection",
    accountAr: "المسار للنقل",
    accountEn: "Al-Masar Logistics",
    badgeAr: "شحن وتوصيل",
    badgeEn: "Shipping and delivery",
    tone: "cyan",
    primaryActionAr: "استلام الشحنة من المتجر",
    primaryActionEn: "Collect shipment from store",
    actionDoneAr: "بدأ التتبع وأُخطر المتجر والعميل في العرض",
    actionDoneEn: "Tracking started and both sides were notified in the demo",
    metrics: [
      {
        labelAr: "شحنات نشطة",
        labelEn: "Active shipments",
        value: "42",
        hintAr: "11 للتسليم اليوم",
        hintEn: "11 due today",
      },
      {
        labelAr: "مندوبون",
        labelEn: "Couriers",
        value: "18",
        hintAr: "13 متاحون",
        hintEn: "13 available",
      },
      {
        labelAr: "متاجر مرتبطة",
        labelEn: "Partner stores",
        value: "24",
        hintAr: "3 طلبات جديدة",
        hintEn: "Three new requests",
      },
      {
        labelAr: "تحصيل اليوم",
        labelEn: "Today collection",
        value: "8.4K",
        hintAr: "ريال سعودي",
        hintEn: "Saudi riyals",
      },
    ],
    queue: [
      {
        titleAr: "شحنة #S-8812",
        titleEn: "Shipment #S-8812",
        metaAr: "متجر البيت ← سارة العتيبي",
        metaEn: "Home Market → Sarah Alotaibi",
        statusAr: "بانتظار الاستلام",
        statusEn: "Awaiting pickup",
        state: "active",
      },
      {
        titleAr: "شحنة #S-8807",
        titleEn: "Shipment #S-8807",
        metaAr: "مقهى مزاج ← حي الربوة",
        metaEn: "Mazaj Cafe → Al-Rabwah",
        statusAr: "في الطريق",
        statusEn: "Out for delivery",
        state: "waiting",
      },
      {
        titleAr: "شحنة #S-8794",
        titleEn: "Shipment #S-8794",
        metaAr: "متجر التقنية ← حي النرجس",
        metaEn: "Tech Store → Al-Narjis",
        statusAr: "تم التسليم",
        statusEn: "Delivered",
        state: "done",
      },
    ],
    capabilitiesAr: ["طلبات شراكة", "إسناد المندوبين", "تتبع الشحنات", "تحصيل وتسوية"],
    capabilitiesEn: [
      "Partnership requests",
      "Courier assignment",
      "Shipment tracking",
      "Collection and settlement",
    ],
  },
  {
    id: "platform",
    titleAr: "إدارة المنصة",
    titleEn: "Platform operations",
    subtitleAr: "متابعة التشغيل والعزل والتكاملات دون الدخول في بيانات خاصة",
    subtitleEn: "Operational oversight without crossing private account boundaries",
    accountAr: "إدارة كَحيل",
    accountEn: "Kaheel Operations",
    badgeAr: "حساب رسمي",
    badgeEn: "Official account",
    tone: "slate",
    primaryActionAr: "تشغيل فحص سلامة العرض",
    primaryActionEn: "Run demo health check",
    actionDoneAr: "اكتمل الفحص: العزل والتدفقات سليمة في العرض",
    actionDoneEn: "Health check complete: demo isolation and flows are healthy",
    metrics: [
      {
        labelAr: "حسابات العرض",
        labelEn: "Demo accounts",
        value: "7",
        hintAr: "معزولة منطقيًا",
        hintEn: "Logically isolated",
      },
      {
        labelAr: "رحلات مكتملة",
        labelEn: "Covered journeys",
        value: "12",
        hintAr: "بيع وخدمة وشحن",
        hintEn: "Commerce, service, shipping",
      },
      {
        labelAr: "تكاملات",
        labelEn: "Integrations",
        value: "7",
        hintAr: "بيانات اعتماد خادمية",
        hintEn: "Server-side credentials",
      },
      {
        labelAr: "تنبيهات حرجة",
        labelEn: "Critical alerts",
        value: "0",
        hintAr: "الوضع سليم",
        hintEn: "Healthy state",
      },
    ],
    queue: [
      {
        titleAr: "فحص عزل الحسابات",
        titleEn: "Account isolation check",
        metaAr: "متجر · عيادة · ناقل",
        metaEn: "Store · Clinic · Carrier",
        statusAr: "سليم",
        statusEn: "Healthy",
        state: "done",
      },
      {
        titleAr: "تدفق الحجز",
        titleEn: "Booking flow",
        metaAr: "إعلان ← خدمة ← موعد",
        metaEn: "Listing → Service → Booking",
        statusAr: "يعمل",
        statusEn: "Operational",
        state: "done",
      },
      {
        titleAr: "تدفق الشحن",
        titleEn: "Shipping flow",
        metaAr: "متجر ← ناقل ← عميل",
        metaEn: "Store → Carrier → Customer",
        statusAr: "يعمل",
        statusEn: "Operational",
        state: "done",
      },
    ],
    capabilitiesAr: ["توزيع الأعمال", "سجل تدقيق", "مراجعة المحتوى", "مراقبة التكاملات"],
    capabilitiesEn: ["Work distribution", "Audit log", "Content review", "Integration monitoring"],
  },
];

export const LIVE_DEMO_INTEGRATIONS = [
  {
    nameAr: "نظام نقاط البيع",
    nameEn: "Point of sale",
    ownerAr: "المحطة والمتجر",
    ownerEn: "Station and store",
    statusAr: "متصل",
    statusEn: "Connected",
  },
  {
    nameAr: "مزوّد الخرائط",
    nameEn: "Maps provider",
    ownerAr: "الشحن والخدمات",
    ownerEn: "Shipping and services",
    statusAr: "متصل",
    statusEn: "Connected",
  },
  {
    nameAr: "بوابة الرسائل",
    nameEn: "Messaging gateway",
    ownerAr: "الحجوزات والطلبات",
    ownerEn: "Bookings and orders",
    statusAr: "وضع تجريبي",
    statusEn: "Demo mode",
  },
  {
    nameAr: "نظام المحاسبة",
    nameEn: "Accounting system",
    ownerAr: "المتجر والناقل",
    ownerEn: "Store and carrier",
    statusAr: "جاهز للربط",
    statusEn: "Ready to connect",
  },
];
