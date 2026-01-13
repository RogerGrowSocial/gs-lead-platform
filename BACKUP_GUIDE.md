# Backup Guide - Supabase & Vercel

**Laatste update:** 2025-01-28

Deze guide legt uit hoe je automatische backups maakt voor Supabase (database) en Vercel (code deployments).

---

## 🗄️ Supabase Backups

### Automatische Backups (Aanbevolen)

Supabase maakt **automatisch dagelijkse backups** voor alle projecten:

1. **Ga naar:** Supabase Dashboard → Project Settings → Database
2. **Backups sectie:**
   - Supabase bewaart automatisch backups voor 7 dagen (Free tier)
   - Pro tier: 30 dagen backups
   - Enterprise: custom retention

### Handmatige Database Backup

#### Optie 1: Via Supabase Dashboard (Eenvoudigst)

1. **Ga naar:** Supabase Dashboard → Project Settings → Database
2. **Klik:** "Backups" tab
3. **Klik:** "Create backup" (als beschikbaar)
4. **Of:** Download bestaande backup

#### Optie 2: Via Supabase CLI (Aanbevolen voor Automatisering)

```bash
# Installeer Supabase CLI
npm install -g supabase

# Login
supabase login

# Link naar project
supabase link --project-ref haxwrebdksawioivhlmh

# Maak database dump
supabase db dump -f backup-$(date +%Y%m%d-%H%M%S).sql

# Of met password
supabase db dump -f backup.sql --db-url "postgresql://postgres:[PASSWORD]@db.haxwrebdksawioivhlmh.supabase.co:5432/postgres"
```

#### Optie 3: Via pg_dump (Direct Database Connectie)

```bash
# Installeer PostgreSQL client tools
brew install postgresql  # macOS
# of
apt-get install postgresql-client  # Linux

# Maak backup
pg_dump "postgresql://postgres:[PASSWORD]@db.haxwrebdksawioivhlmh.supabase.co:5432/postgres" > backup-$(date +%Y%m%d).sql

# Compress backup
gzip backup-$(date +%Y%m%d).sql
```

### Automatische Supabase Backups Script

Maak een script dat dagelijks backups maakt:

```bash
#!/bin/bash
# save-as: scripts/backup-supabase.sh

BACKUP_DIR="./backups/supabase"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup-$DATE.sql"

# Maak backup directory
mkdir -p "$BACKUP_DIR"

# Database URL (gebruik environment variable!)
DB_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.haxwrebdksawioivhlmh.supabase.co:5432/postgres"

# Maak backup
pg_dump "$DB_URL" > "$BACKUP_FILE"

# Compress
gzip "$BACKUP_FILE"

# Verwijder backups ouder dan 30 dagen
find "$BACKUP_DIR" -name "backup-*.sql.gz" -mtime +30 -delete

echo "✅ Backup gemaakt: $BACKUP_FILE.gz"
```

**Automatiseer met cron:**
```bash
# Voeg toe aan crontab (dagelijks om 2:00 AM)
crontab -e

# Voeg toe:
0 2 * * * /path/to/scripts/backup-supabase.sh
```

### Supabase Backup Best Practices

1. **Dagelijkse backups** (automatisch via Supabase)
2. **Weekelijkse handmatige backup** (voor belangrijke wijzigingen)
3. **Backup voor migrations** (altijd!)
4. **Bewaar backups extern** (niet alleen in Supabase)
5. **Test restore procedure** (minimaal 1x per maand)

---

## 🚀 Vercel Backups

### Automatische Code Backups

**Goed nieuws:** Je code staat al op GitHub! Dat is je backup.

### Vercel Deployment Backups

Vercel bewaart automatisch alle deployments:

1. **Ga naar:** Vercel Dashboard → Deployments
2. **Alle deployments zijn bewaard:**
   - Je kunt altijd terug naar een eerdere deployment
   - Klik op deployment → "Promote to Production"

### Handmatige Vercel Backup

#### Optie 1: GitHub (Aanbevolen - Al gedaan!)

Je code staat al op GitHub, dat is je backup:
- ✅ Elke commit is een backup
- ✅ Elke branch is een backup
- ✅ GitHub bewaart alles automatisch

#### Optie 2: Lokale Git Backup

```bash
# Clone repository naar backup locatie
git clone https://github.com/RogerGrowSocial/gs-lead-platform.git backups/gs-lead-platform-$(date +%Y%m%d)

# Of maak een bare repository backup
git clone --mirror https://github.com/RogerGrowSocial/gs-lead-platform.git backups/gs-lead-platform-mirror.git
```

#### Optie 3: Environment Variables Backup

**BELANGRIJK:** Backup je environment variables!

1. **Via Vercel Dashboard:**
   - Ga naar: Settings → Environment Variables
   - Screenshot of export naar document

