// src/services/TransactionService.js - VERSION OPTIMISÉE
import prisma from '../config/database.js';
import NotificationService from './NotificationService.js';

class TransactionService {
  // =====================================
  // UTILITAIRES ET HELPERS OPTIMISÉS
  // =====================================

  // Générer une référence unique pour transaction
  generateReference(prefix = 'TXN') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  // Formater un montant pour l'affichage
 formatAmount(amount, withSign = false) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  
  // CORRECTION: Gérer correctement les nombres négatifs
  if (withSign) {
    if (num > 0) {
      return `+${num.toLocaleString('fr-FR')} F`;
    } else if (num < 0) {
      return `${num.toLocaleString('fr-FR')} F`; // Le signe - est déjà inclus
    } else {
      return `${num.toLocaleString('fr-FR')} F`;
    }
  }
  
  return `${Math.abs(num).toLocaleString('fr-FR')} F`;
}

// Obtenir filtre de date selon la période - VERSION CORRIGÉE
getDateFilter(period = 'today') {
  // CORRECTION PRINCIPALE: Utiliser l'heure locale du Sénégal (GMT+0)
  const now = new Date();
  
  console.log(`🔍 [BACKEND] getDateFilter appelé avec période: "${period}"`);
  console.log(`🔍 [BACKEND] Date actuelle:`, now.toISOString());
  console.log(`🔍 [BACKEND] Date locale:`, now.toString());
  
  switch (period.toLowerCase()) {
    case 'today':
      // CORRECTION 1: Utiliser la date locale pour éviter les problèmes de timezone
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      
      // CORRECTION 2: Pour "today", utiliser l'heure actuelle comme limite supérieure
      // au lieu d'une heure fixe de fin de journée
      const endOfDay = new Date(); // Maintenant, pas 23:59:59
      
      console.log(`📅 [BACKEND] Filtre TODAY (CORRIGÉ):`, {
        gte: startOfDay.toISOString(),
        lte: endOfDay.toISOString(),
        localStart: startOfDay.toString(),
        localEnd: endOfDay.toString()
      });
      
      // CORRECTION 3: Retourner un filtre qui inclut tout jusqu'à maintenant
      return { 
        gte: startOfDay,
        lte: endOfDay // Utiliser maintenant au lieu de 23:59:59
      };

    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      const endOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      
      console.log(`📅 [BACKEND] Filtre YESTERDAY:`, {
        gte: startOfYesterday.toISOString(),
        lte: endOfYesterday.toISOString()
      });
      return { gte: startOfYesterday, lte: endOfYesterday };

    case 'week':
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      
      console.log(`📅 [BACKEND] Filtre WEEK:`, {
        gte: weekAgo.toISOString(),
        lte: now.toISOString()
      });
      return { gte: weekAgo, lte: now };

    case 'month':
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      
      console.log(`📅 [BACKEND] Filtre MONTH:`, {
        gte: startOfMonth.toISOString(),
        lte: now.toISOString()
      });
      return { gte: startOfMonth, lte: now };

    case 'year':
      const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      
      console.log(`📅 [BACKEND] Filtre YEAR:`, {
        gte: startOfYear.toISOString(),
        lte: now.toISOString()
      });
      return { gte: startOfYear, lte: now };

    case 'all':
      console.log(`📅 [BACKEND] Filtre ALL: pas de filtre de date`);
      return {};

    default:
      // CORRECTION 4: Même logique pour le cas par défaut
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayNow = new Date();
      
      console.log(`📅 [BACKEND] Filtre DEFAULT (today corrigé):`, {
        gte: todayStart.toISOString(),
        lte: todayNow.toISOString()
      });
      return { gte: todayStart, lte: todayNow };
  }
}

