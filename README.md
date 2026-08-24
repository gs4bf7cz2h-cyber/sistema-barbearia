# Sistema da Barbearia

Sistema funcional de agendamento para barbearia, feito com HTML, CSS e JavaScript puro. A aplicação é responsiva, pensada primeiro para celular/iPhone, e salva os dados no `localStorage` do navegador.

## Tecnologia usada

- `index.html`: estrutura das telas de cliente e administração.
- `src/styles.css`: visual responsivo e mobile-first.
- `src/store.js`: regras de negócio, serviços, horários, bloqueios, conflitos e WhatsApp.
- `src/app.js`: integração da interface com as regras e persistência local.
- `node --test`: testes automatizados das funções principais.

## Como executar

```bash
npm start
```

Depois abra `http://localhost:5173` no navegador.

## Configurações

As configurações principais ficam em `src/store.js`, no objeto `CONFIG`:

- `businessPhone`: telefone da barbearia para o WhatsApp, em formato internacional sem `+`, espaços ou traços. Exemplo: `5511999999999`.
- `slotStart`: início dos horários disponíveis.
- `slotEnd`: fim do expediente.
- `slotMinutes`: intervalo entre horários.
- `storageKey`: chave usada no `localStorage`.

## Como alterar serviços e preços

Pelo sistema, acesse a área **Administração > Serviços**, cadastre um novo serviço ou clique em **Editar** em um serviço existente.

Os serviços iniciais estão em `src/store.js`:

- Corte — R$ 40
- Barba — R$ 40
- Corte + Barba — R$ 80

## Publicação

Este projeto é estático. Pode ser publicado em qualquer hospedagem de arquivos estáticos, como Netlify, Vercel, GitHub Pages ou no próprio servidor da barbearia. Envie `index.html` e a pasta `src/` para a hospedagem.

> Observação: como os dados ficam no navegador, para uso com vários dispositivos ao mesmo tempo será necessário trocar o `localStorage` por um banco de dados/API. A estrutura de regras em `src/store.js` foi separada para facilitar essa evolução.