2. **Via Vercel CLI:**
```bash
# Installeer Vercel CLI
npm install -g vercel

# Login
vercel login

# Link project
vercel link

# Export environment variables (niet direct mogelijk, maar je kunt ze bekijken)
vercel env ls
```

**Handmatig backup maken:**
- Maak een document: `backups/environment-variables-$(date +%Y%m%d).txt`
- Kopieer alle environment variables (zonder waarden voor security)
- Bewaar de echte waarden in een password manager (1Password, LastPass, etc.)

### Vercel Backup Best Practices

1. **Code:** GitHub is je backup (al gedaan!)
2. **Environment Variables:** Documenteer in veilige locatie
3. **Deployments:** Vercel bewaart automatisch
4. **Domain configuratie:** Screenshot van DNS settings

---

## 📦 Complete Backup Strategie

### Dagelijks
- ✅ Supabase: Automatisch (via Supabase)
- ✅ Code: Automatisch (via GitHub)

### Weekelijks
- [ ] Handmatige Supabase backup downloaden
- [ ] Environment variables documenteren
- [ ] Test restore procedure

### Maandelijks
- [ ] Volledige database backup downloaden
- [ ] Backup naar externe locatie (Google Drive, AWS S3, etc.)
- [ ] Test complete restore

---

## 🔄 Restore Procedures

### Supabase Database Restore

#### Via Supabase Dashboard:
1. Ga naar: Project Settings → Database → Backups
2. Selecteer backup
3. Klik "Restore" (als beschikbaar)

#### Via SQL:
```bash
# Restore van SQL dump
psql "postgresql://postgres:[PASSWORD]@db.haxwrebdksawioivhlmh.supabase.co:5432/postgres" < backup-20250128.sql
```

#### Via Supabase CLI:
```bash
supabase db reset --db-url "postgresql://postgres:[PASSWORD]@db.haxwrebdksawioivhlmh.supabase.co:5432/postgres" < backup.sql
```

### Vercel Deployment Restore

1. **Ga naar:** Vercel Dashboard → Deployments
2. **Zoek oude deployment**
3. **Klik:** "Promote to Production"
4. **Of:** Rollback via Git:
```bash
git revert HEAD
git push origin main
# Vercel deployt automatisch
```

---

## 🛡️ Backup Security

### Belangrijk:
- ✅ **Nooit backups committen naar GitHub** (bevatten gevoelige data!)
- ✅ **Encrypt backups** met gevoelige data
- ✅ **Bewaar backups extern** (niet alleen lokaal)
- ✅ **Test restore procedures** regelmatig

### Backup Locaties:
1. **Lokaal:** `./backups/` (in .gitignore!)
2. **Extern:** Google Drive, AWS S3, Dropbox
3. **GitHub:** Alleen code (geen .env of database dumps!)

---

## 📝 Backup Checklist

### Supabase
- [ ] Automatische backups zijn actief (standaard)
- [ ] Weekelijkse handmatige backup
- [ ] Backup voor elke migration
- [ ] Backups bewaard extern
- [ ] Restore procedure getest

### Vercel
- [ ] Code op GitHub (✅ al gedaan!)
- [ ] Environment variables gedocumenteerd
- [ ] Domain configuratie gescreenshot
- [ ] Oude deployments bewaard

---

## 🔧 Automatische Backup Script

Maak `scripts/backup-all.sh`:

```bash
#!/bin/bash
# Complete backup script voor Supabase + Vercel

BACKUP_DIR="./backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "🔄 Starting backup..."

# 1. Supabase database backup
echo "📦 Backing up Supabase database..."
pg_dump "$SUPABASE_DB_URL" > "$BACKUP_DIR/supabase-backup.sql"
gzip "$BACKUP_DIR/supabase-backup.sql"

# 2. Environment variables backup (zonder waarden)
echo "📝 Backing up environment variables list..."
vercel env ls > "$BACKUP_DIR/vercel-env-list.txt" 2>/dev/null || echo "Vercel CLI not configured"

# 3. Git backup
echo "💾 Backing up Git repository..."
git bundle create "$BACKUP_DIR/git-backup.bundle" --all

# 4. Compress alles
echo "📦 Compressing backups..."
tar -czf "$BACKUP_DIR/complete-backup.tar.gz" "$BACKUP_DIR"/*

echo "✅ Backup complete: $BACKUP_DIR/complete-backup.tar.gz"
```

**Automatiseer:**
```bash
# Maak script executable
chmod +x scripts/backup-all.sh

# Voeg toe aan crontab (weekelijks op zondag om 2:00 AM)
0 2 * * 0 /path/to/scripts/backup-all.sh
```

---

## 📚 Handige Links

- **Supabase Backups:** https://supabase.com/dashboard/project/_/settings/database
- **Vercel Deployments:** https://vercel.com/dashboard
- **GitHub Repository:** https://github.com/RogerGrowSocial/gs-lead-platform

---

**Laatste update:** 2025-01-28
