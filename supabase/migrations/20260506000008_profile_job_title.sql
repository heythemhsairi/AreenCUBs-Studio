-- Areen CUBs Studio — Job title on profiles
-- Lets each team member carry their role description (e.g. "Graphic
-- Designer / Editor") separately from the auth role enum.

alter table public.profiles
  add column if not exists job_title text;
