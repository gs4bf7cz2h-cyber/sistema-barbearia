# Registro: prevenção de tela branca

Data: 19/11/2026.

## Contexto e autorização

Um cliente relatou tela branca ao abrir no Safari do iPhone o link https://primegynbarbearia.netlify.app/ recebido pelo WhatsApp. A análise desse exemplo reproduziu falhas de armazenamento e dados locais incompletos que removiam a interface React. Também identificou sintaxe incompatível com iOS anterior a 13.4. Isso não identifica, por si só, o erro ocorrido naquele aparelho; não temos seus logs ou versão do iOS.

O usuário orientou guardar o diagnóstico, comparar com o projeto atual e implementar somente as proteções ausentes. O projeto conectado identificado foi `gs4bf7cz2h-cyber/sistema-barbearia`, revisão-base `948c4cd679a6216752e09bb6681bb62c029b996a`.

## Lacunas encontradas neste projeto

- `loadState` já capturava erros de JSON/getItem, mas o parâmetro padrão acessava `localStorage` antes do `try`. Um getter bloqueado escapava do tratamento.
- `saveState` não tratava recusa de armazenamento ou falta de espaço.
- JSON válido com coleções ausentes, de tipo incorreto ou contendo registros nulos podia quebrar a renderização.
- `?.` e `??` impediam a interpretação do módulo em versões antigas do Safari.
- Não havia recuperação visível quando o módulo não carregava.

## Proteções implementadas

- Leitura e escrita protegidas, inclusive ao resolver o objeto de armazenamento. Escrita retorna sucesso/falha sem lançar; o estado continua em memória na aba atual.
- Normalização de coleções e campos usados pela interface, preservando propriedades extras e arrays vazios válidos. A leitura não grava nem apaga o JSON original.
- Aviso na interface em caso de erro real de persistência; gravação malsucedida não exibe “Agendamento confirmado”.
- Identificadores alternativos quando `crypto.randomUUID` não estiver disponível.
- Remoção da sintaxe moderna citada. Os módulos foram analisados como ES2018; o carregador como ES5.
- HTML inicial com orientação para JavaScript desativado, status de carregamento e recuperação se o carregador ou seus módulos falharem.

## Validação

- `npm test` passou; `node test/store.test.js` confirmou 19 casos aprovados, incluindo as regras de negócio existentes.
- Verificação de sintaxe com Acorn: módulos aceitos em ES2018 e carregador em ES5.
- Nove cenários no Chromium automatizado, perfil móvel iPhone 13: acesso normal, método de leitura bloqueado, getter de armazenamento bloqueado, quota excedida, dados incompletos, carregador bloqueado, módulo bloqueado, erro de sintaxe induzido e ausência de `randomUUID`. Todos passaram.
- Os cenários de carregamento verificam mensagem de recuperação e confirmação desabilitada; os cenários de armazenamento verificam interface funcional e mensagem correta ao tentar salvar.

O perfil móvel do Chromium não equivale ao Safari. Não foi realizado teste em iPhone físico ou Safari antigo. Essas proteções tratam os cenários descritos, sem garantir ausência de todos os erros possíveis.

O sistema continua armazenando dados no navegador, conforme a arquitetura original. Esta alteração não adiciona sincronização entre dispositivos e não publica o site da Netlify usado como exemplo.
