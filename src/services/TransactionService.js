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
    return `${withSign && num > 0 ? '+' : ''}${num.toLocaleString('fr-FR')} F`;
  }

  // Obtenir filtre de date selon la période
  getDateFilter(period = 'today') {
    const now = new Date();
    
    switch (period.toLowerCase()) {
      case 'today':
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        return { gte: startOfDay, lte: endOfDay };

      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return { gte: weekAgo, lte: now };

      case 'month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return { gte: startOfMonth, lte: now };

      case 'year':
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return { gte: startOfYear, lte: now };

      case 'all':
        return {};

      default:
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        return { gte: todayStart, lte: todayEnd };
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

  // =====================================
  // CRÉATION ADMIN TRANSACTION - ULTRA OPTIMISÉE
  // =====================================

  async createAdminTransaction(adminId, transactionData) {
    try {
      const { superviseurId, typeCompte, typeOperation, montant, partenaireId } = transactionData;

      console.log('📥 [OPTIMIZED] Création transaction - Données reçues:', {
        montant: montant,
        type: typeof montant,
        superviseurId,
        typeOperation,
        partenaireId: partenaireId || 'N/A'
      });

      // VALIDATION PRÉCOCE
      const montantFloat = parseFloat(montant);
      if (isNaN(montantFloat) || montantFloat <= 0) {
        throw new Error('Montant invalide');
      }

      // Conversion en centimes pour stockage (Int au lieu de BigInt)
      const montantInt = this.convertToInt(montantFloat);

      // ✅ REQUÊTE UNIQUE POUR VÉRIFICATIONS
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

      // ✅ UPSERT OPTIMISÉ pour le compte (évite 2 requêtes)
      const account = await prisma.account.upsert({
        where: {
          userId_type: {
            userId: superviseurId,
            type: typeCompte.toUpperCase()
          }
        },
        update: {}, // Pas de mise à jour si existe déjà
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
      const isPartnerTransaction = !!partenaireId;

      if (isPartnerTransaction) {
        if (typeOperation === 'depot') {
          transactionType = 'DEPOT';
          description = `Dépôt partenaire ${partner.nomComplet} - ${typeCompte}`;
        } else {
          transactionType = 'RETRAIT';
          description = `Retrait partenaire ${partner.nomComplet} - ${typeCompte}`;
        }
      } else {
        if (typeOperation === 'depot') {
          transactionType = 'DEBUT_JOURNEE';
          description = `Début journée ${typeCompte}`;
        } else {
          transactionType = 'FIN_JOURNEE';
          description = `Fin journée ${typeCompte}`;
        }
      }

      // ✅ LOGIQUE DE MISE À JOUR OPTIMISÉE
      let balanceUpdate = {};
      
      if (typeOperation === 'depot') {
        if (transactionType === 'DEBUT_JOURNEE') {
          balanceUpdate = { initialBalance: { increment: montantInt } };
        } else {
          balanceUpdate = { balance: { increment: montantInt } };
        }
      } else {
        // RETRAIT
        if (isPartnerTransaction) {
          // Retrait partenaire = le superviseur reçoit l'argent
          balanceUpdate = { balance: { increment: montantInt } };
        } else if (transactionType === 'FIN_JOURNEE') {
          balanceUpdate = { balance: montantInt };
        } else {
          // Vérification solde pour autres retraits
          if (account.balance < montantInt) {
            const soldeActuelFrancs = this.convertFromInt(account.balance);
            throw new Error(`Solde insuffisant. Solde actuel: ${soldeActuelFrancs.toFixed(2)} F`);
          }
          balanceUpdate = { balance: { decrement: montantInt } };
        }
      }

      // ✅ TRANSACTION ATOMIQUE - Tout en une seule fois
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
            compteDestinationId: account.id,
            ...(partenaireId && { partenaireId })
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

      console.log('✅ [OPTIMIZED] Transaction créée avec succès:', {
        id: result.transaction.id,
        type: result.transaction.type,
        isPartnerTransaction
      });

      // ✅ NOTIFICATION ASYNCHRONE (ne bloque pas la réponse)
      setImmediate(async () => {
        try {
          let notificationTitle, notificationMessage, notificationType;

          if (partner) {
            if (typeOperation === 'depot') {
              notificationTitle = 'Nouveau dépôt partenaire';
              notificationMessage = `${partner.nomComplet} a déposé ${this.formatAmount(montantFloat)} (${typeCompte})`;
              notificationType = 'DEPOT_PARTENAIRE';
            } else {
              notificationTitle = 'Nouveau retrait partenaire';
              notificationMessage = `${partner.nomComplet} a retiré ${this.formatAmount(montantFloat)} (${typeCompte}) - Votre solde a été crédité`;
              notificationType = 'RETRAIT_PARTENAIRE';
            }
          } else {
            notificationTitle = typeOperation === 'depot' 
              ? 'Solde de début mis à jour' 
              : 'Solde de fin enregistré';
            notificationMessage = `${description} - ${this.formatAmount(montantFloat)} par l'admin`;
            notificationType = typeOperation === 'depot' ? 'DEBUT_JOURNEE' : 'FIN_JOURNEE';
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
          typeCompte: typeCompte,
          createdAt: result.transaction.createdAt,
          isPartnerTransaction: !!partenaireId,
          partnerName: partner?.nomComplet || null,
          partnerId: partner?.id || null,
          transactionCategory: partenaireId ? 'PARTENAIRE' : 'JOURNEE'
        },
        accountUpdated: true,
        soldeActuel: this.convertFromInt(result.updatedAccount.balance),
        soldeInitial: this.convertFromInt(result.updatedAccount.initialBalance)
      };

    } catch (error) {
      console.error('Erreur createAdminTransaction:', error);
      throw error;
    }
  }

  // =====================================
  // DASHBOARD ADMIN - ULTRA OPTIMISÉ
  // =====================================
  async getAdminDashboard(period = 'today') {
    try {
      // Vérifier transfert quotidien de manière non-bloquante
      setImmediate(() => this.checkAndTransferDaily());
      
      const dateFilter = this.getDateFilter(period);

      // ✅ REQUÊTE UNIQUE OPTIMISÉE avec tous les JOINs nécessaires
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
          // Toutes les transactions en une seule requête
          transactionsRecues: {
            where: { createdAt: dateFilter },
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

      // ✅ TRAITEMENT OPTIMISÉ - Une seule boucle
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

        // Traitement des transactions partenaires en une seule boucle
        const partenaireTransactions = {};
        
        supervisor.transactionsRecues.forEach(tx => {
          if (tx.partenaireId && tx.partenaire) {
            const montant = this.convertFromInt(tx.montant);
            const partnerName = `part-${tx.partenaire.nomComplet}`;
            
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
            accountsByType.debut[partnerName] = amounts.depots;
          }
          if (amounts.retraits > 0) {
            accountsByType.sortie[partnerName] = amounts.retraits;
          }
        });

        // Calculer totaux
        const debutTotal = Object.values(accountsByType.debut).reduce((sum, val) => sum + val, 0);
        const sortieTotal = Object.values(accountsByType.sortie).reduce((sum, val) => sum + val, 0);
        const grTotal = debutTotal - sortieTotal;

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
  // DASHBOARD SUPERVISEUR - OPTIMISÉ
  // =====================================
  async getSupervisorDashboard(superviseurId, period = 'today') {
    try {
      const dateFilter = this.getDateFilter(period);

      // ✅ REQUÊTE UNIQUE MASSIVE - Tout en une fois
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
        prisma.transaction.findMany({
          where: {
            createdAt: dateFilter,
            OR: [
              { envoyeurId: superviseurId },
              { destinataireId: superviseurId },
              { partenaireId: superviseurId }
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

      // ✅ TRAITEMENT OPTIMISÉ DES COMPTES
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

      // ✅ TRAITEMENT OPTIMISÉ DES TRANSACTIONS PARTENAIRES
      const partenaireTransactions = {};
      
      allTransactions.forEach(tx => {
        if (tx.partenaireId && tx.partenaire) {
          const montant = this.convertFromInt(tx.montant);
          const partnerName = `part-${tx.partenaire.nomComplet}`;

          if (!partenaireTransactions[partnerName]) {
            partenaireTransactions[partnerName] = { depots: 0, retraits: 0 };
          }

          if (tx.type === 'DEPOT') {
            partenaireTransactions[partnerName].depots += montant;
            totalDebutPersonnel += montant;
          } else if (tx.type === 'RETRAIT') {
            partenaireTransactions[partnerName].retraits += montant;
            totalSortiePersonnel += montant;
          }
        }
      });

      // Ajouter aux comptes
      Object.entries(partenaireTransactions).forEach(([partnerName, amounts]) => {
        if (amounts.depots > 0) {
          accountsByType.debut[partnerName] = amounts.depots;
        }
        if (amounts.retraits > 0) {
          accountsByType.sortie[partnerName] = amounts.retraits;
        }
      });

      // ✅ UV MASTER GLOBAL - Calcul optimisé
      const uvMasterDebut = uvMasterAccounts.reduce((total, account) => 
        total + this.convertFromInt(account.initialBalance), 0);
      const uvMasterSortie = uvMasterAccounts.reduce((total, account) => 
        total + this.convertFromInt(account.balance), 0);

      const grTotal = totalDebutPersonnel - totalSortiePersonnel;

      // ✅ FORMATAGE TRANSACTIONS OPTIMISÉ
      const recentTransactions = allTransactions.map(tx => {
        let personne = '';
        
        if (tx.envoyeurId === superviseurId) {
          personne = tx.destinataire?.nomComplet || 'Destinataire inconnu';
        } else if (tx.destinataireId === superviseurId) {
          personne = tx.envoyeur?.nomComplet || 'Expéditeur inconnu';
        } else if (tx.partenaireId === superviseurId) {
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
            grTotal: (grTotal >= 0 ? '+' : '') + grTotal.toLocaleString() + ' F'
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
  // DASHBOARD PARTENAIRE - OPTIMISÉ
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
  async checkAndTransferDaily() {
    try {
      const today = new Date();
      const todayString = today.toDateString();
      
      // Vérifier si on a déjà fait le transfert aujourd'hui
      const lastTransferDate = await this.getLastTransferDate();
      
      if (!lastTransferDate || lastTransferDate !== todayString) {
        console.log('🔄 Nouveau jour détecté - Transfert des soldes...');
        await this.transferBalancesToInitial();
        await this.saveTransferDate(todayString);
      }
      
    } catch (error) {
      console.error('Erreur checkAndTransferDaily:', error);
      // Ne pas bloquer l'application
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

  async getLastTransferDate() {
    try {
      const config = await prisma.systemConfig.findFirst({
        where: { key: 'last_transfer_date' },
        select: { value: true }
      });
      
      return config?.value || null;
    } catch (error) {
      return null;
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

  validateAdminTransactionData(data) {
    const errors = [];

    if (!data.superviseurId) {
      errors.push('Superviseur requis');
    }

    if (!data.typeCompte) {
      errors.push('Type de compte requis');
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