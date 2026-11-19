import test from 'node:test';import assert from 'node:assert/strict';
import{CONFIG,addAppointment,addBlock,availableSlots,cancelAppointment,createInitialState,loadState,saveState,updateAppointment,removeService,upsertService,whatsappUrl}from'../src/store.js';
test('cria agendamento e impede conflito no mesmo horário',()=>{const state=createInitialState();const a=addAppointment(state,{serviceId:'corte',date:'2026-09-01',time:'09:00',name:'Ana',phone:'119'});assert.equal(a.status,'confirmado');assert.throws(()=>addAppointment(state,{serviceId:'barba',date:'2026-09-01',time:'09:00',name:'Bia',phone:'118'}),/ocupado/);assert(!availableSlots(state,'2026-09-01').includes('09:00'));});
test('cancela e libera horário',()=>{const state=createInitialState();const a=addAppointment(state,{serviceId:'corte',date:'2026-09-01',time:'10:00',name:'Ana',phone:'119'});cancelAppointment(state,a.id);assert.equal(a.status,'cancelado');assert(availableSlots(state,'2026-09-01').includes('10:00'));});
test('altera agendamento respeitando conflito e bloqueio',()=>{const state=createInitialState();const a=addAppointment(state,{serviceId:'corte',date:'2026-09-01',time:'11:00',name:'Ana',phone:'119'});addAppointment(state,{serviceId:'barba',date:'2026-09-01',time:'11:30',name:'Bia',phone:'118'});assert.throws(()=>updateAppointment(state,a.id,{time:'11:30'}),/ocupado/);addBlock(state,{date:'2026-09-01',time:'12:00'});assert.throws(()=>updateAppointment(state,a.id,{time:'12:00'}),/bloqueado/);updateAppointment(state,a.id,{time:'12:30'});assert.equal(a.time,'12:30');});
test('cadastra serviço e altera preço',()=>{const state=createInitialState();const s=upsertService(state,{name:'Sobrancelha',price:25});assert.equal(s.id,'sobrancelha');upsertService(state,{id:s.id,name:'Sobrancelha',price:30});assert.equal(state.services.find(x=>x.id===s.id).price,30);});
test('bloqueia horário e dia inteiro',()=>{const state=createInitialState();addBlock(state,{date:'2026-09-02',time:'09:00'});assert(!availableSlots(state,'2026-09-02').includes('09:00'));addBlock(state,{date:'2026-09-03'});assert.equal(availableSlots(state,'2026-09-03').length,0);});
test('gera link funcional do WhatsApp com mensagem preenchida',()=>{const url=whatsappUrl({name:'Carlos',serviceName:'Corte',date:'2026-09-01',time:'09:00'},'551188887777');assert(url.startsWith('https://wa.me/551188887777?text='));const text=decodeURIComponent(url.split('text=')[1]);assert.match(text,/Carlos/);assert.match(text,/Corte/);assert.match(text,/2026-09-01/);assert.match(text,/09:00/);});

test('remove serviço somente quando não há agendamentos ativos',()=>{const state=createInitialState();const s=upsertService(state,{name:'Sobrancelha',price:25});removeService(state,s.id);assert.equal(state.services.some(x=>x.id===s.id),false);const active=addAppointment(state,{serviceId:'corte',date:'2026-09-04',time:'09:00',name:'Ana',phone:'119'});assert.throws(()=>removeService(state,'corte'),/agendamentos/);cancelAppointment(state,active.id);removeService(state,'corte');assert.equal(state.services.some(x=>x.id==='corte'),false);});

test('impede bloqueio duplicado',()=>{const state=createInitialState();addBlock(state,{date:'2026-09-05',time:'09:00'});assert.throws(()=>addBlock(state,{date:'2026-09-05',time:'09:00'}),/já existe/);});

function withGlobalProperty(name, descriptor, run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, Object.assign({ configurable: true }, descriptor));
  try {
    run();
  } finally {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else delete globalThis[name];
  }
}

function storageWith(value) {
  return {
    writes: [],
    getItem(key) {
      assert.equal(key, CONFIG.storageKey);
      return value;
    },
    setItem(key, saved) {
      this.writes.push([key, saved]);
    },
  };
}

test('estado inicial não compartilha objetos de serviços entre sessões', () => {
  const first = createInitialState();
  first.services[0].price = 999;
  assert.equal(createInitialState().services[0].price, 40);
});

test('leitura e gravação sobrevivem ao getter global de localStorage bloqueado', () => {
  const denied = Object.assign(new Error('Storage denied'), { name: 'SecurityError' });
  withGlobalProperty('localStorage', { get() { throw denied; } }, () => {
    const errors = [];
    assert.deepEqual(loadState(undefined, (error) => errors.push(error)), createInitialState());
    assert.deepEqual(errors, [denied]);
    assert.equal(saveState(createInitialState()), false);
    assert.doesNotThrow(() => loadState(undefined, () => { throw new Error('warning failed'); }));
  });
});

test('leitura sobrevive a getItem bloqueado e informa o erro', () => {
  const denied = new Error('getItem denied');
  for (const storage of [
    { getItem() { throw denied; } },
    { get getItem() { throw denied; } },
  ]) {
    const errors = [];
    assert.deepEqual(loadState(storage, (error) => errors.push(error)), createInitialState());
    assert.deepEqual(errors, [denied]);
  }
});

