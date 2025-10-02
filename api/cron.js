// api/cron.js - VERSION SYNCHRONISÉE AVEC TransactionService.js

import { PrismaClient } from '@prisma/client';

// =====================================
// CONFIGURATION CENTRALISÉE 
// =====================================
const RESET_CONFIG = {
  hour: 0,
  minute: 0,
  windowMinutes: 5
};

// =====================================
// UTILITAIRES DE CONVERSION IDENTIQUES
// =====================================
function convertFromInt(value) {
  return Number(value || 0) / 100;
}

function convertToInt(value) {
  return Math.round(Number(value || 0) * 100);
}

// =====================================
// LOGIQUE DE DATES CORRIGÉE
// =====================================
function getArchiveRange() {
  const now = new Date();
  
  // Pour archivage : transactions de AVANT-HIER (pas d'hier !)
  // Calculer le reset d'avant-hier
  const dayBeforeYesterdayResetTime = new Date(now);
  dayBeforeYesterdayResetTime.setDate(now.getDate() - 2); // AVANT-HIER
  dayBeforeYesterdayResetTime.setHours(RESET_CONFIG.hour, RESET_CONFIG.minute, 0, 0);
  
  // Calculer le reset d'hier  
  const yesterdayResetTime = new Date(now);
  yesterdayResetTime.setDate(now.getDate() - 1);
  yesterdayResetTime.setHours(RESET_CONFIG.hour, RESET_CONFIG.minute, 0, 0);
  
  // Archiver = transactions d'AVANT-HIER (du reset d'avant-hier jusqu'au reset d'hier)
  const startOfArchive = dayBeforeYesterdayResetTime;
  const endOfArchive = new Date(yesterdayResetTime.getTime() - 1000); // 1 seconde avant reset d'hier
  
  console.log(`📅 [CRON ARCHIVE RANGE] AVANT-HIER: ${startOfArchive.toISOString()} -> ${endOfArchive.toISOString()}`);
  console.log(`📝 [CRON ARCHIVE] Les transactions d'HIER restent visibles et ne sont PAS archivées`);
  
  return { startOfArchive, endOfArchive };
}

