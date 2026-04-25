const express = require('express');
const router = express.Router();
const { registrarEnBitacora } = require('./bitacora');

module.exports = (pool) => {
    
    // Helper para obtener el id_vivienda de un usuario basado en su cédula asociada
    async function getIdViviendaUsuario(cedula_usuario) {
        if (!cedula_usuario) return null;
        const result = await pool.query('SELECT id_vivienda FROM habitantes WHERE cedula = $1', [cedula_usuario]);
        return result.rows[0]?.id_vivienda || null;
    }

    // Helper para crear notificación automática
    async function crearNotificacionSolicitud(pool, id_usuario, nombre_usuario, datosSolicitud) {
        try {
            const titulo = `📋 Nueva Solicitud de ${datosSolicitud.nombre_servicio}`;
            const mensaje = `El usuario ${nombre_usuario} de la Casa N° ${datosSolicitud.nro_casa} ha solicitado "${datosSolicitud.nombre_servicio}".\n\n` +
                           `📅 Fecha: ${new Date().toLocaleDateString('es-VE')}\n` +
                           `🏠 Dirección: ${datosSolicitud.direccion}\n` +
                           `📝 Observaciones: ${datosSolicitud.observaciones || 'Ninguna'}`;
            
            await pool.query(
                `INSERT INTO notificaciones (titulo, mensaje, tipo, prioridad, creador_id, creador_nombre, para_todos, activa)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [titulo, mensaje, 'info', 2, id_usuario, nombre_usuario, false, true]
            );
            
            console.log('✅ Notificación de solicitud creada automáticamente');
        } catch (error) {
            console.error('Error creando notificación automática:', error);
        }
    }

    // =====================================================
    // USUARIO NORMAL: Ver MIS solicitudes
    // =====================================================
    router.get('/mis-solicitudes', async (req, res) => {
        try {
            const idVivienda = await getIdViviendaUsuario(req.usuario.cedula_asociada);
            
            if (!idVivienda) {
                return res.json([]);
            }
            
            const result = await pool.query(`
                SELECT s.*, sv.nombre_servicio, sv.descripcion as descripcion_servicio,
                       v.nro_casa, v.direccion
                FROM solicitudes s
                JOIN servicios sv ON s.id_servicio = sv.id_servicio
                JOIN viviendas v ON s.id_vivienda = v.id_vivienda
                WHERE s.id_vivienda = $1
                ORDER BY s.fecha_peticion DESC
            `, [idVivienda]);
            
            res.json(result.rows);
        } catch (error) {
            console.error('Error GET /mis-solicitudes:', error);
            res.status(500).json({ error: 'Error al obtener solicitudes' });
        }
    });

    // =====================================================
    // VOCERO/ADMIN: Ver TODAS las solicitudes
    // =====================================================
    router.get('/todas', async (req, res) => {
        if (req.usuario.nivel_rol < 2) {
            return res.status(403).json({ error: 'No tiene permisos para ver todas las solicitudes' });
        }
        
        try {
            const result = await pool.query(`
                SELECT s.*, 
                       v.nro_casa, 
                       v.direccion,
                       sv.nombre_servicio,
                       sv.descripcion as descripcion_servicio,
                       u.nombre_usuario as gestionado_por,
                       COUNT(*) OVER() as total_solicitudes
                FROM solicitudes s
                JOIN viviendas v ON s.id_vivienda = v.id_vivienda
                JOIN servicios sv ON s.id_servicio = sv.id_servicio
                LEFT JOIN usuarios u ON s.id_usuario_solicitante = u.id_usuario
                ORDER BY s.entregado ASC, s.fecha_peticion DESC
            `);
            res.json(result.rows);
        } catch (error) {
            console.error('Error GET /todas:', error);
            res.status(500).json({ error: 'Error al obtener solicitudes' });
        }
    });

    // =====================================================
    // CUALQUIER USUARIO: Crear solicitud para su vivienda
    // =====================================================
    router.post('/', async (req, res) => {
        try {
            const { id_servicio, observaciones } = req.body;
            
            // Obtener la vivienda del usuario
            const idVivienda = await getIdViviendaUsuario(req.usuario.cedula_asociada);
            
            if (!idVivienda) {
                return res.status(400).json({ 
                    error: 'No se encontró su vivienda. Registre su vivienda primero antes de solicitar servicios.' 
                });
            }
            
            // Validar que el servicio existe y está activo
            const servicio = await pool.query(
                'SELECT * FROM servicios WHERE id_servicio = $1 AND activo = true',
                [id_servicio]
            );
            
            if (servicio.rows.length === 0) {
                return res.status(400).json({ error: 'El servicio seleccionado no existe o no está disponible' });
            }
            
            // Verificar que no haya una solicitud duplicada reciente (últimos 30 días)
            const solicitudReciente = await pool.query(
                `SELECT id_solicitud FROM solicitudes 
                 WHERE id_vivienda = $1 AND id_servicio = $2 
                 AND fecha_peticion > CURRENT_DATE - INTERVAL '30 days'
                 AND entregado = false`,
                [idVivienda, id_servicio]
            );
            
            if (solicitudReciente.rows.length > 0) {
                return res.status(400).json({ 
                    error: 'Ya tiene una solicitud pendiente para este servicio en los últimos 30 días. Espere a que sea procesada.' 
                });
            }
            
            // Obtener datos de la vivienda para la notificación
            const vivienda = await pool.query('SELECT nro_casa, direccion FROM viviendas WHERE id_vivienda = $1', [idVivienda]);
            
            // Crear la solicitud
            const result = await pool.query(
                `INSERT INTO solicitudes (id_vivienda, id_servicio, id_usuario_solicitante, observaciones, fecha_peticion) 
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING *`,
                [idVivienda, id_servicio, req.usuario.id_usuario, observaciones || '']
            );
            
            const solicitudCreada = result.rows[0];
            
            // Obtener el nombre del servicio
            const nombreServicio = servicio.rows[0].nombre_servicio;
            const datosVivienda = vivienda.rows[0];
            
            // Crear notificación automática para voceros y administradores
            await crearNotificacionSolicitud(pool, req.usuario.id_usuario, req.usuario.nombre_usuario, {
                nombre_servicio: nombreServicio,
                nro_casa: datosVivienda.nro_casa,
                direccion: datosVivienda.direccion,
                observaciones: observaciones
            });
            
            // Registrar en bitácora
            await registrarEnBitacora(
                pool,
                req.usuario.id_usuario,
                req.usuario.nombre_usuario,
                'CREAR_SOLICITUD',
                'solicitudes',
                solicitudCreada.id_solicitud.toString(),
                {
                    id_servicio: id_servicio,
                    nombre_servicio: nombreServicio,
                    id_vivienda: idVivienda,
                    nro_casa: datosVivienda.nro_casa
                },
                req.ip
            );
            
            res.status(201).json({
                success: true,
                message: `Solicitud de "${nombreServicio}" registrada exitosamente. Los voceros serán notificados.`,
                solicitud: {
                    ...solicitudCreada,
                    nombre_servicio: nombreServicio,
                    nro_casa: datosVivienda.nro_casa
                }
            });
        } catch (error) {
            console.error('Error POST /solicitudes:', error);
            res.status(500).json({ error: 'Error al crear solicitud: ' + error.message });
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
            const { fecha_entrega } = req.body;
            
            const result = await pool.query(
                `UPDATE solicitudes 
                 SET entregado = true, 
                     fecha_entrega = $1,
                     id_usuario_gestion = $2,
                     fecha_gestion = CURRENT_TIMESTAMP
                 WHERE id_solicitud = $3 
                 RETURNING *`,
                [fecha_entrega || new Date().toISOString().split('T')[0], req.usuario.id_usuario, id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Solicitud no encontrada' });
            }
            
            // Obtener datos para la notificación
            const solicitud = await pool.query(`
                SELECT s.*, v.nro_casa, sv.nombre_servicio, u.nombre_usuario as solicitante
                FROM solicitudes s
                JOIN viviendas v ON s.id_vivienda = v.id_vivienda
                JOIN servicios sv ON s.id_servicio = sv.id_servicio
                JOIN usuarios u ON s.id_usuario_solicitante = u.id_usuario
                WHERE s.id_solicitud = $1
            `, [id]);
            
            const datos = solicitud.rows[0];
            
            // Crear notificación de entrega
            await pool.query(
                `INSERT INTO notificaciones (titulo, mensaje, tipo, prioridad, creador_id, creador_nombre, activa)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    `✅ Servicio Entregado: ${datos.nombre_servicio}`,
                    `Se ha marcado como entregado el servicio "${datos.nombre_servicio}" para la Casa N° ${datos.nro_casa}.\nSolicitado por: ${datos.solicitante}\nFecha de entrega: ${fecha_entrega || new Date().toLocaleDateString('es-VE')}\nGestionado por: ${req.usuario.nombre_usuario}`,
                    'success',
                    1,
                    req.usuario.id_usuario,
                    req.usuario.nombre_usuario,
                    true
                ]
            );
            
            // Registrar en bitácora
            await registrarEnBitacora(
                pool,
                req.usuario.id_usuario,
                req.usuario.nombre_usuario,
                'ENTREGAR_SOLICITUD',
                'solicitudes',
                id,
                { fecha_entrega, nombre_servicio: datos.nombre_servicio },
                req.ip
            );
            
            res.json({ 
                success: true, 
                message: `Servicio "${datos.nombre_servicio}" marcado como entregado`,
                solicitud: result.rows[0] 
            });
        } catch (error) {
            console.error('Error PUT /entregar:', error);
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
            
            if (!ids_solicitudes || ids_solicitudes.length === 0) {
                return res.status(400).json({ error: 'Seleccione al menos una solicitud' });
            }
            
            const result = await pool.query(
                `UPDATE solicitudes 
                 SET enviado_alcaldia = true, 
                     fecha_envio_alcaldia = CURRENT_TIMESTAMP,
                     id_usuario_gestion = $1
                 WHERE id_solicitud = ANY($2::int[])
                 RETURNING *`,
                [req.usuario.id_usuario, ids_solicitudes]
            );
            
            // Crear notificación
            await pool.query(
                `INSERT INTO notificaciones (titulo, mensaje, tipo, prioridad, creador_id, creador_nombre, activa)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    '📤 Reporte Enviado a Alcaldía',
                    `Se han enviado ${result.rowCount} solicitudes a la alcaldía para su procesamiento.\nGestionado por: ${req.usuario.nombre_usuario}\nFecha: ${new Date().toLocaleString('es-VE')}`,
                    'info',
                    2,
                    req.usuario.id_usuario,
                    req.usuario.nombre_usuario,
                    true
                ]
            );
            
            // Registrar en bitácora
            await registrarEnBitacora(
                pool,
                req.usuario.id_usuario,
                req.usuario.nombre_usuario,
                'ENVIAR_ALCALDIA',
                'solicitudes',
                ids_solicitudes.join(','),
                { total_enviadas: result.rowCount },
                req.ip
            );
            
            res.json({ 
                success: true, 
                message: `${result.rowCount} solicitudes enviadas a la alcaldía`,
                enviadas: result.rows.length 
            });
        } catch (error) {
            console.error('Error POST /enviar-alcaldia:', error);
            res.status(500).json({ error: 'Error al enviar a alcaldía' });
        }
    });

    // =====================================================
    // VOCERO/ADMIN: Generar reporte resumen
    // =====================================================
    router.get('/reporte', async (req, res) => {
        if (req.usuario.nivel_rol < 2) {
            return res.status(403).json({ error: 'No tiene permisos' });
        }
        
        try {
            const resumen = await pool.query(`
                SELECT 
                    sv.nombre_servicio,
                    COUNT(*)::INT as total,
                    SUM(CASE WHEN entregado THEN 1 ELSE 0 END)::INT as entregados,
                    SUM(CASE WHEN NOT entregado THEN 1 ELSE 0 END)::INT as pendientes,
                    SUM(CASE WHEN enviado_alcaldia THEN 1 ELSE 0 END)::INT as enviados_alcaldia
                FROM solicitudes s
                JOIN servicios sv ON s.id_servicio = sv.id_servicio
                GROUP BY sv.nombre_servicio
                ORDER BY sv.nombre_servicio
            `);
            
            const totales = await pool.query(`
                SELECT 
                    COUNT(*)::INT as total_solicitudes,
                    COUNT(CASE WHEN entregado THEN 1 END)::INT as total_entregados,
                    COUNT(CASE WHEN enviado_alcaldia THEN 1 END)::INT as total_enviados,
                    COUNT(CASE WHEN NOT entregado THEN 1 END)::INT as total_pendientes
                FROM solicitudes
            `);
            
            res.json({
                fecha_reporte: new Date().toISOString(),
                generado_por: req.usuario.nombre_completo || req.usuario.nombre_usuario,
                resumen_por_servicio: resumen.rows,
                totales: totales.rows[0]
            });
        } catch (error) {
            console.error('Error GET /reporte:', error);
            res.status(500).json({ error: 'Error al generar reporte' });
        }
    });

    // =====================================================
    // CUALQUIER USUARIO: Ver una solicitud específica
    // =====================================================
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const result = await pool.query(`
                SELECT s.*, v.nro_casa, v.direccion, sv.nombre_servicio, sv.descripcion as descripcion_servicio,
                       u.nombre_usuario as solicitante_nombre
                FROM solicitudes s
                JOIN viviendas v ON s.id_vivienda = v.id_vivienda
                JOIN servicios sv ON s.id_servicio = sv.id_servicio
                JOIN usuarios u ON s.id_usuario_solicitante = u.id_usuario
                WHERE s.id_solicitud = $1
            `, [id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Solicitud no encontrada' });
            }
            
            const solicitud = result.rows[0];
            
            // Verificar permisos: solo admin/vocero o el dueño de la solicitud
            if (req.usuario.nivel_rol < 2) {
                const idViviendaUsuario = await getIdViviendaUsuario(req.usuario.cedula_asociada);
                if (solicitud.id_vivienda !== idViviendaUsuario) {
                    return res.status(403).json({ error: 'No tiene permiso para ver esta solicitud' });
                }
            }
            
            res.json(solicitud);
        } catch (error) {
            console.error('Error GET /:id:', error);
            res.status(500).json({ error: 'Error al obtener solicitud' });
        }
    });

    // =====================================================
    // ADMIN: Eliminar solicitud
    // =====================================================
    router.delete('/:id', async (req, res) => {
        if (req.usuario.nivel_rol < 3) {
            return res.status(403).json({ error: 'Solo administradores pueden eliminar solicitudes' });
        }
        
        try {
            const { id } = req.params;
            await pool.query('DELETE FROM solicitudes WHERE id_solicitud = $1', [id]);
            
            await registrarEnBitacora(
                pool,
                req.usuario.id_usuario,
                req.usuario.nombre_usuario,
                'ELIMINAR_SOLICITUD',
                'solicitudes',
                id,
                {},
                req.ip
            );
            
            res.json({ success: true, message: 'Solicitud eliminada' });
        } catch (error) {
            console.error('Error DELETE /:id:', error);
            res.status(500).json({ error: 'Error al eliminar solicitud' });
        }
    });

    return router;
};