// Mock data voor Lead Engine pagina

const MOCK_SEGMENTS = [
  {
    id: '1',
    segmentLabel: 'Schilder • Noord-Brabant',
    branch: 'Schilder',
    region: 'Noord-Brabant',
    targetPerDay: 12,
    actualPerDay: 10,
    gap: -2,
    status: 'onder',
    partners: 8
  },
  {
    id: '2',
    segmentLabel: 'Dakdekker • Zuid-Holland',
    branch: 'Dakdekker',
    region: 'Zuid-Holland',
    targetPerDay: 15,
    actualPerDay: 18,
    gap: 3,
    status: 'over',
    partners: 12
  },
  {
    id: '3',
    segmentLabel: 'Electricien • Utrecht',
    branch: 'Electricien',
    region: 'Utrecht',
    targetPerDay: 8,
    actualPerDay: 8,
    gap: 0,
    status: 'balans',
    partners: 6
  },
  {
    id: '4',
    segmentLabel: 'Loodgieter • Gelderland',
    branch: 'Loodgieter',
    region: 'Gelderland',
    targetPerDay: 10,
    actualPerDay: 11,
    gap: 1,
    status: 'over',
    partners: 9
  },
  {
    id: '5',
    segmentLabel: 'Schilder • Limburg',
    branch: 'Schilder',
    region: 'Limburg',
    targetPerDay: 6,
    actualPerDay: 5,
    gap: -1,
    status: 'onder',
    partners: 4
  }
];

const MOCK_CAPACITY_DATA = [
  {
    segmentLabel: 'Schilder • Noord-Brabant',
    partners: 8,
    capacityPerDay: 45,
    occupancy: 89,
    avgResponseTime: '2,3 uur',
    conversionRate: 24
  },
  {
    segmentLabel: 'Dakdekker • Zuid-Holland',
    partners: 12,
    capacityPerDay: 68,
    occupancy: 76,
    avgResponseTime: '1,8 uur',
    conversionRate: 31
  },
  {
    segmentLabel: 'Electricien • Utrecht',
    partners: 6,
    capacityPerDay: 32,
    occupancy: 72,
    avgResponseTime: '3,1 uur',
    conversionRate: 28
  },
  {
    segmentLabel: 'Loodgieter • Gelderland',
    partners: 9,
    capacityPerDay: 52,
    occupancy: 65,
    avgResponseTime: '2,5 uur',
    conversionRate: 22
  }
];

const MOCK_LOW_CAPACITY = [
  { segment: 'Schilder • Limburg', partners: 4, occupancy: 95 },
  { segment: 'Loodgieter • Friesland', partners: 3, occupancy: 92 },
  { segment: 'Dakdekker • Groningen', partners: 5, occupancy: 88 }
];

const MOCK_TOP_PERFORMERS = [
  { segment: 'Dakdekker • Zuid-Holland', leads: 126, conversionRate: 31 },
  { segment: 'Electricien • Utrecht', leads: 56, conversionRate: 28 },
  { segment: 'Schilder • Noord-Brabant', leads: 70, conversionRate: 24 }
];

