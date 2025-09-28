// api/cron.js - Version finale avec reset corrigé

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

      // ÉTAPE 1: Archiver les transactions partenaires d'hier
      console.log(`📦 [${source.toUpperCase()}] Archivage des transactions partenaires...`);
      const archivedCount = await this.prisma.transaction.updateMany({
        where: {
          partenaireId: { not: null },
          createdAt: { lte: yesterday },
          OR: [
            { archived: { equals: false } },
            { archived: { equals: null } }
          ]
        },
        data: {
          archived: true,
          archivedAt: new Date()
        }
      });

      console.log(`✅ [${source.toUpperCase()}] ${archivedCount.count} transactions partenaires archivées`);

      // ÉTAPE 2: Logs AVANT transfert pour debug
      console.log(`🔍 [${source.toUpperCase()}] État des comptes AVANT transfert:`);
      const accountsBefore = await this.prisma.account.findMany({
        where: {
          user: { role: 'SUPERVISEUR', status: 'ACTIVE' }
        },
        select: {
          type: true,
          balance: true,
          initialBalance: true,
          user: { select: { nomComplet: true } }
        }
      });

      accountsBefore.forEach(acc => {
        console.log(`   ${acc.user.nomComplet} - ${acc.type}: balance=${acc.balance/100}F, initial=${acc.initialBalance/100}F`);
      });

      // ÉTAPE 3: CORRECTION - Transfert correct des soldes
      console.log(`💰 [${source.toUpperCase()}] Transfert des soldes: balance → initialBalance, puis balance = 0`);
      
      const transferResult = await this.prisma.$executeRaw`
        UPDATE accounts 
        SET "previousInitialBalance" = "initialBalance",
            "initialBalance" = balance, 
            balance = 0
        WHERE "userId" IN (
          SELECT id FROM users 
          WHERE role = 'SUPERVISEUR' AND status = 'ACTIVE'
        )
      `;

      // CORRECTION: Gérer BigInt de PostgreSQL
      const transferCount = typeof transferResult === 'bigint' ? Number(transferResult) : transferResult;
      console.log(`✅ [${source.toUpperCase()}] ${transferCount} comptes transférés`);

      // ÉTAPE 4: Logs APRÈS transfert pour vérification
      console.log(`🔍 [${source.toUpperCase()}] État des comptes APRÈS transfert:`);
      const accountsAfter = await this.prisma.account.findMany({
        where: {
          user: { role: 'SUPERVISEUR', status: 'ACTIVE' }
        },
        select: {
          type: true,
          balance: true,
          initialBalance: true,
          previousInitialBalance: true,
          user: { select: { nomComplet: true } }
        }
      });

      accountsAfter.forEach(acc => {
        console.log(`   ${acc.user.nomComplet} - ${acc.type}: balance=${acc.balance/100}F, initial=${acc.initialBalance/100}F, previous=${(acc.previousInitialBalance || 0)/100}F`);
      });

      // ÉTAPE 5: Enregistrer la date de transfert
      await this.saveTransferDate(`${today.toDateString()}-SUCCESS-${today.getHours()}h${today.getMinutes()}-${source}`);

      // ÉTAPE 6: Créer une transaction d'audit
      try {
        const adminUser = await this.prisma.user.findFirst({
          where: { role: 'ADMIN' },
          select: { id: true }
        });

        await this.prisma.transaction.create({
          data: {
            montant: 0,
            type: 'AUDIT_MODIFICATION',
            description: `Reset automatique ${source} - ${archivedCount.count} archivées, ${Number(transferResult)} comptes transférés`,
            envoyeurId: adminUser?.id || 'system'
          }
        });
      } catch (auditError) {
        console.log(`⚠️ [${source.toUpperCase()}] Erreur audit (non-bloquante):`, auditError.message);
      }

      const result = {
        success: true,
        date: today.toISOString(),
        archivedTransactions: archivedCount.count,
        resetAccounts: transferCount,
        source: source,
        message: `Reset ${source} exécuté avec succès`,
        details: {
          beforeTransfer: accountsBefore.length,
          afterTransfer: accountsAfter.length,
          transferExecuted: true
        }
      };

      console.log(`✅ [${source.toUpperCase()}] Reset terminé avec succès!`);
      console.log(`📊 [${source.toUpperCase()}] Résultats: ${archivedCount.count} transactions archivées, ${transferCount} comptes transférés`);
      
      return result;

    } catch (error) {
      console.error(`❌ [${source.toUpperCase()}] Erreur reset:`, error);
      console.error(`📋 [${source.toUpperCase()}] Stack trace:`, error.stack);
      
      // Enregistrer l'erreur
      try {
        const today = new Date();
        await this.saveTransferDate(`${today.toDateString()}-ERROR-${today.getHours()}h${today.getMinutes()}-${source}`);
      } catch (saveError) {
        console.error(`❌ [${source.toUpperCase()}] Impossible de sauvegarder l'erreur:`, saveError);
      }
      
      throw error;
    }
  }

  async saveTransferDate(dateString) {
    try {
      // Essayer la table systemConfig d'abord
      await this.prisma.systemConfig.upsert({
        where: { key: 'last_daily_transfer' },
        update: { value: dateString },
        create: { key: 'last_daily_transfer', value: dateString }
      });
      console.log(`✅ Date de reset sauvegardée: ${dateString}`);
    } catch (error) {
      console.log('Info: Table systemConfig non disponible, utilisation alternative');
      try {
        // Alternative: créer une transaction d'audit
        const adminUser = await this.prisma.user.findFirst({
          where: { role: 'ADMIN' },
          select: { id: true }
        });
        
        await this.prisma.transaction.create({
          data: {
            montant: 0,
            type: 'AUDIT_MODIFICATION',
            description: `[SYSTEM RESET] ${dateString}`,
            envoyeurId: adminUser?.id || 'system'
          }
        });
        console.log(`✅ Date de reset sauvegardée (alternative): ${dateString}`);
      } catch (altError) {
        console.error('Erreur sauvegarde date reset:', altError);
      }
    }
  }

  convertFromInt(value) {
    return Number(value) / 100;
  }

  convertToInt(value) {
    return Math.round(Number(value) * 100);
  }
}

