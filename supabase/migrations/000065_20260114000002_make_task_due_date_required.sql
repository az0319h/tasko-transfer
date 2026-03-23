-- Make tasks.due_date NOT NULL (required)
-- This migration makes the due_date column required for all tasks.
-- Note: This migration assumes there are no NULL values in tasks.due_date.
-- If NULL values exist, they must be handled before applying this migration.

-- First, verify there are no NULL values (this will fail if NULLs exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.tasks WHERE due_date IS NULL) THEN
    RAISE EXCEPTION 'Cannot make due_date NOT NULL: NULL values exist in tasks.due_date. Please update or delete these records first.';
  END IF;
END $$;

-- Set NOT NULL constraint
ALTER TABLE public.tasks 
  ALTER COLUMN due_date SET NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.tasks.due_date IS '마감일 (필수)';
