-- AddForeignKey
ALTER TABLE "ventes_orders" ADD CONSTRAINT "ventes_orders_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventes_invoices" ADD CONSTRAINT "ventes_invoices_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
