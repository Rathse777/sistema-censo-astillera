const express = require('express');
const router = express.Router();
const { verificarAutenticacion } = require('../middleware/auth');

module.exports = (pool) => {
    
    // Aplicar autenticación a todas las rutas
    router.use(verificarAutenticacion);
    
    // =====================================================
    // USUARIO NORMAL: Crear solicitud para su vivienda
    // =====================================================
    router.post('/', async (req, res) => {
        try {
            const { id_servicio, observaciones } = req.body;
            const id_vivienda = req.usuario.id_vivienda; // Esto no está en el token por defecto, se podría obtener de habitantes
            
            // Obtener la vivienda del usuario a través de su cédula asociada
            if (!req.usuario.cedula_asociada) {
                return res.status(400).json({ error: 'Su usuario no tiene una cédula asociada. Contacte al administrador.' });
            }

            const viviendaResult = await pool.query(
                'SELECT id_vivienda FROM habitantes WHERE cedula = $1',
                [req.usuario.cedula_asociada]
            );

            if (viviendaResult.rows.length === 0) {
                return res.status(400).json({ error: 'No se encontró una vivienda asociada a su cédula.' });
            }

            const id_vivienda_real = viviendaResult.rows[0].id_vivienda;
            
            const result = await pool.query(
                `INSERT INTO solicitudes (id_vivienda, id_servicio, id_usuario_solicitante, observaciones) 
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [id_vivienda_real, id_servicio, req.usuario.id_usuario, observaciones]
            );
            
            res.status(201).json({ success: true, solicitud: result.rows[0] });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al crear solicitud' });
        }
    });
    
    // =====================================================
    // USUARIO NORMAL: Ver MIS solicitudes
    // =====================================================
    router.get('/mis-solicitudes', async (req, res) => {
        try {
            if (!req.usuario.cedula_asociada) {
                return res.json([]);
            }

            const viviendaResult = await pool.query(
                'SELECT id_vivienda FROM habitantes WHERE cedula = $1',
                [req.usuario.cedula_asociada]
            );

            if (viviendaResult.rows.length === 0) {
                return res.json([]);
            }

            const id_vivienda = viviendaResult.rows[0].id_vivienda;
            
            const result = await pool.query(`
                SELECT s.*, sv.nombre_servicio
                FROM solicitudes s
                JOIN servicios sv ON s.id_servicio = sv.id_servicio
                WHERE s.id_vivienda = $1
                ORDER BY s.fecha_peticion DESC
            `, [id_vivienda]);
            
            res.json(result.rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener solicitudes' });
        }
    });
    
    // =====================================================
    // VOCERO/ADMIN: Ver TODAS las solicitudes
    // =====================================================
    router.get('/todas', async (req, res) => {
        // Solo vocero o admin
        if (req.usuario.nivel_rol < 2) {
            return res.status(403).json({ error: 'No tiene permisos para ver todas las solicitudes' });
        }
        
        try {
            const result = await pool.query(`
                SELECT s.*, 
                       v.nro_casa, 
                       v.direccion,
                       sv.nombre_servicio,
                       u.nombre_usuario as gestionado_por_nombre
                FROM solicitudes s
                JOIN viviendas v ON s.id_vivienda = v.id_vivienda
                JOIN servicios sv ON s.id_servicio = sv.id_servicio
                LEFT JOIN usuarios u ON s.gestionada_por = u.id_usuario
                ORDER BY s.entregado ASC, s.fecha_peticion DESC
            `);
            res.json(result.rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener solicitudes' });
        }
    });
    
    // =====================================================
    // VOCERO/ADMIN: Marcar solicitud como entregada
    // =====================================================
    router.put('/:id/entregar', async (req, res) => {
        if (req.usuario.nivel_rol < 2) {
            return res.status(403).json({ error: 'No tiene permisos para gestionar entregas' });
        }
        
        try {
            const { id } = req.params;
            const result = await pool.query(
                `UPDATE solicitudes 
                 SET entregado = true, 
                     fecha_entrega = CURRENT_DATE,
                     gestionada_por = $1
                 WHERE id_solicitud = $2 
                 RETURNING *`,
                [req.usuario.id_usuario, id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Solicitud no encontrada' });
            }
            
            res.json({ success: true, solicitud: result.rows[0] });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al marcar como entregada' });
        }
    });
    
    // =====================================================
    // VOCERO/ADMIN: Enviar reporte a alcaldía
    // =====================================================
    router.post('/enviar-alcaldia', async (req, res) => {
        if (req.usuario.nivel_rol < 2) {
            return res.status(403).json({ error: 'No tiene permisos para enviar a alcaldía' });
        }
        
        try {
            const { ids_solicitudes } = req.body;
            
            // Actualizar las solicitudes seleccionadas
            const result = await pool.query(
                `UPDATE solicitudes 
                 SET enviado_alcaldia = true, 
                     fecha_envio_alcaldia = CURRENT_TIMESTAMP,
                     gestionada_por = $1
                 WHERE id_solicitud = ANY($2::int[])
                 RETURNING *`,
                [req.usuario.id_usuario, ids_solicitudes]
            );
            
            res.json({ 
                success: true, 
                message: `${result.rowCount} solicitudes enviadas a la alcaldía`,
                enviadas: result.rows.length
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al enviar a alcaldía' });
        }
    });
    
    // =====================================================
    // VOCERO/ADMIN: Generar reporte PDF (simulado)
    // =====================================================
    router.get('/reporte', async (req, res) => {
        if (req.usuario.nivel_rol < 2) {
            return res.status(403).json({ error: 'No tiene permisos' });
        }
        
        try {
            // Obtener resumen de solicitudes
            const resumen = await pool.query(`
                SELECT 
                    sv.nombre_servicio,
                    COUNT(*) as total,
                    SUM(CASE WHEN entregado THEN 1 ELSE 0 END) as entregados,
                    SUM(CASE WHEN NOT entregado THEN 1 ELSE 0 END) as pendientes,
                    SUM(CASE WHEN enviado_alcaldia THEN 1 ELSE 0 END) as enviados_alcaldia
                FROM solicitudes s
                JOIN servicios sv ON s.id_servicio = sv.id_servicio
                GROUP BY sv.nombre_servicio
            `);
            
            const totales = await pool.query(`
                SELECT 
                    COUNT(*) as total_solicitudes,
                    COUNT(CASE WHEN entregado THEN 1 END) as total_entregados,
                    COUNT(CASE WHEN enviado_alcaldia THEN 1 END) as total_enviados
                FROM solicitudes
            `);
            
            res.json({
                fecha_reporte: new Date().toISOString(),
                generado_por: req.usuario.nombre_completo,
                resumen_por_servicio: resumen.rows,
                totales: totales.rows[0]
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al generar reporte' });
        }
    });
    
    return router;
};