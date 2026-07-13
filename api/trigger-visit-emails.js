import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const brevoApiKey = process.env.BREVO_API_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Envoyer email via Brevo
async function sendEmailViaBrevo(to, subject, htmlContent) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': brevoApiKey,
    },
    body: JSON.stringify({
      to: [{ email: to }],
      from: { email: 'contact@albimmobilier.fr', name: 'ALB Immobilier' },
      subject,
      htmlContent,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Brevo error: ${error.message}`);
  }

  return response.json();
}

// Email: Demande de visite → VENDEUR
async function sendVisitRequestToVendor(visite) {
  const htmlContent = `
    <html>
      <body style="font-family: Montserrat, Arial; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4B1A3E; font-size: 28px;">ALB Immobilier</h1>
        </div>
        
        <div style="background-color: #F5F0EB; padding: 30px; border-radius: 8px;">
          <h2 style="color: #4B1A3E; margin-top: 0;">Nouvelle demande de visite!</h2>
          <p style="color: #666; margin: 20px 0;">Vous avez reçu une demande de visite pour votre bien.</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Acheteur:</strong> ${visite.nom_acheteur}</p>
            <p><strong>Email:</strong> ${visite.email_acheteur}</p>
            <p><strong>Téléphone:</strong> ${visite.telephone_acheteur}</p>
            <p><strong>Date demandée:</strong> ${new Date(visite.date_visite_demandee).toLocaleDateString('fr-FR')}</p>
            ${visite.resultat_simulateur_partage ? `<p><strong>Budget simulé partagé:</strong> Oui</p>` : ''}
            ${visite.courtier_demande ? `<p><strong>Courtier demandé:</strong> Oui</p>` : ''}
          </div>
          
          <p style="color: #666; margin: 20px 0;">Veuillez accepter ou refuser cette demande dans votre espace personnel.</p>
        </div>
        
        <div style="margin-top: 30px; text-align: center; color: #999; font-size: 12px;">
          <p>&copy; 2026 ALB Immobilier. Tous droits réservés.</p>
          <p>À la bien, toujours ✨</p>
        </div>
      </body>
    </html>
  `;

  await sendEmailViaBrevo(
    visite.vendeur_email,
    'Nouvelle demande de visite - ALB Immobilier',
    htmlContent
  );
}

// Email: Visite acceptée → ACHETEUR
async function sendVisitAcceptedToAcheteur(visite) {
  const htmlContent = `
    <html>
      <body style="font-family: Montserrat, Arial; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4B1A3E; font-size: 28px;">ALB Immobilier</h1>
        </div>
        
        <div style="background-color: #F5F0EB; padding: 30px; border-radius: 8px;">
          <h2 style="color: #4B1A3E; margin-top: 0;">Visite confirmée! ✅</h2>
          <p style="color: #666; margin: 20px 0;">Votre demande de visite a été acceptée!</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Date et heure:</strong> ${new Date(visite.date_visite_demandee).toLocaleString('fr-FR')}</p>
            <p><strong>Adresse:</strong> ${visite.bien_adresse}</p>
            <p><strong>Téléphone du vendeur:</strong> ${visite.vendeur_phone}</p>
          </div>
          
          <p style="color: #666; margin: 20px 0;">À bientôt!</p>
        </div>
        
        <div style="margin-top: 30px; text-align: center; color: #999; font-size: 12px;">
          <p>&copy; 2026 ALB Immobilier. Tous droits réservés.</p>
          <p>À la bien, toujours ✨</p>
        </div>
      </body>
    </html>
  `;

  await sendEmailViaBrevo(
    visite.email_acheteur,
    'Votre visite a été confirmée - ALB Immobilier',
    htmlContent
  );
}

// Email: Visite refusée → ACHETEUR
async function sendVisitRefusedToAcheteur(visite) {
  const htmlContent = `
    <html>
      <body style="font-family: Montserrat, Arial; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4B1A3E; font-size: 28px;">ALB Immobilier</h1>
        </div>
        
        <div style="background-color: #F5F0EB; padding: 30px; border-radius: 8px;">
          <h2 style="color: #4B1A3E; margin-top: 0;">Demande de visite refusée</h2>
          <p style="color: #666; margin: 20px 0;">Malheureusement, le vendeur n'a pas pu accepter votre demande de visite.</p>
          
          <p style="color: #666; margin: 20px 0;">N'hésitez pas à explorer d'autres biens sur notre plateforme!</p>
        </div>
        
        <div style="margin-top: 30px; text-align: center; color: #999; font-size: 12px;">
          <p>&copy; 2026 ALB Immobilier. Tous droits réservés.</p>
          <p>À la bien, toujours ✨</p>
        </div>
      </body>
    </html>
  `;

  await sendEmailViaBrevo(
    visite.email_acheteur,
    'Demande de visite refusée - ALB Immobilier',
    htmlContent
  );
}

// Email: Rappel J-1 → VENDEUR
async function sendVisitReminderToVendor(visite) {
  const htmlContent = `
    <html>
      <body style="font-family: Montserrat, Arial; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4B1A3E; font-size: 28px;">ALB Immobilier</h1>
        </div>
        
        <div style="background-color: #F5F0EB; padding: 30px; border-radius: 8px;">
          <h2 style="color: #4B1A3E; margin-top: 0;">Rappel: Visite demain!</h2>
          <p style="color: #666; margin: 20px 0;">Demain, vous avez une visite prévue!</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Acheteur:</strong> ${visite.nom_acheteur}</p>
            <p><strong>Date et heure:</strong> ${new Date(visite.date_visite_demandee).toLocaleString('fr-FR')}</p>
          </div>
          
          <p style="color: #666; margin: 20px 0;">N'oubliez pas de préparer votre bien!</p>
        </div>
        
        <div style="margin-top: 30px; text-align: center; color: #999; font-size: 12px;">
          <p>&copy; 2026 ALB Immobilier. Tous droits réservés.</p>
          <p>À la bien, toujours ✨</p>
        </div>
      </body>
    </html>
  `;

  await sendEmailViaBrevo(
    visite.vendeur_email,
    'Rappel: Votre visite est demain! - ALB Immobilier',
    htmlContent
  );
}

// Email: Rappel J-1 → ACHETEUR
async function sendVisitReminderToAcheteur(visite) {
  const htmlContent = `
    <html>
      <body style="font-family: Montserrat, Arial; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4B1A3E; font-size: 28px;">ALB Immobilier</h1>
        </div>
        
        <div style="background-color: #F5F0EB; padding: 30px; border-radius: 8px;">
          <h2 style="color: #4B1A3E; margin-top: 0;">Rappel: Votre visite est demain!</h2>
          <p style="color: #666; margin: 20px 0;">Votre visite est confirmée pour demain!</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Date et heure:</strong> ${new Date(visite.date_visite_demandee).toLocaleString('fr-FR')}</p>
            <p><strong>Adresse:</strong> ${visite.bien_adresse}</p>
          </div>
          
          <p style="color: #666; margin: 20px 0;">À demain!</p>
        </div>
        
        <div style="margin-top: 30px; text-align: center; color: #999; font-size: 12px;">
          <p>&copy; 2026 ALB Immobilier. Tous droits réservés.</p>
          <p>À la bien, toujours ✨</p>
        </div>
      </body>
    </html>
  `;

  await sendEmailViaBrevo(
    visite.email_acheteur,
    'Rappel: Votre visite est demain! - ALB Immobilier',
    htmlContent
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { visite_id, ancien_statut, nouveau_statut } = req.body;

    if (!visite_id) {
      return res.status(400).json({ error: 'visite_id is required' });
    }

    // Récupérer les infos complètes de la visite
    const { data: visite, error: fetchError } = await supabase
      .from('visites')
      .select('*')
      .eq('id', visite_id)
      .single();

    if (fetchError || !visite) {
      return res.status(404).json({ error: 'Visite not found' });
    }

    // Récupérer infos du bien
    const { data: bien } = await supabase
      .from('biens_immobiliers')
      .select('adresse_complete')
      .eq('id', visite.bien_id)
      .single();

    // Récupérer infos du vendeur
    const { data: vendeur } = await supabase
      .from('profiles')
      .select('email, telephone')
      .eq('id', visite.vendeur_id)
      .single();

    visite.bien_adresse = bien?.adresse_complete || 'Adresse non disponible';
    visite.vendeur_email = vendeur?.email || '';
    visite.vendeur_phone = vendeur?.telephone || '';

    // Envoyer les emails selon le statut
    if (nouveau_statut === 'demandee' && ancien_statut !== 'demandee') {
      // Nouvelle demande → Email au vendeur
      await sendVisitRequestToVendor(visite);
    } else if (nouveau_statut === 'acceptee' && ancien_statut === 'demandee') {
      // Acceptée → Email à l'acheteur
      await sendVisitAcceptedToAcheteur(visite);
    } else if (nouveau_statut === 'refusee' && ancien_statut === 'demandee') {
      // Refusée → Email à l'acheteur
      await sendVisitRefusedToAcheteur(visite);
    }

    // Rappel J-1 (trigger externe, mais mettre à jour le statut)
    if (nouveau_statut === 'rappel-j1') {
      await sendVisitReminderToVendor(visite);
      await sendVisitReminderToAcheteur(visite);
    }

    return res.status(200).json({
      success: true,
      message: 'Visit emails sent successfully',
      visite_id,
    });

  } catch (error) {
    console.error('Error in trigger-visit-emails:', error);
    return res.status(500).json({
      error: error.message || 'Failed to send visit emails',
    });
  }
}