// =====================================
// FONCTION D'ARCHIVAGE CORRIGÉE - Archive seulement AVANT-HIER
// =====================================
async function archivePartnerTransactionsDynamic(prisma) {
  try {
    const { startOfArchive, endOfArchive } = getArchiveRange();
    
    console.log(`📦 [CRON ARCHIVE] Archivage des transactions partenaires d'AVANT-HIER seulement:`, {
      start: startOfArchive.toISOString(),
      end: endOfArchive.toISOString()
    });
    
    const result = await prisma.transaction.updateMany({
      where: {
        createdAt: {
          gte: startOfArchive,
          lte: endOfArchive
        },
        partenaireId: { not: null },
        type: { in: ['DEPOT', 'RETRAIT'] },
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
    
    console.log(`✅ [CRON ARCHIVE] ${result.count} transactions d'AVANT-HIER archivées`);
    console.log(`📝 [CRON ARCHIVE] Les transactions d'HIER restent visibles et accessibles`);
    return result.count;
    
  } catch (error) {
    console.error('❌ [CRON ARCHIVE] Erreur:', error);
    throw error;
  }
}

// =====================================
// FONCTION DE TRANSFERT IDENTIQUE AU SERVICE  
// =====================================
async function transferBalancesToInitial(prisma) {
  try {
    console.log('🔄 [CRON TRANSFER] Début du transfert des soldes...');
    
    // Logs pour debug - IDENTIQUE au service
    const accountsBeforeTransfer = await prisma.account.findMany({
      where: {
        userId: {
          in: await prisma.user.findMany({
            where: { role: 'SUPERVISEUR', status: 'ACTIVE' },
            select: { id: true }
          }).then(users => users.map(u => u.id))
        }
      },
      select: {
        id: true,
        type: true,
        balance: true,
        initialBalance: true,
        previousInitialBalance: true,
        user: { select: { nomComplet: true } }
      }
    });
    
    console.log(`🔍 [CRON TRANSFER DEBUG] Comptes avant transfert:`, 
      accountsBeforeTransfer.map(acc => ({
        user: acc.user.nomComplet,
        type: acc.type,
        balance: convertFromInt(acc.balance),
        initialBalance: convertFromInt(acc.initialBalance),
        previousInitialBalance: acc.previousInitialBalance ? convertFromInt(acc.previousInitialBalance) : null
      }))
    );
    
    // TRANSFERT IDENTIQUE au service : de TOUS les soldes
    const result = await prisma.$executeRaw`
      UPDATE accounts 
      SET "previousInitialBalance" = "initialBalance",
          "initialBalance" = balance, 
          balance = 0 
      WHERE "userId" IN (
        SELECT id FROM users 
        WHERE role = 'SUPERVISEUR' AND status = 'ACTIVE'
      )
    `;
    
    // Logs après transfert - IDENTIQUE au service
    const accountsAfterTransfer = await prisma.account.findMany({
      where: {
        userId: {
          in: await prisma.user.findMany({
            where: { role: 'SUPERVISEUR', status: 'ACTIVE' },
            select: { id: true }
          }).then(users => users.map(u => u.id))
        }
      },
      select: {
        id: true,
        type: true,
        balance: true,
        initialBalance: true,
        previousInitialBalance: true,
        user: { select: { nomComplet: true } }
      }
    });
    
    console.log(`✅ [CRON TRANSFER DEBUG] Comptes après transfert:`, 
      accountsAfterTransfer.map(acc => ({
        user: acc.user.nomComplet,
        type: acc.type,
        balance: convertFromInt(acc.balance),
        initialBalance: convertFromInt(acc.initialBalance),
        previousInitialBalance: acc.previousInitialBalance ? convertFromInt(acc.previousInitialBalance) : null
      }))
    );
    
    const transferCount = Number(result);
    console.log(`✅ [CRON TRANSFER] Transfert terminé pour ${transferCount} comptes actifs`);
    
    return transferCount;
    
  } catch (error) {
    console.error('❌ [CRON TRANSFER] Erreur:', error);
    throw error;
  }
}

// =====================================
// FONCTION DE NETTOYAGE IDENTIQUE AU SERVICE
// =====================================
async function cleanupDashboardAfterReset(prisma) {
  try {
    console.log('🧹 [CRON CLEANUP] Nettoyage post-reset...');
    
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayResetTime = new Date(now);
    todayResetTime.setHours(RESET_CONFIG.hour, RESET_CONFIG.minute, 0, 0);
    
    const cleanupResult = await prisma.transaction.updateMany({
      where: {
        createdAt: {
          gte: startOfToday,
          lt: todayResetTime
        },
        partenaireId: { not: null },
        archived: { not: true }
      },
      data: {
        archived: true,
        archivedAt: now
      }
    });
    
    console.log(`✅ [CRON CLEANUP] ${cleanupResult.count} transactions partenaires nettoyées`);
    return cleanupResult.count;
    
  } catch (error) {
    console.error('❌ [CRON CLEANUP] Erreur:', error);
    throw error;
  }
}

// =====================================
// SAUVEGARDE DE LA DATE DE RESET IDENTIQUE AU SERVICE
// =====================================
async function saveResetDate(prisma, dateString) {
  try {
    await prisma.systemConfig.upsert({
      where: { key: 'last_reset_date' },
      update: { value: dateString },
      create: { 
        key: 'last_reset_date', 
        value: dateString 
      }
    });
    console.log(`✅ [CRON SAVE] Date de reset sauvegardée: ${dateString}`);
  } catch (error) {
    console.log('[CRON SAVE] Table systemConfig non disponible, utilisation alternative');
    
    try {
      const adminUser = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true }
      });
      
      await prisma.transaction.create({
        data: {
          montant: 0,
          type: 'AUDIT_MODIFICATION',
          description: `[SYSTEM RESET] ${dateString}`,
          envoyeurId: adminUser?.id || 'system'
        }
      });
      console.log(`✅ [CRON SAVE] Date de reset sauvegardée (alternative): ${dateString}`);
    } catch (altError) {
      console.error('[CRON SAVE] Erreur saveResetDate (alternative):', altError);
    }
  }
}

