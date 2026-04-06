-- DANGER: This will delete ALL data from the billboards table.
-- Use CASCADE to also remove related records in other tables (like favorites, promos, etc.) that reference billboards.

TRUNCATE TABLE public.billboards CASCADE;

-- If you only want to delete the records but keep the table structure and sequences:
-- DELETE FROM public.billboards;
