# Melhores Práticas de Compartilhamento (Sharing Best Practices)

Saiba mais sobre as melhores práticas para implementar o compartilhamento no Facebook em sites e aplicativos para celular, criando experiências acessíveis e confiáveis.

## Recomendações para Sites

### Otimização para o Rastreador (Crawler)
*   **Rastreador do Facebook:** Implemente-o para gerar prévias do seu conteúdo público.
*   **Codificação:** Ative **GZIP** e/ou **deflate** em seu servidor para garantir que o site seja compartilhado corretamente.
*   **Open Graph:** Use metatags do Open Graph para garantir a extração correta de título, descrição e imagem de prévia.
*   **Depuração:** Use a ferramenta **Depurador de Compartilhamento** para testar a visualização e forçar a atualização do cache (scraping) se você atualizou o conteúdo recentemente.

### Rastreamento de Interações
*   Use o **Facebook SDK for JavaScript** para rastrear interações em tempo real.
*   Assine eventos como cliques no botão Curtir, envio de mensagens ou comentários usando `FB.Event.subscribe`.

### Recurso "Seguir"
Ative o recurso "Seguir" para permitir que criadores compartilhem atualizações públicas com seguidores enquanto mantêm atualizações pessoais privadas.
*   **Configuração:** Acesse as configurações da Página > Seguidores e ative a opção.
*   **Linha do Tempo:** Mantenha uma aparência profissional (foto de capa, histórico, marcos).
*   **Engajamento:** Siga outros influenciadores e publique conteúdo interessante (fotos, links) definido como público.

## Imagens

### Resolução e Proporção
*   **Alta Resolução:** Use imagens com pelo menos **1080 pixels de largura**.
*   **Mínimo:** 600 pixels de largura para anúncios com link.
*   **Proporção:** Recomendamos **1:1** para criativos de anúncios com link de imagem.

### Cache e Metadados
*   **Pré-cache:** Execute a URL na ferramenta **Depurador de Compartilhamento** para fazer a pré-busca de metadados e armazenar a imagem em cache. Faça isso também ao atualizar imagens.
*   **Tags de Dimensão:** Use `og:image:width` e `og:image:height` para que o rastreador renderize a imagem imediatamente, sem processamento assíncrono.

### Imagens para Aplicativos de Jogos
*   **Stories do Open Graph:** Formato quadrado (**600x600 px**).
*   **Stories fora do Open Graph:** Formato retangular (**1.91:1**, ex: **600x314 px**).

## Recomendações para Dispositivos Móveis

### Integração e Experiência
*   **App Links:** Use para criar links profundos (deep links) para locais específicos do seu aplicativo a partir do Facebook.
*   **Diálogo de Mensagens:** Use para compartilhamento privado via Messenger.
*   **Gerenciador de Eventos:** Acompanhe os eventos do aplicativo.

### Rastreamento de Tráfego (User Agent)
Use o cabeçalho `User-Agent` HTTP para identificar tráfego vindo do Facebook em dispositivos móveis (iOS/Android).

Seu aplicativo deve:
1.  Procurar por um cabeçalho `Referer` contendo `facebook.com`.
2.  Verificar o `User-Agent` para identificar a origem:
    *   **Android:** `FB_IAB/FB4A`
    *   **iOS:** `FBAN/FBIOS`
