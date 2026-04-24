const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    // GET - Obtener todas las viviendas (disponible para todos los roles autenticados)
    router.get('/', async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT v.*, COUNT(h.cedula)::INT as total_habitantes
                FROM viviendas v
                LEFT JOIN habitantes h ON v.id_vivienda = h.id_vivienda
                GROUP BY v.id_vivienda
                ORDER BY v.nro_casa::INTEGER NULLS LAST
            `);
            res.json(result.rows);
        } catch (error) { res.status(500).json({ error: 'Error al obtener viviendas' }); }
    });

    // GET - Obtener una vivienda por ID
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await pool.query(`
                SELECT v.*, COUNT(h.cedula)::INT as total_habitantes
                FROM viviendas v LEFT JOIN habitantes h ON v.id_vivienda = h.id_vivienda
                WHERE v.id_vivienda = $1 GROUP BY v.id_vivienda`, [id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Vivienda no encontrada' });
            res.json(result.rows[0]);
        } catch (error) { res.status(500).json({ error: 'Error al obtener vivienda' }); }
    });

    // POST, PUT, DELETE - Solo Admin/Vocero
    router.use((req, res, next) => {
        if (req.method === 'GET') return next();
        if (req.usuario && req.usuario.nivel_rol >= 2) return next();
        return res.status(403).json({ error: 'Acción solo para administradores o voceros.' });
    });

    router.post('/', async (req, res) => {
        try {
            const { nro_casa, direccion } = req.body;
            const existe = await pool.query('SELECT id_vivienda FROM viviendas WHERE nro_casa = $1', [nro_casa]);
            if (existe.rows.length > 0) return res.status(400).json({ error: 'Ya existe una vivienda con este número' });
            const result = await pool.query(
                `INSERT INTO viviendas (nro_casa, direccion, tipo_tenencia, condicion_infra)
                 VALUES ($1, $2, 'Propia', 'Buena') RETURNING *`, [nro_casa, direccion]);
            res.status(201).json(result.rows[0]);
        } catch (error) { res.status(500).json({ error: 'Error al crear vivienda' }); }
    });

    router.put('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { nro_casa, direccion, tipo_tenencia, condicion_infra } = req.body;
            const result = await pool.query(
                `UPDATE viviendas SET nro_casa=$1, direccion=$2, tipo_tenencia=$3, condicion_infra=$4
                 WHERE id_vivienda=$5 RETURNING *`, [nro_casa, direccion, tipo_tenencia, condicion_infra, id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Vivienda no encontrada' });
            res.json(result.rows[0]);
        } catch (error) { res.status(500).json({ error: 'Error al actualizar vivienda' }); }
    });

    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            await pool.query('DELETE FROM viviendas WHERE id_vivienda = $1', [id]);
            res.json({ message: 'Vivienda eliminada' });
        } catch (error) { res.status(500).json({ error: 'Error al eliminar vivienda' }); }
    });
    return router;
};