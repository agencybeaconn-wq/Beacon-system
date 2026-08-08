/**
 * Conteúdo das páginas de serviço.
 *
 * Por que elas existem: uma página só não ranqueia para termo disputado. O Google
 * prefere quem tem uma página inteira dedicada ao que a pessoa procurou. Cada uma
 * daqui mira um conjunto de buscas e tem texto de verdade, não recheio.
 *
 * O mesmo conteúdo alimenta o pré-render (scripts/seo-prerender.mjs), então o robô
 * recebe esse texto já pronto no HTML, sem depender de executar JavaScript.
 */

export type Bloco = { titulo: string; itens: string[] };

export type Servico = {
    slug: string;
    /** <title> da aba e do resultado de busca */
    title: string;
    /** meta description */
    descricao: string;
    etiqueta: string;
    h1: string;
    /** parágrafos de abertura */
    abertura: string[];
    blocos: Bloco[];
    /** "pra quem é" */
    publico: string[];
    perguntas: { q: string; a: string }[];
    cta: string;
    wa: string;
};

export const SERVICOS: Servico[] = [
    {
        slug: 'criacao-de-sites',
        title: 'Criação de Sites e Lojas Virtuais sob medida | NODE',
        descricao: 'Criação de loja virtual, landing page e site institucional sob medida. Shopify, WooCommerce, VTEX e NuvemShop, do catálogo ao checkout, com entrega em dias.',
        etiqueta: '// frente 01',
        h1: 'Criação de sites e lojas virtuais sob medida',
        abertura: [
            'A NODE constrói loja virtual, landing page e site institucional partindo do que o seu negócio precisa vender, e não de um layout pronto adaptado às pressas. Cada projeto nasce do produto, do público e da operação de quem vai usar.',
            'Trabalhamos com Shopify, WooCommerce, VTEX e NuvemShop no e-commerce, e com stack própria quando o projeto pede algo fora da prateleira. O código e os acessos ficam com você no final: a loja é sua, não nossa.',
            'Nascemos dentro da operação de e-commerce. Geramos mais de R$25 milhões nas nossas próprias lojas antes de entregar isso para clientes, então cada decisão de estrutura e de página carrega o que aprendemos vendendo de verdade.',
        ],
        blocos: [
            {
                titulo: 'O que entra no projeto',
                itens: [
                    'Loja virtual completa, com catálogo, variações, frete e formas de pagamento configuradas',
                    'Checkout transparente quando faz sentido para o seu volume e a sua margem',
                    'Landing page de campanha, desenhada para uma única ação e medida desde o primeiro dia',
                    'Site institucional e portfólio com identidade autoral, sem tema reaproveitado de terceiro',
                    'Design do zero, feito para a sua marca e não para o catálogo de temas',
                    'Pixel, GA4 e eventos instalados e testados antes de a loja ir ao ar',
                    'Migração de catálogo quando você já vende em outra plataforma',
                ],
            },
            {
                titulo: 'Como funciona na prática',
                itens: [
                    'Começamos entendendo produto, margem e público. Sem isso, qualquer layout é chute',
                    'Definimos a estrutura de páginas e a jornada até a compra antes de desenhar qualquer tela',
                    'Cada seção da página existe por um motivo ligado à venda, e você sabe qual é',
                    'Construímos em ciclos curtos, com você acompanhando desde cedo em vez de ver só no final',
                    'Antes de publicar, testamos o rastreamento de verdade: um pedido de teste tem que aparecer inteiro',
                    'Depois do lançamento seguimos junto na operação, ajustando com base no que os dados mostram',
                ],
            },
        ],
        publico: [
            'Quem vende hoje no Instagram ou no WhatsApp e precisa de uma loja de verdade para escalar',
            'Quem já tem loja mas ela não converte, é lenta, ou depende de um fornecedor que sumiu',
            'Quem vai lançar produto e precisa de landing page pronta para receber tráfego pago',
            'Quem quer sair de um tema genérico e ter identidade própria na vitrine',
        ],
        perguntas: [
            { q: 'Em quanto tempo a loja fica pronta?', a: 'Depende do tamanho do catálogo e do escopo, mas lojas e sites completos costumam sair em dias, não em meses. O prazo fechado você recebe no alinhamento, antes de começar.' },
            { q: 'Em qual plataforma vocês trabalham?', a: 'Shopify, WooCommerce, VTEX e NuvemShop. A escolha depende do seu volume, da sua operação e de quem vai tocar a loja no dia a dia. A gente recomenda com base no seu caso, não por preferência nossa.' },
            { q: 'O código e a loja ficam comigo?', a: 'Sim. Você recebe todos os acessos e a documentação no fim do projeto. Não trabalhamos com dependência eterna nem prendemos cliente por falta de acesso.' },
            { q: 'Vocês migram uma loja que já existe?', a: 'Sim, incluindo catálogo, clientes e histórico quando a plataforma de origem permite. A migração é planejada para não derrubar as vendas durante a troca.' },
        ],
        cta: 'Fazer meu orçamento',
        wa: 'Olá! Quero um orçamento de criação de site / loja virtual com a NODE.',
    },
    {
        slug: 'sistemas-e-ia',
        title: 'Desenvolvimento de Sistemas e IA Aplicada | NODE',
        descricao: 'Desenvolvimento de sistema sob medida, automações e agentes de IA que entram na operação. Painéis com dados reais, integração com Shopify, WhatsApp, ERP e CRM.',
        etiqueta: '// frente 02',
        h1: 'Desenvolvimento de sistemas e IA aplicada',
        abertura: [
            'A NODE desenvolve software que entra na operação e resolve gargalo real. Antes de escrever uma linha de código, a gente entende como você trabalha hoje, onde o processo trava e quanto tempo se perde ali.',
            'Não vendemos demonstração bonita. O que entregamos é sistema rodando, com os seus dados, integrado ao que você já usa, e medido por um resultado combinado antes de começar.',
            'IA aqui não é discurso de palco. É o motor que faz a gente construir em dias o que o mercado entrega em meses, e é também o que colocamos dentro da sua operação na forma de automação e de agentes que trabalham sem parar.',
        ],
        blocos: [
            {
                titulo: 'O que construímos',
                itens: [
                    'Painéis e dashboards com os seus dados em tempo real, não com planilha exportada na mão',
                    'Automações que eliminam trabalho manual repetido e o erro que vem junto com ele',
                    'Agentes de IA que atendem, triam e respondem 24 horas por dia',
                    'Integração com Shopify, WhatsApp, planilhas, ERP e CRM que você já usa',
                    'Área de cliente com login e permissão por perfil, cada um vendo só o que lhe cabe',
                    'Banco de dados próprio, com isolamento entre clientes e segurança pensada desde o início',
                    'Relatórios e alertas que chegam sozinhos, em vez de esperar alguém lembrar de olhar',
                ],
            },
            {
                titulo: 'Como funciona na prática',
                itens: [
                    'Mapeamos a operação atual e achamos exatamente onde o tempo vaza',
                    'Definimos qual resultado o sistema precisa entregar, em número, antes de construir',
                    'Entregamos em ciclos curtos, com você usando desde as primeiras semanas',
                    'Cada entrega é validada com dado real da sua operação, não com dado de teste',
                    'Depois do lançamento seguimos operando junto e evoluindo o sistema por sprint',
                    'Você recebe o repositório e a documentação: pode trocar de fornecedor quando quiser',
                ],
            },
        ],
        publico: [
            'Operação que cresceu e hoje se sustenta em planilha, grupo de WhatsApp e memória de gente',
            'Quem gasta horas por dia copiando informação de um sistema para outro',
            'Quem precisa de painel confiável para decidir e hoje decide no achismo',
            'Quem quer usar IA na operação de verdade, e não só testar ferramenta solta',
        ],
        perguntas: [
            { q: 'Preciso trocar os sistemas que já uso?', a: 'Não. Na maioria dos casos a gente integra ao que já existe. Trocar tudo só faz sentido quando a ferramenta atual é o próprio gargalo, e nesse caso a gente mostra a conta antes.' },
            { q: 'Como vocês cobram um sistema sob medida?', a: 'Por escopo fechado no alinhamento, com o resultado esperado definido antes. Sem contrato aberto que cresce sozinho durante o projeto.' },
            { q: 'Quem cuida do sistema depois de pronto?', a: 'A gente segue junto na operação, com manutenção e novas funcionalidades combinadas por sprint. Mas o código é seu: se quiser levar para outro time, leva.' },
            { q: 'Dá para começar pequeno?', a: 'Sim, e costuma ser o melhor caminho. Começamos pelo gargalo que mais dói, colocamos no ar, e só então decidimos o próximo passo com dado na mão.' },
        ],
        cta: 'Fazer meu orçamento',
        wa: 'Olá! Quero um orçamento de sistema / IA aplicada com a NODE.',
    },
    {
        slug: 'mentoria-de-ia',
        title: 'Mentoria de Desenvolvimento com IA na Prática | NODE',
        descricao: 'Mentoria prática de desenvolvimento com IA: sites, sistemas, agentes de código e geração de imagem. Você constrói um projeto real do zero até o ar, com acompanhamento direto.',
        etiqueta: '// frente 03',
        h1: 'Mentoria de desenvolvimento com IA, na prática',
        abertura: [
            'A mentoria da NODE é formação 100% prática. Você não assiste aula e vai embora com anotação: constrói um projeto real, do zero até o ar, com a gente do lado revisando cada decisão.',
            'O conteúdo é o que a gente usa no dia a dia para entregar projeto de cliente. Nada de teoria que não sobrevive ao primeiro problema de verdade, e nada de ferramenta da moda que ninguém usa em produção.',
            'A ideia é simples: no fim, você não tem um certificado, tem uma coisa funcionando no ar e o entendimento de como construiu cada parte dela.',
        ],
        blocos: [
            {
                titulo: 'O que você aprende',
                itens: [
                    'IA aplicada de verdade: onde ela entra, onde ela atrapalha, e como saber a diferença',
                    'Desenvolvimento de sites e landing pages, do zero até o deploy no ar',
                    'Construção de sistemas: banco de dados, login, permissões, painel e automação',
                    'Geração de imagem e criativo com IA, do prompt até o entregável pronto para uso',
                    'Uso de agentes de código no dia a dia, com o que funciona e o que só gera retrabalho',
                    'Leitura e revisão do próprio código, para não depender de gerar tudo às cegas',
                    'Precificação e escopo: como transformar o que você aprendeu em serviço vendável',
                ],
            },
            {
                titulo: 'Como é o ensino',
                itens: [
                    'Cada encontro termina com uma coisa funcionando, não com uma lista de tarefas',
                    'O projeto é seu, é real, e vai para o ar no final da mentoria',
                    'Revisão do seu código e das suas decisões, uma a uma, com explicação do porquê',
                    'Acompanhamento direto, sem turma gigante e sem fila para tirar dúvida',
                    'O ritmo acompanha o seu projeto: quem já programa avança diferente de quem está começando',
                ],
            },
        ],
        publico: [
            'Quem já mexe com código e quer parar de usar IA no chute para começar a usar com método',
            'Quem quer entrar em desenvolvimento e prefere aprender construindo a assistir curso gravado',
            'Freelancer que quer entregar mais rápido e cobrar melhor pelo que entrega',
            'Dono de operação que quer entender o que está contratando antes de contratar',
        ],
        perguntas: [
            { q: 'Preciso já saber programar?', a: 'Ajuda, mas não é obrigatório. O ritmo acompanha o seu ponto de partida, e o projeto é escolhido junto com você para caber no seu nível sem virar passeio.' },
            { q: 'É gravado ou ao vivo?', a: 'O acompanhamento é direto, em cima do seu projeto. Isso é o oposto de curso gravado: o conteúdo se ajusta ao que o seu caso exige.' },
            { q: 'Que projeto eu construo?', a: 'Um projeto real, escolhido com você no início. Pode ser uma loja, um sistema interno ou uma ferramenta que resolva algo da sua rotina. O importante é que vá para o ar.' },
            { q: 'Serve para eu vender esse serviço depois?', a: 'Serve, e faz parte do conteúdo. Uma parte da mentoria é sobre escopo e precificação, porque saber construir e não saber vender deixa metade do valor na mesa.' },
        ],
        cta: 'Quero saber da mentoria',
        wa: 'Olá! Quero entender melhor a mentoria de desenvolvimento com IA da NODE.',
    },
];

export const porSlug = (slug: string) => SERVICOS.find(s => s.slug === slug);
