const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const CLAVES_MAESTRAS = {
    vocero: process.env.CLAVE_VOCERO || 'vocero2026',
    admin: process.env.CLAVE_ADMIN || 'admin2026'
};

module.exports = (pool) => {
    
    // POST - Login
    router.post('/login', async (req, res) => {
        try {
            const { usuario, contrasena } = req.body;
            
            if (!usuario || !contrasena) {
                return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
            }
            
            const result = await pool.query(`
                SELECT u.*, r.nombre_rol, r.nivel as nivel_rol
                FROM usuarios u
                JOIN roles r ON u.id_rol = r.id_rol
                WHERE (u.nombre_usuario = $1 OR u.email = $1) AND u.activo = true
            `, [usuario]);
            
            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
            }
            
            const usuarioDB = result.rows[0];
            const contrasenaValida = await bcrypt.compare(contrasena, usuarioDB.contrasena_hash);
            
            if (!contrasenaValida) {
                return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
            }
            
            await pool.query('UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id_usuario = $1', [usuarioDB.id_usuario]);
            
            const token = jwt.sign(
                {
                    id_usuario: usuarioDB.id_usuario,
                    nombre_usuario: usuarioDB.nombre_usuario,
                    nombre_completo: usuarioDB.nombre_completo,
                    cedula_asociada: usuarioDB.cedula_asociada,
                    id_rol: usuarioDB.id_rol,
                    nombre_rol: usuarioDB.nombre_rol,
                    nivel_rol: usuarioDB.nivel_rol
                },
                JWT_SECRET,
                { expiresIn: '8h' }
            );
            
            // Registrar en bitácora
            await pool.query(
                `INSERT INTO bitacora (id_usuario, nombre_usuario, accion, tabla_afectada, registro_id, detalles, ip_address)
                 VALUES ($1, $2, 'LOGIN', 'usuarios', $3, '{}', $4)`,
                [usuarioDB.id_usuario, usuarioDB.nombre_usuario, usuarioDB.id_usuario.toString(), req.ip]
            );
            
            res.json({
                success: true,
                token,
                usuario: {
                    id: usuarioDB.id_usuario,
                    nombre_usuario: usuarioDB.nombre_usuario,
                    nombre_completo: usuarioDB.nombre_completo,
                    cedula_asociada: usuarioDB.cedula_asociada,
                    rol: usuarioDB.nombre_rol,
                    nivel: usuarioDB.nivel_rol
                }
            });
        } catch (error) {
            console.error('Error en login:', error);
            res.status(500).json({ error: 'Error al iniciar sesión' });
        }
    });
    
    // POST - Registrar nuevo usuario (PÚBLICO)
    router.post('/registrar', async (req, res) => {
        try {
            const { nombre_usuario, email, cedula, nombre_completo, contrasena, clave_maestra } = req.body;
            
            // Validar campos requeridos
            if (!nombre_usuario || !email || !nombre_completo || !contrasena) {
                return res.status(400).json({ error: 'Todos los campos marcados con * son requeridos' });
            }
            
            if (contrasena.length < 6) {
                return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
            }
            
            // Limpiar cédula (opcional, puede estar vacía)
            const cedulaLimpia = cedula ? cedula.replace(/[^0-9]/g, '') : null;
            
            // Verificar si ya existe el usuario
            const existe = await pool.query(
                'SELECT id_usuario FROM usuarios WHERE nombre_usuario = $1 OR email = $2',
                [nombre_usuario, email]
            );
            if (existe.rows.length > 0) {
                return res.status(400).json({ error: 'El nombre de usuario o email ya está registrado' });
            }
            
            // Determinar rol según clave maestra
            let id_rol = 1; // Usuario normal por defecto
            let rol_asignado = 'usuario_normal';
            
            if (clave_maestra === CLAVES_MAESTRAS.admin) {
                id_rol = 3;
                rol_asignado = 'admin';
            } else if (clave_maestra === CLAVES_MAESTRAS.vocero) {
                id_rol = 2;
                rol_asignado = 'vocero';
            }
            
            // Hashear contraseña
            const contrasena_hash = await bcrypt.hash(contrasena, 10);
            
            // Crear el usuario
            const result = await pool.query(
                `INSERT INTO usuarios (nombre_usuario, email, contrasena_hash, nombre_completo, cedula_asociada, id_rol, activo)
                 VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id_usuario, nombre_usuario, email, nombre_completo, cedula_asociada`,
                [nombre_usuario, email, contrasena_hash, nombre_completo, cedulaLimpia, id_rol]
            );
            
            // Registrar en bitácora
            await pool.query(
                `INSERT INTO bitacora (id_usuario, nombre_usuario, accion, tabla_afectada, registro_id, detalles, ip_address)
                 VALUES ($1, $2, 'REGISTRO_USUARIO', 'usuarios', $3, $4, $5)`,
                [result.rows[0].id_usuario, nombre_usuario, result.rows[0].id_usuario.toString(), 
                 JSON.stringify({ rol_asignado, cedula: cedulaLimpia }), req.ip]
            );
            
            res.status(201).json({
                success: true,
                message: `Usuario registrado exitosamente como ${rol_asignado}`,
                usuario: result.rows[0],
                rol_asignado
            });
        } catch (error) {
            console.error('Error en registro:', error);
            res.status(500).json({ error: 'Error al registrar usuario: ' + error.message });
        }
    });
    
    // GET - Verificar token
    router.get('/verificar', async (req, res) => {
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) {
            return res.json({ authenticated: false });
        }
        
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const result = await pool.query(
                `SELECT u.*, r.nombre_rol, r.nivel as nivel_rol 
                 FROM usuarios u 
                 JOIN roles r ON u.id_rol = r.id_rol 
                 WHERE u.id_usuario = $1 AND u.activo = true`,
                [decoded.id_usuario]
            );
            
            if (result.rows.length === 0) {
                return res.json({ authenticated: false });
            }
            
            res.json({
                authenticated: true,
                usuario: {
                    id: result.rows[0].id_usuario,
                    nombre_usuario: result.rows[0].nombre_usuario,
                    nombre_completo: result.rows[0].nombre_completo,
                    cedula_asociada: result.rows[0].cedula_asociada,
                    rol: result.rows[0].nombre_rol,
                    nivel: result.rows[0].nivel_rol
                }
            });
        } catch (error) {
            res.json({ authenticated: false });
        }
    });
    
    // POST - Logout
    router.post('/logout', async (req, res) => {
        res.json({ success: true });
    });
    
    // =====================================================
    // RUTAS PROTEGIDAS (SOLO ADMIN)
    // =====================================================
    
    // Middleware para verificar admin en las siguientes rutas
    router.use('/admin', (req, res, next) => {
        if (!req.usuario || req.usuario.nivel_rol < 3) {
            return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });
        }
        next();
    });
    
    // GET - Obtener todos los usuarios (admin)
    router.get('/usuarios', async (req, res) => {
        if (!req.usuario || req.usuario.nivel_rol < 3) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        try {
            const result = await pool.query(`
                SELECT u.id_usuario, u.nombre_usuario, u.email, u.nombre_completo, 
                       u.cedula_asociada, u.activo, u.fecha_registro, u.ultimo_acceso,
                       r.nombre_rol, r.nivel, r.id_rol
                FROM usuarios u
                JOIN roles r ON u.id_rol = r.id_rol
                ORDER BY u.id_usuario
            `);
            res.json(result.rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener usuarios' });
        }
    });
    
    // POST - Cambiar contraseña (usuario logueado)
    router.post('/cambiar-contrasena', async (req, res) => {
        if (!req.usuario) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        try {
            const { contrasena_actual, contrasena_nueva } = req.body;
            
            if (!contrasena_actual || !contrasena_nueva) {
                return res.status(400).json({ error: 'Ambos campos son requeridos' });
            }
            
            if (contrasena_nueva.length < 6) {
                return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
            }
            
            const result = await pool.query('SELECT contrasena_hash FROM usuarios WHERE id_usuario = $1', [req.usuario.id_usuario]);
            const contrasenaValida = await bcrypt.compare(contrasena_actual, result.rows[0].contrasena_hash);
            
            if (!contrasenaValida) {
                return res.status(400).json({ error: 'Contraseña actual incorrecta' });
            }
            
            const nuevaHash = await bcrypt.hash(contrasena_nueva, 10);
            await pool.query('UPDATE usuarios SET contrasena_hash = $1 WHERE id_usuario = $2', [nuevaHash, req.usuario.id_usuario]);
            
            res.json({ success: true, message: 'Contraseña actualizada correctamente' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al cambiar contraseña' });
        }
    });
    
    return router;
};