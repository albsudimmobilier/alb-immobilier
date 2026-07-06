import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    // Récupérer le code de la base de données
    const { data: authCodeData, error: fetchError } = await supabase
      .from('auth_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .single();

    if (fetchError || !authCodeData) {
      return res.status(401).json({ error: 'Invalid code' });
    }

    // Vérifier que le code n'a pas expiré
    const now = new Date();
    const expiresAt = new Date(authCodeData.expires_at);

    if (now > expiresAt) {
      return res.status(401).json({ error: 'Code expired' });
    }

    // Code valide ! Supprimer le code utilisé
    await supabase
      .from('auth_codes')
      .delete()
      .eq('id', authCodeData.id);

    // Créer une session Supabase ou retourner un token
    // Pour l'instant, on retourne juste que c'est OK
    return res.status(200).json({
      success: true,
      message: 'Code verified',
      email,
    });
  } catch (error) {
    console.error('Error verifying auth code:', error);
    return res.status(500).json({
      error: error.message || 'Failed to verify code',
    });
  }
}
