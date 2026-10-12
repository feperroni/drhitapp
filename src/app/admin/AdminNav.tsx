"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNav({ live, suggestions, comments }: { live: boolean; suggestions: number; comments: number }) {
  const path = usePathname();
  const items = [
    { href: "/admin/ao-vivo", label: "Ao vivo", icon: "🔴", badge: live ? "LIVE" : null },
    { href: "/admin", label: "Visão geral", icon: "📊" },
    { href: "/admin/shows", label: "Shows", icon: "🎤" },
    { href: "/admin/repertorio", label: "Repertório", icon: "🎵" },
    { href: "/admin/sugestoes", label: "Sugestões", icon: "💡", badge: suggestions || null },
    { href: "/admin/recados", label: "Recados", icon: "💬", badge: comments || null },
    { href: "/admin/config", label: "Configurações", icon: "⚙️" },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none] lg:flex-col lg:px-3">
      {items.map((it) => {
        const active = it.href === "/admin" ? path === "/admin" : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-panel-2 text-white" : "text-muted hover:bg-panel-2 hover:text-white"
            }`}
          >
            <span>{it.icon}</span>
            {it.label}
            {it.badge != null && (
              <span
                className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  it.badge === "LIVE" ? "bg-hit text-white" : "bg-gold text-black"
                }`}
              >
                {it.badge}
              </span>
            )}
          </Link>
        );
      })}
      <Link href="/" target="_blank" className="hidden px-3 py-2 text-sm text-muted hover:text-white lg:mt-4 lg:block">
        Ver app da plateia ↗
      </Link>
    </nav>
  );
}
