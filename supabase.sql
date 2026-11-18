-- Liste commune « Nos biens » pour https://insula.du-cray.eu/
-- À coller dans Supabase > SQL Editor > New query, puis « Run ».
create table if not exists public.biens (
  id uuid primary key default gen_random_uuid(),
  groupe text not null check (length(groupe) >= 12),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists biens_groupe_idx on public.biens (groupe);

alter table public.biens enable row level security;

-- Seules les lignes dont le « groupe » est égal au code envoyé par la page (en-tête x-groupe) sont visibles et modifiables.
create or replace function public.code_groupe() returns text language sql stable as $$
  select coalesce(current_setting('request.headers', true)::json->>'x-groupe', '')
$$;

drop policy if exists "lecture du groupe" on public.biens;
drop policy if exists "ajout dans le groupe" on public.biens;
drop policy if exists "modification du groupe" on public.biens;
drop policy if exists "suppression du groupe" on public.biens;
create policy "lecture du groupe" on public.biens for select to anon using (groupe = public.code_groupe());
create policy "ajout dans le groupe" on public.biens for insert to anon with check (groupe = public.code_groupe());
create policy "modification du groupe" on public.biens for update to anon using (groupe = public.code_groupe()) with check (groupe = public.code_groupe());
create policy "suppression du groupe" on public.biens for delete to anon using (groupe = public.code_groupe());

grant select, insert, update, delete on public.biens to anon;

-- ============ Novembre 2026 : à coller à son tour dans SQL Editor puis « Run » (sans risque pour les lignes existantes) ============

-- 1. « Nos biens » : forme et taille bornées pour les nouvelles écritures (NOT VALID : les lignes déjà là ne sont pas contrôlées)
alter table public.biens drop constraint if exists biens_data_objet;
alter table public.biens add constraint biens_data_objet check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 60000) not valid;
alter table public.biens drop constraint if exists biens_groupe_forme;
alter table public.biens add constraint biens_groupe_forme check (length(groupe) between 12 and 80) not valid;
-- au plus 500 biens par groupe (remplacé par le compteur de l'étape 6 : ce quota seul n'empêchait pas de remplir la base,
-- puisque n'importe qui peut inventer autant de codes qu'il veut)
create or replace function public.biens_quota() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.biens where groupe = new.groupe) >= 500 then
    raise exception 'quota de 500 biens atteint pour ce groupe';
  end if;
  return new;
end $$;
drop trigger if exists biens_quota on public.biens;
create trigger biens_quota before insert on public.biens for each row execute function public.biens_quota();
-- date de modification posée par la base, pas par le navigateur
create or replace function public.biens_maj() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists biens_maj on public.biens;
create trigger biens_maj before update on public.biens for each row execute function public.biens_maj();

-- 2. Annonces relevées chaque soir, lisibles seulement avec le code du groupe (plus besoin de les publier dans le dépôt public)
--    clés : ads (annonces du jour), hist (historique des prix), ficx (champs de calcul), fiches-<ville> (fiches complètes)
create table if not exists public.annonces (
  groupe text not null check (length(groupe) between 12 and 80),
  cle text not null check (cle ~ '^[a-z0-9-]{2,40}$'),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  maj timestamptz not null default now(),
  primary key (groupe, cle)
);
alter table public.annonces enable row level security;
drop policy if exists "annonces : lecture du groupe" on public.annonces;
drop policy if exists "annonces : écriture du groupe" on public.annonces;
drop policy if exists "annonces : mise à jour du groupe" on public.annonces;
create policy "annonces : lecture du groupe" on public.annonces for select to anon using (groupe = public.code_groupe());
create policy "annonces : écriture du groupe" on public.annonces for insert to anon with check (groupe = public.code_groupe());
create policy "annonces : mise à jour du groupe" on public.annonces for update to anon using (groupe = public.code_groupe()) with check (groupe = public.code_groupe());
grant select, insert, update on public.annonces to anon;

-- ============ 9 novembre 2026 : annonces visibles par tout le monde (à coller dans SQL Editor puis « Run ») ============
-- 3. La table « annonces » garde le code en clair dans « groupe » : elle reste fermée. Une vue en lecture seule n'en montre que
--    cle, data et maj, pour le groupe des annonces, repéré par l'empreinte de son code (jamais le code lui-même).
--    Le code de groupe ne sert plus qu'à « Nos biens » et aux réglages communs (table « biens », inchangée).
do $$ declare g text; begin
  select groupe into g from public.annonces where cle = 'ads' order by maj desc limit 1;
  if g is null then raise exception 'pas encore d''annonces : lancer d''abord python3 tools/supabase_annonces.py push'; end if;
  execute format('create or replace view public.annonces_publiques with (security_barrier = true) as select cle, data, maj from public.annonces where md5(groupe) = %L', md5(g));
