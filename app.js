const STORAGE_KEY = "cajaju_v3";
const CLAVE_ACTIVACION = "CAJAJU-2026";
const LLAVE_ACTIVADO = "cajaju_activada_v1";
const CLAVE_QR_STORAGE = "cajaju_qr_pago";

const estadoInicial = {
  tienda: "Tienda",
  productos: [
    { id: 1, nombre: "Coca-Cola 2L", costo: 11.0, precio: 14.0, stock: 20 },
    { id: 2, nombre: "Arroz 1kg", costo: 7.0, precio: 9.5, stock: 35 },
    { id: 3, nombre: "Aceite 900ml", costo: 13.0, precio: 16.0, stock: 15 }
  ],
  carrito: [],
  ventas: [],
  fiados: []
};

let eventosConfigurados = false;
let appIniciada = false;
let interceptadorBotonConfigurado = false;

function clonarEstadoInicial() {
  return JSON.parse(JSON.stringify(estadoInicial));
}

function escaparHTML(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cargarEstado() {
  const base = clonarEstadoInicial();
  try {
    const guardado = localStorage.getItem(STORAGE_KEY);
    if (!guardado) return base;

    const parsed = JSON.parse(guardado);
    return {
      tienda: typeof parsed.tienda === "string" && parsed.tienda.trim() ? parsed.tienda.trim() : base.tienda,
      productos: Array.isArray(parsed.productos) ? parsed.productos : base.productos,
      carrito: Array.isArray(parsed.carrito) ? parsed.carrito : base.carrito,
      ventas: Array.isArray(parsed.ventas) ? parsed.ventas : base.ventas,
      fiados: Array.isArray(parsed.fiados) ? parsed.fiados : base.fiados
    };
  } catch (err) {
    return base;
  }
}

let estado = clonarEstadoInicial();

function guardarEstado() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  } catch (err) {
    console.warn("No se pudo guardar en localStorage:", err);
  }
}

function bs(valor) {
  const num = Number(valor);
  return `Bs. ${(Number.isFinite(num) ? num : 0).toFixed(2)}`;
}

function configurarNavegacion() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("activa"));
      document.querySelectorAll(".vista").forEach((v) => v.classList.remove("activa"));

      btn.classList.add("activa");
      const destino = document.getElementById(`tab-${btn.dataset.tab}`);
      if (destino) destino.classList.add("activa");
      if (btn.dataset.tab === "qr") actualizarMontoQR();
    });
  });
}

function calcularMetricas() {
  const ventasValidas = estado.ventas.filter((v) => v.estado !== "anulada");
  const ventasContado = ventasValidas.reduce((acc, v) => acc + (Number(v.total) || 0), 0);
  const gananciaReal = ventasValidas.reduce((acc, v) => acc + (Number(v.ganancia) || 0), 0);
  const fiadosPendientes = estado.fiados
    .filter((f) => !f.pagado)
    .reduce((acc, f) => acc + (Number(f.total) || 0), 0);

  return { ventasContado, gananciaReal, fiadosPendientes };
}

function setTexto(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}

function actualizarMontoQR() {
  const totalEl = document.getElementById("total-carrito");
  const montoPestana = document.getElementById("montoQRPestana");
  const montoModal = document.getElementById("montoACobrarQR");

  if (montoPestana) {
    montoPestana.textContent = totalEl ? `Total actual: ${totalEl.textContent}` : "";
  }
  if (montoModal) {
    montoModal.textContent = totalEl ? `Total: ${totalEl.textContent}` : "";
  }
}

function renderTodo() {
  setTexto("nombre-tienda", estado.tienda);

  const { ventasContado, gananciaReal, fiadosPendientes } = calcularMetricas();

  setTexto("top-ventas", bs(ventasContado));
  setTexto("top-ganancia", bs(gananciaReal));
  setTexto("top-fiados", bs(fiadosPendientes));

  setTexto("rep-ventas", bs(ventasContado));
  setTexto("rep-ganancia", bs(gananciaReal));
  setTexto("rep-fiados", bs(fiadosPendientes));

  renderProductosCaja();
  renderCarrito();
  renderTablaProductos();
  renderFiados();
  renderVentas();
  guardarEstado();
}

