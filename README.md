# ERP Platform

## Démarrage rapide

### 1. Prérequis
- Node.js 18+
- PostgreSQL (local ou Neon cloud)

### 2. Backend

```bash
cd backend
cp .env.example .env
# Modifier DATABASE_URL dans .env

npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Connexion démo
- URL : http://localhost:5173
- Tenant : `demo`
- Email : `admin@demo.com`
- Mot de passe : `Admin123!`
