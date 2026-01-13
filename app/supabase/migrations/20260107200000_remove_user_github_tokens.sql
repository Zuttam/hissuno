-- Cleanup: Remove old user-level GitHub tokens table
-- GitHub is now a project-level integration via GitHub App
-- Run this ONLY after all projects have been migrated to the new GitHub App integration

DROP TABLE IF EXISTS public.user_github_tokens CASCADE;
