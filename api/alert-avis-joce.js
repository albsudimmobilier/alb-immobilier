import { createClient } from '@supabase/supabase-js'

const BREVO_API_KEY = process.env.BREVO_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const JOCE_EMAIL = 'contact@albimmobilier.fr'
const ADMIN_DASHBOARD_URL = 'https://reliable-crumble-6e286a.netlify.app/admin-dashboard.html'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

export default async (req, context) => {
  try {
    // Récupérer les données du webhook Supabase
    const { record } = await req.json()

    if (!record) {
      return new Response(
        JSON.stringify({ error: 'No record in webhook' }),
        { status: 400 }
      )
    }

    const { pro_id, particulier_id, note, texte } = record

    // Récupérer les infos du pro
    const { data: proData, error: proError } = await supabase
      .from('profiles')
      .select('prenom, nom, nom_entreprise')
      .eq('id', pro_id)
      .single()

    if (proError || !proData) {
      console.error('Error fetching pro:', proError)
      return new Response(
        JSON.stringify({ error: 'Pro not found' }),
        { status: 404 }
      )
    }

    // Récupérer les infos du particulier
    const { data: particulierData, error: particulierError } = await supabase
      .from('profiles')
      .select('prenom, nom')
      .eq('id', particulier_id)
      .single()

    if (particulierError) {
      console.error('Error fetching particulier:', particulierError)
      // Continuer même si pas trouvé (particulier anonyme possible)
    }

    // Préparer les données pour Brevo
    const brevoData = {
      to: [{ email: JOCE_EMAIL, name: 'Joce - ALB Immobilier' }],
      templateId: 13, // Template Alerte_Avis_Moderation
      params: {
        PRO_NOM: `${proData.prenom} ${proData.nom}`,
        PRO_ENTREPRISE: proData.nom_entreprise || 'ALB Immobilier',
        NOTE: note || 0,
        PARTICULIER_NOM: particulierData ? `${particulierData.prenom} ${particulierData.nom}` : 'Anonyme',
        TEXTE_AVIS: texte,
        LIEN_VALIDATION: ADMIN_DASHBOARD_URL
      }
    }

    // Envoyer via Brevo
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify(brevoData)
    })

    if (!brevoResponse.ok) {
      const errorData = await brevoResponse.text()
      console.error('Brevo error:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to send alert', details: errorData }),
        { status: 500 }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Alert sent to Joce',
        pro: `${proData.prenom} ${proData.nom}`,
        note: note
      }),
      { status: 200 }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
}
