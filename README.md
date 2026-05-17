# Estoque Aula Web

Versao estatica do controle de estoque para publicar no GitHub Pages.

## Objetivo

Esta versao foi preparada para uso didatico em sala de aula sem servidor Node, sem SQLite e sem custo de hospedagem backend.

Cada aluno ou grupo abre o mesmo link publicado no GitHub Pages, mas os dados ficam salvos no navegador daquele grupo usando `localStorage`.

## O que funciona

- Login local para professor e grupos.
- Cadastro e edicao de itens.
- Entradas e saidas de estoque.
- Filtro por periodo.
- Valor total em estoque.
- Itens abaixo do minimo.
- Ponto de compra.
- Compra sugerida.
- Giro medio.
- Cobertura em dias.
- Curva ABC.
- Matriz ABC/XYZ.
- Relatorio para imprimir ou salvar em PDF.
- Exportacao CSV.

## Logins iniciais

- Professor: `gestor` / `admin123`
- Grupo 1: `grupo1` / `grupo123`
- Grupo 2: `grupo2` / `grupo123`
- Grupo 3: `grupo3` / `grupo123`
- Grupo 4: `grupo4` / `grupo123`

## Limitacoes desta versao

- Nao ha banco central compartilhado.
- Nao ha multiusuario real em tempo real.
- Os dados de cada grupo ficam no navegador usado por aquele grupo.
- Para comparar resultados, cada grupo deve exportar CSV ou gerar PDF.

## Como publicar no GitHub Pages

1. Crie um repositorio no GitHub, por exemplo `estoque-aula-web`.
2. Envie estes arquivos para o repositorio:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
   - `.gitignore`
3. No GitHub, entre em `Settings > Pages`.
4. Em `Build and deployment`, escolha:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Salve.

Depois de alguns instantes, o GitHub vai gerar o link publico da atividade.

## Uso em sala

1. O professor publica o link no GitHub Pages.
2. Cada grupo abre o link em seu computador.
3. O professor orienta o roteiro de lancamentos.
4. Cada grupo observa os indicadores antes e depois dos lancamentos.
5. Cada grupo gera PDF ou CSV para apresentar a decisao de compra.
