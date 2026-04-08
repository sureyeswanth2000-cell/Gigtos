/**
 * Special job categories that have dedicated sub-option pages.
 * Each entry maps a job ID to its label, icon, and available subtypes.
 */
export const SPECIAL_JOBS = [
  {
    id: 'driver',
    label: 'Driver',
    icon: '🚗',
    category: 'Transport',
    desc: 'Choose the type of driver service you need',
    subtypes: [
      { id: 'driver-with-car', label: 'Driver with Car', icon: '🚗', desc: 'Driver who brings their own car' },
      { id: 'driver-only', label: 'Only Driver', icon: '🧑‍✈️', desc: 'Driver to operate your vehicle' },
      { id: 'driver-with-bike', label: 'Driver with Bike', icon: '🏍️', desc: 'Bike rider for deliveries or errands' },
      { id: 'driver-with-bus', label: 'Driver with Bus', icon: '🚌', desc: 'Bus driver for group transport' },
      { id: 'driver-with-bulldozer', label: 'Driver with Bulldozer', icon: '🚜', desc: 'Bulldozer operator for earthwork' },
      { id: 'driver-with-auto', label: 'Driver with Auto-Rickshaw', icon: '🛺', desc: 'Auto-rickshaw driver for local transport' },
    ],
  },
  {
    id: 'painter',
    label: 'Painter',
    icon: '🎨',
    category: 'Home Repair',
    desc: 'Select the type of painting service you need',
    subtypes: [
      { id: 'painter-house', label: 'House Painter', icon: '🏠', desc: 'Interior and exterior house painting' },
      { id: 'painter-wall-art', label: 'Wall Art', icon: '🖌️', desc: 'Decorative wall art and murals' },
      { id: 'painter-large-building', label: 'Large Building Painter', icon: '🏢', desc: 'Commercial and large building painting' },
      { id: 'painter-interior', label: 'Interior Painter', icon: '🛋️', desc: 'Specialized interior painting and finishes' },
    ],
  },
  {
    id: 'kitchen-work',
    label: 'Kitchen Work',
    icon: '🍳',
    category: 'Household Help',
    desc: 'Select the type of kitchen service you need',
    subtypes: [
      { id: 'kitchen-cook', label: 'Cook', icon: '👨‍🍳', desc: 'Home or office cook for daily meals' },
      { id: 'kitchen-cleaner', label: 'Kitchen Cleaner', icon: '🧹', desc: 'Deep cleaning of kitchen and utensils' },
      { id: 'kitchen-catering-helper', label: 'Catering Helper', icon: '🍽️', desc: 'Assistant for catering and events' },
      { id: 'kitchen-chef-assistant', label: 'Chef Assistant', icon: '🧑‍🍳', desc: 'Sous-chef or helper for professional kitchens' },
    ],
  },
  {
    id: 'garden-work',
    label: 'Garden Work',
    icon: '🌿',
    category: 'Outdoor & Garden',
    desc: 'Select the type of garden service you need',
    subtypes: [
      { id: 'garden-gardener', label: 'Gardener', icon: '🌻', desc: 'General garden maintenance and plant care' },
      { id: 'garden-tree-trimmer', label: 'Tree Trimmer', icon: '🌳', desc: 'Tree pruning and trimming' },
      { id: 'garden-lawn-mower', label: 'Lawn Mower', icon: '🌱', desc: 'Lawn mowing and grass cutting' },
      { id: 'garden-landscape', label: 'Landscape Worker', icon: '🏡', desc: 'Garden design and landscaping' },
    ],
  },
  {
    id: 'construction-heavy',
    label: 'Construction (Heavy Vehicle)',
    icon: '🏗️',
    category: 'Construction',
    desc: 'Select heavy machinery operator type',
    subtypes: [
      { id: 'construction-bulldozer', label: 'Bulldozer Operator', icon: '🚜', desc: 'Bulldozer for earthmoving and site clearing' },
      { id: 'construction-crane', label: 'Crane Operator', icon: '🏗️', desc: 'Tower or mobile crane operations' },
      { id: 'construction-jcb', label: 'JCB Operator', icon: '🦺', desc: 'JCB backhoe loader operations' },
      { id: 'construction-excavator', label: 'Excavator Operator', icon: '⛏️', desc: 'Excavator for digging and trenching' },
    ],
  },
  {
    id: 'electrician',
    label: 'Electrician',
    icon: '⚡',
    category: 'Home Repair',
    desc: 'Select the type of electrical service needed',
    subtypes: [
      { id: 'electrician-home', label: 'Home Electrician', icon: '🏠', desc: 'Wiring, fans, lights, switchboards at home' },
      { id: 'electrician-industrial', label: 'Industrial Electrician', icon: '🏭', desc: 'Industrial wiring and high-voltage work' },
      { id: 'electrician-emergency', label: 'Emergency Service', icon: '🚨', desc: 'Urgent electrical repairs and power outage help' },
      { id: 'electrician-with-tools', label: 'Electrician with Tools', icon: '🔧', desc: 'Fully equipped electrician with all tools' },
    ],
  },
  {
    id: 'plumber',
    label: 'Plumber',
    icon: '🧰',
    category: 'Home Repair',
    desc: 'Select the type of plumbing service needed',
    subtypes: [
      { id: 'plumber-home', label: 'Home Plumber', icon: '🏠', desc: 'Residential plumbing repairs and installations' },
      { id: 'plumber-building', label: 'Building Plumber', icon: '🏢', desc: 'Commercial building plumbing work' },
      { id: 'plumber-industrial', label: 'Industrial Plumber', icon: '🏭', desc: 'Industrial pipework and systems' },
      { id: 'plumber-emergency', label: 'Emergency Plumber', icon: '🚨', desc: 'Urgent leak and pipe burst repairs' },
    ],
  },
  {
    id: 'cleaner',
    label: 'Cleaner',
    icon: '🧹',
    category: 'Cleaning',
    desc: 'Select the type of cleaning service needed',
    subtypes: [
      { id: 'cleaner-home', label: 'Home Cleaner', icon: '🏠', desc: 'Regular or deep cleaning for homes' },
      { id: 'cleaner-office', label: 'Office Cleaner', icon: '🏢', desc: 'Office and commercial space cleaning' },
      { id: 'cleaner-industrial', label: 'Industrial Cleaner', icon: '🏭', desc: 'Factory and industrial facility cleaning' },
    ],
  },
  {
    id: 'security',
    label: 'Security Guard',
    icon: '🛡️',
    category: 'Security',
    desc: 'Select the type of security service needed',
    subtypes: [
      { id: 'security-uniform', label: 'With Uniform', icon: '👮', desc: 'Uniformed security personnel' },
      { id: 'security-plain', label: 'Without Uniform', icon: '🕵️', desc: 'Plain-clothes security personnel' },
      { id: 'security-night', label: 'Night Duty', icon: '🌙', desc: 'Night shift security coverage' },
      { id: 'security-day', label: 'Day Duty', icon: '☀️', desc: 'Day shift security coverage' },
    ],
  },
  {
    id: 'delivery',
    label: 'Delivery',
    icon: '📦',
    category: 'Transport',
    desc: 'Select the type of delivery service needed',
    subtypes: [
      { id: 'delivery-small-parcel', label: 'Small Parcel', icon: '📦', desc: 'Small package and document delivery' },
      { id: 'delivery-bike', label: 'Bike Delivery', icon: '🏍️', desc: 'Fast bike delivery for local areas' },
      { id: 'delivery-van', label: 'Van Delivery', icon: '🚐', desc: 'Large items and bulk delivery by van' },
      { id: 'delivery-courier', label: 'Courier Service', icon: '📬', desc: 'Professional courier and logistics' },
    ],
  },
];

/**
 * Returns a special job config by its ID.
 * @param {string} jobId
 * @returns {object|undefined}
 */
export function getSpecialJob(jobId) {
  return SPECIAL_JOBS.find((job) => job.id === jobId);
}

/**
 * Returns true if the given job ID has a dedicated special page.
 * @param {string} jobId
 * @returns {boolean}
 */
export function isSpecialJob(jobId) {
  return SPECIAL_JOBS.some((job) => job.id === jobId);
}

/**
 * Returns all special job IDs.
 * @returns {string[]}
 */
export function getSpecialJobIds() {
  return SPECIAL_JOBS.map((job) => job.id);
}
