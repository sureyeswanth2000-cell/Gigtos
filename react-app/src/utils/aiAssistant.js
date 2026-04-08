export const SERVICE_CATALOG = [
  {
    id: 1,
    name: 'Plumber',
    icon: '🧰',
    price: 'Quote Based',
    category: 'Home Repair',
    desc: 'Pipe repairs, leak fixing, tap and bathroom installation',
    keywords: ['plumber', 'pipe', 'leak', 'water', 'tap', 'sink', 'drain', 'toilet', 'bathroom'],
  },
  {
    id: 2,
    name: 'Electrician',
    icon: '⚡',
    price: 'Quote Based',
    category: 'Home Repair',
    desc: 'Wiring, switchboards, fans, lights, and appliance repairs',
    keywords: ['electrician', 'wiring', 'fan', 'light', 'switch', 'power', 'voltage', 'socket'],
  },
  {
    id: 3,
    name: 'Carpenter',
    icon: '🪛',
    price: 'Quote Based',
    category: 'Home Repair',
    desc: 'Furniture fixes, shelves, doors, and woodwork',
    keywords: ['carpenter', 'wood', 'door', 'table', 'chair', 'furniture', 'cupboard', 'shelf'],
  },
  {
    id: 4,
    name: 'Painter',
    icon: '🎨',
    price: 'Quote Based',
    category: 'Home Repair',
    desc: 'Interior, exterior, touch-up, and fresh painting jobs',
    keywords: ['painter', 'paint', 'wall', 'color', 'coating', 'putty'],
  },
  // ─── Future Services ──────────────────────────────────────────────────
  {
    id: 5,
    name: 'Driver with Vehicle',
    icon: '🚗',
    price: 'Quote Based',
    category: 'Transport',
    desc: 'Hire a driver who brings their own car for transport or delivery',
    keywords: ['driver', 'car', 'vehicle', 'ride', 'transport', 'delivery', 'cab', 'taxi', 'travel'],
    requiresAsset: true,
    isUpcoming: true,
  },
  {
    id: 6,
    name: 'Driver without Vehicle',
    icon: '🧑‍✈️',
    price: 'Quote Based',
    category: 'Transport',
    desc: 'Hire a driver to drive your own vehicle',
    keywords: ['driver', 'chauffeur', 'drive my car', 'personal driver', 'designated driver'],
    isUpcoming: true,
  },
  {
    id: 7,
    name: 'Home Helper',
    icon: '🏠',
    price: 'Quote Based',
    category: 'Household Help',
    desc: 'General household help — cleaning, cooking, laundry, errands',
    keywords: ['helper', 'maid', 'cook', 'laundry', 'household', 'home help', 'domestic', 'errand'],
    isUpcoming: true,
  },
  {
    id: 8,
    name: 'AC Technician',
    icon: '❄️',
    price: 'Quote Based',
    category: 'Appliance & AC',
    desc: 'AC installation, servicing, gas refill, and repair',
    keywords: ['air conditioner', 'cooling', 'gas refill', 'ac repair', 'ac service', 'split ac', 'window ac', 'ac not working'],
    isUpcoming: true,
  },
  {
    id: 9,
    name: 'Pest Control',
    icon: '🐛',
    price: 'Quote Based',
    category: 'Cleaning',
    desc: 'Termite, cockroach, mosquito, and rodent treatment',
    keywords: ['pest', 'termite', 'cockroach', 'mosquito', 'rodent', 'rat', 'ant', 'bug', 'insect'],
    isUpcoming: true,
  },
  {
    id: 10,
    name: 'Appliance Repair',
    icon: '🔌',
    price: 'Quote Based',
    category: 'Appliance & AC',
    desc: 'Washing machine, fridge, microwave, geyser repair',
    keywords: ['appliance', 'washing machine', 'fridge', 'refrigerator', 'microwave', 'geyser', 'oven', 'mixer'],
    isUpcoming: true,
  },
  {
    id: 11,
    name: 'Deep Cleaning',
    icon: '🧹',
    price: 'Quote Based',
    category: 'Cleaning',
    desc: 'Full-house or office deep cleaning, sofa, carpet, kitchen cleaning',
    keywords: ['deep clean', 'deep cleaning', 'sofa cleaning', 'carpet', 'kitchen cleaning', 'bathroom cleaning', 'office cleaning'],
    isUpcoming: true,
  },
  {
    id: 12,
    name: 'Security Guard',
    icon: '🛡️',
    price: 'Quote Based',
    category: 'Security',
    desc: 'Trained security personnel for events, homes, or offices',
    keywords: ['security', 'guard', 'watchman', 'patrol', 'event security', 'bouncer'],
    isUpcoming: true,
  },
];

