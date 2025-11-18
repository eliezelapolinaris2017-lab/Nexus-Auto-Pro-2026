// app.js — Nexus Auto Pro 2026

/* ========== CONFIG FIREBASE ========== */
/*
  👉 Reemplaza con tus credenciales reales de Firebase.
  Usa el mismo proyecto para todos los usuarios (taller completo).
*/
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_DOMINIO.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_BUCKET.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Estado global simple
const state = {
  user: null,
  pin: "0000",   // Se sobreescribe con configuración de Firestore si existe
  configDocId: "config-app", // doc fijo para ajustes generales
};

/* ========== UTILIDADES UI ========== */

function qs(selector, parent = document) {
  return parent.querySelector(selector);
}
function qsa(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

function showView(viewId) {
  qsa(".view").forEach(v => v.classList.remove("visible"));
  const view = qs(`#${viewId}`);
  if (view) view.classList.add("visible");
}

function showScreen(screenId) {
  qsa(".screen").forEach(s => s.classList.remove("visible"));
  const screen = qs(`#${screenId}`);
  if (screen) screen.classList.add("visible");

  qsa(".menu-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === screenId);
  });
}

/* ========== AUTH: PIN + GOOGLE ========== */

async function handlePinLogin(e) {
  e.preventDefault();
  const pinInput = qs("#pinInput");
  const pin = (pinInput.value || "").trim();

  if (!pin) return;

  if (pin === state.pin) {
    // PIN correcto, si ya hay usuario logeado con Google, mostramos app
    showView("appView");
    showScreen("ingresosView");
  } else {
    alert("PIN incorrecto.");
  }
}

function googleSignIn() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider)
    .then(result => {
      state.user = result.user;
      console.log("Autenticado como:", state.user.email);
      // Si el PIN ya se validó, o si se usa sólo con Google se puede saltar PIN
      // Aquí dejamos la doble capa: Google + PIN.
      // showView("appView");
    })
    .catch(err => {
      console.error("Error en Google Auth:", err);
      alert("No se pudo completar el inicio de sesión con Google.");
    });
}

function logout() {
  auth.signOut().finally(() => {
    state.user = null;
    showView("loginView");
  });
}

// Escuchar cambios de auth
auth.onAuthStateChanged(async (user) => {
  state.user = user || null;
  if (user) {
    console.log("Usuario activo:", user.email);
    await cargarConfiguracion();
  } else {
    console.log("Sin usuario autenticado");
  }
});

/* ========== CONFIGURACIÓN: TALLER + PIN ========== */

async function cargarConfiguracion() {
  try {
    const docRef = db.collection("ajustes").doc(state.configDocId);
    const snap = await docRef.get();
    if (!snap.exists) {
      console.log("Sin configuración previa; usando valores por defecto.");
      return;
    }
    const data = snap.data();
    if (data.pin) state.pin = String(data.pin);
    const configForm = qs("#configForm");
    if (configForm) {
      configForm.tallerNombre.value = data.tallerNombre || "";
      configForm.tallerTelefono.value = data.tallerTelefono || "";
      configForm.tallerEmail.value = data.tallerEmail || "";
      configForm.tallerDireccion.value = data.tallerDireccion || "";
      configForm.logoUrl.value = data.logoUrl || "";
      configForm.driveUrl.value = data.driveUrl || "";
    }
    // Cambiar logo si hay URL
    if (data.logoUrl) {
      const logos = qsa("img[src*='logo-auto']");
      logos.forEach(img => (img.src = data.logoUrl));
    }
  } catch (err) {
    console.error("Error al cargar configuración:", err);
  }
}

