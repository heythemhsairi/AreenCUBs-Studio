-- Extend team planning beyond workplace location. Existing rows and policies
-- are preserved; these values become available to the same self/admin writes.
alter type public.work_location add value if not exists 'absence';
alter type public.work_location add value if not exists 'vacation';

comment on column public.work_schedule.location is
  'Daily planning status: office, home, absence, or vacation.';
