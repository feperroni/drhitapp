import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import AdminNav from "./AdminNav";

export const metadata: Metadata = { title: "Dr. Hit · Console" };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [counts] = await sql<{ live: boolean; suggestions: number; comments: number }[]>`
    select exists(select 1 from shows where status = 'live') as live,
           (select count(*) from suggestions where status = 'new')::int as suggestions,
           (select count(*) from comments where not read)::int as comments`;

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="border-b border-line bg-panel lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-4 py-3 lg:py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-lg" />
          <div>
            <div className="font-display text-lg font-bold uppercase leading-none">
              Dr. <span className="text-hit">Hit</span>
            </div>
            <div className="text-xs text-muted">Console da banda</div>
          </div>
          <Link href="/" target="_blank" className="ml-auto text-xs text-muted hover:text-white lg:hidden">
            Ver app ↗
          </Link>
        </div>
        <AdminNav live={counts.live} suggestions={counts.suggestions} comments={counts.comments} />
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
