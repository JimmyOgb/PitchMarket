import { ArrowUpRight } from "lucide-react";

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  actionLabel,
}: SectionHeaderProps) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 sm:mb-10 sm:flex-row sm:items-end">
      <div className="max-w-2xl">
        <p className="mb-3 text-xs font-bold uppercase text-lime">{eyebrow}</p>
        <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/55 sm:text-base">
          {description}
        </p>
      </div>
      {actionLabel ? (
        <a
          className="flex items-center gap-2 text-sm font-semibold text-white/70 transition-colors hover:text-lime"
          href="#markets"
        >
          {actionLabel}
          <ArrowUpRight className="size-4" />
        </a>
      ) : null}
    </div>
  );
}
