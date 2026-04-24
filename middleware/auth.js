const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'c0ns3j0c0mun4l2026';

// Middleware: Verificar autenticación
function verificarAutenticacion(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1] || req.cookies?.token;
    
    if (!token) {
        return res.status(401).json({ 
            error: 'No autorizado', 
            message: 'Debe iniciar sesión para acceder a este recurso' 
        });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ 
            error: 'Token inválido o expirado',
            message: 'Por favor, inicie sesión nuevamente'
        });
    }
}

// Verificar que sea ADMIN (nivel 3)
function verificarAdmin(req, res, next) {
    if (!req.usuario || req.usuario.nivel_rol < 3) {
        return res.status(403).json({ 
            error: 'Acceso denegado',
            message: 'Se requieren permisos de administrador'
        });
    }
    next();
}

// Verificar que sea VOCERO o ADMIN (nivel >= 2)
function verificarVocero(req, res, next) {
    if (!req.usuario || req.usuario.nivel_rol < 2) {
        return res.status(403).json({ 
            error: 'Acceso denegado',
            message: 'Se requieren permisos de vocero o administrador'
        });
    }
    next();
}

module.exports = {
    verificarAutenticacion,
    verificarAdmin,
    verificarVocero,
    JWT_SECRET
};