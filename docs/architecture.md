# Decisões e próximos módulos

## Base

A camada Discord traduz interações para funções de domínio em `modules`. Prisma é usado diretamente nessas funções, sem uma camada genérica de repositórios. Dependências são injetadas pelo contexto. Renderização recebe buffers/metadados e não conhece Discord ou banco.

Cada UserCard representa uma cópia, inclusive cartas repetidas. O proprietário fica na cópia, e o catálogo Card descreve uma edição do Player. Season é opcional em Card. As raridades iniciais são COMMON, RARE, EPIC e LEGENDARY. Alterar o enum exige migração.

## Evolução prevista

| Módulo futuro     | Implementação necessária                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `modules/packs`   | Catálogo de packs, probabilidades versionadas, sorteio no servidor e abertura idempotente em transação       |
| `modules/wallet`  | Ledger de entradas/saídas com chave idempotente; alteração de saldo e concessão de cartas na mesma transação |
| `modules/market`  | Ofertas com estado, reserva de cópias e liquidação atômica entre comprador e vendedor                        |
| `modules/trades`  | Proposta, confirmação dos participantes, expiração, revalidação de propriedade e transferência atômica       |
| `modules/seasons` | Ativação, encerramento, recompensas idempotentes e associação de edições                                     |
| `modules/events`  | Regras com janela de tempo e recompensas auditáveis; separado dos eventos do Discord                         |
| `modules/players` | Importação de fonte licenciada, IDs externos e atualização controlada de metadados                           |

`locked` em UserCard é apenas um campo preparado: não implementa reserva nem substitui lock transacional. Mercado/trocas precisam garantir propriedade e saldo no banco no momento da confirmação. Não implemente essas operações por sequência de consultas independentes. Redis pode servir ao cache e a filas, mas não deve ser autoridade de propriedade/saldo.

Geração de imagens é síncrona por chamada nesta base. Antes de colocar geração pesada em comandos populares, crie fila com concorrência limitada e cache de arquivos por versão dos assets. Os retratos/overlays devem vir de fontes autorizadas; o renderizador não faz fetch de URLs fornecidas por usuários.

Redis configurado usa namespace `golazo:`; sem Redis há cache de memória limitado a 1000 entradas. A base não depende do cache para correção de operações econômicas. Não há implementação econômica além do campo de saldo inicial zero.

## Limites desta etapa

Não inclui packs, distribuição pública de cartas, sorteio de jogadores reais, marketplace, trocas, pagamentos, cron de temporadas ou deploy. A autenticação ao Discord exige um token válido externo ao repositório. Verificações automatizadas não substituem testar comandos no servidor de desenvolvimento.
