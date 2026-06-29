-- Create task_columns table
CREATE TABLE IF NOT EXISTS public.task_columns (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT 'bg-slate-500',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.task_columns ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Enable read access for authenticated users" ON public.task_columns
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.task_columns
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON public.task_columns
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON public.task_columns
    FOR DELETE
    TO authenticated
    USING (true);

-- Seed default columns if table is empty
INSERT INTO public.task_columns (id, title, position, color)
SELECT 'todo', 'A Fazer', 0, 'bg-slate-500'
WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'todo');

INSERT INTO public.task_columns (id, title, position, color)
SELECT 'in_progress', 'Em Andamento', 1, 'bg-blue-500'
WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'in_progress');

INSERT INTO public.task_columns (id, title, position, color)
SELECT 'validation', 'Validação', 2, 'bg-purple-500'
WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'validation');

INSERT INTO public.task_columns (id, title, position, color)
SELECT 'done', 'Concluído', 3, 'bg-green-500'
WHERE NOT EXISTS (SELECT 1 FROM public.task_columns WHERE id = 'done');
