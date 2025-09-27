// api/cron.js - Version debug pour l'authentification

export default async function handler(req, res) {
  console.log("🚀 [CRON] Handler démarré");
  console.log("📅 [CRON] Timestamp:", new Date().toISOString());
  console.log("🔧 [CRON] Method:", req.method);
  
  // Vérification de la méthode HTTP
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      message: 'Method not allowed',
      allowedMethods: ['GET', 'POST']
    });
  }

  try {
    // Debug des variables d'environnement
    console.log("🔐 [CRON] Debug variables d'environnement:");
    console.log("🔐 [CRON] CRON_SECRET présent:", !!process.env.CRON_SECRET);
    console.log("🔐 [CRON] CRON_SECRET longueur:", process.env.CRON_SECRET ? process.env.CRON_SECRET.length : 0);
    console.log("🔐 [CRON] CRON_SECRET premiers chars:", process.env.CRON_SECRET ? process.env.CRON_SECRET.substring(0, 8) + '...' : 'undefined');
    
    if (!process.env.CRON_SECRET) {
      console.error("❌ [CRON] CRON_SECRET non défini");
      return res.status(500).json({ 
        success: false,
        message: 'Configuration error - CRON_SECRET not set'
      });
    }

    // Debug des headers d'autorisation
    const authHeader = req.headers.authorization;
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    console.log("🔐 [CRON] Debug autorisation:");
    console.log("🔐 [CRON] Auth header reçu:", authHeader ? authHeader.substring(0, 20) + '...' : 'null');
    console.log("🔐 [CRON] Auth header longueur:", authHeader ? authHeader.length : 0);
    console.log("🔐 [CRON] Expected auth longueur:", expectedAuth.length);
    console.log("🔐 [CRON] Headers complets:", JSON.stringify(req.headers, null, 2));
    
    // Comparaison caractère par caractère pour debug
    if (authHeader && expectedAuth) {
      const matches = authHeader === expectedAuth;
      console.log("🔐 [CRON] Comparaison exacte:", matches);
      
      if (!matches) {
        console.log("🔐 [CRON] Différences détectées:");
        for (let i = 0; i < Math.max(authHeader.length, expectedAuth.length); i++) {
          if (authHeader[i] !== expectedAuth[i]) {
            console.log(`🔐 [CRON] Position ${i}: reçu '${authHeader[i]}' vs attendu '${expectedAuth[i]}'`);
            break;
          }
        }
      }
    }
    
    // VERSION TEMPORAIRE: Mode debug sans auth pour tester
    const isDebugMode = process.env.NODE_ENV === 'development' || req.headers['x-debug-mode'] === 'true';
    
    if (isDebugMode) {
      console.log("🚨 [CRON] MODE DEBUG ACTIVÉ - Auth bypassed");
    } else if (authHeader !== expectedAuth) {
      console.log("❌ [CRON] Autorisation échouée");
      return res.status(401).json({ 
        success: false,
        message: 'Unauthorized',
        debug: {
          hasAuthHeader: !!authHeader,
          authHeaderLength: authHeader ? authHeader.length : 0,
          expectedLength: expectedAuth.length,
          startsWithBearer: authHeader ? authHeader.startsWith('Bearer ') : false,
          cronSecretSet: !!process.env.CRON_SECRET
        }
      });
    }

    console.log("✅ [CRON] Autorisation OK ou mode debug");
    console.log("🤖 [CRON] Début exécution du cron job");
    
    // Import du TransactionService
    let TransactionService;
    try {
      console.log("📦 [CRON] Import du TransactionService...");
      
      const importPaths = [
        '../src/services/TransactionService.js',
        './src/services/TransactionService.js',
        '../TransactionService.js',
        'src/services/TransactionService.js'
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
        throw new Error('Impossible de trouver TransactionService');
      }
      
      TransactionService = serviceModule.default || serviceModule;
      
      if (!TransactionService) {
        throw new Error('TransactionService export is undefined');
      }
      
      console.log("✅ [CRON] TransactionService importé avec succès");
      
    } catch (importError) {
      console.error("❌ [CRON] Erreur import:", importError);
      return res.status(500).json({ 
        success: false, 
        error: "Service import failed",
        details: importError.message
      });
    }

    // Vérification de la méthode forceReset
    if (typeof TransactionService.forceReset !== 'function') {
      console.error("❌ [CRON] forceReset method not found");
      return res.status(500).json({ 
        success: false,
        error: "Service method not available",
        availableMethods: Object.keys(TransactionService)
      });
    }

    // Exécution du reset
    console.log("🔄 [CRON] Exécution du forceReset...");
    const startTime = Date.now();
    
    const result = await TransactionService.forceReset('vercel-cron');
    
    const executionTime = Date.now() - startTime;
    console.log(`✅ [CRON] Reset terminé avec succès en ${executionTime}ms`);
    
    return res.status(200).json({ 
      success: true, 
      data: result,
      executionTime: `${executionTime}ms`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ [CRON] Erreur générale:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}