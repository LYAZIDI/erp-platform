import 'express-async-errors';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

// Kernel routes
import authRoutes     from './kernel/auth/authRoutes';
import userRoutes     from './kernel/users/userRoutes';
import roleRoutes     from './kernel/roles/roleRoutes';
import moduleRoutes   from './kernel/modules/moduleRoutes';
import workflowRoutes from './kernel/workflow/workflowRoutes';

// CRM routes
import contactRoutes  from './modules/crm/contactRoutes';
import pipelineRoutes from './modules/crm/pipelineRoutes';

// Ventes routes
import productRoutes  from './modules/ventes/productRoutes';
import quoteRoutes    from './modules/ventes/quoteRoutes';
import orderRoutes    from './modules/ventes/orderRoutes';
import invoiceRoutes  from './modules/ventes/invoiceRoutes';

// Module registry (chargement au démarrage)
import './kernel/modules/moduleRegistry';

// ── Workflow Engine bootstrap ─────────────────────────────────────────────────
// Register built-in conditions, actions, and domain entity adapters.
// The engine core never imports these — they self-register here.
import { workflowRegistry }           from './kernel/workflow/WorkflowRegistry';
import { builtInConditions }          from './kernel/workflow/conditions';
import { builtInActions }             from './kernel/workflow/actions';
import { quoteAdapter }               from './modules/ventes/workflow/adapters/quoteAdapter';
import { orderAdapter }               from './modules/ventes/workflow/adapters/orderAdapter';
import { invoiceAdapter }             from './modules/ventes/workflow/adapters/invoiceAdapter';
import { leadAdapter }                from './modules/crm/workflow/adapters/leadAdapter';

builtInConditions.forEach((c) => workflowRegistry.registerCondition(c));
builtInActions.forEach((a)    => workflowRegistry.registerAction(a));
workflowRegistry
  .registerAdapter(quoteAdapter)
  .registerAdapter(orderAdapter)
  .registerAdapter(invoiceAdapter)
  .registerAdapter(leadAdapter);

console.log('[Workflow] Registry initialized:', workflowRegistry.summary());

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',              authRoutes);
app.use('/api/users',             userRoutes);
app.use('/api/roles',             roleRoutes);
app.use('/api/modules',           moduleRoutes);
// CRM
app.use('/api/crm/contacts',      contactRoutes);
app.use('/api/crm',               pipelineRoutes);
// Ventes
app.use('/api/ventes/products',   productRoutes);
app.use('/api/ventes/quotes',     quoteRoutes);
app.use('/api/ventes/orders',     orderRoutes);
app.use('/api/ventes/invoices',   invoiceRoutes);
// Workflow Engine
app.use('/api/workflow',          workflowRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0', env: process.env.NODE_ENV }));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route introuvable' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERROR]', err);
  const status  = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Erreur interne' : err.message;
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`\n🚀 ERP Backend démarré sur http://localhost:${PORT}`);
  console.log(`   ├── Environnement : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   └── Base de données : ${process.env.DATABASE_URL?.split('@')[1] || 'non configurée'}\n`);
});

export default app;
