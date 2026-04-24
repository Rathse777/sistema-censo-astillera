const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    
    // GET - Obtener todos los servicios (todos los roles pueden ver)
    router.get('/', async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT s.*, 
                       COUNT(sol.id_solicitud) as total_solicitudes,
                       COUNT(CASE WHEN sol.entregado = true THEN 1 END) as total_entregados
                FROM servicios s
                LEFT JOIN solicitudes sol ON s.id_servicio = sol.id_servicio
                GROUP BY s.id_servicio
                ORDER BY s.nombre_servicio
            `);
            res.json(result.rows);
        } catch (error) {
            console.error('Error GET /servicios:', error);
            res.status(500).json({ error: 'Error al obtener servicios' });
        }
    });
    
    // GET - Obtener servicio por ID
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await pool.query('SELECT * FROM servicios WHERE id_servicio = $1', [id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Servicio no encontrado' });
            }
            res.json(result.rows[0]);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al obtener servicio' });
        }
    });
    
    // POST - Crear nuevo servicio (SOLO ADMIN)
    router.post('/', async (req, res) => {
        if (req.usuario.nivel_rol < 3) {
            return res.status(403).json({ error: 'Solo administradores pueden crear servicios' });
        }
        
        try {
            const { nombre_servicio, descripcion, criterio_edad_min, criterio_edad_max } = req.body;
            
            const existe = await pool.query('SELECT id_servicio FROM servicios WHERE nombre_servicio = $1', [nombre_servicio]);
            if (existe.rows.length > 0) {
                return res.status(400).json({ error: 'Ya existe un servicio con este nombre' });
            }
            
            const result = await pool.query(
                `INSERT INTO servicios (nombre_servicio, descripcion, criterio_edad_min, criterio_edad_max, activo) 
                 VALUES ($1, $2, $3, $4, true) RETURNING *`,
                [nombre_servicio, descripcion, criterio_edad_min || 0, criterio_edad_max || 120]
            );
            
            // Registrar en bitácora
            await pool.query(
                `INSERT INTO bitacora (id_usuario, nombre_usuario, accion, tabla_afectada, registro_id, detalles)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [req.usuario.id_usuario, req.usuario.nombre_usuario, 'CREAR_SERVICIO', 'servicios', 
                 result.rows[0].id_servicio.toString(), JSON.stringify({ nombre_servicio })]
            );
            
            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al crear servicio' });
        }
    });
    
    // PUT - Actualizar servicio (SOLO ADMIN)
    router.put('/:id', async (req, res) => {
        if (req.usuario.nivel_rol < 3) {
            return res.status(403).json({ error: 'Solo administradores pueden modificar servicios' });
        }
        
        try {
            const { id } = req.params;
            const { nombre_servicio, descripcion, criterio_edad_min, criterio_edad_max, activo } = req.body;
            
            const result = await pool.query(
                `UPDATE servicios SET 
                    nombre_servicio = $1, descripcion = $2, 
                    criterio_edad_min = $3, criterio_edad_max = $4, activo = $5
                 WHERE id_servicio = $6 RETURNING *`,
                [nombre_servicio, descripcion, criterio_edad_min, criterio_edad_max, activo, id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Servicio no encontrado' });
            }
            
            await pool.query(
                `INSERT INTO bitacora (id_usuario, nombre_usuario, accion, tabla_afectada, registro_id, detalles)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [req.usuario.id_usuario, req.usuario.nombre_usuario, 'EDITAR_SERVICIO', 'servicios', id, 
                 JSON.stringify({ nombre_servicio, activo })]
            );
            
            res.json(result.rows[0]);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al actualizar servicio' });
        }
    });
    
    // DELETE - Eliminar servicio (SOLO ADMIN)
    router.delete('/:id', async (req, res) => {
        if (req.usuario.nivel_rol < 3) {
            return res.status(403).json({ error: 'Solo administradores pueden eliminar servicios' });
        }
        
        try {
            const { id } = req.params;
            
            const solicitudes = await pool.query('SELECT COUNT(*) FROM solicitudes WHERE id_servicio = $1', [id]);
            const totalSolicitudes = parseInt(solicitudes.rows[0].count);
            
            if (totalSolicitudes > 0) {
                return res.status(400).json({ 
                    error: 'No se puede eliminar el servicio porque tiene solicitudes asociadas',
                    solicitudes_asociadas: totalSolicitudes
                });
            }
            
            await pool.query('DELETE FROM servicios WHERE id_servicio = $1', [id]);
            
            await pool.query(
                `INSERT INTO bitacora (id_usuario, nombre_usuario, accion, tabla_afectada, registro_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [req.usuario.id_usuario, req.usuario.nombre_usuario, 'ELIMINAR_SERVICIO', 'servicios', id]
            );
            
            res.json({ message: 'Servicio eliminado correctamente' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al eliminar servicio' });
        }
    });
    
    return router;
};