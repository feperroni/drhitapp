"use client";

import { useEffect, useState } from "react";

/** Filtro instantâneo da lista do repertório (esconde linhas e seções sem resultado). */
export default function RepertoireFilter() {
  const [q, setQ] = useState("");
  useEffect(() => {
    const term = q.trim().toLowerCase();
    document.querySelectorAll<HTMLElement>("[data-section]").forEach((section) => {
      let visible = 0;
      section.querySelectorAll<HTMLElement>("[data-song]").forEach((li) => {
        const show = !term || li.dataset.song!.includes(term);
        li.style.display = show ? "" : "none";
        if (show) visible++;
      });
      section.style.display = visible ? "" : "none";
    });
  }, [q]);
  return <input className="input" placeholder="Filtrar repertório…" value={q} onChange={(e) => setQ(e.target.value)} />;
}
