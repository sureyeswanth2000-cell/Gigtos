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
    icon: '🏗️',
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
  { name: 'Automotive',          icon: '🚙', sortOrder: 8 },
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

/**
 * Haversine distance between two lat/lng points in kilometres.
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Check if a service has workers available near the user's location.
 *
 * The AI calls this function every time a user message is processed to
 * determine whether the requested service is available nearby. If no
 * workers are within `radiusKm`, the AI informs the user that the
 * service will come to their area soon.
 *
 * @param {object}   params
 * @param {string}   params.serviceName   – the service the user is asking about
 * @param {object[]} params.workers       – available worker records (each with lat, lng, serviceType, isAvailable)
 * @param {number}   params.userLat       – user's latitude
 * @param {number}   params.userLng       – user's longitude
 * @param {number}   [params.radiusKm=20] – max search radius in km
 * @returns {{ isNearby: boolean, nearbyCount: number, message: string }}
 */
export function checkServiceNearby({
  serviceName = '',
  workers = [],
  userLat,
  userLng,
  radiusKm = 20,
}) {
  // If location is missing, we can't determine proximity
  if (userLat == null || userLng == null || !Number.isFinite(userLat) || !Number.isFinite(userLng)) {
    return {
      isNearby: false,
      nearbyCount: 0,
      message: '',
    };
  }

  if (!serviceName) {
    return { isNearby: false, nearbyCount: 0, message: '' };
  }

  const normalizedService = normalizeServiceName(serviceName);

  const nearbyWorkers = workers.filter((w) => {
    if (!w.isAvailable) return false;
    if (w.lat == null || w.lng == null) return false;
    if (normalizeServiceName(w.serviceType || '') !== normalizedService) return false;
    const dist = haversineKm(userLat, userLng, w.lat, w.lng);
    return dist <= radiusKm;
  });

  const count = nearbyWorkers.length;

  if (count > 0) {
    return {
      isNearby: true,
      nearbyCount: count,
      message: `✅ ${count} ${serviceName} worker${count !== 1 ? 's' : ''} available near you right now!`,
    };
  }

  return {
    isNearby: false,
    nearbyCount: 0,
    message: `📍 ${serviceName} service is not available in your area yet. Don't worry — the service will come to your area soon! We're expanding rapidly. You can still book and we'll connect you with the nearest available worker.`,
  };
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

  if (selectedService) {
    return [
      `How much does ${serviceLabel} cost?`,
      `What does a ${serviceLabel} do?`,
      `Book a ${serviceLabel} for me`,
      `Is ${serviceLabel} available now?`,
    ];
  }

  return [
    'What services do you offer?',
    'I need help choosing a service',
    'Help me book a worker',
    'What are typical prices?',
  ];
}

