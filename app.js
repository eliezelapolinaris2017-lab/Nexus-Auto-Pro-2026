// app.js — Nexus Auto Pro 2026 (v2 COMPLETA)

/* ========== CONFIG FIREBASE ========== */
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

/* ========== ESTADO GLOBAL ========== */
const state = {
  user: null,
  pin: "0000",
  configDocId: "config-app"
};

/* ========== UTILIDADES DOM ========== */
const qs = (sel, p = document) => p.querySelector(sel);
const qsa = (sel, p = document) => [...p.querySelectorAll(sel)];

function showView(id) {
  qsa(".view").forEach(v => v.classList.remove("visible"));
  const v = qs(`#${id}`);
  if (v) v.classList.add("visible");
}

function showScreen(id) {
  qsa(".screen").forEach(s => s.classList.remove("visible"));
  const s = qs(`#${id}`);
  if (s) s.classList.add("visible");
  qsa(".menu-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === id);
  });

  if (id === "ingresosView") cargarIngresosHoy();
  if (id === "facturasView") {
    cargarFacturas();
    cargarResumenFacturas();
  }
  if (id === "cotizacionesView") cargarCotizaciones();
  if (id === "clientesView") cargarClientes();
  if (id === "suplidoresView") cargarSuplidores();
  if (id === "configView") {
    cargarConfiguracion();
    cargarPrecios();
  }
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
      console.log("Autenticado:", state.user.email);
      cargarConfiguracion();
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

auth.onAuthStateChanged(async user => {
  state.user = user || null;
  if (user) {
    console.log("Usuario activo:", user.email);
    await cargarConfiguracion();
  }
});

/* ========== CONFIGURACIÓN ========== */

