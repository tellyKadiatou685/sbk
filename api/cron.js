// api/cron.js - Version simplifiée utilisant TransactionService existant

import TransactionService from '../services/TransactionService.js';

export default async function handler(req, res) {
  console.log("🚀 [CRON] Handler démarré");
  console.log("📅 [CRON] Timestamp:", new Date().toISOString());
  
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    // Vérification de l'autorisation
    const authHeader = req.headers.authorization;
    const isVercelCron = req.headers['user-agent']?.includes('vercel') || 
                        req.headers['x-vercel-cron'] === '1';
    
    if (!process.env.CRON_SECRET) {
      return res.status(500).json({ 
        success: false,
        message: 'CRON_SECRET not set'
      });
    }
    
    if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ 
        success: false,
        message: 'Unauthorized'
      });
    }

    console.log("✅ [CRON] Autorisation OK");
    console.log("🤖 [CRON] Utilisation du TransactionService existant");
    
    const startTime = Date.now();
    
    // CORRECTION : Utiliser directement le service existant qui a déjà toute la logique
    const result = await TransactionService.forceReset('vercel-cron');
    
    const executionTime = Date.now() - startTime;
    console.log(`✅ [CRON] Reset terminé en ${executionTime}ms`);
    
    return res.status(200).json({ 
      success: true, 
      data: result,
      executionTime: `${executionTime}ms`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ [CRON] Erreur:", error.message);
    
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}