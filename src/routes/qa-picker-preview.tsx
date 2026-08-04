/**
 * TEMPORARY QA harness — renders the real «اختر المجال» picker outside the
 * authenticated ad form so the field/subcategory tree can be verified without a
 * session. Deleted right after the proof screenshots are taken.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { CategoryPicker } from "@/components/marketplace/CategoryPicker";

export const Route = createFileRoute("/qa-picker-preview")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "QA — Field picker preview" },
      { name: "description", content: "Temporary QA preview of the marketplace field picker." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: QAPickerPreview,
});

function QAPickerPreview() {
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [subcategoryId, setSubcategoryId] = useState<string | undefined>(undefined);
  return (
    <div className="p-4">
      <CategoryPicker
        categoryId={categoryId}
        subcategoryId={subcategoryId}
        onChange={(next) => {
          setCategoryId(next.categoryId);
          setSubcategoryId(next.subcategoryId);
        }}
      />
      <pre className="mt-4 text-xs" data-testid="qa-selection">
        {JSON.stringify({ categoryId, subcategoryId })}
      </pre>
    </div>
  );
}