export default async function handler(req, res) {
  console.log("🚀 [CRON] Handler démarré (service intégré corrigé)");
  console.log("📅 [CRON] Timestamp:", new Date().toISOString());
  console.log("🔧 [CRON] Method:", req.method);
  console.log("🔧 [CRON] Headers:", JSON.stringify({
    'user-agent': req.headers['user-agent'],
    'authorization': req.headers.authorization ? 'Bearer ***' : 'none'
  }));
  
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
    const isVercelCron = req.headers['user-agent']?.includes('vercel') || 
                        req.headers['x-vercel-cron'] === '1';
    
    console.log("🔐 [CRON] Vérification autorisation...");
    console.log("🔐 [CRON] Is Vercel Cron:", isVercelCron);
    console.log("🔐 [CRON] Has auth header:", !!authHeader);
    
    if (!process.env.CRON_SECRET) {
      console.error("❌ [CRON] CRON_SECRET non défini");
      return res.status(500).json({ 
        success: false,
        message: 'CRON_SECRET not set'
      });
    }
    
    // Bypass auth pour Vercel Cron automatique OU vérifier le token
    if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log("❌ [CRON] Autorisation échouée");
      return res.status(401).json({ 
        success: false,
        message: 'Unauthorized',
        debug: {
          isVercelCron,
          hasAuthHeader: !!authHeader,
          expectedFormat: 'Bearer YOUR_CRON_SECRET'
        }
      });
    }

    console.log("✅ [CRON] Autorisation OK");
    console.log("🤖 [CRON] Début exécution avec service intégré corrigé");
    
    // Utiliser le service intégré
    const service = new EmbeddedTransactionService();
    const startTime = Date.now();
    
    const result = await service.forceReset('vercel-embedded-cron');
    
    const executionTime = Date.now() - startTime;
    console.log(`✅ [CRON] Reset terminé avec service intégré en ${executionTime}ms`);
    
    return res.status(200).json({ 
      success: true, 
      data: result,
      executionTime: `${executionTime}ms`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ [CRON] Erreur:", error);
    console.error("📋 [CRON] Stack:", error.stack);
    
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}