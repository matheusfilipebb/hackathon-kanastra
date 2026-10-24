# Prompts da identidade visual: Antecipa → Antecipe

Registro, em ordem, dos prompts usados para construir a identidade visual da marca, e um prompt-modelo para reaproveitar em outros projetos.

---

## 1. Prompt inicial: briefing e entregáveis

```text
Você é um designer sênior especializado em identidade visual e branding. Quero que você desenvolva uma identidade visual completa para o projeto descrito abaixo.

## Sobre o projeto
- Nome da marca: Antecipa
- O que faz / vende: Gerencia um fundo que compra notas de vendas a prazo de outras empresas gerando liquidez imediata e cobrando uma taxa.
- Segmento: FIntech (Tecnologia e Finanças) de Antecipação de Recebíveis.
- Público-alvo: PMEs, Indústrias, Distribuidores e Atacadistas (B2B)
- Diferenciais: Transparência e Clareza na Comunicação (Foco em UX), Agilidade na Simulação e Precificação, Flexibilidade Operacional (Motor de Regras Dinâmico), Integração e Processamento em Larga Escala, Segurança Institucional (Prevenção a Fraudes).
- Concorrentes ou referências: Monkey Exchange, Liber Capital, Adiante (Adiante Recebíveis), Antecipa Fácil, Rapidoo, Optacred, RNX FIDC, Mutual Factoring e FIDC, Cora, Mercado Pago (Mercado Crédito).

## Personalidade e posicionamento
- 3 a 5 adjetivos que descrevem a marca: Moderna, confiável, acolhedora, inovadora, clara e objetiva.
- Tom de voz: Formal, claro, simples, acolhedor.
- Sensação que quero provocar: segurança e agilidade.

## Preferências visuais
- Estilo desejado: minimalista, geométrico, orgânico.
- Onde a marca será aplicada: redes sociais, site, impressos e apps.

## O que preciso que você entregue
1. Conceito central da marca (a ideia por trás da identidade) e justificativa das escolhas.
2. Logotipo: 3 direções distintas, descrevendo conceito, forma, tipo de logo (símbolo, logotipo, assinatura) e simbolismo.
3. Paleta de cores: cores primárias, secundárias e neutras, com códigos HEX, RGB e CMYK, e a função de cada uma.
4. Tipografia: fonte para títulos, fonte para textos e hierarquia de uso (sugira opções gratuitas, como as do Google Fonts).
5. Elementos gráficos de apoio: padrões, ícones, formas, estilo de ilustração e de fotografia.
6. Aplicações práticas: como a identidade aparece em redes sociais, site e app.
7. Regras de uso: área de proteção, tamanho mínimo, versões do logo (colorida, monocromática, positiva e negativa) e erros a evitar.
8. Tom de voz: exemplos de frases, slogan e legendas no estilo da marca.

## Formato da resposta
Entregue a identidade em apresentação.
```

**Resultado:** apresentação de 8 slides, um por entregável.

---

## 2. Exportação do logotipo em curvas

```text
Exporte o logotipo em Curvas
```

**Resultado:** logotipos das 3 direções, nas versões positiva e negativa, em SVG e PDF, com o texto convertido em contornos.

---

## 3. Mudança de nome

```text
Troque o nome de Antecipa para Antecipe e entregue os arquivos novamente
```

**Resultado:** apresentação e logotipos refeitos com o nome **Antecipe**.

---

## 4. Referência visual: brandbook da Kanastra

```text
https://www.kanastra.design/

Observe o site da Kanastra: Tipografia, Paleta de Cores e Templates. Recrie a identidade visual da Antecipe utilizando as cores, tipografia e templates da Kanastra, mas mantendo a ideia do logo Antecipe.
```

**Dados fornecidos em seguida (prints da paleta):**

| Cor | HEX | RGB | CMYK | Pantone |
|---|---|---|---|---|
| Kanastra Green | #193c32 | 25, 60, 50 | 85, 50, 70, 55 | 567 C |
| Tech Green #1 | #1e5546 | 30, 85, 70 | 85, 45, 70, 40 | 342 C |
| Tech Green #2 | #14735a | 20, 115, 90 | 85, 30, 70, 20 | 341 C |
| Tech Green #3 | #2daa82 | 45, 170, 130 | 75, 8, 60, 0 | 339 C |
| Light Gray | #f3f2f3 | 243, 242, 243 | 4, 3, 2, 0 | Cool Gray 1 C -60% |
| White | #ffffff | 255, 255, 255 | 0, 0, 0, 0 | White |

**Tipografia da referência:** Vinila Extended Light (títulos), Inter Display Medium (subtítulos), Inter Regular (corpo). Nesta versão, a Unbounded Light substitui a Vinila.

**Resultado:** apresentação refeita com a paleta e a tipografia da Kanastra, mais os templates de slide de título, capa de LinkedIn e fundo de Teams.

---

## Prompt-modelo reutilizável

Substitua o que está entre colchetes.

```text
Você é um designer sênior especializado em identidade visual e branding. Desenvolva uma identidade visual completa para o projeto abaixo.

## Sobre o projeto
- Nome da marca: [nome]
- O que faz / vende: [descrição]
- Segmento: [segmento]
- Público-alvo: [público]
- Diferenciais: [lista]
- Concorrentes ou referências: [lista]

## Personalidade e posicionamento
- Adjetivos da marca: [3 a 5]
- Tom de voz: [tom]
- Sensação a provocar: [sensação]

## Preferências visuais
- Estilo desejado: [estilo]
- Onde a marca será aplicada: [canais]
- Referência de marca (opcional): [link], usando [cores / tipografia / templates]

## Entregáveis
1. Conceito central e justificativa
2. Logotipo: 3 direções (conceito, forma, tipo, simbolismo)
3. Paleta com HEX, RGB, CMYK (e Pantone, se houver) e função de cada cor
4. Tipografia: títulos, textos e hierarquia (opções gratuitas)
5. Elementos de apoio: padrões, ícones, formas, ilustração e fotografia
6. Aplicações: redes sociais, site e app
7. Regras de uso: área de proteção, tamanho mínimo, versões e erros a evitar
8. Tom de voz: frases, slogan e legendas

## Formato
Apresentação [com N slides, se quiser limitar]. Depois, exporte o logotipo em curvas (SVG e PDF).
```
