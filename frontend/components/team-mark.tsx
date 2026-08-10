import type { Team } from "@/types/home";

/* API-Football supplies the remote logo URLs at runtime. */
/* eslint-disable @next/next/no-img-element */

type TeamMarkProps = {
  team: Team;
  size?: "sm" | "md";
};

export function TeamMark({ team, size = "md" }: TeamMarkProps) {
  const sizeClass = size === "sm" ? "size-9 text-[10px]" : "size-12 text-xs";

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-md border border-white/10 font-black text-white shadow-inner ${sizeClass}`}
      style={{ backgroundColor: team.accent }}
      aria-hidden="true"
    >
      {team.logo ? (
        <img
          alt={`${team.name} logo`}
          className="size-full rounded-md object-contain"
          src={team.logo}
        />
      ) : (
        team.shortName
      )}
    </span>
  );
}
