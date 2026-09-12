# Golazo

Bot de Discord para coleção de cartas de futebol. TypeScript, Node.js 24, discord.js 14, PostgreSQL, Prisma 6 e Sharp. GitHub é a fonte do código; o ambiente de desenvolvimento recomendado é GitHub Codespaces.

## Codespaces

1. No repositório, abra **Code → Codespaces → Create codespace on main**.
2. O devcontainer inicia Node 24 e PostgreSQL 17 e executa instalação, geração do Prisma Client, migrações, verificações e smoke test. A primeira inicialização pode levar alguns minutos.
3. Configure `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` e `DISCORD_GUILD_ID` como **Codespaces secrets**, com acesso a este repositório, nas configurações da sua conta GitHub. Reinicie o Codespace depois de adicionar secrets. Alternativamente, preencha o `.env` local, ignorado pelo Git.
4. Execute:

```bash
npm run commands:register
npm run dev
```

O banco no devcontainer usa o host `postgres`, configurado pelo Docker Compose. A variável de ambiente tem prioridade sobre o `.env`. Não é necessário editar a URL para usar o Codespace.

O bot só está conectado depois da mensagem **Golazo online**. Experimente `/ping`, `/perfil` e `/colecao`. No perfil, clique em **Editar bio** para testar button e modal. Na coleção, use o seletor de raridade; os botões de paginação são habilitados quando houver mais de dez cartas. O autocomplete da opção `jogador` pesquisa jogadores que você possui.

A coleção inicial é vazia. Não existe comando público que gere cartas ou moedas. `npm run db:seed` adiciona somente um jogador fictício e uma carta ao catálogo. Para testar inventário manualmente, use `npm run db:studio` e crie registros UserCard relacionando o usuário e a carta de demonstração. Não use o seed como catálogo de jogadores reais.

O Codespaces é um ambiente de desenvolvimento: quando ele suspende ou fecha, o bot para. Para disponibilidade contínua, use um processo persistente no Railway ou outro servidor.

## Discord

Crie uma aplicação e um bot no Discord Developer Portal. Copie o **Application ID** para `DISCORD_CLIENT_ID` e o ID do servidor de testes para `DISCORD_GUILD_ID`. Convide o bot com os escopos `bot` e `applications.commands` e permissões de visualizar canais, enviar mensagens, incorporar links e anexar arquivos. O código usa apenas o intent `Guilds`; não requer Message Content ou outros intents privilegiados.

Tokens que foram compartilhados devem ser redefinidos antes de usar. Nunca coloque tokens no código, commits, screenshots ou mensagens. O projeto não inclui credenciais.

`npm run commands:register` substitui os comandos do aplicativo no servidor informado. Para publicar comandos globais explicitamente:

```bash
npm run commands:register -- --global
```

Use uma aplicação exclusiva do Golazo: o registro substitui a lista de comandos daquele aplicativo no escopo selecionado. Comandos de servidor e globais são escopos independentes. O registro não acontece automaticamente no startup. Para conferir os payloads sem autenticação: `npm run commands:check`.

## Fora do Codespaces

Requisitos: Node **24.17 ou superior na linha 24**, npm e PostgreSQL. Docker Compose é opcional, mas facilita iniciar o banco. Em Linux, instale OpenSSL e fontes DejaVu para Prisma/Sharp se ainda não estiverem disponíveis.

```bash
cp .env.example .env
npm ci
docker compose up -d postgres
npm run db:generate
npm run db:deploy
npm run check
npm run smoke
npm run commands:register
npm run dev
```

Preencha as variáveis Discord no `.env` antes dos dois últimos comandos. Se usar PostgreSQL externo, configure `DATABASE_URL` e dispense o comando Docker. Para produção:

```bash
npm ci
npm run build
npm run db:deploy
npm start
```

`db:deploy` aplica as migrações versionadas sem apagar dados. Para alterar o esquema durante desenvolvimento: `npm run db:migrate -- --name nome_da_mudanca`; revise e versione a migração gerada. Nunca use reset em produção. Faça backup antes de migrações de produção.

## Variáveis

| Nome                | Uso                                                                            |
| ------------------- | ------------------------------------------------------------------------------ |
| `DISCORD_TOKEN`     | Token privado do bot, necessário para login/registro                           |
| `DISCORD_CLIENT_ID` | Application ID, necessário para startup/registro                               |
| `DISCORD_GUILD_ID`  | Servidor de teste; obrigatório no registro sem `--global`                      |
| `DATABASE_URL`      | URL PostgreSQL; obrigatória no startup e tarefas de banco                      |
| `REDIS_URL`         | Opcional; vazio usa cache local em memória                                     |
| `NODE_ENV`          | `development`, `test` ou `production`                                          |
| `LOG_LEVEL`         | `info` por padrão; também `debug`, `warn`, `error`, `fatal`, `trace`, `silent` |
| `TEST_DATABASE_URL` | Banco separado, descartável, habilita testes de integração                     |

O Redis não armazena inventário nem saldo. O PostgreSQL é a autoridade desses dados. Quando `REDIS_URL` é informado, a falha inicial de conexão aborta o startup para expor configuração incorreta. Sem a variável, Redis não é necessário. Cache em memória tem TTL, limite de entradas e escopo de um processo; não serve como trava distribuída.

