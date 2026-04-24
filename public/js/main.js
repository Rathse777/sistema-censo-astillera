/**
 * SISTEMA DE CENSO POBLACIONAL - LA ASTILLERA
 * Funciones globales y utilidades compartidas
 */

// =====================================================
// FUNCIONES DE UTILIDAD GENERAL
// =====================================================

// Formatear fecha para mostrar en interfaz
function formatearFecha(fechaISO) {
    if (!fechaISO) return '-';
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString('es-VE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Formatear fecha para input date (YYYY-MM-DD)
function formatearFechaInput(fechaISO) {
    if (!fechaISO) return '';
    return fechaISO.split('T')[0];
}

// Calcular edad a partir de fecha de nacimiento
function calcularEdad(fechaNacimiento) {
    if (!fechaNacimiento) return null;
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
        edad--;
    }
    return edad;
}

// Obtener grupo etario según edad
function obtenerGrupoEtario(edad) {
    if (edad === null || edad === undefined) return 'Desconocido';
    if (edad >= 0 && edad <= 11) return 'Niño (0-11)';
    if (edad >= 12 && edad <= 17) return 'Adolescente (12-17)';
    if (edad >= 18 && edad <= 59) return 'Adulto (18-59)';
    if (edad >= 60) return 'Adulto Mayor (60+)';
    return 'Desconocido';
}

// Obtener color de badge según grupo etario
function getColorGrupoEtario(edad) {
    if (edad === null || edad === undefined) return 'secondary';
    if (edad >= 0 && edad <= 11) return 'warning';
    if (edad >= 12 && edad <= 17) return 'info';
    if (edad >= 18 && edad <= 59) return 'success';
    if (edad >= 60) return 'danger';
    return 'secondary';
}

// Validar cédula venezolana (formato V-12345678 o 12345678)
function validarCedula(cedula) {
    const regex = /^(V-|E-)?[0-9]{6,8}$/i;
    return regex.test(cedula);
}

// Formatear cédula para mostrar (agregar V- si no tiene)
function formatearCedula(cedula) {
    if (!cedula) return '';
    if (cedula.match(/^[VE]/i)) return cedula.toUpperCase();
    return `V-${cedula}`;
}

// Limpiar cédula (quitar letras y guiones)
function limpiarCedula(cedula) {
    return cedula.toString().replace(/[^0-9]/g, '');
}

// =====================================================
// FUNCIONES DE NOTIFICACIONES
// =====================================================

// Mostrar toast de notificación
function mostrarNotificacion(mensaje, tipo = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        // Crear contenedor si no existe
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.right = '20px';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${tipo} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.style.marginTop = '10px';
    toast.style.minWidth = '250px';
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="fas ${tipo === 'success' ? 'fa-check-circle' : (tipo === 'danger' ? 'fa-exclamation-triangle' : 'fa-info-circle')} me-2"></i>
                ${mensaje}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    document.getElementById('toastContainer').appendChild(toast);
    const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
    bsToast.show();
    
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

// Confirmar acción con modal personalizado
function confirmarAccion(mensaje, accionConfirmar) {
    const modalConfirm = document.getElementById('modalConfirmacion');
    if (modalConfirm) {
        document.getElementById('confirmacionMensaje').textContent = mensaje;
        const confirmBtn = document.getElementById('confirmarBtn');
        const nuevaAccion = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(nuevaAccion, confirmBtn);
        nuevaAccion.addEventListener('click', () => {
            accionConfirmar();
            bootstrap.Modal.getInstance(modalConfirm).hide();
        });
        new bootstrap.Modal(modalConfirm).show();
    } else {
        if (confirm(mensaje)) {
            accionConfirmar();
        }
    }
}

// =====================================================
// FUNCIONES DE CARGA DE DATOS COMPARTIDOS
// =====================================================

// Cargar select de viviendas (usado en habitantes y solicitudes)
async function cargarSelectViviendas(selectId, defaultValue = null) {
    try {
        const response = await fetch('/api/viviendas');
        const viviendas = await response.json();
        const select = document.getElementById(selectId);
        if (!select) return;
        
        select.innerHTML = '<option value="">Seleccione una vivienda...</option>';
        viviendas.forEach(v => {
            const option = document.createElement('option');
            option.value = v.id_vivienda;
            option.textContent = `Casa ${v.nro_casa} - ${v.direccion.substring(0, 40)}`;
            if (defaultValue && defaultValue == v.id_vivienda) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        return viviendas;
    } catch (error) {
        console.error('Error cargando viviendas:', error);
        return [];
    }
}

// Cargar select de servicios
async function cargarSelectServicios(selectId, defaultValue = null) {
    try {
        const response = await fetch('/api/servicios');
        const servicios = await response.json();
        const select = document.getElementById(selectId);
        if (!select) return;
        
        select.innerHTML = '<option value="">Seleccione un servicio...</option>';
        servicios.forEach(s => {
            if (s.activo) {
                const option = document.createElement('option');
                option.value = s.id_servicio;
                option.textContent = `${s.nombre_servicio} (${s.criterio_edad_min}-${s.criterio_edad_max} años)`;
                if (defaultValue && defaultValue == s.id_servicio) {
                    option.selected = true;
                }
                select.appendChild(option);
            }
        });
        return servicios;
    } catch (error) {
        console.error('Error cargando servicios:', error);
        return [];
    }
}

// =====================================================
// FUNCIONES DE EXPORTACIÓN DE DATOS
// =====================================================

// Exportar tabla a CSV
function exportarACSV(data, nombreArchivo = 'exportacion.csv') {
    if (!data || data.length === 0) {
        mostrarNotificacion('No hay datos para exportar', 'warning');
        return;
    }
    
    const cabeceras = Object.keys(data[0]);
    const filas = data.map(obj => cabeceras.map(key => obj[key] || '').join(','));
    const csv = [cabeceras.join(','), ...filas].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', nombreArchivo);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    mostrarNotificacion('Exportación completada', 'success');
}

// Imprimir tabla
function imprimirTabla(elementId, titulo) {
    const contenido = document.getElementById(elementId);
    if (!contenido) return;
    
    const ventana = window.open('', '_blank');
    ventana.document.write(`
        <html>
        <head>
            <title>${titulo}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { padding: 20px; }
                @media print {
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <h2>${titulo}</h2>
            <hr>
            ${contenido.outerHTML}
            <p class="text-muted mt-4">Generado: ${new Date().toLocaleString()}</p>
        </body>
        </html>
    `);
    ventana.document.close();
    ventana.print();
}

// =====================================================
// INICIALIZACIÓN GLOBAL
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    // Agregar modal de confirmación global si no existe
    if (!document.getElementById('modalConfirmacion')) {
        const modalHTML = `
            <div class="modal fade" id="modalConfirmacion" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header bg-warning">
                            <h5 class="modal-title"><i class="fas fa-exclamation-triangle"></i> Confirmar Acción</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p id="confirmacionMensaje">¿Está seguro de realizar esta acción?</p>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button class="btn btn-danger" id="confirmarBtn">Confirmar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    // Agregar contenedor de toasts si no existe
    if (!document.getElementById('toastContainer')) {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.right = '20px';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }
    
    console.log('✅ Sistema Censo La Astillera - Inicializado correctamente');
});