---
target: Neogild web app (revisión completa UI/UX)
total_score: 25
p0_count: 1
p1_count: 2
timestamp: 2026-07-25T19-00-50Z
slug: apps-web-src-app-neogild-full-app
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading states existen ("Sincronizando…") pero sin detalle de progreso en syncs largos de Gmail. |
| 2 | Match System / Real World | 3 | Vocabulario chileno correcto (RUT, cartola, TEF) pero fragmentos en inglés se filtran en resúmenes de sync. |
| 3 | User Control and Freedom | 2 | El onboarding permite agregar cuentas pero no quitarlas antes de enviar; no hay forma de deshacer un import de cartola. |
| 4 | Consistency and Standards | 2 | Settings pierde el shell compartido; `formatCLP` reimplementado en dos archivos; botones y colores de éxito difieren por archivo. |
| 5 | Error Prevention | 3 | Onboarding valida antes de enviar; login solo exige `minLength={6}`. |
| 6 | Recognition Rather Than Recall | 3 | RUT guardado se muestra enmascarado con el hint de contraseña al lado — buen patrón. |
| 7 | Flexibility and Efficiency | 2 | Cola de revisión es fila por fila con refresh completo de página; sin bulk actions ni flujo por teclado. |
| 8 | Aesthetic and Minimalist Design | 3 | Limpio, pero "minimal" acá es "todavía no hay sistema de diseño", no restricción intencional. |
| 9 | Error Recovery | 2 | El error de PDF con contraseña incorrecta es excelente y accionable; el login muestra `authError.message` crudo (probablemente en inglés). |
| 10 | Help and Documentation | 2 | Buenos hints puntuales donde hacen falta (RUT, contraseña), nada más — aceptable para un solo usuario self-hosted. |
| **Total** | | **25/40** | **Aceptable — mejoras significativas necesarias antes de que el uso diario sea grato** |

## Anti-Patterns Verdict

**¿Esto parece hecho por IA?** Borderline, inclinado a que sí a ojos de alguien que usa Linear/Notion/Raycast a diario.

No hay gradientes, glassmorphism ni motion gratuito — la densidad numbers-first encaja con el registro product. Pero:

- El eyebrow "NEOGILD" en mayúsculas con tracking ancho aparece arriba de **cada** página (`app-shell.tsx:23-25`) y se repite igual en `login/page.tsx:41` — es el patrón exacto que la checklist marca como prohibido, aunque acá funcione como wordmark.
- **Cero identidad visual comprometida**: `globals.css` sigue siendo el scaffold de Next.js sin tocar (`--background`/`--foreground`, Geist). Confirmé en el navegador que claro y oscuro son literalmente la misma paleta zinc invertida — ningún color de marca en ninguno de los dos temas.
- El vocabulario de componentes cambia por archivo, no por diseño (detalle en Priority Issues).

**Scan determinístico**: `detect.mjs` sobre `apps/web/src/app` + `apps/web/src/components` → **exit 0, limpio, sin hallazgos**. No detectó nada porque busca patrones específicos (gradient text, side-stripes, glassmorphism, eyebrows decorativos); los problemas reales acá son de consistencia estructural y ausencia de sistema, no de "slop" visual clásico. No hay falsos positivos que reportar porque no hubo positivos.

**Evidencia de navegador**: no inyecté el overlay `detect.js` de impeccable; en su lugar hice un walkthrough autenticado real (creé una cuenta de prueba, completé onboarding, y navegué las 8 rutas principales) en modo claro y oscuro, con capturas de pantalla. Esto confirmó en vivo varios hallazgos que la sola lectura de código no mostraba:
- El `<input type="file">` de `/accounts/upload` se renderiza sin estilo (botón gris nativo del navegador) dentro de una página completamente oscura y custom — inconsistencia visual directa.
- `/accounts` muestra el mismo panel "Mis cuentas" (2 cuentas + total) que ya está en el dashboard, y **debajo** repite las mismas 2 cuentas una tercera vez como cards grandes — misma data, tres tratamientos visuales, sin valor agregado.
- El onboarding duplica literalmente el campo "Titular" (dos combobox idénticos) en la Cuenta 2 — confirma en vivo lo que Assessment A vio en el código.
- `/inbox` tiene dos botones ("Sync correos" y "Sync histórico + cartolas") con el mismo peso visual (blanco/relleno), sin jerarquía de cuál es la acción por defecto.
- Sin errores de consola en ningún punto del recorrido.