Para desenvolver com Redis: `docker compose --profile redis up -d`. Fora do container use `redis://localhost:6379`; dentro do devcontainer use `redis://redis:6379`. Nunca exponha Redis publicamente sem proteção.

## Organização

| Caminho                  | Responsabilidade                                                      |
| ------------------------ | --------------------------------------------------------------------- |
| `src/config`             | Leitura e validação do ambiente com Zod                               |
| `src/core`               | Contratos de handlers, descoberta recursiva, roteamento, erros e logs |
| `src/handlers/commands`  | Slash commands e seus autocompletes                                   |
| `src/handlers/events`    | Eventos do Discord                                                    |
| `src/handlers/buttons`   | Componentes button                                                    |
| `src/handlers/selects`   | Select menus                                                          |
| `src/handlers/modals`    | Submissões de formulários                                             |
| `src/modules/users`      | Perfil e criação idempotente do usuário                               |
| `src/modules/collection` | Consulta, filtros e apresentação do inventário                        |
| `src/infrastructure`     | PostgreSQL e adaptadores de cache                                     |
| `src/images`             | Composição de imagens com Sharp e SVG                                 |
| `src/scripts`            | Registro, smoke test e preview de carta                               |
| `prisma`                 | Esquema, migrações e seed fictício                                    |
| `tests`                  | Testes de unidade, roteamento e PostgreSQL                            |

Adicione handlers `.ts` com `export default` na pasta apropriada, usando `satisfies Command`, `Button`, `Select`, `Modal` ou `Event<typeof Events.Nome>`. Não coloque arquivos utilitários nessas pastas, pois todos os módulos são carregados. Subpastas são descobertas recursivamente. Nomes de comando e IDs de componente duplicados impedem a inicialização.

Components são roteados pelo prefixo antes do primeiro `:` em `customId`. Argumentos recebidos continuam sendo entrada não confiável: valide valores, usuário e permissões antes de mutações. O filtro/paginação da coleção valida o dono. Handlers devem reconhecer a interação rapidamente com reply, deferReply, deferUpdate ou showModal; consultas de banco de comandos já usam defer. Autocomplete responde diretamente, com limite de 25 opções.

O build mantém a estrutura de pastas e carrega `.js` em produção. `npm run dev` carrega `.ts` via tsx. Erros recebem referência nos logs e na resposta. Mensagens internas de exceções são omitidas dos logs para evitar vazamento de credenciais; procure pelo tipo, referência e etapa. Exceções de startup encerram com código 1. SIGTERM/SIGINT desconectam Discord, Prisma e cache.

## Imagens

```bash
npm run card:preview
```

Cria `output/card-preview.png` (600 × 840) em roxo galático. `renderCard()` aceita metadados e buffers opcionais de retrato e overlay. Faz resize, composição e rasterização com Sharp; texto variável é escapado antes de entrar no SVG. Há limite de pixels de entrada. URLs externas não são baixadas pelo renderizador. Valide origem, tamanho e direitos de uso de futuros assets em uma camada separada.

## Testes

```bash
npm run check
npm run commands:check
npm run smoke
```

`check` executa TypeScript, ESLint, Prettier, Vitest e build. O smoke exige banco migrado e verifica acesso à tabela de usuários, carregamento de handlers, cache e Sharp sem logar no Discord.

Os testes PostgreSQL ficam desabilitados sem `TEST_DATABASE_URL`. Para executá-los, crie um banco **separado**, aplique as migrações nele e defina a variável:

```bash
DATABASE_URL=postgresql://golazo:golazo@localhost:5432/golazo_test npm run db:deploy
TEST_DATABASE_URL=postgresql://golazo:golazo@localhost:5432/golazo_test npm run test:integration
```

Eles criam dados identificados aleatoriamente e limpam os registros criados. Verificam concorrência na criação de usuário, cópias individuais, paginação, filtro e isolamento. A CI usa um PostgreSQL descartável e roda esses testes junto com check e smoke. Testes de handlers usam interações simuladas; eles não comprovam autenticação, permissões ou respostas em um servidor real do Discord.

## Railway e outros hosts

O `Dockerfile` executa um processo Node persistente, independente do provedor. `railway.json` seleciona Docker, aplica migrações na etapa anterior ao deploy e inicia o bot. Para um futuro deploy no Railway:

1. Conecte este repositório a um serviço.
2. Adicione PostgreSQL e configure a referência de `DATABASE_URL` no serviço do bot.
3. Configure `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` e opcionalmente `REDIS_URL` nas variáveis do serviço.
4. Registre os comandos separadamente, no escopo desejado, e faça deploy.

Não é preciso domínio público, porta HTTP ou webhook para este bot: ele usa a conexão Gateway de saída. Mantenha **uma réplica** nesta fase. Não há sharding nem coordenação entre instâncias. O Docker inclui a CLI do Prisma para migrações. Nenhum deploy foi realizado automaticamente.

## Evolução

O banco separa Player (identidade), Card (edição/raridade/temporada) e UserCard (cópia individual com proprietário, origem e bloqueio). User possui saldo inteiro em BigInt, com restrição de não negatividade no PostgreSQL. O rating também possui restrição no banco. Relações impedem remoção de cartas/jogadores que ainda possuem referências.

Veja [docs/architecture.md](docs/architecture.md) para as próximas etapas de packs, mercado, trocas, moedas e eventos. Esses sistemas não estão implementados nesta base.
