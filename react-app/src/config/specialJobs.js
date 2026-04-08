/**
 * Special job categories that have dedicated detail pages with subtypes.
 * Each entry maps a job id to its subtypes.
 */
export const SPECIAL_JOBS = [
  {
    id: 'driver',
    label: 'Driver',
    icon: '🚗',
    desc: 'Professional drivers for every need — with or without vehicle',
    subtypes: [
      { id: 'driver-car', label: 'With Car', icon: '🚗', desc: 'Driver brings their own car' },
      { id: 'driver-only', label: 'Only Driver', icon: '🧑‍✈️', desc: 'Driver for your own vehicle' },
      { id: 'driver-bike', label: 'With Bike', icon: '🏍️', desc: 'Bike rider for delivery or errands' },
      { id: 'driver-bus', label: 'With Bus', icon: '🚌', desc: 'Bus driver for group transport' },
      { id: 'driver-bulldozer', label: 'With Bulldozer', icon: '🚧', desc: 'Bulldozer operator for site work' },
      { id: 'driver-auto', label: 'With Auto-Rickshaw', icon: '🛺', desc: 'Auto-rickshaw driver' },
    ],
  },
  {
    id: 'painter',
    label: 'Painter',
    icon: '🎨',
    desc: 'Painting services for every scale',
    subtypes: [
      { id: 'painter-house', label: 'House Painter', icon: '🏠', desc: 'Interior and exterior house painting' },
      { id: 'painter-wall-art', label: 'Wall Art', icon: '🖌️', desc: 'Artistic murals and wall designs' },
      { id: 'painter-building', label: 'Large Building', icon: '🏗️', desc: 'Commercial and apartment building painting' },
      { id: 'painter-interior', label: 'Interior', icon: '🛋️', desc: 'Interior decoration and paint finishing' },
    ],
  },
  {
    id: 'kitchen-work',
    label: 'Kitchen Work',
    icon: '🍳',
    desc: 'Kitchen and catering professionals',
    subtypes: [
      { id: 'kitchen-cook', label: 'Cook', icon: '👨‍🍳', desc: 'Daily home or event cooking' },
      { id: 'kitchen-cleaner', label: 'Kitchen Cleaner', icon: '🧹', desc: 'Deep kitchen cleaning and sanitation' },
      { id: 'kitchen-catering', label: 'Catering Helper', icon: '🍽️', desc: 'Catering setup and serving assistance' },
      { id: 'kitchen-chef-assist', label: 'Chef Assistant', icon: '🥄', desc: 'Support role in professional kitchens' },
    ],
  },
  {
    id: 'garden-work',
    label: 'Garden Work',
    icon: '🌿',
    desc: 'Outdoor and garden maintenance experts',
    subtypes: [
      { id: 'garden-gardener', label: 'Gardener', icon: '🌱', desc: 'Plant care, watering, and garden maintenance' },
      { id: 'garden-tree-trim', label: 'Tree Trimmer', icon: '🌳', desc: 'Tree pruning and trimming services' },
      { id: 'garden-lawn', label: 'Lawn Mower', icon: '🌾', desc: 'Lawn mowing and grass cutting' },
      { id: 'garden-landscape', label: 'Landscape Worker', icon: '🏞️', desc: 'Full landscape design and maintenance' },
    ],
  },
  {
    id: 'construction-heavy',
    label: 'Construction (Heavy Vehicle)',
    icon: '🏗️',
    desc: 'Heavy machinery operators for construction sites',
    subtypes: [
      { id: 'construction-bulldozer', label: 'Bulldozer Operator', icon: '🚧', desc: 'Bulldozer operation for earth moving' },
      { id: 'construction-crane', label: 'Crane Operator', icon: '🏗️', desc: 'Tower and mobile crane operation' },
      { id: 'construction-jcb', label: 'JCB Operator', icon: '🚜', desc: 'JCB/backhoe loader operation' },
      { id: 'construction-excavator', label: 'Excavator Operator', icon: '⛏️', desc: 'Excavator for digging and grading' },
    ],
  },
  {
    id: 'electrician',
    label: 'Electrician',
    icon: '⚡',
    desc: 'Electrical services for home and industry',
    subtypes: [
      { id: 'electrician-home', label: 'Home Electrician', icon: '🔌', desc: 'Wiring, fans, switches and fixtures' },
      { id: 'electrician-industrial', label: 'Industrial', icon: '🏭', desc: 'Industrial electrical systems and panels' },
      { id: 'electrician-emergency', label: 'Emergency Service', icon: '🆘', desc: 'Urgent fault repairs any time' },
      { id: 'electrician-tools', label: 'With Tools', icon: '🧰', desc: 'Fully equipped electrician for large jobs' },
    ],
  },
  {
    id: 'plumber',
    label: 'Plumber',
    icon: '🧰',
    desc: 'Plumbing solutions for every property type',
    subtypes: [
      { id: 'plumber-home', label: 'Home', icon: '🏠', desc: 'Residential plumbing and pipe repair' },
      { id: 'plumber-building', label: 'Building', icon: '🏢', desc: 'Apartment and commercial plumbing' },
      { id: 'plumber-industrial', label: 'Industrial', icon: '🏭', desc: 'Industrial plumbing systems' },
      { id: 'plumber-emergency', label: 'Emergency', icon: '🆘', desc: '24/7 emergency plumbing' },
    ],
  },
  {
    id: 'cleaner',
    label: 'Cleaner',
    icon: '🧹',
    desc: 'Cleaning services for homes, offices, and industry',
    subtypes: [
      { id: 'cleaner-home', label: 'Home Cleaner', icon: '🏠', desc: 'Regular or deep home cleaning' },
      { id: 'cleaner-office', label: 'Office Cleaner', icon: '🏢', desc: 'Office sanitization and maintenance' },
      { id: 'cleaner-industrial', label: 'Industrial Cleaner', icon: '🏭', desc: 'Factory and warehouse cleaning' },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    icon: '🛡️',
    desc: 'Security personnel for every shift and setting',
    subtypes: [
      { id: 'security-uniform', label: 'With Uniform', icon: '👮', desc: 'Uniformed security guard' },
      { id: 'security-plain', label: 'Without Uniform', icon: '🕵️', desc: 'Plain-clothes security' },
      { id: 'security-night', label: 'Night Duty', icon: '🌙', desc: 'Overnight security watch' },
      { id: 'security-day', label: 'Day Duty', icon: '☀️', desc: 'Daytime security cover' },
    ],
  },
  {
    id: 'delivery',
    label: 'Delivery',
    icon: '📦',
    desc: 'Fast and reliable delivery for every package size',
    subtypes: [
      { id: 'delivery-small', label: 'Small Parcel', icon: '📫', desc: 'Lightweight parcel delivery' },
      { id: 'delivery-bike', label: 'Bike Delivery', icon: '🏍️', desc: 'Quick bike delivery within city' },
      { id: 'delivery-van', label: 'Van Delivery', icon: '🚐', desc: 'Bulk or furniture delivery by van' },
      { id: 'delivery-courier', label: 'Courier', icon: '🚀', desc: 'Same-day courier service' },
    ],
  },
];

/** Set of special job ids for quick lookup */
export const SPECIAL_JOB_IDS = new Set(SPECIAL_JOBS.map((j) => j.id));

/** Find a special job config by id */
export function getSpecialJob(id) {
  return SPECIAL_JOBS.find((j) => j.id === id) || null;
}

/**
 * Returns the special job config that matches a service name, if any.
 * e.g. "Painter" → finds { id: 'painter', ... }
 */
export function getSpecialJobByName(name) {
  if (!name) return null;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  return SPECIAL_JOBS.find(
    (j) =>
      j.id === slug ||
      j.label.toLowerCase() === name.toLowerCase() ||
      slug.startsWith(j.id) ||
      j.id.startsWith(slug.split('-')[0])
  ) || null;
}
