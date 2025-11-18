// app.js — Nexus Auto Pro 2026
// Gestión de talleres automotrices en Puerto Rico
// HTML5 + CSS3 + JS vanilla + Firebase + jsPDF

/* ========== CONFIG FIREBASE ========== */
const firebaseConfig = {
  apiKey: "AIzaSyAouzcePuYPfGBajbqFFotTNNr_gx_XCYQ",
  authDomain: "nexus-auto-pro-2026.firebaseapp.com",
  projectId: "nexus-auto-pro-2026",
  storageBucket: "nexus-auto-pro-2026.firebasestorage.app",
  messagingSenderId: "308014641424",
  appId: "1:308014641424:web:5157d1267e280c48eeb595"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

/* ========== ESTADO GLOBAL ========== */
const state = {
  user: null,
  pin: "0000",             // PIN inicial
  configDocId: "config-app"
};

/* ========== HELPERS DOM ========== */
const qs  = (sel, p = document) => p.querySelector(sel);
const qsa = (sel, p = document) => Array.from(p.querySelectorAll(sel));

function showView(id) {
  qsa(".view").forEach(v => v.classList.remove("visible"));
  const v = qs("#" + id);
  if (v) v.classList.add("visible");
}

function showScreen(id) {
  qsa(".screen").forEach(s => s.classList.remove("visible"));
  const s = qs("#" + id);
  if (s) s.classList.add("visible");

  qsa(".menu-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === id);
  });

  if (id === "ingresosView")   cargarIngresos();
  if (id === "entregasView")   cargarEntregas();
  if (id === "historialView")  mostrarMensajeHistorial();
  if (id === "facturasView")  { cargarFacturas(); cargarResumenFacturas(); }
  if (id === "cotizacionesView") cargarCotizaciones();
  if (id === "clientesView")     cargarClientes();
  if (id === "suplidoresView")   cargarSuplidores();
  if (id === "configView")      { cargarConfiguracion(); cargarPrecios(); }
}

/* ========== MODAL GLOBAL (TARJETA PRO) ========== */

const dialogBackdrop  = qs("#dialogBackdrop");
const dialogTitleEl   = qs("#dialogTitle");
const dialogFieldsEl  = qs("#dialogFields");
const dialogForm      = qs("#dialogForm");
const dialogCancelBtn = qs("#dialogCancelBtn");
const dialogSubmitBtn = qs("#dialogSubmitBtn");

let dialogSubmitHandler = null;

// fields: [{ name, label, type, placeholder, required, options }]
function openDialog({ title, submitLabel = "Guardar", fields, onSubmit }) {
  dialogTitleEl.textContent   = title;
  dialogSubmitBtn.textContent = submitLabel;

  dialogFieldsEl.innerHTML = "";
  fields.forEach(f => {
    const wrap = document.createElement("div");
    wrap.className = "dialog-field";
    const id = "dlg_" + f.name;
    wrap.innerHTML = `
      <label for="${id}">${f.label}</label>
      ${renderFieldHTML(id, f)}
    `;
    dialogFieldsEl.appendChild(wrap);
  });

  if (dialogSubmitHandler) {
    dialogForm.removeEventListener("submit", dialogSubmitHandler);
  }

  dialogSubmitHandler = async (e) => {
    e.preventDefault();
    const values = {};
    fields.forEach(f => {
      const el = qs("#dlg_" + f.name);
      values[f.name] = el ? el.value.trim() : "";
    });

    try {
      await onSubmit(values);
      closeDialog();
    } catch (err) {
      console.error("Error en diálogo:", err);
      alert("Ocurrió un error, verifica la consola.");
    }
  };

  dialogForm.addEventListener("submit", dialogSubmitHandler);
  dialogBackdrop.classList.remove("hidden");
}

function renderFieldHTML(id, f) {
  const common = `id="${id}" name="${f.name}" placeholder="${f.placeholder || ""}" ${
    f.required ? "required" : ""
  }`;
  if (f.type === "textarea") {
    return `<textarea ${common} rows="${f.rows || 3}"></textarea>`;
  }
  if (f.type === "select") {
    const opts = (f.options || [])
      .map(o => `<option value="${o.value}">${o.label}</option>`)
      .join("");
    return `<select ${common}>${opts}</select>`;
  }
  const type = f.type || "text";
  return `<input type="${type}" ${common} />`;
}

function closeDialog() {
  if (!dialogBackdrop) return;
  dialogBackdrop.classList.add("hidden");
}

if (dialogCancelBtn) {
  dialogCancelBtn.addEventListener("click", closeDialog);
}
if (dialogBackdrop) {
  dialogBackdrop.addEventListener("click", (e) => {
    if (e.target === dialogBackdrop) closeDialog();
  });
}

/* ========== AUTH: PIN + GOOGLE ========== */

function handlePinLogin(e) {
  e.preventDefault();
  const pin = (qs("#pinInput").value || "").trim();
  if (!pin) return;
  if (pin === state.pin) {
    showView("appView");
    showScreen("ingresosView");
  } else {
    alert("PIN incorrecto.");
  }
}

function googleSignIn() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider)
    .then(r => {
      state.user = r.user;
      cargarConfiguracion();
      showView("appView");
      showScreen("ingresosView");
    })
    .catch(err => {
      console.error(err);
      alert("Error con Google Auth.");
    });
}

