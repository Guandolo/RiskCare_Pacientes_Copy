# 🧪 PROTOCOLO DE TESTING - CORRECCIÓN P0 MEZCLA DE DATOS

**Fecha:** 23 de octubre de 2025  
**Objetivo:** Validar que la corrección crítica P0 previene efectivamente la corrupción y mezcla de datos de pacientes

---

## 📋 CHECKLIST PRE-TESTING

- [ ] Compilación exitosa sin errores
- [ ] Navegador con consola de desarrollador abierta (F12)
- [ ] Usuario profesional clínico con acceso a múltiples pacientes
- [ ] Conexión a red estable (se probará también con interrupciones)
- [ ] Ambiente: Staging/QA (NO EJECUTAR EN PRODUCCIÓN HASTA VALIDAR)

---

## 🎯 TEST CASE 1: Cambio Rápido de Paciente (Race Condition)

**Objetivo:** Verificar que el sistema cancela correctamente peticiones pendientes y no mezcla datos.

### Pasos:
1. Iniciar sesión como profesional clínico
2. Buscar y seleccionar **Paciente A**
3. **INMEDIATAMENTE** (antes de que termine de cargar), buscar y seleccionar **Paciente B**
4. Repetir el paso 3 con **Paciente C**

### Resultados Esperados:
✅ **CONSOLA:**
```
[DataSourcesPanel] ⚠️ CANCELANDO peticiones del paciente anterior: [user_id_A]
[GlobalStore] ⚠️ CAMBIO DE PACIENTE DETECTADO: De: [Nombre A] a userId: [user_id_B]
[DataSourcesPanel] ⏭️ Petición cancelada
```

✅ **INTERFAZ:**
- Solo se muestra información de Paciente C (el último seleccionado)
- Nombre, cédula y documentos coinciden con Paciente C
- No aparecen datos de Paciente A ni B

❌ **FALLO SI:**
- Aparece nombre de un paciente con cédula de otro
- Los documentos no corresponden al paciente mostrado
- Toast de error: "Error de seguridad: Datos inconsistentes"

---

## 🎯 TEST CASE 2: Múltiples Pestañas (Tab Isolation)

**Objetivo:** Verificar que cada pestaña mantiene su contexto independiente.

### Pasos:
1. Abrir aplicación en Pestaña 1
2. Iniciar sesión como profesional
3. Seleccionar **Paciente A** en Pestaña 1
4. Abrir nueva pestaña (Ctrl+Shift+N o Cmd+Shift+N)
5. Iniciar sesión en Pestaña 2 (mismo usuario)
6. Seleccionar **Paciente B** en Pestaña 2
7. Abrir Pestaña 3, seleccionar **Paciente C**
8. Cambiar rápidamente entre las 3 pestañas (Alt+Tab o Cmd+Tab)
9. Recargar cada pestaña (F5)

### Resultados Esperados:
✅ **CONSOLA (en cada pestaña):**
```
[GlobalStore] 🆕 Nueva pestaña creada con ID: tab_1729702800000_abc123xyz
[GlobalStore] 🔐 Esta pestaña tiene su propio contexto aislado en sessionStorage
```

✅ **INTERFAZ:**
- Pestaña 1 siempre muestra Paciente A (incluso después de cambiar)
- Pestaña 2 siempre muestra Paciente B
- Pestaña 3 siempre muestra Paciente C
- Cada pestaña tiene Tab ID diferente en consola
- Al recargar, cada pestaña recupera SU paciente correcto

❌ **FALLO SI:**
- Cambiar de pestaña afecta el paciente de otra pestaña
- Al volver a una pestaña, muestra un paciente diferente
- Los Tab IDs son iguales en diferentes pestañas

---

## 🎯 TEST CASE 3: Validación de Coherencia de Datos

**Objetivo:** Verificar que el sistema detecta y rechaza datos inconsistentes.

### Pasos:
1. Seleccionar un paciente
2. Verificar en consola el log:
   ```
   [GlobalStore] ✅ Paciente cargado exitosamente: [Nombre] ([user_id]) CC: [cédula]
   ```
3. En la interfaz, comparar:
   - Nombre mostrado
   - Cédula mostrada
   - Documentos listados

### Resultados Esperados:
✅ **VALIDACIÓN:**
- Nombre en panel coincide con nombre en consola
- Cédula en panel coincide con cédula en consola
- user_id en consola es consistente en todos los logs
- No aparecen logs de error 🚨

✅ **COHERENCIA:**
```
[DataSourcesPanel] ✅ Validación de coherencia exitosa para: [user_id]
```

❌ **FALLO SI:**
Aparece en consola:
```
[GlobalStore] 🚨 ERROR CRÍTICO: DATOS MEZCLADOS
[GlobalStore] 🚨 MEZCLA DE DATOS DETECTADA - CAMBIO BLOQUEADO
[DataSourcesPanel] 🚨 ERROR CRÍTICO: Perfil no coincide
```