// =====================================
// NOTIFICATIONS IDENTIQUES AU SERVICE
// =====================================
async function notifyDashboardRefresh(prisma, resetDetails = {}) {
  try {
    console.log('📢 [CRON NOTIFICATIONS] Envoi notifications de reset...');
    
    const now = new Date();
    const { archivedCount = 0, cleanedCount = 0 } = resetDetails;
    
    const [activeSupervisors, adminUsers, activePartners] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'SUPERVISEUR', status: 'ACTIVE' },
        select: { id: true, nomComplet: true }
      }),
      prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true, nomComplet: true }
      }),
      prisma.user.findMany({
        where: { role: 'PARTENAIRE', status: 'ACTIVE' },
        select: { id: true, nomComplet: true }
      })
    ]);
    
    const notifications = [];
    
    // Notifications superviseurs - IDENTIQUES au service
    activeSupervisors.forEach(supervisor => {
      notifications.push({
        userId: supervisor.id,
        title: 'Dashboard Actualisé',
        message: `Reset quotidien effectué à ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}. Vos soldes ont été transférés et les données mises à jour.`,
        type: 'RESET_SUPERVISOR'
      });
    });
    
    // Notifications admins - IDENTIQUES au service
    adminUsers.forEach(admin => {
      notifications.push({
        userId: admin.id,
        title: 'Reset Quotidien Terminé',
        message: `Reset effectué avec succès : ${archivedCount} transactions archivées, ${cleanedCount} nettoyées. Tous les dashboards sont à jour.`,
        type: 'RESET_ADMIN'
      });
    });
    
    // Notifications partenaires - IDENTIQUES au service
    activePartners.forEach(partner => {
      notifications.push({
        userId: partner.id,
        title: 'Nouveau Jour Commencé',
        message: `Les compteurs ont été remis à zéro. Nouveau cycle de transactions disponible.`,
        type: 'RESET_PARTNER'
      });
    });
    
    // Créer toutes les notifications
    const notificationPromises = notifications.map(notif => 
      prisma.notification.create({ data: notif })
    );
    
    const results = await Promise.allSettled(notificationPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`✅ [CRON NOTIFICATIONS] ${successful} notifications envoyées, ${failed} échecs`);
    
    return {
      totalNotifications: notifications.length,
      successful,
      failed,
      details: resetDetails
    };
    
  } catch (error) {
    console.error('❌ [CRON NOTIFICATIONS] Erreur:', error);
    return {
      error: error.message,
      totalNotifications: 0,
      successful: 0,
      failed: 0
    };
  }
}

