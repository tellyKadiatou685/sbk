// api/cron.js (pas src/api/cron.js)

import TransactionService from '../src/services/TransactionService.js';

export default async function handler(req, res) {
  try {
    // Correction: utilisez req.headers au lieu de req.headers.get()
    const authHeader = req.headers.authorization;
    
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    console.log("🤖 [CRON HANDLER] Début exécution");
    
    const result = await TransactionService.forceReset('vercel-cron');
    
    console.log("✅ [CRON HANDLER] Reset terminé avec succès");
    return res.status(200).json({ success: true, data: result });

  } catch (error) {
    console.error("❌ [CRON HANDLER] Erreur:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}