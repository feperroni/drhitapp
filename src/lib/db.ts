import postgres from "postgres";

const g = globalThis as unknown as { __sql?: postgres.Sql };

export const sql =
  g.__sql ??
  postgres(process.env.DATABASE_URL!, {
    max: Number(process.env.DB_POOL_SIZE ?? 10),
    onnotice: () => {},
    // datas (show_date) chegam como texto "AAAA-MM-DD", sem fuso
    types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
  });

if (process.env.NODE_ENV !== "production") g.__sql = sql;
