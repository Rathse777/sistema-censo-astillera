-- =====================================================
-- SISTEMA DE CENSO POBLACIONAL - CONSEJO COMUNAL LA ASTILLERA
-- VERSIÓN CORREGIDA Y SINCRONIZADA
-- =====================================================

-- Eliminar tablas si existen 
DROP TABLE IF EXISTS bitacora CASCADE;
DROP TABLE IF EXISTS notificaciones CASCADE;
DROP TABLE IF EXISTS solicitudes CASCADE;
DROP TABLE IF EXISTS habitantes CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS servicios CASCADE;
DROP TABLE IF EXISTS viviendas CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- =====================================================
-- 1. TABLA ROLES
-- =====================================================
CREATE TABLE roles (
    id_rol SERIAL PRIMARY KEY,
    nombre_rol VARCHAR(30) UNIQUE NOT NULL,
    nivel INT DEFAULT 1
);

INSERT INTO roles (nombre_rol, nivel) VALUES
('usuario_normal', 1),
('vocero', 2),
('admin', 3);

-- =====================================================
-- 2. TABLA VIVIENDAS
-- =====================================================
CREATE TABLE viviendas (
    id_vivienda SERIAL PRIMARY KEY,
    nro_casa VARCHAR(10) UNIQUE NOT NULL,
    direccion TEXT NOT NULL,
    referencia VARCHAR(200),
    tipo_tenencia VARCHAR(20) CHECK (tipo_tenencia IN ('Propia', 'Alquilada', 'Compartida', 'Traspasada', 'Prestada')),
    condicion_infra VARCHAR(20) CHECK (condicion_infra IN ('Buena', 'Regular', 'Mala', 'En Construcción')),
    num_habitaciones INT DEFAULT 1,
    num_baños INT DEFAULT 1,
    tiene_agua BOOLEAN DEFAULT TRUE,
    tiene_luz BOOLEAN DEFAULT TRUE,
    tiene_gas BOOLEAN DEFAULT TRUE,
    observaciones TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 3. TABLA HABITANTES
-- =====================================================
CREATE TABLE habitantes (
    cedula VARCHAR(12) PRIMARY KEY,
    nombre_completo VARCHAR(100) NOT NULL,
    fecha_nac DATE NOT NULL,
    sexo CHAR(1) CHECK (sexo IN ('M', 'F')),
    discapacidad VARCHAR(50) DEFAULT 'Ninguna',
    enfermedad_cronica VARCHAR(100) DEFAULT 'Ninguna',
    nivel_educativo VARCHAR(30),
    estatus_migratorio BOOLEAN DEFAULT FALSE,
    es_jefe_familia BOOLEAN DEFAULT FALSE,
    telefono VARCHAR(15),
    email VARCHAR(100),
    id_vivienda INT NOT NULL,
    id_usuario_propietario INT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_vivienda) REFERENCES viviendas(id_vivienda) ON DELETE CASCADE
);

-- =====================================================
-- 4. TABLA USUARIOS (VERSIÓN CORREGIDA)
-- =====================================================
CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nombre_usuario VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    contrasena_hash VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(100),
    cedula_asociada VARCHAR(12), -- Ya NO es FK, solo referencia
    id_rol INT NOT NULL REFERENCES roles(id_rol),
    activo BOOLEAN DEFAULT TRUE,
    ultimo_acceso TIMESTAMP,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 5. TABLA SERVICIOS
-- =====================================================
CREATE TABLE servicios (
    id_servicio SERIAL PRIMARY KEY,
    nombre_servicio VARCHAR(50) NOT NULL,
    descripcion TEXT,
    criterio_edad_min INT DEFAULT 0,
    criterio_edad_max INT DEFAULT 120,
    activo BOOLEAN DEFAULT TRUE
);

INSERT INTO servicios (nombre_servicio, descripcion, criterio_edad_min, criterio_edad_max) VALUES
('CLAP', 'Caja de alimentos mensual para toda la familia', 0, 120),
('Gas Doméstico', 'Bombona de gas para cocina', 0, 120),
('Juguetes Navideños', 'Entrega de juguetes en temporada decembrina', 0, 11),
('Ayuda Adulto Mayor', 'Apoyo especial para adultos mayores', 60, 120),
('Ayuda para Discapacidad', 'Apoyo especial para personas con discapacidad', 0, 120),
('Bono Familiar', 'Ayuda económica para familias vulnerables', 0, 120);

-- =====================================================
-- 6. TABLA SOLICITUDES (VERSIÓN CORREGIDA)
-- =====================================================
CREATE TABLE solicitudes (
    id_solicitud SERIAL PRIMARY KEY,
    id_vivienda INT NOT NULL,
    id_servicio INT NOT NULL,
    id_usuario_solicitante INT NOT NULL REFERENCES usuarios(id_usuario),
    fecha_peticion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_entrega DATE,
    entregado BOOLEAN DEFAULT FALSE,
    enviado_alcaldia BOOLEAN DEFAULT FALSE,
    fecha_envio_alcaldia TIMESTAMP,
    observaciones TEXT,
    gestionada_por INT REFERENCES usuarios(id_usuario),
    FOREIGN KEY (id_vivienda) REFERENCES viviendas(id_vivienda) ON DELETE CASCADE,
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio) ON DELETE CASCADE
);

-- =====================================================
-- 7. TABLA NOTIFICACIONES
-- =====================================================
CREATE TABLE notificaciones (
    id_notificacion SERIAL PRIMARY KEY,
    titulo VARCHAR(100) NOT NULL,
    mensaje TEXT NOT NULL,
    tipo VARCHAR(30) DEFAULT 'info',
    prioridad INT DEFAULT 1,
    creador_id INT REFERENCES usuarios(id_usuario),
    creador_nombre VARCHAR(100),
    para_todos BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion DATE,
    activa BOOLEAN DEFAULT TRUE
);

-- =====================================================
-- 8. TABLA BITÁCORA
-- =====================================================
CREATE TABLE bitacora (
    id_bitacora SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES usuarios(id_usuario),
    nombre_usuario VARCHAR(50),
    accion VARCHAR(100) NOT NULL,
    tabla_afectada VARCHAR(50),
    registro_id VARCHAR(50),
    detalles JSONB,
    ip_address VARCHAR(45),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- FUNCIONES Y VISTAS
-- =====================================================

CREATE OR REPLACE FUNCTION calcular_edad(fecha_nac DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN EXTRACT(YEAR FROM age(CURRENT_DATE, fecha_nac));
END;
$$ LANGUAGE plpgsql;

CREATE VIEW vista_habitantes_edad AS
SELECT 
    h.*,
    calcular_edad(h.fecha_nac) AS edad,
    CASE 
        WHEN calcular_edad(h.fecha_nac) BETWEEN 0 AND 11 THEN 'Niño (0-11)'
        WHEN calcular_edad(h.fecha_nac) BETWEEN 12 AND 17 THEN 'Adolescente (12-17)'
        WHEN calcular_edad(h.fecha_nac) BETWEEN 18 AND 59 THEN 'Adulto (18-59)'
        WHEN calcular_edad(h.fecha_nac) >= 60 THEN 'Adulto Mayor (60+)'
        ELSE 'Desconocido'
    END AS grupo_etario,
    v.nro_casa,
    v.direccion
FROM habitantes h
JOIN viviendas v ON h.id_vivienda = v.id_vivienda;

CREATE OR REPLACE FUNCTION update_ultima_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.ultima_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizacion_habitantes
    BEFORE UPDATE ON habitantes
    FOR EACH ROW
    EXECUTE FUNCTION update_ultima_actualizacion();