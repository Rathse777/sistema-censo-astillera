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

    // GET - Obtener habitantes
    router.get('/', async (req, res) => {
        try {
            let query, params;
            if (req.usuario.nivel_rol >= 2) {
                // Admin o Vocero ven todo
                query = `
                    SELECT h.*, v.nro_casa, v.direccion,
                           calcular_edad(h.fecha_nac) as edad
                    FROM habitantes h
                    JOIN viviendas v ON h.id_vivienda = v.id_vivienda
                    ORDER BY h.nombre_completo`;
                params = [];
            } else {
                // Usuario normal solo ve su familia
                const idVivienda = await getIdViviendaUsuario(req.usuario.cedula_asociada);
                if (!idVivienda) return res.json([]); // No tiene vivienda o cédula asociada
                query = `
                    SELECT h.*, v.nro_casa, v.direccion,
                           calcular_edad(h.fecha_nac) as edad
                    FROM habitantes h
                    JOIN viviendas v ON h.id_vivienda = v.id_vivienda
                    WHERE h.id_vivienda = $1
                    ORDER BY h.es_jefe_familia DESC, h.nombre_completo`;
                params = [idVivienda];
            }
            const result = await pool.query(query, params);
            res.json(result.rows);
        } catch (error) {
            console.error('Error GET /habitantes:', error);
            res.status(500).json({ error: 'Error al obtener habitantes' });
        }
    });

    // GET - Obtener un habitante por cédula
    router.get('/:cedula', async (req, res) => {
        try {
            const { cedula } = req.params;
            const result = await pool.query(`
                SELECT h.*, v.nro_casa, v.direccion, calcular_edad(h.fecha_nac) as edad
                FROM habitantes h JOIN viviendas v ON h.id_vivienda = v.id_vivienda WHERE h.cedula = $1`, [cedula]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Habitante no encontrado' });

            const habitante = result.rows[0];
            if (req.usuario.nivel_rol < 2) {
                const idViviendaUsuario = await getIdViviendaUsuario(req.usuario.cedula_asociada);
                if (habitante.id_vivienda !== idViviendaUsuario) {
                    return res.status(403).json({ error: 'No tiene permiso para ver este habitante' });
                }
            }
            res.json(habitante);
        } catch (error) { res.status(500).json({ error: 'Error al obtener habitante' }); }
    });

    // POST - Crear habitante
    router.post('/', async (req, res) => {
        try {
            const { cedula, nombre_completo, fecha_nac, sexo, id_vivienda, /* ... otros campos ... */ } = req.body;
            let idViviendaPermitida = id_vivienda;

            if (req.usuario.nivel_rol < 2) {
                idViviendaPermitida = await getIdViviendaUsuario(req.usuario.cedula_asociada);
                if (!idViviendaPermitida || parseInt(id_vivienda) !== idViviendaPermitida) {
                    return res.status(403).json({ error: 'Solo puede agregar habitantes a su propia vivienda.' });
                }
            }

            // Validar que no exista la cédula
            const existe = await pool.query('SELECT cedula FROM habitantes WHERE cedula = $1', [cedula]);
            if (existe.rows.length > 0) return res.status(400).json({ error: 'Ya existe un habitante con esta cédula' });

            const result = await pool.query(
                `INSERT INTO habitantes (cedula, nombre_completo, fecha_nac, sexo, id_vivienda)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [cedula, nombre_completo, fecha_nac, sexo, idViviendaPermitida]
            );
            await registrarEnBitacora(pool, req.usuario.id_usuario, req.usuario.nombre_usuario, 'CREAR_HABITANTE', 'habitantes', cedula, { cedula, nombre_completo }, req.ip);
            res.status(201).json(result.rows[0]);
        } catch (error) { res.status(500).json({ error: 'Error al crear habitante' }); }
    });

    // PUT - Actualizar habitante
    router.put('/:cedula', async (req, res) => {
        try {
            const { cedula } = req.params;
            const data = req.body;

            const habitante = await pool.query('SELECT id_vivienda FROM habitantes WHERE cedula = $1', [cedula]);
            if (habitante.rows.length === 0) return res.status(404).json({ error: 'Habitante no encontrado' });

            if (req.usuario.nivel_rol < 2) {
                const idViviendaUsuario = await getIdViviendaUsuario(req.usuario.cedula_asociada);
                if (habitante.rows[0].id_vivienda !== idViviendaUsuario) {
                    return res.status(403).json({ error: 'Solo puede modificar habitantes de su propia vivienda.' });
                }
            }

            const result = await pool.query(
                `UPDATE habitantes SET nombre_completo = $1, fecha_nac = $2, sexo = $3
                 WHERE cedula = $4 RETURNING *`,
                [data.nombre_completo, data.fecha_nac, data.sexo, cedula]
            );
            await registrarEnBitacora(pool, req.usuario.id_usuario, req.usuario.nombre_usuario, 'EDITAR_HABITANTE', 'habitantes', cedula, data, req.ip);
            res.json(result.rows[0]);
        } catch (error) { res.status(500).json({ error: 'Error al actualizar habitante' }); }
    });

    // DELETE - Eliminar habitante (Solo Admin/Vocero)
    router.delete('/:cedula', async (req, res) => {
        if (req.usuario.nivel_rol < 2) return res.status(403).json({ error: 'Acción solo para administradores o voceros.' });
        try {
            const { cedula } = req.params;
            await pool.query('DELETE FROM habitantes WHERE cedula = $1', [cedula]);
            res.json({ message: 'Habitante eliminado' });
        } catch (error) { res.status(500).json({ error: 'Error al eliminar habitante' }); }
    });
    return router;
};