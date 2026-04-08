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
  // ─── Upcoming Services ─────────────────────────────────────────────────
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
  // ─── Transport (expanded) ──────────────────────────────────────────────
  {
    id: 13,
    name: 'Heavy Vehicle Driver',
    icon: '🚛',
    price: 'Quote Based',
    category: 'Transport',
    desc: 'Driver with heavy licence for trucks, buses, and commercial vehicles',
    keywords: ['heavy driver', 'truck driver', 'bus driver', 'lorry', 'heavy licence', 'commercial driver', 'heavy vehicle'],
    isUpcoming: true,
  },
  {
    id: 14,
    name: 'Two Wheeler Driver',
    icon: '🏍️',
    price: 'Quote Based',
    category: 'Transport',
    desc: 'Bike or scooter rider for delivery, errands, or personal transport',
    keywords: ['bike rider', 'two wheeler', 'scooter', 'motorcycle', 'bike delivery', 'scooty'],
    requiresAsset: true,
    isUpcoming: true,
  },
  {
    id: 15,
    name: 'Executive Driver',
    icon: '🎩',
    price: 'Quote Based',
    category: 'Transport',
    desc: 'Professional chauffeur for corporate or VIP transport',
    keywords: ['executive driver', 'corporate driver', 'vip driver', 'luxury chauffeur', 'professional driver'],
    isUpcoming: true,
  },
  // ─── Construction & Building ───────────────────────────────────────────
  {
    id: 16,
    name: 'Mason',
    icon: '🧱',
    price: 'Quote Based',
    category: 'Construction',
    desc: 'Bricklaying, plastering, concrete work, and general masonry',
    keywords: ['mason', 'brick', 'cement', 'plaster', 'concrete', 'wall building', 'masonry'],
    isUpcoming: true,
  },
  {
    id: 17,
    name: 'Construction Helper',
    icon: '👷',
    price: 'Quote Based',
    category: 'Construction',
    desc: 'Labour assistance at construction sites — loading, mixing, scaffolding',
    keywords: ['construction helper', 'site helper', 'labour', 'scaffolding', 'mixing', 'loading'],
    isUpcoming: true,
  },
  {
    id: 18,
    name: 'Steel Worker',
    icon: '🔩',
    price: 'Quote Based',
    category: 'Construction',
    desc: 'Steel reinforcement, structural steel fabrication, and rebar tying',
    keywords: ['steel worker', 'rebar', 'steel fabrication', 'reinforcement', 'iron work', 'structural steel'],
    isUpcoming: true,
  },
  {
    id: 19,
    name: 'Land Surveyor',
    icon: '📐',
    price: 'Quote Based',
    category: 'Construction',
    desc: 'Land or field surveying, boundary marking, and topographical mapping',
    keywords: ['surveyor', 'land survey', 'field survey', 'boundary', 'mapping', 'topography', 'plot survey'],
    isUpcoming: true,
  },
  {
    id: 20,
    name: 'Construction Quality Tester',
    icon: '🔬',
    price: 'Quote Based',
    category: 'Construction',
    desc: 'Testing and inspecting construction materials and workmanship',
    keywords: ['quality tester', 'construction testing', 'material testing', 'inspection', 'quality check', 'building inspection'],
    isUpcoming: true,
  },
  {
    id: 21,
    name: 'Welding',
    icon: '🔥',
    price: 'Quote Based',
    category: 'Construction',
    desc: 'Metal welding, fabrication, grille work, gate repair',
    keywords: ['welding', 'welder', 'grille', 'gate repair', 'metal fabrication', 'iron gate', 'railing'],
    isUpcoming: true,
  },
  {
    id: 22,
    name: 'Roof Coating Specialist',
    icon: '🏠',
    price: 'Quote Based',
    category: 'Construction',
    desc: 'White roof painting / cool-roof coating for sun and heat protection',
    keywords: ['roof coating', 'white roof', 'sun protection roof', 'cool roof', 'heat protection', 'roof white paint'],
    isUpcoming: true,
  },
  // ─── Household Help (expanded) ─────────────────────────────────────────
  {
    id: 23,
    name: 'Maid',
    icon: '🧹',
    price: 'Quote Based',
    category: 'Household Help',
    desc: 'Daily or weekly domestic help — sweeping, mopping, utensils, laundry',
    keywords: ['maid', 'sweeping', 'mopping', 'utensils', 'domestic help', 'house maid'],
    isUpcoming: true,
  },
  {
    id: 24,
    name: 'Gardener',
    icon: '🌿',
    price: 'Quote Based',
    category: 'Outdoor & Garden',
    desc: 'Garden maintenance, landscaping, plant care, lawn mowing',
    keywords: ['gardener', 'garden', 'lawn', 'plant', 'landscaping', 'mowing', 'hedge', 'pruning'],
    isUpcoming: true,
  },
  // ─── Cleaning & Sanitation ─────────────────────────────────────────────
  {
    id: 25,
    name: 'Sanitizer',
    icon: '🧴',
    price: 'Quote Based',
    category: 'Cleaning',
    desc: 'Professional sanitization and disinfection services',
    keywords: ['sanitize', 'disinfect', 'sanitization', 'disinfection', 'hygiene', 'germ'],
    isUpcoming: true,
  },
  // ─── Appliance & AC (expanded) ─────────────────────────────────────────
  {
    id: 26,
    name: 'AC & Washing Machine Service',
    icon: '🌀',
    price: 'Quote Based',
    category: 'Appliance & AC',
    desc: 'Combined AC and washing machine repair, maintenance, and servicing',
    keywords: ['ac and washing machine', 'washing machine service', 'ac washing machine repair'],
    isUpcoming: true,
  },
  {
    id: 27,
    name: 'Electric Equipment Repair',
    icon: '🔧',
    price: 'Quote Based',
    category: 'Appliance & AC',
    desc: 'Repair of electric motors, generators, UPS, inverters, and industrial equipment',
    keywords: ['motor repair', 'generator', 'ups repair', 'inverter', 'electric equipment', 'industrial repair'],
    isUpcoming: true,
  },
  {
    id: 28,
    name: 'Water Purifier Service',
    icon: '💧',
    price: 'Quote Based',
    category: 'Appliance & AC',
    desc: 'Water purifier installation, repair, filter replacement, and AMC',
    keywords: ['water purifier', 'ro repair', 'filter replacement', 'water filter', 'purifier service', 'ro service'],
    isUpcoming: true,
  },
  // ─── Automotive ────────────────────────────────────────────────────────
  {
    id: 29,
    name: 'Mechanic',
    icon: '🔧',
    price: 'Quote Based',
    category: 'Automotive',
    desc: 'Vehicle mechanic — car, bike, auto servicing, engine repair, denting',
    keywords: ['mechanic', 'car repair', 'bike repair', 'engine', 'denting', 'auto repair', 'garage'],
    isUpcoming: true,
  },
  // ─── Industrial & Specialist ───────────────────────────────────────────
  {
    id: 30,
    name: 'Elevator Installer',
    icon: '🛗',
    price: 'Quote Based',
    category: 'Industrial',
    desc: 'Elevator and escalator installation, repair, and maintenance',
    keywords: ['elevator', 'escalator', 'lift', 'lift repair', 'elevator maintenance', 'lift installation'],
    isUpcoming: true,
  },
  // ─── Hotel & Hospitality ───────────────────────────────────────────────
  {
    id: 31,
    name: 'Hotel Cook',
    icon: '👨‍🍳',
    price: 'Quote Based',
    category: 'Hotel & Hospitality',
    desc: 'Professional cook for hotels, restaurants, events, and catering',
    keywords: ['cook', 'chef', 'hotel cook', 'catering', 'restaurant cook', 'food preparation'],
    isUpcoming: true,
  },
  {
    id: 32,
    name: 'Food Service Staff',
    icon: '🍽️',
    price: 'Quote Based',
    category: 'Hotel & Hospitality',
    desc: 'Waiters, serving staff for hotels, restaurants, and events',
    keywords: ['food service', 'waiter', 'serving', 'restaurant staff', 'catering staff', 'buffet service'],
    isUpcoming: true,
  },
  {
    id: 33,
    name: 'Hotel Sanitizer',
    icon: '🧹',
    price: 'Quote Based',
    category: 'Hotel & Hospitality',
    desc: 'Cleaning and sanitation staff for hotels and hospitality',
    keywords: ['hotel cleaner', 'hotel sanitation', 'hotel housekeeping', 'room cleaning'],
    isUpcoming: true,
  },
  {
    id: 34,
    name: 'Hotel Welcome Staff',
    icon: '🙏',
    price: 'Quote Based',
    category: 'Hotel & Hospitality',
    desc: 'Front desk, reception, and guest welcoming for hotels and events',
    keywords: ['welcome staff', 'front desk', 'reception', 'hotel reception', 'greeting', 'concierge'],
    isUpcoming: true,
  },
  // ─── Event & Warehouse Helpers ─────────────────────────────────────────
  {
    id: 35,
    name: 'Event Helper',
    icon: '🎪',
    price: 'Quote Based',
    category: 'Event & Warehouse',
    desc: 'Labour and logistics support for events, exhibitions, and functions',
    keywords: ['event helper', 'event labour', 'exhibition', 'function setup', 'event setup', 'stage setup'],
    isUpcoming: true,
  },
  {
    id: 36,
    name: 'Warehouse Helper',
    icon: '📦',
    price: 'Quote Based',
    category: 'Event & Warehouse',
    desc: 'Loading, unloading, packing, and inventory assistance in warehouses',
    keywords: ['warehouse', 'loading', 'unloading', 'packing', 'inventory', 'godown', 'storage'],
    isUpcoming: true,
  },
  {
    id: 37,
    name: 'Farm Helper',
    icon: '🌾',
    price: 'Quote Based',
    category: 'Event & Warehouse',
    desc: 'Farming labour — planting, harvesting, irrigation, and field work',
    keywords: ['farm helper', 'farming', 'harvest', 'planting', 'irrigation', 'agriculture', 'field work'],
    isUpcoming: true,
  },
  // ─── Education ─────────────────────────────────────────────────────────
  {
    id: 38,
    name: 'Driving Instructor',
    icon: '📚',
    price: 'Quote Based',
    category: 'Education',
    desc: 'Teach driving — car, bike, or commercial vehicle training',
    keywords: ['teach driving', 'driving instructor', 'driving class', 'learn driving', 'driving school', 'driving lesson'],
    isUpcoming: true,
  },
  // ─── Outdoor & Garden ──────────────────────────────────────────────────
  {
    id: 39,
    name: 'Roof Sun Protection Painter',
    icon: '☀️',
    price: 'Quote Based',
    category: 'Outdoor & Garden',
    desc: 'White/reflective roof coating for heat and sun protection',
    keywords: ['roof paint', 'sun protection paint', 'white roof', 'reflective roof', 'heat protection roof', 'cool roof paint'],
    isUpcoming: true,
  },
];

