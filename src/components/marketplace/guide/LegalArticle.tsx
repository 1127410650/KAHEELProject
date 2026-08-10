/** Shared shell for the platform's legal pages: one title, one intro, blocks. */
export interface LegalBlock {
  h: string;
  p: string[];
}

export function LegalArticle({
  title,
  intro,
  blocks,
}: {
  title: string;
  intro: string;
  blocks: LegalBlock[];
}) {
  return (
    <main className="mx-auto w-full max-w-[820px] px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-page font-black">{title}</h1>
      <p className="mt-1.5 text-desc font-bold leading-6 text-muted-foreground">{intro}</p>
      <div className="mt-4 space-y-3">
        {blocks.map((block) => (
          <section key={block.h} className="rounded-2xl border border-border/80 bg-card p-4">
            <h2 className="text-section font-black">{block.h}</h2>
            <div className="mt-1.5 space-y-1.5">
              {block.p.map((line) => (
                <p key={line} className="text-desc leading-6 text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
