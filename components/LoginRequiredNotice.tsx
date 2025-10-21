import Link from "next/link";
import type { ReactNode } from "react";

type LoginRequiredNoticeProps = {
  title: string;
  description: string;
  actionLabel: string;
  actionHref?: string;
  helper?: ReactNode;
};

export default function LoginRequiredNotice({
  title,
  description,
  actionLabel,
  actionHref = "/login",
  helper,
}: LoginRequiredNoticeProps) {
  return (
    <section className="relative flex min-h-[60vh] w-full items-center justify-center px-6 py-16">
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-background/70 to-transparent" aria-hidden />
      <div className="relative w-full max-w-xl rounded-3xl border border-border/50 bg-surface/85 px-10 py-16 text-center shadow-card backdrop-blur supports-[backdrop-filter]:bg-surface/75">
        <div className="mx-auto flex w-full flex-col items-center gap-5 text-foreground">
          <span className="rounded-full border border-border/60 bg-background/70 px-4 py-1 text-[11px] uppercase tracking-[0.35em] text-foreground/60">
            {title}
          </span>
          <p className="text-base leading-relaxed text-foreground/80">
            {description}
          </p>
          <Link
            href={actionHref}
            prefetch={false}
            className="inline-flex items-center justify-center rounded-full bg-accent px-8 py-3 text-xs font-semibold uppercase tracking-[0.32em] text-background transition hover:-translate-y-0.5 hover:bg-accent-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {actionLabel}
          </Link>
          {helper ? <div className="text-sm text-foreground/60">{helper}</div> : null}
        </div>
      </div>
    </section>
  );
}
