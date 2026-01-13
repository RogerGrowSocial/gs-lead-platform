# GrowSocial Lead Platform - Google Ads API Design Document

**Version:** 1.0  
**Date:** January 2025  
**Company:** GrowSocial  
**Contact:** info@growsocialmedia.nl

---

## Executive Summary

GrowSocial is a B2B lead generation platform that connects local service providers (painters, roofers, electricians, etc.) with potential customers through an automated lead routing system. This document describes the design and architecture of our Lead Flow Intelligence System, which uses the Google Ads API to automatically optimize campaign budgets based on real-time lead demand and supply.

---

## 1. System Overview

### 1.1 Business Model

GrowSocial operates as a platform/agency model where we:
- Manage multiple Google Ads accounts via a Manager Account (MCC)
- Generate leads for different industry segments (branches) and geographic regions
- Automatically route leads to appropriate service providers based on capacity and preferences
- Optimize marketing spend to maximize lead generation efficiency

### 1.2 Core Problem Solved

The system addresses the challenge of:
- **Lead Supply/Demand Imbalance**: Ensuring we generate the right number of leads for each segment (industry + region combination)
- **Budget Optimization**: Automatically adjusting Google Ads budgets based on real-time demand
- **Multi-Account Management**: Managing campaigns across multiple partner accounts via a single Manager Account

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Lead Flow Intelligence System            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Lead       │    │   Segment    │    │   Demand     │  │
│  │   Segment    │───▶│   Service    │───▶│   Planner    │  │
│  │   Service    │    │              │    │   Service    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │         │
│         │                    │                    │         │
│         ▼                    ▼                    ▼         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Database (Supabase/PostgreSQL)              │   │
│  │  • lead_segments                                     │   │
│  │  • lead_generation_stats                             │   │
│  │  • lead_segment_plans                                │   │
│  │  • channel_orchestration_log                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Channel Orchestrator Service                  │   │
│  │  • Calculates budget adjustments                      │   │
│  │  • Applies safety limits (±20% max change per day)   │   │
│  │  • Logs all changes                                   │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Google Ads API Client                         │   │
│  │  • Updates campaign budgets                           │   │
│  │  • Fetches campaign statistics                        │   │
│  │  • Manages multiple accounts via MCC                   │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Google Ads Manager Account (MCC)              │   │
│  │  • Multiple customer accounts                        │   │
│  │  • Centralized campaign management                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

**Daily Automated Process:**

1. **Lead Aggregation (01:00 daily)**
   - System aggregates all leads created in the past 24 hours
   - Groups by segment (industry + region)
   - Calculates metrics: leads generated, acceptance rate, CPL
   - Stores in `lead_generation_stats` table

2. **Demand Planning (02:00 daily)**
   - System calculates target leads per segment (80% of partner capacity)
   - Compares target vs. actual leads generated
   - Calculates lead gap (target - actual)
   - Stores in `lead_segment_plans` table

3. **Budget Orchestration (03:00 daily)**
   - System reads lead gaps for all active segments
   - Calculates required budget adjustments
   - Applies safety limits (max ±20% change per day)
   - Calls Google Ads API to update campaign budgets
   - Logs all changes in `channel_orchestration_log`

---

## 3. Google Ads API Usage

### 3.1 API Operations

**Primary Operations:**

1. **Campaign Budget Updates**
   - **Method**: `CampaignBudgetService.mutateCampaignBudgets()`
   - **Frequency**: Daily (once per segment with a gap)
   - **Purpose**: Adjust daily budgets based on lead gaps
   - **Safety**: Maximum 20% change per day per campaign

2. **Campaign Statistics Retrieval**
   - **Method**: `GoogleAdsService.search()`
   - **Frequency**: Daily (for all active campaigns)
   - **Purpose**: Fetch spend, clicks, impressions, conversions
   - **Usage**: Calculate actual CPL and performance metrics

3. **Campaign Listing**
   - **Method**: `GoogleAdsService.search()`
   - **Frequency**: On-demand (when needed)
   - **Purpose**: List all active campaigns per account
   - **Usage**: Map segments to campaign IDs

### 3.2 Account Structure