// ALTERNATIVE - Version avec gestion explicite du timezone Sénégal
getDateFilterWithTimezone(period = 'today') {
  // OPTION 2: Gestion explicite du timezone Sénégal (GMT+0)
  const now = new Date();
  
  // Convertir en heure du Sénégal (GMT+0)
  const senegalTime = new Date(now.toLocaleString("en-US", {timeZone: "Africa/Dakar"}));
  
  console.log(`🔍 [BACKEND] getDateFilter avec timezone - période: "${period}"`);
  console.log(`🔍 [BACKEND] Heure UTC:`, now.toISOString());
  console.log(`🔍 [BACKEND] Heure Sénégal:`, senegalTime.toISOString());
  
  switch (period.toLowerCase()) {
    case 'today':
      // Utiliser l'heure du Sénégal pour calculer le début de journée
      const startOfDaySenegal = new Date(senegalTime.getFullYear(), senegalTime.getMonth(), senegalTime.getDate(), 0, 0, 0, 0);
      
      // Convertir back en UTC pour la base de données
      const startOfDayUTC = new Date(startOfDaySenegal.getTime() - (senegalTime.getTimezoneOffset() * 60000));
      const nowUTC = new Date();
      
      console.log(`📅 [BACKEND] Filtre TODAY (Timezone Sénégal):`, {
        gte: startOfDayUTC.toISOString(),
        lte: nowUTC.toISOString(),
        senegalStart: startOfDaySenegal.toString(),
        senegalNow: senegalTime.toString()
      });
      
      return { 
        gte: startOfDayUTC,
        lte: nowUTC
      };
      
    // ... autres cas similaires
    default:
      return this.getDateFilter(period); // Fallback à la méthode normale
  }
}