async function guardarConfiguracion(e) {
  e.preventDefault();
  const form = e.target;
  const nuevoPin = (form.pinNuevo.value || "").trim();

  const payload = {
    tallerNombre: form.tallerNombre.value || "",
    tallerTelefono: form.tallerTelefono.value || "",
    tallerEmail: form.tallerEmail.value || "",
    tallerDireccion: form.tallerDireccion.value || "",
    logoUrl: form.logoUrl.value || "",
    driveUrl: form.driveUrl.value || "",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (nuevoPin) {
    payload.pin = nuevoPin;
  }

  try {
    await db.collection("ajustes").doc(state.configDocId).set(payload, { merge: true });
    if (nuevoPin) state.pin = nuevoPin;
    qs("#configStatus").textContent = "Configuración guardada.";
    setTimeout(() => (qs("#configStatus").textContent = ""), 2000);

    if (payload.logoUrl) {
      const logos = qsa("img[src*='logo-auto']");
      logos.forEach(img => (img.src = payload.logoUrl));
    }
  } catch (err) {
    console.error("Error guardando configuración:", err);
    qs("#configStatus").textContent = "Error guardando configuración.";
  }
}

/* ========== INGRESOS: REGISTRO DE ENTRADA VEHÍCULO ========== */

async function guardarIngreso(e) {
  e.preventDefault();
  if (!state.user) {
    alert("Primero inicia sesión con Google.");
    return;
  }

  const form = e.target;
  const data = {
    clienteNombre: form.clienteNombre.value || "",
    clienteTelefono: form.clienteTelefono.value || "",
    clienteDireccion: form.clienteDireccion.value || "",
    vehiculoTablilla: form.vehiculoTablilla.value || "",
    vehiculoMarca: form.vehiculoMarca.value || "",
    vehiculoModelo: form.vehiculoModelo.value || "",
    vehiculoAno: form.vehiculoAno.value || "",
    vehiculoColor: form.vehiculoColor.value || "",
    vehiculoVin: form.vehiculoVin.value || "",
    tipoTrabajo: form.tipoTrabajo.value || "mecanica",
    descripcionTrabajo: form.descripcionTrabajo.value || "",
    estado: "abierto",
    creadoPor: state.user.email,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection("ingresos").add(data);
    qs("#ingresoStatus").textContent = "Ingreso guardado.";
    setTimeout(() => (qs("#ingresoStatus").textContent = ""), 2000);
    form.reset();
    cargarIngresosHoy();
  } catch (err) {
    console.error("Error guardando ingreso:", err);
    qs("#ingresoStatus").textContent = "Error guardando ingreso.";
  }
}

async function cargarIngresosHoy() {
  const contenedor = qs("#ingresosLista");
  if (!contenedor) return;
  contenedor.innerHTML = "<p class='placeholder'>Cargando ingresos...</p>";

  try {
    // Simple: últimos 20 ingresos abiertos
    const snap = await db.collection("ingresos")
      .where("estado", "==", "abierto")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    if (snap.empty) {
      contenedor.innerHTML = "<p class='placeholder'>No hay ingresos abiertos.</p>";
      return;
    }

    let html = "<table><thead><tr>";
    html += "<th>Fecha</th><th>Cliente</th><th>Teléfono</th><th>Tablilla</th><th>Trabajo</th><th>Estado</th>";
    html += "</tr></thead><tbody>";

    snap.forEach(doc => {
      const d = doc.data();
      const fecha = d.createdAt?.toDate?.().toLocaleDateString?.("es-PR", {
        year: "2-digit", month: "2-digit", day: "2-digit"
      }) || "";
      html += `<tr>
        <td>${fecha}</td>
        <td>${d.clienteNombre || "-"}</td>
        <td>${d.clienteTelefono || "-"}</td>
        <td>${d.vehiculoTablilla || "-"}</td>
        <td>${d.tipoTrabajo || "-"}</td>
        <td><span class="badge pending">Abierto</span></td>
      </tr>`;
    });

    html += "</tbody></table>";
    contenedor.innerHTML = html;
  } catch (err) {
    console.error("Error cargando ingresos:", err);
    contenedor.innerHTML = "<p class='placeholder'>Error al cargar ingresos.</p>";
  }
}

/* ========== FACTURAS: LISTADO Y PDF ========== */

async function cargarFacturas() {
  const contenedor = qs("#facturasTabla");
  if (!contenedor) return;
  contenedor.innerHTML = "<p class='placeholder'>Cargando facturas...</p>";

  const filtroEstado = qs("#filtroEstadoFactura").value;
  let query = db.collection("facturas").orderBy("fecha", "desc").limit(50);

  if (filtroEstado === "pendiente") {
    query = query.where("estado", "==", "pendiente");
  } else if (filtroEstado === "pagada") {
    query = query.where("estado", "==", "pagada");
  }

  try {
    const snap = await query.get();
    if (snap.empty) {
      contenedor.innerHTML = "<p class='placeholder'>No hay facturas registradas.</p>";
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
      const fecha = d.fecha?.toDate?.().toLocaleDateString?.("es-PR", {
        year: "2-digit", month: "2-digit", day: "2-digit"
      }) || "";
      const badgeClass = d.estado === "pagada" ? "success" : "pending";
      const badgeText = d.estado === "pagada" ? "Pagada" : "Pendiente";

      html += `<tr>
        <td>${d.numero || doc.id}</td>
        <td>${fecha}</td>
        <td>${d.clienteNombre || "-"}</td>
        <td>${d.vehiculoTablilla || "-"}</td>
        <td>$${(d.total || 0).toFixed(2)}</td>
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        <td>
          <button class="btn small" data-imprimir-factura="${doc.id}">Imprimir</button>
        </td>
      </tr>`;
    });

    html += "</tbody></table>";
    contenedor.innerHTML = html;

    // Listeners para imprimir
    qsa("[data-imprimir-factura]", contenedor).forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-imprimir-factura");
        generarFacturaPDF(id);
      });
    });
  } catch (err) {
    console.error("Error cargando facturas:", err);
    contenedor.innerHTML = "<p class='placeholder'>Error al cargar facturas.</p>";
  }
}

