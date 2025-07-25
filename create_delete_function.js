// Script to create the delete_wearer_safely function directly
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://lxdgwdbgyrfswopxbyjp.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZGd3ZGJneXJmc3dvcHhieWpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY4NDU5NiwiZXhwIjoyMDY4MjYwNTk2fQ.TzZm4R6bVFApFqS_EutEhJtBRTXY8ysEZY1ysXHGvNE' // service_role key

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createDeleteFunction() {
  const sql = `
    CREATE OR REPLACE FUNCTION delete_wearer_safely(
        p_wearer_id UUID
    ) RETURNS BOOLEAN AS $$
    DECLARE
        wearer_exists BOOLEAN := FALSE;
    BEGIN
        -- Check if wearer exists
        SELECT EXISTS(SELECT 1 FROM wearers WHERE id = p_wearer_id)
        INTO wearer_exists;
        
        IF NOT wearer_exists THEN
            RETURN FALSE;
        END IF;
        
        -- First, unassign any devices (set wearer_id to null)
        UPDATE devices 
        SET wearer_id = NULL,
            updated_at = NOW()
        WHERE wearer_id = p_wearer_id;
        
        -- Delete any caregiver-wearer assignments
        DELETE FROM caregiver_wearer_assignments 
        WHERE wearer_id = p_wearer_id;
        
        -- Delete any help requests for this wearer
        DELETE FROM help_requests 
        WHERE wearer_id = p_wearer_id;
        
        -- Delete wearer settings
        DELETE FROM wearer_settings 
        WHERE wearer_id = p_wearer_id;
        
        -- Finally, delete the wearer
        DELETE FROM wearers 
        WHERE id = p_wearer_id;
        
        RETURN TRUE;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    GRANT EXECUTE ON FUNCTION delete_wearer_safely TO service_role;
    GRANT EXECUTE ON FUNCTION delete_wearer_safely TO anon;
  `

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql })
    
    if (error) {
      console.error('Error creating function:', error)
    } else {
      console.log('✅ delete_wearer_safely function created successfully')
    }
  } catch (err) {
    // Try direct query approach
    try {
      const { data, error } = await supabase
        .from('dummy') // This will fail but we're using raw SQL
        .select('*')
        .limit(0)
      
      // Execute raw SQL using the connection
      const result = await supabase.rpc('exec', { sql })
      console.log('✅ Function created via alternative method')
    } catch (err2) {
      console.error('Could not create function:', err2)
      console.log('Please run this SQL manually in the Supabase dashboard:')
      console.log(sql)
    }
  }
}

createDeleteFunction()