# Supabase Storage Setup (Vercel uploads)

Voor Vercel-deployment worden alle uploads naar Supabase Storage gestuurd (read-only filesystem).

## Bucket `uploads`

1. Ga naar Supabase Dashboard → **Storage**
2. Klik **New bucket**
3. Naam: `uploads`
4. **Public bucket**: aan (voor profile pictures, logos, etc.)
5. Save

## Mappen in de bucket

De code maakt automatisch submappen aan bij upload:

- `profiles/` – profile pictures
- `signatures/` – handtekeningfoto’s
- `contact-photos/` – contactfoto’s
- `customer-contracts/` – klantcontracten (PDF/DOC)
- `contracts/` – werknemercontracten
- `customer-logos/` – klantlogo’s
- `content-images/` – content generator images

## RLS (Row Level Security)

Bucket `uploads` is publiek; bestanden zijn via public URL bereikbaar. Beperk indien nodig via Storage policies (vraag naar de juiste policies).

## Verificatie

Na setup:

1. Upload een profile picture via de app
2. Controleer in Supabase Storage of het bestand in `uploads/profiles/` staat