// OPTION 3 - Version simplifiée qui fonctionne à coup sûr
getDateFilterSimple(period = 'today') {
  const now = new Date();
  
  console.log(`🔍 [BACKEND] getDateFilterSimple - période: "${period}"`);
  console.log(`🔍 [BACKEND] Date actuelle:`, now.toISOString());
  
  switch (period.toLowerCase()) {
    case 'today':
      // SOLUTION SIMPLE: Utiliser seulement gte (supérieur ou égal) 
      // sans limite supérieure pour éviter les problèmes de timing
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      console.log(`📅 [BACKEND] Filtre TODAY (SIMPLE):`, {
        gte: startOfDay.toISOString(),
        note: "Pas de limite supérieure - toutes les transactions d'aujourd'hui"
      });
      
      // RETOURNER SEULEMENT gte sans lte
      return { gte: startOfDay };
      
    case 'yesterday':
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const endYesterday = new Date();
      endYesterday.setDate(endYesterday.getDate() - 1);
      endYesterday.setHours(23, 59, 59, 999);
      
      return { gte: yesterday, lte: endYesterday };
      
    case 'week':
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      return { gte: weekAgo };
      
    case 'month':
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      return { gte: startOfMonth };
      
    case 'year':
      const startOfYear = new Date();
      startOfYear.setMonth(0, 1);
      startOfYear.setHours(0, 0, 0, 0);
      return { gte: startOfYear };
      
    case 'all':
      return {};
      
    default:
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return { gte: todayStart };
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
      
      return 'LIQUIDE'; // Par défaut
    }
  
    // ✅ CONVERSION SIMPLIFIÉE (plus besoin de BigInt complexe)
    convertToInt(value) {
      if (typeof value === 'number') return Math.round(value * 100);
      if (typeof value === 'string') return Math.round(parseFloat(value) * 100);
      return Math.round(value * 100);
    }
  
    convertFromInt(value) {
      return Number(value) / 100;
    }

  // Helper pour extraire le type de compte
  extractAccountTypeFromDescription(description) {
    if (!description) return 'LIQUIDE';
    
    const desc = description.toUpperCase();
    
    if (desc.includes('LIQUIDE')) return 'LIQUIDE';
    if (desc.includes('ORANGE') || desc.includes('OM')) return 'ORANGE_MONEY';
    if (desc.includes('WAVE')) return 'WAVE';
    if (desc.includes('UV_MASTER') || desc.includes('UV MASTER')) return 'UV_MASTER';
    
    return 'LIQUIDE'; // Par défaut
  }

  // ✅ CONVERSION SIMPLIFIÉE (plus besoin de BigInt complexe)
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

 // MODIFICATION dans createAdminTransaction()

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
          typeCompte: null, // Pas de type de compte pour partenaires
          createdAt: result.transaction.createdAt,
          isPartnerTransaction: true,
          partnerName: partner.nomComplet,
          partnerId: partner.id,
          transactionCategory: 'PARTENAIRE'
        },
        accountUpdated: false // Pas de compte mis à jour
      };

    } else {
      // LOGIQUE EXISTANTE POUR DÉBUT/FIN JOURNÉE (inchangée)
      
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
  async getLastResetDate() {
    try {
      const config = await prisma.systemConfig.findFirst({
        where: { key: 'last_reset_date' },
        select: { value: true }
      });
      
      return config?.value || null;
    } catch (error) {
      return null;
    }
  }
  
  // Sauvegarder la date de reset
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
    } catch (error) {
      console.log('Table systemConfig non disponible');
    }
  }
  async getAdminDashboard(period = 'today') {
    try {
      // Vérifier reset quotidien de manière non-bloquante (MODIFIÉ)
      setImmediate(() => this.checkAndResetDaily());
      
      const dateFilter = this.getDateFilter(period);
  
      // REQUÊTE UNIQUE OPTIMISÉE avec tous les JOINs nécessaires
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
              initialBalance: true
            }
          },
          // Toutes les transactions en une seule requête (MODIFIÉ - exclure archives)
          transactionsRecues: {
            where: { 
              createdAt: dateFilter,
              archived: { not: true } // AJOUT: Exclure les transactions archivées
            },
            select: {
              id: true,
              type: true,
              montant: true,
              partenaireId: true,
              partenaire: {
                select: { nomComplet: true }
              }
            }
          }
        },
        orderBy: { nomComplet: 'asc' }
      });
  
      let totalDebutGlobal = 0;
      let totalSortieGlobal = 0;
      let uvMasterSolde = 0;
      let uvMasterSorties = 0;
  
      // TRAITEMENT OPTIMISÉ - Une seule boucle
      const supervisorCards = supervisors.map(supervisor => {
        const accountsByType = { debut: {}, sortie: {} };
        let uvMasterTotal = 0;
  
        // Traitement des comptes standards
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
  
        // Traitement des transactions partenaires en une seule boucle - MODIFIÉ
        const partenaireTransactions = {};
        
        supervisor.transactionsRecues.forEach(tx => {
          if (tx.partenaireId && tx.partenaire) {
            const montant = this.convertFromInt(tx.montant);
            // MODIFIÉ: Enlever le préfixe 'part-' pour le traitement interne
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
  
        // Ajouter aux comptes - MODIFIÉ pour ajouter le préfixe seulement à la clé finale
        Object.entries(partenaireTransactions).forEach(([partnerName, amounts]) => {
          if (amounts.depots > 0) {
            // Ajouter le préfixe 'part-' seulement pour la clé dans accountsByType
            accountsByType.debut[`part-${partnerName}`] = amounts.depots;
          }
          if (amounts.retraits > 0) {
            // Ajouter le préfixe 'part-' seulement pour la clé dans accountsByType
            accountsByType.sortie[`part-${partnerName}`] = amounts.retraits;
          }
        });
  
        // Calculer totaux
        const debutTotal = Object.values(accountsByType.debut).reduce((sum, val) => sum + val, 0);
        const sortieTotal = Object.values(accountsByType.sortie).reduce((sum, val) => sum + val, 0);
        const grTotal =sortieTotal  - debutTotal;
  
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
        supervisorCards
      };
  
    } catch (error) {
      console.error('Erreur getAdminDashboard:', error);
      throw error;
    }
  }
  // =====================================
// =====================================
// DASHBOARD SUPERVISEUR - CORRECTION FILTRE ARCHIVED
// =====================================
async getSupervisorDashboard(superviseurId, period = 'today') {
  try {
    const dateFilter = this.getDateFilter(period);

    // REQUÊTE UNIQUE MASSIVE - Tout en une fois
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
              initialBalance: true
            }
          }
        }
      }),
      // CORRECTION PRINCIPALE: Filtre archived corrigé
      prisma.transaction.findMany({
        where: {
          createdAt: dateFilter,
          // CORRECTION: Gérer les valeurs null dans archived
          OR: [
            { archived: { equals: false } },
            { archived: { equals: null } },
            { archived: { not: true } }
          ],
          AND: [
            {
              OR: [
                { envoyeurId: superviseurId },
                { destinataireId: superviseurId },
                { partenaireId: superviseurId }
              ]
            }
          ]
        },
        select: {
          id: true,
          type: true,
          montant: true,
          description: true,
          createdAt: true,
          envoyeurId: true,
          destinataireId: true,
          partenaireId: true,
          destinataire: { select: { nomComplet: true, role: true } },
          envoyeur: { select: { nomComplet: true, role: true } },
          partenaire: { select: { id: true, nomComplet: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 10 // Limiter pour performance
      }),
      prisma.account.findMany({
        where: {
          type: 'UV_MASTER',
          user: { role: 'SUPERVISEUR', status: 'ACTIVE' }
        },
        select: {
          balance: true,
          initialBalance: true
        }
      })
    ]);

    if (!supervisor) {
      throw new Error('Superviseur non trouvé');
    }

    // TRAITEMENT OPTIMISÉ DES COMPTES
    const accountsByType = { debut: {}, sortie: {} };
    let totalDebutPersonnel = 0;
    let totalSortiePersonnel = 0;

    supervisor.accounts.forEach(account => {
      const initial = this.convertFromInt(account.initialBalance);
      const current = this.convertFromInt(account.balance);

      accountsByType.debut[account.type] = initial;
      accountsByType.sortie[account.type] = current;
      
      totalDebutPersonnel += initial;
      totalSortiePersonnel += current;
    });

    // TRAITEMENT OPTIMISÉ DES TRANSACTIONS PARTENAIRES - CORRECTION MAJEURE
    const partenaireTransactions = {};
    
    allTransactions.forEach(tx => {
      // CORRECTION PRINCIPALE: Inclure toutes les transactions avec partenaireId
      // peu importe qui est envoyeur/destinataire
      if (tx.partenaireId && tx.partenaire) {
        const montant = this.convertFromInt(tx.montant);
        const partnerName = tx.partenaire.nomComplet;
        
        if (!partenaireTransactions[partnerName]) {
          partenaireTransactions[partnerName] = { depots: 0, retraits: 0 };
        }
        
        // CORRECTION: Traiter selon le type de transaction et la direction
        if (tx.type === 'DEPOT') {
          // Si le superviseur est destinataire, c'est un dépôt entrant
          if (tx.destinataireId === superviseurId) {
            partenaireTransactions[partnerName].depots += montant;
            totalDebutPersonnel += montant;
          }
          // Si le superviseur est envoyeur, c'est un transfert sortant
          else if (tx.envoyeurId === superviseurId) {
            partenaireTransactions[partnerName].retraits += montant;
            totalSortiePersonnel += montant;
          }
        } else if (tx.type === 'RETRAIT') {
          // Si le superviseur est destinataire, c'est un retrait entrant (rare)
          if (tx.destinataireId === superviseurId) {
            partenaireTransactions[partnerName].retraits += montant;
            totalSortiePersonnel += montant;
          }
          // Si le superviseur est envoyeur, c'est un retrait sortant
          else if (tx.envoyeurId === superviseurId) {
            partenaireTransactions[partnerName].retraits += montant;
            totalSortiePersonnel += montant;
          }
        }
        // AJOUT: Gérer les autres types de transactions partenaires
        else if (['TRANSFERT', 'COMMISSION', 'BONUS'].includes(tx.type)) {
          if (tx.destinataireId === superviseurId) {
            partenaireTransactions[partnerName].depots += montant;
            totalDebutPersonnel += montant;
          } else if (tx.envoyeurId === superviseurId) {
            partenaireTransactions[partnerName].retraits += montant;
            totalSortiePersonnel += montant;
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

    // UV MASTER GLOBAL - Calcul optimisé
    const uvMasterDebut = uvMasterAccounts.reduce((total, account) => 
      total + this.convertFromInt(account.initialBalance), 0);
    const uvMasterSortie = uvMasterAccounts.reduce((total, account) => 
      total + this.convertFromInt(account.balance), 0);

    // CORRECTION: Calcul GR Total selon votre logique (sortie - début)
    const grTotal = totalSortiePersonnel - totalDebutPersonnel;

    // FORMATAGE TRANSACTIONS OPTIMISÉ
    const recentTransactions = allTransactions.map(tx => {
      let personne = '';
      
      // CORRECTION: Améliorer l'affichage des personnes pour les transactions partenaires
      if (tx.partenaireId && tx.partenaire) {
        // Pour les transactions partenaires, afficher le nom du partenaire
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
        partenaireId: tx.partenaireId
      };
    });

    // Debug pour vérifier les transactions partenaires
    console.log(`Debug Transactions Partenaires pour ${period}:`, {
      totalTransactions: allTransactions.length,
      partenaireTransactionsCount: allTransactions.filter(tx => tx.partenaireId).length,
      partenaireTransactions,
      dateFilter,
      archivedFilterApplied: true // Confirmer que le filtre archived est appliqué
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
          grTotal: this.formatAmount(grTotal, true) // Utilisation du formatAmount corrigé
        }
      },
      recentTransactions
    };

  } catch (error) {
    console.error('Erreur getSupervisorDashboard:', error);
    throw new Error('Erreur lors de la récupération du dashboard superviseur: ' + error.message);
  }
}
  // =====================================
  async getPartnerDashboard(partenaireId, period = 'today') {
    try {
      const dateFilter = this.getDateFilter(period);

      // ✅ REQUÊTE UNIQUE
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

      // ✅ CALCULS OPTIMISÉS EN UNE BOUCLE
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
  // MISE À JOUR TRANSACTION - OPTIMISÉE
  // =====================================
  async updateTransaction(transactionId, updateData, userId) {
    try {
      console.log('🔄 [OPTIMIZED] updateTransaction démarré:', {
        transactionId,
        updateData,
        userId
      });

      // Validation précoce
      if (!transactionId || !updateData || Object.keys(updateData).length === 0) {
        throw new Error('Données invalides');
      }

      // ✅ REQUÊTE UNIQUE pour récupérer transaction + user
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

      // Vérification des permissions
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

      // Préparer les données de mise à jour
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

        // ✅ TRANSACTION ATOMIQUE pour mise à jour compte + transaction
        if (existingTransaction.compteDestination && newMontantInt !== oldMontantInt) {
          const difference = newMontantInt - oldMontantInt;
          
          return await prisma.$transaction(async (tx) => {
            // Mise à jour du solde selon le type
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
              // Vérifier solde disponible
              if (existingTransaction.compteDestination.balance - difference < 0) {
                throw new Error('Solde insuffisant pour cette modification');
              }
              
              await tx.account.update({
                where: { id: existingTransaction.compteDestination.id },
                data: { balance: { decrement: difference } }
              });
            }

            // Mettre à jour la transaction
            const updatedTransaction = await tx.transaction.update({
              where: { id: transactionId },
              data: updateFields
            });

            // Créer audit trail
            await tx.transaction.create({
              data: {
                montant: newMontantInt,
                type: 'AUDIT_MODIFICATION',
                description: `Modification transaction ${transactionId} par ${user.nomComplet}`,
                envoyeurId: userId,
                destinataireId: existingTransaction.destinataireId,
                metadata: JSON.stringify({
                  originalTransaction: transactionId,
                  changes: updateFields,
                  modifiedBy: userId,
                  modifiedAt: new Date().toISOString()
                })
              }
            });

            return updatedTransaction;
          });
        }
      }

      // ✅ MISE À JOUR SIMPLE (sans changement de montant)
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

  // =====================================
  // TRANSFERT QUOTIDIEN - OPTIMISÉ
  // =====================================
  

// AMÉLIORATION 5: Méthode de reset manuel pour rattrapage
async forceReset(adminId = 'manual') {
  try {
    console.log('🔧 [RESET MANUEL] Lancement du reset forcé...');
    
    const now = new Date();
    
    // Archiver les transactions
    const archivedCount = await this.archiveTestPartnerTransactions();
    
    // Transférer les soldes
    await this.transferBalancesToInitial();
    
    // Marquer comme exécuté avec indicateur de reset manuel
    const resetKey = `${now.toDateString()}-MANUAL-${now.getHours()}h${now.getMinutes()}`;
    await this.saveResetDate(resetKey);
    
    // Audit trail
    await prisma.transaction.create({
      data: {
        montant: 0,
        type: 'AUDIT_RESET_MANUEL',
        description: `Reset manuel effectué par ${adminId}`,
        envoyeurId: adminId,
        metadata: JSON.stringify({
          action: 'MANUAL_RESET',
          executedAt: now.toISOString(),
          archivedCount
        })
      }
    });
    
    console.log(`✅ [RESET MANUEL] Reset forcé terminé - ${archivedCount} transactions archivées`);
    
    return {
      success: true,
      archivedCount,
      executedAt: now.toISOString(),
      type: 'manual'
    };
    
  } catch (error) {
    console.error('❌ [RESET MANUEL] Erreur:', error);
    throw error;
  }
}

// AMÉLIORATION 6: Vérification du statut du reset
async getResetStatus() {
  try {
    const now = new Date();
    const today = now.toDateString();
    const lastResetDate = await this.getLastResetDate();
    
    const resetToday = lastResetDate && lastResetDate.includes(today);
    const nextResetTime = new Date();
    nextResetTime.setHours(23, 14, 0, 0);
    
    if (now > nextResetTime) {
      nextResetTime.setDate(nextResetTime.getDate() + 1);
    }
    
    return {
      resetExecutedToday: resetToday,
      lastReset: lastResetDate,
      nextScheduledReset: nextResetTime.toISOString(),
      currentTime: now.toISOString(),
      canExecuteNow: now.getHours() >= 23 && now.getMinutes() >= 14
    };
    
  } catch (error) {
    console.error('Erreur getResetStatus:', error);
    return {
      error: error.message
    };
  }
}
  
  // Archiver les transactions partenaires de la veille
 // AJOUTEZ cette méthode pour le test à 19h40
async archiveTestPartnerTransactions() {
  try {
    const today = new Date();
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    
    const now = new Date();
    
    console.log(`🗄️ [TEST ARCHIVE] Archivage transactions partenaires d'aujourd'hui (${startOfToday.toLocaleDateString('fr-FR')})`);
    
    // POUR LE TEST: Archiver les transactions d'aujourd'hui au lieu de Ala veille
    const result = await prisma.transaction.updateMany({
      where: {
        createdAt: {
          gte: startOfToday,
          lte: now
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
    
    console.log(`✅ [TEST ARCHIVE] ${result.count} transactions partenaires archivées pour le test`);
    return result.count;
    
  } catch (error) {
    console.error('❌ [TEST ARCHIVE] Erreur archivage transactions partenaires:', error);
    return 0;
  }
}
  
  // Récupérer la dernière date de reset
  async getLastResetDate() {
    try {
      // Essayer systemConfig en premier
      const config = await prisma.systemConfig.findFirst({
        where: { key: 'last_reset_date' },
        select: { value: true }
      });
      
      if (config) {
        return config.value;
      }
    } catch (error) {
      // Si systemConfig n'existe pas, essayer avec transactions
      console.log('[RESET] Table systemConfig non disponible, utilisation alternative');
    }
    
    try {
      // Alternative : utiliser une transaction marker
      const lastReset = await prisma.transaction.findFirst({
        where: { 
          type: 'RESET_MARKER'
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
  
  // Sauvegarder la date de reset
  async saveResetDate(dateString) {
    try {
      // Essayer systemConfig en premier
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
      // Si systemConfig n'existe pas, utiliser une transaction marker
      console.log('[RESET] Table systemConfig non disponible, utilisation alternative');
      
      try {
        await prisma.transaction.create({
          data: {
            montant: 0,
            type: 'RESET_MARKER',
            description: dateString,
            envoyeurId: 'system' // Vous devrez adapter selon votre système
          }
        });
        console.log(`✅ Date de reset sauvegardée (alternative): ${dateString}`);
      } catch (altError) {
        console.error('[RESET] Erreur saveResetDate (alternative):', altError);
      }
    }
  }


  async transferBalancesToInitial() {
    try {
      // ✅ MISE À JOUR EN MASSE - Une seule requête
      const result = await prisma.account.updateMany({
        where: {
          balance: { gt: 0 },
          user: {
            role: 'SUPERVISEUR',
            status: 'ACTIVE'
          }
        },
        data: {
          // Note: updateMany ne supporte pas les opérations complexes
          // Il faudra faire cela avec une requête SQL brute si nécessaire
        }
      });

      // Alternative avec SQL brut pour performance maximale
      await prisma.$executeRaw`
        UPDATE accounts 
        SET "initialBalance" = balance, balance = 0 
        WHERE balance > 0 
        AND "userId" IN (
          SELECT id FROM users 
          WHERE role = 'SUPERVISEUR' AND status = 'ACTIVE'
        )
      `;

      console.log(`✅ Transfert terminé pour tous les comptes actifs`);

    } catch (error) {
      console.error('Erreur transferBalancesToInitial:', error);
      throw error;
    }
  }

 

  async saveTransferDate(dateString) {
    try {
      await prisma.systemConfig.upsert({
        where: { key: 'last_transfer_date' },
        update: { value: dateString },
        create: { 
          key: 'last_transfer_date', 
          value: dateString 
        }
      });
    } catch (error) {
      console.log('Info: Table systemConfig non disponible');
    }
  }

  // =====================================
  // MISE À JOUR COMPTE SUPERVISEUR - OPTIMISÉE
  // =====================================
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

      // Vérifier superviseur
      const supervisor = await prisma.user.findUnique({
        where: { id: supervisorId, role: 'SUPERVISEUR' },
        select: { id: true, nomComplet: true }
      });

      if (!supervisor) {
        throw new Error('Superviseur non trouvé');
      }

      // Pour les comptes standards
      if (!accountKey.startsWith('part-') && !accountKey.startsWith('sup-')) {
        // ✅ UPSERT OPTIMISÉ
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

        // ✅ AUDIT TRAIL ASYNCHRONE
        setImmediate(async () => {
          try {
            await prisma.transaction.create({
              data: {
                montant: newValueInt,
                type: 'AUDIT_MODIFICATION',
                description: `Modification compte ${accountKey} (${accountType}) par admin - Ancien: ${oldValue} F, Nouveau: ${newValue} F`,
                envoyeurId: adminId,
                destinataireId: supervisorId,
                compteDestinationId: account.id,
                metadata: JSON.stringify({
                  action: 'UPDATE_SUPERVISOR_ACCOUNT',
                  accountType,
                  accountKey,
                  oldValue,
                  newValue,
                  modifiedBy: adminId,
                  modifiedAt: new Date().toISOString()
                })
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
        // Pour les comptes partenaires - audit seulement
        setImmediate(async () => {
          try {
            await prisma.transaction.create({
              data: {
                montant: newValueInt,
                type: 'AUDIT_MODIFICATION',
                description: `Tentative modification compte ${accountKey} (${accountType}) par admin`,
                envoyeurId: adminId,
                destinataireId: supervisorId,
                metadata: JSON.stringify({
                  action: 'UPDATE_PARTNER_ACCOUNT',
                  accountType,
                  accountKey,
                  newValue,
                  note: 'Modification compte partenaire - logique à implémenter',
                  modifiedBy: adminId,
                  modifiedAt: new Date().toISOString()
                })
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

  // =====================================
  // SUPERVISEURS ACTIFS - OPTIMISÉ
  // =====================================
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

  // =====================================
  // MÉTHODES SIMPLIFIÉES
  // =====================================

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
      'week': 'Cette semaine',
      'month': 'Ce mois',
      'year': 'Cette année',
      'all': 'Tout'
    };
    
    return labels[period] || period;
  }

 // Remplacer la méthode validateAdminTransactionData (ligne ~803) par :

validateAdminTransactionData(data) {
  const errors = [];

  if (!data.superviseurId) {
    errors.push('Superviseur requis');
  }

  // MODIFICATION: typeCompte requis SEULEMENT si ce n'est pas une transaction partenaire
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