function logout() {
  auth.signOut().finally(() => {
    state.user = null;
    showView("loginView");
  });
}

auth.onAuthStateChanged(async (user) => {
  state.user = user || null;
  if (user) {
    await cargarConfiguracion();
    showView("appView");
    showScreen("ingresosView");
  } else {
    showView("loginView");
  }
});

/* ========== CONFIGURACIÓN ========== */

async function cargarConfiguracion() {
  try {
    const docRef = db.collection("ajustes").doc(state.configDocId);
    const snap   = await docRef.get();
    if (!snap.exists) return;

    const data = snap.data();
    if (data.pin) state.pin = String(data.pin);

    const form = qs("#configForm");
    if (form) {
      form.tallerNombre.value    = data.tallerNombre    || "";
      form.tallerTelefono.value  = data.tallerTelefono  || "";
      form.tallerEmail.value     = data.tallerEmail     || "";
      form.tallerDireccion.value = data.tallerDireccion || "";
      form.logoUrl.value         = data.logoUrl         || "";
      form.driveUrl.value        = data.driveUrl        || "";
    }

    if (data.logoUrl) {
      qsa(".logo-auto, .hero-logo").forEach(img => (img.src = data.logoUrl));
    }
  } catch (err) {
    console.error("Error cargar config:", err);
  }
}

