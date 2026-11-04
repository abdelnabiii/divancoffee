-- Make an existing Supabase Auth user an admin of the dashboard.
-- 1) Supabase → Authentication → Users → Add user → "Create new user" (email + a strong password, tick "Auto Confirm User").
-- 2) Put that email below and run this in the SQL Editor. Safe to run twice.
insert into public.admins (user_id, email)
select id, email from auth.users where lower(email) = lower('ADMIN_EMAIL_HERE')
on conflict (user_id) do nothing;

-- Check: should list the admin
select a.email, a.created_at from public.admins a;

-- To remove an admin later:
-- delete from public.admins where lower(email) = lower('someone@example.com');
