const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');
const { verificarAutenticacion } = require('./middleware/auth');
const PORT = process.env.PORT || 3000;

dotenv.config();

// =====================================================
// CONFIGURACIÓN DE BASE DE DATOS
// =====================================================
let poolConfig;

// Si existe DATABASE_URL 
if (process.env.DATABASE_URL) {
    poolConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Necesario para Render
        },
        max: 20,
        idleTimeoutMillis: 30000,
    };
} else {
    // Configuración local
    poolConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'censo_astillera',
        max: 20,
        idleTimeoutMillis: 30000,
    };
}

const pool = new Pool(poolConfig);

pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error conectando a PostgreSQL:', err.stack);
    } else {
        console.log('✅ Conectado a PostgreSQL correctamente');
        release();
    }
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Logging de peticiones
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

app.locals.pool = pool;

// =====================================================
// CONFIGURACIÓN PARA NEON.TECH (si se detecta DATABASE_URL) y para Render (SSL)
// =====================================================

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false, // Necesario para Neon
        },
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        max: 20,
        idleTimeoutMillis: 30000,
      }
);

// =====================================================
// RUTA DE SALUD
// =====================================================
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).json({ 
            status: 'ok', 
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            database: 'disconnected',
            error: error.message 
        });
    }
});

// =====================================================
// RUTAS PÚBLICAS
// =====================================================
const authRoutes = require('./routes/auth')(pool);
app.use('/api/auth', authRoutes);

// =====================================================
// RUTAS PROTEGIDAS
// =====================================================
const habitantesRoutes = require('./routes/habitantes')(pool);
const viviendasRoutes = require('./routes/viviendas')(pool);
const serviciosRoutes = require('./routes/servicios')(pool);
const solicitudesRoutes = require('./routes/solicitudes')(pool);
const notificacionesRoutes = require('./routes/notificaciones')(pool);
const exportarRoutes = require('./routes/exportar')(pool);
const bitacoraRoutes = require('./routes/bitacora')(pool);

app.use('/api/habitantes', verificarAutenticacion, habitantesRoutes);
app.use('/api/viviendas', verificarAutenticacion, viviendasRoutes);
app.use('/api/servicios', verificarAutenticacion, serviciosRoutes);
app.use('/api/solicitudes', verificarAutenticacion, solicitudesRoutes);
app.use('/api/notificaciones', verificarAutenticacion, notificacionesRoutes);
app.use('/api/exportar', verificarAutenticacion, exportarRoutes);
app.use('/api/bitacora', verificarAutenticacion, bitacoraRoutes);

// Ruta para administración de usuarios (solo admin)
app.get('/admin/usuarios', verificarAutenticacion, (req, res) => {
    if (req.usuario && req.usuario.nivel_rol >= 3) {
        res.sendFile(path.join(__dirname, 'views', 'admin_usuarios.html'));
    } else {
        res.status(403).send('Acceso denegado');
    }
});

// Estadísticas
app.get('/api/estadisticas', verificarAutenticacion, async (req, res) => {
    try {
        const totalViviendas = await pool.query('SELECT COUNT(*) FROM viviendas');
        const totalHabitantes = await pool.query('SELECT COUNT(*) FROM habitantes');
        const ninos = await pool.query("SELECT COUNT(*) FROM habitantes WHERE calcular_edad(fecha_nac) BETWEEN 0 AND 11");
        const adultosMayores = await pool.query("SELECT COUNT(*) FROM habitantes WHERE calcular_edad(fecha_nac) >= 60");
        
        res.json({
            total_viviendas: parseInt(totalViviendas.rows[0].count),
            total_habitantes: parseInt(totalHabitantes.rows[0].count),
            ninos: parseInt(ninos.rows[0].count),
            adultos_mayores: parseInt(adultosMayores.rows[0].count)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// Servir HTML
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get('/habitantes', (req, res) => res.sendFile(path.join(__dirname, 'views', 'habitantes.html')));
app.get('/viviendas', (req, res) => res.sendFile(path.join(__dirname, 'views', 'viviendas.html')));
app.get('/servicios', (req, res) => res.sendFile(path.join(__dirname, 'views', 'servicios.html')));
app.get('/solicitudes', (req, res) => res.sendFile(path.join(__dirname, 'views', 'solicitudes.html')));
app.get('/notificaciones', (req, res) => res.sendFile(path.join(__dirname, 'views', 'notificaciones.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/perfil', (req, res) => res.sendFile(path.join(__dirname, 'views', 'perfil.html')));
app.get('/bitacora', verificarAutenticacion, (req, res) => {
    if (req.usuario && req.usuario.nivel_rol >= 3) {
        res.sendFile(path.join(__dirname, 'views', 'bitacora.html'));
    } else {
        res.status(403).send('Acceso denegado');
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📊 Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
});