async function guardarConfiguracion(e) {
  e.preventDefault();
  const form     = e.target;
  const nuevoPin = (form.pinNuevo.value || "").trim();

  const payload = {
    tallerNombre:    form.tallerNombre.value    || "",
    tallerTelefono:  form.tallerTelefono.value  || "",
    tallerEmail:     form.tallerEmail.value     || "",
    tallerDireccion: form.tallerDireccion.value || "",
    logoUrl:         form.logoUrl.value         || "",
    driveUrl:        form.driveUrl.value        || "",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (nuevoPin) payload.pin = nuevoPin;

  try {
    await db.collection("ajustes").doc(state.configDocId).set(payload, { merge: true });
    if (nuevoPin) state.pin = nuevoPin;
    const statusEl = qs("#configStatus");
    if (statusEl) {
      statusEl.textContent = "Configuración guardada.";
      setTimeout(() => (statusEl.textContent = ""), 2000);
    }

    if (payload.logoUrl) {
      qsa(".logo-auto, .hero-logo").forEach(img => (img.src = payload.logoUrl));
    }
  } catch (err) {
    console.error("Error guardar config:", err);
    const statusEl = qs("#configStatus");
    if (statusEl) statusEl.textContent = "Error guardando configuración.";
  }
}

/* ========== INGRESOS (ENTRADA VEHÍCULOS) ========== */

async function guardarIngreso(e) {
  e.preventDefault();
  const f = e.target;

  const data = {
    clienteNombre:     f.clienteNombre.value     || "",
    clienteTelefono:   f.clienteTelefono.value   || "",
    clienteDireccion:  f.clienteDireccion.value  || "",
    vehiculoTablilla:  f.vehiculoTablilla.value  || "",
    vehiculoMarca:     f.vehiculoMarca.value     || "",
    vehiculoModelo:    f.vehiculoModelo.value    || "",
    vehiculoAno:       f.vehiculoAno.value       || "",
    vehiculoColor:     f.vehiculoColor.value     || "",
    vehiculoVin:       f.vehiculoVin.value       || "",
    tipoTrabajo:       f.tipoTrabajo.value       || "mecanica",
    descripcionTrabajo:f.descripcionTrabajo.value|| "",
    estado: "abierto",
    creadoPor: state.user?.email || "PIN_LOCAL",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection("ingresos").add(data);
    const statusEl = qs("#ingresoStatus");
    if (statusEl) {
      statusEl.textContent = "Ingreso guardado.";
      setTimeout(() => (statusEl.textContent = ""), 2000);
    }
    f.reset();
    cargarIngresos();
  } catch (err) {
    console.error("Error ingreso:", err);
    const statusEl = qs("#ingresoStatus");
    if (statusEl) statusEl.textContent = "Error guardando ingreso.";
  }
}

async function cargarIngresos() {
  const cont = qs("#ingresosLista");
  if (!cont) return;
  cont.innerHTML = "<p class='placeholder'>Cargando ingresos...</p>";

  try {
    const snap = await db.collection("ingresos")
      .where("estado", "==", "abierto")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    if (snap.empty) {
      cont.innerHTML = "<p class='placeholder'>No hay ingresos abiertos.</p>";
      actualizarKpisIngresos(0, 0, null);
      return;
    }

    let total = 0;
    let mecanica = 0;
    let ultimaFecha = null;

    let html = `<table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Cliente</th>
          <th>Teléfono</th>
          <th>Tablilla</th>
          <th>Trabajo</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>`;

    snap.forEach(doc => {
      const d    = doc.data();
      const dObj = d.createdAt?.toDate?.() || null;
      const fecha = dObj
        ? dObj.toLocaleDateString("es-PR", { year: "2-digit", month: "2-digit", day: "2-digit" })
        : "";
      total++;
      if (d.tipoTrabajo === "mecanica") mecanica++;
      if (!ultimaFecha || (dObj && dObj > ultimaFecha)) ultimaFecha = dObj;

      html += `<tr>
        <td>${fecha}</td>
        <td>${d.clienteNombre || "-"}</td>
        <td>${d.clienteTelefono || "-"}</td>
        <td>${d.vehiculoTablilla || "-"}</td>
        <td>${d.tipoTrabajo || "-"}</td>
        <td>
          <button class="btn small" data-entregar="${doc.id}">Registrar entrega</button>
        </td>
      </tr>`;
    });

    html += "</tbody></table>";
    cont.innerHTML = html;

    qsa("[data-entregar]", cont).forEach(btn => {
      btn.addEventListener("click", () => abrirEntrega(btn.getAttribute("data-entregar")));
    });

    actualizarKpisIngresos(total, mecanica, ultimaFecha);
  } catch (err) {
    console.error("Error cargar ingresos:", err);
    cont.innerHTML = "<p class='placeholder'>Error al cargar ingresos.</p>";
  }
}

function actualizarKpisIngresos(total, mecanica, ultimaFecha) {
  const k1 = qs("#kpiIngresos .kpi-value");
  const k2 = qs("#kpiMecanica .kpi-value");
  const k3 = qs("#kpiUltimoIngreso .kpi-value");
  if (k1) k1.textContent = String(total);
  if (k2) k2.textContent = String(mecanica);
  if (k3) k3.textContent = ultimaFecha
    ? ultimaFecha.toLocaleDateString("es-PR", { year: "2-digit", month: "2-digit", day: "2-digit" })
    : "—";
}

/* ========== ENTREGAS (VISTA + FACTURA AUTO) ========== */

function abrirEntrega(ingresoId) {
  openDialog({
    title: "Registrar entrega",
    submitLabel: "Guardar entrega",
    fields: [
      {
        name: "entregaNotas",
        label: "Notas de entrega / trabajos realizados",
        type: "textarea",
        placeholder: "Detalles de lo realizado, piezas cambiadas, observaciones al cliente...",
        required: false
      },
      {
        name: "total",
        label: "Total facturado al cliente (sin $)",
        type: "number",
        placeholder: "Ej. 350.00",
        required: true
      },
      {
        name: "estado",
        label: "Estado de factura",
        type: "select",
        required: true,
        options: [
          { value: "pagada",   label: "Pagada" },
          { value: "pendiente",label: "Pendiente de pago" }
        ]
      }
    ],
    onSubmit: async (values) => {
      const total = parseFloat(values.total || "0") || 0;
      const pagada = values.estado === "pagada";
      const notas  = values.entregaNotas || "";

      await db.collection("ingresos").doc(ingresoId).update({
        estado: "entregado",
        entregaNotas: notas,
        entregaAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      const ingresoSnap = await db.collection("ingresos").doc(ingresoId).get();
      const ing = ingresoSnap.data();

      const facturaData = {
        numero: "F" + Date.now(),
        fecha: firebase.firestore.FieldValue.serverTimestamp(),
        clienteNombre:   ing.clienteNombre   || "",
        clienteTelefono: ing.clienteTelefono || "",
        vehiculoTablilla:ing.vehiculoTablilla|| "",
        vehiculoMarca:   ing.vehiculoMarca   || "",
        vehiculoModelo:  ing.vehiculoModelo  || "",
        vehiculoVin:     ing.vehiculoVin     || "",
        detalle:         ing.descripcionTrabajo || notas || "",
        subtotal: total,
        ivu: +(total * 0.115).toFixed(2),
        total: +(total * 1.115).toFixed(2),
        estado: pagada ? "pagada" : "pendiente",
        creadoPor: state.user?.email || "PIN_LOCAL",
        ingresoId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection("facturas").add(facturaData);

      cargarIngresos();
      cargarFacturas();
      cargarResumenFacturas();
      cargarEntregas();
    }
  });
}

async function cargarEntregas() {
  const cont = qs("#entregasTabla");
  if (!cont) return;
  cont.innerHTML = "<p class='placeholder'>Cargando entregas...</p>";

  try {
    const snap = await db.collection("ingresos")
      .where("estado", "==", "entregado")
      .orderBy("entregaAt", "desc")
      .limit(100)
      .get();

    if (snap.empty) {
      cont.innerHTML = "<p class='placeholder'>No hay entregas registradas aún.</p>";
      return;
    }

    let html = `<table>
      <thead>
        <tr>
          <th>Fecha entrega</th>
          <th>Cliente</th>
          <th>Tablilla</th>
          <th>Trabajo</th>
          <th>Notas</th>
        </tr>
      </thead>
      <tbody>`;

    snap.forEach(doc => {
      const d = doc.data();
      const fecha = d.entregaAt?.toDate?.().toLocaleDateString("es-PR", {
        year: "2-digit", month: "2-digit", day: "2-digit"
      }) || "";
      html += `<tr>
        <td>${fecha}</td>
        <td>${d.clienteNombre || "-"}</td>
        <td>${d.vehiculoTablilla || "-"}</td>
        <td>${d.tipoTrabajo || "-"}</td>
        <td>${(d.entregaNotas || "").slice(0, 60)}</td>
      </tr>`;
    });

    html += "</tbody></table>";
    cont.innerHTML = html;
  } catch (err) {
    console.error("Error cargar entregas:", err);
    cont.innerHTML = "<p class='placeholder'>Error al cargar entregas.</p>";
  }
}

/* ========== FACTURAS ========== */

async function cargarFacturas() {
  const cont = qs("#facturasTabla");
  if (!cont) return;
  cont.innerHTML = "<p class='placeholder'>Cargando facturas...</p>";

  const filtro = qs("#filtroEstadoFactura")?.value || "todas";
  let query = db.collection("facturas").orderBy("fecha", "desc").limit(100);
  if (filtro === "pendiente") query = query.where("estado", "==", "pendiente");
  else if (filtro === "pagada") query = query.where("estado", "==", "pagada");

  try {
    const snap = await query.get();
    if (snap.empty) {
      cont.innerHTML = "<p class='placeholder'>No hay facturas registradas.</p>";
      return;
    }

    let html = `<table>
      <thead>
        <tr>
          <th>#</th>
          <th>Fecha</th>
          <th>Cliente</th>
          <th>Tablilla</th>
          <th>Total</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>`;

    snap.forEach(doc => {
      const d = doc.data();
      const fecha = d.fecha?.toDate?.().toLocaleDateString("es-PR", {
        year: "2-digit", month: "2-digit", day: "2-digit"
      }) || "";
      const badgeClass = d.estado === "pagada" ? "success" : "pending";
      const badgeText  = d.estado === "pagada" ? "Pagada" : "Pendiente";

      html += `<tr>
        <td>${d.numero || doc.id}</td>
        <td>${fecha}</td>
        <td>${d.clienteNombre || "-"}</td>
        <td>${d.vehiculoTablilla || "-"}</td>
        <td>$${(d.total || 0).toFixed(2)}</td>
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        <td>
          <button class="btn small" data-marcar-pagada="${doc.id}">Marcar pagada</button>
          <button class="btn small" data-imprimir-factura="${doc.id}">Imprimir</button>
        </td>
      </tr>`;
    });

    html += "</tbody></table>";
    cont.innerHTML = html;

    qsa("[data-imprimir-factura]", cont).forEach(btn => {
      btn.addEventListener("click", () =>
        generarFacturaPDF(btn.getAttribute("data-imprimir-factura"))
      );
    });

    qsa("[data-marcar-pagada]", cont).forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-marcar-pagada");
        await db.collection("facturas").doc(id).update({ estado: "pagada" });
        cargarFacturas();
        cargarResumenFacturas();
      });
    });
  } catch (err) {
    console.error("Error cargar facturas:", err);
    cont.innerHTML = "<p class='placeholder'>Error al cargar facturas.</p>";
  }
}

