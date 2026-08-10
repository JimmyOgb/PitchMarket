import { CircleDot } from "lucide-react";

const footerLinks = [
  { label: "Matches", href: "#matches" },
  { label: "Markets", href: "#markets" },
  { label: "About", href: "#top" },
];

export function Footer() {
  return (
    <footer className="px-5 py-10 sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-lime text-ink">
            <CircleDot className="size-4" strokeWidth={2.4} />
          </span>
          <div>
            <p className="text-sm font-bold">PitchMarket</p>
            <p className="mt-0.5 text-xs text-white/35">
              Football, framed by probability.
            </p>
          </div>
        </div>
        <nav
          className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/45"
          aria-label="Footer navigation"
        >
          {footerLinks.map((link) => (
            <a
              className="transition-colors hover:text-white"
              href={link.href}
              key={link.label}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <p className="text-xs text-white/30">© 2026 PitchMarket</p>
      </div>
    </footer>
  );
}
