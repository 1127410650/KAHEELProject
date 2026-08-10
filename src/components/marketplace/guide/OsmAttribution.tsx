/**
 * OpenStreetMap attribution. Required on every surface that shows coordinates,
 * a map link or map-derived data.
 */
export function OsmAttribution({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[10px] font-bold text-muted-foreground ${className}`}>
      © مساهمو{" "}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer noopener"
        className="underline decoration-dotted underline-offset-2 hover:text-primary"
      >
        OpenStreetMap
      </a>{" "}
      — بيانات متاحة بموجب ترخيص{" "}
      <a
        href="https://opendatacommons.org/licenses/odbl/"
        target="_blank"
        rel="noreferrer noopener"
        className="underline decoration-dotted underline-offset-2 hover:text-primary"
      >
        ODbL
      </a>
    </p>
  );
}
