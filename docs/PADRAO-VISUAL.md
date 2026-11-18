# Padrão visual

O celular segue as telas do protótipo aprovado; o desktop segue a tela desktop do protótipo
(a votação em cartas). Este é o padrão que todas as abas obedecem, para que nada mude de lugar,
de largura ou de tamanho quando se troca de aba.

Os valores ficam em `src/styles/tokens.css`. Tamanhos em `rem` (px ÷ 16), nunca em `px` soltos,
para que tudo cresça junto.

## Celular e tablet (até 959 px)

- Uma coluna: título da aba, depois o conteúdo. Largura máxima `--content-width` (42rem),
  margens `--gutter`.
- Abas na barra de baixo, ao alcance do polegar.
- Listas de borda a borda, com o fio fino entre linhas.

## Desktop (a partir de 960 px)

A grade do protótipo, igual em todas as abas (componente `Page`):

| Peça                                | Protótipo | Token                         |
| ----------------------------------- | --------- | ----------------------------- |
| Margens laterais                    | 48 px     | `--gutter` (3rem)             |
| Coluna lateral                      | 300 px    | `--side-width` (até 18,75rem) |
| Espaço entre as colunas             | 64 px     | `--side-gap` (até 4rem)       |
| Respiro acima das colunas           | 40 px     | `--page-top` (2,5rem)         |
| Largura máxima (cabeçalho e página) | —         | `--wide-width` (76rem)        |
| Espaço entre blocos da lateral      | 28 px     | `--side-block-gap` (1,75rem)  |

- **Lateral:** o título da aba (`h1`, sempre no mesmo ponto e tamanho), o estado e as ações da
  página (com `PageSide`) e, no pé, a ilustração apagada. Em telas altas ela fica parada enquanto
  o conteúdo rola.
- **Conteúdo:** blocos com fio escuro em cima (`1px var(--ink)`), rótulo pequeno, título em
  serifa; linhas finas (`var(--line)`) entre itens.
- **Fios estruturais ocupam a coluna inteira.** O que é estreito (texto corrido, campos de
  formulário) fica estreito por dentro, sem fio próprio. Assim nenhum fio muda de largura
  entre abas.
- **Mesmo papel, mesmo estilo.** O título de estado na lateral ("Escolha duas leituras",
  "Indique uma leitura") usa sempre a mesma fonte; rótulos de seção, títulos de seção e linhas
  de apoio também.
- **Escala:** a interface cresce com a tela, de 16 px (até ~1100 px de largura) a 18 px (a
  partir de ~1440 px), tudo junto, sem mudar os pontos de quebra.

## Como conferir

Antes de mudar o layout, compare prints e medições de todas as abas, no celular e no desktop:

- o título (`h1`) de cada aba no mesmo ponto;
- todo fio estrutural do conteúdo com a mesma largura da coluna;
- no celular, título, fios, estilos de texto e altura da página iguais aos de antes.
