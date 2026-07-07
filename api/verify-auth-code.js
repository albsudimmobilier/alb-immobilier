import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, pin } = req.body;
    if (!email || !pin) {
      return res.status(400).json({ error: 'Email and PIN are required' });
    }

    // Récupérer le profil et vérifier le PIN
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, pin')
      .eq('email', email)
      .single();

    if (fetchError || !profile) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Vérifier que le PIN correspond
    if (profile.pin !== pin) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    // PIN valide!
    return res.status(200).json({
      success: true,
      message: 'PIN verified',
      email,
      userId: profile.id,
    });
  } catch (error) {
    console.error('Error verifying PIN:', error);
    return res.status(500).json({
      error: error.message || 'Failed to verify PIN',
    });
  }
}
