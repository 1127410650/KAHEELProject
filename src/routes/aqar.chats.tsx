/** محادثات كَحيل عقار — تربط بمركز محادثات السوق حتى تُخصَّص للقسم. */

import { createFileRoute, Link } from "@tanstack/react-router";
import { MessagesSquare } from "lucide-react";

import { AqarShell } from "@/components/marketplace/aqar/AqarShell";

export const Route = createFileRoute("/aqar/chats")({
  head: () => ({
    meta: [
      { title: "المحادثات — كَحيل عقار" },
      { name: "description", content: "محادثاتك مع مزوّدي العقارات ومكاتب العقار على كَحيل." },
      { property: "og:title", content: "المحادثات — كَحيل عقار" },
      { property: "og:description", content: "تواصل مباشر مع مزوّدي العقارات على كَحيل عقار." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AqarChatsPage,
});

function AqarChatsPage() {
  return (
    <AqarShell title="المحادثات" subtitle="مع مزوّدي العقارات" back="/aqar" backLabel="عقار">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 p-6 text-center">
        <MessagesSquare className="size-8 text-primary" aria-hidden />
        <p className="text-body text-foreground">
          محادثات القسم تُفتح مع دفعة الطلبات. محادثاتك الحالية متاحة في مركز محادثات السوق.
        </p>
        <Link to="/my/messages" className="text-desc font-bold text-primary">
          فتح مركز المحادثات
        </Link>
      </div>
    </AqarShell>
  );
}
