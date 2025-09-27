// Version alternative avec require() pour plus de compatibilité
const path = require('path');

export default async function handler(req, res) {
  // Vérification de la méthode HTTP
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      message: 'Method not allowed',
      allowedMethods: ['GET', 'POST']
    });
  }

  try {
    // Vérification de l'autorisation
    const authHeader = req.headers.authorization;
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    if (!process.env.CRON_SECRET) {
      console.error("❌ [CRON HANDLER] CRON_SECRET non défini");
      return res.status(500).json({ 
        success: false,
        message: 'Configuration error - CRON_SECRET not set' 
      });
    }
    
    if (authHeader !== expectedAuth) {
      console.log("🔒 [CRON HANDLER] Tentative d'accès non autorisé");
      return res.status(401).json({ 
        success: false,
        message: 'Unauthorized' 
      });
    }

    console.log("🤖 [CRON HANDLER] Début exécution du cron job");
    console.log("📅 [CRON HANDLER] Timestamp:", new Date().toISOString());
    
    // Import du service avec require (plus compatible)
    let TransactionService;
    try {
      // Essayer différents chemins possibles
      const possiblePaths = [
        '../src/services/TransactionService.js',
        './src/services/TransactionService.js',
        path.resolve(process.cwd(), 'src/services/TransactionService.js')
      ];
      
      let serviceModule;
      for (const servicePath of possiblePaths) {
        try {
          console.log(`🔍 [CRON HANDLER] Tentative d'import depuis: ${servicePath}`);
          serviceModule = await import(servicePath);
          console.log(`✅ [CRON HANDLER] Import réussi depuis: ${servicePath}`);
          break;
        } catch (pathError) {
          console.log(`❌ [CRON HANDLER] Échec d'import depuis ${servicePath}:`, pathError.message);
          continue;
        }
      }
      
      if (!serviceModule) {
        throw new Error('Impossible de trouver TransactionService dans tous les chemins testés');
      }
      
      TransactionService = serviceModule.default || serviceModule;
      
      if (!TransactionService) {
        throw new Error('TransactionService export is undefined');
      }
      
      console.log("✅ [CRON HANDLER] TransactionService importé avec succès");
    } catch (importError) {
      console.error("❌ [CRON HANDLER] Erreur lors de l'import du service:", importError);
      return res.status(500).json({ 
        success: false, 
        error: "Service import failed",
        details: importError.message,
        stack: process.env.NODE_ENV === 'development' ? importError.stack : undefined
      });
    }

    // Vérification que la méthode forceReset existe
    if (typeof TransactionService.forceReset !== 'function') {
      console.error("❌ [CRON HANDLER] forceReset method not found");
      console.log("📋 [CRON HANDLER] Available methods:", Object.keys(TransactionService));
      return res.status(500).json({ 
        success: false,
        error: "Service method not available",
        details: "forceReset method not found on TransactionService",
        availableMethods: Object.keys(TransactionService)
      });
    }

    // Exécution du reset
    console.log("🔄 [CRON HANDLER] Exécution du forceReset...");
    const startTime = Date.now();
    
    const result = await TransactionService.forceReset('vercel-cron');
    
    const executionTime = Date.now() - startTime;
    console.log(`✅ [CRON HANDLER] Reset terminé avec succès en ${executionTime}ms`);
    console.log("📊 [CRON HANDLER] Résultat:", JSON.stringify(result, null, 2));
    
    return res.status(200).json({ 
      success: true, 
      data: result,
      executionTime: `${executionTime}ms`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ [CRON HANDLER] Erreur générale:", error);
    console.error("📋 [CRON HANDLER] Stack trace:", error.stack);
    
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}