- **Manager Account (MCC)**: Single account managing all customer accounts
- **Customer Accounts**: Individual Google Ads accounts for each partner
- **Campaigns**: One campaign per segment (e.g., "Schilder - Noord-Brabant")
- **Mapping**: Segment code → Campaign name → Campaign ID

### 3.2.1 User Access Model

**Current Implementation:**
- **Internal Users (Admins)**: Full access to Google Ads API via admin dashboard
  - Can view all campaigns across all partners
  - Can adjust budgets and monitor performance
  - Can create and manage segments

**Future Implementation:**
- **External Users (Partners)**: Self-service access via partner portal
  - Partners can view their own campaigns
  - Partners can create new campaigns for their segments
  - Partners can adjust budgets (within limits set by admin)
  - Partners can view performance reports for their campaigns

**Access Control:**
- All API calls are authenticated via OAuth2
- Row Level Security (RLS) ensures partners only see their own data
- Admin users have elevated permissions via role-based access control

### 3.3 Supported Campaign Types

Our system supports the following Google Ads campaign types:

1. **Search Campaigns (Standard)**
   - Primary campaign type for lead generation
   - Targets users searching for local services (e.g., "schilder in Tilburg")
   - Text ads displayed in Google Search results
   - Best suited for high-intent lead generation

2. **Performance Max Campaigns**
   - Automated campaign type for broader reach
   - Uses Google's AI to optimize across all Google properties
   - Suitable for scaling lead generation across multiple touchpoints

3. **Local Campaigns**
   - Specifically designed for local businesses
   - Promotes physical locations and local services
   - Ideal for our use case (local service providers)

**Note**: Our API implementation works with campaign budgets and statistics regardless of campaign type. The system does not create or modify campaign settings beyond budget adjustments.

### 3.4 Rate Limits & Quotas

- **Daily Operations Limit**: 15,000 operations per day
- **Our Usage**: ~100-500 operations per day (well within limits)
- **Operations per Segment**: 1-2 operations per day (budget update + stats fetch)

---

## 4. Technical Implementation

### 4.1 Technology Stack

- **Backend**: Node.js with Express
- **Database**: Supabase (PostgreSQL)
- **Google Ads API**: Official Node.js client library (`google-ads-api`)
- **Authentication**: OAuth2 with refresh tokens
- **Scheduling**: Node-cron for daily jobs

### 4.2 Key Components

**1. GoogleAdsClient (`integrations/googleAdsClient.js`)**
- Handles OAuth2 authentication
- Manages API client initialization
- Provides methods for budget updates and stats retrieval
- Implements error handling and retry logic

**2. ChannelOrchestratorService (`services/channelOrchestratorService.js`)**
- Calculates budget adjustments based on lead gaps
- Applies safety limits and validation
- Coordinates with GoogleAdsClient
- Logs all orchestration actions

**3. LeadDemandPlannerService (`services/leadDemandPlannerService.js`)**
- Calculates target leads per segment (80% of capacity)
- Computes lead gaps (target - actual)
- Updates planning records in database

**4. LeadSegmentService (`services/leadSegmentService.js`)**
- Manages segment definitions
- Calculates partner capacity per segment
- Assigns segments to incoming leads

### 4.3 Database Schema

**Core Tables:**

- `lead_segments`: Defines segments (industry + region combinations)
- `lead_generation_stats`: Daily aggregated statistics per segment
- `lead_segment_plans`: Daily planning with targets and gaps
- `channel_orchestration_log`: Log of all budget adjustments

**Key Fields:**
- `segment_id`: Links all data to a specific segment
- `lead_gap`: Target leads - actual leads (positive = need more, negative = too many)
- `orchestration_status`: Status of budget adjustment (pending, processing, completed, failed)
- `budget_change_percentage`: Actual percentage change applied

---

## 5. Security & Privacy

### 5.1 Authentication

- **OAuth2**: Secure authentication with Google
- **Refresh Tokens**: Stored securely in environment variables
- **No Hardcoded Credentials**: All credentials in `.env` file (not in code)

### 5.2 Data Access

- **Row Level Security (RLS)**: Database policies ensure data isolation
- **Admin Only**: API endpoints require admin authentication
- **Audit Logging**: All budget changes are logged with timestamps and user info

### 5.3 Privacy Compliance

