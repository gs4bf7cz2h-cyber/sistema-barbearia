export const CONFIG = {
  businessPhone: "5511999999999", // TODO: troque pelo WhatsApp da barbearia, com DDI e DDD.
  slotStart: "09:00",
  slotEnd: "18:00",
  slotMinutes: 30,
  storageKey: "barbearia.v1",
};

export const defaultServices = [
  { id: "corte", name: "Corte", price: 40 },
  { id: "barba", name: "Barba", price: 40 },
  { id: "corte-barba", name: "Corte + Barba", price: 80 },
];

export function createInitialState() {
  return { services: defaultServices.map((service) => Object.assign({}, service)), appointments: [], blocks: [] };
}

let fallbackIdCounter = 0;

function createId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch (error) {
    // Older browsers and restricted contexts can still create local records.
  }
  fallbackIdCounter += 1;
  return `local-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function recordId(value) {
  return typeof value === "string" && value ? value : createId();
}

function priceValue(value) {
  return (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) &&
    Number.isFinite(Number(value)) ? Number(value) : 0;
}

function normalizeState(value) {
  const initial = createInitialState();
  if (!isRecord(value)) return initial;

  const services = Array.isArray(value.services) ? value.services.filter(isRecord).map((service) =>
    Object.assign({}, service, {
      id: recordId(service.id),
      name: text(service.name),
      price: priceValue(service.price),
    })) : initial.services;

  const appointments = Array.isArray(value.appointments) ? value.appointments.filter(isRecord).map((appointment) => {
    const service = services.find((item) => item.id === appointment.serviceId);
    return Object.assign({}, appointment, {
      id: recordId(appointment.id),
      serviceId: text(appointment.serviceId),
      serviceName: text(appointment.serviceName, service ? service.name : ""),
      price: priceValue(appointment.price),
      date: text(appointment.date),
      time: text(appointment.time),
      name: text(appointment.name),
      phone: text(appointment.phone),
      status: text(appointment.status, "confirmado"),
    });
  }) : initial.appointments;

  const blocks = Array.isArray(value.blocks) ? value.blocks.filter(isRecord).map((block) =>
    Object.assign({}, block, {
      id: recordId(block.id),
      date: text(block.date),
      time: text(block.time),
      reason: text(block.reason),
    })) : initial.blocks;

  return Object.assign({}, value, { services, appointments, blocks });
}

export function createSlots(cfg = CONFIG) {
  const slots = [];
  let [h, m] = cfg.slotStart.split(":").map(Number);
  const [eh, em] = cfg.slotEnd.split(":").map(Number);
  const end = eh * 60 + em;

  while (h * 60 + m < end) {
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    m += cfg.slotMinutes;
    h += Math.floor(m / 60);
    m %= 60;
  }

  return slots;
}

export function loadState(storage, onError) {
  try {
    const target = storage === undefined ? localStorage : storage;
    return normalizeState(JSON.parse(target.getItem(CONFIG.storageKey)));
  } catch (error) {
    if (typeof onError === "function") {
      try {
        onError(error);
      } catch (callbackError) {
        // A warning handler must not prevent the page from opening.
      }
    }
    return createInitialState();
  }
}

export function saveState(state, storage) {
  try {
    const target = storage === undefined ? localStorage : storage;
    target.setItem(CONFIG.storageKey, JSON.stringify(state));
    return true;
  } catch (error) {
    return false;
  }
}

export function isBlocked(state, date, time) {
  return state.blocks.some((b) => b.date === date && (b.time === "" || b.time === time));
}

export function isOccupied(state, date, time, ignoreId = null) {
  return state.appointments.some(
    (a) => a.date === date && a.time === time && a.status !== "cancelado" && a.id !== ignoreId,
  );
}

export function availableSlots(state, date, ignoreId = null) {
  if (!date) return [];
  return createSlots().filter((t) => !isBlocked(state, date, t) && !isOccupied(state, date, t, ignoreId));
}

export function addAppointment(state, input) {
  if (!input.serviceId || !input.date || !input.time || !input.name || !input.phone) {
    throw new Error("Preencha todos os dados.");
  }

  if (isBlocked(state, input.date, input.time)) throw new Error("Horário bloqueado.");
  if (isOccupied(state, input.date, input.time)) throw new Error("Horário já ocupado.");

  const service = state.services.find((s) => s.id === input.serviceId);
  if (!service) throw new Error("Serviço inválido.");

  const appt = {
    id: createId(),
    serviceId: service.id,
    serviceName: service.name,
    price: service.price,
    date: input.date,
    time: input.time,
    name: input.name.trim(),
    phone: input.phone.trim(),
    status: "confirmado",
    createdAt: new Date().toISOString(),
  };

  state.appointments.push(appt);
  return appt;
}

export function cancelAppointment(state, id) {
  const appointment = state.appointments.find((x) => x.id === id);
  if (!appointment) throw new Error("Agendamento não encontrado.");
  appointment.status = "cancelado";
  return appointment;
}

export function updateAppointment(state, id, changes) {
  const appointment = state.appointments.find((x) => x.id === id);
  if (!appointment) throw new Error("Agendamento não encontrado.");
  if (appointment.status === "cancelado") throw new Error("Agendamento cancelado não pode ser alterado.");

  const date = changes.date === null || changes.date === undefined ? appointment.date : changes.date;
  const time = changes.time === null || changes.time === undefined ? appointment.time : changes.time;

  if (isBlocked(state, date, time)) throw new Error("Horário bloqueado.");
  if (isOccupied(state, date, time, id)) throw new Error("Horário já ocupado.");

  Object.assign(appointment, changes, { date, time });
  return appointment;
}

export function serviceSlug(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function upsertService(state, { id, name, price }) {
  if (!name || price === "" || Number(price) < 0) throw new Error("Informe serviço e preço.");

  const data = {
    id: id || serviceSlug(name),
    name: name.trim(),
    price: Number(price),
  };

  if (!data.id) throw new Error("Nome de serviço inválido.");

  const duplicate = state.services.find((s) => s.id === data.id && s.name !== data.name && !id);
  if (duplicate) throw new Error("Já existe um serviço com esse identificador.");

  const index = state.services.findIndex((s) => s.id === data.id);
  index >= 0 ? state.services.splice(index, 1, data) : state.services.push(data);
  return data;
}

export function removeService(state, id) {
  const serviceExists = state.services.some((s) => s.id === id);
  if (!serviceExists) throw new Error("Serviço não encontrado.");

  const hasFutureAppointments = state.appointments.some((a) => a.serviceId === id && a.status !== "cancelado");
  if (hasFutureAppointments) {
    throw new Error("Cancele ou altere os agendamentos desse serviço antes de removê-lo.");
  }

  state.services = state.services.filter((s) => s.id !== id);
}

export function addBlock(state, { date, time = "", reason = "" }) {
  if (!date) throw new Error("Informe o dia.");
  if (state.blocks.some((b) => b.date === date && b.time === time)) throw new Error("Esse bloqueio já existe.");

  const block = {
    id: createId(),
    date,
    time,
    reason: reason.trim(),
  };

  state.blocks.push(block);
  return block;
}

export function removeBlock(state, id) {
  state.blocks = state.blocks.filter((b) => b.id !== id);
}

export function whatsappUrl(appt, phone = CONFIG.businessPhone) {
  const msg = `Olá! Confirmo meu agendamento: Nome: ${appt.name}, Serviço: ${appt.serviceName}, Data: ${appt.date}, Horário: ${appt.time}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}
