# 📚 Concurseiro Pro

Aplicativo PWA de estudos para concursos públicos. Funciona direto no navegador, pode ser instalado como app no celular ou desktop, e salva todos os dados localmente sem necessidade de login ou internet.

---

## ✨ Funcionalidades

- **Painel** — visão geral do progresso, streak de dias estudados, sugestão inteligente de estudo e distribuição de tempo da semana
- **Revisão espaçada** — prioridades calculadas automaticamente por dias sem revisar, peso da matéria e taxa de acertos
- **Edital** — cadastro de matérias e tópicos com pesos, links de caderno e controle de conclusão
- **Estudar** — cronômetro com modo Pomodoro (25+5 min), registro de questões e acertos por sessão
- **Ciclo semanal** — meta de horas distribuída proporcionalmente entre as matérias pelo peso
- **Histórico** — todas as sessões com edição completa (matéria, tópico, questões, acertos e tempo)
- **Dark mode** — alternância clara/escura persistida
- **Backup** — exportação e importação de dados em JSON
- **PWA** — instalável no Android, iOS e desktop via Chrome/Edge, com suporte offline

---

## 🗂 Estrutura de arquivos

```
concurseiro-pro/
├── index.html      # Shell HTML com todas as seções e modais
├── style.css       # Design system completo (tokens, dark mode, componentes)
├── app.js          # Toda a lógica da aplicação
├── db.js           # Camada de abstração do IndexedDB
├── sw.js           # Service Worker para cache offline
├── manifest.json   # Manifesto PWA (nome, ícone, cores)
└── icon.svg        # Ícone do app
```

---

## 🚀 Como usar

### Sem instalação
Baixe os arquivos, descompacte e abra o `index.html` no navegador. Todos os dados e funcionalidades funcionam normalmente.

### Com instalação como app (requer hospedagem)

**GitHub Pages**
1. Suba a pasta em um repositório no GitHub
2. Vá em *Settings → Pages → Branch: main → Save*
3. Acesse a URL gerada (`seuusuario.github.io/nome-do-repo`)
4. No Chrome ou Edge, clique em **Instalar** na barra de endereço

**Netlify (mais rápido)**
1. Acesse [netlify.com/drop](https://netlify.com/drop)
2. Arraste a pasta do projeto para a área indicada
3. Acesse a URL gerada e instale

**Localmente com VS Code**
1. Instale a extensão *Live Server*
2. Clique com o botão direito em `index.html → Open with Live Server`
3. Acesse `http://127.0.0.1:5500` e instale normalmente

---

## 🛠 Tecnologias

| Tecnologia | Uso |
|---|---|
| HTML / CSS / JS puro | Interface e lógica, sem frameworks |
| IndexedDB | Armazenamento local sem limite fixo |
| Service Worker | Cache offline e instalação PWA |
| Web App Manifest | Metadados para instalação como app |
| Font Awesome 6 | Ícones |
| DM Sans / DM Mono | Tipografia |

---

## 💾 Sobre os dados

Todos os dados ficam salvos no próprio dispositivo via IndexedDB — nenhuma informação é enviada para servidores. Recomenda-se exportar o backup JSON periodicamente em *Configurações → Exportar backup* para evitar perda de dados ao trocar de navegador ou dispositivo.

A migração de dados do `localStorage` (versões anteriores) é feita automaticamente na primeira abertura.

---

## 📱 Compatibilidade

| Plataforma | Suporte |
|---|---|
| Chrome / Edge (desktop) | ✅ Completo, incluindo instalação PWA |
| Chrome (Android) | ✅ Completo, incluindo instalação PWA |
| Safari (iOS 16.4+) | ✅ Funcional, instalável via *Compartilhar → Tela de início* |
| Firefox | ✅ Funcional (sem suporte a instalação PWA) |

---

## 📄 Licença

Uso livre para fins pessoais e educacionais.
