# Central de Links v2 - Documentação

## Visão Geral

Central de Links v2 é uma aplicação web moderna para gerenciamento de links com suporte a autenticação de usuários, links pessoais e públicos, categorias personalizáveis e painel administrativo completo.

## Estrutura de Arquivos

```
client/public/
├── index.html                    # Página principal de links
├── login.html                    # Página de autenticação e cadastro
├── admin.html                    # Painel administrativo
├── assets/
│   ├── css/
│   │   └── style.css            # Estilos consolidados (tema claro/escuro)
│   └── js/
│       ├── firebase-config.js   # Configuração centralizada do Firebase
│       ├── auth.js              # Gerenciador de autenticação
│       ├── app.js               # Lógica principal da aplicação
│       ├── admin.js             # Lógica do painel administrativo
│       └── login-script.js      # Lógica da página de login
├── Icon.svg                      # Ícone da aplicação
├── PNG_Logo_CMP.png             # Logo da aplicação
└── README.md                     # Este arquivo
```

## Funcionalidades Implementadas

### 1. Sistema de Autenticação
- Página de login com validação de email e senha
- Cadastro de novos usuários com confirmação de senha
- Gerenciamento de sessão com Firebase Auth
- Redirecionamento automático para login se não autenticado

### 2. Gestão de Links
- **Links Pessoais**: Visíveis apenas para o proprietário (privados)
- **Links Públicos**: Visíveis para todos os usuários logados
- **Favoritos**: Seção especial para links marcados como favoritos
- Suporte a tags, descrição e categorias
- Contador de cliques por link
- Status ativo/inativo para links

### 3. Filtros e Busca
- **Filtro de Categorias**: Dropdown na barra de pesquisa
- **Busca em Tempo Real**: Busca por título, descrição e tags
- **Sidebar com Categorias**: Navegação rápida por categoria

### 4. Controle de Tamanho de Cards
- Três opções de tamanho: Pequeno, Médio e Grande
- Botões de controle na barra de cabeçalho
- Preferência salva no localStorage

### 5. Modal de Propriedades do Card
Ao clicar em um card, exibe:
- URL original com link clicável
- Botão para copiar link
- Categoria e tags
- Data de criação
- Número de cliques
- Botões de edição (apenas para dono ou admin)
- Botão de exclusão (apenas para dono ou admin)
- Informação de quem adicionou (para links públicos, visível para admin)

### 6. Comportamento por Categoria
- **Figma**: URLs são automaticamente convertidas para formato `figma://`
- **Links Externos**: Exibição normal com botão de abertura

### 7. Painel Administrativo
- **Dashboard**: Estatísticas gerais (usuários, links, admins, categorias)
- **Gerenciar Usuários**: Lista de usuários com opção de alterar função (user/admin)
- **Gerenciar Links**: Visualizar e excluir links
- **Gerenciar Categorias**: Criar e excluir categorias

### 8. Sistema de Administração
- Atribuição de função de administrador a qualquer usuário
- Acesso ao painel administrativo apenas para admins
- Permissões para editar/deletar links públicos

## Configuração do Firebase

Antes de usar a aplicação, configure o Firebase em `assets/js/firebase-config.js`:

```javascript
const firebaseConfig = {
    apiKey: "sua-api-key",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto-id",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "seu-messaging-sender-id",
    appId: "seu-app-id"
};
```

## Estrutura de Dados Firebase

### Coleção: `users`
```javascript
{
    uid: string,                    // ID do Firebase Auth
    email: string,
    displayName: string,
    role: string,                   // 'user' ou 'admin'
    cardSize: string,               // 'small', 'medium', 'large'
    createdAt: timestamp
}
```

### Coleção: `links`
```javascript
{
    title: string,
    url: string,
    categoryId: string,
    tags: array[string],
    description: string,
    type: string,                   // 'public' ou 'private'
    userId: string,                 // UID do criador
    favorite: boolean,
    active: boolean,
    clickCount: number,
    createdAt: timestamp,
    updatedAt: timestamp
}
```

### Coleção: `categories`
```javascript
{
    name: string,
    icon: string,                   // Classe Font Awesome
    createdAt: timestamp
}
```

## Fluxo de Usuário

### Primeiro Acesso
1. Usuário é redirecionado para `login.html`
2. Pode fazer login ou criar nova conta
3. Após autenticação, é redirecionado para `index.html`

### Navegação Principal
- **Sidebar**: Navegação por categorias
- **Header**: Busca, filtro de categorias, controle de tamanho
- **Seções**: Links pessoais, favoritos, links públicos

### Painel Administrativo
- Acessível via menu do usuário (apenas para admins)
- Dashboard com estatísticas
- Gerenciamento de usuários, links e categorias

## Temas Suportados

A aplicação suporta tema claro e escuro com alternância via botão na barra de cabeçalho. A preferência é salva no localStorage.

## Responsividade

A aplicação é totalmente responsiva com breakpoints para:
- Desktop (1024px+)
- Tablet (768px - 1023px)
- Mobile (até 767px)

## Segurança

- Autenticação via Firebase Auth
- Validação de permissões no lado do cliente
- Links privados são filtrados por userId
- Apenas admins podem acessar o painel administrativo

## Melhorias Futuras

- Compartilhamento de links entre usuários
- Histórico de atividades detalhado
- Exportação de links
- Integração com APIs externas
- Sistema de notificações

## Suporte

Para dúvidas ou problemas, entre em contato com o desenvolvedor.
