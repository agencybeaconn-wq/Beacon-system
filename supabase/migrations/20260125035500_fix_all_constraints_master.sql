-- MASTER FIX for User Deletion Issues

-- Helper macro to safely drop constraint
DO $$ 
BEGIN
    -- 1. FIX TASKS (tasks.assignee_id -> team_members.id)
    -- Tasks should NOT disappear when a user is deleted, just become unassigned
    BEGIN
        ALTER TABLE public.tasks
        DROP CONSTRAINT IF EXISTS tasks_assignee_id_fkey;
        
        ALTER TABLE public.tasks
        ADD CONSTRAINT tasks_assignee_id_fkey
        FOREIGN KEY (assignee_id)
        REFERENCES public.team_members(id)
        ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Table tasks or constraint issue ignored';
    END;

    -- 2. FIX NOTIFICATIONS (notifications.user_id -> auth.users.id)
    -- Notifications belong to the user, so they should be deleted
    BEGIN
        ALTER TABLE public.notifications
        DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

        ALTER TABLE public.notifications
        ADD CONSTRAINT notifications_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Table notifications issue ignored';
    END;

    -- 3. FIX AUDIT LOGS (audit_logs.actor_id -> auth.users.id)
    -- Logs should stay, but user becomes NULL
    BEGIN
        ALTER TABLE public.audit_logs
        DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;

        ALTER TABLE public.audit_logs
        ADD CONSTRAINT audit_logs_actor_id_fkey
        FOREIGN KEY (actor_id)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Table audit_logs issue ignored';
    END;

    -- 4. FIX FILES (files.uploaded_by -> auth.users.id)
    -- Files should stay, removing ownership
    BEGIN
        ALTER TABLE public.files
        DROP CONSTRAINT IF EXISTS files_uploaded_by_fkey;

        ALTER TABLE public.files
        ADD CONSTRAINT files_uploaded_by_fkey
        FOREIGN KEY (uploaded_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Table files issue ignored';
    END;
    
    -- 5. RE-APPLY TEAM MEMBERS CASCADE (Just in case)
    BEGIN
        ALTER TABLE public.team_members
        DROP CONSTRAINT IF EXISTS team_members_user_id_fkey;

        ALTER TABLE public.team_members
        ADD CONSTRAINT team_members_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Table team_members issue ignored';
    END;

    -- 6. FIX WORKSPACES (workspaces.owner_id -> auth.users.id)
    -- If an owner is deleted, their workspace should probably be deleted
    BEGIN
        ALTER TABLE public.workspaces
        DROP CONSTRAINT IF EXISTS workspaces_owner_id_fkey;

        ALTER TABLE public.workspaces
        ADD CONSTRAINT workspaces_owner_id_fkey
        FOREIGN KEY (owner_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Table workspaces issue ignored';
    END;

END $$;
