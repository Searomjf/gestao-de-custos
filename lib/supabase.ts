import { createClient } from '@supabase/supabase-js';

// Public browser credentials. Access to data remains protected by Supabase Auth
// and the project's Row Level Security policies.
const supabaseUrl = 'https://xgzpxqpyrvjsvzdxzjyb.supabase.co';
const supabasePublishableKey = 'sb_publishable_Ur6T59jgf9-MNmhBM52DyQ_myWOzs5O';

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