async function cargarResumenFacturas() {
  const cont = qs("#resumenFacturas");
  if (!cont) return;
  cont.innerHTML = "<span class='status-msg'>Calculando resumen...</span>";

  try {
    const snap = await db.collection("facturas").get();
    let totalPagadas = 0;
    let totalPendientes = 0;
    let countPagadas = 0;
    let countPendientes = 0;

    snap.forEach(doc => {
      const d = doc.data();
      const t = d.total || 0;
      if (d.estado === "pagada") {
        totalPagadas += t;
        countPagadas++;
      } else if (d.estado === "pendiente") {
        totalPendientes += t;
        countPendientes++;
      }
    });

    cont.innerHTML = `
      <span>Pagos recibidos: <strong>$${totalPagadas.toFixed(2)}</strong> (${countPagadas} facturas)</span>
      <span> · </span>
      <span>Facturas pendientes: <strong>$${totalPendientes.toFixed(2)}</strong> (${countPendientes} facturas)</span>
    `;
  } catch (err) {
    console.error("Error resumen facturas:", err);
    cont.innerHTML = "<span class='status-msg'>Error en resumen.</span>";
  }
}

/* -------- PDFs FACTURAS -------- */

async function generarFacturaPDF(facturaId) {
  try {
    const snap = await db.collection("facturas").doc(facturaId).get();
    if (!snap.exists) {
      alert("Factura no encontrada.");
      return;
    }
    const d = snap.data();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    pdf.setFontSize(14);
    pdf.text("NEXUS AUTO PRO 2026 - FACTURA", 14, 16);
    pdf.setFontSize(10);
    pdf.text(`Factura: ${d.numero || facturaId}`, 14, 24);
    pdf.text(`Fecha: ${new Date().toLocaleDateString("es-PR")}`, 14, 30);

    pdf.text(`Cliente: ${d.clienteNombre || ""}`, 14, 40);
    pdf.text(`Teléfono: ${d.clienteTelefono || ""}`, 14, 46);
    pdf.text(`Tablilla: ${d.vehiculoTablilla || ""}`, 14, 52);
    pdf.text(`Vehículo: ${d.vehiculoMarca || ""} ${d.vehiculoModelo || ""}`, 14, 58);

    pdf.text("Detalle de trabajos:", 14, 70);
    const detalle = (d.detalle || "Trabajos realizados en el vehículo.").split("\n");
    let y = 76;
    detalle.forEach(linea => {
      pdf.text(linea, 14, y);
      y += 6;
    });

    pdf.text(`Subtotal: $${(d.subtotal || 0).toFixed(2)}`, 14, y + 8);
    pdf.text(`IVU: $${(d.ivu || 0).toFixed(2)}`, 14, y + 14);
    pdf.setFontSize(12);
    pdf.text(`TOTAL: $${(d.total || 0).toFixed(2)}`, 14, y + 24);

    pdf.save(`Factura-${d.numero || facturaId}.pdf`);
  } catch (err) {
    console.error("Error PDF factura:", err);
    alert("No se pudo generar la factura en PDF.");
  }
}

