-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'SUPERVISEUR', 'PARTENAIRE');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('DEPOT', 'RETRAIT', 'TRANSFERT_ENVOYE', 'TRANSFERT_RECU', 'ALLOCATION_UV_MASTER', 'DEBUT_JOURNEE', 'FIN_JOURNEE', 'AUDIT_MODIFICATION', 'AUDIT_SUPPRESSION');

-- CreateEnum
CREATE TYPE "public"."AccountType" AS ENUM ('LIQUIDE', 'ORANGE_MONEY', 'WAVE', 'UV_MASTER', 'AUTRES');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('DEPOT_PARTENAIRE', 'RETRAIT_PARTENAIRE', 'TRANSFERT_SUPERVISEUR', 'DEMANDE_INSCRIPTION', 'CREATION_UTILISATEUR', 'ALLOCATION_UV_MASTER', 'DEBUT_JOURNEE', 'FIN_JOURNEE', 'AUDIT_MODIFICATION', 'AUDIT_SUPPRESSION');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "codeClair" TEXT,
    "nomComplet" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "photo" TEXT,
    "role" "public"."UserRole" NOT NULL,
    "status" "public"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."registration_requests" (
    "id" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "nomComplet" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "message" TEXT,
    "status" "public"."UserStatus" NOT NULL DEFAULT 'PENDING',
    "codeGenere" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."daily_partner_choices" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "partenaireId" TEXT NOT NULL,
    "superviseurId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_partner_choices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."accounts" (
    "id" TEXT NOT NULL,
    "type" "public"."AccountType" NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "initialBalance" BIGINT NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transactions" (
    "id" TEXT NOT NULL,
    "montant" BIGINT NOT NULL,
    "type" "public"."TransactionType" NOT NULL,
    "description" TEXT,
    "envoyeurId" TEXT NOT NULL,
    "destinataireId" TEXT,
    "partenaireId" TEXT,
    "compteOrigineId" TEXT,
    "compteDestinationId" TEXT,
    "isValidated" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."daily_snapshots" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "userId" TEXT NOT NULL,
    "liquideDebut" INTEGER NOT NULL DEFAULT 0,
    "orangeMoneyDebut" INTEGER NOT NULL DEFAULT 0,
    "waveDebut" INTEGER NOT NULL DEFAULT 0,
    "uvMasterDebut" INTEGER NOT NULL DEFAULT 0,
    "autresDebut" INTEGER NOT NULL DEFAULT 0,
    "liquideFin" INTEGER NOT NULL DEFAULT 0,
    "orangeMoneyFin" INTEGER NOT NULL DEFAULT 0,
    "waveFin" INTEGER NOT NULL DEFAULT 0,
    "uvMasterFin" INTEGER NOT NULL DEFAULT 0,
    "autresFin" INTEGER NOT NULL DEFAULT 0,
    "debutTotal" INTEGER NOT NULL DEFAULT 0,
    "sortieTotal" INTEGER NOT NULL DEFAULT 0,
    "grTotal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."system_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telephone_key" ON "public"."users"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "registration_requests_telephone_key" ON "public"."registration_requests"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "daily_partner_choices_partenaireId_date_key" ON "public"."daily_partner_choices"("partenaireId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_userId_type_key" ON "public"."accounts"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "daily_snapshots_userId_date_key" ON "public"."daily_snapshots"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_key_key" ON "public"."system_config"("key");

-- AddForeignKey
ALTER TABLE "public"."registration_requests" ADD CONSTRAINT "reg_req_reviewed_by_fkey" FOREIGN KEY ("reviewedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."daily_partner_choices" ADD CONSTRAINT "daily_partner_partenaire_fkey" FOREIGN KEY ("partenaireId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."daily_partner_choices" ADD CONSTRAINT "daily_partner_superviseur_fkey" FOREIGN KEY ("superviseurId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transaction_envoyeur_fkey" FOREIGN KEY ("envoyeurId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transaction_destinataire_fkey" FOREIGN KEY ("destinataireId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transaction_partenaire_fkey" FOREIGN KEY ("partenaireId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transaction_compte_origine_fkey" FOREIGN KEY ("compteOrigineId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transaction_compte_destination_fkey" FOREIGN KEY ("compteDestinationId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notification_user_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."daily_snapshots" ADD CONSTRAINT "daily_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
