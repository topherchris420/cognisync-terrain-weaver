import { cn } from "@/lib/utils";

interface Props {
  active: boolean;
  caption?: string;
}

/** The sky closing in. Purely atmospheric — it never obscures the flow lines. */
export function StormVeil({ active, caption }: Props) {
  return (
    <div
      aria-hidden={!active}
      className={cn(
        "pointer-events-none absolute inset-0 z-[15] transition-opacity duration-1000",
        active ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="storm-veil absolute inset-0" />
      <div className="storm-rain absolute inset-0" />
      {caption && active && (
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-6">
          <p className="catalyst-serif text-center text-2xl text-foreground/90 drop-shadow-[0_2px_20px_rgba(0,0,0,0.8)]">
            {caption}
          </p>
        </div>
      )}
    </div>
  );
}