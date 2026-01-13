# Scraper Module Documentation

## Overview

The Scraper module allows admin/manager users to find potential customers (kansen) using AI-powered web scraping. It combines Tavily API for web search with OpenAI for data extraction and enrichment.

## Environment Variables

The following environment variables must be set in your `.env` file:

```env
TAVILY_API_KEY=tvly-your-api-key-here
OPENAI_API_KEY=sk-your-api-key-here
```

### Getting API Keys

**Tavily API Key:**
1. Go to [https://tavily.com](https://tavily.com)
2. Sign up for an account
3. Navigate to your dashboard/API keys section
4. Copy your API key (format: `tvly-xxxxxxxxxxxxx`)
5. Add to `.env` as `TAVILY_API_KEY`

**OpenAI API Key:**
1. Go to [https://platform.openai.com](https://platform.openai.com)
2. Sign in or create an account
3. Navigate to API keys section
4. Create a new API key
5. Add to `.env` as `OPENAI_API_KEY`

## Database Setup

### Running Migrations

1. **Apply the migration:**
   ```bash
   # Option 1: Via Supabase Dashboard
   # - Go to SQL Editor
   # - Copy contents of supabase/migrations/20260111000000_create_scraper_module.sql
   # - Execute the SQL

   # Option 2: Via Supabase CLI (if configured)
   supabase migration up
   ```

2. **Seed call scripts:**
   ```bash
   # Via Supabase Dashboard SQL Editor
   # Copy contents of supabase/migrations/20260111000001_seed_scraper_call_scripts.sql
   # Execute the SQL
   ```

### Migration Files

- `supabase/migrations/20260111000000_create_scraper_module.sql`
  - Creates `scraper_jobs` table
  - Creates `scraper_results` table
  - Creates `scraper_call_scripts` table
  - Sets up RLS policies (admin/manager only)
  - Creates indexes and triggers

- `supabase/migrations/20260111000001_seed_scraper_call_scripts.sql`
  - Seeds initial call scripts for active services
  - Scripts are in Dutch and service-specific

## Access Control

### Route Guards

- **Route:** `/admin/scraper`
- **Middleware:** `requireAuth` + `isManagerOrAdmin`
- **Access:** Admin and Manager roles only
- **Employees:** No access (cannot view or run scrapes)

### Server-Side Authorization

All API endpoints enforce authorization:
- `POST /api/admin/scraper/jobs` - Admin/Manager only
- `GET /api/admin/scraper/jobs` - Admin/Manager only
- `GET /api/admin/scraper/jobs/:id` - Admin/Manager only
- `GET /api/admin/scraper/jobs/:id/results` - Admin/Manager only
- `POST /api/admin/scraper/jobs/:id/cancel` - Admin/Manager only
- `POST /api/admin/scraper/results/:resultId/create-kans` - Admin/Manager only
- `GET /api/admin/scraper/scripts` - Admin/Manager only
- `PATCH /api/admin/scraper/scripts/:id` - Admin/Manager only

## Navigation

The "Scraper" menu item is added to the admin sidebar in `views/layouts/admin.ejs`:
- Location: After "Tijdregistratie" menu item
- Icon: Cube/package icon
- Visibility: Admin/Manager only (same visibility logic as other admin items)

## Usage Guide

### Starting a Scrape

1. Navigate to `/admin/scraper`
2. Fill in the configuration:
   - **Locatie:** City, postcode, or free text (required)
   - **Radius:** Search radius in km (default: 20)
   - **Branches:** Select from existing branches or add custom branches
   - **Dienst:** Select a service for AI targeting (optional)
   - **Gewenste velden:** Check which fields to extract
   - **Max resultaten:** Maximum number of results (default: 50)
   - **Max pagina's per domein:** Limit pages per domain (default: 2)
   - **Alleen Nederland:** Toggle to limit to NL domains
3. Click "Scrape" to start
4. Monitor progress in real-time
5. Results stream in as they're found

### Viewing Results

- Results appear in a table as they're found
- Click any row to view full details in a drawer
- Use filters:
  - "Alleen met telefoon" - Only show results with phone
  - "Alleen met e-mail" - Only show results with email
  - "Min score" - Filter by fit score (0-100)

### Result Actions

From the detail drawer:
- **Bel:** Click to call (tel: link) if phone exists
- **Lees script:** View/edit call script for the selected service
- **Maak kans aan:** Convert result to an opportunity (kans)

### Call Scripts

- Scripts are service-specific
- Managers/Admins can edit scripts
- Scripts are in Dutch
- Default scripts are seeded for active services

## Service-Aware AI Targeting

When a service is selected, the AI adjusts:

1. **Tavily Query Templates:** Service-specific search queries
2. **OpenAI Extraction:** Service-aware fit scoring

### Service-Specific Logic

- **Website onderhoud:** Prefers businesses with existing but outdated websites
- **Google Ads:** Prefers businesses already advertising or with clear lead intent
- **SEO:** Prefers businesses with websites but low visibility
- **Website development:** Prefers businesses with no/poor website presence
- **E-mailmarketing:** Prefers businesses with webshop/newsletter or multiple locations

Fit scores (0-100) indicate how well a business matches the selected service.

## API Endpoints

### POST /api/admin/scraper/jobs

Create a new scraper job.

**Request Body:**
```json
{
  "location_text": "Amsterdam",
  "radius_km": 20,
  "branches": ["Dakdekkers", "Schilders"],
  "service_id": "uuid-optional",
  "desired_fields": ["company_name", "website", "phone", "email"],
  "max_results": 50,
  "only_nl": true,
  "max_pages_per_domain": 2
}
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "uuid",
    "status": "queued",
    ...
  }
}
```

### GET /api/admin/scraper/jobs

List recent jobs.

**Query Parameters:**
- `limit` (optional, default: 20)

**Response:**
```json
{
  "jobs": [...]
}
```

### GET /api/admin/scraper/jobs/:id

Get job details and progress.

**Response:**
```json
{
  "job": {
    "id": "uuid",
    "status": "running",
    "progress_total": 10,
    "progress_done": 5,
    "progress_found": 12,
    "progress_enriched": 12,
    "progress_errors": 0,
    ...
  }
}
```

### GET /api/admin/scraper/jobs/:id/results

Get results for a job.

**Query Parameters:**
- `cursor` (optional) - Pagination cursor
- `has_phone` (optional, boolean) - Filter by phone
- `has_email` (optional, boolean) - Filter by email
- `min_score` (optional, number) - Minimum fit score

**Response:**
```json
{
  "results": [...]
}
```

### POST /api/admin/scraper/jobs/:id/cancel

Cancel a running job.

**Response:**
```json
{
  "success": true,
  "job": {...}
}
```

### POST /api/admin/scraper/results/:resultId/create-kans

Convert a result to an opportunity.

**Response:**
```json
{
  "success": true,
  "opportunity": {...}
}
```

### GET /api/admin/scraper/scripts

Get call scripts.

**Query Parameters:**
- `service_id` (optional) - Filter by service

**Response:**
```json
{
  "scripts": [...]
}
```

### PATCH /api/admin/scraper/scripts/:id

Update a call script.

**Request Body:**
```json
{
  "script_text": "New script text...",
  "title": "Optional title"
}
```

**Response:**
```json
{
  "success": true,
  "script": {...}
}
```

## Testing Guide

### Manual Testing

1. **Setup:**
   - Ensure environment variables are set
   - Run migrations
   - Seed call scripts

2. **Test Scrape:**
   - Log in as admin/manager
   - Navigate to `/admin/scraper`
   - Fill in config (use a small location like "Amsterdam")
   - Set max_results to 5 for quick testing
   - Click "Scrape"
   - Verify progress updates
   - Verify results appear

3. **Test Detail View:**
   - Click a result row
   - Verify drawer opens with all fields
   - Test "Bel" button (if phone exists)
   - Test "Lees script" button
   - Test "Maak kans aan" button

4. **Test Script Editing:**
   - Open script modal
   - Select a service
   - Edit script text
   - Save
   - Verify script is updated

5. **Test Filters:**
   - Apply "Only with phone" filter
   - Apply "Only with email" filter
   - Apply min score filter
   - Verify results update

6. **Test History:**
   - Click "Geschiedenis" button
   - Verify previous jobs are listed

### Expected Behavior

- Jobs start immediately after creation
- Progress updates every 2 seconds
- Results stream in as they're found
- Fit scores are between 0-100
- Only admin/manager can access
- Employees cannot access (403 error)

## Troubleshooting

### "TAVILY_API_KEY not configured"

- Check `.env` file has `TAVILY_API_KEY` set
- Restart the server after adding env vars
- Verify API key is valid at tavily.com

### "OPENAI_API_KEY not configured"

- Check `.env` file has `OPENAI_API_KEY` set
- Restart the server after adding env vars
- Verify API key is valid at platform.openai.com

### Jobs stuck in "queued" status

- Check server logs for errors
- Verify Tavily/OpenAI API keys are valid
- Check network connectivity

### No results found

- Try larger radius
- Try different branches
- Check if location is valid
- Verify "Only NL" toggle (if searching internationally)

### Results have low fit scores

- Select a service for better targeting
- Try different branches
- Adjust desired fields

## File Structure

```
supabase/migrations/
  20260111000000_create_scraper_module.sql
  20260111000001_seed_scraper_call_scripts.sql

services/
  scraperService.js

routes/
  admin.js (scraper endpoints added)

views/
  admin/scraper.ejs

public/
  css/admin/scraper.css
  js/admin/scraper.js
```

## Integration Points

### Opportunities (Kansen)

When "Maak kans aan" is clicked:
- Creates an opportunity in `opportunities` table
- Links result via `opportunity_id` in `scraper_results`
- Updates result status to `created_as_kans`
- Reuses existing opportunity creation logic

### Services

- Scraper uses `services` table for service selection
- Call scripts are linked to services via `service_id`
- Service selection affects AI targeting

### Branches

- Uses `customer_branches` table for branch selection
- Supports custom branches (user-typed)
- Branches affect search queries

## Performance Considerations

- **Concurrency:** Jobs process 3 queries concurrently
- **Rate Limiting:** Max results enforced, max pages per domain enforced
- **Polling:** Progress polls every 2s, results every 3s
- **Deduplication:** Results deduplicated by domain or name+city

## Future Enhancements

- Real-time updates via Supabase Realtime (instead of polling)
- Export results to CSV
- Bulk create kansen
- Scheduled scrapes
- More service-specific targeting rules
- Confidence score thresholds
- Custom extraction prompts per service