async function cargarConfiguracion() {
  try {
    const docRef = db.collection("ajustes").doc(state.configDocId);
    const snap = await docRef.get();
    if (!snap.exists) return;

    const data = snap.data();
    if (data.pin) state.pin = String(data.pin);

    const form = qs("#configForm");
    if (form) {
      form.tallerNombre.value = data.tallerNombre || "";
      form.tallerTelefono.value = data.tallerTelefono || "";
      form.tallerEmail.value = data.tallerEmail || "";
      form.tallerDireccion.value = data.tallerDireccion || "";
      form.logoUrl.value = data.logoUrl || "";
      form.driveUrl.value = data.driveUrl || "";
    }
    if (data.logoUrl) {
      qsa("img[src*='logo-auto']").forEach(img => (img.src = data.logoUrl));
    }
  } catch (err) {
    console.error("Error cargar config:", err);
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
  if (nuevoPin) payload.pin = nuevoPin;

  try {
    await db.collection("ajustes").doc(state.configDocId).set(payload, { merge: true });
    if (nuevoPin) state.pin = nuevoPin;
    qs("#configStatus").textContent = "Configuración guardada.";
    setTimeout(() => (qs("#configStatus").textContent = ""), 2000);

    if (payload.logoUrl) {
      qsa("img[src*='logo-auto']").forEach(img => (img.src = payload.logoUrl));
    }
  } catch (err) {
    console.error("Error guardar config:", err);
    qs("#configStatus").textContent = "Error guardando configuración.";
  }
}

/* ========== INGRESOS ========== */

async function guardarIngreso(e) {
  e.preventDefault();
  if (!state.user) {
    alert("Primero inicia sesión con Google.");
    return;
  }
  const f = e.target;
  const data = {
    clienteNombre: f.clienteNombre.value || "",
    clienteTelefono: f.clienteTelefono.value || "",
    clienteDireccion: f.clienteDireccion.value || "",
    vehiculoTablilla: f.vehiculoTablilla.value || "",
    vehiculoMarca: f.vehiculoMarca.value || "",
    vehiculoModelo: f.vehiculoModelo.value || "",
    vehiculoAno: f.vehiculoAno.value || "",
    vehiculoColor: f.vehiculoColor.value || "",
    vehiculoVin: f.vehiculoVin.value || "",
    tipoTrabajo: f.tipoTrabajo.value || "mecanica",
    descripcionTrabajo: f.descripcionTrabajo.value || "",
    estado: "abierto",
    creadoPor: state.user.email,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection("ingresos").add(data);
    qs("#ingresoStatus").textContent = "Ingreso guardado.";
    setTimeout(() => (qs("#ingresoStatus").textContent = ""), 2000);
    f.reset();
    cargarIngresosHoy();
  } catch (err) {
    console.error("Error ingreso:", err);
    qs("#ingresoStatus").textContent = "Error guardando ingreso.";
  }
}

async function cargarIngresosHoy() {
  const cont = qs("#ingresosLista");
  if (!cont) return;
  cont.innerHTML = "<p class='placeholder'>Cargando ingresos...</p>";

  try {
    const snap = await db.collection("ingresos")
      .where("estado", "==", "abierto")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    if (snap.empty) {
      cont.innerHTML = "<p class='placeholder'>No hay ingresos abiertos.</p>";
      return;
    }

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
      const d = doc.data();
      const fecha = d.createdAt?.toDate?.().toLocaleDateString("es-PR", {
        year: "2-digit", month: "2-digit", day: "2-digit"
      }) || "";
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

    qsa("[data-entregar]", cont).forEach(b => {
      b.addEventListener("click", () => abrirEntrega(b.getAttribute("data-entregar")));
    });
  } catch (err) {
    console.error("Error cargar ingresos:", err);
    cont.innerHTML = "<p class='placeholder'>Error al cargar ingresos.</p>";
  }
}

/* ========== ENTREGAS ========== */

async function abrirEntrega(ingresoId) {
  const obs = prompt("Notas de entrega / trabajos realizados / observaciones:");
  if (obs === null) return;
  const totalStr = prompt("Total facturado al cliente por este trabajo (solo número, sin $):", "0");
  if (totalStr === null) return;
  const total = parseFloat(totalStr) || 0;
  const pagado = confirm("¿Marcar esta factura como PAGADA? Aceptar = Pagada, Cancelar = Pendiente.");

  try {
    await db.collection("ingresos").doc(ingresoId).update({
      estado: "entregado",
      entregaNotas: obs,
      entregaAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    const ingresoSnap = await db.collection("ingresos").doc(ingresoId).get();
    const ing = ingresoSnap.data();

    const facturaData = {
      numero: "F" + Date.now(),
      fecha: firebase.firestore.FieldValue.serverTimestamp(),
      clienteNombre: ing.clienteNombre || "",
      clienteTelefono: ing.clienteTelefono || "",
      vehiculoTablilla: ing.vehiculoTablilla || "",
      vehiculoMarca: ing.vehiculoMarca || "",
      vehiculoModelo: ing.vehiculoModelo || "",
      detalle: ing.descripcionTrabajo || obs || "",
      subtotal: total,
      ivu: +(total * 0.115).toFixed(2),
      total: +(total * 1.115).toFixed(2),
      estado: pagado ? "pagada" : "pendiente",
      creadoPor: state.user?.email || "",
      ingresoId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("facturas").add(facturaData);
    alert("Entrega registrada y factura creada.");
    cargarIngresosHoy();
  } catch (err) {
    console.error("Error entrega:", err);
    alert("Error registrando entrega.");
  }
}

/* ========== FACTURAS ========== */

async function cargarFacturas() {
  const cont = qs("#facturasTabla");
  if (!cont) return;
  cont.innerHTML = "<p class='placeholder'>Cargando facturas...</p>";

  const filtroEstado = qs("#filtroEstadoFactura").value;
  let query = db.collection("facturas").orderBy("fecha", "desc").limit(100);
  if (filtroEstado === "pendiente") query = query.where("estado", "==", "pendiente");
  else if (filtroEstado === "pagada") query = query.where("estado", "==", "pagada");

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
      const badgeText = d.estado === "pagada" ? "Pagada" : "Pendiente";

      html += `<tr>
        <td>${d.numero || doc.id}</td>
        <td>${fecha}</td>
        <td>${d.clienteNombre || "-"}</td>
        <td>${d.vehiculoTablilla || "-"}</td>
        <td>$${(d.total || 0).toFixed(2)}</td>
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        <td>
          <button class="btn small" data-marcar-pagada="${doc.id}">Pagada</button>
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
      <span>Facturas pendientes: <strong>$${totalPendientes.toFixed(2)}</strong> (${countPendientes} facturas)</span>
    `;
  } catch (err) {
    console.error("Error resumen facturas:", err);
    cont.innerHTML = "<span class='status-msg'>Error en resumen.</span>";
  }
}

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

async function nuevaCotizacion() {
  if (!state.user) {
    alert("Primero inicia sesión con Google.");
    return;
  }

  const clienteNombre = prompt("Nombre del cliente:");
  if (!clienteNombre) return;
  const clienteTelefono = prompt("Teléfono del cliente (opcional):") || "";
  const tablilla = prompt("Tablilla del vehículo (opcional):") || "";
  const descripcion = prompt("Descripción breve de daños / trabajos (para seguro):") || "";
  const totalStr = prompt("Total estimado (solo número, sin $):", "0");
  if (totalStr === null) return;

  const total = parseFloat(totalStr) || 0;

  const data = {
    numero: "C" + Date.now(),
    fecha: firebase.firestore.FieldValue.serverTimestamp(),
    clienteNombre,
    clienteTelefono,
    vehiculoTablilla: tablilla,
    descripcion,
    subtotal: total,
    ivu: +(total * 0.115).toFixed(2),
    total: +(total * 1.115).toFixed(2),
    creadoPor: state.user.email,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection("cotizaciones").add(data);
    alert("Cotización guardada.");
    cargarCotizaciones();
  } catch (err) {
    console.error("Error nueva cotización:", err);
    alert("Error guardando la cotización.");
  }
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

/* ========== LISTAS DE PRECIOS ========== */

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
        <td>${d.servicio || ""}</td>
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

async function nuevoPrecio() {
  const categoria = prompt("Categoría (mecánica, hojalatería, pintura, detailing, etc.):");
  if (!categoria) return;
  const servicio = prompt("Nombre del servicio:");
  if (!servicio) return;
  const precioStr = prompt("Precio base (solo número, sin $):", "0");
  if (precioStr === null) return;
  const precio = parseFloat(precioStr) || 0;

  try {
    await db.collection("precios").add({
      categoria,
      servicio,
      precio,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    cargarPrecios();
  } catch (err) {
    console.error("Error nuevo precio:", err);
    alert("No se pudo guardar el servicio.");
  }
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

    const q = (busqueda || "").toLowerCase();
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
      if (q && !texto.includes(q)) return;

      html += `<tr>
        <td>${d.nombre || ""}</td>
        <td>${d.telefono || ""}</td>
        <td>${d.direccion || ""}</td>
        <td>${d.notas || ""}</td>
      </tr>`;
    });

    html += "</tbody></table>";
    cont.innerHTML = html;
  } catch (err) {
    console.error("Error cargar clientes:", err);
    cont.innerHTML = "<p class='placeholder'>Error al cargar clientes.</p>";
  }
}

async function nuevoCliente() {
  const nombre = prompt("Nombre del cliente:");
  if (!nombre) return;
  const telefono = prompt("Teléfono:") || "";
  const direccion = prompt("Dirección:") || "";
  const notas = prompt("Notas (opcional):") || "";

  try {
    await db.collection("clientes").add({
      nombre,
      telefono,
      direccion,
      notas,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    cargarClientes();
  } catch (err) {
    console.error("Error nuevo cliente:", err);
    alert("No se pudo guardar el cliente.");
  }
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

    const q = (busqueda || "").toLowerCase();
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
      if (q && !texto.includes(q)) return;

      html += `<tr>
        <td>${d.nombre || ""}</td>
        <td>${d.telefono || ""}</td>
        <td>${d.tipo || ""}</td>
        <td>${d.notas || ""}</td>
      </tr>`;
    });

    html += "</tbody></table>";
    cont.innerHTML = html;
  } catch (err) {
    console.error("Error cargar suplidores:", err);
    cont.innerHTML = "<p class='placeholder'>Error al cargar suplidores.</p>";
  }
}

async function nuevoSuplidor() {
  const nombre = prompt("Nombre del suplidor:");
  if (!nombre) return;
  const telefono = prompt("Teléfono:") || "";
  const tipo = prompt("Tipo (piezas, pintura, detailing, etc.):") || "";
  const notas = prompt("Notas (opcional):") || "";

  try {
    await db.collection("suplidores").add({
      nombre,
      telefono,
      tipo,
      notas,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    cargarSuplidores();
  } catch (err) {
    console.error("Error nuevo suplidor:", err);
    alert("No se pudo guardar el suplidor.");
  }
}

/* ========== HISTORIAL POR CLIENTE ========== */

async function buscarHistorialCliente() {
  const q = (qs("#historialBuscarInput").value || "").trim().toLowerCase();
  const cont = qs("#historialResultados");
  if (!q) {
    cont.innerHTML = "<p class='placeholder'>Escribe un nombre, tablilla o VIN para buscar.</p>";
    return;
  }
  cont.innerHTML = "<p class='placeholder'>Buscando en ingresos y facturas...</p>";

  try {
    const [ingSnap, facSnap] = await Promise.all([
      db.collection("ingresos").orderBy("createdAt", "desc").limit(200).get(),
      db.collection("facturas").orderBy("fecha", "desc").limit(200).get()
    ]);

    const filas = [];

    ingSnap.forEach(doc => {
      const d = doc.data();
      const texto = `${d.clienteNombre || ""} ${d.vehiculoTablilla || ""} ${d.vehiculoVin || ""}`.toLowerCase();
      if (!texto.includes(q)) return;
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
      if (!texto.includes(q)) return;
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
      cont.innerHTML = "<p class='placeholder'>No se encontraron registros para ese cliente/vehículo.</p>";
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
        <td>${f.detalle.slice(0,60)}</td>
        <td>${f.total}</td>
        <td>${f.estado}</td>
      </tr>`;
    });

    html += "</tbody></table>";
    cont.innerHTML = html;
  } catch (err) {
    console.error("Error historial:", err);
    cont.innerHTML = "<p class='placeholder'>Error al buscar historial.</p>";
  }
}

/* ========== EVENT LISTENERS ========== */

document.addEventListener("DOMContentLoaded", () => {
  qs("#pinForm").addEventListener("submit", handlePinLogin);
  qs("#googleSignInBtn").addEventListener("click", googleSignIn);
  qs("#logoutBtn").addEventListener("click", logout);

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

  showView("loginView");
});
