const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    
    // GET - Obtener bitácora (solo admin)
    router.get('/', async (req, res) => {
        // Verificar que sea admin (nivel 3)
        if (!req.usuario || req.usuario.nivel_rol < 3) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        try {
            const result = await pool.query(`
                SELECT 
                    b.id_bitacora,
                    b.nombre_usuario,
                    b.accion,
                    b.tabla_afectada,
                    b.registro_id,
                    b.detalles,
                    b.ip_address,
                    TO_CHAR(b.fecha, 'DD/MM/YYYY HH24:MI:SS') as fecha_formateada,
                    b.fecha
                FROM bitacora b
                ORDER BY b.fecha DESC
                LIMIT 500
            `);
            
            // Formatear las acciones para mejor visualización
            const accionesFormateadas = {
                'REGISTRO_USUARIO': '📝 Registro de usuario',
                'LOGIN': '🔐 Inicio de sesión',
                'LOGOUT': '🚪 Cierre de sesión',
                'CREAR_SERVICIO': '➕ Crear servicio',
                'EDITAR_SERVICIO': '✏️ Editar servicio',
                'ELIMINAR_SERVICIO': '❌ Eliminar servicio',
                'CREAR_NOTIFICACION': '📢 Crear notificación',
                'POST /api/habitantes': '➕ Crear habitante',
                'PUT /api/habitantes': '✏️ Editar habitante',
                'DELETE /api/habitantes': '❌ Eliminar habitante',
                'POST /api/viviendas': '➕ Crear vivienda',
                'PUT /api/viviendas': '✏️ Editar vivienda',
                'DELETE /api/viviendas': '❌ Eliminar vivienda',
                'POST /api/solicitudes': '📋 Crear solicitud',
                'PUT /api/solicitudes': '✏️ Actualizar solicitud',
                'DELETE /api/solicitudes': '❌ Eliminar solicitud'
            };
            
            const registros = result.rows.map(row => ({
                ...row,
                accion_mostrar: accionesFormateadas[row.accion] || row.accion
            }));
            
            res.json(registros);
        } catch (error) {
            console.error('Error GET /bitacora:', error);
            res.status(500).json({ error: 'Error al obtener bitácora' });
        }
    });
    
    return router;
};