function renderProductosCaja() {
  const cont = document.getElementById("lista-productos-caja");
  const buscador = document.getElementById("buscador");
  if (!cont) return;

  const filtro = (buscador ? buscador.value : "").toLowerCase().trim();
  cont.innerHTML = "";

  const filtrados = estado.productos.filter((p) =>
    String(p.nombre || "").toLowerCase().includes(filtro)
  );

  if (filtrados.length === 0) {
    cont.innerHTML = `<p class="prod-meta">No hay productos que coincidan.</p>`;
    return;
  }

  filtrados.forEach((p) => {
    const stock = Math.max(0, Number(p.stock) || 0);
    const card = document.createElement("div");
    card.className = "prod-card";
    card.innerHTML = `
      <div>
        <strong>${escaparHTML(p.nombre)}</strong>
        <div class="prod-precio">${bs(p.precio)}</div>
        <div class="prod-meta">Stock: ${stock}</div>
      </div>
      <button type="button" ${stock <= 0 ? "disabled" : ""} onclick="agregarCarrito(${Number(p.id)})">
        ${stock > 0 ? "Añadir" : "Agotado"}
      </button>
    `;
    cont.appendChild(card);
  });
}

function agregarCarrito(idProd) {
  const prod = estado.productos.find((p) => p.id === idProd);
  const stockDisponible = prod ? Math.max(0, Number(prod.stock) || 0) : 0;
  if (!prod || stockDisponible <= 0) return;

  const existe = estado.carrito.find((item) => item.id === idProd);
  if (existe) {
    if (existe.cantidad < stockDisponible) existe.cantidad += 1;
  } else {
    estado.carrito.push({
      id: prod.id,
      nombre: prod.nombre,
      costo: Number(prod.costo) || 0,
      precio: Number(prod.precio) || 0,
      cantidad: 1
    });
  }
  renderTodo();
}

function renderCarrito() {
  const ul = document.getElementById("lista-carrito");
  if (!ul) return;

  ul.innerHTML = "";
  let total = 0;

  if (estado.carrito.length === 0) {
    ul.innerHTML = `<li class="prod-meta">Carrito vacío. Toca un producto para añadir.</li>`;
    setTexto("total-carrito", bs(0));
    actualizarMontoQR();
    return;
  }

  estado.carrito.forEach((item) => {
    const cant = Math.max(0, Number(item.cantidad) || 0);
    const precio = Number(item.precio) || 0;
    const sub = precio * cant;
    total += sub;

    const li = document.createElement("li");
    li.className = "item-fila";
    li.innerHTML = `
      <span>${escaparHTML(item.nombre)} <strong>x${cant}</strong></span>
      <span>${bs(sub)}</span>
    `;
    ul.appendChild(li);
  });

  setTexto("total-carrito", bs(total));
  actualizarMontoQR();
}

function procesarVenta(tipo) {
  if (estado.carrito.length === 0) {
    alert("Primero añade productos a la venta.");
    return;
  }

  const inputCliente = document.getElementById("cliente-fiado");
  const cliente = inputCliente ? inputCliente.value.trim() : "";

  if (tipo === "fiado" && !cliente) {
    alert("Escribe el nombre del cliente para registrar el fiado.");
    if (inputCliente) inputCliente.focus();
    return;
  }

  let total = 0;
  let ganancia = 0;
  const itemsVendidos = [];

  estado.carrito.forEach((item) => {
    const prod = estado.productos.find((p) => p.id === item.id);
    const stockActual = prod ? Math.max(0, Number(prod.stock) || 0) : Number(item.cantidad) || 0;
    const cantVendida = Math.min(Math.max(0, Number(item.cantidad) || 0), stockActual);
    const precio = Number(item.precio) || 0;
    const costo = Number(item.costo) || 0;

    if (cantVendida <= 0) return;

    total += precio * cantVendida;
    ganancia += (precio - costo) * cantVendida;

    itemsVendidos.push({
      productoId: item.id,
      nombre: item.nombre,
      cantidad: cantVendida,
      precio,
      costo
    });

    if (prod) {
      prod.stock = Math.max(0, stockActual - cantVendida);
    }
  });

  if (itemsVendidos.length === 0) {
    alert("No hay stock suficiente para completar la venta.");
    return;
  }

  const fecha = new Date().toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

  if (tipo === "contado") {
    estado.ventas.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      fecha,
      tipo: "contado",
      cliente: cliente || "Cliente general",
      total,
      ganancia,
      items: itemsVendidos,
      estado: "activa"
    });
    alert(`Venta al contado registrada por ${bs(total)}`);
  } else {
    estado.fiados.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      fecha,
      cliente,
      total,
      ganancia,
      items: itemsVendidos,
      pagado: false
    });
    alert(`Fiado registrado a nombre de ${cliente} por ${bs(total)}`);
  }

  estado.carrito = [];
  if (inputCliente) inputCliente.value = "";
  renderTodo();
}

