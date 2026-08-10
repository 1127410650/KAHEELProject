import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, Eye, Layers3, Plus, Sparkles, Star } from "lucide-react";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { DEMO_STORE_WORLDS, getDemoStoreWorld } from "@/lib/demo-store-worlds";
import { demoWorldThemeId } from "@/lib/store-theme";

export const Route = createFileRoute("/demo-stores/$worldId")({
  ssr: "data-only",
  head: () => ({
    meta: [
      { title: "عوالم المتاجر التجريبية — كَحيل" },
      { name: "description", content: "استكشف متاجر تجريبية متعددة بتصاميم وصور حقيقية حسب النشاط." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DemoStoreWorldPage,
});

function DemoStoreWorldPage() {
  const { worldId } = Route.useParams();
  const world = getDemoStoreWorld(worldId);

  if (!world) {
    return (
      <MarketShell>
        <main className="mx-auto flex min-h-[55vh] w-full max-w-xl flex-col items-center justify-center px-5 text-center">
          <Layers3 className="size-10 text-muted-foreground" aria-hidden />
          <h1 className="text-page mt-4 font-black text-foreground">هذا العالم غير موجود</h1>
          <p className="mt-2 text-sm text-muted-foreground">ارجع إلى الرئيسية واختر عالمًا آخر من عوالم المتاجر.</p>
          <Link to="/" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground">
            <ArrowRight className="size-4" aria-hidden />
            العودة إلى الرئيسية
          </Link>
        </main>
      </MarketShell>
    );
  }

  const otherWorlds = DEMO_STORE_WORLDS.filter((item) => item.id !== world.id).slice(0, 5);

  return (
    <MarketShell>
      <main className="pb-6">
        <section className="relative isolate min-h-[180px] overflow-hidden bg-slate-950 text-white sm:min-h-[220px]">
          <img src={world.image} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/48 to-black/5" aria-hidden />
          <div className={`absolute inset-0 bg-gradient-to-br ${world.gradient} opacity-32 mix-blend-color`} aria-hidden />

          <div className="market-hero-band relative mx-auto flex min-h-[180px] w-full max-w-[1240px] flex-col justify-end px-5 sm:min-h-[220px] sm:px-6 lg:px-8">
            <Link to="/" className="mb-auto inline-flex w-fit items-center gap-[var(--sp-2)] rounded-full border border-white/25 bg-black/20 px-3 py-[var(--sp-2)] text-desc font-bold text-white backdrop-blur-md">
              <ArrowRight className="size-3.5" aria-hidden />
              جميع العوالم
            </Link>

            <span className="inline-flex w-fit items-center gap-[var(--sp-2)] rounded-full border border-white/20 bg-white/10 px-3 py-[var(--sp-2)] text-desc font-bold text-white/90 backdrop-blur-md sm:text-desc">
              <Sparkles className="size-3.5" aria-hidden />
              {world.eyebrow}
            </span>
            <h1 className="mt-1.5 max-w-3xl font-black leading-tight drop-shadow">{world.title}</h1>
            <p className="mt-1.5 max-w-2xl text-white/78">{world.description}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                to="/business/store/new"
                search={{ theme: demoWorldThemeId(world.id) }}
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-desc font-black text-slate-950 shadow-lg sm:min-h-11 sm:px-5 sm:text-sm"
              >
                <Plus className="size-4" aria-hidden />
                أنشئ متجرًا بهذا الأسلوب
              </Link>
              <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/25 bg-black/20 px-3.5 text-desc font-bold text-white backdrop-blur-md sm:min-h-11 sm:text-desc">
                <Layers3 className="size-4" aria-hidden />
                {world.stores.length} متاجر تجريبية
              </span>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1240px] px-4 py-5 sm:px-5 sm:py-8 lg:px-8">
          <div className="mb-3">
            <span className="text-desc font-bold text-primary sm:text-desc">نماذج داخلية جاهزة</span>
            <h2 className="mt-0.5 text-section font-black text-foreground sm:text-3xl">متاجر داخل {world.title}</h2>
            <p className="mt-0.5 text-desc leading-5 text-muted-foreground sm:text-sm sm:leading-6">
              كل متجر نموذج مستقل بصورة وهوية وأقسام مختلفة داخل العالم نفسه.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {world.stores.map((store, index) => (
              <article key={store.name} className="group overflow-hidden rounded-[1.25rem] border bg-card shadow-panel transition duration-300 hover:-translate-y-1 hover:shadow-raised" style={{ borderColor: `${world.accent}55` }}>
                <div className="relative aspect-[16/9] overflow-hidden bg-muted sm:aspect-[16/10]">
                  <img src={store.image} alt={store.name} loading={index === 0 ? "eager" : "lazy"} className="size-full object-cover transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" aria-hidden />
                  <span className="absolute start-3 top-3 rounded-full border border-white/25 bg-black/25 px-[var(--sp-3)] py-1 text-desc font-bold text-white backdrop-blur-md">متجر تجريبي</span>
                  <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3 text-white">
                    <div className="min-w-0">
                      <h3 className="truncate text-body font-black drop-shadow">{store.name}</h3>
                      <p className="mt-0.5 truncate text-desc text-white/75">{store.subtitle}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-desc font-bold backdrop-blur-md">
                      <Star className="size-3 fill-current" aria-hidden />
                      {store.rating}
                    </span>
                  </div>
                </div>

                <div className="p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-desc font-bold text-muted-foreground">{store.count}</span>
                    <span className="inline-flex items-center gap-1 text-desc font-bold text-primary">
                      <Eye className="size-3.5" aria-hidden />
                      معاينة داخلية
                    </span>
                  </div>
                  <div className="mt-[var(--sp-3)] flex flex-wrap gap-[var(--sp-2)]">
                    {store.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-secondary px-[var(--sp-3)] py-1 text-desc font-medium text-secondary-foreground sm:text-desc">{tag}</span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1240px] px-4 pb-3 sm:px-5 lg:px-8">
          <div className="rounded-[1.35rem] border border-border bg-card p-4 shadow-panel sm:p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <span className="text-desc font-bold text-primary sm:text-desc">استكشف المزيد</span>
                <h2 className="text-section mt-0.5 font-black text-foreground">عوالم أخرى</h2>
              </div>
              <Link to="/" className="inline-flex items-center gap-1 text-desc font-bold text-primary sm:text-desc">
                عرض الكل
                <ChevronLeft className="size-3.5" aria-hidden />
              </Link>
            </div>

            <div className="mt-3 flex gap-[var(--sp-3)] overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-5">
              {otherWorlds.map((item) => (
                <Link key={item.id} to="/demo-stores/$worldId" params={{ worldId: item.id }} className="relative aspect-[4/3] w-[42%] min-w-[42%] overflow-hidden rounded-[var(--r-card)] text-white sm:w-auto sm:min-w-0">
                  <img src={item.image} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-black/10" aria-hidden />
                  <span className="absolute inset-x-3 bottom-3 text-desc font-black">{item.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </MarketShell>
  );
}
