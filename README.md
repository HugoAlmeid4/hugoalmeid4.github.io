# Hralmeida — Blog no GitHub Pages

Blog estático com o mesmo design do Blogger, alimentado por Google Sheets.

---

## Estrutura de ficheiros

```
hralmeida-site/
├── index.html   ← página principal
├── style.css    ← todo o CSS
├── app.js       ← lógica + fetch do Google Sheets
└── README.md
```

---

## 1. Publicar no GitHub Pages

1. Cria um repositório no GitHub chamado `hralmeida.github.io`
   (ou qualquer nome — nesse caso o site fica em `hralmeida.github.io/nome-repo`)
2. Faz upload dos 3 ficheiros (`index.html`, `style.css`, `app.js`)
3. Vai a **Settings → Pages → Source → Deploy from branch → main / root**
4. O site fica disponível em `https://hralmeida.github.io`

---

## 2. Configurar o Google Sheet

### Criar a folha

1. Vai a [sheets.google.com](https://sheets.google.com) e cria uma nova folha
2. Na **linha 1**, coloca exatamente estes cabeçalhos (um por coluna):

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| title | date | labels | excerpt | body | image | slug |

### Preencher posts

A partir da linha 2, um post por linha:

| Coluna | O que escrever |
|--------|----------------|
| **title** | Título do post |
| **date** | Data — formato `2026-03-20` ou `20 Mar 2026` |
| **labels** | Categorias separadas por vírgula: `Astronomia, Equipamento` |
| **excerpt** | Resumo curto que aparece nos cards (opcional) |
| **body** | Conteúdo completo. Suporta Markdown básico (ver abaixo) |
| **image** | URL de uma imagem para o thumbnail (opcional) |
| **slug** | ID único para URL: `meu-telescopio-72ed` (só letras, números, hífens) |

> **Dica:** Para escrever texto longo na coluna `body` sem problemas, usa `Ctrl+Enter` para nova linha dentro da célula, ou escreve num editor de texto e cola.

### Markdown suportado no body

```
## Título grande
### Título menor

**negrito**  _itálico_

- item de lista
- outro item

1. lista numerada
2. segundo item

> citação / blockquote

`código inline`

```bloco de código```

[texto do link](https://url.com)
![alt da imagem](https://url-da-imagem.com/foto.jpg)

---   (linha horizontal)
```

### Publicar a folha como CSV

1. **Ficheiro → Partilhar → Publicar na web**
2. Seleciona:
   - Primeiro dropdown: **Folha1** (ou o nome do teu separador)
   - Segundo dropdown: **Valores separados por vírgulas (.csv)**
3. Clica **Publicar** e confirma
4. Copia o URL gerado — será algo como:
   ```
   https://docs.google.com/spreadsheets/d/XXXXXXXXXXX/pub?gid=0&single=true&output=csv
   ```

### Ligar ao site

Abre `app.js` e substitui na linha 1:

```javascript
const SHEET_CSV_URL = 'COLE_AQUI_O_URL_DO_CSV';
```

Faz commit e o site atualiza automaticamente.

---

## 3. Adicionar posts

Simplesmente adiciona uma nova linha no Google Sheet — sem redeploy, sem build.
O site vai buscar os dados frescos a cada visita.

> Os posts aparecem pela ordem das linhas na folha (linha 2 = post mais recente / hero).

---

## 4. Personalizar

### Mudar nome/bio no sidebar
Edita a secção `<!-- ABOUT -->` em `index.html`:
```html
<p class="profile-name">O Teu Nome</p>
<p class="profile-bio">A tua bio aqui.</p>
```

### Mudar links de navegação
Edita as tags `<a class="nav-link">` no header do `index.html`.

### Mudar cores
Edita as variáveis CSS no topo de `style.css`:
```css
:root {
  --green:   #3a7a20;   /* cor de destaque */
  --dark:    #0f1a09;   /* header e footer */
  --paper:   #f4f1ed;   /* fundo da página */
}
```

---

## 5. Domínio personalizado (opcional)

1. Cria um ficheiro `CNAME` na raiz do repositório com o teu domínio:
   ```
   hralmeida.pt
   ```
2. No teu registrar DNS, aponta um CNAME para `hralmeida.github.io`
3. Ativa HTTPS em **Settings → Pages → Enforce HTTPS**
