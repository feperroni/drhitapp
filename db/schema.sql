-- Esquema do Dr. Hit App. Idempotente: roda a cada deploy (scripts/migrate.mjs).

create table if not exists settings (
  key   text primary key,
  value text not null
);

create table if not exists artists (
  id   serial primary key,
  name text not null unique
);

create table if not exists songs (
  id            serial primary key,
  title         text not null,
  artist_credit text not null,
  category      text not null,
  origin        text not null default 'nacional', -- nacional | internacional | medley
  medley_items  text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists song_artists (
  song_id   int not null references songs(id) on delete cascade,
  artist_id int not null references artists(id) on delete cascade,
  primary key (song_id, artist_id)
);

create table if not exists shows (
  id                  serial primary key,
  show_date           date not null,
  venue               text not null,
  status              text not null default 'draft' check (status in ('draft', 'live', 'closed')),
  requests_per_person int  not null default 1,
  window_minutes      int  not null default 60,
  max_requests        int,            -- limite total de pedidos aceitos no show (null = sem limite)
  requests_open       boolean not null default true,
  created_at          timestamptz not null default now(),
  published_at        timestamptz,
  closed_at           timestamptz
);
create unique index if not exists shows_one_live on shows (status) where status = 'live';

create table if not exists song_requests (
  id         serial primary key,
  show_id    int  not null references shows(id) on delete cascade,
  song_id    int  not null references songs(id) on delete cascade,
  device_id  text not null,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'played', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists song_requests_show on song_requests (show_id, status);
create index if not exists song_requests_device on song_requests (show_id, device_id, created_at);

create table if not exists visits (
  device_id  text not null,
  visit_date date not null,
  show_id    int references shows(id) on delete set null,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  hits       int not null default 1,
  primary key (device_id, visit_date)
);
create index if not exists visits_show on visits (show_id);

create table if not exists suggestions (
  id         serial primary key,
  show_id    int references shows(id) on delete set null,
  device_id  text not null,
  title      text not null,
  artist     text,
  status     text not null default 'new' check (status in ('new', 'added', 'dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists comments (
  id         serial primary key,
  show_id    int references shows(id) on delete set null,
  device_id  text not null,
  name       text,
  message    text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists push_subscriptions (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  label      text,
  created_at timestamptz not null default now()
);

create table if not exists promotions (
  id          serial primary key,
  show_id     int  not null references shows(id) on delete cascade,
  title       text not null,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists promotions_show on promotions (show_id);

-- Horário do show e se ele aparece na agenda (aba Shows) do app da plateia
alter table shows add column if not exists start_time time;
alter table shows add column if not exists end_time time;
alter table shows add column if not exists announce boolean not null default true;

-- Itens da banda à venda (copos, camisetas...) por show
create table if not exists merch_items (
  id          serial primary key,
  show_id     int  not null references shows(id) on delete cascade,
  name        text not null,
  description text,
  price_cents int  not null default 0,
  image       bytea,
  image_type  text,
  sold_out    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists merch_items_show on merch_items (show_id);
