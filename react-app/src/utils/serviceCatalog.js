export const SERVICE_CATALOG = [
  {
    id: 'home-helper',
    name: 'Home Helper',
    category: 'maid',
    icon: 'home',
    launchPriority: 1,
    matchingScope: 'area_10km',
    suggestedMinutes: 180,
    priceBand: { min: 500, fairMin: 700, fairMax: 1200, premiumMin: 1600 },
    requiresBeforeAfterPhotos: true,
    rareService: false,
  },
  {
    id: 'kitchen-help',
    name: 'Kitchen Help',
    category: 'maid',
    icon: 'kitchen',
    launchPriority: 1,
    matchingScope: 'area_10km',
    suggestedMinutes: 180,
    priceBand: { min: 500, fairMin: 800, fairMax: 1400, premiumMin: 1800 },
    requiresBeforeAfterPhotos: true,
    rareService: false,
  },
  {
    id: 'house-cleaning',
    name: 'House Cleaning',
    category: 'cleaning',
    icon: 'cleaning',
    launchPriority: 1,
    matchingScope: 'area_10km',
    suggestedMinutes: 240,
    priceBand: { min: 800, fairMin: 1200, fairMax: 2400, premiumMin: 3200 },
    requiresBeforeAfterPhotos: true,
    rareService: false,
  },
  {
    id: 'kitchen-cleaning',
    name: 'Kitchen Cleaning',
    category: 'cleaning',
    icon: 'sparkle',
    launchPriority: 1,
    matchingScope: 'area_10km',
    suggestedMinutes: 180,
    priceBand: { min: 700, fairMin: 1000, fairMax: 2200, premiumMin: 3000 },
    requiresBeforeAfterPhotos: true,
    rareService: false,
  },
  {
    id: 'bathroom-cleaning',
    name: 'Bathroom Cleaning',
    category: 'cleaning',
    icon: 'bath',
    launchPriority: 1,
    matchingScope: 'area_10km',
    suggestedMinutes: 120,
    priceBand: { min: 500, fairMin: 800, fairMax: 1600, premiumMin: 2200 },
    requiresBeforeAfterPhotos: true,
    rareService: false,
  },
  {
    id: 'bedroom-cleaning',
    name: 'Bedroom Cleaning',
    category: 'cleaning',
    icon: 'bed',
    launchPriority: 1,
    matchingScope: 'area_10km',
    suggestedMinutes: 120,
    priceBand: { min: 400, fairMin: 700, fairMax: 1400, premiumMin: 2000 },
    requiresBeforeAfterPhotos: true,
    rareService: false,
  },
  {
    id: 'full-house-cleaning',
    name: 'Full House Cleaning',
    category: 'cleaning',
    icon: 'house',
    launchPriority: 1,
    matchingScope: 'area_10km',
    suggestedMinutes: 360,
    priceBand: { min: 1200, fairMin: 1800, fairMax: 4200, premiumMin: 5500 },
    requiresBeforeAfterPhotos: true,
    rareService: false,
  },
  {
    id: 'electrician',
    name: 'Electrician',
    category: 'repair',
    icon: 'bolt',
    launchPriority: 1,
    matchingScope: 'area_10km',
    suggestedMinutes: 120,
    priceBand: { min: 600, fairMin: 900, fairMax: 2200, premiumMin: 3000 },
    requiresBeforeAfterPhotos: true,
    rareService: false,
  },
  {
    id: 'plumber',
    name: 'Plumber',
    category: 'repair',
    icon: 'tool',
    launchPriority: 2,
    matchingScope: 'area_10km',
    suggestedMinutes: 120,
    priceBand: { min: 600, fairMin: 850, fairMax: 2000, premiumMin: 2800 },
    requiresBeforeAfterPhotos: true,
    rareService: false,
  },
  {
    id: 'carpenter',
    name: 'Carpenter',
    category: 'repair',
    icon: 'wood',
    launchPriority: 3,
    matchingScope: 'city_when_sparse',
    suggestedMinutes: 180,
    priceBand: { min: 800, fairMin: 1000, fairMax: 2800, premiumMin: 4000 },
    requiresBeforeAfterPhotos: true,
    rareService: true,
  },
  {
    id: 'painter',
    name: 'Painter',
    category: 'repair',
    icon: 'paint',
    launchPriority: 3,
    matchingScope: 'city_when_sparse',
    suggestedMinutes: 240,
    priceBand: { min: 1000, fairMin: 1200, fairMax: 3200, premiumMin: 5000 },
    requiresBeforeAfterPhotos: true,
    rareService: true,
  },
];

export const SERVICE_ICON_LABELS = {
  home: 'Home',
  kitchen: 'Kitchen',
  cleaning: 'Clean',
  sparkle: 'Shine',
  bath: 'Bath',
  bed: 'Bed',
  house: 'House',
  bolt: 'Electric',
  tool: 'Repair',
  wood: 'Wood',
  paint: 'Paint',
};

export function getServiceByName(name) {
  return SERVICE_CATALOG.find((service) => service.name === name) || SERVICE_CATALOG[0];
}

export function getLaunchServices() {
  return SERVICE_CATALOG.filter((service) => service.launchPriority <= 1);
}

export function getRecruitableServices() {
  return SERVICE_CATALOG;
}

export function getServiceOptions() {
  return SERVICE_CATALOG.map((service) => ({
    id: service.id,
    name: service.name,
    category: service.category,
    iconLabel: SERVICE_ICON_LABELS[service.icon] || service.name,
  }));
}
