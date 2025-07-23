-- Verify SafeLoop schema deployment
-- Query to list all tables we created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'safeloop_accounts',
    'users', 
    'wearers',
    'wearer_settings',
    'devices',
    'caregiver_wearer_assignments',
    'caregiver_invitations',
    'help_requests',
    'notifications',
    'call_logs',
    'notification_preferences',
    'system_config'
)
ORDER BY table_name;

-- Also check if our helper functions exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'create_safeloop_account',
    'add_wearer',
    'register_device',
    'verify_device',
    'invite_caregiver',
    'accept_caregiver_invitation',
    'create_help_request'
)
ORDER BY routine_name;