---

## 🎯 TEST CASE 4: Pérdida de Conexión (Network Interruption)

**Objetivo:** Verificar que el sistema maneja correctamente interrupciones de red.

### Pasos:
1. Seleccionar **Paciente A**
2. Esperar a que cargue completamente
3. En DevTools (F12), ir a pestaña **Network**
4. Activar **Offline** (simular pérdida de conexión)
5. Intentar seleccionar **Paciente B**
6. Desactivar **Offline** (restaurar conexión)
7. Seleccionar **Paciente C**

### Resultados Esperados:
✅ **CON RED:**
- Carga normal de Paciente A
- Carga normal de Paciente C

✅ **SIN RED:**
- Toast: "Error al cargar el paciente" o similar
- Sistema mantiene Paciente A en pantalla (no limpia datos)
- No muestra datos parciales de Paciente B

❌ **FALLO SI:**
- Mezcla datos de Paciente A y B al restaurar conexión
- Muestra Paciente B parcialmente con datos de A
- Sistema queda en estado inválido

---

## 🎯 TEST CASE 5: Cambio de Pestaña/Ventana (Window Focus)

**Objetivo:** Verificar que NO hay recargas automáticas al cambiar de ventana.

### Pasos:
1. Seleccionar **Paciente A**
2. Esperar carga completa
3. Cambiar a otra aplicación (email, navegador diferente, etc.)
4. Esperar 10 segundos
5. Volver a la aplicación RiskCare
6. Verificar consola y interfaz

### Resultados Esperados:
✅ **CONSOLA:**
```
[GlobalStore] 🔒 Página oculta [Tab: tab_xxx] - estado congelado
[GlobalStore] 👁️ Página visible [Tab: tab_xxx] - estado actual
[GlobalStore] ⚠️ NO se realizarán recargas automáticas
```

✅ **INTERFAZ:**
- Paciente A sigue mostrado (SIN cambios)
- No hay indicadores de carga
- Datos idénticos antes y después de cambiar ventana

❌ **FALLO SI:**
- Se recarga la información automáticamente
- Aparece loader/spinner al volver
- Los datos cambian o se mezclan

---

## 🎯 TEST CASE 6: Stress Test - Múltiples Cambios Rápidos

**Objetivo:** Estresar el sistema con cambios muy rápidos de contexto.

### Pasos:
1. Preparar lista de 10 pacientes diferentes
2. Seleccionar Paciente 1
3. Seleccionar Paciente 2 INMEDIATAMENTE (click rápido)
4. Continuar seleccionando Pacientes 3, 4, 5... 10 lo más rápido posible
5. Esperar a que todo termine de cargar
6. Verificar consola y datos mostrados

### Resultados Esperados:
✅ **CONSOLA:**
```
[DataSourcesPanel] ⚠️ CANCELANDO peticiones del paciente anterior (x9 veces)
[GlobalStore] ⚠️ CAMBIO DE PACIENTE DETECTADO (múltiples)
[DataSourcesPanel] ⏭️ Petición cancelada (múltiples)
[GlobalStore] ✅ Paciente cargado exitosamente: [Paciente 10]
```

✅ **INTERFAZ:**
- Solo se muestran datos del **Paciente 10** (último seleccionado)
- Todos los datos son coherentes
- No hay mezcla con pacientes intermedios

❌ **FALLO SI:**
- Datos de pacientes intermedios (1-9) aparecen mezclados
- Sistema queda "colgado" en estado intermedio
- Errores 🚨 en consola

---

## 🎯 TEST CASE 7: Validación de Rol Paciente

**Objetivo:** Verificar que el rol paciente NO se ve afectado (solo debe ver sus propios datos).

### Pasos:
1. Cerrar sesión de profesional
2. Iniciar sesión como **paciente**
3. Navegar por la aplicación
4. Verificar que solo se muestran sus propios datos
5. Abrir múltiples pestañas como paciente

### Resultados Esperados:
✅ **CONSOLA:**
```
[DataSourcesPanel] Modo paciente: cargando solo datos propios
[GlobalStore] Usuario actual: [paciente_user_id]
```

✅ **INTERFAZ:**
- Paciente solo ve sus propios datos
- No tiene opción de cambiar de paciente
- Todas las pestañas muestran los mismos datos (sus propios datos)

❌ **FALLO SI:**
- Paciente ve datos de otros pacientes
- Sistema de Tab Isolation causa problemas con rol paciente

---

## 📊 MATRIZ DE RESULTADOS

| Test Case | Ejecutado | Resultado | Notas |
|-----------|-----------|-----------|-------|
| TC1: Cambio Rápido | [ ] | ⚪ Pendiente | |
| TC2: Múltiples Pestañas | [ ] | ⚪ Pendiente | |
| TC3: Coherencia de Datos | [ ] | ⚪ Pendiente | |
| TC4: Pérdida de Conexión | [ ] | ⚪ Pendiente | |
| TC5: Window Focus | [ ] | ⚪ Pendiente | |
| TC6: Stress Test | [ ] | ⚪ Pendiente | |
| TC7: Rol Paciente | [ ] | ⚪ Pendiente | |

