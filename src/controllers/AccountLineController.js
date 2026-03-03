// src/controllers/AccountLineController.js
import prisma from '../config/database.js';
import NotificationService from '../services/NotificationService.js';

class AccountLineController {
  
  deleteAccountLine = async (req, res) => {
    try {
      const { supervisorId, lineType } = req.params;
      const { accountKey } = req.body;
      const userId = req.user.id;

      console.log('🗑️ [CONTROLLER] deleteAccountLine:', {
        supervisorId, lineType, accountKey, userId, userRole: req.user.role
      });

      if (!accountKey) {
        return res.status(400).json({ success: false, message: 'Clé de compte requise' });
      }

      if (!['debut', 'sortie'].includes(lineType)) {
        return res.status(400).json({ success: false, message: 'Type de ligne invalide' });
      }

      const permissionCheck = await this.checkDeletePermissions(req.user, supervisorId, accountKey);
      if (!permissionCheck.allowed) {
        return res.status(403).json({ success: false, message: permissionCheck.reason });
      }

      const result = await this.executeAccountLineDeletion(supervisorId, lineType, accountKey, userId);

      res.json({
        success: true,
        message: `Ligne ${accountKey} (${lineType}) supprimée avec succès`,
        data: result
      });

    } catch (error) {
      console.error('❌ [CONTROLLER] Erreur deleteAccountLine:', error);
      if (error.message.includes('non trouvé')) {
        return res.status(404).json({ success: false, message: error.message });
      }
      if (error.message.includes('déjà à zéro')) {
        return res.status(400).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: error.message || 'Erreur suppression' });
    }
  }

  checkDeletePermissions = async (user, supervisorId, accountKey) => {
    try {
      if (user.role === 'ADMIN') {
        return { allowed: true, reason: 'Administrateur - accès complet' };
      }

      if (user.role !== 'SUPERVISEUR') {
        return { allowed: false, reason: 'Permissions insuffisantes' };
      }

      if (user.id !== supervisorId) {
        return { allowed: false, reason: 'Vous ne pouvez supprimer que vos propres comptes' };
      }

      if (accountKey === 'UV_MASTER') {
        return { allowed: false, reason: 'Impossible de supprimer le compte UV_MASTER' };
      }

      return { allowed: true, reason: 'Superviseur autorisé' };

    } catch (error) {
      console.error('❌ [PERMISSIONS] Erreur:', error);
      return { allowed: false, reason: 'Erreur permissions' };
    }
  }

  executeAccountLineDeletion = async (supervisorId, lineType, accountKey, deletedBy) => {
    try {
      const supervisor = await prisma.user.findUnique({
        where: { id: supervisorId }
      });

      if (!supervisor) throw new Error('Superviseur non trouvé');

      let result = {};

      if (accountKey.startsWith('part-')) {
        result = await this.deletePartnerAccountLine(supervisorId, lineType, accountKey, deletedBy);
      } else {
        const account = await prisma.account.findFirst({
          where: { userId: supervisorId, type: accountKey }
        });

        if (!account) throw new Error(`Compte ${accountKey} non trouvé`);

        const oldValue = lineType === 'debut'
          ? Number(account.initialBalance) / 100
          : Number(account.balance) / 100;

        if (oldValue === 0) throw new Error('Cette ligne est déjà à zéro, rien à supprimer');

        const updateData = lineType === 'debut'
          ? { initialBalance: 0n }
          : { balance: 0n };

        await prisma.account.update({ where: { id: account.id }, data: updateData });

        await prisma.transaction.create({
          data: {
            montant: BigInt(Math.round(oldValue * 100)),
            type: 'AUDIT_SUPPRESSION',
            description: `Suppression ligne ${accountKey} (${lineType}) - ${oldValue} F`,
            envoyeurId: deletedBy,
            destinataireId: supervisorId,
            compteDestinationId: account.id,
            metadata: JSON.stringify({
              action: 'DELETE_ACCOUNT_LINE', lineType, accountKey, oldValue, deletedBy,
              deletedAt: new Date().toISOString()
            })
          }
        });

        await NotificationService.createNotification({
          userId: supervisorId,
          title: 'Ligne de compte supprimée',
          message: `Ligne ${accountKey} (${lineType === 'debut' ? 'début' : 'sortie'}) de ${oldValue} F supprimée`,
          type: 'AUDIT_SUPPRESSION'
        });

        result = { accountId: account.id, accountKey, lineType, oldValue, newValue: 0 };
      }

      return { ...result, supervisor: supervisor.nomComplet, deletedAt: new Date(), auditCreated: true };

    } catch (error) {
      console.error('❌ [CONTROLLER] Erreur executeAccountLineDeletion:', error);
      throw error;
    }
  }

  deletePartnerAccountLine = async (supervisorId, lineType, accountKey, deletedBy) => {
    try {
      // ✅ Extraire le nom depuis accountKey
      const partnerName = accountKey.replace('part-', '');
      const transactionType = lineType === 'debut' ? 'DEPOT' : 'RETRAIT';

      console.log('🗑️ [PARTNER DELETE] Recherche transactions pour:', { partnerName, transactionType, supervisorId });

      // ✅ CORRECTION MAJEURE : chercher directement dans les transactions
      // via partenaireNom (nom libre) OU via partenaire.nomComplet (enregistré)
      const transactions = await prisma.transaction.findMany({
        where: {
          destinataireId: supervisorId,
          type: transactionType,
          OR: [
            { archived: { equals: false } },
            { archived: { equals: null } }
          ]
        },
        include: {
          partenaire: { select: { id: true, nomComplet: true, telephone: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      // ✅ Filtrer par nom (insensible à la casse) côté JS
      // Cela couvre : partenaireNom libre ET partenaire.nomComplet enregistré
      const matchingTransactions = transactions.filter(tx => {
        const txPartnerName = tx.partenaire?.nomComplet || tx.partenaireNom || '';
        return txPartnerName.toLowerCase() === partnerName.toLowerCase();
      });

      console.log(`📊 [PARTNER DELETE] ${matchingTransactions.length} transaction(s) trouvée(s) pour "${partnerName}"`);

      // Log debug si aucune trouvée
      if (matchingTransactions.length === 0) {
        const allPartnerNames = [...new Set(transactions.map(tx =>
          tx.partenaire?.nomComplet || tx.partenaireNom || '(vide)'
        ))];
        console.log('🔍 [DEBUG] Noms partenaires disponibles:', allPartnerNames);
      }

      // ✅ Identifier le partenaire cible
      let targetPartner = matchingTransactions[0]?.partenaire || null;
      let targetPartnerName = targetPartner?.nomComplet || matchingTransactions[0]?.partenaireNom || partnerName;

      const totalValue = matchingTransactions.reduce((sum, tx) => sum + Number(tx.montant), 0) / 100;
      console.log(`💰 [PARTNER DELETE] Valeur totale: ${totalValue} F`);

      // Archiver les transactions trouvées
      if (matchingTransactions.length > 0) {
        await Promise.all(matchingTransactions.map(tx =>
          prisma.transaction.update({
            where: { id: tx.id },
            data: {
              description: `[SUPPRIMÉ] ${tx.description}`,
              archived: true,
              archivedAt: new Date(),
              metadata: JSON.stringify({
                deleted: true, deletedBy,
                deletedAt: new Date().toISOString(),
                originalDescription: tx.description,
                deletionReason: 'Suppression ligne partenaire depuis dashboard'
              })
            }
          })
        ));
        console.log(`✅ [PARTNER DELETE] ${matchingTransactions.length} transaction(s) archivées`);
      }

      // Créer l'audit
      await prisma.transaction.create({
        data: {
          montant: BigInt(Math.round(totalValue * 100)),
          type: 'AUDIT_SUPPRESSION',
          description: `Suppression transactions partenaire ${targetPartnerName} (${lineType}) - ${matchingTransactions.length} tx - ${totalValue} F`,
          envoyeurId: deletedBy,
          destinataireId: supervisorId,
          ...(targetPartner?.id && { partenaireId: targetPartner.id }),
          metadata: JSON.stringify({
            action: 'DELETE_PARTNER_TRANSACTIONS',
            lineType, partnerName: targetPartnerName,
            partnerId: targetPartner?.id || null,
            transactionCount: matchingTransactions.length,
            totalValue, transactionType,
            transactionIds: matchingTransactions.map(t => t.id),
            deletedBy, deletedAt: new Date().toISOString()
          })
        }
      });

      await NotificationService.createNotification({
        userId: supervisorId,
        title: 'Transactions partenaire supprimées',
        message: `${matchingTransactions.length} transaction(s) ${transactionType} de ${targetPartnerName} (${totalValue} F) supprimées`,
        type: 'AUDIT_SUPPRESSION'
      });

      return {
        partnerName: targetPartnerName,
        partnerId: targetPartner?.id || null,
        lineType, transactionType,
        transactionsDeleted: matchingTransactions.length,
        oldValue: totalValue,
        newValue: 0
      };

    } catch (error) {
      console.error('❌ [PARTNER DELETE] Erreur:', error);
      throw error;
    }
  }

  resetAccountLine = async (req, res) => {
    try {
      const { supervisorId, lineType } = req.params;
      const { accountKey, newValue = 0 } = req.body;
      const userId = req.user.id;

      if (!accountKey) {
        return res.status(400).json({ success: false, message: 'Clé de compte requise' });
      }

      if (newValue < 0) {
        return res.status(400).json({ success: false, message: 'Valeur négative non autorisée' });
      }

      const resetPermission = await this.checkResetPermissions(req.user, supervisorId, accountKey, lineType);
      if (!resetPermission.allowed) {
        return res.status(403).json({ success: false, message: resetPermission.reason });
      }

      const supervisor = await prisma.user.findUnique({ where: { id: supervisorId } });
      if (!supervisor) {
        return res.status(404).json({ success: false, message: 'Superviseur non trouvé' });
      }

      const newValueCentimes = Math.round(newValue * 100);

      const account = await prisma.account.upsert({
        where: { userId_type: { userId: supervisorId, type: accountKey } },
        update: {},
        create: {
          type: accountKey, userId: supervisorId,
          balance: 0n, initialBalance: 0n, previousInitialBalance: 0n
        }
      });

      const oldValue = lineType === 'debut'
        ? Number(account.initialBalance) / 100
        : Number(account.balance) / 100;

      await prisma.account.update({
        where: { id: account.id },
        data: lineType === 'debut'
          ? { initialBalance: BigInt(newValueCentimes) }
          : { balance: BigInt(newValueCentimes) }
      });

      await prisma.transaction.create({
        data: {
          montant: BigInt(Math.abs(newValueCentimes)),
          type: 'AUDIT_MODIFICATION',
          description: `Reset ${accountKey} (${lineType}) par ${req.user.role} - ${oldValue} F → ${newValue} F`,
          envoyeurId: userId,
          destinataireId: supervisorId,
          compteDestinationId: account.id,
          metadata: JSON.stringify({
            action: 'RESET_ACCOUNT_LINE', lineType, accountKey, oldValue, newValue,
            resetBy: userId, resetByRole: req.user.role, resetAt: new Date().toISOString()
          })
        }
      });

      await NotificationService.createNotification({
        userId: supervisorId,
        title: 'Compte réinitialisé',
        message: `${accountKey} (${lineType === 'debut' ? 'début' : 'sortie'}) réinitialisé : ${oldValue} F → ${newValue} F`,
        type: 'AUDIT_MODIFICATION'
      });

      res.json({
        success: true,
        message: `Compte ${accountKey} (${lineType}) réinitialisé`,
        data: { accountKey, lineType, oldValue, newValue, resetAt: new Date(), supervisor: supervisor.nomComplet }
      });

    } catch (error) {
      console.error('❌ [CONTROLLER] Erreur resetAccountLine:', error);
      res.status(500).json({ success: false, message: error.message || 'Erreur réinitialisation' });
    }
  }

  checkResetPermissions = async (user, supervisorId, accountKey, lineType) => {
    if (user.role === 'ADMIN') {
      return { allowed: true, hasOwnTransactions: false, reason: 'Administrateur' };
    }
    if (user.role !== 'SUPERVISEUR') {
      return { allowed: false, hasOwnTransactions: false, reason: 'Permissions insuffisantes' };
    }
    if (user.id !== supervisorId) {
      return { allowed: false, hasOwnTransactions: false, reason: 'Vous ne pouvez réinitialiser que vos propres comptes' };
    }
    return { allowed: true, hasOwnTransactions: true, reason: 'Superviseur autorisé' };
  }

  getAccountDeletionHistory = async (req, res) => {
    try {
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs' });
      }

      const { page = 1, limit = 20, supervisorId } = req.query;

      const whereClause = { type: { in: ['AUDIT_SUPPRESSION', 'AUDIT_MODIFICATION'] } };
      if (supervisorId) whereClause.destinataireId = supervisorId;

      const [auditRecords, totalCount] = await Promise.all([
        prisma.transaction.findMany({
          where: whereClause,
          include: {
            envoyeur: { select: { nomComplet: true } },
            destinataire: { select: { nomComplet: true } },
            partenaire: { select: { nomComplet: true } }
          },
          orderBy: { createdAt: 'desc' },
          skip: (parseInt(page) - 1) * parseInt(limit),
          take: parseInt(limit)
        }),
        prisma.transaction.count({ where: whereClause })
      ]);

      const formattedHistory = auditRecords.map(record => ({
        id: record.id, type: record.type, description: record.description,
        createdAt: record.createdAt,
        executedBy: record.envoyeur?.nomComplet || 'Inconnu',
        superviseur: record.destinataire?.nomComplet || 'Inconnu',
        partenaire: record.partenaire?.nomComplet || null,
        montant: Number(record.montant) / 100,
        metadata: record.metadata ? JSON.parse(record.metadata) : null
      }));

      res.json({
        success: true,
        message: `${auditRecords.length} enregistrement(s) trouvé(s)`,
        data: {
          history: formattedHistory,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalCount, limit: parseInt(limit)
          }
        }
      });

    } catch (error) {
      console.error('❌ [CONTROLLER] Erreur getAccountDeletionHistory:', error);
      res.status(500).json({ success: false, message: 'Erreur historique' });
    }
  }
}

// ✅ FIX ERREUR "Cannot read properties of undefined" :
// Exporter l'instance avec les méthodes liées
const controller = new AccountLineController();
export default controller;