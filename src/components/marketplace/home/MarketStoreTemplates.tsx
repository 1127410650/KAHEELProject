import { Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";

import { STORE_TEMPLATES } from "@/components/marketplace/StoreTemplatePicker";

const FEATURED_IDS = new Set(["women", "men", "games", "clubs", "restaurant", "kids"]);

export function MarketStoreTemplates() {
  const templates = STORE_TEMPLATES.filter((template) => FEATURED_IDS.has(template.id));

  return (
    <section className="mx-auto w-full max-w-[1240px] px-3 pt-4 sm:px-4 sm:pt-6 lg:px-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary sm:text-xs">
            <Sparkles className="size-3.5" aria-hidden />
            متاجر بتصاميم مختلفة
          </span>
          <h2 className="mt-1 text-sm font-black tracking-tight text-foreground sm:text-lg">
            اختر هوية متجرك
          </h2>
          <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
            نسائي، رجالي، ألعاب، نوادٍ، مطاعم وأطفال — كل نشاط بتصميمه الخاص.
          </p>
        </div>
        <Link
          to="/join"
          search={{ kind: "seller" }}
          className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-border bg-card px-3 text-[10px] font-bold text-foreground shadow-sm hover:bg-muted sm:text-xs"
        >
          انضم كبائع
          <ArrowLeft className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 lg:grid-cols-6">
        {templates.map((template) => {
          const Icon = template.icon;
          return (
            <Link
              key={template.id}
              to="/join"
              search={{ kind: "seller" }}
              className={`group relative min-h-36 w-[46%] min-w-[46%] snap-start overflow-hidden rounded-2xl bg-gradient-to-br ${template.gradient} p-3 text-white shadow-panel transition hover:-translate-y-0.5 hover:shadow-raised sm:w-auto sm:min-w-0`}
            >
              <div
                className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_42%)]"
                aria-hidden
              />
              <div className="relative flex h-full min-h-30 flex-col">
                <span className="grid size-10 place-items-center rounded-xl border border-white/20 bg-white/15 backdrop-blur">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="mt-auto pt-5">
                  <h3 className="text-sm font-black">{template.title}</h3>
                  <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-white/70">
                    {template.description}
                  </p>
                  <span className="mt-2 inline-flex items-center text-[9px] font-bold text-white/90">
                    مشاهدة القالب
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