function anularVenta(idVenta) {
  const venta = estado.ventas.find((v) => v.id === idVenta);
  if (!venta || venta.estado === "anulada") return;

  const confirmar = confirm(
    `¿Anular la venta de "${venta.cliente}" por ${bs(venta.total)} y devolver los productos al stock?`
  );
  if (!confirmar) return;

  if (Array.isArray(venta.items)) {
    venta.items.forEach((item) => {
      const prod = estado.productos.find((p) => p.id === item.productoId);
      if (prod) {
        const cant = Math.max(0, Number(item.cantidad) || 0);
        prod.stock = Math.max(0, Number(prod.stock) || 0) + cant;
      }
    });
  }

  venta.estado = "anulada";
  renderTodo();
}

function cobrarFiado(idFiado) {
  const fiado = estado.fiados.find((f) => f.id === idFiado);
  if (!fiado || fiado.pagado) return;

  fiado.pagado = true;
  estado.ventas.unshift({
    id: Date.now() + Math.floor(Math.random() * 1000),
    fecha: new Date().toLocaleString("es-BO", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }),
    tipo: "cobro_fiado",
    cliente: fiado.cliente,
    total: Number(fiado.total) || 0,
    ganancia: Number(fiado.ganancia) || 0,
    items: Array.isArray(fiado.items) ? fiado.items : [],
    estado: "activa"
  });

  renderTodo();
}

function eliminarDeudor(idFiado) {
  const fiado = estado.fiados.find((f) => f.id === idFiado);
  if (!fiado) return;

  const monto = Number(fiado.total) || 0;
  if (!fiado.pagado && monto > 0) {
    const forzar = confirm(
      `${fiado.cliente} aún figura como PENDIENTE por ${bs(monto)}. ¿Seguro que deseas eliminar este registro?`
    );
    if (!forzar) return;
  } else {
    const ok = confirm(`¿Eliminar a ${fiado.cliente} de la lista de fiados?`);
    if (!ok) return;
  }

  estado.fiados = estado.fiados.filter((f) => f.id !== idFiado);
  renderTodo();
}

function editarProducto(idProd) {
  const prod = estado.productos.find((p) => p.id === idProd);
  if (!prod) return;

  const costoActual = Number(prod.costo) || 0;
  const precioActual = Number(prod.precio) || 0;
  const stockActual = Math.max(0, Number(prod.stock) || 0);

  const nuevoCostoStr = prompt(
    `Editar COSTO de "${prod.nombre}" (actual: ${costoActual}):`,
    String(costoActual)
  );
  if (nuevoCostoStr === null) return;

  const nuevoPrecioStr = prompt(
    `Editar PRECIO de venta de "${prod.nombre}" (actual: ${precioActual}):`,
    String(precioActual)
  );
  if (nuevoPrecioStr === null) return;

  const nuevoStockStr = prompt(
    `Editar STOCK de "${prod.nombre}" (actual: ${stockActual}):`,
    String(stockActual)
  );
  if (nuevoStockStr === null) return;

  const nuevoCosto = nuevoCostoStr.trim() === "" ? costoActual : parseFloat(nuevoCostoStr);
  const nuevoPrecio = nuevoPrecioStr.trim() === "" ? precioActual : parseFloat(nuevoPrecioStr);
  const nuevoStock = nuevoStockStr.trim() === "" ? stockActual : parseInt(nuevoStockStr, 10);

  if (
    !Number.isFinite(nuevoCosto) ||
    nuevoCosto < 0 ||
    !Number.isFinite(nuevoPrecio) ||
    nuevoPrecio < 0 ||
    !Number.isInteger(nuevoStock) ||
    nuevoStock < 0
  ) {
    alert("Revisa los valores: Costo y Precio deben ser números válidos y Stock un entero igual o mayor a 0.");
    return;
  }

  prod.costo = nuevoCosto;
  prod.precio = nuevoPrecio;
  prod.stock = nuevoStock;

  estado.carrito.forEach((item) => {
    if (item.id === idProd) {
      item.costo = nuevoCosto;
      item.precio = nuevoPrecio;
      if (item.cantidad > nuevoStock) {
        item.cantidad = nuevoStock;
      }
    }
  });
  estado.carrito = estado.carrito.filter((item) => item.cantidad > 0);

  renderTodo();
}