export const SERVICE_CATEGORIES = [
  { name: 'Home Repair',     icon: '🔧', sortOrder: 1 },
  { name: 'Transport',       icon: '🚗', sortOrder: 2 },
  { name: 'Household Help',  icon: '🏠', sortOrder: 3 },
  { name: 'Appliance & AC',  icon: '❄️', sortOrder: 4 },
  { name: 'Cleaning',        icon: '🧹', sortOrder: 5 },
  { name: 'Security',        icon: '🛡️', sortOrder: 6 },
];

export function getActiveServices() {
  return SERVICE_CATALOG.filter((s) => !s.isUpcoming);
}

export function getUpcomingServices() {
  return SERVICE_CATALOG.filter((s) => s.isUpcoming);
}

export function getServicesByCategory(category) {
  return SERVICE_CATALOG.filter((s) => s.category === category);
}

export function normalizeServiceName(value = '') {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/electrican/g, 'electrician')
    .replace(/plummer/g, 'plumber')
    .replace(/carpanter/g, 'carpenter')
    .replace(/vehical/g, 'vehicle')
    .replace(/gaurd/g, 'guard')
    .replace(/technision/g, 'technician')
    .replace(/cleanning/g, 'cleaning');
}

export function findRelevantService(message = '') {
  const normalizedMessage = normalizeServiceName(message);

  return SERVICE_CATALOG.find((service) =>
    service.keywords.some((keyword) => normalizedMessage.includes(normalizeServiceName(keyword)))
  ) || null;
}

export function formatPriceInsight(insight = {}) {
  const minQuote = Number(insight.minQuote);
  const maxQuote = Number(insight.maxQuote);
  const averageQuote = Number(insight.averageQuote);
  const quoteCount = Number(insight.quoteCount || 0);

  if (!Number.isFinite(minQuote) || !Number.isFinite(maxQuote) || minQuote <= 0 || maxQuote <= 0) {
    return 'Quote on request';
  }

  const avgLabel = Number.isFinite(averageQuote) && averageQuote > 0 ? ` (avg ₹${Math.round(averageQuote)} from ${quoteCount} quotes)` : '';
  return `₹${Math.round(minQuote)} - ₹${Math.round(maxQuote)}${avgLabel}`;
}

function getInsightForService(insights = [], serviceName = '') {
  const target = normalizeServiceName(serviceName);
  return insights.find((insight) => {
    const candidate = insight.service || insight.name || insight.serviceType || '';
    return normalizeServiceName(candidate) === target;
  }) || null;
}

export function buildPromptSuggestions(selectedService) {
  const serviceLabel = selectedService || 'service';
  return [
    `Which ${serviceLabel} should I book?`,
    `Expected cost for ${serviceLabel}?`,
    'Help me book',
  ];
}

export function buildLocalAssistantFallback({ message = '', selectedService = '', insights = [] }) {
  const relevantService = selectedService || findRelevantService(message)?.name || 'home service';
  const serviceInsight = getInsightForService(insights, relevantService);
  const lowerMessage = message.toLowerCase();

  if (serviceInsight && /(compare|cost|price|cheap|cheapest|worker)/i.test(lowerMessage)) {
    return `${relevantService} has ${serviceInsight.availableWorkers || 0} workers. Typical quotes: ${formatPriceInsight(serviceInsight)}. Book now to get exact bids.`;
  }

  if (serviceInsight && /(available|availability|service)/i.test(lowerMessage)) {
    return `${relevantService} is available now. Approx quote: ${formatPriceInsight(serviceInsight)}.`;
  }

  if (/(book|booking|help|how)/i.test(lowerMessage)) {
    const matchedService = findRelevantService(message)?.name || relevantService;
    return `Choose ${matchedService}, confirm your address and phone, and submit to receive quotes.`;
  }

  const activeNames = getActiveServices().map((s) => s.name.toLowerCase()).join(', ');
  return `Ask about ${activeNames} and I'll guide you.`;
}
