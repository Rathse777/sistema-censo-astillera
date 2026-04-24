const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');
const { verificarAutenticacion } = require('./middleware/auth');

dotenv.config();

// =====================================================
// CONFIGURACIÓN DE BASE DE DATOS (CORREGIDA)
// =====================================================
let poolConfig;

if (process.env.DATABASE_URL) {
    // Producción: Neon
    console.log('🔄 Configurando conexión para Neon...');
    poolConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000, // 10 segundos máximo para conectar
    };
} else {
    // Desarrollo local
    console.log('🔄 Configurando conexión para PostgreSQL local...');
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

// =====================================================
// PROBAR CONEXIÓN (sin detener la app si falla)
// =====================================================
async function probarConexion() {
    try {
        const client = await pool.connect();
        console.log('✅ Conectado a PostgreSQL correctamente');
        client.release();
        return true;
    } catch (err) {
        console.error('❌ Error conectando a PostgreSQL:', err.message);
        console.error('   La aplicación iniciará pero la base de datos no estará disponible.');
        console.error('   Verifica tu DATABASE_URL en las variables de entorno de Render.');
        return false;
    }
}

// =====================================================
// CONFIGURACIÓN DE EXPRESS
// =====================================================
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Logging de peticiones
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Middleware para verificar conexión a BD antes de rutas que la necesiten
app.use((req, res, next) => {
    // Adjuntar pool a req.locals para que las rutas puedan usarlo
    req.locals = { pool };
    next();
});

app.locals.pool = pool;

// =====================================================
// RUTAS PÚBLICAS
// =====================================================
try {
    const authRoutes = require('./routes/auth')(pool);
    app.use('/api/auth', authRoutes);
    console.log('✅ Rutas de autenticación cargadas');
} catch (error) {
    console.error('❌ Error cargando rutas de autenticación:', error.message);
}

// =====================================================
// RUTAS PROTEGIDAS
// =====================================================
try {
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
    console.log('✅ Rutas protegidas cargadas');
} catch (error) {
    console.error('❌ Error cargando rutas protegidas:', error.message);
}

// =====================================================
// RUTA DE ESTADÍSTICAS (con manejo de errores)
// =====================================================
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
        console.error('Error en estadísticas:', error);
        res.status(500).json({ 
            error: 'Error al obtener estadísticas',
            message: 'La base de datos no está disponible temporalmente'
        });
    }
});

// =====================================================
// RUTAS PARA SERVIR HTML
// =====================================================
const viewsDir = path.join(__dirname, 'views');

// Verificar que la carpeta views existe
try {
    const fs = require('fs');
    if (!fs.existsSync(viewsDir)) {
        console.error('⚠️  La carpeta "views" no existe. Creándola...');
        fs.mkdirSync(viewsDir, { recursive: true });
    }
} catch (err) {
    console.error('Error verificando carpeta views:', err.message);
}

// Ruta para administración de usuarios (solo admin)
app.get('/admin/usuarios', (req, res) => {
    const filePath = path.join(viewsDir, 'admin_usuarios.html');
    if (require('fs').existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Página no encontrada');
    }
});

// Servir páginas HTML
const paginas = [
    '', 'habitantes', 'viviendas', 'servicios', 
    'solicitudes', 'notificaciones', 'login', 'perfil', 'bitacora'
];

paginas.forEach(pagina => {
    const ruta = pagina === '' ? '/' : `/${pagina}`;
    const archivo = pagina === '' ? 'index.html' : `${pagina}.html`;
    
    app.get(ruta, (req, res) => {
        const filePath = path.join(viewsDir, archivo);
        if (require('fs').existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            res.status(404).send(`Página ${archivo} no encontrada`);
        }
    });
});

// =====================================================
// MANEJO DE ERRORES GLOBAL
// =====================================================
app.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    res.status(500).json({ 
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'production' ? 'Algo salió mal' : err.message
    });
});

// =====================================================
// INICIAR SERVIDOR
// =====================================================
async function iniciarServidor() {
    // Probar conexión a la base de datos (no bloquea el inicio)
    const dbConectada = await probarConexion();
    
    app.listen(PORT, () => {
        console.log(`
    🚀 ========================================
    ✅ Sistema Censo La Astillera corriendo!
    📡 Servidor: http://localhost:${PORT}
    📊 Base de datos: ${dbConectada ? 'PostgreSQL conectada' : '⚠️  NO CONECTADA - Verificar configuración'}
    🔐 Autenticación: Activada
    👥 Roles: Usuario Normal | Vocero | Admin
    ========================================
        `);
    });
}

iniciarServidor().catch(err => {
    console.error('Error fatal al iniciar el servidor:', err);
    process.exit(1);
});