const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    
    // Exportar habitantes a Excel (solo admin y vocero)
    router.get('/habitantes', async (req, res) => {
        if (req.usuario.nivel_rol < 2) {
            return res.status(403).json({ error: 'No tiene permisos para exportar' });
        }
        
        try {
            let habitantes;
            
            if (req.usuario.nivel_rol === 3) {
                // Admin ve todos
                const result = await pool.query(`
                    SELECT h.cedula, h.nombre_completo, h.fecha_nac, 
                           calcular_edad(h.fecha_nac) as edad, h.sexo,
                           h.discapacidad, h.enfermedad_cronica, h.nivel_educativo,
                           h.telefono, h.email, h.es_jefe_familia, h.estatus_migratorio,
                           v.nro_casa, v.direccion
                    FROM habitantes h
                    JOIN viviendas v ON h.id_vivienda = v.id_vivienda
                    ORDER BY h.nombre_completo
                `);
                habitantes = result.rows;
            } else {
                // Vocero ve todos también (para enviar a alcaldía)
                const result = await pool.query(`
                    SELECT h.cedula, h.nombre_completo, h.fecha_nac, 
                           calcular_edad(h.fecha_nac) as edad, h.sexo,
                           h.discapacidad, h.enfermedad_cronica, h.nivel_educativo,
                           h.telefono, h.email, h.es_jefe_familia, h.estatus_migratorio,
                           v.nro_casa, v.direccion
                    FROM habitantes h
                    JOIN viviendas v ON h.id_vivienda = v.id_vivienda
                    ORDER BY h.nombre_completo
                `);
                habitantes = result.rows;
            }
            
            // Convertir a CSV
            const cabeceras = ['Cédula', 'Nombre Completo', 'Fecha Nacimiento', 'Edad', 'Sexo', 
                               'Discapacidad', 'Enfermedad Crónica', 'Nivel Educativo', 
                               'Teléfono', 'Email', 'Jefe Familia', 'Emigrado', 'Casa', 'Dirección'];
            
            const filas = habitantes.map(h => [
                h.cedula, h.nombre_completo, h.fecha_nac, h.edad, h.sexo,
                h.discapacidad, h.enfermedad_cronica, h.nivel_educativo,
                h.telefono, h.email, h.es_jefe_familia ? 'Sí' : 'No', 
                h.estatus_migratorio ? 'Sí' : 'No', h.nro_casa, h.direccion
            ]);
            
            const csv = [cabeceras.join(','), ...filas.map(f => f.map(c => `"${c || ''}"`).join(','))].join('\n');
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=habitantes_${new Date().toISOString().split('T')[0]}.csv`);
            res.send('\uFEFF' + csv); // BOM para UTF-8 en Excel
            
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al exportar' });
        }
    });
    
    // Exportar solicitudes a Excel
    router.get('/solicitudes', async (req, res) => {
        if (req.usuario.nivel_rol < 2) {
            return res.status(403).json({ error: 'No tiene permisos para exportar' });
        }
        
        try {
            const result = await pool.query(`
                SELECT s.id_solicitud, s.fecha_peticion, s.fecha_entrega, s.entregado,
                       s.enviado_alcaldia, s.fecha_envio_alcaldia, s.observaciones,
                       v.nro_casa, v.direccion, sv.nombre_servicio,
                       u.nombre_usuario as solicitante
                FROM solicitudes s
                JOIN viviendas v ON s.id_vivienda = v.id_vivienda
                JOIN servicios sv ON s.id_servicio = sv.id_servicio
                JOIN usuarios u ON s.id_usuario_solicitante = u.id_usuario
                ORDER BY s.fecha_peticion DESC
            `);
            
            const cabeceras = ['ID', 'Fecha Solicitud', 'Fecha Entrega', 'Entregado', 
                               'Enviado Alcaldía', 'Fecha Envío', 'Vivienda', 'Dirección', 
                               'Servicio', 'Solicitante', 'Observaciones'];
            
            const filas = result.rows.map(s => [
                s.id_solicitud, s.fecha_peticion, s.fecha_entrega || 'Pendiente', 
                s.entregado ? 'Sí' : 'No', s.enviado_alcaldia ? 'Sí' : 'No', 
                s.fecha_envio_alcaldia || '-', s.nro_casa, s.direccion, 
                s.nombre_servicio, s.solicitante, s.observaciones || ''
            ]);
            
            const csv = [cabeceras.join(','), ...filas.map(f => f.map(c => `"${c || ''}"`).join(','))].join('\n');
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=solicitudes_${new Date().toISOString().split('T')[0]}.csv`);
            res.send('\uFEFF' + csv);
            
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al exportar' });
        }
    });
    
    // Exportar estadísticas completas
    router.get('/estadisticas', async (req, res) => {
        if (req.usuario.nivel_rol < 2) {
            return res.status(403).json({ error: 'No tiene permisos' });
        }
        
        try {
            const viviendas = await pool.query(`
                SELECT v.nro_casa, v.direccion, v.tipo_tenencia, v.condicion_infra,
                       COUNT(h.cedula) as total_habitantes,
                       COUNT(CASE WHEN calcular_edad(h.fecha_nac) BETWEEN 0 AND 11 THEN 1 END) as ninos,
                       COUNT(CASE WHEN calcular_edad(h.fecha_nac) >= 60 THEN 1 END) as adultos_mayores,
                       COUNT(CASE WHEN h.estatus_migratorio = true THEN 1 END) as emigrados
                FROM viviendas v
                LEFT JOIN habitantes h ON v.id_vivienda = h.id_vivienda
                GROUP BY v.id_vivienda
                ORDER BY v.nro_casa::INTEGER
            `);
            
            const cabeceras = ['Casa', 'Dirección', 'Tenencia', 'Condición', 
                               'Total Habitantes', 'Niños (0-11)', 'Adultos Mayores', 'Emigrados'];
            
            const filas = viviendas.rows.map(v => [
                v.nro_casa, v.direccion, v.tipo_tenencia, v.condicion_infra,
                v.total_habitantes, v.ninos, v.adultos_mayores, v.emigrados
            ]);
            
            const csv = [cabeceras.join(','), ...filas.map(f => f.map(c => `"${c || 0}"`).join(','))].join('\n');
            
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=estadisticas_${new Date().toISOString().split('T')[0]}.csv`);
            res.send('\uFEFF' + csv);
            
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al exportar' });
        }
    });
    
    return router;
};