- **No PII in API Calls**: We only send campaign IDs and budget amounts
- **GDPR Compliant**: All lead data is handled according to GDPR regulations
- **Data Minimization**: Only necessary data is sent to Google Ads API

---

## 6. Safety & Validation

### 6.1 Budget Change Limits

- **Maximum Change**: ±20% per day per campaign
- **Minimum Budget**: €5.00 per day
- **Maximum Budget**: €1,000.00 per day (configurable)

### 6.2 Error Handling

- **API Failures**: System logs errors and retries with exponential backoff
- **Validation**: All budget changes are validated before API calls
- **Rollback**: Failed changes are logged but not applied

### 6.3 Monitoring

- **Logging**: All operations logged to `channel_orchestration_log` table
- **Alerts**: System can send notifications on critical failures
- **Dashboard**: Admin dashboard shows orchestration status and history

---

## 7. Use Cases

### 7.1 Scenario: Lead Gap Detected

**Situation**: Segment "Schilder - Noord-Brabant" has a gap of 10 leads (target: 20, actual: 10)

**Process**:
1. System calculates required budget: 10 leads × €25 CPL = €250 additional budget
2. System checks current budget: €100/day
3. System calculates new budget: €100 + €250 = €350/day
4. System validates: €350 is within limits (€5-€1,000) and within 20% change limit
5. System calls Google Ads API to update campaign budget
6. System logs change: "Budget increased from €100 to €350 (+250%)"

### 7.2 Scenario: Too Many Leads

**Situation**: Segment "Dakdekker - Randstad" has negative gap of -5 leads (target: 15, actual: 20)

**Process**:
1. System calculates budget reduction: -5 leads × €25 CPL = -€125
2. System checks current budget: €200/day
3. System calculates new budget: €200 - €125 = €75/day
4. System validates: €75 is above minimum (€5) and within 20% change limit
5. System calls Google Ads API to reduce budget
6. System logs change: "Budget decreased from €200 to €75 (-62.5%)"

---

## 8. Future Enhancements

### 8.1 Planned Features

- **AI-Powered Predictions**: Use historical data to predict seasonal patterns
- **Multi-Channel Support**: Extend to Meta Ads, LinkedIn Ads, etc.
- **Keyword Optimization**: AI-suggested keyword adjustments via Keyword Planning API
- **A/B Testing**: Automated ad copy and landing page testing
- **Campaign Creation**: Automated campaign creation for new segments via Google Ads API
- **Account Management**: Enhanced account-level optimizations and settings management
- **Partner Self-Service Portal**: Allow partners to create and manage their own Google Ads campaigns through the dashboard

### 8.2 Scalability

- **Current**: Handles ~50 segments
- **Target**: Scale to 500+ segments
- **Architecture**: Designed for horizontal scaling

---

## 9. Compliance & Best Practices

### 9.1 Google Ads API Guidelines

- ✅ **Rate Limiting**: Respects all rate limits
- ✅ **Error Handling**: Proper error handling and retry logic
- ✅ **Data Validation**: All inputs validated before API calls
- ✅ **Audit Trail**: Complete logging of all operations

### 9.2 Industry Standards

- ✅ **RESTful Design**: Clean API architecture
- ✅ **Separation of Concerns**: Modular service design
- ✅ **Documentation**: Comprehensive code documentation
- ✅ **Testing**: Unit tests for critical functions

---

## 10. Contact & Support

**Company**: GrowSocial  
**Email**: info@growsocialmedia.nl  
**Website**: https://growsocialmedia.nl

**Technical Contact**:  
For technical questions about this implementation, please contact our development team at the email above.

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Status**: Production Ready

---

## Appendix A: API Endpoints

**Internal API Endpoints (for reference):**

- `GET /api/lead-segments` - List all active segments
- `GET /api/lead-segments/:id/stats` - Get statistics for a segment
- `GET /api/lead-segments/:id/plans` - Get planning data for a segment
- `GET /api/orchestration/status` - Get orchestration status
- `GET /api/admin/leadstroom/overview` - Dashboard overview data

---

## Appendix B: Environment Variables

**Required Environment Variables:**

```env
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
GOOGLE_ADS_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=your-client-secret
GOOGLE_ADS_REFRESH_TOKEN=your-refresh-token
GOOGLE_ADS_CUSTOMER_ID=your-manager-account-id
```

---

**End of Document**