test('gravação retorna false para quota excedida ou setItem bloqueado e mantém estado em memória', () => {
  const quota = Object.assign(new Error('Quota exceeded'), { name: 'QuotaExceededError' });
  const state = createInitialState();
  const appointment = addAppointment(state, { serviceId: 'corte', date: '2026-09-06', time: '09:00', name: 'Ana', phone: '119' });
  for (const storage of [
    { setItem() { throw quota; } },
    { get setItem() { throw new Error('Storage denied'); } },
  ]) {
    assert.equal(saveState(state, storage), false);
    assert.equal(state.appointments[0], appointment);
    assert(!availableSlots(state, appointment.date).includes(appointment.time));
  }
});

test('gravação bem-sucedida retorna true e persiste o estado exato', () => {
  const storage = storageWith(null);
  const state = createInitialState();
  assert.equal(saveState(state, storage), true);
  assert.deepEqual(storage.writes, [[CONFIG.storageKey, JSON.stringify(state)]]);
  const circular = {};
  circular.self = circular;
  assert.equal(saveState(circular, storage), false);
  assert.equal(storage.writes.length, 1);
});

test('JSON inválido tem fallback sem sobrescrever o valor original', () => {
  const storage = storageWith('{invalid');
  const errors = [];
  assert.deepEqual(loadState(storage, (error) => errors.push(error)), createInitialState());
  assert.equal(errors.length, 1);
  assert(errors[0] instanceof SyntaxError);
  assert.deepEqual(storage.writes, []);
  assert.equal(storage.getItem(CONFIG.storageKey), '{invalid');
});

test('raízes e coleções inválidas recebem defaults, preservando extras e listas vazias', () => {
  for (const value of [null, [], false, 12, 'texto']) {
    assert.deepEqual(loadState(storageWith(JSON.stringify(value))), createInitialState());
  }
  const incomplete = { services: null, appointments: {}, blocks: 'bad', custom: { version: 2 } };
  const storage = storageWith(JSON.stringify(incomplete));
  const state = loadState(storage);
  assert.deepEqual(state.services, createInitialState().services);
  assert.deepEqual(state.appointments, []);
  assert.deepEqual(state.blocks, []);
  assert.deepEqual(state.custom, incomplete.custom);
  assert.deepEqual(storage.writes, []);

  const empty = { services: [], appointments: [], blocks: [] };
  assert.deepEqual(loadState(storageWith(JSON.stringify(empty))), empty);
});

test('registros incompletos são normalizados para renderizar e aplicar regras sem alterar o JSON salvo', () => {
  const data = {
    services: [null, [], 1, { id: 'corte', name: 'Corte', price: '40', custom: 'keep' }],
    appointments: [null, false, { serviceId: 'corte', date: '2026-09-07', time: '10:00', name: null, phone: {}, custom: 7 }],
    blocks: [null, 'invalid', { date: '2026-09-07', time: null, reason: ['bad'], custom: 8 }],
  };
  const json = JSON.stringify(data);
  const storage = storageWith(json);
  const state = loadState(storage);
  assert.equal(state.services.length, 1);
  assert.equal(state.services[0].price, 40);
  assert.equal(state.services[0].custom, 'keep');
  assert.equal(state.appointments.length, 1);
  const appointment = state.appointments[0];
  assert.equal(typeof appointment.id, 'string');
  assert.equal(appointment.serviceName, 'Corte');
  assert.equal(appointment.name, '');
  assert.equal(appointment.phone, '');
  assert.equal(appointment.status, 'confirmado');
  assert.equal(appointment.custom, 7);
  assert.equal(state.blocks.length, 1);
  assert.equal(state.blocks[0].time, '');
  assert.equal(state.blocks[0].reason, '');
  assert.equal(state.blocks[0].custom, 8);
  assert.equal(availableSlots(state, '2026-09-07').length, 0);
  assert.doesNotThrow(() => state.appointments.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
  assert.deepEqual(storage.writes, []);
  assert.equal(storage.getItem(CONFIG.storageKey), json);
});

test('preserva registros válidos, cancelamentos, preços zero e propriedades extras', () => {
  const data = {
    services: [{ id: 's', name: 'Serviço grátis', price: 0, duration: 30 }],
    appointments: [{ id: 'a', serviceId: 's', serviceName: 'Serviço grátis', price: 0, date: '2026-09-08', time: '09:00', name: 'Ana', phone: '119', status: 'cancelado', createdAt: '2026-08-01', notes: 'keep' }],
    blocks: [{ id: 'b', date: '2026-09-08', time: '10:00', reason: 'Pausa', notes: 'keep' }],
    version: 2,
  };
  assert.deepEqual(loadState(storageWith(JSON.stringify(data))), data);
});

test('IDs funcionam sem crypto e sem randomUUID, mesmo com timestamp idêntico', () => {
  const previousNow = Date.now;
  const ids = [];
  Date.now = () => 1000;
  try {
    for (const provider of [undefined, {}, { randomUUID() { throw new Error('Unavailable'); } }]) {
      withGlobalProperty('crypto', { value: provider }, () => {
        const state = createInitialState();
        ids.push(addAppointment(state, { serviceId: 'corte', date: '2026-09-09', time: '09:00', name: 'Ana', phone: '119' }).id);
        ids.push(addBlock(state, { date: '2026-09-10' }).id);
      });
    }
  } finally {
    Date.now = previousNow;
  }
  assert.equal(new Set(ids).size, ids.length);
  assert(ids.every((id) => typeof id === 'string' && id.length > 0));
});

test('usa randomUUID quando disponível', () => {
  withGlobalProperty('crypto', { value: { randomUUID() { return 'native-uuid'; } } }, () => {
    assert.equal(addBlock(createInitialState(), { date: '2026-09-11' }).id, 'native-uuid');
  });
});
