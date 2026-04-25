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

    // GET - Obtener todas las viviendas (todos los roles pueden ver)
    router.get('/', async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT v.*, 
                       COUNT(h.cedula)::INT as total_habitantes,
                       COUNT(CASE WHEN h.es_jefe_familia THEN 1 END)::INT as total_jefes,
                       COUNT(CASE WHEN calcular_edad(h.fecha_nac) BETWEEN 0 AND 11 THEN 1 END)::INT as ninos,
                       COUNT(CASE WHEN calcular_edad(h.fecha_nac) >= 60 THEN 1 END)::INT as adultos_mayores
                FROM viviendas v
                LEFT JOIN habitantes h ON v.id_vivienda = h.id_vivienda
                GROUP BY v.id_vivienda
                ORDER BY v.nro_casa::INTEGER NULLS LAST
            `);
            res.json(result.rows);
        } catch (error) {
            console.error('Error GET /viviendas:', error);
            res.status(500).json({ error: 'Error al obtener viviendas' });
        }
    });

    // GET - Obtener una vivienda por ID
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await pool.query(`
                SELECT v.*, COUNT(h.cedula)::INT as total_habitantes
                FROM viviendas v 
                LEFT JOIN habitantes h ON v.id_vivienda = h.id_vivienda
                WHERE v.id_vivienda = $1 
                GROUP BY v.id_vivienda
            `, [id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Vivienda no encontrada' });
            }
            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error GET /viviendas/:id:', error);
            res.status(500).json({ error: 'Error al obtener vivienda' });
        }
    });

    // GET - Verificar si el usuario YA tiene una vivienda registrada
    router.get('/verificar/mi-vivienda', async (req, res) => {
        try {
            if (!req.usuario.cedula_asociada) {
                return res.json({ tiene_vivienda: false, mensaje: 'No tiene cédula asociada' });
            }
            
            const idVivienda = await getIdViviendaUsuario(req.usuario.cedula_asociada);
            
            if (idVivienda) {
                const result = await pool.query('SELECT * FROM viviendas WHERE id_vivienda = $1', [idVivienda]);
                return res.json({ 
                    tiene_vivienda: true, 
                    vivienda: result.rows[0],
                    mensaje: 'Ya tiene una vivienda registrada'
                });
            }
            
            res.json({ tiene_vivienda: false, mensaje: 'No tiene vivienda registrada' });
        } catch (error) {
            console.error('Error verificando vivienda:', error);
            res.status(500).json({ error: 'Error al verificar vivienda' });
        }
    });

    // POST - Crear nueva vivienda
    // Usuario normal: SOLO puede crear UNA vivienda (la suya)
    // Admin/Vocero: pueden crear todas las que quieran
    router.post('/', async (req, res) => {
        try {
            const { nro_casa, direccion, tipo_tenencia, condicion_infra, referencia, 
                    num_habitaciones, num_baños, tiene_agua, tiene_luz, tiene_gas, observaciones } = req.body;
            
            // Validar que el usuario tenga cédula asociada si es usuario normal
            if (req.usuario.nivel_rol < 2) {
                if (!req.usuario.cedula_asociada) {
                    return res.status(400).json({ 
                        error: 'Debe tener una cédula asociada a su cuenta para registrar una vivienda. Contacte al administrador.' 
                    });
                }
                
                // Verificar si YA tiene una vivienda
                const idViviendaExistente = await getIdViviendaUsuario(req.usuario.cedula_asociada);
                if (idViviendaExistente) {
                    return res.status(400).json({ 
                        error: 'Ya tiene una vivienda registrada. Solo puede registrar una vivienda.',
                        id_vivienda_existente: idViviendaExistente
                    });
                }
            }
            
            // Validar que el número de casa no esté duplicado
            const existe = await pool.query('SELECT id_vivienda FROM viviendas WHERE nro_casa = $1', [nro_casa]);
            if (existe.rows.length > 0) {
                return res.status(400).json({ error: 'Ya existe una vivienda con este número de casa' });
            }
            
            const result = await pool.query(
                `INSERT INTO viviendas (nro_casa, direccion, tipo_tenencia, condicion_infra, referencia, 
                                        num_habitaciones, num_baños, tiene_agua, tiene_luz, tiene_gas, observaciones) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
                [nro_casa, direccion, tipo_tenencia || 'Propia', condicion_infra || 'Buena', 
                 referencia || '', num_habitaciones || 1, num_baños || 1, 
                 tiene_agua !== false, tiene_luz !== false, tiene_gas !== false, observaciones || '']
            );
            
            const nuevaVivienda = result.rows[0];
            
            // Si es usuario normal, crear automáticamente su registro como habitante jefe de familia
            if (req.usuario.nivel_rol < 2 && req.usuario.cedula_asociada) {
                try {
                    await pool.query(
                        `INSERT INTO habitantes (cedula, nombre_completo, fecha_nac, sexo, es_jefe_familia, id_vivienda, id_usuario_propietario)
                         VALUES ($1, $2, $3, 'M', true, $4, $5)
                         ON CONFLICT (cedula) DO NOTHING`,
                        [req.usuario.cedula_asociada, req.usuario.nombre_completo || 'Usuario', '1990-01-01', nuevaVivienda.id_vivienda, req.usuario.id_usuario]
                    );
                } catch (error) {
                    console.error('Error creando habitante automático:', error);
                    // No bloqueamos la creación de la vivienda si falla esto
                }
            }
            
            // Registrar en bitácora
            await registrarEnBitacora(
                pool, 
                req.usuario.id_usuario, 
                req.usuario.nombre_usuario, 
                'CREAR_VIVIENDA', 
                'viviendas', 
                nuevaVivienda.id_vivienda.toString(), 
                { nro_casa, direccion, creado_por: req.usuario.nivel_rol < 2 ? 'usuario_normal' : 'admin/vocero' },
                req.ip
            );
            
            res.status(201).json({
                success: true,
                message: 'Vivienda registrada exitosamente',
                vivienda: nuevaVivienda
            });
        } catch (error) {
            console.error('Error POST /viviendas:', error);
            res.status(500).json({ error: 'Error al crear vivienda: ' + error.message });
        }
    });

    // PUT - Actualizar vivienda (usuarios normales solo pueden editar SU vivienda)
    router.put('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { nro_casa, direccion, tipo_tenencia, condicion_infra, referencia,
                    num_habitaciones, num_baños, tiene_agua, tiene_luz, tiene_gas, observaciones } = req.body;
            
            // Verificar permisos
            if (req.usuario.nivel_rol < 2) {
                const idViviendaUsuario = await getIdViviendaUsuario(req.usuario.cedula_asociada);
                if (parseInt(id) !== idViviendaUsuario) {
                    return res.status(403).json({ error: 'Solo puede editar su propia vivienda.' });
                }
            }
            
            // Validar número de casa duplicado
            const existe = await pool.query(
                'SELECT id_vivienda FROM viviendas WHERE nro_casa = $1 AND id_vivienda != $2',
                [nro_casa, id]
            );
            if (existe.rows.length > 0) {
                return res.status(400).json({ error: 'Ya existe otra vivienda con este número de casa' });
            }
            
            const result = await pool.query(
                `UPDATE viviendas SET 
                    nro_casa = $1, direccion = $2, tipo_tenencia = $3, condicion_infra = $4,
                    referencia = $5, num_habitaciones = $6, num_baños = $7,
                    tiene_agua = $8, tiene_luz = $9, tiene_gas = $10, observaciones = $11
                 WHERE id_vivienda = $12 RETURNING *`,
                [nro_casa, direccion, tipo_tenencia, condicion_infra, referencia,
                 num_habitaciones, num_baños, tiene_agua, tiene_luz, tiene_gas, observaciones, id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Vivienda no encontrada' });
            }
            
            // Registrar en bitácora
            await registrarEnBitacora(
                pool, 
                req.usuario.id_usuario, 
                req.usuario.nombre_usuario, 
                'EDITAR_VIVIENDA', 
                'viviendas', 
                id, 
                { nro_casa, direccion },
                req.ip
            );
            
            res.json({ success: true, vivienda: result.rows[0] });
        } catch (error) {
            console.error('Error PUT /viviendas/:id:', error);
            res.status(500).json({ error: 'Error al actualizar vivienda' });
        }
    });

    // DELETE - Eliminar vivienda (solo admin/vocero)
    router.delete('/:id', async (req, res) => {
        if (req.usuario.nivel_rol < 2) {
            return res.status(403).json({ error: 'Acción solo para administradores o voceros.' });
        }
        
        try {
            const { id } = req.params;
            
            // Verificar si hay habitantes
            const habitantes = await pool.query('SELECT COUNT(*) FROM habitantes WHERE id_vivienda = $1', [id]);
            const totalHabitantes = parseInt(habitantes.rows[0].count);
            
            if (totalHabitantes > 0 && req.usuario.nivel_rol < 3) {
                return res.status(400).json({ 
                    error: 'No se puede eliminar una vivienda con habitantes. Reasigne o elimine los habitantes primero.',
                    total_habitantes: totalHabitantes
                });
            }
            
            const result = await pool.query('DELETE FROM viviendas WHERE id_vivienda = $1 RETURNING id_vivienda', [id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Vivienda no encontrada' });
            }
            
            await registrarEnBitacora(
                pool, 
                req.usuario.id_usuario, 
                req.usuario.nombre_usuario, 
                'ELIMINAR_VIVIENDA', 
                'viviendas', 
                id, 
                { habitantes_eliminados: totalHabitantes },
                req.ip
            );
            
            res.json({ 
                success: true,
                message: 'Vivienda eliminada correctamente',
                habitantes_afectados: totalHabitantes
            });
        } catch (error) {
            console.error('Error DELETE /viviendas/:id:', error);
            res.status(500).json({ error: 'Error al eliminar vivienda' });
        }
    });

    return router;
};