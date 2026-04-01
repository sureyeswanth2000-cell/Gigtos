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
    `Compare worker prices for ${serviceLabel}`,
    'Show available services in Kavali',
    'Help me book step by step',
  ];
}

export function buildLocalAssistantFallback({ message = '', selectedService = '', insights = [] }) {
  const relevantService = selectedService || findRelevantService(message)?.name || 'home service';
  const serviceInsight = getInsightForService(insights, relevantService);
  const lowerMessage = message.toLowerCase();

  if (serviceInsight && /(compare|cost|price|cheap|cheapest|worker)/i.test(lowerMessage)) {
    return `${relevantService} currently has ${serviceInsight.availableWorkers || 0} available workers. Recent quotes are usually ${formatPriceInsight(serviceInsight)}, and the average rating is ${serviceInsight.averageRating || 'N/A'}. For the best comparison, book the service and review the competing quotes in My Bookings.`;
  }

  if (serviceInsight && /(available|availability|service)/i.test(lowerMessage)) {
    return `${relevantService} is available in Gigto with ${serviceInsight.availableWorkers || 0} active workers right now. Typical pricing is ${formatPriceInsight(serviceInsight)}. You can tap Book Now to request quotes.`;
  }

  if (/(book|booking|help|how)/i.test(lowerMessage)) {
    const matchedService = findRelevantService(message)?.name || relevantService;
    return `To book ${matchedService}, choose the service card on the home page, confirm your address and phone, and submit the request. Gigto will collect quotes from workers so you can compare price and rating before accepting one.`;
  }

  return `Gigto can help with ${SERVICE_CATALOG.map((service) => service.name).join(', ')}. Tell me the issue you have at home, and I’ll suggest the right service, current availability, and expected quote range.`;
}
