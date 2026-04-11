-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('MANUAL', 'WEBSITE', 'REFERRAL', 'LINKEDIN', 'EMAIL_CAMPAIGN', 'PHONE', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('OPEN', 'WON', 'LOST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'MEETING', 'STAGE_CHANGE', 'STATUS_CHANGE');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REFUSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CONFIRMED', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "crm_contacts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "source" "ContactSource" NOT NULL DEFAULT 'MANUAL',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "street" TEXT,
    "city" TEXT,
    "country" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedToId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_pipeline_stages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#1677ff',
    "order" INTEGER NOT NULL DEFAULT 0,
    "probability" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "crm_pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_leads" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contactId" TEXT,
    "stageId" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'OPEN',
    "value" DECIMAL(15,2),
    "probability" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "expectedDate" TIMESTAMP(3),
    "assignedToId" TEXT,
    "createdById" TEXT,
    "description" TEXT,
    "lostReason" TEXT,
    "wonAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lead_activities" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "LeadActivityType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventes_products" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unitPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'unité',
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ventes_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventes_quotes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "contactId" TEXT,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "notes" TEXT,
    "termsAndCond" TEXT,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "assignedToId" TEXT,
    "createdById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ventes_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventes_quote_lines" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ventes_quote_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventes_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "quoteId" TEXT,
    "contactId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'CONFIRMED',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "notes" TEXT,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "assignedToId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ventes_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventes_order_lines" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ventes_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventes_invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "orderId" TEXT,
    "contactId" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "notes" TEXT,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ventes_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventes_invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ventes_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_contacts_tenantId_idx" ON "crm_contacts"("tenantId");

-- CreateIndex
CREATE INDEX "crm_contacts_tenantId_email_idx" ON "crm_contacts"("tenantId", "email");

-- CreateIndex
CREATE INDEX "crm_pipeline_stages_tenantId_idx" ON "crm_pipeline_stages"("tenantId");

-- CreateIndex
CREATE INDEX "crm_leads_tenantId_idx" ON "crm_leads"("tenantId");

-- CreateIndex
CREATE INDEX "crm_leads_tenantId_stageId_idx" ON "crm_leads"("tenantId", "stageId");

-- CreateIndex
CREATE INDEX "crm_lead_activities_leadId_idx" ON "crm_lead_activities"("leadId");

-- CreateIndex
CREATE INDEX "ventes_products_tenantId_idx" ON "ventes_products"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ventes_products_tenantId_reference_key" ON "ventes_products"("tenantId", "reference");

-- CreateIndex
CREATE INDEX "ventes_quotes_tenantId_idx" ON "ventes_quotes"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ventes_quotes_tenantId_reference_key" ON "ventes_quotes"("tenantId", "reference");

-- CreateIndex
CREATE INDEX "ventes_quote_lines_quoteId_idx" ON "ventes_quote_lines"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "ventes_orders_quoteId_key" ON "ventes_orders"("quoteId");

-- CreateIndex
CREATE INDEX "ventes_orders_tenantId_idx" ON "ventes_orders"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ventes_orders_tenantId_reference_key" ON "ventes_orders"("tenantId", "reference");

-- CreateIndex
CREATE INDEX "ventes_order_lines_orderId_idx" ON "ventes_order_lines"("orderId");

-- CreateIndex
CREATE INDEX "ventes_invoices_tenantId_idx" ON "ventes_invoices"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ventes_invoices_tenantId_reference_key" ON "ventes_invoices"("tenantId", "reference");

-- CreateIndex
CREATE INDEX "ventes_invoice_lines_invoiceId_idx" ON "ventes_invoice_lines"("invoiceId");

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_pipeline_stages" ADD CONSTRAINT "crm_pipeline_stages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "crm_pipeline_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_activities" ADD CONSTRAINT "crm_lead_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_activities" ADD CONSTRAINT "crm_lead_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_products" ADD CONSTRAINT "ventes_products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_quotes" ADD CONSTRAINT "ventes_quotes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_quotes" ADD CONSTRAINT "ventes_quotes_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_quotes" ADD CONSTRAINT "ventes_quotes_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_quotes" ADD CONSTRAINT "ventes_quotes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_quote_lines" ADD CONSTRAINT "ventes_quote_lines_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "ventes_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_quote_lines" ADD CONSTRAINT "ventes_quote_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ventes_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_orders" ADD CONSTRAINT "ventes_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_orders" ADD CONSTRAINT "ventes_orders_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "ventes_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_orders" ADD CONSTRAINT "ventes_orders_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_orders" ADD CONSTRAINT "ventes_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_order_lines" ADD CONSTRAINT "ventes_order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ventes_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_order_lines" ADD CONSTRAINT "ventes_order_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ventes_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_invoices" ADD CONSTRAINT "ventes_invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_invoices" ADD CONSTRAINT "ventes_invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ventes_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_invoices" ADD CONSTRAINT "ventes_invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_invoice_lines" ADD CONSTRAINT "ventes_invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ventes_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
