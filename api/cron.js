// api/cron.js - Version avec service intégré pour éviter les problèmes d'import

import { PrismaClient } from '@prisma/client';

// Service intégré pour éviter les problèmes d'import
class EmbeddedTransactionService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  async forceReset(source = 'embedded-cron') {
    try {
      console.log(`🔄 [${source.toUpperCase()}] Début du reset forcé`);
      
      const today = new Date();
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(23, 59, 59, 999);

      console.log(`📅 [${source.toUpperCase()}] Reset pour le ${today.toLocaleDateString()}`);

      // 1. Archiver les transactions partenaires d'hier
      const archivedCount = await this.prisma.transaction.updateMany({
        where: {
          partenaireId: { not: null },
          createdAt: { lte: yesterday },
          // archived: { not: true } // Décommentez si vous avez ce champ
        },
        data: {
          // archived: true,
          // archivedAt: new Date()
          updatedAt: new Date() // Temporary field until you add archived
        }
      });

      console.log(`✅ [${source.toUpperCase()}] ${archivedCount.count} transactions archivées`);

      // 2. Reset des soldes vers initial
      const accounts = await this.prisma.account.findMany();
      let resetCount = 0;

      for (const account of accounts) {
        if (account.balance !== account.initialBalance) {
          await this.prisma.account.update({
            where: { id: account.id },
            data: { balance: account.initialBalance }
          });
          resetCount++;
        }
      }

      console.log(`✅ [${source.toUpperCase()}] ${resetCount} comptes réinitialisés`);

      // 3. Enregistrer la date de transfert
      await this.saveTransferDate(today.toDateString());

      const result = {
        success: true,
        date: today.toISOString(),
        archivedTransactions: archivedCount.count,
        resetAccounts: resetCount,
        source: source
      };

      console.log(`✅ [${source.toUpperCase()}] Reset terminé avec succès`);
      return result;

    } catch (error) {
      console.error(`❌ [${source.toUpperCase()}] Erreur reset:`, error);
      throw error;
    }
  }

  async saveTransferDate(dateString) {
    try {
      // Sauvegarder dans une table de configuration ou un fichier
      await this.prisma.configuration.upsert({
        where: { key: 'last_daily_transfer' },
        update: { value: dateString },
        create: { key: 'last_daily_transfer', value: dateString }
      });
    } catch (error) {
      console.log('Info: Configuration table not available, using alternative method');
      // Alternative si pas de table configuration
      console.log(`Last transfer date: ${dateString}`);
    }
  }
}

export default async function handler(req, res) {
  console.log("🚀 [CRON] Handler démarré (service intégré)");
  console.log("📅 [CRON] Timestamp:", new Date().toISOString());
  
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
    const isVercelCron = req.headers['user-agent']?.includes('vercel');
    
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

    console.log("🤖 [CRON] Début exécution avec service intégré");
    
    // Utiliser le service intégré
    const service = new EmbeddedTransactionService();
    const result = await service.forceReset('vercel-embedded-cron');
    
    console.log("✅ [CRON] Reset terminé avec service intégré");
    
    return res.status(200).json({ 
      success: true, 
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ [CRON] Erreur:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}