export function buildLocalAssistantFallback({ message = '', selectedService = '', insights = [], nearbyCheck = null }) {
  const relevantService = selectedService || findRelevantService(message)?.name || '';
  const serviceInsight = relevantService ? getInsightForService(insights, relevantService) : null;
  const lowerMessage = message.toLowerCase().trim();
  const activeServices = getActiveServices();
  const activeNames = activeServices.map((s) => s.name).join(', ');

  // Build proximity notice when service is identified but not nearby
  const proximityNotice = nearbyCheck && relevantService && !nearbyCheck.isNearby && nearbyCheck.message
    ? `\n\n${nearbyCheck.message}`
    : '';

  // ─── Greetings ─────────────────────────────────────────────────────────
  if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|namaste|howdy|sup)\b/i.test(lowerMessage)) {
    return `Hello! 👋 I'm Gito AI, your personal booking assistant. I can help you find the right worker, compare prices, and book services like ${activeNames}. What do you need help with today?`;
  }

  // ─── Thank you / appreciation ──────────────────────────────────────────
  if (/\b(thank|thanks|thx|ty|great|awesome|perfect|wonderful|nice|cool)\b/i.test(lowerMessage)) {
    return `You're welcome! 😊 I'm here whenever you need help. Would you like to book a service, check prices, or explore what's available?`;
  }

  // ─── What can you do / capabilities ────────────────────────────────────
  if (/\b(what (can|do) you|your (features|capabilities)|what.*you.*do|who are you)\b/i.test(lowerMessage)) {
    return `I can help you with:\n• 🔍 Finding the right service for your needs\n• 💰 Comparing prices and getting quotes\n• 📅 Booking workers quickly\n• 📋 Explaining what each service covers\n\nCurrently available: ${activeNames}. Just tell me what you need!`;
  }

  // ─── Urgency / emergency ───────────────────────────────────────────────
  if (/\b(urgent|emergency|asap|immediately|right now|quickly|fast|hurry)\b/i.test(lowerMessage)) {
    const matchedService = findRelevantService(message);
    if (matchedService) {
      const insight = getInsightForService(insights, matchedService.name);
      const workerInfo = insight?.availableWorkers
        ? ` There are ${insight.availableWorkers} ${matchedService.name} workers available right now.`
        : '';
      return `I understand this is urgent! 🚨${workerInfo} Let me help you book a ${matchedService.name} right away — just confirm your address and I'll find the nearest available worker for you.${proximityNotice}`;
    }
    return `I understand this is urgent! 🚨 Tell me what you need — a plumber for a leak, an electrician for a power issue, or something else — and I'll help you book the nearest available worker right away.`;
  }

  // ─── Recommendation / suggestion requests ──────────────────────────────
  if (/\b(recommend|suggest|which.*should|which.*best|what.*best|who.*best|advice|opinion)\b/i.test(lowerMessage)) {
    const matchedService = findRelevantService(message);
    if (matchedService) {
      const insight = getInsightForService(insights, matchedService.name);
      if (insight && insight.availableWorkers > 0) {
        return `For ${matchedService.name}, I'd recommend booking through Gigtos — we have ${insight.availableWorkers} verified workers available. Typical quotes range ${formatPriceInsight(insight)}. You can compare workers and their ratings before booking. Want me to start the booking?`;
      }
      return `${matchedService.name} is a great choice for your needs! ${matchedService.desc}. I'd suggest posting your job with details about the work needed — this helps workers give you accurate quotes. Ready to book?`;
    }
    return `I'd love to help you find the right service! Could you describe what you need done? For example:\n• "My tap is leaking" → Plumber\n• "Need fan installed" → Electrician\n• "Door hinge broken" → Carpenter\nJust describe your problem and I'll recommend the best service!`;
  }

  // ─── Schedule / timing questions ───────────────────────────────────────
  if (/\b(when|schedule|timing|time|available.*when|how long|how soon|duration|hours|weekend|today|tomorrow)\b/i.test(lowerMessage)) {
    const service = relevantService || 'service';
    return `Most workers on Gigtos are available 7 days a week, including weekends. After you book, workers typically respond within 1-2 hours with their availability. You can specify your preferred date and time during booking. Would you like to book a ${service} now?`;
  }

  // ─── Service description / what does X do ──────────────────────────────
  if (/\b(what (is|does|do)|tell me about|describe|explain|details about|info about|information)\b/i.test(lowerMessage)) {
    const matchedService = findRelevantService(message);
    if (matchedService) {
      const insight = getInsightForService(insights, matchedService.name);
      const priceInfo = insight ? ` Typical pricing: ${formatPriceInsight(insight)}.` : '';
      const upcomingNote = matchedService.isUpcoming ? ' (This service is coming soon — stay tuned!)' : '';
      return `${matchedService.icon} **${matchedService.name}**: ${matchedService.desc}.${priceInfo}${upcomingNote} Would you like to book this service or learn more about pricing?`;
    }
    return `We offer a variety of services! Here are the ones available now: ${activeNames}. Tell me which one you'd like to know more about, or describe your problem and I'll match you with the right service.`;
  }

  // ─── How to use / process questions ────────────────────────────────────
  if (/\b(how (to|do i)|process|steps|procedure|guide|walkthrough|tutorial)\b/i.test(lowerMessage)) {
    return `Here's how Gigtos works — it's super simple:\n\n1️⃣ **Choose a service** — pick what you need (e.g., Plumber, Electrician)\n2️⃣ **Describe your job** — tell us what needs to be done\n3️⃣ **Get quotes** — verified workers will send you competitive quotes\n4️⃣ **Compare & book** — review ratings, prices, and pick the best worker\n5️⃣ **Job done!** — the worker comes to your location and completes the work\n\nWould you like to get started? Just tell me what you need!`;
  }

  // ─── Price / cost with service insight ─────────────────────────────────
  if (serviceInsight && /(compare|cost|price|cheap|cheapest|worker|rate|charge|fee|budget|afford|expensive|quote)/i.test(lowerMessage)) {
    const workerCount = serviceInsight.availableWorkers || 0;
    const priceRange = formatPriceInsight(serviceInsight);
    return `Great question! 💰 For ${relevantService}, we have ${workerCount} worker${workerCount !== 1 ? 's' : ''} available. Typical quotes range ${priceRange}. I'd recommend booking now to get exact bids from workers near you — you can compare their ratings and prices before choosing. Want me to help you book?`;
  }

  // ─── Price / cost without insight ──────────────────────────────────────
  if (/(cost|price|cheap|cheapest|rate|charge|fee|budget|afford|expensive|quote|how much)/i.test(lowerMessage)) {
    const matchedService = findRelevantService(message);
    if (matchedService) {
      return `${matchedService.name} pricing depends on the scope of work. Post your job with details and workers will send you personalized quotes. This way, you can compare prices and choose the best offer. Would you like to book now?`;
    }
    return `Pricing depends on the service and job details. Our workers provide personalized quotes after you describe your needs. Which service are you interested in? I can help you get started!`;
  }

  // ─── Availability with insight ─────────────────────────────────────────
  if (serviceInsight && /(available|availability|open|ready|free|nearby)/i.test(lowerMessage)) {
    const workerCount = serviceInsight.availableWorkers || 0;
    return `Yes! ✅ ${relevantService} is available now with ${workerCount} worker${workerCount !== 1 ? 's' : ''} ready to help. Approximate pricing: ${formatPriceInsight(serviceInsight)}. Would you like me to help you book one right away?${proximityNotice}`;
  }

  // ─── Availability without insight ──────────────────────────────────────
  if (/(available|availability|open|ready|free|nearby)/i.test(lowerMessage)) {
    const matchedService = findRelevantService(message);
    if (matchedService) {
      const upcomingNote = matchedService.isUpcoming ? ' This service is coming soon — you can sign up to be notified when it launches!' : ' Workers are standing by to take your job.';
      return `${matchedService.name} is on Gigtos!${upcomingNote} Would you like to book or learn more?`;
    }
    return `We currently have workers available for: ${activeNames}. Tell me which service you need and I'll check availability in your area!`;
  }

  // ─── Booking intent ────────────────────────────────────────────────────
  if (/(book|booking|hire|need|want|looking for|find|get|request)/i.test(lowerMessage)) {
    const matchedService = findRelevantService(message)?.name || relevantService;
    if (matchedService) {
      return `Let's get you booked! 🎯 Here's what I need:\n\n1. ✅ Service: **${matchedService}** — great choice!\n2. 📍 Your address — so we can find workers nearby\n3. 📱 Your phone number — for the worker to reach you\n\nClick the **Book** button above or I can guide you through the process step by step. Ready?${proximityNotice}`;
    }
    return `I'd love to help you book! 🎯 What service do you need? Here are our most popular options:\n\n• 🧰 Plumber — pipe repairs, leaks, taps\n• ⚡ Electrician — wiring, switches, fans\n• 🪛 Carpenter — furniture, doors, shelves\n• 🎨 Painter — interior & exterior painting\n\nJust tell me what you need and I'll guide you through booking!`;
  }

  // ─── Help / general assistance ─────────────────────────────────────────
  if (/\b(help|assist|support|guide|stuck|confused|don'?t know|not sure|unsure)\b/i.test(lowerMessage)) {
    return `No worries, I'm here to help! 😊 Here's what I can do for you:\n\n• Tell me your problem (e.g., "my tap is leaking") and I'll find the right service\n• Ask about prices for any service\n• I can walk you through the booking process step by step\n\nWhat would you like help with?`;
  }

  // ─── Quality / rating / trust ──────────────────────────────────────────
  if (/\b(quality|rating|review|trust|reliable|safe|verified|guarantee|good|reputation)\b/i.test(lowerMessage)) {
    return `All workers on Gigtos are verified and rated by real customers. ⭐ You can see each worker's ratings, number of completed jobs, and customer reviews before booking. We also support secure payments and you only pay after the work is done to your satisfaction.`;
  }

  // ─── Cancel / refund questions ─────────────────────────────────────────
  if (/\b(cancel|refund|money back|complaint|issue|problem with|dissatisfied)\b/i.test(lowerMessage)) {
    return `If you need to cancel a booking or have any issues, you can do so from your dashboard. For support, our team is always ready to help ensure you have a great experience. Is there something specific I can help you with?`;
  }

  // ─── Goodbye / end conversation ────────────────────────────────────────
  if (/\b(bye|goodbye|see you|later|take care|that'?s all|done|nothing)\b/i.test(lowerMessage)) {
    return `Thank you for chatting with me! 🙏 I'll be right here whenever you need help booking a service. Have a great day!`;
  }

  // ─── Catch-all: proactive and helpful ──────────────────────────────────
  if (relevantService) {
    const matchedDetails = findRelevantService(message);
    if (matchedDetails) {
      return `It sounds like you might need a **${matchedDetails.name}**! ${matchedDetails.desc}. Would you like me to help you book one, or would you like to know more about pricing and availability?${proximityNotice}`;
    }
  }

  return `I'm here to help! 😊 Here are some things you can ask me:\n\n• "I have a leaking tap" — I'll find the right service\n• "How much does a plumber cost?" — I'll share pricing info\n• "Book an electrician" — I'll guide you through booking\n• "What services are available?" — I'll show you options\n\nCurrently available: ${activeNames}. What can I help you with?`;
}
