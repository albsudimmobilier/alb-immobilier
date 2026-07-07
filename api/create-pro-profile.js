import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, siret, nom_entreprise, telephone, adresse, role } = req.body;

    // Vérifier que tous les champs sont présents
    if (!email || !siret || !nom_entreprise || !telephone || !adresse || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Vérifier que l'email n'existe pas déjà
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingProfile) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Créer le profil pro
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert([
        {
          email,
          siret,
          nom_entreprise,
          telephone,
          adresse,
          role,
          statut_verifie: 'en_attente',
          date_creation: new Date().toISOString(),
        },
      ])
      .select();

    if (createError) {
      console.error('Supabase error:', createError);
      return res.status(500).json({ error: 'Failed to create profile' });
    }

    return res.status(201).json({
      success: true,
      message: 'Professional profile created',
      profile: newProfile[0],
    });
  } catch (error) {
    console.error('Error creating pro profile:', error);
    return res.status(500).json({
      error: error.message || 'Failed to create profile',
    });
  }
}
