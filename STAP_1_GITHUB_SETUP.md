# Stap 1: GitHub Repository Setup

Dit is de eerste stap om je platform te deployen.

---

## ✅ Wat je gaat doen

1. Git repository initialiseren
2. Code committen
3. GitHub repository aanmaken
4. Code naar GitHub pushen

---

## 🚀 Stappen

### 1. Git Initialiseren

```bash
cd /Users/rogierschoenmakers/Documents/Platform/gs-lead-platform

# Initialiseer git repository
git init

# Voeg alle bestanden toe (behalve .env en node_modules)
git add .

# Maak eerste commit
git commit -m "Initial commit: GS Lead Platform"
```

### 2. .gitignore Controleren

Zorg dat `.gitignore` deze bevat:
```
.env
.env.local
.env.production
node_modules/
.DS_Store
*.log
database/*.db
```

### 3. GitHub Repository Aanmaken

1. Ga naar [github.com](https://github.com)
2. Klik op **"+"** → **"New repository"**
3. Vul in:
   - **Repository name:** `gs-lead-platform`
   - **Description:** "Lead generation platform voor GrowSocial"
   - **Visibility:** Private (aanbevolen) of Public
   - **DON'T** initialiseer met README (je hebt al code)
4. Klik **"Create repository"**

### 4. Code Naar GitHub Pushen

GitHub geeft je instructies, maar hier zijn de commando's:

```bash
# Voeg GitHub remote toe (vervang USERNAME met jouw GitHub username)
git remote add origin https://github.com/USERNAME/gs-lead-platform.git

# Of als je SSH gebruikt:
# git remote add origin git@github.com:USERNAME/gs-lead-platform.git

# Push naar GitHub
git branch -M main
git push -u origin main
```

---

## ✅ Verificatie

Na het pushen:

1. Ga naar je GitHub repository: `https://github.com/USERNAME/gs-lead-platform`
2. Check of alle bestanden zichtbaar zijn
3. Check dat `.env` NIET zichtbaar is (staat in .gitignore)

---

## ⚠️ Belangrijk

- **Zorg dat `.env` in `.gitignore` staat** - dit bevat gevoelige API keys!
- **Commit geen wachtwoorden of API keys**
- Als je al een `.env` hebt gecommit, verwijder deze:
  ```bash
  git rm --cached .env
  git commit -m "Remove .env from repository"
  ```

---

## 🎯 Volgende Stap

Na deze stap kun je doorgaan met:
- **Stap 2:** Supabase project aanmaken (zie `DEPLOYMENT_GUIDE.md`)
- **Stap 3:** Vercel project koppelen aan GitHub

---

**Klaar?** Ga door naar de volgende stap in `DEPLOYMENT_GUIDE.md`!