// PDF de UNA factura
async function generarFacturaPDF(facturaId) {
  try {
    const docSnap = await db.collection("facturas").doc(facturaId).get();
    if (!docSnap.exists) {
      alert("Factura no encontrada.");
      return;
    }
    const d = docSnap.data();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    // Encabezado básico (luego lo afinamos al formato aseguradora PR)
    pdf.setFontSize(14);
    pdf.text("Nexus Auto Pro 2026 - Factura", 14, 16);
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
    console.error("Error generando PDF:", err);
    alert("No se pudo generar la factura en PDF.");
  }
}

/* ========== LISTENERS PRINCIPALES ========== */

document.addEventListener("DOMContentLoaded", () => {
  // Login
  qs("#pinForm").addEventListener("submit", handlePinLogin);
  qs("#googleSignInBtn").addEventListener("click", googleSignIn);

  // Menú
  qsa(".menu-btn").forEach(btn => {
    if (btn.dataset.view) {
      btn.addEventListener("click", () => {
        showScreen(btn.dataset.view);
        // Cargas específicas cuando se abre una pantalla
        if (btn.dataset.view === "ingresosView") {
          cargarIngresosHoy();
        } else if (btn.dataset.view === "facturasView") {
          cargarFacturas();
        }
      });
    }
  });

  // Logout
  qs("#logoutBtn").addEventListener("click", logout);

  // Formularios
  const ingresoForm = qs("#ingresoForm");
  if (ingresoForm) ingresoForm.addEventListener("submit", guardarIngreso);

  const configForm = qs("#configForm");
  if (configForm) configForm.addEventListener("submit", guardarConfiguracion);

  // Facturas filtros / botones
  const filtroEstadoFactura = qs("#filtroEstadoFactura");
  if (filtroEstadoFactura) {
    filtroEstadoFactura.addEventListener("change", cargarFacturas);
  }

  const exportFacturasBtn = qs("#exportFacturasBtn");
  if (exportFacturasBtn) {
    exportFacturasBtn.addEventListener("click", async () => {
      // Aquí luego: listado de facturas en PDF
      alert("Aquí irá la exportación PDF (Listado de facturas). Botón: Imprimir.");
    });
  }

  const exportCotizacionesBtn = qs("#exportCotizacionesBtn");
  if (exportCotizacionesBtn) {
    exportCotizacionesBtn.addEventListener("click", () => {
      alert("Aquí irá la exportación PDF (Listado de cotizaciones). Botón: Imprimir.");
    });
  }
});
