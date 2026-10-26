# Fundo da página inicial

Mídias usadas como referência visual a pedido do usuário, obtidas da página pública da Kanastra em 25/10/2026:

- `kanastra-hero.mp4`: https://www.kanastra.com.br/home-hero.mp4
- `kanastra-hero-poster.webp`: https://www.kanastra.com.br/home-hero-poster.webp

O vídeo original tem 34 segundos, resolução 1280 × 720 e codec H.264. O componente `HeroBackground`, em `src/Landing.tsx`, o reproduz sem áudio e em loop. A imagem é exibida durante o carregamento, em falhas de mídia e quando o usuário prefere movimento reduzido. A opacidade do fundo diminui suavemente conforme a abertura sai da tela durante a rolagem e volta ao retornar ao topo. O vídeo é pausado automaticamente quando fica totalmente transparente ou a aba está oculta. A preferência por movimento reduzido mantém a capa estática, sem o efeito de desaparecimento.
