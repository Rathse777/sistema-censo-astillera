const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    // GET - Obtener notificaciones activas (todos pueden ver)
    router.get('/', async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT * FROM notificaciones 
                WHERE activa = true AND (fecha_expiracion IS NULL OR fecha_expiracion >= CURRENT_DATE)
                ORDER BY prioridad DESC, fecha_creacion DESC`);
            res.json(result.rows);
        } catch (error) { res.status(500).json({ error: 'Error al obtener notificaciones' }); }
    });

    // Middleware para proteger las siguientes rutas (vocero/admin)
    router.use((req, res, next) => {
        if (req.usuario && req.usuario.nivel_rol >= 2) return next();
        return res.status(403).json({ error: 'Acción solo para voceros o administradores.' });
    });

    // POST - Crear notificación
    router.post('/', async (req, res) => {
        try {
            const { titulo, mensaje, tipo, prioridad } = req.body;
            const result = await pool.query(
                `INSERT INTO notificaciones (titulo, mensaje, tipo, prioridad, creador_id, creador_nombre)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [titulo, mensaje, tipo || 'info', prioridad || 1, req.usuario.id_usuario, req.usuario.nombre_usuario]
            );
            res.status(201).json(result.rows[0]);
        } catch (error) { res.status(500).json({ error: 'Error al crear notificación' }); }
    });

    // DELETE - Eliminar notificación (solo admin)
    router.delete('/:id', async (req, res) => {
        if (req.usuario.nivel_rol < 3) return res.status(403).json({ error: 'Solo administradores pueden eliminar notificaciones' });
        try {
            await pool.query('DELETE FROM notificaciones WHERE id_notificacion = $1', [req.params.id]);
            res.json({ message: 'Notificación eliminada' });
        } catch (error) { res.status(500).json({ error: 'Error al eliminar notificación' }); }
    });

    return router;
};