const MOCK_AI_RECOMMENDATIONS = [
  {
    id: 'ai-1',
    segmentLabel: 'Schilder • Noord-Brabant',
    summary: "Nieuwe landingspagina + AdGroup 'schilder tilburg'",
    fullSummary: "Dit segment heeft gemiddeld 6 leads per dag tekort. AI stelt voor om een nieuwe landingspagina + AdGroup in Google Ads te maken gericht op 'schilder tilburg' en 'schilder den bosch'.",
    impact: 'Hoog',
    status: 'Wacht op review',
    lastUpdated: '2 uur geleden',
    leadGap: '6/dag',
    currentCpl: '€35',
    targetCpl: '€25',
    landingPage: {
      url: '/schilder/noord-brabant/tilburg',
      h1: 'Schilder in Tilburg nodig? Binnen 24 uur een vakman in je inbox',
      subheadline: 'Vergelijk snel offertes van gecertificeerde schilders uit Tilburg en omgeving.'
    },
    googleAds: {
      campaignName: 'GS | Schilder | Noord-Brabant',
      adGroupName: 'Schilder Tilburg spoed',
      keywords: ['schilder tilburg', 'schilder gezocht tilburg', 'schilder tilburg binnen schilderwerk', 'schilder tilburg offerte'],
      negativeKeywords: ['vacature', 'opleiding', 'doe-het-zelf'],
      ads: [
        {
          headlines: ['Schilder in Tilburg nodig?', 'Binnen 24 uur een offerte', 'Lokale vakmannen vergeleken'],
          description: 'Ontvang snel offertes van erkende schilders in Tilburg. Gratis & vrijblijvend.',
          path: 'schilder/tilburg'
        },
        {
          headlines: ['Schilder Tilburg gezocht?', 'Vergelijk direct offertes', 'Snel & betrouwbaar'],
          description: 'Professionele schilders uit Tilburg en omgeving. Binnen 24 uur reactie.',
          path: 'schilder/tilburg'
        }
      ]
    }
  },
  {
    id: 'ai-2',
    segmentLabel: 'Dakdekker • Zuid-Holland',
    summary: 'Optimalisatie bestaande ads + nieuwe zoekwoorden',
    fullSummary: 'Dit segment presteert goed maar kan geoptimaliseerd worden met extra long-tail zoekwoorden.',
    impact: 'Medium',
    status: 'In uitvoering',
    lastUpdated: '1 dag geleden',
    leadGap: '0/dag',
    currentCpl: '€42',
    targetCpl: '€38',
    landingPage: {
      url: '/dakdekker/zuid-holland/rotterdam',
      h1: 'Dakdekker in Rotterdam nodig?',
      subheadline: 'Vergelijk offertes van professionele dakdekkers.'
    },
    googleAds: {
      campaignName: 'GS | Dakdekker | Zuid-Holland',
      adGroupName: 'Dakdekker Rotterdam',
      keywords: ['dakdekker rotterdam', 'dakdekker rotterdam spoed', 'dakdekker gezocht rotterdam'],
      negativeKeywords: ['vacature', 'stage', 'zelf doen'],
      ads: [
        {
          headlines: ['Dakdekker Rotterdam nodig?', 'Binnen 48 uur offerte', 'Betrouwbare vakmannen'],
          description: 'Vergelijk direct offertes van gecertificeerde dakdekkers in Rotterdam.',
          path: 'dakdekker/rotterdam'
        }
      ]
    }
  }
];

const MOCK_CONTENT_BACKLOG = [
  {
    id: 'content-1',
    type: 'Landingspagina',
    title: 'Schilder in Tilburg nodig?',
    segment: 'Schilder • Noord-Brabant',
    channel: 'Website/SEO',
    status: 'Wacht op review',
    lastUpdated: '2 uur geleden'
  },
  {
    id: 'content-2',
    type: 'Ads',
    title: 'AdGroup: Dakdekker Rotterdam',
    segment: 'Dakdekker • Zuid-Holland',
    channel: 'Google Ads',
    status: 'Live',
    lastUpdated: '3 dagen geleden'
  },
  {
    id: 'content-3',
    type: 'Blog',
    title: 'Wat kost een schilder in 2025?',
    segment: 'Schilder • Noord-Brabant',
    channel: 'Blog/SEO',
    status: 'Concept',
    lastUpdated: '1 week geleden'
  },
  {
    id: 'content-4',
    type: 'Landingspagina',
    title: 'Electricien in Utrecht gezocht?',
    segment: 'Electricien • Utrecht',
    channel: 'Website/SEO',
    status: 'Goedgekeurd',
    lastUpdated: '5 dagen geleden'
  }
];

const MOCK_CHART_DATA = [
  { date: '1 jan', target: 45, actual: 42 },
  { date: '3 jan', target: 45, actual: 48 },
  { date: '5 jan', target: 45, actual: 44 },
  { date: '7 jan', target: 45, actual: 51 },
  { date: '9 jan', target: 45, actual: 47 },
  { date: '11 jan', target: 45, actual: 49 },
  { date: '13 jan', target: 45, actual: 52 },
  { date: '15 jan', target: 45, actual: 46 },
  { date: '17 jan', target: 45, actual: 50 },
  { date: '19 jan', target: 45, actual: 48 },
  { date: '21 jan', target: 45, actual: 53 },
  { date: '23 jan', target: 45, actual: 47 },
  { date: '25 jan', target: 45, actual: 49 },
  { date: '27 jan', target: 45, actual: 51 },
  { date: '29 jan', target: 45, actual: 47 }
];

