// src/services/TransactionService.js - VERSION FINALE AVEC RESET DYNAMIQUE CORRIGÉ
import prisma from '../config/database.js';
import NotificationService from './NotificationService.js';

class TransactionService {
  // =====================================
  // CONFIGURATION CENTRALISÉE DU RESET
  // =====================================
  static RESET_CONFIG = {
    hour: 16,        // Heure de déclenchement (0 = minuit)
    minute: 52,      // Minute de déclenchement
    windowMinutes: 0 // Fenêtre de déclenchement en minutes
  };

  // =====================================
  // UTILITAIRES ET HELPERS OPTIMISÉS
  // =====================================

  // Méthode pour obtenir la configuration de reset
  getResetConfig() {
    return TransactionService.RESET_CONFIG;
  }

  // Modifier la configuration (pour les tests)
  setResetConfig(hour, minute, windowMinutes = 2) {
    TransactionService.RESET_CONFIG = {
      hour,
      minute,
      windowMinutes
    };
    console.log(`🔧 [CONFIG] Reset configuré pour ${hour}:${minute.toString().padStart(2, '0')}`);
  }

  // Vérifier si on est dans la fenêtre de reset
  isInResetWindow() {
    const now = new Date();
    const resetConfig = this.getResetConfig();
    
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    const startMinute = resetConfig.minute;
    const endMinute = resetConfig.minute + resetConfig.windowMinutes;
    
    const isInWindow = currentHour === resetConfig.hour && 
                       currentMinute >= startMinute && 
                       currentMinute <= endMinute;
    
    return {
      isInWindow,
      currentTime: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`,
      resetWindow: `${resetConfig.hour}:${resetConfig.minute.toString().padStart(2, '0')}-${resetConfig.hour}:${endMinute.toString().padStart(2, '0')}`
    };
  }

  // Calculer dynamiquement ce qui constitue "hier" selon l'heure de reset
  getYesterdayRange() {
    const now = new Date();
    const resetConfig = this.getResetConfig();
    
    const todayResetTime = new Date(now);
    todayResetTime.setHours(resetConfig.hour, resetConfig.minute, 0, 0);
    
    let startOfYesterday, endOfYesterday;
    
    if (now < todayResetTime) {
      // On est avant le reset d'aujourd'hui
      // "Hier" = depuis le reset d'avant-hier jusqu'au reset d'aujourd'hui (exclu)
      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(now.getDate() - 1);
      
      // Début d'hier = reset d'avant-hier
      startOfYesterday = new Date(yesterdayDate);
      startOfYesterday.setDate(yesterdayDate.getDate() - 1);
      startOfYesterday.setHours(resetConfig.hour, resetConfig.minute, 0, 0);
      
      // Fin d'hier = juste avant le reset d'aujourd'hui
      endOfYesterday = new Date(todayResetTime);
      endOfYesterday.setMinutes(endOfYesterday.getMinutes() - 1);
      endOfYesterday.setSeconds(59, 999);
      
    } else {
      // On est après le reset d'aujourd'hui
      // "Hier" = depuis le reset d'hier jusqu'au reset d'aujourd'hui (exclu)
      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(now.getDate() - 1);
      
      // Début d'hier = reset d'hier
      startOfYesterday = new Date(yesterdayDate);
      startOfYesterday.setHours(resetConfig.hour, resetConfig.minute, 0, 0);
      
      // Fin d'hier = juste avant le reset d'aujourd'hui
      endOfYesterday = new Date(todayResetTime);
      endOfYesterday.setMinutes(endOfYesterday.getMinutes() - 1);
      endOfYesterday.setSeconds(59, 999);
    }
    
    console.log(`📅 [YESTERDAY RANGE] Reset à ${resetConfig.hour}:${resetConfig.minute.toString().padStart(2, '0')}:`, {
      now: now.toISOString(),
      todayResetTime: todayResetTime.toISOString(),
      beforeReset: now < todayResetTime,
      startOfYesterday: startOfYesterday.toISOString(),
      endOfYesterday: endOfYesterday.toISOString()
    });
    
    return { startOfYesterday, endOfYesterday };
  }

  // Déterminer dynamiquement si une période doit inclure les transactions archivées
  shouldIncludeArchivedTransactions(period) {
    if (period === 'yesterday') {
      const resetConfig = this.getResetConfig();
      const now = new Date();
      const todayResetTime = new Date(now);
      todayResetTime.setHours(resetConfig.hour, resetConfig.minute, 0, 0);
      
      // Si on est après le reset d'aujourd'hui, "hier" = données archivées
      return now > todayResetTime;
    }
    
    return false;
  }

  // Générer une référence unique pour transaction
  generateReference(prefix = 'TXN') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

 formatAmount(amount, withSign = false) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  
  if (withSign) {
    if (num > 0) {
      return `+${num.toLocaleString('fr-FR')} F`;
    } else if (num < 0) {
      return `${num.toLocaleString('fr-FR')} F`;
    } else {
      return `${num.toLocaleString('fr-FR')} F`;
    }
  }
  
  return `${Math.abs(num).toLocaleString('fr-FR')} F`;
}

formatAmount(amount, withSign = false) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  
  if (withSign) {
    // Afficher le résultat réel, avec le bon signe
    if (num > 0) {
      return `+${num.toLocaleString('fr-FR')} F`;
    } else if (num < 0) {
      return `${num.toLocaleString('fr-FR')} F`; // Le signe - sera automatique
    } else {
      return `${num.toLocaleString('fr-FR')} F`;
    }
  }
  
  return `${Math.abs(num).toLocaleString('fr-FR')} F`;
}

  // Méthode de filtre de date DYNAMIQUE basée sur la config reset
  getDateFilter(period = 'today') {
    const now = new Date();
    const resetConfig = this.getResetConfig();
    
    console.log(`🔍 [DYNAMIC FILTER] Période: "${period}" avec reset à ${resetConfig.hour}:${resetConfig.minute.toString().padStart(2, '0')}`);
    
    switch (period.toLowerCase()) {
      case 'today':
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date();
        
        console.log(`📅 [DYNAMIC] TODAY:`, {
          gte: startOfDay.toISOString(),
          lte: endOfDay.toISOString()
        });
        return { gte: startOfDay, lte: endOfDay };

      case 'yesterday':
        const { startOfYesterday, endOfYesterday } = this.getYesterdayRange();
        
        console.log(`📅 [DYNAMIC] YESTERDAY (basé sur reset ${resetConfig.hour}h${resetConfig.minute}):`, {
          gte: startOfYesterday.toISOString(),
          lte: endOfYesterday.toISOString()
        });
        return { gte: startOfYesterday, lte: endOfYesterday };

      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);
        return { gte: weekAgo, lte: now };

      case 'month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return { gte: startOfMonth, lte: now };

      case 'year':
        const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        return { gte: startOfYear, lte: now };

      case 'all':
        return {};

      default:
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        return { gte: todayStart, lte: new Date() };
    }
  }

  // Helper pour extraire le type de compte
  extractAccountTypeFromDescription(description) {
    if (!description) return 'LIQUIDE';
    
    const desc = description.toUpperCase();
    
    if (desc.includes('LIQUIDE')) return 'LIQUIDE';
    if (desc.includes('ORANGE') || desc.includes('OM')) return 'ORANGE_MONEY';
    if (desc.includes('WAVE')) return 'WAVE';
    if (desc.includes('UV_MASTER') || desc.includes('UV MASTER')) return 'UV_MASTER';
    
    return 'LIQUIDE';
  }

  // Conversion simplifiée
  convertToInt(value) {
    if (typeof value === 'number') return Math.round(value * 100);
    if (typeof value === 'string') return Math.round(parseFloat(value) * 100);
    return Math.round(value * 100);
  }

  convertFromInt(value) {
    return Number(value) / 100;
  }

  // =====================================
  // CRÉATION ADMIN TRANSACTION - ULTRA OPTIMISÉE
  // =====================================

  async createAdminTransaction(adminId, transactionData) {
    try {
      const { superviseurId, typeCompte, typeOperation, montant, partenaireId } = transactionData;

      // VALIDATION PRÉCOCE
      const montantFloat = parseFloat(montant);
      if (isNaN(montantFloat) || montantFloat <= 0) {
        throw new Error('Montant invalide');
      }

      const montantInt = this.convertToInt(montantFloat);

      // REQUÊTE UNIQUE POUR VÉRIFICATIONS
      const [supervisor, partner] = await Promise.all([
        prisma.user.findUnique({
          where: { id: superviseurId, role: 'SUPERVISEUR' },
          select: { id: true, nomComplet: true, status: true }
        }),
        partenaireId ? prisma.user.findUnique({
          where: { id: partenaireId, role: 'PARTENAIRE' },
          select: { id: true, nomComplet: true, status: true }
        }) : Promise.resolve(null)
      ]);

      if (!supervisor) {
        throw new Error('Superviseur non trouvé');
      }

      if (partenaireId && !partner) {
        throw new Error('Partenaire non trouvé');
      }

      const isPartnerTransaction = !!partenaireId;
      
      let account = null;
      let balanceUpdate = {};

      // LOGIQUE DIFFÉRENTE POUR TRANSACTIONS PARTENAIRES
      if (isPartnerTransaction) {
        // POUR PARTENAIRES : Pas de compte spécifique, pas de mise à jour de solde
        
        // Déterminer le type de transaction et description
        let transactionType, description;
        
        if (typeOperation === 'depot') {
          transactionType = 'DEPOT';
          description = `Dépôt partenaire ${partner.nomComplet}`;
        } else {
          transactionType = 'RETRAIT';
          description = `Retrait partenaire ${partner.nomComplet}`;
        }

        // TRANSACTION ATOMIQUE pour partenaires
        const result = await prisma.$transaction(async (tx) => {
          // Création de la transaction SANS compte associé
          const transaction = await tx.transaction.create({
            data: {
              montant: montantInt,
              type: transactionType,
              description,
              envoyeurId: adminId,
              destinataireId: superviseurId,
              partenaireId
              // PAS de compteDestinationId pour les transactions partenaires
            },
            select: {
              id: true,
              type: true,
              description: true,
              createdAt: true
            }
          });

          return { transaction, updatedAccount: null };
        });

        // NOTIFICATION pour partenaires
        setImmediate(async () => {
          try {
            let notificationTitle, notificationMessage, notificationType;

            if (typeOperation === 'depot') {
              notificationTitle = 'Nouveau dépôt partenaire';
              notificationMessage = `${partner.nomComplet} a déposé ${this.formatAmount(montantFloat)}`;
              notificationType = 'DEPOT_PARTENAIRE';
            } else {
              notificationTitle = 'Nouveau retrait partenaire';
              notificationMessage = `${partner.nomComplet} a retiré ${this.formatAmount(montantFloat)}`;
              notificationType = 'RETRAIT_PARTENAIRE';
            }

            await NotificationService.createNotification({
              userId: superviseurId,
              title: notificationTitle,
              message: notificationMessage,
              type: notificationType
            });
          } catch (notifError) {
            console.error('Erreur notification (non-bloquante):', notifError);
          }
        });

        return {
          transaction: {
            id: result.transaction.id,
            type: result.transaction.type,
            montant: montantFloat,
            description: result.transaction.description,
            superviseurNom: supervisor.nomComplet,
            typeCompte: null,
            createdAt: result.transaction.createdAt,
            isPartnerTransaction: true,
            partnerName: partner.nomComplet,
            partnerId: partner.id,
            transactionCategory: 'PARTENAIRE'
          },
          accountUpdated: false
        };

      } else {
        // LOGIQUE EXISTANTE POUR DÉBUT/FIN JOURNÉE
        
        // UPSERT pour le compte
        account = await prisma.account.upsert({
          where: {
            userId_type: {
              userId: superviseurId,
              type: typeCompte.toUpperCase()
            }
          },
          update: {},
          create: {
            type: typeCompte.toUpperCase(),
            userId: superviseurId,
            balance: 0,
            initialBalance: 0
          },
          select: { id: true, balance: true, initialBalance: true }
        });

        // Déterminer le type de transaction et description
        let transactionType, description;
        
        if (typeOperation === 'depot') {
          transactionType = 'DEBUT_JOURNEE';
          description = `Début journée ${typeCompte}`;
          balanceUpdate = { initialBalance: { increment: montantInt } };
        } else {
          transactionType = 'FIN_JOURNEE';
          description = `Fin journée ${typeCompte}`;
          balanceUpdate = { balance: montantInt };
        }

        // TRANSACTION ATOMIQUE pour début/fin journée
        const result = await prisma.$transaction(async (tx) => {
          // Mise à jour du compte
          const updatedAccount = await tx.account.update({
            where: { id: account.id },
            data: balanceUpdate,
            select: { balance: true, initialBalance: true }
          });

          // Création de la transaction
          const transaction = await tx.transaction.create({
            data: {
              montant: montantInt,
              type: transactionType,
              description,
              envoyeurId: adminId,
              destinataireId: superviseurId,
              compteDestinationId: account.id
            },
            select: {
              id: true,
              type: true,
              description: true,
              createdAt: true
            }
          });

          return { transaction, updatedAccount };
        });

        // NOTIFICATION pour début/fin journée
        setImmediate(async () => {
          try {
            const notificationTitle = typeOperation === 'depot' 
              ? 'Solde de début mis à jour' 
              : 'Solde de fin enregistré';
            const notificationMessage = `${description} - ${this.formatAmount(montantFloat)} par l'admin`;
            const notificationType = typeOperation === 'depot' ? 'DEBUT_JOURNEE' : 'FIN_JOURNEE';

            await NotificationService.createNotification({
              userId: superviseurId,
              title: notificationTitle,
              message: notificationMessage,
              type: notificationType
            });
          } catch (notifError) {
            console.error('Erreur notification (non-bloquante):', notifError);
          }
        });

        return {
          transaction: {
            id: result.transaction.id,
            type: result.transaction.type,
            montant: montantFloat,
            description: result.transaction.description,
            superviseurNom: supervisor.nomComplet,
            typeCompte: typeCompte,
            createdAt: result.transaction.createdAt,
            isPartnerTransaction: false,
            partnerName: null,
            partnerId: null,
            transactionCategory: 'JOURNEE'
          },
          accountUpdated: true,
          soldeActuel: this.convertFromInt(result.updatedAccount.balance),
          soldeInitial: this.convertFromInt(result.updatedAccount.initialBalance)
        };
      }

    } catch (error) {
      console.error('Erreur createAdminTransaction:', error);
      throw error;
    }
  }

  // =====================================
  // SYSTÈME DE RESET DYNAMIQUE CORRIGÉ
  // =====================================

  // NOUVEAU: Méthode pour nettoyer complètement les dashboards après reset
  async cleanupDashboardAfterReset() {
    try {
      console.log('🧹 [CLEANUP] Nettoyage post-reset...');
      
      // 1. Archiver toutes les transactions partenaires de "aujourd'hui avant reset"
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const resetConfig = this.getResetConfig();
      const todayResetTime = new Date(now);
      todayResetTime.setHours(resetConfig.hour, resetConfig.minute, 0, 0);
      
      // Archiver les transactions partenaires de la période "avant reset aujourd'hui"
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
      
      console.log(`✅ [CLEANUP] ${cleanupResult.count} transactions partenaires nettoyées`);
      
      if (cleanupResult.count > 0) {
        // Utiliser un vrai ID utilisateur au lieu de 'system'
        const adminUser = await prisma.user.findFirst({
          where: { role: 'ADMIN' },
          select: { id: true }
        });
        
        await prisma.transaction.create({
          data: {
            montant: 0,
            type: 'DEPOT', // Type valide comme marqueur
            description: `[SYSTEM] Nettoyage post-reset: ${cleanupResult.count} transactions partenaires archivées`,
            envoyeurId: adminUser?.id || 'cmffpzf8e0000248t0hu4w1gr' // Fallback vers un ID réel
          }
        });
      }
      
      return cleanupResult.count;
      
    } catch (error) {
      console.error('❌ [CLEANUP] Erreur:', error);
      throw error;
    }
  }

  async checkAndResetDaily() {
    try {
      const resetCheck = this.isInResetWindow();
      
      console.log(`[DYNAMIC RESET] Heure actuelle: ${resetCheck.currentTime}`);
      console.log(`[DYNAMIC RESET] Fenêtre de reset: ${resetCheck.resetWindow}`);
      console.log(`[DYNAMIC RESET] Dans la fenêtre ? ${resetCheck.isInWindow}`);
      
      if (!resetCheck.isInWindow) {
        return;
      }
      
      const now = new Date();
      const dateKey = now.toDateString();
      const lastResetDate = await this.getLastResetDate();
      
      // MODIFICATION: Vérifier l'heure exacte, pas seulement la date
      const resetConfig = this.getResetConfig();
      const resetHourMinute = `${resetConfig.hour}:${resetConfig.minute}`;
      const shouldReset = !lastResetDate || 
                         !lastResetDate.includes(dateKey) || 
                         lastResetDate.includes('ERROR') ||
                         !lastResetDate.includes(resetHourMinute); // Nouveau check
      
      if (shouldReset) {
        console.log('🔄 [DYNAMIC RESET] Lancement du reset quotidien complet...');
        
        try {
          // ÉTAPE 1: Archiver les transactions d'hier selon la logique dynamique  
          const archivedCount = await this.archivePartnerTransactionsDynamic();
          
          // ÉTAPE 2: Transférer les soldes (sortie → début, sortie → 0)
          await this.transferBalancesToInitial();
          
          // ÉTAPE 3: NOUVEAU - Nettoyer les transactions partenaires d'aujourd'hui
          const cleanedCount = await this.cleanupDashboardAfterReset();
          
          // ÉTAPE 4: Sauvegarder le succès
          const resetKey = `${dateKey}-SUCCESS-${resetCheck.currentTime}`;
          await this.saveResetDate(resetKey);
          
          console.log(`✅ [DYNAMIC RESET] Reset terminé - ${archivedCount} archivées, ${cleanedCount} nettoyées`);
          
          return {
            success: true,
            archivedCount,
            cleanedCount,
            executedAt: now.toISOString(),
            resetConfig: this.getResetConfig()
          };
          
        } catch (resetError) {
          console.error('❌ [DYNAMIC RESET] Erreur:', resetError);
          const errorKey = `${dateKey}-ERROR-${resetCheck.currentTime}`;
          await this.saveResetDate(errorKey);
          throw resetError;
        }
      } else {
        console.log(`[DYNAMIC RESET] Reset déjà effectué aujourd'hui (${lastResetDate})`);
        return {
          success: false,
          reason: 'already_executed_today',
          lastExecution: lastResetDate
        };
      }
      
    } catch (error) {
      console.error('❌ [DYNAMIC RESET] Erreur checkAndResetDaily:', error);
      return { success: false, error: error.message };
    }
  }

  async archivePartnerTransactionsDynamic() {
    try {
      const { startOfYesterday, endOfYesterday } = this.getYesterdayRange();
      
      console.log(`🗄️ [DYNAMIC ARCHIVE] Archivage transactions partenaires:`, {
        start: startOfYesterday.toISOString(),
        end: endOfYesterday.toISOString(),
        resetConfig: this.getResetConfig()
      });
      
      const result = await prisma.transaction.updateMany({
        where: {
          createdAt: {
            gte: startOfYesterday,
            lte: endOfYesterday
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
      
      console.log(`✅ [DYNAMIC ARCHIVE] ${result.count} transactions archivées`);
      
      if (result.count > 0) {
        // Utiliser un vrai ID utilisateur au lieu de 'system'
        const adminUser = await prisma.user.findFirst({
          where: { role: 'ADMIN' },
          select: { id: true }
        });
        
        await prisma.transaction.create({
          data: {
            montant: 0,
            type: 'DEPOT', // Type valide
            description: `[SYSTEM] Archivage quotidien dynamique: ${result.count} transactions partenaires`,
            envoyeurId: adminUser?.id || 'cmffpzf8e0000248t0hu4w1gr' // Fallback vers un ID réel
          }
        });
      }
      
      return result.count;
      
    } catch (error) {
      console.error('❌ [DYNAMIC ARCHIVE] Erreur:', error);
      throw error;
    }
  }
  async transferBalancesToInitial() {
    try {
      console.log('🔄 [TRANSFER] Début du transfert des soldes...');
      
      // Vérifier les soldes AVANT le transfert
      const accountsBefore = await prisma.account.findMany({
        where: {
          user: { role: 'SUPERVISEUR', status: 'ACTIVE' }
        },
        select: {
          id: true,
          type: true,
          balance: true,
          initialBalance: true,
          user: { select: { nomComplet: true } }
        }
      });
      
      console.log('📊 [TRANSFER] Soldes AVANT transfert:', 
        accountsBefore.map(acc => ({
          user: acc.user.nomComplet,
          type: acc.type,
          balance: this.convertFromInt(acc.balance),
          initialBalance: this.convertFromInt(acc.initialBalance)
        }))
      );
  
      // NOUVEAU SQL avec previousInitialBalance
      const result = await prisma.$executeRaw`
        UPDATE accounts 
        SET "previousInitialBalance" = "initialBalance",
            "initialBalance" = balance, 
            balance = 0 
        WHERE balance > 0 
        AND "userId" IN (
          SELECT id FROM users 
          WHERE role = 'SUPERVISEUR' AND status = 'ACTIVE'
        )
      `;
      
      console.log('📊 [TRANSFER] Résultat SQL:', result);
  
      // Vérifier les soldes APRÈS le transfert
      const accountsAfter = await prisma.account.findMany({
        where: {
          user: { role: 'SUPERVISEUR', status: 'ACTIVE' }
        },
        select: {
          id: true,
          type: true,
          balance: true,
          initialBalance: true,
          previousInitialBalance: true, // NOUVEAU CHAMP
          user: { select: { nomComplet: true } }
        }
      });
      
      console.log('📊 [TRANSFER] Soldes APRÈS transfert:', 
        accountsAfter.map(acc => ({
          user: acc.user.nomComplet,
          type: acc.type,
          balance: this.convertFromInt(acc.balance),
          initialBalance: this.convertFromInt(acc.initialBalance),
          previousInitialBalance: this.convertFromInt(acc.previousInitialBalance) // NOUVEAU
        }))
      );
  
      console.log(`✅ [TRANSFER] Transfert terminé pour tous les comptes actifs`);
  
    } catch (error) {
      console.error('❌ [TRANSFER] Erreur transferBalancesToInitial:', error);
      throw error;
    }
  }


// 1. AJOUTER cette fonction dans votre TransactionService (après transferBalancesToInitial)

async getYesterdayBackupData() {
  try {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    
    console.log('🔍 [BACKUP] Recherche données sauvegardées depuis:', startOfToday.toISOString());
    
    // Chercher la transaction de sauvegarde d'aujourd'hui
    const backupTransaction = await prisma.transaction.findFirst({
      where: {
        description: { startsWith: '[BACKUP_YESTERDAY]' },
        createdAt: { gte: startOfToday }
      },
      select: { description: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });

    if (backupTransaction) {
      console.log('✅ [BACKUP] Données trouvées:', backupTransaction.createdAt);
      const backupDataStr = backupTransaction.description.replace('[BACKUP_YESTERDAY] ', '');
      const backupData = JSON.parse(backupDataStr);
      console.log('📊 [BACKUP] Comptes sauvegardés:', backupData.accounts.length);
      return backupData.accounts;
    } else {
      console.log('❌ [BACKUP] Aucune donnée de sauvegarde trouvée pour aujourd\'hui');
    }

    return null;
  } catch (error) {
    console.error('❌ [BACKUP] Erreur récupération backup yesterday:', error);
    return null;
  }
}
 
  
  async getLastResetDate() {
    try {
      const config = await prisma.systemConfig.findFirst({
        where: { key: 'last_reset_date' },
        select: { value: true }
      });
      
      if (config) {
        return config.value;
      }
    } catch (error) {
      console.log('[RESET] Table systemConfig non disponible, utilisation alternative');
    }
    
    try {
      const lastReset = await prisma.transaction.findFirst({
        where: { 
          type: 'AUDIT_MODIFICATION',
          description: { contains: '[SYSTEM RESET]' }
        },
        orderBy: { createdAt: 'desc' },
        select: { description: true }
      });
      
      return lastReset?.description || null;
    } catch (error) {
      console.error('[RESET] Erreur getLastResetDate:', error);
      return null;
    }
  }

  async saveResetDate(dateString) {
    try {
      await prisma.systemConfig.upsert({
        where: { key: 'last_reset_date' },
        update: { value: dateString },
        create: { 
          key: 'last_reset_date', 
          value: dateString 
        }
      });
      console.log(`✅ Date de reset sauvegardée: ${dateString}`);
    } catch (error) {
      console.log('[RESET] Table systemConfig non disponible, utilisation alternative');
      
      try {
        await prisma.transaction.create({
          data: {
            montant: 0,
            type: 'AUDIT_MODIFICATION',
            description: `[SYSTEM RESET] ${dateString}`,
            envoyeurId: adminId === 'system' ? 'cmffpzf8e0000248t0hu4w1gr' : adminId // Utiliser un ID réel
          }
        });
        console.log(`✅ Date de reset sauvegardée (alternative): ${dateString}`);
      } catch (altError) {
        console.error('[RESET] Erreur saveResetDate (alternative):', altError);
      }
    }
  }



  // =====================================
// Correction de la méthode getAdminDashboard - lignes 770-950 environ

async getYesterdayDataFromSnapshot() {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    
    console.log('🔍 [SNAPSHOT] Recherche données d\'hier:', yesterdayDate.toISOString());
    
    const snapshots = await prisma.dailySnapshot.findMany({
      where: {
        date: yesterdayDate
      },
      select: {
        userId: true,
        liquideDebut: true,
        orangeMoneyDebut: true,
        waveDebut: true,
        uvMasterDebut: true,
        autresDebut: true,
        liquideFin: true,
        orangeMoneyFin: true,
        waveFin: true,
        uvMasterFin: true,
        autresFin: true
      }
    });
    
    console.log('📊 [SNAPSHOT] Snapshots trouvés:', snapshots.length);
    return snapshots;
    
  } catch (error) {
    console.error('❌ [SNAPSHOT] Erreur récupération:', error);
    return [];
  }
}

async getAdminDashboard(period = 'today') {
  try {
    setImmediate(() => this.checkAndResetDaily());
    
    const dateFilter = this.getDateFilter(period);
    const includeArchived = this.shouldIncludeArchivedTransactions(period);
    
    // Déterminer si on affiche les soldes actuels ou les anciens soldes
    const resetConfig = this.getResetConfig();
    const now = new Date();
    const todayResetTime = new Date(now);
    todayResetTime.setHours(resetConfig.hour, resetConfig.minute, 0, 0);
    const afterReset = now > todayResetTime;
    
    // FILTRAGE TRANSACTIONS CORRIGÉ
    let transactionFilter = { createdAt: dateFilter };

    if (period === 'yesterday') {
      if (afterReset) {
        // Après reset: uniquement les transactions archivées d'hier
        transactionFilter = {
          ...transactionFilter,
          archived: true,
          archivedAt: {
            gte: todayResetTime,
            lte: new Date(todayResetTime.getTime() + 5 * 60 * 1000) // Dans les 5 min du reset
          }
        };
      } else {
        // Avant reset: transactions non archivées d'hier
        transactionFilter = {
          ...transactionFilter,
          OR: [
            { archived: { equals: false } },
            { archived: { equals: null } }
          ]
        };
      }
    } else if (period === 'today') {
      // Pour "today": toujours exclure les archivées
      transactionFilter = {
        ...transactionFilter,
        OR: [
          { archived: { equals: false } },
          { archived: { equals: null } }
        ]
      };
    }

    console.log(`📊 [DASHBOARD FIXED] Période: ${period}, Après reset: ${afterReset}`, {
      dateFilter,
      includeArchived,
      transactionFilter,
      resetConfig
    });

    // RÉCUPÉRATION DES SUPERVISEURS AVANT UTILISATION
    const supervisors = await prisma.user.findMany({
      where: { role: 'SUPERVISEUR', status: 'ACTIVE' },
      select: {
        id: true,
        nomComplet: true,
        status: true,
        accounts: {
          select: {
            type: true,
            balance: true,
            initialBalance: true,
            previousInitialBalance: true // NOUVEAU CHAMP
          }
        },
        transactionsRecues: {
          where: transactionFilter,
          select: {
            id: true,
            type: true,
            montant: true,
            partenaireId: true,
            archived: true,
            archivedAt: true,
            createdAt: true,
            partenaire: {
              select: { nomComplet: true }
            }
          }
        }
      },
      orderBy: { nomComplet: 'asc' }
    });

    // REQUÊTE AVEC DONNÉES HISTORIQUES pour "yesterday" après reset
    let historicalAccountData = null;
    if (period === 'yesterday' && afterReset) {
      console.log('📊 [HISTORICAL] Récupération des données de comptes d\'hier...');
      
      historicalAccountData = await prisma.account.findMany({
        where: {
          userId: { in: supervisors.map(s => s.id) }
        },
        select: {
          userId: true,
          type: true,
          initialBalance: true, // Anciens soldes de sortie d'hier
          previousInitialBalance: true, // NOUVEAU - Anciens soldes de début d'hier
          balance: true // Nouveaux soldes (0 après reset)
        }
      });
      
      console.log('📊 [HISTORICAL] Données historiques trouvées:', 
        historicalAccountData.map(acc => ({
          userId: acc.userId,
          type: acc.type,
          yesterdayStart: this.convertFromInt(acc.previousInitialBalance || 0),
          yesterdayEnd: this.convertFromInt(acc.initialBalance)
        }))
      );
    }

    let totalDebutGlobal = 0;
    let totalSortieGlobal = 0;
    let uvMasterSolde = 0;
    let uvMasterSorties = 0;

    // TRAITEMENT AVEC LOGIQUE DE COMPTES CORRIGÉE
    const supervisorCards = supervisors.map(supervisor => {
      const accountsByType = { debut: {}, sortie: {} };
      let uvMasterTotal = 0;

      // LOGIQUE SIMPLE CORRIGÉE : Pour "yesterday" après reset, utiliser previousInitialBalance
      if (period === 'yesterday' && afterReset && historicalAccountData) {
        console.log(`📊 [HISTORICAL SUPERVISOR] ${supervisor.nomComplet}`);
        
        // Trouver les comptes historiques de ce superviseur
        const supervisorHistoricalAccounts = historicalAccountData.filter(acc => 
          acc.userId === supervisor.id
        );

        // LOGIQUE SIMPLE : Utiliser les champs de la base de données directement
        supervisor.accounts.forEach(account => {
          const historicalAccount = supervisorHistoricalAccounts.find(hist => 
            hist.userId === supervisor.id && hist.type === account.type
          );
          
          if (historicalAccount) {
            // Pour yesterday après reset :
            // - debut d'hier = previousInitialBalance (ancien solde de début sauvegardé)
            // - sortie d'hier = initialBalance (ancien solde de sortie transféré)
            const ancienDebutHier = this.convertFromInt(historicalAccount.previousInitialBalance || 0);
            const ancienneSortieHier = this.convertFromInt(historicalAccount.initialBalance);
            
            accountsByType.debut[account.type] = ancienDebutHier;
            accountsByType.sortie[account.type] = ancienneSortieHier;
            
            console.log(`📊 [${supervisor.nomComplet}] ${account.type}: début=${ancienDebutHier}, sortie=${ancienneSortieHier}`);
            
            if (account.type === 'UV_MASTER') {
              uvMasterTotal += ancienneSortieHier;
              uvMasterSorties += ancienneSortieHier;
              uvMasterSolde += ancienDebutHier;
            }
          } else {
            accountsByType.debut[account.type] = 0;
            accountsByType.sortie[account.type] = 0;
          }
        });

        // Compléter les types manquants
        ['LIQUIDE', 'ORANGE_MONEY', 'WAVE', 'UV_MASTER', 'AUTRES'].forEach(accountType => {
          if (!accountsByType.debut.hasOwnProperty(accountType)) {
            accountsByType.debut[accountType] = 0;
          }
          if (!accountsByType.sortie.hasOwnProperty(accountType)) {
            accountsByType.sortie[accountType] = 0;
          }
        });

      } else {
        // LOGIQUE NORMALE pour today et autres périodes
        supervisor.accounts.forEach(account => {
          const initial = this.convertFromInt(account.initialBalance);
          const current = this.convertFromInt(account.balance);
          
          if (account.type === 'UV_MASTER') {
            uvMasterTotal += current;
            accountsByType.sortie['UV_MASTER'] = current;
            uvMasterSorties += current;
            uvMasterSolde += initial;
            accountsByType.debut['UV_MASTER'] = initial;
          } else {
            accountsByType.debut[account.type] = initial;
            accountsByType.sortie[account.type] = current;
          }
        });
      }

      // TRAITEMENT PARTENAIRES (inchangé mais avec filtrage correct)
      const partenaireTransactions = {};
      
      supervisor.transactionsRecues.forEach(tx => {
        if (tx.partenaireId && tx.partenaire) {
          const montant = this.convertFromInt(tx.montant);
          const partnerName = tx.partenaire.nomComplet;
          
          if (!partenaireTransactions[partnerName]) {
            partenaireTransactions[partnerName] = { depots: 0, retraits: 0 };
          }
          
          if (tx.type === 'DEPOT') {
            partenaireTransactions[partnerName].depots += montant;
          } else if (tx.type === 'RETRAIT') {
            partenaireTransactions[partnerName].retraits += montant;
          }
        }
      });

      // Ajouter aux comptes
      Object.entries(partenaireTransactions).forEach(([partnerName, amounts]) => {
        if (amounts.depots > 0) {
          accountsByType.debut[`part-${partnerName}`] = amounts.depots;
        }
        if (amounts.retraits > 0) {
          accountsByType.sortie[`part-${partnerName}`] = amounts.retraits;
        }
      });

      // Calculer totaux
      const debutTotal = Object.values(accountsByType.debut).reduce((sum, val) => sum + val, 0);
      const sortieTotal = Object.values(accountsByType.sortie).reduce((sum, val) => sum + val, 0);
      const grTotal = sortieTotal - debutTotal;

      totalDebutGlobal += debutTotal;
      totalSortieGlobal += sortieTotal;

      return {
        id: supervisor.id,
        nom: supervisor.nomComplet,
        status: supervisor.status,
        comptes: {
          debut: accountsByType.debut,
          sortie: accountsByType.sortie
        },
        totaux: {
          debutTotal,
          sortieTotal,
          grTotal,
          formatted: {
            debutTotal: this.formatAmount(debutTotal),
            sortieTotal: this.formatAmount(sortieTotal),
            grTotal: this.formatAmount(grTotal, true)
          }
        }
      };
    });

    // Totaux globaux
    const globalTotals = {
      uvMaster: {
        solde: uvMasterSolde,
        sorties: uvMasterSorties,
        formatted: {
          solde: this.formatAmount(uvMasterSolde),
          sorties: this.formatAmount(uvMasterSorties)
        }
      },
      debutTotalGlobal: totalDebutGlobal,
      sortieTotalGlobal: totalSortieGlobal,
      formatted: {
        debutTotalGlobal: this.formatAmount(totalDebutGlobal),
        sortieTotalGlobal: this.formatAmount(totalSortieGlobal)
      }
    };

    return {
      period,
      globalTotals,
      supervisorCards,
      dynamicConfig: {
        resetConfig: this.getResetConfig(),
        includeArchived,
        afterReset,
        filterApplied: includeArchived ? 'archived_included' : 'archived_excluded',
        dataSource: (period === 'yesterday' && afterReset) ? 'previousInitialBalance' : 'current'
      }
    };

  } catch (error) {
    console.error('Erreur getAdminDashboard:', error);
    throw error;
  }
}
 async getSupervisorDashboard(superviseurId, period = 'today', forceRefresh = false) {
  try {
    // Vérifier reset si pas un refresh forcé
    if (!forceRefresh) {
      const resetResult = await this.checkAndResetDaily();
      
      // Si reset détecté, programmer une actualisation
      if (resetResult?.success) {
        console.log('🔄 [AUTO-REFRESH SUPERVISOR] Reset détecté, actualisation dans 60 secondes...');
        setTimeout(async () => {
          try {
            await this.getSupervisorDashboard(superviseurId, period, true);
          } catch (refreshError) {
            console.error('❌ [AUTO-REFRESH SUPERVISOR] Erreur:', refreshError);
          }
        }, 60000);
      }
    }
    
    const dateFilter = this.getDateFilter(period);
    const includeArchived = this.shouldIncludeArchivedTransactions(period);
    
    // Déterminer le contexte de reset
    const resetConfig = this.getResetConfig();
    const now = new Date();
    const todayResetTime = new Date(now);
    todayResetTime.setHours(resetConfig.hour, resetConfig.minute, 0, 0);
    const afterReset = now > todayResetTime;

    console.log(`🔍 [SUPERVISOR DASHBOARD FIXED] Période: ${period}, Après reset: ${afterReset}`, {
      superviseurId,
      includeArchived,
      afterReset
    });

    // FILTRAGE IDENTIQUE à getAdminDashboard
    let transactionFilter = { 
      createdAt: dateFilter,
      AND: [
        {
          OR: [
            { envoyeurId: superviseurId },
            { destinataireId: superviseurId },
            { partenaireId: superviseurId }
          ]
        }
      ]
    };

    if (period === 'yesterday') {
      if (afterReset) {
        transactionFilter = {
          ...transactionFilter,
          archived: true,
          archivedAt: {
            gte: todayResetTime,
            lte: new Date(todayResetTime.getTime() + 5 * 60 * 1000)
          }
        };
      } else {
        transactionFilter = {
          ...transactionFilter,
          OR: [
            { archived: { equals: false } },
            { archived: { equals: null } }
          ]
        };
      }
    } else if (period === 'today') {
      transactionFilter = {
        ...transactionFilter,
        OR: [
          { archived: { equals: false } },
          { archived: { equals: null } }
        ]
      };
    }

    const [supervisor, allTransactions, uvMasterAccounts] = await Promise.all([
      prisma.user.findUnique({
        where: { id: superviseurId },
        select: {
          id: true,
          nomComplet: true,
          status: true,
          accounts: {
            select: {
              type: true,
              balance: true,
              initialBalance: true,
              previousInitialBalance: true // NOUVEAU CHAMP
            }
          }
        }
      }),
      prisma.transaction.findMany({
        where: transactionFilter,
        select: {
          id: true,
          type: true,
          montant: true,
          description: true,
          createdAt: true,
          envoyeurId: true,
          destinataireId: true,
          partenaireId: true,
          archived: true,
          destinataire: { select: { nomComplet: true, role: true } },
          envoyeur: { select: { nomComplet: true, role: true } },
          partenaire: { select: { id: true, nomComplet: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.account.findMany({
        where: {
          type: 'UV_MASTER',
          user: { role: 'SUPERVISEUR', status: 'ACTIVE' }
        },
        select: {
          balance: true,
          initialBalance: true,
          previousInitialBalance: true // NOUVEAU CHAMP
        }
      })
    ]);

    if (!supervisor) {
      throw new Error('Superviseur non trouvé');
    }

    // LOGIQUE DE COMPTES CORRIGÉE (même logique que getAdminDashboard)
    const accountsByType = { debut: {}, sortie: {} };
    let totalDebutPersonnel = 0;
    let totalSortiePersonnel = 0;

    // Pour "yesterday" après reset, utiliser previousInitialBalance
    if (period === 'yesterday' && afterReset) {
      console.log('📊 [HISTORICAL SUPERVISOR] Récupération des données historiques...');
      
      // Récupérer les comptes avec les anciens soldes (même logique que getAdminDashboard)
      const historicalAccounts = await prisma.account.findMany({
        where: { userId: superviseurId },
        select: {
          type: true,
          initialBalance: true, // Anciens soldes de sortie d'hier
          previousInitialBalance: true, // NOUVEAU - Anciens soldes de début d'hier
          balance: true // Maintenant 0 après reset
        }
      });
      
      console.log('📊 [HISTORICAL SUPERVISOR] Comptes historiques:', 
        historicalAccounts.map(acc => ({
          type: acc.type,
          yesterdayStart: this.convertFromInt(acc.previousInitialBalance || 0),
          yesterdayEnd: this.convertFromInt(acc.initialBalance)
        }))
      );
      
      historicalAccounts.forEach(account => {
        // MÊME LOGIQUE que getAdminDashboard
        const ancienDebutHier = this.convertFromInt(account.previousInitialBalance || 0);
        const ancienneSortieHier = this.convertFromInt(account.initialBalance);
        
        accountsByType.debut[account.type] = ancienDebutHier;
        accountsByType.sortie[account.type] = ancienneSortieHier;
        
        totalDebutPersonnel += ancienDebutHier;
        totalSortiePersonnel += ancienneSortieHier;
        
        console.log(`📊 [${supervisor.nomComplet}] ${account.type}: début=${ancienDebutHier}, sortie=${ancienneSortieHier}`);
      });
      
    } else {
      // Logique normale avec les comptes actuels
      supervisor.accounts.forEach(account => {
        const initial = this.convertFromInt(account.initialBalance);
        const current = this.convertFromInt(account.balance);

        accountsByType.debut[account.type] = initial;
        accountsByType.sortie[account.type] = current;
        
        totalDebutPersonnel += initial;
        totalSortiePersonnel += current;
      });
    }

    // TRAITEMENT PARTENAIRES (inchangé)
    const partenaireTransactions = {};
    
    allTransactions.forEach(tx => {
      if (tx.partenaireId && tx.partenaire) {
        const montant = this.convertFromInt(tx.montant);
        const partnerName = tx.partenaire.nomComplet;
        
        if (!partenaireTransactions[partnerName]) {
          partenaireTransactions[partnerName] = { depots: 0, retraits: 0 };
        }
        
        if (tx.type === 'DEPOT') {
          if (tx.destinataireId === superviseurId) {
            partenaireTransactions[partnerName].depots += montant;
            // ATTENTION: Pour yesterday après reset, ne pas ajouter aux totaux car c'est dans les snapshots
            if (!(period === 'yesterday' && afterReset)) {
              totalDebutPersonnel += montant;
            }
          }
        } else if (tx.type === 'RETRAIT') {
          if (tx.destinataireId === superviseurId) {
            partenaireTransactions[partnerName].retraits += montant;
            // ATTENTION: Pour yesterday après reset, ne pas ajouter aux totaux car c'est dans les snapshots
            if (!(period === 'yesterday' && afterReset)) {
              totalSortiePersonnel += montant;
            }
          }
        }
      }
    });

    // Ajouter aux comptes
    Object.entries(partenaireTransactions).forEach(([partnerName, amounts]) => {
      if (amounts.depots > 0) {
        accountsByType.debut[`part-${partnerName}`] = amounts.depots;
      }
      if (amounts.retraits > 0) {
        accountsByType.sortie[`part-${partnerName}`] = amounts.retraits;
      }
    });

    // UV MASTER GLOBAL (avec la même logique que getAdminDashboard)
    let uvMasterDebut, uvMasterSortie;
    
    if (period === 'yesterday' && afterReset) {
      // Pour yesterday après reset, utiliser les données historiques globales
      uvMasterDebut = uvMasterAccounts.reduce((total, account) => 
        total + this.convertFromInt(account.previousInitialBalance || 0), 0);
      uvMasterSortie = uvMasterAccounts.reduce((total, account) => 
        total + this.convertFromInt(account.initialBalance), 0);
    } else {
      // Logique normale
      uvMasterDebut = uvMasterAccounts.reduce((total, account) => 
        total + this.convertFromInt(account.initialBalance), 0);
      uvMasterSortie = uvMasterAccounts.reduce((total, account) => 
        total + this.convertFromInt(account.balance), 0);
    }

    const grTotal = totalSortiePersonnel - totalDebutPersonnel;

    // FORMATAGE TRANSACTIONS (inchangé)
    const recentTransactions = allTransactions.map(tx => {
      let personne = '';
      
      if (tx.partenaireId && tx.partenaire) {
        personne = `${tx.partenaire.nomComplet} (Partenaire)`;
      } else if (tx.envoyeurId === superviseurId) {
        personne = tx.destinataire?.nomComplet || 'Destinataire inconnu';
      } else if (tx.destinataireId === superviseurId) {
        personne = tx.envoyeur?.nomComplet || 'Expéditeur inconnu';
      }

      if (['DEBUT_JOURNEE', 'FIN_JOURNEE'].includes(tx.type)) {
        personne = supervisor.nomComplet;
      }

      return {
        id: tx.id,
        type: tx.type,
        montant: this.convertFromInt(tx.montant),
        description: tx.description,
        personne,
        createdAt: tx.createdAt,
        envoyeurId: tx.envoyeurId,
        destinataireId: tx.destinataireId,
        partenaireId: tx.partenaireId,
        archived: tx.archived
      };
    });

    return {
      superviseur: {
        id: supervisor.id,
        nom: supervisor.nomComplet,
        status: supervisor.status
      },
      period,
      uvMaster: {
        personal: {
          debut: uvMasterDebut,
          sortie: uvMasterSortie,
          formatted: uvMasterSortie.toLocaleString() + ' F'
        },
        total: uvMasterSortie,
        debut: uvMasterDebut,
        formatted: uvMasterSortie.toLocaleString() + ' F'
      },
      comptes: accountsByType,
      totaux: {
        debutTotal: totalDebutPersonnel,
        sortieTotal: totalSortiePersonnel,
        grTotal,
        formatted: {
          debutTotal: totalDebutPersonnel.toLocaleString() + ' F',
          sortieTotal: totalSortiePersonnel.toLocaleString() + ' F',
          grTotal: this.formatAmount(grTotal, true)
        }
      },
      recentTransactions,
      dynamicConfig: {
        period,
        resetConfig: this.getResetConfig(),
        includeArchived,
        afterReset,
        totalTransactionsFound: allTransactions.length,
        partnerTransactionsFound: allTransactions.filter(tx => tx.partenaireId).length,
        filterApplied: includeArchived ? 'archived_included' : 'archived_excluded',
        dataSource: (period === 'yesterday' && afterReset) ? 'previousInitialBalance' : 'current'
      }
    };

  } catch (error) {
    console.error('Erreur getSupervisorDashboard:', error);
    throw new Error('Erreur lors de la récupération du dashboard superviseur: ' + error.message);
  }
}
  

  async getPartnerDashboard(partenaireId, period = 'today') {
    try {
      const dateFilter = this.getDateFilter(period);

      const [partner, availableSupervisors] = await Promise.all([
        prisma.user.findUnique({
          where: { id: partenaireId },
          select: {
            id: true,
            nomComplet: true,
            transactionsEnvoyees: {
              where: { createdAt: dateFilter },
              select: {
                id: true,
                type: true,
                montant: true,
                description: true,
                createdAt: true,
                destinataire: {
                  select: { nomComplet: true, role: true }
                }
              },
              orderBy: { createdAt: 'desc' }
            }
          }
        }),
        this.getActiveSupervisors()
      ]);

      if (!partner) {
        throw new Error('Partenaire non trouvé');
      }

      let totalDepots = 0;
      let totalRetraits = 0;

      const transactionDetails = partner.transactionsEnvoyees.map(tx => {
        const montant = this.convertFromInt(tx.montant);
        const isDepot = tx.type === 'DEPOT';
        
        if (isDepot) {
          totalDepots += montant;
        } else {
          totalRetraits += montant;
        }

        return {
          id: tx.id,
          type: tx.type,
          montant: montant,
          description: tx.description,
          superviseur: tx.destinataire?.nomComplet,
          createdAt: tx.createdAt,
          formatted: {
            montant: this.formatAmount(montant),
            type: isDepot ? 'Dépôt' : 'Retrait'
          }
        };
      });

      return {
        partenaire: {
          id: partner.id,
          nom: partner.nomComplet
        },
        period,
        statistiques: {
          totalDepots,
          totalRetraits,
          soldeNet: totalDepots - totalRetraits,
          nombreTransactions: partner.transactionsEnvoyees.length,
          formatted: {
            totalDepots: this.formatAmount(totalDepots),
            totalRetraits: this.formatAmount(totalRetraits),
            soldeNet: this.formatAmount(totalDepots - totalRetraits, true)
          }
        },
        transactions: transactionDetails,
        superviseursDisponibles: availableSupervisors
      };

    } catch (error) {
      console.error('Erreur getPartnerDashboard:', error);
      throw new Error('Erreur lors de la récupération du dashboard partenaire');
    }
  }

  // =====================================
  // AUTRES MÉTHODES
  // =====================================

  async updateTransaction(transactionId, updateData, userId) {
    try {
      console.log('🔄 [OPTIMIZED] updateTransaction démarré:', {
        transactionId,
        updateData,
        userId
      });

      if (!transactionId || !updateData || Object.keys(updateData).length === 0) {
        throw new Error('Données invalides');
      }

      const [existingTransaction, user] = await Promise.all([
        prisma.transaction.findUnique({
          where: { id: transactionId },
          select: {
            id: true,
            type: true,
            montant: true,
            description: true,
            createdAt: true,
            envoyeurId: true,
            destinataireId: true,
            compteDestinationId: true,
            envoyeur: { select: { id: true, nomComplet: true, role: true } },
            destinataire: { select: { id: true, nomComplet: true, role: true } },
            compteDestination: {
              select: { id: true, balance: true }
            }
          }
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, role: true, nomComplet: true }
        })
      ]);

      if (!existingTransaction) {
        throw new Error('Transaction non trouvée');
      }

      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }

      const isAdmin = user.role === 'ADMIN';
      const isSupervisor = user.role === 'SUPERVISEUR';
      const isOwnTransaction = existingTransaction.destinataireId === userId;
      const ageInDays = Math.floor((new Date() - new Date(existingTransaction.createdAt)) / (1000 * 60 * 60 * 24));

      if (!isAdmin && (!isSupervisor || !isOwnTransaction || ageInDays > 1)) {
        throw new Error('Permissions insuffisantes pour modifier cette transaction');
      }

      if (isAdmin && ageInDays > 7) {
        throw new Error('Transaction trop ancienne pour être modifiée (limite: 7 jours)');
      }

      const updateFields = {};
      
      if (updateData.description) {
        updateFields.description = updateData.description;
      }

      if (updateData.montant) {
        const newMontantFloat = parseFloat(updateData.montant);
        if (isNaN(newMontantFloat) || newMontantFloat <= 0) {
          throw new Error('Montant invalide');
        }
        
        const newMontantInt = this.convertToInt(newMontantFloat);
        const oldMontantInt = Number(existingTransaction.montant);
        
        updateFields.montant = newMontantInt;

        if (existingTransaction.compteDestination && newMontantInt !== oldMontantInt) {
          const difference = newMontantInt - oldMontantInt;
          
          return await prisma.$transaction(async (tx) => {
            if (existingTransaction.type === 'DEPOT' || existingTransaction.type === 'DEBUT_JOURNEE') {
              if (existingTransaction.type === 'DEBUT_JOURNEE') {
                await tx.account.update({
                  where: { id: existingTransaction.compteDestination.id },
                  data: { initialBalance: { increment: difference } }
                });
              } else {
                await tx.account.update({
                  where: { id: existingTransaction.compteDestination.id },
                  data: { balance: { increment: difference } }
                });
              }
            } else if (existingTransaction.type === 'RETRAIT') {
              if (existingTransaction.compteDestination.balance - difference < 0) {
                throw new Error('Solde insuffisant pour cette modification');
              }
              
              await tx.account.update({
                where: { id: existingTransaction.compteDestination.id },
                data: { balance: { decrement: difference } }
              });
            }

            const updatedTransaction = await tx.transaction.update({
              where: { id: transactionId },
              data: updateFields
            });

            await tx.transaction.create({
              data: {
                montant: newMontantInt,
                type: 'AUDIT_MODIFICATION',
                description: `Modification transaction ${transactionId} par ${user.nomComplet}`,
                envoyeurId: userId,
                destinataireId: existingTransaction.destinataireId
              }
            });

            return updatedTransaction;
          });
        }
      }

      const updatedTransaction = await prisma.transaction.update({
        where: { id: transactionId },
        data: updateFields
      });

      return {
        success: true,
        message: 'Transaction mise à jour avec succès',
        data: {
          id: updatedTransaction.id,
          type: updatedTransaction.type,
          montant: this.convertFromInt(updatedTransaction.montant),
          description: updatedTransaction.description,
          updatedAt: updatedTransaction.updatedAt
        }
      };

    } catch (error) {
      console.error('❌ [OPTIMIZED] Erreur updateTransaction:', error);
      throw error;
    }
  }

  async updateSupervisorAccount(supervisorId, accountType, accountKey, newValue, adminId) {
    try {
      console.log('🔄 [OPTIMIZED] updateSupervisorAccount:', {
        supervisorId,
        accountType, 
        accountKey,
        newValue,
        adminId
      });

      const newValueInt = this.convertToInt(newValue);

      const supervisor = await prisma.user.findUnique({
        where: { id: supervisorId, role: 'SUPERVISEUR' },
        select: { id: true, nomComplet: true }
      });

      if (!supervisor) {
        throw new Error('Superviseur non trouvé');
      }

      if (!accountKey.startsWith('part-') && !accountKey.startsWith('sup-')) {
        const account = await prisma.account.upsert({
          where: {
            userId_type: {
              userId: supervisorId,
              type: accountKey
            }
          },
          update: accountType === 'debut' 
            ? { initialBalance: newValueInt }
            : { balance: newValueInt },
          create: {
            type: accountKey,
            userId: supervisorId,
            balance: accountType === 'sortie' ? newValueInt : 0,
            initialBalance: accountType === 'debut' ? newValueInt : 0
          },
          select: { 
            id: true, 
            balance: true, 
            initialBalance: true 
          }
        });

        const oldValue = accountType === 'debut' 
          ? this.convertFromInt(account.initialBalance) 
          : this.convertFromInt(account.balance);

        setImmediate(async () => {
          try {
            await prisma.transaction.create({
              data: {
                montant: newValueInt,
                type: 'AUDIT_MODIFICATION',
                description: `Modification compte ${accountKey} (${accountType}) par admin - Ancien: ${oldValue} F, Nouveau: ${newValue} F`,
                envoyeurId: adminId,
                destinataireId: supervisorId,
                compteDestinationId: account.id
              }
            });
          } catch (auditError) {
            console.error('Erreur audit (non-bloquante):', auditError);
          }
        });

        return {
          oldValue: oldValue,
          newValue: newValue,
          accountUpdated: true
        };
      } else {
        setImmediate(async () => {
          try {
            await prisma.transaction.create({
              data: {
                montant: newValueInt,
                type: 'AUDIT_MODIFICATION',
                description: `Tentative modification compte ${accountKey} (${accountType}) par admin`,
                envoyeurId: adminId,
                destinataireId: supervisorId
              }
            });
          } catch (auditError) {
            console.error('Erreur audit (non-bloquante):', auditError);
          }
        });

        return {
          oldValue: 0,
          newValue: newValue,
          note: 'Modification enregistrée (comptes partenaires)'
        };
      }

    } catch (error) {
      console.error('❌ Erreur updateSupervisorAccount service:', error);
      throw error;
    }
  }

  async getActiveSupervisors() {
    try {
      const supervisors = await prisma.user.findMany({
        where: {
          role: 'SUPERVISEUR',
          status: 'ACTIVE'
        },
        select: {
          id: true,
          nomComplet: true,
          telephone: true
        },
        orderBy: { nomComplet: 'asc' }
      });

      return supervisors;
    } catch (error) {
      console.error('Erreur getActiveSupervisors:', error);
      throw new Error('Erreur lors de la récupération des superviseurs actifs');
    }
  }

  async createSupervisorTransaction(superviseurId, transactionData) {
    try {
      return await this.createAdminTransaction(superviseurId, transactionData);
    } catch (error) {
      console.error('Erreur createSupervisorTransaction:', error);
      throw error;
    }
  }

  async createPartnerTransaction(partnerId, transactionData) {
    try {
      throw new Error('Fonctionnalité createPartnerTransaction à implémenter');
    } catch (error) {
      console.error('Erreur createPartnerTransaction:', error);
      throw error;
    }
  }

  // =====================================
  // MÉTHODES UTILITAIRES POUR TESTS ET RESET MANUEL
  // =====================================

  async setResetTimeForTesting(hour, minute) {
    this.setResetConfig(hour, minute, 2);
    console.log(`🧪 [TEST] Reset configuré pour ${hour}:${minute.toString().padStart(2, '0')}`);
  }

  async testResetLogic() {
    const { isInWindow, currentTime, resetWindow } = this.isInResetWindow();
    const { startOfYesterday, endOfYesterday } = this.getYesterdayRange();
    
    return {
      currentTime,
      resetWindow,
      isInWindow,
      yesterdayRange: {
        start: startOfYesterday.toISOString(),
        end: endOfYesterday.toISOString()
      },
      resetConfig: this.getResetConfig()
    };
  }

  async forceReset(adminId = 'manual') {
    try {
      console.log('🔧 [RESET MANUEL] Lancement du reset forcé...');
      
      const now = new Date();
      
      const archivedCount = await this.archivePartnerTransactionsDynamic();
      
      await this.transferBalancesToInitial();
      
      const cleanedCount = await this.cleanupDashboardAfterReset();
      
      const resetKey = `${now.toDateString()}-MANUAL-${now.getHours()}h${now.getMinutes()}`;
      await this.saveResetDate(resetKey);
      
      const adminUser = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true }
      });
      
      await prisma.transaction.create({
        data: {
          montant: 0,
          type: 'AUDIT_MODIFICATION',
          description: `Reset manuel effectué par ${adminId}`,
          envoyeurId: adminUser?.id || adminId === 'manual' ? 'cmffpzf8e0000248t0hu4w1gr' : adminId
        }
      });
      
      console.log(`✅ [RESET MANUEL] Reset forcé terminé - ${archivedCount} archivées, ${cleanedCount} nettoyées`);
      
      return {
        success: true,
        archivedCount,
        cleanedCount,
        executedAt: now.toISOString(),
        type: 'manual'
      };
      
    } catch (error) {
      console.error('❌ [RESET MANUEL] Erreur:', error);
      throw error;
    }
  }

  async getResetStatus() {
    try {
      const now = new Date();
      const today = now.toDateString();
      const lastResetDate = await this.getLastResetDate();
      const resetConfig = this.getResetConfig();
      
      const resetToday = lastResetDate && lastResetDate.includes(today);
      const nextResetTime = new Date();
      nextResetTime.setHours(resetConfig.hour, resetConfig.minute, 0, 0);
      
      if (now > nextResetTime) {
        nextResetTime.setDate(nextResetTime.getDate() + 1);
      }
      
      return {
        resetExecutedToday: resetToday,
        lastReset: lastResetDate,
        nextScheduledReset: nextResetTime.toISOString(),
        currentTime: now.toISOString(),
        resetConfig: resetConfig,
        canExecuteNow: this.isInResetWindow().isInWindow
      };
      
    } catch (error) {
      console.error('Erreur getResetStatus:', error);
      return {
        error: error.message
      };
    }
  }

  // Utilitaires pour les labels
  getTransactionTypeLabel(type) {
    const labels = {
      'DEPOT': 'Dépôt',
      'RETRAIT': 'Retrait',
      'TRANSFERT_ENVOYE': 'Transfert envoyé',
      'TRANSFERT_RECU': 'Transfert reçu',
      'ALLOCATION_UV_MASTER': 'Allocation UV Master',
      'DEBUT_JOURNEE': 'Début journée',
      'FIN_JOURNEE': 'Fin journée'
    };
    
    return labels[type] || type;
  }

  getTransactionColor(type) {
    const positiveTypes = ['DEPOT', 'TRANSFERT_RECU', 'ALLOCATION_UV_MASTER', 'DEBUT_JOURNEE'];
    const negativeTypes = ['RETRAIT', 'TRANSFERT_ENVOYE', 'FIN_JOURNEE'];
    
    if (positiveTypes.includes(type)) return 'positive';
    if (negativeTypes.includes(type)) return 'negative';
    return 'neutral';
  }

  getAccountTypeLabel(type) {
    const labels = {
      'LIQUIDE': 'Liquide',
      'ORANGE_MONEY': 'Orange Money',
      'WAVE': 'Wave',
      'UV_MASTER': 'UV Master',
      'AUTRES': 'Autres'
    };
    
    return labels[type] || type;
  }

  getAccountTypeIcon(type) {
    const icons = {
      'LIQUIDE': '💵',
      'ORANGE_MONEY': '📱',
      'WAVE': '🌊',
      'UV_MASTER': '⭐',
      'AUTRES': '📦'
    };
    
    return icons[type] || '📦';
  }

  getPeriodLabel(period) {
    const labels = {
      'today': "Aujourd'hui",
      'yesterday': "Hier",
      'week': 'Cette semaine',
      'month': 'Ce mois',
      'year': 'Cette année',
      'all': 'Tout'
    };
    
    return labels[period] || period;
  }

  validateAdminTransactionData(data) {
    const errors = [];

    if (!data.superviseurId) {
      errors.push('Superviseur requis');
    }

    const isPartnerTransaction = !!data.partenaireId;
    
    if (!isPartnerTransaction && !data.typeCompte) {
      errors.push('Type de compte requis pour transactions début/fin journée');
    }

    if (!data.typeOperation) {
      errors.push('Type d\'opération requis');
    }

    if (!data.montant || data.montant <= 0) {
      errors.push('Montant doit être supérieur à 0');
    }

    return errors;
  }
}

export default new TransactionService();