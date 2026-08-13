-- Phase 2 (1 of 3) — widen user_role to the six roles the business actually has.
--
-- ALONE IN THIS FILE ON PURPOSE. `ALTER TYPE ... ADD VALUE` may run inside a
-- transaction, but the value it adds cannot be *used* until that transaction
-- commits. A policy referencing 'commercial'::user_role in the same file would
-- fail with 55P04, "unsafe use of new value of enum type". Splitting the
-- addition from the use is the only reliable ordering.
--
-- Forward-only and non-destructive: enum values are appended, none renamed or
-- removed, and no existing row changes. Every profile keeps the role it has.
--
-- Fail-closed by construction: adding a value grants nothing. A profile set to
-- 'commercial' reaches exactly nothing until migration 3 names that role in a
-- policy, and a role no policy names is denied everywhere.

alter type user_role add value if not exists 'commercial';
alter type user_role add value if not exists 'intern';
alter type user_role add value if not exists 'client';
