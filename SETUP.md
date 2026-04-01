# Guia de Setup - Central de Links v2

## Pré-requisitos

- Node.js 14+ instalado
- Conta Firebase configurada
- Navegador moderno (Chrome, Firefox, Safari, Edge)

## Passos de Configuração

### 1. Configurar Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Crie um novo projeto ou use um existente
3. Ative Authentication (Email/Password)
4. Crie um banco de dados Firestore
5. Copie suas credenciais de configuração

### 2. Atualizar Configuração

Edite `assets/js/firebase-config.js` com suas credenciais:

```javascript
const firebaseConfig = {
    apiKey: "sua-chave-api",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto-id",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "seu-id-mensagem",
    appId: "seu-app-id"
};
```

### 3. Configurar Regras do Firestore

No Firebase Console, configure as regras de segurança:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
    match /links/{document=**} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.userId || 
                              get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /categories/{document=**} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### 4. Criar Primeiro Usuário Admin

1. Acesse `login.html`
2. Crie uma nova conta
3. No Firebase Console, edite o documento do usuário e altere `role` para `admin`

### 5. Testar Aplicação

1. Acesse `index.html` no navegador
2. Faça login com sua conta
3. Crie alguns links de teste
4. Acesse o painel admin via menu do usuário

## Estrutura de Pastas

```
central-links-v2/
├── client/
│   ├── public/
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── admin.html
│   │   ├── assets/
│   │   │   ├── css/
│   │   │   │   └── style.css
│   │   │   └── js/
│   │   │       ├── firebase-config.js
│   │   │       ├── auth.js
│   │   │       ├── app.js
│   │   │       ├── admin.js
│   │   │       └── login-script.js
│   │   ├── Icon.svg
│   │   ├── PNG_Logo_CMP.png
│   │   └── README.md
│   └── ...
└── ...
```

## Variáveis de Ambiente

Se usar com um servidor Node.js, configure as variáveis:

```bash
FIREBASE_API_KEY=sua-chave-api
FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
FIREBASE_PROJECT_ID=seu-projeto-id
FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
FIREBASE_MESSAGING_SENDER_ID=seu-id-mensagem
FIREBASE_APP_ID=seu-app-id
```

## Troubleshooting

### Erro: "Firebase is not defined"
- Verifique se o `firebase-config.js` está sendo carregado corretamente
- Confirme que as credenciais estão corretas

### Erro: "Permission denied"
- Verifique as regras de segurança do Firestore
- Confirme que o usuário está autenticado

### Links não aparecem
- Verifique se há links na coleção `links` do Firestore
- Confirme que o usuário tem permissão para visualizar os links

## Deployment

Para fazer deploy:

1. Construa a aplicação
2. Faça upload dos arquivos para um servidor web
3. Configure HTTPS (obrigatório para Firebase Auth)
4. Atualize as URLs autorizadas no Firebase Console

## Suporte

Para mais informações, consulte a documentação do Firebase:
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Cloud Firestore](https://firebase.google.com/docs/firestore)
