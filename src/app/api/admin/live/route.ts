import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { countRequests, getDone, getLiveShow, getQueue } from "@/lib/shows";

export const dynamic = "force-dynamic";

export async function GET() {
  const show = await getLiveShow();
  if (!show) return NextResponse.json({ show: null });
  const [queue, done, total, [stats]] = await Promise.all([
    getQueue(show.id),
    getDone(show.id),
    countRequests(show.id),
    sql<{ visitors: number; requesters: number; comments: number }[]>`
      select (select count(distinct device_id) from visits where show_id = ${show.id})::int as visitors,
             (select count(distinct device_id) from song_requests where show_id = ${show.id})::int as requesters,
             (select count(*) from comments where show_id = ${show.id})::int as comments`,
  ]);
  return NextResponse.json({ show, queue, done, total, stats });
}
