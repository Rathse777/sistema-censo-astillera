# 🏠 Sistema de Información Web para el Censo Poblacional
## Consejo Comunal de la Calle "La Astillera"

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=for-the-badge&logo=node.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue?style=for-the-badge&logo=postgresql)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-purple?style=for-the-badge&logo=bootstrap)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow?style=for-the-badge&logo=javascript)
![Express.js](https://img.shields.io/badge/Express.js-4.18-lightgrey?style=for-the-badge&logo=express)

</div>

---

## 📋 Tabla de Contenidos

- [Descripción del Proyecto](#-descripción-del-proyecto)
- [Características Principales](#-características-principales)
- [Tecnologías Utilizadas](#-tecnologías-utilizadas)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación y Configuración](#-instalación-y-configuración)
- [Configuración de la Base de Datos](#-configuración-de-la-base-de-datos)
- [Variables de Entorno](#-variables-de-entorno)
- [Roles de Usuario](#-roles-de-usuario)
- [Estructura de la Base de Datos](#-estructura-de-la-base-de-datos)
- [Guía de Uso](#-guía-de-uso)
- [Despliegue en Producción](#-despliegue-en-producción)
- [Solución de Problemas](#-solución-de-problemas)
- [Autor](#-autor)
- [Licencia](#-licencia)

---

## 📖 Descripción del Proyecto

Este proyecto consiste en el desarrollo de un **Sistema de Información Web para la Digitalización y Gestión del Censo Poblacional** del Consejo Comunal de la Calle "La Astillera". 

El sistema permite:

- Digitalizar el registro de habitantes y viviendas de la comunidad
- Gestionar los beneficios sociales (CLAP, gas doméstico, juguetes navideños)
- Controlar el estatus migratorio de los habitantes
- Generar reportes estadísticos para organismos del Estado
- Enviar notificaciones a los miembros de la comunidad
- Mantener un registro de auditoría (bitácora) de todas las acciones realizadas

**Problema que resuelve:** Los datos del censo se manejaban de forma manual (papel), lo que provocaba:
- Datos desactualizados por migración, nacimientos y defunciones
- Errores en la entrega de beneficios por información incorrecta
- Falta de comunicación efectiva sobre entregas de CLAP, gas y otros servicios
- Pérdida de tiempo de los líderes comunales en tareas administrativas repetitivas

---

## ✨ Características Principales

### 🏘️ Módulo de Viviendas
- Registro detallado de viviendas (número de casa, dirección, tipo de tenencia)
- Control de servicios básicos (agua, electricidad, gas)
- Conteo automático de habitantes por vivienda
- Visualización de la condición de infraestructura

### 👥 Módulo de Habitantes
- Registro individual con fecha de nacimiento y cálculo automático de edad
- Clasificación por grupos etarios (Niños, Adolescentes, Adultos, Adultos Mayores)
- Control de estatus migratorio (presentes/emigrados)
- Registro de discapacidades y enfermedades crónicas
- Designación de jefes de familia por vivienda
- Autogestión familiar: cada usuario puede ver y editar solo su núcleo familiar

### 📦 Módulo de Servicios
- Catálogo de servicios disponibles (CLAP, gas, juguetes, etc.)
- Criterios de edad para cada servicio
- Solicitudes de beneficios por vivienda

### 📢 Módulo de Notificaciones
- Publicación de avisos comunales por voceros y administradores
- Visualización de notificaciones activas en todas las páginas
- Sistema de toast flotante para nuevas notificaciones
- Seguimiento de notificaciones vistas por usuario

### 📊 Módulo de Estadísticas
- Dashboard con indicadores clave (total viviendas, habitantes, niños, adultos mayores)
- Visualización de servicios disponibles
- Panel de avisos del consejo comunal

### 👤 Sistema de Autenticación
- Registro público de usuarios con clave maestra para roles especiales
- Login con JWT (JSON Web Tokens)
- Tres niveles de acceso: Usuario Normal, Vocero, Administrador
- Control de permisos por rol
- Perfil de usuario con cambio de contraseña

### 📝 Bitácora de Auditoría
- Registro de todas las acciones realizadas en el sistema
- Filtrado por usuario, acción y fecha
- Visualización de detalles de cada registro
- Acceso exclusivo para administradores

### 📱 Diseño Responsive
- Interfaz adaptada para dispositivos móviles (teléfonos y tablets)
- Botones grandes para facilitar la interacción en pantallas táctiles
- Navegación intuitiva con menú hamburguesa en móviles

---

## 🛠️ Tecnologías Utilizadas

### Backend
|       Tecnología       | Versión |           Descripción               |
|------------------------|---------|-------------------------------------|
|      **Node.js**       | 18+     | Entorno de ejecución JavaScript     |
|     **Express.js**     | 4.18.2  | Framework web para Node.js          |
|     **PostgreSQL**     | 14+     | Sistema de gestión de base de datos |
| **pg** (node-postgres) | 8.11    | Cliente PostgreSQL para Node.js     |
|    **jsonwebtoken**    | 9.0     | Autenticación mediante JWT          |
|       **bcrypt**       | 6.0     | Encriptación de contraseñas         |
|   **cookie-parser**    | 1.4     | Manejo de cookies                   |
|        **dotenv**      | 16.4    | Variables de entorno                |

### Frontend
|      Tecnología      | Versión |             Descripción              |
|----------------------|---------|--------------------------------------|
| **HTML5**            |    -    | Estructura de las páginas            |
| **CSS3**             |    -    | Estilos y diseño responsive          |
| **Bootstrap**        |   5.3   | Framework CSS para diseño responsive |
| **Font Awesome**     |   6.4   | Librería de iconos                   |
| **JavaScript (ES6)** |    -    | Interactividad y consumo de API REST |

### Herramientas de Desarrollo
| Herramienta |                  Descripción                   |
|-------------|------------------------------------------------|
| **Nodemon** | Reinicio automático del servidor en desarrollo |
|   **Git**   | Control de versiones                           |
|   **npm**   | Gestor de paquetes de Node.js                  |

---

## 📁 Estructura del Proyecto

sistema-censo-astillera/
│
├── 📄 server.js                 # Servidor principal
├── 📄 package.json              # Dependencias y scripts
├── 📄 .env                      # Variables de entorno
├── 📄 init.sql                  # Script de base de datos
├── 📄 README.md                 # Este archivo
│
├── 📁 middleware/
│   └── 📄 auth.js               # Autenticación y autorización
│
├── 📁 routes/
│   ├── 📄 auth.js               # Login, registro, usuarios
│   ├── 📄 habitantes.js         # CRUD de habitantes
│   ├── 📄 viviendas.js          # CRUD de viviendas
│   ├── 📄 servicios.js          # CRUD de servicios
│   ├── 📄 solicitudes.js        # Gestión de solicitudes
│   ├── 📄 notificaciones.js     # Sistema de notificaciones
│   ├── 📄 exportar.js           # Exportación de datos
│   └── 📄 bitacora.js           # Registro de acciones
│
├── 📁 views/                    # Archivos HTML
│   ├── 📄 index.html            # Página principal
│   ├── 📄 login.html            # Inicio de sesión
│   ├── 📄 registro.html         # Registro de usuarios
│   ├── 📄 habitantes.html       # Gestión de habitantes
│   ├── 📄 viviendas.html        # Gestión de viviendas
│   ├── 📄 servicios.html        # Gestión de servicios
│   ├── 📄 solicitudes.html      # Gestión de solicitudes
│   ├── 📄 notificaciones.html   # Avisos y notificaciones
│   ├── 📄 bitacora.html         # Bitácora de acciones
│   ├── 📄 perfil.html           # Perfil de usuario
│   └── 📄 admin_usuarios.html   # Admin de usuarios
│
├── 📁 public/                   # Archivos estáticos
│   ├── 📄 main.js               # JavaScript global
│   └── 📄 style.css             # Estilos globales
│
└── 📁 node_modules/             # Dependencias (auto-generado)

---

## 📋 Requisitos Previos

Antes de instalar el proyecto, asegúrate de tener instalado:

### 1. Node.js y npm

# Verificar instalación
node --version    # Debe ser 18.0.0 o superior
npm --version     # Debe ser 9.0.0 o superior

### Conocimientos Previos Recomendados
- Manejo básico de terminal/consola
- Conocimientos básicos de SQL
- Familiaridad con JavaScript y Node.js

Si no lo tienes instalado:

➡️ Descarga desde: https://nodejs.org/

Recomendado: versión LTS (Long Term Support)

### 2. PostgreSQL
   
# Verificar instalación
psql --version    # Debe ser 14.0 o superior
Si no lo tienes instalado:

➡️ Windows:

Descarga desde: https://www.postgresql.org/download/windows/

Durante la instalación, recuerda la contraseña del usuario postgres

➡️ macOS:

brew install postgresql@15
brew services start postgresql@15

➡️ Linux (Ubuntu/Debian):

sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

### 3. Git (opcional, para clonar el repositorio)

git --version

---

## 🚀 Instalación y Configuración

### Paso 1: Clonar o Descargar el Proyecto

# Opción 1: Clonar con Git
git clone <URL_DEL_REPOSITORIO>
cd sistema-censo-astillera

# Opción 2: Descargar ZIP y extraer
# Navegar a la carpeta extraída con la terminal
cd sistema-censo-astillera

### Paso 2: Instalar Dependencias

npm install

Esto instalará todas las dependencias listadas en package.json:

|      Dependencia       |                      Propósito                         |
|------------------------|--------------------------------------------------------|
| **express**            | Servidor web y rutas                                   |
| **pg**                 | Conexión a PostgreSQL                                  |
| **bcrypt**             | Encriptación de contraseñas                            |
| **cookie-parser**      | Manejo de cookies                                      |
| **dotenv**             | Variables de entorno                                   |
| **cors**               | Cross-Origin Resource Sharing                          |
| **nodemon**            | Reinicio automático (desarrollo)                       |

### Paso 3: Configurar Variables de Entorno
Crea un archivo .env en la raíz del proyecto con el siguiente contenido:

# Puerto del servidor
PORT=3000

# Configuración de la base de datos PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=TU_CONTRASEÑA_AQUI
DB_NAME=censo_astillera

# Clave secreta para JWT (Tokens de autenticación)
JWT_SECRET=una_clave_secreta_muy_larga_y_segura_2025

# Claves maestras para registro de roles especiales
CLAVE_VOCERO=vocero2026
CLAVE_ADMIN=admin2026

⚠️ Importante: Cambia TU_CONTRASEÑA_AQUI por la contraseña real de tu PostgreSQL. 
    Cambia también JWT_SECRET por una clave única y segura.

### Paso 4: Crear la base de datos en PostgreSQL

## Método 1 - Usando la línea de comandos (psql):

# Conectarse a PostgreSQL como superusuario
psql -U postgres
# Dentro de psql, crear la base de datos
CREATE DATABASE censo_astillera;
# Salir de psql
\q
# Ejecutar el script de inicialización
psql -U postgres -d censo_astillera -f init.sql

## Método 2 - Usando pgAdmin (interfaz gráfica):

1. Abre pgAdmin
2. Conéctate a tu servidor PostgreSQL
3. Clic derecho en "Databases" > "Create" > "Database"
4. Nombre: censo_astillera
5. Clic en "Save"
6. Selecciona la base de datos censo_astillera
7. Ve a "Tools" > "Query Tool"
8. Abre el archivo init.sql
9. Ejecuta todo el contenido (clic en el botón ▶️ Execute)

### Paso 5: Iniciar el servidor

Modo desarrollo (con reinicio automático):
npm run dev

Modo producción:
npm start

### Paso 6: Verificar que todo funcione

Abre tu navegador y visita:
Página principal: http://localhost:3000
Login: http://localhost:3000/login

Deberías ver la página de inicio de sesión. 
Para crear el primer usuario administrador, 
regístrate usando la clave maestra de admin configurada en el archivo .env (por defecto: admin2025).

### 👥 Roles de Usuario

El sistema maneja tres niveles de acceso:

1. Usuario Normal (Nivel 1) 👤

Acceso básico al sistema
Ve solo su información familiar (habitantes de su vivienda)
Puede editar los datos de su familia
Puede editar los detalles de su vivienda
No puede ver la bitácora
No puede gestionar otros usuarios

Cómo registrarse: Usar el formulario de registro público sin clave maestra.

2. Vocero Comunal (Nivel 2) 🎤
   
Todos los permisos del usuario normal
Ver todas las viviendas y habitantes
Crear, editar y eliminar viviendas y habitantes
Publicar notificaciones para la comunidad
Gestionar solicitudes de servicios
Exportar datos
No puede ver la bitácora ni gestionar usuarios

Cómo registrarse: Usar el formulario de registro con la clave maestra de vocero.

3. Administrador (Nivel 3) 🔑

Control total del sistema
Todos los permisos de vocero
Ver la bitácora de acciones
Gestionar todos los usuarios (crear, editar, eliminar, cambiar roles)
Acceso al panel de administración de usuarios
Cómo registrarse: Usar el formulario de registro con la clave maestra de admin.

🌐 Despliegue en Producción

Render.com (Gratuito para empezar)

Crea una cuenta en Render.com
Crea un nuevo "Web Service"
Conecta tu repositorio de GitHub

Configura:
Build Command: npm install
Start Command: npm start
Environment Variables: Las mismas del archivo .env

🔧 Solución de Problemas

### Error: "Connection refused" al conectar a PostgreSQL

Solución:

# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql
# Iniciar PostgreSQL si está detenido
sudo systemctl start postgresql

### Error: "password authentication failed"

Solución:
Revisa que la contraseña en el archivo .env sea correcta
La contraseña es la que configuraste al instalar PostgreSQL (usuario postgres)

### Error: "database does not exist"

Solución:

# Crear la base de datos
psql -U postgres
CREATE DATABASE censo_astillera;
\q

### Error: "port 3000 already in use"

Solución:

# En Linux/Mac - Encontrar y matar el proceso
lsof -i :3000
kill -9 [PID]

# En Windows
# Abrir el Administrador de Tareas y cerrar el proceso node.exe

### Error: Las notificaciones no aparecen

Solución:

Verifica que la tabla notificaciones tenga datos
Revisa que las notificaciones estén activas (activa = true)
Verifica que no hayan expirado (fecha_expiracion >= CURRENT_DATE)

### Error: No puedo editar mis datos familiares

Solución:

Verifica que tu usuario tenga una cedula_asociada válida
La cédula debe coincidir con un habitante registrado en el sistema
Los administradores deben asignar la cédula al usuario desde el panel de administración

👩‍💻 Autor

Rathseli Romero
Cédula: 32.195.433
Instituto Universitario de Tecnología "Dr. Cristóbal Mendoza"
Extensión Mérida
Especialidad: Informática
Asignatura: Sistema de Información Gerencial
Profesora: Oriana Pedrosa

📄 Licencia
Este proyecto fue desarrollado como trabajo académico para la asignatura: Sistema de Información Gerencial 
del Instituto Universitario de Tecnología "Dr. Cristóbal Mendoza".
