-- Areen CUBs Studio — Bootstrap admin user
--
-- Run this ONCE after creating your first user in Supabase Auth UI.
--
-- Steps:
--   1. In Supabase dashboard → Authentication → Users → Add user
--      Email: yourusername@areencubs.studio
--      Password: (set one)
--      ✅ Auto Confirm User
--   2. Copy the new user's UUID (User ID column)
--   3. Replace the placeholders below and run this in the SQL editor.
--
-- After this runs, you can sign in to the app with username "yourusername" + that password.

insert into public.profiles (id, username, full_name, role)
values (
  'PASTE-USER-UUID-HERE'::uuid,
  'yourusername',                 -- the part before @areencubs.studio
  'Your Full Name',
  'admin'
)
on conflict (id) do update
  set role = excluded.role,
      username = excluded.username,
      full_name = excluded.full_name;
