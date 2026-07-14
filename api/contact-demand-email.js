import { createClient } from '@supabase/supabase-js'

const BREVO_API_KEY = process.env.BREVO_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DASHBOARD_URL = 'https://reliable-crumble-6e286a.netlify.app/espace-alb.html'

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

    const { pro_id, particulier_id, nom, email, telephone, message } = record

    // Récupérer les infos du pro
    const { data: proData, error: proError } = await supabase
      .from('profiles')
      .select('email, prenom, nom')
      .eq('id', pro_id)
      .single()

    if (proError || !proData) {
      console.error('Error fetching pro:', proError)
      return new Response(
        JSON.stringify({ error: 'Pro not found' }),
        { status: 404 }
      )
    }

    // Préparer les données pour Brevo
    const brevoData = {
      to: [{ email: proData.email, name: `${proData.prenom} ${proData.nom}` }],
      templateId: 123, // À REMPLACER PAR LE NUMÉRO RÉEL DU TEMPLATE BREVO
      params: {
        CONTACT_NOM: nom,
        CONTACT_EMAIL: email,
        CONTACT_TELEPHONE: telephone || 'Non fourni',
        CONTACT_MESSAGE: message,
        LIEN_DASHBOARD: DASHBOARD_URL
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
        JSON.stringify({ error: 'Failed to send email', details: errorData }),
        { status: 500 }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent to pro',
        pro_email: proData.email 
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
