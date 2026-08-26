-- Friend-code hardening for existing auth-created profile rows.
--
-- The social migration created trigger_assign_friend_code as a BEFORE INSERT
-- trigger. That works for new rows, but if a profile row already exists with a
-- null friend_code, later onboarding updates do not generate one. This keeps
-- the exact existing RPC/function name (public.generate_friend_code) and makes
-- assignment happen on both insert and update while preserving existing codes.

create or replace function public.assign_friend_code_on_insert()
returns trigger
language plpgsql
as $$
begin
  if new.friend_code is null then
    new.friend_code := public.generate_friend_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_assign_friend_code on public.profiles;
create trigger trigger_assign_friend_code
  before insert or update on public.profiles
  for each row
  when (new.friend_code is null)
  execute function public.assign_friend_code_on_insert();

update public.profiles
set friend_code = public.generate_friend_code()
where friend_code is null;