## Overall Impression

Neogild funciona y es honesto en su densidad — no hay decoración de relleno. Pero es, literalmente, el scaffold default de Next.js con Tailwind zinc encima: cero paleta propia, componentes reinventados página por página en vez de reutilizados, y la pantalla de mayor riesgo del producto (conciliar una cartola contra el saldo registrado) no muestra ninguna señal de si cuadra o no. La mayor oportunidad no es "verse menos genérico" — es construir un sistema de componentes real y cerrar el loop de confianza en la conciliación, que es la razón de ser de la herramienta.

## What's Working

- **`AppShell`/`StatCard` como primitiva compartida real**, usada en 9 de 11 rutas, con tonos (`warn`/`positive`) que se mantienen en ámbar/esmeralda apagados en vez de rojo alarmante — cumple bien el principio de "calma, no urgencia".
- **Copy de reaseguro en los momentos correctos**: la página de revisión aclara "el tipo ya viene del banco, acá solo confirmás la categoría", y el error de PDF con contraseña incorrecta enlaza directo a la solución en vez de mostrar un error crudo.
- **Empty states que enseñan**, no solo informan: "Sin transacciones para este filtro" + link al dashboard, "Sin correos. Conectá IMAP y ejecutá sync desde el dashboard" — ninguno es un callejón sin salida.

## Priority Issues

**[P0] Falta la señal de conciliación — la razón de ser del producto no se ve.**
Why it matters: `cartola-upload-form.tsx` y `app/accounts/upload/page.tsx` nunca comparan el saldo importado de la cartola contra el saldo calculado de la cuenta. Para una herramienta cuyo propósito declarado es conciliar cartolas, este es el momento de mayor riesgo y hoy no da ninguna señal — solo "X importados, Y omitidos". Una discrepancia real solo se detectaría revisando manualmente, si acaso.
Fix: agregar un indicador de diferencia ("Diferencia vs. cartola: $X") en el detalle de cuenta o justo después del import, cuando el saldo de cierre de la cartola no coincide con el saldo trackeado.
Suggested command: `/impeccable harden accounts/upload` (cerrar este edge case es, literalmente, endurecer el flujo de producción).

**[P1] La cola de revisión pelea contra la promesa "casi sin trabajo manual".**
Why it matters: `review-transactions.tsx` guarda fila por fila y dispara un `router.refresh()` completo por cada guardado — sin selección múltiple, sin actualización optimista, sin flujo por teclado. La única tarea manual recurrente del producto es también la de mayor fricción.
Fix: selección múltiple + aplicar categoría en lote, actualización optimista sin recargar la página completa.
Suggested command: `/impeccable shape review queue` (planear bulk actions antes de construirlas).

**[P1] Pantallas secundarias quedaron fuera de revisión — chrome e IA inconsistentes.**
Why it matters: `settings/accounts/page.tsx` y `settings/rules/page.tsx` arman su propio header en vez de usar `AppShell` — sin botón de salir, sin email visible, espaciado distinto al resto del sitio. Por separado, `/accounts` repite el mismo panel de saldos del dashboard y encima agrega dos cards grandes con los mismos dos saldos — la misma información tres veces en una sola pantalla, sin razón.
Fix: migrar las dos páginas de settings a `AppShell`; en `/accounts`, eliminar la duplicación y quedarse con un solo tratamiento visual de saldos.
Suggested command: `/impeccable polish settings` y `/impeccable distill accounts`.

