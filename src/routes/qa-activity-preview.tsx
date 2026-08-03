import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ActivityPicker, type ActivityValue } from "@/components/marketplace/ActivityPicker";

export const Route = createFileRoute("/qa-activity-preview")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "QA — اختيار النشاط" },
      { name: "description", content: "صفحة اختبار مؤقتة لواجهة اختيار النشاط." },
      { property: "og:title", content: "QA — اختيار النشاط" },
      { property: "og:description", content: "صفحة اختبار مؤقتة." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const [value, setValue] = useState<ActivityValue>({ main: null, subs: [] });
    return (
      <main className="mx-auto w-full max-w-xl px-3 py-6">
        <h1 className="mb-4 text-lg font-bold">QA: ActivityPicker</h1>
        <ActivityPicker value={value} onChange={setValue} />
      </main>
    );
  },
});