end $$;
revoke all on public.annonces_publiques from public, anon, authenticated;
grant select on public.annonces_publiques to anon, authenticated;
-- seul un groupe qui a déjà des annonces peut en ajouter : personne d'autre ne peut en glisser
drop policy if exists "annonces : écriture du groupe" on public.annonces;
create policy "annonces : écriture du groupe" on public.annonces for insert to anon
  with check (groupe = public.code_groupe() and exists (select 1 from public.annonces a where a.groupe = public.code_groupe()));

-- ============ 10 novembre 2026 : le code de groupe n'est plus gardé en clair (à coller dans SQL Editor puis « Run ») ============
-- 4. Les tables ne gardent plus que l'empreinte (SHA-256) du code ; la page envoie toujours le code dans l'en-tête x-groupe,
--    la base calcule son empreinte et la compare. Rien ne change pour la page, l'outil d'envoi ni le serveur MCP.
--    Un code de moins de 12 caractères ne donne aucune empreinte : rien n'est lisible ni écrit sans un vrai code.
create or replace function public.code_groupe() returns text language sql stable as $$
  select case when length(h) >= 12 then encode(sha256(convert_to(h, 'UTF8')), 'hex') end
  from (select coalesce(current_setting('request.headers', true)::json->>'x-groupe', '') as h) x
