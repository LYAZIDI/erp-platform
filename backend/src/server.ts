import app from './app';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`\n🚀 ERP Backend démarré sur http://localhost:${PORT}`);
  console.log(`   ├── Environnement : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   └── Base de données : ${process.env.DATABASE_URL?.split('@')[1] || 'non configurée'}\n`);
});
