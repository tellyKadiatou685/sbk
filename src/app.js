import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

// Import des routes
import userRoutes from './routes/userRoutes.js';
import TransactionRoute from './routes/transactionRoutes.js';
import RecentTransactionRoutes from './routes/recentTransactionRoutes.js';

const app = express();

// Configuration CORS optimisée
const corsOptions = {
  origin: function (origin, callback) {
    console.log('🔍 Vérification CORS pour origine:', origin);
    
    // Environnement de développement
    const devOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:8080',
      'http://localhost:8081' // AJOUTÉ pour votre cas
    ];
    
    // Environnement de production
    const prodOrigins = [
      'https://sbk-frontend-7wxuidwc2-kadiatou-diallos-projects-f9d54a93.vercel.app'
    ];
    
    // Permettre les requêtes sans origine (ex: Postman, mobile apps)
    if (!origin) {
      console.log('✅ Requête sans origine autorisée');
      return callback(null, true);
    }
    
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? [...prodOrigins, ...devOrigins] 
      : devOrigins;
    
    // Vérifier d'abord la liste explicite
    if (allowedOrigins.includes(origin)) {
      console.log('✅ Origine dans la liste autorisée:', origin);
      return callback(null, true);
    }
    
    // Vérifier les domaines Vercel avec regex plus spécifique
    const isVercelDomain = /^https:\/\/sbk-frontend-[a-z0-9]+-kadiatou-diallos-projects-f9d54a93\.vercel\.app$/.test(origin);
    
    if (isVercelDomain) {
      console.log('✅ Domaine Vercel autorisé:', origin);
      return callback(null, true);
    }
    
    console.warn('❌ Origine bloquée par CORS:', origin);
    callback(new Error('Non autorisé par CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400,
  optionsSuccessStatus: 200 // Pour les anciens navigateurs
};

// IMPORTANT: CORS doit être en PREMIER, avant Helmet
app.use(cors(corsOptions));

// Gestion explicite des requêtes OPTIONS AVANT les autres middlewares
app.options('*', cors(corsOptions)); // Utiliser la config CORS

// Sécurité avec Helmet APRÈS CORS
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" } // Important pour les API
}));

// Rate limiting APRÈS CORS
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5000 : 10000, // Augmenté pour 10+ users
  message: {
    success: false,
    message: 'Limite atteinte. Veuillez patienter quelques minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path === '/api/health' || req.method === 'OPTIONS';
  }
});

app.use('/api/', limiter);

// Parsing middleware
app.use(express.json({ 
  limit: '10mb',
  strict: true
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb'
}));

// Middleware de logging avec plus d'infos
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - Origin: ${req.headers.origin} - IP: ${req.ip}`);
  next();
});
// Ajouter après vos middlewares existants
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`📊 ${new Date().toISOString()} - ${req.ip} - ${req.method} ${req.path}`);
  }
  next();
});
// Route de santé de base
app.get('/', (req, res) => {
  res.json({ 
    message: 'SBK API Server',
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    cors: 'enabled'
  });
});

// Route de vérification de santé complète
app.get('/api/health', async (req, res) => {
  try {
    const { testConnection } = await import('./config/database.js');
    const dbStatus = await testConnection();
    
    res.json({
      status: 'healthy',
      database: dbStatus ? 'connected' : 'disconnected',
      environment: process.env.NODE_ENV || 'development',
      cors: 'configured',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Route de test CORS
app.get('/api/test-cors', (req, res) => {
  res.json({
    message: 'CORS fonctionne !',
    origin: req.headers.origin,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Routes API avec préfixes cohérents
app.use('/api/users', userRoutes);
app.use('/api/transactions', TransactionRoute);
app.use('/api/recent', RecentTransactionRoutes);

// Route de test pour vérifier l'authentification
app.get('/api/test-auth', (req, res) => {
  res.json({
    message: 'Route de test accessible',
    headers: req.headers.authorization ? 'Token présent' : 'Pas de token',
    timestamp: new Date().toISOString()
  });
});

// Route 404 avec plus d'informations
app.use('*', (req, res) => {
  console.log(`❌ Route non trouvée: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    path: req.originalUrl,
    method: req.method,
    availableRoutes: [
      'GET /api/health',
      'GET /api/test-cors',
      'POST /api/users/login',
      'POST /api/users/register-request',
      'GET /api/users/profile',
      'GET /api/transactions',
      'GET /api/recent'
    ],
    timestamp: new Date().toISOString()
  });
});

// Gestion d'erreurs globale améliorée
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur globale:', err);
  
  // Erreur CORS
  if (err.message.includes('CORS') || err.message.includes('Non autorisé par CORS')) {
    return res.status(403).json({
      success: false,
      message: `Accès refusé: origine ${req.headers.origin} non autorisée`,
      error: 'CORS_ERROR'
    });
  }
  
  // Erreur de limite de taille
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Données trop volumineuses',
      error: 'PAYLOAD_TOO_LARGE'
    });
  }
  
  // Erreur JSON malformé
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Format JSON invalide',
      error: 'INVALID_JSON'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Erreur serveur interne',
    error: process.env.NODE_ENV === 'development' ? err.message : 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  });
});

export default app;