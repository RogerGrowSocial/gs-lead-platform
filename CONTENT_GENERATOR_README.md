# Content Generator Feature

## Overview
The Content Generator tool allows users to create social media content posts using templates and uploaded images. This is an MVP implementation focused on content creation (no scheduling yet).

## Location
- **Route**: `/dashboard/tools/content-generator`
- **Sidebar**: Tools > Content generator
- **View**: `views/dashboard/content-generator.ejs`
- **Routes**: `routes/dashboard.js` (lines ~4280+)

## Features

### Brands Management
- Create, edit, and delete brands
- Link brands to existing customers
- Upload brand logos
- Set primary and secondary brand colors
- Specify industry/branche

### Content Generation
- Select brand, platform (Instagram/Facebook/LinkedIn), and format (Square/Portrait)
- Choose from predefined templates
- Upload multiple images (up to 10)
- Generate captions automatically based on:
  - Brand industry
  - Topic
  - CTA/Offer
  - Extra notes
- Save generated posts as drafts

## Database Schema

### Tables
1. **brands** - Brand information with logo and colors
2. **content_templates** - Predefined templates with variations
3. **content_posts** - Generated content posts

### Migration
Run the migration file: `supabase/migrations/20260126000000_content_generator.sql`

This creates:
- All three tables with proper relationships
- RLS policies for user isolation
- Seed data for 2 templates (Template A and Template B, each with 2 variations)

## Storage Buckets

Two Supabase Storage buckets are used:
1. **brand-assets** - Stores brand logos (`{userId}/{brandId}/logo.png`)
2. **content-images** - Stores uploaded content images (`{userId}/{brandId}/{timestamp}-{filename}`)

Buckets are automatically created on first use if they don't exist.

## API Endpoints

### Brands
- `GET /dashboard/api/content-generator/brands` - List user's brands
- `GET /dashboard/api/content-generator/brands/:id` - Get single brand
- `POST /dashboard/api/content-generator/brands` - Create brand
- `PUT /dashboard/api/content-generator/brands/:id` - Update brand
- `DELETE /dashboard/api/content-generator/brands/:id` - Delete brand

### Customers
- `GET /dashboard/api/content-generator/customers` - List customers for dropdown

### Content Generation
- `POST /dashboard/api/content-generator/generate` - Generate content posts
- `PUT /dashboard/api/content-generator/posts/:id` - Update post (caption, status)

## Testing

### Quick Test Flow
1. Navigate to `/dashboard/tools/content-generator`
2. Go to "Brands" tab
3. Click "Add brand"
4. Fill in:
   - Brand name: "Test Brand"
   - Customer: Select any customer
   - Industry: "Retail"
   - Primary color: Pick a color
   - Logo: Upload an image
5. Save brand
6. Go to "Generator" tab
7. Select the brand
8. Upload 1-2 images
9. Enter topic: "Summer Sale"
10. Enter CTA: "20% off"
11. Click "Generate"
12. Verify posts appear in the results list
13. Click "Save" on a post to save as draft

## Future Enhancements
- Scheduling functionality
- Actual image rendering with templates
- AI-powered caption generation
- Post preview
- Publishing to social platforms
- Analytics and performance tracking

## Notes
- MVP scope: No scheduling, no actual rendered images, no AI image generation
- Caption generation is deterministic (uses brand industry, topic, CTA)
- All posts are saved with status 'draft' initially
- Storage buckets are created automatically if missing