**[P2] No hay sistema de componentes — el estilo se decide archivo por archivo.**
Why it matters: el botón primario de `cartola-upload-form.tsx` (`enabled:bg-zinc-900 … disabled:bg-zinc-200`) difiere del resto de botones primarios del sitio (`disabled:opacity-50`); el color de "éxito" alterna entre verde y esmeralda sin regla; confirmé en el navegador que el `<input type="file">` de `/accounts/upload` queda con el estilo nativo del navegador (gris claro) dentro de una página oscura custom. Cero paleta de marca comprometida en `globals.css` — claro y oscuro son la misma escala zinc invertida.
Fix: extraer los tokens y componentes reales a un sistema compartido (botones, inputs, colores de estado) y aplicar una paleta propia mínima.
Suggested command: `/impeccable document` (capturar el sistema actual) seguido de `/impeccable extract`.

**[P2] El número más importante del dashboard puede mentir en silencio.**
Why it matters: `app/page.tsx` (~línea 79-83), el `StatCard` de "Disponible" siempre renderiza `tone="default"`, sin importar el signo. Si los gastos superan a los ingresos, un mes en rojo se ve visualmente idéntico a uno sano.
Fix: `tone="warn"` cuando `disponible < 0` — sin usar rojo, se mantiene sobrio.
Suggested command: `/impeccable polish dashboard`.

## Persona Red Flags

**Alex (power user)**: en `review-transactions.tsx`, cada fila es selección + "Guardar" + recarga completa de página — vaciar una cola real de fin de mes es lento y repetitivo, sin atajo de teclado ni acción en lote.

**Sam (dependiente de accesibilidad)**: `StatCard` (`app-shell.tsx:92`) es el único elemento de todo el código con `focus-visible:ring-2` explícito; inputs, selects y botones del login, onboarding, gmail-sync y reglas dependen solo del foco default del navegador. Sumado a que zinc-500 es el tono secundario universal en modo oscuro — el escenario de uso nocturno que vos mismo confirmaste como prioritario — esto amerita una auditoría de contraste real, no un supuesto.

**Riley (stress tester / conciliación)**: confirmé en vivo que después de subir una cartola no hay ningún chequeo de discrepancia de saldo visible en ninguna pantalla — mismo hallazgo que el P0 de arriba, visto desde el ángulo de "qué pasa si los números no cuadran".

## Minor Observations

- `formatCLP` reimplementado localmente en `app/inbox/page.tsx` y `review-transactions.tsx` en vez de importar `lib/format` — riesgo de drift.
- `app-nav.tsx` usa `flex-wrap` dentro de un contenedor `overflow-x-auto` (`app-shell.tsx:44`) — las dos estrategias responsive compiten; gana el wrap, así que el scroll horizontal queda muerto.
- El login muestra `authError.message` crudo (probablemente en inglés) en un producto 100% en español — justo en un momento de estrés.
- `gmail-sync.tsx` hardcodea `since: "2026-01-01"` en el backfill — va a quedar desactualizado cada año sin ninguna señal en la UI.
- Texto de "GOOGLE_GENERATIVE_AI_API_KEY en apps/web/.env.local" se muestra crudo en `/settings` — filtra un detalle de implementación en vez de un mensaje amigable tipo "LLM no configurado".
- Tablas de `transactions`, `review`, `inbox` y `accounts/[id]` usan `min-w-[640px]` sin layout alternativo para mobile — revisar/categorizar desde el celular implica scroll horizontal constante.

## Questions to Consider

1. Si la conciliación es el propósito central del producto, ¿qué costaría agregar ese único número — la diferencia cartola vs. saldo trackeado — a la pantalla de detalle de cuenta?
2. Si cronometraras vaciar una cola real de 20 transacciones con la UI de hoy, ¿cuántos clics y recargas de página tomaría, y seguirías llamando a eso "casi sin trabajo manual"?
3. Todas las pantallas siguen corriendo sobre la paleta default de Next.js — si tuvieras que nombrar hoy tus 3 o 4 colores "sobrios y confiables" reales, en vez de lo que Tailwind pone por default, ¿cuáles serían?
4. ¿Las dos páginas de Settings se salieron del shell compartido a propósito, o se construyeron antes de que `AppShell` existiera y nunca se reconciliaron?
