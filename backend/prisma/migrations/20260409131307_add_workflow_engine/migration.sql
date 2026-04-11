-- CreateTable
CREATE TABLE "wf_definitions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "initialState" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wf_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wf_states" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isInitial" BOOLEAN NOT NULL DEFAULT false,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "wf_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wf_transitions" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fromStateKey" TEXT NOT NULL,
    "toStateKey" TEXT NOT NULL,
    "requiredPermission" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "wf_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wf_condition_configs" (
    "id" TEXT NOT NULL,
    "transitionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "wf_condition_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wf_action_configs" (
    "id" TEXT NOT NULL,
    "transitionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "wf_action_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wf_instances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "currentStateKey" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wf_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wf_execution_logs" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "transitionKey" TEXT NOT NULL,
    "fromState" TEXT NOT NULL,
    "toState" TEXT NOT NULL,
    "userId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "actionsRun" JSONB NOT NULL DEFAULT '[]',
    "durationMs" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wf_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wf_definitions_tenantId_idx" ON "wf_definitions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "wf_definitions_tenantId_entityType_version_key" ON "wf_definitions"("tenantId", "entityType", "version");

-- CreateIndex
CREATE UNIQUE INDEX "wf_states_definitionId_key_key" ON "wf_states"("definitionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "wf_transitions_definitionId_key_key" ON "wf_transitions"("definitionId", "key");

-- CreateIndex
CREATE INDEX "wf_instances_tenantId_idx" ON "wf_instances"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "wf_instances_tenantId_entityType_entityId_key" ON "wf_instances"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "wf_execution_logs_instanceId_idx" ON "wf_execution_logs"("instanceId");

-- CreateIndex
CREATE INDEX "wf_execution_logs_tenantId_idx" ON "wf_execution_logs"("tenantId");

-- AddForeignKey
ALTER TABLE "wf_definitions" ADD CONSTRAINT "wf_definitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_states" ADD CONSTRAINT "wf_states_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "wf_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_transitions" ADD CONSTRAINT "wf_transitions_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "wf_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_condition_configs" ADD CONSTRAINT "wf_condition_configs_transitionId_fkey" FOREIGN KEY ("transitionId") REFERENCES "wf_transitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_action_configs" ADD CONSTRAINT "wf_action_configs_transitionId_fkey" FOREIGN KEY ("transitionId") REFERENCES "wf_transitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_instances" ADD CONSTRAINT "wf_instances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_instances" ADD CONSTRAINT "wf_instances_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "wf_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wf_execution_logs" ADD CONSTRAINT "wf_execution_logs_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "wf_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
