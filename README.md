# TRICORD

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

O bot só está conectado depois da mensagem **TRICORD online**. Experimente `/ping`, `/perfil` e `/colecao`. No perfil, clique em **Editar bio** para testar button e modal. Na coleção, use o seletor de raridade; os botões de paginação são habilitados quando houver mais de dez cartas. O autocomplete da opção `jogador` pesquisa jogadores que você possui.

A coleção inicial é vazia. Não existe comando público que gere cartas ou moedas. `npm run db:seed` adiciona somente um jogador fictício e uma carta ao catálogo. Para testar inventário manualmente, use `npm run db:studio` e crie registros UserCard relacionando o usuário e a carta de demonstração. Não use o seed como catálogo de jogadores reais.

O Codespaces é um ambiente de desenvolvimento: quando ele suspende ou fecha, o bot para. Para disponibilidade contínua, use um processo persistente no Railway ou outro servidor.

## Discord

Crie uma aplicação e um bot no Discord Developer Portal. Copie o **Application ID** para `DISCORD_CLIENT_ID` e o ID do servidor de testes para `DISCORD_GUILD_ID`. Convide o bot com os escopos `bot` e `applications.commands` e permissões de visualizar canais, enviar mensagens, incorporar links e anexar arquivos. O código usa apenas o intent `Guilds`; não requer Message Content ou outros intents privilegiados.

Tokens que foram compartilhados devem ser redefinidos antes de usar. Nunca coloque tokens no código, commits, screenshots ou mensagens. O projeto não inclui credenciais.

`npm run commands:register` substitui os comandos do aplicativo no servidor informado. Para publicar comandos globais explicitamente:

```bash
npm run commands:register -- --global
```

Use uma aplicação exclusiva do TRICORD: o registro substitui a lista de comandos daquele aplicativo no escopo selecionado. Comandos de servidor e globais são escopos independentes. O registro não acontece automaticamente no startup. Para conferir os payloads sem autenticação: `npm run commands:check`.

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

Cria `output/card-preview.png` (600 × 840) em vermelho. `renderCard()` aceita metadados e buffers opcionais de retrato e overlay. Faz resize, composição e rasterização com Sharp; texto variável é escapado antes de entrar no SVG. Há limite de pixels de entrada. URLs externas não são baixadas pelo renderizador. Valide origem, tamanho e direitos de uso de futuros assets em uma camada separada.

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

## Alertas de gol e Brasileirão

Aplique a nova migração (`npm run db:deploy`), registre os comandos novamente (`npm run commands:register`) e reinicie o processo. Se já usa um Codespace, execute `git pull` antes; não é preciso recriar o ambiente.

- `/gols ligar`: acompanha São Paulo no Brasileirão neste canal por padrão.
- `/gols ligar competicao:… time:…`: escolha outro time via autocomplete para testar um jogo real. Selecionar competição antes do time atualiza o catálogo.
- `/gols desligar`: desativa neste canal e impede a entrega de alertas pendentes ainda não enviados. Uma mensagem já em envio pode chegar.
- `/gols status`: mostra configuração persistida no PostgreSQL.
- `/gols teste`: envia um exemplo **explicitamente simulado**, sem modificar o acompanhamento real.
- `/jogos`: lista jogos em andamento; se não houver, lista ontem/hoje/amanhã em UTC. Há seleção de competição.
- `/brasileirao`: classificação da Série A obtida da página da ESPN usando regex.

Para trocar de volta ao São Paulo, use `/gols ligar` sem opções. Cada canal possui uma configuração time/competição; canais diferentes podem acompanhar times diferentes. Para São Paulo em outra competição, selecione a competição correspondente. Não há detecção automática de todas as competições do clube. Gerenciar servidor é obrigatório para `/gols`, e o bot precisa visualizar/enviar mensagens no canal. Não usa @everyone, cargos ou menções automáticas.

`GOAL_POLL_SECONDS=60` define o intervalo entre ciclos (30–300 s), além do tempo de consulta. Há atraso da fonte e polling; não é transmissão instantânea. Consulta placares públicos da ESPN (interface não contratual, sujeita a indisponibilidade ou mudanças). Não depende de token esportivo, Redis ou automações do ChatGPT. O processo do bot precisa estar ligado.

Ao ligar, o placar atual vira baseline; gols anteriores não são anunciados. Só aumentos do placar do time escolhido disparam gol. Reduções de qualquer lado geram correção de placar/possível anulação. Pênaltis de desempate e autoria do gol não são acompanhados. Se a fonte saltar dois gols entre consultas, uma atualização informa o placar novo. Uma pausa superior a cinco minutos reestabelece o baseline, evitando gols antigos. Jogos novos sem snapshot começam no placar observado.

Configuração, snapshots e fila de alertas sobrevivem a reinícios. Entrega tenta até três vezes por no máximo cinco minutos, usando nonce estável do Discord contra duplicatas recentes. Isso não garante entrega exatamente uma vez em falhas prolongadas; monitore os logs. Use uma única réplica. Falhas de fonte preservam os placares, sem assumir placar zero. Dados auxiliares antigos são limpos automaticamente.

A tabela usa regex em table/tbody/tr/td, relaciona as duas tabelas HTML por data-idx e valida ordem das colunas, 20 clubes e consistência numérica. Cada `/brasileirao` consulta a fonte, reaproveitando cache de até 60 s. Se a fonte falhar, pode mostrar cópia de até uma hora **marcada como antiga**, com horário da consulta; sem cópia válida, informa indisponibilidade. Não é possível garantir que o site de origem atualize imediatamente. `npm run football:check` testa as fontes reais sem enviar mensagens ao Discord; não integra a CI para evitar depender da disponibilidade externa.

Fontes: https://www.espn.com.br/futebol/classificacao/_/liga/bra.1 e placares públicos em site.api.espn.com. Não há scraping com login ou contorno de bloqueios.

## Narração do TRICORD

A narração acompanha automaticamente o time/competição habilitado com `/gols ligar`. Não é necessário um comando novo. `/gols desligar` também pausa a narração, na próxima consulta.

Durante uma partida em andamento, uma única embed vermelha mostra placar, relógio e os cinco lances mais recentes da ESPN em português. O bot edita a mensagem apenas quando muda o conteúdo. Ele não inventa lances quando a fonte está indisponível. A tabela do GE e seu layout permanecem independentes da narração.

Quando um alerta de gol do time acompanhado (ou correção de placar) é entregue, o bot envia a embed vermelha do alerta, apaga a narração anterior e cria uma nova mensagem abaixo para os próximos lances. O alerta de gol permanece no canal. Gols do adversário continuam apenas atualizando o placar/narração, seguindo a configuração original dos alertas. Ao encerrar a partida, a narração fica marcada como encerrada.

O ID da mensagem e a rotação pendente ficam no PostgreSQL. Reiniciar o processo não cria uma mensagem por consulta. Uma mensagem removida manualmente é recriada; falhas de permissão não geram novas mensagens em série. O bot precisa de Ver canal, Enviar mensagens, Inserir links e Ler histórico de mensagens. Não precisa de Gerenciar mensagens para apagar mensagens próprias. O monitor continua limitado a uma réplica e ao intervalo GOAL_POLL_SECONDS.

Para aplicar esta atualização, pare o processo e execute:

```bash
git pull && npm run build && npm run db:deploy && npm run commands:register && npm run dev
```

A nova migração adiciona MatchNarration e o ID da partida aos alertas, sem apagar dados existentes. Os testes de narração usam PostgreSQL real com transporte Discord simulado e verificam edição, ordem envio/apagamento/recriação, deduplicação e recuperação de mensagem apagada.
