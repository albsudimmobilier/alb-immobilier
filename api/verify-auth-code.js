import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      .select('id, pin, statut_verifie')
      .eq('email', email)
      .single();

    if (fetchError || !profile) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Vérifier que le PIN correspond
    if (profile.pin !== pin) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Vérifier que le user est validé (pour les pros)
    if (profile.statut_verifie === false) {
      return res.status(403).json({ 
        error: 'Votre compte est en attente de validation. Nous vous confirmerons par email.' 
      });
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
