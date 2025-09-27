// api/cron.js - Handler complet pour Vercel Cron

export default async function handler(req, res) {
  console.log("🚀 [CRON] Handler démarré");
  console.log("📅 [CRON] Timestamp:", new Date().toISOString());
  console.log("🔧 [CRON] Method:", req.method);
  console.log("🔧 [CRON] URL:", req.url);
  
  // Vérification de la méthode HTTP
  if (req.method !== 'POST' && req.method !== 'GET') {
    console.log("❌ [CRON] Méthode non autorisée:", req.method);
    return res.status(405).json({ 
      success: false,
      message: 'Method not allowed',
      method: req.method,
      allowedMethods: ['GET', 'POST']
    });
  }

  try {
    // Étape 1: Vérification de CRON_SECRET
    console.log("🔐 [CRON] Vérification des variables d'environnement...");
    if (!process.env.CRON_SECRET) {
      console.error("❌ [CRON] CRON_SECRET non défini");
      return res.status(500).json({ 
        success: false,
        message: 'Configuration error - CRON_SECRET not set',
        step: 'env_check'
      });
    }
    console.log("✅ [CRON] CRON_SECRET présent");

    // Étape 2: Vérification de l'autorisation
    const authHeader = req.headers.authorization;
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    console.log("🔐 [CRON] Vérification autorisation...");
    console.log("🔐 [CRON] Auth header présent:", !!authHeader);
    
    if (authHeader !== expectedAuth) {
      console.log("❌ [CRON] Autorisation échouée");
      console.log("🔐 [CRON] Expected format: Bearer YOUR_SECRET");
      return res.status(401).json({ 
        success: false,
        message: 'Unauthorized',
        step: 'auth_check',
        hasAuthHeader: !!authHeader,
        hint: 'Use Authorization: Bearer YOUR_CRON_SECRET'
      });
    }
    console.log("✅ [CRON] Autorisation réussie");

    console.log("🤖 [CRON] Début exécution du cron job");
    
    // Étape 3: Import du TransactionService
    let TransactionService;
    try {
      console.log("📦 [CRON] Import du TransactionService...");
      
      // Essayer différents chemins possibles selon la structure
      const importPaths = [
        '../src/services/TransactionService.js',  // Chemin relatif depuis api/
        './src/services/TransactionService.js',   // Depuis la racine si CWD change
        '../TransactionService.js',               // Si dans src/ directement
        'src/services/TransactionService.js'      // Chemin absolu depuis racine
      ];
      
      let serviceModule = null;
      let successPath = null;
      
      for (const importPath of importPaths) {
        try {
          console.log(`🔍 [CRON] Tentative d'import: ${importPath}`);
          serviceModule = await import(importPath);
          successPath = importPath;
          console.log(`✅ [CRON] Import réussi depuis: ${importPath}`);
          break;
        } catch (pathError) {
          console.log(`❌ [CRON] Échec import ${importPath}:`, pathError.message);
          continue;
        }
      }
      
      if (!serviceModule) {
        throw new Error('Impossible de trouver TransactionService dans tous les chemins testés');
      }
      
      TransactionService = serviceModule.default || serviceModule;
      
      if (!TransactionService) {
        throw new Error('TransactionService export is undefined ou null');
      }
      
      console.log("✅ [CRON] TransactionService importé avec succès");
      console.log("📋 [CRON] Chemin utilisé:", successPath);
      
    } catch (importError) {
      console.error("❌ [CRON] Erreur lors de l'import du service:", importError);
      console.error("📋 [CRON] Stack trace import:", importError.stack);
      return res.status(500).json({ 
        success: false, 
        error: "Service import failed",
        details: importError.message,
        step: 'import_service',
        stack: process.env.NODE_ENV === 'development' ? importError.stack : undefined
      });
    }

    // Étape 4: Vérification que la méthode forceReset existe
    console.log("🔍 [CRON] Vérification des méthodes disponibles...");
    
    if (!TransactionService || typeof TransactionService !== 'object') {
      console.error("❌ [CRON] TransactionService n'est pas un objet valide");
      return res.status(500).json({ 
        success: false,
        error: "Invalid service object",
        serviceType: typeof TransactionService,
        step: 'validate_service'
      });
    }
    
    const availableMethods = Object.keys(TransactionService);
    console.log("📋 [CRON] Méthodes disponibles:", availableMethods);
    
    if (typeof TransactionService.forceReset !== 'function') {
      console.error("❌ [CRON] forceReset method not found");
      return res.status(500).json({ 
        success: false,
        error: "Service method not available",
        details: "forceReset method not found on TransactionService",
        availableMethods: availableMethods,
        step: 'validate_method'
      });
    }
    
    console.log("✅ [CRON] Méthode forceReset trouvée");

    // Étape 5: Exécution du reset
    console.log("🔄 [CRON] Exécution du forceReset...");
    const startTime = Date.now();
    
    const result = await TransactionService.forceReset('vercel-cron');
    
    const executionTime = Date.now() - startTime;
    console.log(`✅ [CRON] Reset terminé avec succès en ${executionTime}ms`);
    console.log("📊 [CRON] Résultat:", JSON.stringify(result, null, 2));
    
    return res.status(200).json({ 
      success: true, 
      data: result,
      executionTime: `${executionTime}ms`,
      timestamp: new Date().toISOString(),
      step: 'completed'
    });

  } catch (error) {
    console.error("❌ [CRON] Erreur générale:", error);
    console.error("📋 [CRON] Stack trace:", error.stack);
    
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString(),
      step: 'general_error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}