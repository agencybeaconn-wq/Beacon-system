# Compra Segura

_Última atualização: {{last_updated}}_

Na **{{client_name}}**, a segurança da sua compra é prioridade. Investimos em tecnologia, processos e parceiros certificados para proteger cada transação realizada em **{{shop_url}}**. Conheça em detalhe as camadas de proteção aplicadas.

## 1. Certificado SSL e criptografia

Todo o tráfego entre seu navegador e nosso site é criptografado por **TLS 1.3** (Transport Layer Security), o padrão mais moderno da indústria. Isso significa que:

- Dados pessoais, de pagamento e de navegação viajam codificados, inacessíveis a terceiros;
- Seu navegador exibe um **cadeado** ao lado do endereço — clique nele pra visualizar o certificado;
- Senhas de acesso são armazenadas com **hash criptográfico** (bcrypt/argon2), não em texto plano.

## 2. Processamento de pagamentos

Não processamos pagamentos diretamente em nossos servidores. Utilizamos gateways certificados **PCI DSS nível 1** (o mais alto padrão de segurança do setor financeiro), como:

- **Shopify Payments** (Stripe)
- **Mercado Pago**
- **PagSeguro / PagBank**
- **PayPal**

O que isso significa pra você:

- Dados do cartão vão direto pro gateway, criptografados ponta a ponta;
- A {{client_name}} **nunca** vê número completo, CVV ou senha bancária;
- Transações suspeitas passam por análise antifraude automática e manual.

## 3. Dados que NÃO armazenamos

Pra sua proteção, **nunca** guardamos:

- Número completo do cartão de crédito
- Código de segurança (CVV/CVC)
- Senha bancária ou do aplicativo do banco
- Token de aprovação PIX após conclusão
- Dados biométricos

Armazenamos apenas os últimos 4 dígitos do cartão (para identificação em caso de reembolso) e o nome do titular, criptografados em repouso com **AES-256**.

## 4. Proteção antifraude

Todas as compras passam por **análise automatizada antifraude** que avalia:

- Consistência entre CEP de entrega, cobrança e IP do comprador;
- Histórico do cartão (tentativas anteriores, blacklist global);
- Velocidade de checkout (padrões de bot);
- Dispositivo e navegador (fingerprint);
- Comportamento de navegação pré-compra.

Pedidos suspeitos podem ser **bloqueados automaticamente** ou encaminhados pra análise manual (que pode levar até 24h). Em caso de bloqueio indevido, entre em contato pelo **{{support_email}}** que revisamos o caso.

## 5. Autenticação

Recomendamos fortemente:

- **Senha forte**: mínimo 10 caracteres, com letras, números e símbolos;
- **Não reutilize senhas** de outros sites;
- **Ative 2FA** (autenticação em dois fatores) onde disponível;
- **Nunca compartilhe** seu login ou código de recuperação.

## 6. Conformidade com a LGPD

Tratamos dados pessoais conforme a **Lei Geral de Proteção de Dados (Lei nº 13.709/18)**, o que inclui:

- Coleta mínima (apenas dados estritamente necessários à execução da compra);
- Finalidades declaradas e específicas;
- Bases legais adequadas (contratual, consentimento, legítimo interesse);
- Direito de acesso, correção, exclusão e portabilidade — sempre à sua disposição;
- Sistemas de armazenamento segregados e com controle de acesso.

Ver a [Política de Privacidade](/pages/politica-de-privacidade) completa.

## 7. Sinais de sites falsos — atenção

Se você encontrar um site usando o nome {{client_name}} com **domínio diferente de {{shop_url}}**, pode ser tentativa de golpe. Desconfie de:

- URLs com erros de grafia;
- Anúncios patrocinados em redes sociais com preços suspeitamente baixos;
- E-mails pedindo confirmação de dados bancários ou senha;
- Ofertas recebidas por WhatsApp de números não identificados como nosso canal oficial.

Em caso de dúvida, cheque o **cadeado** no navegador e o domínio exato. **Nunca pedimos senha ou CVV por e-mail, WhatsApp ou telefone.**

## 8. O que fazer em caso de suspeita

Se você identificou uma transação não reconhecida, e-mail suspeito em nosso nome ou acesso indevido à sua conta:

1. **Troque a senha** imediatamente em sua conta;
2. **Entre em contato com seu banco** pra bloquear o cartão (se aplicável);
3. **Notifique-nos** pelo e-mail **{{support_email}}** com o máximo de detalhes (data, valor, pedido);
4. Iniciamos procedimento de investigação em até **24h úteis**.

## 9. Contato do time de segurança

- **E-mail geral:** {{support_email}}
- **E-mail DPO (proteção de dados):** {{dpo_email}}
- **Horário:** {{business_hours}}

---

_Certificações e parceiros de segurança atualizados em {{last_updated}}. Este documento é informativo e não substitui orientação de autoridades competentes em caso de fraude ou incidente de segurança._
