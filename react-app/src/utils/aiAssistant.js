export const SERVICE_CATALOG = [
  {
    id: 1,
    name: 'Plumber',
    icon: '🧰',
    price: 'Quote Based',
    desc: 'Pipe repairs, leak fixing, tap and bathroom installation',
    keywords: ['plumber', 'pipe', 'leak', 'water', 'tap', 'sink', 'drain', 'toilet', 'bathroom'],
  },
  {
    id: 2,
    name: 'Electrician',
    icon: '⚡',
    price: 'Quote Based',
    desc: 'Wiring, switchboards, fans, lights, and appliance repairs',
    keywords: ['electrician', 'wiring', 'fan', 'light', 'switch', 'power', 'voltage', 'socket'],
  },
  {
    id: 3,
    name: 'Carpenter',
    icon: '🪛',
    price: 'Quote Based',
    desc: 'Furniture fixes, shelves, doors, and woodwork',
    keywords: ['carpenter', 'wood', 'door', 'table', 'chair', 'furniture', 'cupboard', 'shelf'],
  },
  {
    id: 4,
    name: 'Painter',
    icon: '🎨',
    price: 'Quote Based',
    desc: 'Interior, exterior, touch-up, and fresh painting jobs',
    keywords: ['painter', 'paint', 'wall', 'color', 'coating', 'putty'],
  },
];

export function normalizeServiceName(value = '') {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/electrican/g, 'electrician')
    .replace(/plummer/g, 'plumber')
    .replace(/carpanter/g, 'carpenter');
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

  return `Ask about plumber, electrician, carpenter, or painter and I’ll guide you.`;
}