function eliminarProducto(idProd) {
  const prod = estado.productos.find((p) => p.id === idProd);
  if (!prod) return;

  const confirmar = confirm(`¿Seguro que deseas eliminar "${prod.nombre}" del inventario?`);
  if (!confirmar) return;

  estado.productos = estado.productos.filter((p) => p.id !== idProd);
  estado.carrito = estado.carrito.filter((item) => item.id !== idProd);
  renderTodo();
}

function renderTablaProductos() {
  const tbody = document.getElementById("tabla-productos");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (estado.productos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="prod-meta">No hay productos registrados.</td></tr>`;
    return;
  }

  estado.productos.forEach((p) => {
    const costo = Number(p.costo) || 0;
    const precio = Number(p.precio) || 0;
    const stock = Math.max(0, Number(p.stock) || 0);
    const ganUnit = precio - costo;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escaparHTML(p.nombre)}</strong></td>
      <td>${bs(costo)}</td>
      <td>${bs(precio)}</td>
      <td>${bs(ganUnit)}</td>
      <td>${stock}</td>
      <td>
        <button type="button" class="btn-pequeno" onclick="editarProducto(${Number(p.id)})">
          Editar
        </button>
        <button type="button" class="btn-pequeno btn-eliminar" onclick="eliminarProducto(${Number(p.id)})">
          Eliminar
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderFiados() {
  const ul = document.getElementById("lista-fiados");
  if (!ul) return;

  ul.innerHTML = "";

  if (estado.fiados.length === 0) {
    ul.innerHTML = `<li class="prod-meta">No hay fiados registrados.</li>`;
    return;
  }

  estado.fiados.forEach((f) => {
    const li = document.createElement("li");
    li.className = "item-fila";
    li.innerHTML = `
      <div>
        <strong>${escaparHTML(f.cliente)}</strong> <span class="prod-meta">(${escaparHTML(f.fecha)})</span><br />
        <span>${bs(f.total)}</span> — <small>${f.pagado ? "Pagado" : "Pendiente"}</small>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${
          !f.pagado
            ? `<button type="button" class="btn-pequeno" onclick="cobrarFiado(${Number(f.id)})">Marcar Pagado</button>`
            : ""
        }
        <button type="button" class="btn-pequeno btn-eliminar" onclick="eliminarDeudor(${Number(f.id)})">
          Eliminar
        </button>
      </div>
    `;
    ul.appendChild(li);
  });
}

function renderVentas() {
  const ul = document.getElementById("lista-ventas");
  if (!ul) return;

  ul.innerHTML = "";

  if (estado.ventas.length === 0) {
    ul.innerHTML = `<li class="prod-meta">Aún no hay ventas registradas.</li>`;
    return;
  }

  estado.ventas.forEach((v) => {
    const anulada = v.estado === "anulada";
    const li = document.createElement("li");
    li.className = "item-fila";
    li.style.opacity = anulada ? "0.6" : "1";
    li.innerHTML = `
      <div>
        <strong>${escaparHTML(v.cliente)}</strong> <span class="prod-meta">(${escaparHTML(v.fecha)})</span><br />
        <small>Ganancia: ${bs(v.ganancia)}${anulada ? " · <strong>ANULADA</strong>" : ""}</small>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <strong style="${anulada ? "text-decoration:line-through;" : ""}">${bs(v.total)}</strong>
        ${
          !anulada
            ? `<button type="button" class="btn-pequeno btn-eliminar" onclick="anularVenta(${Number(v.id)})">Anular</button>`
            : ""
        }
      </div>
    `;
    ul.appendChild(li);
  });
}

function cargarQRGuardado() {
  const imgQRConfig = document.getElementById("imgQRConfig");
  const textoSinQR = document.getElementById("textoSinQR");
  const imgQRCobro = document.getElementById("imgQRCobro");
  const avisoSinQRCobro = document.getElementById("avisoSinQRCobro");

  try {
    const qrDataUrl = localStorage.getItem(CLAVE_QR_STORAGE);
    if (qrDataUrl) {
      if (imgQRConfig) {
        imgQRConfig.src = qrDataUrl;
        imgQRConfig.style.display = "inline-block";
      }
      if (textoSinQR) textoSinQR.style.display = "none";

      if (imgQRCobro) {
        imgQRCobro.src = qrDataUrl;
        imgQRCobro.style.display = "block";
      }
      if (avisoSinQRCobro) avisoSinQRCobro.style.display = "none";
    } else {
      if (imgQRConfig) {
        imgQRConfig.removeAttribute("src");
        imgQRConfig.style.display = "none";
      }
      if (textoSinQR) textoSinQR.style.display = "block";

      if (imgQRCobro) {
        imgQRCobro.removeAttribute("src");
        imgQRCobro.style.display = "none";
      }
      if (avisoSinQRCobro) avisoSinQRCobro.style.display = "block";
    }
  } catch (error) {
    console.error("Error al leer el QR guardado:", error);
  }
}

function configurarQR() {
  const inputSubirQR = document.getElementById("inputSubirQR");
  const btnEliminarQR = document.getElementById("btnEliminarQR");
  const btnMostrarQRCobro = document.getElementById("btnMostrarQRCobro");
  const modalQR = document.getElementById("modalQR");
  const btnCerrarModalQR = document.getElementById("btnCerrarModalQR");

  if (inputSubirQR) {
    inputSubirQR.addEventListener("change", (event) => {
      const archivo = event.target.files[0];
      if (!archivo) return;

      if (!archivo.type.startsWith("image/")) {
        alert("Por favor selecciona un archivo de imagen válido (PNG, JPG o WEBP).");
        return;
      }

      const lector = new FileReader();
      lector.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxLado = 600;
          let ancho = img.width;
          let alto = img.height;

          if (ancho > maxLado || alto > maxLado) {
            if (ancho > alto) {
              alto = Math.round((alto * maxLado) / ancho);
              ancho = maxLado;
            } else {
              ancho = Math.round((ancho * maxLado) / alto);
              alto = maxLado;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = ancho;
          canvas.height = alto;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, ancho, alto);
          ctx.drawImage(img, 0, 0, ancho, alto);

          const imagenOptimizada = canvas.toDataURL("image/png");

          try {
            localStorage.setItem(CLAVE_QR_STORAGE, imagenOptimizada);
            cargarQRGuardado();
            alert("Código QR guardado correctamente.");
          } catch (err) {
            alert("No se pudo guardar el QR. Verifica el espacio disponible.");
          }
        };
        img.src = e.target.result;
      };
      lector.readAsDataURL(archivo);
    });
  }

  if (btnEliminarQR) {
    btnEliminarQR.addEventListener("click", () => {
      const qrActual = localStorage.getItem(CLAVE_QR_STORAGE);
      if (!qrActual) {
        alert("No hay ningún QR guardado para eliminar.");
        return;
      }

      if (!confirm("¿Seguro que deseas eliminar el código QR guardado?")) return;

      localStorage.removeItem(CLAVE_QR_STORAGE);
      if (inputSubirQR) inputSubirQR.value = "";
      cargarQRGuardado();
      alert("Código QR eliminado.");
    });
  }

  if (btnMostrarQRCobro && modalQR) {
    btnMostrarQRCobro.addEventListener("click", () => {
      actualizarMontoQR();
      modalQR.style.display = "flex";
    });
  }

  if (btnCerrarModalQR && modalQR) {
    btnCerrarModalQR.addEventListener("click", () => {
      modalQR.style.display = "none";
    });
  }

  cargarQRGuardado();
}

function asegurarPieDeMarca() {
  if (!document.body || document.getElementById("cajaju-footer-marca")) return;
  const footer = document.createElement("footer");
  footer.id = "cajaju-footer-marca";
  footer.style.cssText =
    "text-align:center;padding:14px 12px;margin-top:24px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;";
  footer.innerHTML = "<strong>CajaJun</strong> — Sistema para Tiendas · Desarrollado por <strong>Junsoftwar</strong>";
  document.body.appendChild(footer);
}

function registrarServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js")
        .then((registro) => {
          console.log("CajaJun lista sin internet. Scope:", registro.scope);
        })
        .catch((error) => {
          console.warn("Error al registrar el Service Worker:", error);
        });
    });
  }
}

function configurarEventos() {
  if (eventosConfigurados) return;
  eventosConfigurados = true;

  configurarNavegacion();
  configurarQR();

  const formProd = document.getElementById("form-producto");
  if (formProd) {
    formProd.addEventListener("submit", (e) => {
      e.preventDefault();
      const nombre = document.getElementById("prod-nombre").value.trim();
      const costo = parseFloat(document.getElementById("prod-costo").value);
      const precio = parseFloat(document.getElementById("prod-precio").value);
      const stock = parseInt(document.getElementById("prod-stock").value, 10);

      if (!nombre || !Number.isFinite(costo) || costo < 0 || !Number.isFinite(precio) || precio < 0 || !Number.isInteger(stock) || stock < 0) {
        alert("Revisa que los datos del producto sean válidos.");
        return;
      }

      estado.productos.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        nombre,
        costo,
        precio,
        stock
      });
      e.target.reset();
      renderTodo();
    });
  }

  const btnCobrar = document.getElementById("btn-cobrar-contado");
  if (btnCobrar) btnCobrar.addEventListener("click", () => procesarVenta("contado"));

  const btnFiar = document.getElementById("btn-fiar");
  if (btnFiar) btnFiar.addEventListener("click", () => procesarVenta("fiado"));

  const btnLimpiar = document.getElementById("btn-limpiar");
  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", () => {
      estado.carrito = [];
      renderTodo();
    });
  }

  const buscador = document.getElementById("buscador");
  if (buscador) buscador.addEventListener("input", renderProductosCaja);
}

function iniciarCajaJun() {
  if (appIniciada) return;
  appIniciada = true;

  asegurarPieDeMarca();
  estado = cargarEstado();
  configurarEventos();
  renderTodo();
  registrarServiceWorker();
}

function renderModalActivacionVisual() {
  if (!document.body || document.getElementById("cajaju-overlay-activacion")) return;

  const overlay = document.createElement("div");
  overlay.id = "cajaju-overlay-activacion";
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(15,23,42,0.75);display:flex;align-items:center;justify-content:center;padding:16px;z-index:9999;font-family:system-ui,-apple-system,sans-serif;";

  overlay.innerHTML = `
    <div style="background:#ffffff;color:#111827;max-width:420px;width:100%;padding:24px;border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,0.25);">
      <h2 style="margin:0 0 6px;font-size:1.25rem;">CajaJun — Registro de tienda</h2>
      <p style="margin:0 0 14px;font-size:0.9rem;color:#374151;">
        Escribe el identificador de tu tienda para abrir la caja y el inventario.
      </p>
      <input
        id="cajaju-input-clave"
        type="text"
        placeholder="Identificador (ej. ini.tienda)"
        autocomplete="off"
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:0.95rem;margin-bottom:10px;"
      />
      <button
        id="cajaju-btn-activar"
        type="button"
        style="width:100%;padding:10px 14px;border:none;border-radius:8px;background:#1e3a8a;color:#ffffff;font-weight:600;cursor:pointer;font-size:0.95rem;"
      >
        Entrar a la tienda
      </button>
      <div id="cajaju-error-clave" style="color:#b91c1c;font-size:0.85rem;margin-top:8px;min-height:18px;"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = document.getElementById("cajaju-input-clave");
  const btn = document.getElementById("cajaju-btn-activar");
  const errorEl = document.getElementById("cajaju-error-clave");

  function validar() {
    const codigo = input.value.trim();
    if (codigo === CLAVE_ACTIVACION) {
      localStorage.setItem(LLAVE_ACTIVADO, "true");
      overlay.remove();
    } else {
      errorEl.textContent = "Identificador no reconocido. Verifica e inténtalo de nuevo.";
    }
  }

  btn.addEventListener("click", validar);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") validar();
  });
  input.focus();
}

function configurarBloqueoEnPrimerBoton() {
  if (interceptadorBotonConfigurado) return;
  interceptadorBotonConfigurado = true;

  document.addEventListener(
    "click",
    (e) => {
      if (localStorage.getItem(LLAVE_ACTIVADO) === "true") return;

      const boton = e.target.closest("button");
      if (!boton) return;
      if (boton.closest("#cajaju-overlay-activacion")) return;

      e.preventDefault();
      e.stopPropagation();
      renderModalActivacionVisual();
    },
    true
  );
}

function pedirClave() {
  iniciarCajaJun();

  if (localStorage.getItem(LLAVE_ACTIVADO) !== "true") {
    configurarBloqueoEnPrimerBoton();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", pedirClave);
} else {
  pedirClave();
}