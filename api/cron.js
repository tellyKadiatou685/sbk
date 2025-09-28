// api/cron.js - Version corrigée pour l'erreur BigInt

import { PrismaClient } from '@prisma/client';

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
      const archivedResult = await this.prisma.transaction.updateMany({
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

      const archivedCount = archivedResult.count;
      console.log(`✅ [${source.toUpperCase()}] ${archivedCount} transactions partenaires archivées`);

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
        console.log(`   ${acc.user.nomComplet} - ${acc.type}: balance=${this.convertFromInt(acc.balance)}F, initial=${this.convertFromInt(acc.initialBalance)}F`);
      });

      // ÉTAPE 3: CORRECTION - Transfert correct des soldes avec gestion BigInt
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

      // CORRECTION PRINCIPALE: Conversion sécurisée BigInt → Number
      const transferCount = Number(transferResult);
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
        console.log(`   ${acc.user.nomComplet} - ${acc.type}: balance=${this.convertFromInt(acc.balance)}F, initial=${this.convertFromInt(acc.initialBalance)}F, previous=${this.convertFromInt(acc.previousInitialBalance || 0)}F`);
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
            description: `Reset automatique ${source} - ${archivedCount} archivées, ${transferCount} comptes transférés`,
            envoyeurId: adminUser?.id || 'system'
          }
        });
      } catch (auditError) {
        console.log(`⚠️ [${source.toUpperCase()}] Erreur audit (non-bloquante):`, auditError.message);
      }

      const result = {
        success: true,
        date: today.toISOString(),
        archivedTransactions: archivedCount,
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
      console.log(`📊 [${source.toUpperCase()}] Résultats: ${archivedCount} transactions archivées, ${transferCount} comptes transférés`);
      
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
    } finally {
      // CORRECTION: Fermer la connexion Prisma
      await this.prisma.$disconnect();
    }
  }

  async saveTransferDate(dateString) {
    try {
      await this.prisma.systemConfig.upsert({
        where: { key: 'last_daily_transfer' },
        update: { value: dateString },
        create: { key: 'last_daily_transfer', value: dateString }
      });
      console.log(`✅ Date de reset sauvegardée: ${dateString}`);
    } catch (error) {
      console.log('Info: Table systemConfig non disponible, utilisation alternative');
      try {
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
    return Number(value || 0) / 100;
  }

  convertToInt(value) {
    return Math.round(Number(value || 0) * 100);
  }
}

export default async function handler(req, res) {
  console.log("🚀 [CRON] Handler démarré (version BigInt corrigée)");
  console.log("📅 [CRON] Timestamp:", new Date().toISOString());
  
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      message: 'Method not allowed',
      allowedMethods: ['GET', 'POST']
    });
  }

  let service;
  
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
    console.log("🤖 [CRON] Début exécution reset");
    
    service = new EmbeddedTransactionService();
    const startTime = Date.now();
    
    const result = await service.forceReset('vercel-embedded-cron');
    
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