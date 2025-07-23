-- Simple verification query - copy this to Supabase Dashboard SQL Editor
SELECT 'Tables created:' as status, count(*) as count 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('safeloop_accounts', 'users', 'wearers', 'devices', 'help_requests');

-- List the main SafeLoop tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%safeloop%' OR table_name IN ('users', 'wearers', 'devices', 'help_requests', 'notifications')
ORDER BY table_name;