$$;
-- les lignes existantes : le code devient son empreinte (une seule fois : une empreinte n'est pas recalculée)
update public.biens set groupe = encode(sha256(convert_to(groupe, 'UTF8')), 'hex') where groupe !~ '^[0-9a-f]{64}$';
update public.annonces set groupe = encode(sha256(convert_to(groupe, 'UTF8')), 'hex') where groupe !~ '^[0-9a-f]{64}$';
-- toute écriture prend l'empreinte du code envoyé, quoi que contienne la colonne « groupe » de la requête
create or replace function public.groupe_empreinte() returns trigger language plpgsql as $$
begin new.groupe = public.code_groupe(); return new; end $$;
drop trigger if exists a_groupe_empreinte on public.biens;
create trigger a_groupe_empreinte before insert or update on public.biens for each row execute function public.groupe_empreinte();
drop trigger if exists a_groupe_empreinte on public.annonces;
create trigger a_groupe_empreinte before insert or update on public.annonces for each row execute function public.groupe_empreinte();
-- la vue publique suit les nouvelles valeurs de « groupe »
do $$ declare g text; begin
  select groupe into g from public.annonces where cle = 'ads' order by maj desc limit 1;
  execute format('create or replace view public.annonces_publiques with (security_barrier = true) as select cle, data, maj from public.annonces where md5(groupe) = %L', md5(g));
end $$;
revoke all on public.annonces_publiques from public, anon, authenticated;
grant select on public.annonces_publiques to anon, authenticated;

-- ============ 11 novembre 2026 : remarques envoyées depuis l'app (à coller dans SQL Editor puis « Run ») ============
-- 5. Tout le monde peut envoyer une remarque (texte borné, 100 par jour au plus pour toute l'app) ; personne ne peut les lire
--    avec la clé publique, sauf le groupe qui relève les annonces (vue « retours_lecture », comme « annonces_publiques »).
create table if not exists public.retours (
  id bigserial primary key,
  cree timestamptz not null default now(),
  texte text not null check (length(texte) between 3 and 2000),
  prenom text check (prenom is null or length(prenom) <= 40),
  contexte text check (contexte is null or length(contexte) <= 300),
  groupe text
);
alter table public.retours enable row level security;
drop policy if exists "retours : envoi" on public.retours;
create policy "retours : envoi" on public.retours for insert to anon with check (true);
grant insert on public.retours to anon;
grant usage, select on sequence public.retours_id_seq to anon;
create or replace function public.retours_quota() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.retours where cree > now() - interval '1 day') >= 100 then
    raise exception 'trop de remarques aujourd''hui';
  end if;
  new.groupe = public.code_groupe(); new.cree = now();   -- empreinte du code de l'expéditeur (ou rien), date posée par la base
  return new;
end $$;
drop trigger if exists retours_quota on public.retours;
create trigger retours_quota before insert on public.retours for each row execute function public.retours_quota();
do $$ declare g text; begin
  select groupe into g from public.annonces where cle = 'ads' order by maj desc limit 1;
  execute format('create or replace view public.retours_lecture with (security_barrier = true) as select id, cree, texte, prenom, contexte, groupe = %L as nous from public.retours where public.code_groupe() = %L', g, g);
end $$;
revoke all on public.retours_lecture from public, anon, authenticated;
grant select on public.retours_lecture to anon;

-- ============ 18 novembre 2026 : la base ne peut plus être remplie par des groupes inventés (à coller dans SQL Editor puis « Run ») ============
-- 6. N'importe qui peut inventer un code de groupe : le quota de 500 biens par groupe ne bornait donc pas la base.
--    Un compteur fermé (une ligne par groupe qui a des biens) borne chaque groupe à 500 biens et 5 Mo, et la création de
--    groupes à 10 par 24 heures et 50 au total (au pire environ 250 Mo). Un groupe qui existe déjà n'est jamais gêné par
--    les autres. Revers assumé : un inconnu peut occuper les places libres et empêcher un nouveau foyer de créer sa liste ;
--    on libère une place en supprimant ses biens (voir docs/annonces-et-groupes.md). Sans risque pour les lignes existantes,
--    et peut être relancé.
create table if not exists public.biens_groupes (
  groupe text primary key,
  cree timestamptz not null default now(),
  nb integer not null default 0,
  octets bigint not null default 0
);
alter table public.biens_groupes enable row level security;          -- aucune règle : illisible et non modifiable par la page
revoke all on public.biens_groupes from public, anon, authenticated;

create or replace function public.biens_compte() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  t_old bigint := 0; t_new bigint := 0; dn integer := 0; dt bigint := 0; r_nb integer; r_oct bigint;
begin
  -- taille mesurée de la même façon avant et après (jsonb non compressé), pour ne compter que ce qui change vraiment
  if tg_op <> 'INSERT' then t_old := pg_column_size(old.data::text::jsonb); end if;
  if tg_op <> 'DELETE' then t_new := pg_column_size(new.data::text::jsonb); end if;

  if tg_op = 'INSERT' then
    dn := 1; dt := t_new;
  else
    if tg_op = 'DELETE' or new.groupe is distinct from old.groupe then
      -- la ligne quitte son groupe (suppression, ou changement de groupe)
      update public.biens_groupes set nb = nb - 1, octets = greatest(octets - t_old, 0) where groupe = old.groupe;
      delete from public.biens_groupes where groupe = old.groupe and nb <= 0;
      if tg_op = 'DELETE' then return null; end if;
      dn := 1; dt := t_new;                     -- elle arrive dans un autre groupe
    else
      dt := t_new - t_old;                      -- modification dans le même groupe
    end if;
  end if;

  update public.biens_groupes set nb = nb + dn, octets = greatest(octets + dt, 0)
    where groupe = new.groupe returning nb, octets into r_nb, r_oct;
  if not found then
    -- nouveau groupe : une création à la fois dans toute la base, puis on regarde s'il reste de la place
    perform pg_advisory_xact_lock(724001);
    update public.biens_groupes set nb = nb + dn, octets = greatest(octets + dt, 0)
      where groupe = new.groupe returning nb, octets into r_nb, r_oct;
    if not found then
      if (select count(*) from public.biens_groupes) >= 50
         or (select count(*) from public.biens_groupes where cree > now() - interval '1 day') >= 10 then
        raise exception 'pas de nouveau groupe possible pour le moment';
      end if;
      insert into public.biens_groupes (groupe, cree, nb, octets) values (new.groupe, now(), greatest(dn, 1), greatest(t_new, 0))
        returning nb, octets into r_nb, r_oct;
    end if;
  end if;

  -- seules les écritures qui ajoutent une ligne ou grossissent le groupe peuvent être refusées
  if dn > 0 and r_nb > 500 then raise exception 'quota de 500 biens atteint pour ce groupe'; end if;
  if dt > 0 and r_oct > 5000000 then raise exception 'quota de 5 Mo atteint pour ce groupe'; end if;
  return null;
end $$;
revoke all on function public.biens_compte() from public, anon, authenticated;

-- l'ancien quota (un comptage de tout le groupe à chaque ajout) est remplacé par le compteur
drop trigger if exists biens_quota on public.biens;
drop function if exists public.biens_quota();
drop trigger if exists biens_compte on public.biens;
create trigger biens_compte after insert or update or delete on public.biens for each row execute function public.biens_compte();

-- comptage des lignes déjà là, écritures suspendues le temps du calcul ; les groupes existants ne prennent pas de place du jour
lock table public.biens in share row exclusive mode;
insert into public.biens_groupes (groupe, cree, nb, octets)
  select groupe, now() - interval '2 days', count(*), sum(pg_column_size(data::text::jsonb)) from public.biens group by groupe
  on conflict (groupe) do update set nb = excluded.nb, octets = excluded.octets;
delete from public.biens_groupes g where not exists (select 1 from public.biens b where b.groupe = g.groupe);