// =====================================
// FONCTION PRINCIPALE DE RESET - IDENTIQUE AU SERVICE
// =====================================
async function executeReset(source = 'vercel-cron') {
  const prisma = new PrismaClient();
  
  try {
    console.log(`🤖 [CRON RESET ${source.toUpperCase()}] Lancement du reset automatique...`);
    
    const now = new Date();
    
    // ÉTAPE 1 : Archiver les transactions partenaires d'hier - IDENTIQUE au service
    console.log('📦 [CRON RESET] Étape 1/5 - Archivage des transactions partenaires...');
    const archivedCount = await archivePartnerTransactionsDynamic(prisma);
    
    // ÉTAPE 2 : Transférer les soldes (sortie → début) - IDENTIQUE au service
    console.log('💰 [CRON RESET] Étape 2/5 - Transfert des soldes...');
    const transferCount = await transferBalancesToInitial(prisma);
    
    // ÉTAPE 3 : Nettoyage des données temporaires - IDENTIQUE au service
    console.log('🧹 [CRON RESET] Étape 3/5 - Nettoyage des données...');
    const cleanedCount = await cleanupDashboardAfterReset(prisma);
    
    // ÉTAPE 4 : Enregistrer le succès du reset - IDENTIQUE au service
    console.log('💾 [CRON RESET] Étape 4/5 - Enregistrement du reset...');
    const resetKey = `${now.toDateString()}-SUCCESS-${now.getHours()}h${now.getMinutes()}-${source}`;
    await saveResetDate(prisma, resetKey);
    
    // Créer une transaction d'audit - IDENTIQUE au service
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true }
    });
    
    await prisma.transaction.create({
      data: {
        montant: 0,
        type: 'AUDIT_MODIFICATION',
        description: `Reset automatique ${source} - ${archivedCount} archivées, ${transferCount} comptes, ${cleanedCount} nettoyées`,
        envoyeurId: adminUser?.id || 'system'
      }
    });
    
    console.log(`✅ [CRON RESET ${source.toUpperCase()}] Reset terminé avec succès!`);
    console.log(`📊 [CRON RESET] Résultats: ${archivedCount} transactions archivées, ${transferCount} comptes transférés, ${cleanedCount} nettoyées`);
    
    // ÉTAPE 5 : Envoyer les notifications - IDENTIQUE au service
    console.log('📢 [CRON RESET] Étape 5/5 - Envoi des notifications...');
    const notificationResult = await notifyDashboardRefresh(prisma, {
      archivedCount,
      cleanedCount,
      transferCount,
      executedAt: now.toISOString()
    });
    
    console.log(`✅ [CRON RESET] ${notificationResult.successful} notifications envoyées sur ${notificationResult.totalNotifications}`);
    
    return {
      success: true,
      archivedTransactions: archivedCount,
      transferredAccounts: transferCount,
      cleanedTransactions: cleanedCount,
      executedAt: now.toISOString(),
      source,
      notifications: notificationResult,
      resetConfig: RESET_CONFIG,
      message: `Reset automatique ${source} exécuté avec succès`
    };
    
  } catch (error) {
    console.error(`❌ [CRON RESET ${source.toUpperCase()}] Erreur:`, error);
    
    // Enregistrer l'erreur - IDENTIQUE au service
    try {
      const now = new Date();
      const errorKey = `${now.toDateString()}-ERROR-${now.getHours()}h${now.getMinutes()}-${source}`;
      await saveResetDate(prisma, errorKey);
    } catch (saveError) {
      console.error('❌ [CRON RESET] Impossible de sauvegarder l\'erreur:', saveError);
    }
    
    throw error;
    
  } finally {
    await prisma.$disconnect();
  }
}

// =====================================
// HANDLER API PRINCIPAL
// =====================================
export default async function handler(req, res) {
  console.log("🚀 [VERCEL CRON] Démarrage du CRON automatique");
  
  try {
    // Vérification autorisation
    const authHeader = req.headers.authorization;
    const isVercelCron = req.headers['user-agent']?.includes('vercel') || 
                        req.headers['x-vercel-cron'] === '1';
    
    if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log("❌ [VERCEL CRON] Accès non autorisé");
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized',
        timestamp: new Date().toISOString()
      });
    }

    // Configuration du reset affichée
    console.log(`🔧 [VERCEL CRON] Configuration reset:`, RESET_CONFIG);
    
    // Exécution du reset avec la même logique que le service
    const result = await executeReset('vercel-cron');
    
    console.log("✅ [VERCEL CRON] Exécution terminée avec succès");
    
    return res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      executionTime: `${Date.now() - Date.now()} ms`,
      resetConfig: RESET_CONFIG,
      nextExecution: "Quotidien à 00h00 UTC via Vercel CRON"
    });

  } catch (error) {
    console.error("❌ [VERCEL CRON] Erreur fatale:", error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      resetConfig: RESET_CONFIG
    });
  }
}