async function exportarFacturasListado() {
  try {
    const snap = await db.collection("facturas").orderBy("fecha", "desc").limit(100).get();
    if (snap.empty) {
      alert("No hay facturas para exportar.");
      return;
    }
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    pdf.setFontSize(14);
    pdf.text("NEXUS AUTO PRO 2026 - LISTADO DE FACTURAS", 14, 16);
    pdf.setFontSize(9);

    let y = 24;
    pdf.text("#   Fecha   Cliente               Total   Estado", 14, y);
    y += 6;

    snap.forEach(doc => {
      const d = doc.data();
      const fecha = d.fecha?.toDate?.().toLocaleDateString("es-PR") || "";
      const linea =
        `${(d.numero || "").slice(-6)}  ${fecha}  ${(d.clienteNombre || "").slice(0,18)}  ` +
        `$${(d.total || 0).toFixed(2)}  ${d.estado || ""}`;
      pdf.text(linea, 14, y);
      y += 5;
      if (y > 280) {
        pdf.addPage();
        y = 14;
      }
    });

    pdf.save("Facturas-NexusAutoPro.pdf");
  } catch (err) {
    console.error("Error exportar listado facturas:", err);
    alert("No se pudo exportar el listado de facturas.");
  }
}

/* ========== COTIZACIONES ========== */

async function cargarCotizaciones() {
  const cont = qs("#cotizacionesTabla");
  if (!cont) return;
  cont.innerHTML = "<p class='placeholder'>Cargando cotizaciones...</p>";

  try {
    const snap = await db.collection("cotizaciones")
      .orderBy("fecha", "desc")
      .limit(100)
      .get();

    if (snap.empty) {
      cont.innerHTML = "<p class='placeholder'>No hay cotizaciones registradas.</p>";
      return;
    }

    let html = `<table>
      <thead>
        <tr>
          <th>#</th>
          <th>Fecha</th>
          <th>Cliente</th>
          <th>Tablilla</th>
          <th>Total</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>`;

    snap.forEach(doc => {
      const d = doc.data();
      const fecha = d.fecha?.toDate?.().toLocaleDateString("es-PR", {
        year: "2-digit", month: "2-digit", day: "2-digit"
      }) || "";
      html += `<tr>
        <td>${d.numero || doc.id}</td>
        <td>${fecha}</td>
        <td>${d.clienteNombre || "-"}</td>
        <td>${d.vehiculoTablilla || "-"}</td>
        <td>$${(d.total || 0).toFixed(2)}</td>
        <td>
          <button class="btn small" data-imprimir-cotizacion="${doc.id}">Imprimir</button>
        </td>
      </tr>`;
    });

    html += "</tbody></table>";
    cont.innerHTML = html;

    qsa("[data-imprimir-cotizacion]", cont).forEach(btn => {
      btn.addEventListener("click", () =>
        generarCotizacionPDF(btn.getAttribute("data-imprimir-cotizacion"))
      );
    });
  } catch (err) {
    console.error("Error cargar cotizaciones:", err);
    cont.innerHTML = "<p class='placeholder'>Error al cargar cotizaciones.</p>";
  }
}