**Leyenda:**
- 🟢 Pasó
- 🔴 Falló
- 🟡 Pasó con warnings
- ⚪ Pendiente

---

## 🔍 DEBUGGING: Qué Buscar en Consola

### ✅ Logs Normales (Esperados):
```
[GlobalStore] 🚀 Store inicializado con Tab ID: tab_xxx
[GlobalStore] ✅ Paciente activo actualizado: [Nombre] ([user_id]) CC: [cédula]
[DataSourcesPanel] 🔄 Paciente cambió de [id_A] a [id_B]
[DataSourcesPanel] 📦 Usando documentos desde cache
[DataSourcesPanel] ⏭️ Petición cancelada
```

### 🚨 Logs de Error (CRÍTICOS - Reportar Inmediatamente):
```
[GlobalStore] 🚨 ERROR CRÍTICO: DATOS MEZCLADOS
[GlobalStore] 🚨 MEZCLA DE DATOS DETECTADA - CAMBIO BLOQUEADO
[GlobalStore] 🚨 Actual: [Nombre A] (user_id_A)
[GlobalStore] 🚨 Nuevo: [Nombre B] (user_id_B)
[DataSourcesPanel] 🚨 ERROR CRÍTICO: Perfil no coincide
```

### ⚠️ Logs de Advertencia (Normales en cambios rápidos):
```
[GlobalStore] ⚠️ CAMBIO DE PACIENTE DETECTADO
[DataSourcesPanel] ⚠️ CANCELANDO peticiones del paciente anterior
[DataSourcesPanel] ⚠️ Paciente cambió durante carga
```

---

## 📝 REPORTE DE BUGS

Si encuentras un fallo, documenta:

1. **Test Case:** [Número y nombre]
2. **Pasos Exactos:** [Qué hiciste]
3. **Resultado Esperado:** [Qué debería pasar]
4. **Resultado Actual:** [Qué pasó realmente]
5. **Logs de Consola:** [Copiar logs relevantes]
6. **Screenshot:** [Captura de pantalla]
7. **Datos de Pacientes:** [user_ids involucrados]
8. **Tab ID:** [Si aplica]
9. **Navegador:** [Chrome/Firefox/Safari + versión]
10. **Sistema Operativo:** [Windows/Mac/Linux]

**Ejemplo:**
```
TEST CASE: TC2 - Múltiples Pestañas
PASOS: Abrí 2 pestañas, seleccioné Paciente A en Tab1 y Paciente B en Tab2
ESPERADO: Cada pestaña mantiene su paciente
ACTUAL: Al volver a Tab1, ahora muestra Paciente B
LOGS:
  [GlobalStore] Tab ID Tab1: tab_123abc
  [GlobalStore] Tab ID Tab2: tab_456def
  [GlobalStore] 🚨 ERROR: [detalles]
SCREENSHOT: [adjuntar]
USER_IDs: A=550e8400-e29b-41d4-a716-446655440000, B=650e8400...
NAVEGADOR: Chrome 118.0
OS: Windows 11
```

---

## ✅ CRITERIOS DE ACEPTACIÓN FINAL

Para considerar la corrección exitosa, TODOS estos criterios deben cumplirse:

- [ ] **TC1-TC7:** Todos los test cases pasan sin errores críticos 🚨
- [ ] **No Mezcla de Datos:** En ningún escenario aparecen datos mezclados
- [ ] **Logs Consistentes:** Los logs muestran validaciones exitosas
- [ ] **Tab Isolation:** Cada pestaña mantiene contexto independiente
- [ ] **Performance:** Cambios de paciente completan en < 3 segundos
- [ ] **Cancelación:** Peticiones se cancelan correctamente (logs ⏭️)
- [ ] **Rol Paciente:** No afectado negativamente por los cambios
- [ ] **Sin Recargas Automáticas:** NO hay recargas al cambiar ventana

---

## 🚀 APROBACIÓN PARA PRODUCCIÓN

**Solo proceder a producción si:**
1. ✅ Todos los test cases pasaron
2. ✅ No hay logs 🚨 en ningún escenario
3. ✅ Code review completado
4. ✅ Aprobación de stakeholders
5. ✅ Plan de rollback preparado

**Responsable de Aprobación:** _________________  
**Fecha:** _________________  
**Firma:** _________________

---

**IMPORTANTE:** Este protocolo es OBLIGATORIO antes de deployment a producción.
El riesgo de mezcla de datos es INACEPTABLE en un sistema de salud.

🚨 **EN CASO DE FALLO CRÍTICO:** Detener testing inmediatamente y escalar a equipo técnico senior.
