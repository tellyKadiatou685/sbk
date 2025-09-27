// src/api/cron.js

import TransactionService from '../services/TransactionService.js';

export default async function handler(request, response) {
  // ======================= SÉCURITÉ =======================
  // Cette partie est CRUCIALE. Elle garantit que seul Vercel peut appeler cette fonction.
  // On vérifie la présence d'un "secret" que seul Vercel connaît et envoie.
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Si le secret est manquant ou incorrect, on rejette la requête.
    return response.status(401).json({ message: 'Unauthorized' });
  }
  // ==========================================================

  try {
    console.log("🤖 [CRON HANDLER] Appel du Cron Job Vercel reçu. Lancement du service de reset...");
    
    // On appelle la fonction de reset principale
    const result = await TransactionService.forceReset('vercel-cron');
    
    // Si tout s'est bien passé, on renvoie une réponse positive.
    console.log("✅ [CRON HANDLER] Reset terminé avec succès via Vercel Cron.");
    return response.status(200).json({ success: true, data: result });

  } catch (error) {
    // Si une erreur se produit dans le service, on la capture ici.
    console.error("❌ [CRON HANDLER] Erreur lors de l'exécution du Cron Job Vercel:", error.message);
    
    // On renvoie une réponse d'erreur pour que Vercel sache que la tâche a échoué.
    return response.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
}

// Test en local uniquement
if (process.env.NODE_ENV !== 'production' && process.argv[2] === 'test') {
  // Simuler les objets request/response
  const mockRequest = {
    headers: { get: () => `Bearer ${process.env.CRON_SECRET}` }
  };
  const mockResponse = {
    status: (code) => ({ json: (data) => console.log(code, data) })
  };
  
  handler(mockRequest, mockResponse);
}