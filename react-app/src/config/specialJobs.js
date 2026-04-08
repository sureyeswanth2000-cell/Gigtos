/**
 * Special job categories that have dedicated sub-type pages.
 * Each entry maps a job id (used in the /jobs/:jobId route) to its
 * display label, icon, description, and the list of available subtypes.
 */
export const specialJobs = [
  {
    id: 'driver',
    label: 'Driver',
    icon: '🚗',
    desc: 'Professional drivers for all vehicle types and transport needs',
    subtypes: [
      { id: 'driver-car', label: 'With Car', icon: '🚗', desc: 'Driver who brings their own car' },
      { id: 'driver-only', label: 'Only Driver', icon: '🧑‍✈️', desc: 'Drive your own vehicle' },
      { id: 'driver-bike', label: 'With Bike', icon: '🏍️', desc: 'Bike/scooter rider for delivery or errands' },
      { id: 'driver-bus', label: 'With Bus', icon: '🚌', desc: 'Bus driver for school, office, or tours' },
      { id: 'driver-bulldozer', label: 'With Bulldozer', icon: '🚜', desc: 'Bulldozer operator for construction' },
      { id: 'driver-auto', label: 'With Auto-Rickshaw', icon: '🛺', desc: 'Auto-rickshaw driver for local transport' },
    ],
  },
  {
    id: 'painter',
    label: 'Painter',
    icon: '🎨',
    desc: 'Professional painting services for homes and commercial buildings',
    subtypes: [
      { id: 'painter-house', label: 'House Painter', icon: '🏠', desc: 'Interior and exterior house painting' },
      { id: 'painter-wall-art', label: 'Wall Art', icon: '🖌️', desc: 'Decorative wall art and murals' },
      { id: 'painter-large-building', label: 'Large Building', icon: '🏗️', desc: 'High-rise and commercial building painting' },
      { id: 'painter-interior', label: 'Interior', icon: '🛋️', desc: 'Interior design painting and finishes' },
    ],
  },
  {
    id: 'kitchen-work',
    label: 'Kitchen Work',
    icon: '👨‍🍳',
    desc: 'Kitchen and cooking staff for homes, restaurants, and events',
    subtypes: [
      { id: 'kitchen-cook', label: 'Cook', icon: '🍳', desc: 'Home or restaurant cook' },
      { id: 'kitchen-cleaner', label: 'Kitchen Cleaner', icon: '🧹', desc: 'Deep kitchen cleaning services' },
      { id: 'kitchen-catering', label: 'Catering Helper', icon: '🍽️', desc: 'Assistance with catering events' },
      { id: 'kitchen-chef-asst', label: 'Chef Assistant', icon: '👨‍🍳', desc: 'Support for professional chefs' },
    ],
  },
  {
    id: 'garden-work',
    label: 'Garden Work',
    icon: '🌿',
    desc: 'Outdoor and garden maintenance services',
    subtypes: [
      { id: 'garden-gardener', label: 'Gardener', icon: '🌻', desc: 'Regular garden maintenance and plant care' },
      { id: 'garden-tree', label: 'Tree Trimmer', icon: '🌳', desc: 'Tree trimming and pruning services' },
      { id: 'garden-lawn', label: 'Lawn Mower', icon: '🌱', desc: 'Lawn mowing and edging' },
      { id: 'garden-landscape', label: 'Landscape Worker', icon: '🏡', desc: 'Full landscape design and installation' },
    ],
  },
  {
    id: 'construction-heavy',
    label: 'Construction (Heavy Vehicle)',
    icon: '🏗️',
    desc: 'Operators for heavy construction equipment and vehicles',
    subtypes: [
      { id: 'construction-bulldozer', label: 'Bulldozer Operator', icon: '🚜', desc: 'Operate bulldozer for earthwork' },
      { id: 'construction-crane', label: 'Crane Operator', icon: '🏗️', desc: 'Certified crane operator for heavy lifting' },
      { id: 'construction-jcb', label: 'JCB Operator', icon: '⚙️', desc: 'JCB / backhoe loader operator' },
      { id: 'construction-excavator', label: 'Excavator Operator', icon: '🔩', desc: 'Excavator operation for digging/clearing' },
    ],
  },
  {
    id: 'electrician',
    label: 'Electrician',
    icon: '⚡',
    desc: 'Electrical services for homes and industrial settings',
    subtypes: [
      { id: 'electrician-home', label: 'Home Electrician', icon: '🏠', desc: 'Wiring, fans, lights, and switchboards' },
      { id: 'electrician-industrial', label: 'Industrial', icon: '🏭', desc: 'Industrial wiring and panel work' },
      { id: 'electrician-emergency', label: 'Emergency Service', icon: '🚨', desc: '24/7 emergency electrical repairs' },
      { id: 'electrician-tools', label: 'With Tools', icon: '🔧', desc: 'Fully equipped electrician with all tools' },
    ],
  },
  {
    id: 'plumber',
    label: 'Plumber',
    icon: '🧰',
    desc: 'Plumbing services for homes, buildings, and industrial sites',
    subtypes: [
      { id: 'plumber-home', label: 'Home', icon: '🏠', desc: 'Home plumbing repairs and installations' },
      { id: 'plumber-building', label: 'Building', icon: '🏢', desc: 'Multi-storey building plumbing' },
      { id: 'plumber-industrial', label: 'Industrial', icon: '🏭', desc: 'Industrial pipeline and plumbing work' },
      { id: 'plumber-emergency', label: 'Emergency', icon: '🚨', desc: '24/7 emergency plumbing services' },
    ],
  },
  {
    id: 'cleaner',
    label: 'Cleaner',
    icon: '🧹',
    desc: 'Professional cleaning services for all environments',
    subtypes: [
      { id: 'cleaner-home', label: 'Home Cleaner', icon: '🏠', desc: 'Regular and deep home cleaning' },
      { id: 'cleaner-office', label: 'Office Cleaner', icon: '🏢', desc: 'Office and commercial space cleaning' },
      { id: 'cleaner-industrial', label: 'Industrial Cleaner', icon: '🏭', desc: 'Industrial and factory cleaning' },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    icon: '🛡️',
    desc: 'Trained security personnel for events, homes, and offices',
    subtypes: [
      { id: 'security-uniform', label: 'With Uniform', icon: '👮', desc: 'Uniformed security guard' },
      { id: 'security-no-uniform', label: 'Without Uniform', icon: '🕵️', desc: 'Plain-clothes security personnel' },
      { id: 'security-night', label: 'Night Duty', icon: '🌙', desc: 'Night shift security guard' },
      { id: 'security-day', label: 'Day Duty', icon: '☀️', desc: 'Day shift security guard' },
    ],
  },
  {
    id: 'delivery',
    label: 'Delivery',
    icon: '📦',
    desc: 'Reliable delivery services for parcels and goods',
    subtypes: [
      { id: 'delivery-small', label: 'Small Parcel', icon: '📦', desc: 'Small parcel and document delivery' },
      { id: 'delivery-bike', label: 'Bike Delivery', icon: '🏍️', desc: 'Fast bike delivery within the city' },
      { id: 'delivery-van', label: 'Van Delivery', icon: '🚐', desc: 'Van delivery for larger items' },
      { id: 'delivery-courier', label: 'Courier', icon: '📬', desc: 'Courier and logistics services' },
    ],
  },
];

/**
 * Returns a specialJob config by its id, or null if not found.
 * @param {string} jobId
 */
export function getSpecialJob(jobId) {
  return specialJobs.find((job) => job.id === jobId) || null;
}

/**
 * Returns all special job ids as a Set for quick lookup.
 */
export const specialJobIds = new Set(specialJobs.map((j) => j.id));
