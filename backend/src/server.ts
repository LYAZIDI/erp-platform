import 'express-async-errors';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

// Kernel routes
import authRoutes    from './kernel/auth/authRoutes';
import userRoutes    from './kernel/users/userRoutes';
import roleRoutes    from './kernel/roles/roleRoutes';
import moduleRoutes  from './kernel/modules/moduleRoutes';

// Module registry (chargement au démarrage)
import './kernel/modules/moduleRegistry';

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
app.use('/api/auth',    authRoutes);
app.use('/api/users',   userRoutes);
app.use('/api/roles',   roleRoutes);
app.use('/api/modules', moduleRoutes);

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