export const SERVICE_CATEGORIES = [
  { name: 'Home Repair',         icon: '🔧', sortOrder: 1 },
  { name: 'Transport',           icon: '🚗', sortOrder: 2 },
  { name: 'Household Help',      icon: '🏠', sortOrder: 3 },
  { name: 'Appliance & AC',      icon: '❄️', sortOrder: 4 },
  { name: 'Cleaning',            icon: '🧹', sortOrder: 5 },
  { name: 'Security',            icon: '🛡️', sortOrder: 6 },
  { name: 'Construction',        icon: '🏗️', sortOrder: 7 },
  { name: 'Automotive',          icon: '🔧', sortOrder: 8 },
  { name: 'Hotel & Hospitality', icon: '🏨', sortOrder: 9 },
  { name: 'Industrial',          icon: '⚙️', sortOrder: 10 },
  { name: 'Event & Warehouse',   icon: '📦', sortOrder: 11 },
  { name: 'Education',           icon: '📚', sortOrder: 12 },
  { name: 'Outdoor & Garden',    icon: '🌿', sortOrder: 13 },
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
    .replace(/cleanning/g, 'cleaning')
    .replace(/machanic/g, 'mechanic')
    .replace(/mechnaic/g, 'mechanic')
    .replace(/masion/g, 'mason')
    .replace(/survayer/g, 'surveyor')
    .replace(/gardnar/g, 'gardener')
    .replace(/elevetor/g, 'elevator')
    .replace(/escalater/g, 'escalator')
    .replace(/sanitiser/g, 'sanitizer')
    .replace(/instruter/g, 'instructor')
    .replace(/wellding/g, 'welding');
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