function nuevaCotizacion() {
  openDialog({
    title: "Nueva cotización",
    submitLabel: "Guardar cotización",
    fields: [
      { name: "clienteNombre",   label: "Nombre del cliente", type: "text", required: true },
      { name: "clienteTelefono", label: "Teléfono del cliente", type: "text", required: false },
      { name: "vehiculoTablilla",label: "Tablilla del vehículo", type: "text", required: false },
      {
        name: "descripcion",
        label: "Descripción de daños / trabajos (para seguro)",
        type: "textarea",
        required: false
      },
      {
        name: "total",
        label: "Total estimado (sin $)",
        type: "number",
        placeholder: "Ej. 1200.00",
        required: true
      }
    ],
    onSubmit: async (values) => {
      const total = parseFloat(values.total || "0") || 0;
      const data = {
        numero: "C" + Date.now(),
        fecha: firebase.firestore.FieldValue.serverTimestamp(),
        clienteNombre:   values.clienteNombre   || "",
        clienteTelefono: values.clienteTelefono || "",
        vehiculoTablilla:values.vehiculoTablilla|| "",
        descripcion:     values.descripcion     || "",
        subtotal: total,
        ivu: +(total * 0.115).toFixed(2),
        total: +(total * 1.115).toFixed(2),
        creadoPor: state.user?.email || "PIN_LOCAL",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection("cotizaciones").add(data);
      cargarCotizaciones();
    }
  });
}

async function generarCotizacionPDF(cotizacionId) {
  try {
    const snap = await db.collection("cotizaciones").doc(cotizacionId).get();
    if (!snap.exists) {
      alert("Cotización no encontrada.");
      return;
    }
    const d = snap.data();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    pdf.setFontSize(14);
    pdf.text("NEXUS AUTO PRO 2026 - COTIZACIÓN", 14, 16);
    pdf.setFontSize(10);
    pdf.text(`Cotización: ${d.numero || cotizacionId}`, 14, 24);
    pdf.text(`Fecha: ${new Date().toLocaleDateString("es-PR")}`, 14, 30);

    pdf.text("Datos del asegurado / cliente:", 14, 40);
    pdf.text(`Nombre: ${d.clienteNombre || ""}`, 14, 46);
    pdf.text(`Teléfono: ${d.clienteTelefono || ""}`, 14, 52);

    pdf.text("Datos del vehículo:", 14, 62);
    pdf.text(`Tablilla: ${d.vehiculoTablilla || ""}`, 14, 68);

    pdf.text("Daños / trabajos sugeridos:", 14, 80);
    const desc = (d.descripcion || "Descripción de daños y trabajos sugeridos.").split("\n");
    let y = 86;
    desc.forEach(linea => {
      pdf.text(linea, 14, y);
      y += 6;
    });

    pdf.text(`Subtotal: $${(d.subtotal || 0).toFixed(2)}`, 14, y + 8);
    pdf.text(`IVU: $${(d.ivu || 0).toFixed(2)}`, 14, y + 14);
    pdf.setFontSize(12);
    pdf.text(`TOTAL COTIZACIÓN: $${(d.total || 0).toFixed(2)}`, 14, y + 24);

    pdf.save(`Cotizacion-${d.numero || cotizacionId}.pdf`);
  } catch (err) {
    console.error("Error PDF cotización:", err);
    alert("No se pudo generar la cotización en PDF.");
  }
}

async function exportarCotizacionesListado() {
  try {
    const snap = await db.collection("cotizaciones").orderBy("fecha", "desc").limit(100).get();
    if (snap.empty) {
      alert("No hay cotizaciones para exportar.");
      return;
    }
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    pdf.setFontSize(14);
    pdf.text("NEXUS AUTO PRO 2026 - LISTADO DE COTIZACIONES", 14, 16);
    pdf.setFontSize(9);

    let y = 24;
    pdf.text("#   Fecha   Cliente               Total", 14, y);
    y += 6;

    snap.forEach(doc => {
      const d = doc.data();
      const fecha = d.fecha?.toDate?.().toLocaleDateString("es-PR") || "";
      const linea =
        `${(d.numero || "").slice(-6)}  ${fecha}  ${(d.clienteNombre || "").slice(0,18)}  ` +
        `$${(d.total || 0).toFixed(2)}`;
      pdf.text(linea, 14, y);
      y += 5;
      if (y > 280) {
        pdf.addPage();
        y = 14;
      }
    });

    pdf.save("Cotizaciones-NexusAutoPro.pdf");
  } catch (err) {
    console.error("Error exportar listado cotizaciones:", err);
    alert("No se pudo exportar el listado de cotizaciones.");
  }
}

/* ========== LISTA DE PRECIOS ========== */

async function cargarPrecios() {
  const cont = qs("#preciosTabla");
  if (!cont) return;
  cont.innerHTML = "<p class='placeholder'>Cargando lista de precios...</p>";

  try {
    const snap = await db.collection("precios")
      .orderBy("categoria")
      .orderBy("servicio")
      .get();

    if (snap.empty) {
      cont.innerHTML = "<p class='placeholder'>No hay servicios en la lista de precios.</p>";
      return;
    }

    let html = `<table>
      <thead>
        <tr>
          <th>Categoría</th>
          <th>Servicio</th>
          <th>Precio</th>
        </tr>
      </thead>
      <tbody>`;

    snap.forEach(doc => {
      const d = doc.data();
      html += `<tr>
        <td>${d.categoria || ""}</td>
        <td>${d.servicio  || ""}</td>
        <td>$${(d.precio || 0).toFixed(2)}</td>
      </tr>`;
    });

    html += "</tbody></table>";
    cont.innerHTML = html;
  } catch (err) {
    console.error("Error cargar precios:", err);
    cont.innerHTML = "<p class='placeholder'>Error al cargar lista de precios.</p>";
  }
}

function nuevoPrecio() {
  openDialog({
    title: "Nuevo servicio",
    submitLabel: "Guardar servicio",
    fields: [
      {
        name: "categoria",
        label: "Categoría",
        type: "text",
        placeholder: "Mecánica, hojalatería, pintura, detailing...",
        required: true
      },
      {
        name: "servicio",
        label: "Servicio",
        type: "text",
        placeholder: "Ej. Cambio de aceite, Pulido completo...",
        required: true
      },
      {
        name: "precio",
        label: "Precio base (sin $)",
        type: "number",
        required: true
      }
    ],
    onSubmit: async (values) => {
      const precio = parseFloat(values.precio || "0") || 0;
      await db.collection("precios").add({
        categoria: values.categoria || "",
        servicio:  values.servicio  || "",
        precio,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      cargarPrecios();
    }
  });
}

/* ========== CLIENTES ========== */

async function cargarClientes(busqueda = "") {
  const cont = qs("#clientesTabla");
  if (!cont) return;
  cont.innerHTML = "<p class='placeholder'>Cargando clientes...</p>";

  try {
    const snap = await db.collection("clientes")
      .orderBy("nombre")
      .limit(200)
      .get();

    if (snap.empty) {
      cont.innerHTML = "<p class='placeholder'>No hay clientes registrados.</p>";
      return;
    }

    const qText = (busqueda || "").toLowerCase();
    let html = `<table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Teléfono</th>
          <th>Dirección</th>
          <th>Notas</th>
        </tr>
      </thead>
      <tbody>`;

    snap.forEach(doc => {
      const d = doc.data();
      const texto = `${d.nombre || ""} ${d.telefono || ""} ${d.direccion || ""}`.toLowerCase();
      if (qText && !texto.includes(qText)) return;

      html += `<tr>
        <td>${d.nombre    || ""}</td>
        <td>${d.telefono  || ""}</td>
        <td>${d.direccion || ""}</td>
        <td>${d.notas     || ""}</td>
      </tr>`;
    });

    html += "</tbody></table>";
    cont.innerHTML = html;
  } catch (err) {
    console.error("Error cargar clientes:", err);
    cont.innerHTML = "<p class='placeholder'>Error al cargar clientes.</p>";
  }
}

function nuevoCliente() {
  openDialog({
    title: "Nuevo cliente",
    submitLabel: "Guardar cliente",
    fields: [
      { name: "nombre",    label: "Nombre completo", type: "text", required: true },
      { name: "telefono",  label: "Teléfono",        type: "text", required: false },
      { name: "direccion", label: "Dirección",       type: "text", required: false },
      { name: "notas",     label: "Notas",           type: "textarea", required: false }
    ],
    onSubmit: async (values) => {
      await db.collection("clientes").add({
        nombre:    values.nombre    || "",
        telefono:  values.telefono  || "",
        direccion: values.direccion || "",
        notas:     values.notas     || "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      cargarClientes();
    }
  });
}

/* ========== SUPLIDORES ========== */

async function cargarSuplidores(busqueda = "") {
  const cont = qs("#suplidoresTabla");
  if (!cont) return;
  cont.innerHTML = "<p class='placeholder'>Cargando suplidores...</p>";

  try {
    const snap = await db.collection("suplidores")
      .orderBy("nombre")
      .limit(200)
      .get();

    if (snap.empty) {
      cont.innerHTML = "<p class='placeholder'>No hay suplidores registrados.</p>";
      return;
    }

    const qText = (busqueda || "").toLowerCase();
    let html = `<table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Teléfono</th>
          <th>Tipo</th>
          <th>Notas</th>
        </tr>
      </thead>
      <tbody>`;

    snap.forEach(doc => {
      const d = doc.data();
      const texto = `${d.nombre || ""} ${d.telefono || ""} ${d.tipo || ""}`.toLowerCase();
      if (qText && !texto.includes(qText)) return;

      html += `<tr>
        <td>${d.nombre   || ""}</td>
        <td>${d.telefono || ""}</td>
        <td>${d.tipo     || ""}</td>
        <td>${d.notas    || ""}</td>
      </tr>`;
    });

    html += "</tbody></table>";
    cont.innerHTML = html;
  } catch (err) {
    console.error("Error cargar suplidores:", err);
    cont.innerHTML = "<p class='placeholder'>Error al cargar suplidores.</p>";
  }
}

function nuevoSuplidor() {
  openDialog({
    title: "Nuevo suplidor",
    submitLabel: "Guardar suplidor",
    fields: [
      { name: "nombre",   label: "Nombre del suplidor", type: "text", required: true },
      { name: "telefono", label: "Teléfono",            type: "text", required: false },
      { name: "tipo",     label: "Tipo (piezas, pintura, etc.)", type: "text", required: false },
      { name: "notas",    label: "Notas",               type: "textarea", required: false }
    ],
    onSubmit: async (values) => {
      await db.collection("suplidores").add({
        nombre:   values.nombre   || "",
        telefono: values.telefono || "",
        tipo:     values.tipo     || "",
        notas:    values.notas    || "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      cargarSuplidores();
    }
  });
}

/* ========== HISTORIAL CLIENTE / VEHÍCULO ========== */

function mostrarMensajeHistorial() {
  const cont = qs("#historialResultados");
  if (cont && !cont.innerHTML.trim()) {
    cont.innerHTML = "<p class='placeholder'>Escribe un nombre, tablilla o VIN y presiona Buscar.</p>";
  }
}

async function buscarHistorialCliente() {
  const qText = (qs("#historialBuscarInput").value || "").trim().toLowerCase();
  const cont  = qs("#historialResultados");
  if (!qText) {
    if (cont) {
      cont.innerHTML = "<p class='placeholder'>Escribe un nombre, tablilla o VIN para buscar.</p>";
    }
    return;
  }
  if (cont) {
    cont.innerHTML = "<p class='placeholder'>Buscando en ingresos y facturas...</p>";
  }

  try {
    const [ingSnap, facSnap] = await Promise.all([
      db.collection("ingresos").orderBy("createdAt", "desc").limit(200).get(),
      db.collection("facturas").orderBy("fecha", "desc").limit(200).get()
    ]);

    const filas = [];

    ingSnap.forEach(doc => {
      const d = doc.data();
      const texto = `${d.clienteNombre || ""} ${d.vehiculoTablilla || ""} ${d.vehiculoVin || ""}`.toLowerCase();
      if (!texto.includes(qText)) return;
      filas.push({
        tipo: "Ingreso",
        fecha: d.createdAt?.toDate?.().toLocaleDateString("es-PR") || "",
        cliente: d.clienteNombre || "",
        tablilla: d.vehiculoTablilla || "",
        detalle: d.descripcionTrabajo || "",
        total: "",
        estado: d.estado || ""
      });
    });

    facSnap.forEach(doc => {
      const d = doc.data();
      const texto = `${d.clienteNombre || ""} ${d.vehiculoTablilla || ""} ${d.vehiculoVin || ""}`.toLowerCase();
      if (!texto.includes(qText)) return;
      filas.push({
        tipo: "Factura",
        fecha: d.fecha?.toDate?.().toLocaleDateString("es-PR") || "",
        cliente: d.clienteNombre || "",
        tablilla: d.vehiculoTablilla || "",
        detalle: d.detalle || "",
        total: `$${(d.total || 0).toFixed(2)}`,
        estado: d.estado || ""
      });
    });

    if (!filas.length) {
      if (cont) {
        cont.innerHTML = "<p class='placeholder'>No se encontraron registros para ese cliente/vehículo.</p>";
      }
      return;
    }

    let html = `<table>
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Fecha</th>
          <th>Cliente</th>
          <th>Tablilla</th>
          <th>Detalle</th>
          <th>Total</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>`;

    filas.forEach(f => {
      html += `<tr>
        <td>${f.tipo}</td>
        <td>${f.fecha}</td>
        <td>${f.cliente}</td>
        <td>${f.tablilla}</td>
        <td>${(f.detalle || "").slice(0,60)}</td>
        <td>${f.total}</td>
        <td>${f.estado}</td>
      </tr>`;
    });

    html += "</tbody></table>";
    if (cont) cont.innerHTML = html;
  } catch (err) {
    console.error("Error historial:", err);
    if (cont) cont.innerHTML = "<p class='placeholder'>Error al buscar historial.</p>";
  }
}

/* ========== EVENT LISTENERS INICIALES ========== */

document.addEventListener("DOMContentLoaded", () => {
  if (dialogBackdrop) dialogBackdrop.classList.add("hidden");

  const pinForm = qs("#pinForm");
  if (pinForm) pinForm.addEventListener("submit", handlePinLogin);

  const googleBtn = qs("#googleSignInBtn");
  if (googleBtn) googleBtn.addEventListener("click", googleSignIn);

  const logoutBtn = qs("#logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  qsa(".menu-btn").forEach(btn => {
    if (btn.dataset.view) {
      btn.addEventListener("click", () => showScreen(btn.dataset.view));
    }
  });

  const ingresoForm = qs("#ingresoForm");
  if (ingresoForm) ingresoForm.addEventListener("submit", guardarIngreso);

  const configForm = qs("#configForm");
  if (configForm) configForm.addEventListener("submit", guardarConfiguracion);

  const filtroEstadoFactura = qs("#filtroEstadoFactura");
  if (filtroEstadoFactura) {
    filtroEstadoFactura.addEventListener("change", () => {
      cargarFacturas();
      cargarResumenFacturas();
    });
  }

  const exportFacturasBtn = qs("#exportFacturasBtn");
  if (exportFacturasBtn) {
    exportFacturasBtn.addEventListener("click", exportarFacturasListado);
  }

  const nuevaCotizacionBtn = qs("#nuevaCotizacionBtn");
  if (nuevaCotizacionBtn) {
    nuevaCotizacionBtn.addEventListener("click", nuevaCotizacion);
  }

  const exportCotizacionesBtn = qs("#exportCotizacionesBtn");
  if (exportCotizacionesBtn) {
    exportCotizacionesBtn.addEventListener("click", exportarCotizacionesListado);
  }

  const nuevoPrecioBtn = qs("#nuevoPrecioBtn");
  if (nuevoPrecioBtn) {
    nuevoPrecioBtn.addEventListener("click", nuevoPrecio);
  }

  const nuevoClienteBtn = qs("#nuevoClienteBtn");
  if (nuevoClienteBtn) {
    nuevoClienteBtn.addEventListener("click", nuevoCliente);
  }

  const buscarClienteBtn = qs("#buscarClienteBtn");
  if (buscarClienteBtn) {
    buscarClienteBtn.addEventListener("click", () => {
      const q = qs("#buscarClienteInput").value;
      cargarClientes(q);
    });
  }

  const nuevoSuplidorBtn = qs("#nuevoSuplidorBtn");
  if (nuevoSuplidorBtn) {
    nuevoSuplidorBtn.addEventListener("click", nuevoSuplidor);
  }

  const buscarSuplidorBtn = qs("#buscarSuplidorBtn");
  if (buscarSuplidorBtn) {
    buscarSuplidorBtn.addEventListener("click", () => {
      const q = qs("#buscarSuplidorInput").value;
      cargarSuplidores(q);
    });
  }

  const historialBuscarBtn = qs("#historialBuscarBtn");
  if (historialBuscarBtn) {
    historialBuscarBtn.addEventListener("click", buscarHistorialCliente);
  }

  // Vista inicial
  showView("loginView");
});
