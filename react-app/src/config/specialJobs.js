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
      { id: 'driver-with-car', label: 'Car Driver', icon: '🚗', desc: 'Driver who brings their own car', comingSoon: false },
      { id: 'driver-only', label: 'Only Driver', icon: '🧑‍✈️', desc: 'Driver to operate your vehicle', comingSoon: true },
      { id: 'driver-with-bike', label: 'Bike Driver', icon: '🏍️', desc: 'Bike rider for deliveries or errands', comingSoon: true },
      { id: 'driver-with-mini-van', label: 'Mini Van', icon: '🚐', desc: 'Mini van driver for local transport', comingSoon: true },
      { id: 'driver-with-private-bus', label: 'Private Bus', icon: '🚌', desc: 'Private bus driver for group transport', comingSoon: true },
      { id: 'driver-with-bulldozer', label: 'Bulldozer Operator', icon: '🚜', desc: 'Bulldozer operator for earthwork', comingSoon: true },
    ],
  },
  {
    id: 'painter',
    label: 'Painter',
    icon: '🎨',
    category: 'Home Repair',
    desc: 'Select the type of painting service you need',
    subtypes: [
      { id: 'painter-house', label: 'House Painter', icon: '🏠', desc: 'Interior and exterior house painting', comingSoon: false },
      { id: 'painter-wall-art', label: 'Wall Art', icon: '🖌️', desc: 'Decorative wall art and murals', comingSoon: true },
      { id: 'painter-large-building', label: 'Large Building Painter', icon: '🏢', desc: 'Commercial and large building painting', comingSoon: true },
      { id: 'painter-interior', label: 'Interior Painter', icon: '🛋️', desc: 'Specialized interior painting and finishes', comingSoon: false },
    ],
  },
  {
    id: 'kitchen-work',
    label: 'Kitchen Work',
    icon: '🍳',
    category: 'Household Help',
    desc: 'Select the type of kitchen service you need',
    subtypes: [
      { id: 'kitchen-cook', label: 'Cook', icon: '👨‍🍳', desc: 'Home or office cook for daily meals', comingSoon: false },
      { id: 'kitchen-cleaner', label: 'Kitchen Cleaner', icon: '🧹', desc: 'Deep cleaning of kitchen and utensils', comingSoon: true },
      { id: 'kitchen-catering-helper', label: 'Catering Helper', icon: '🍽️', desc: 'Assistant for catering and events', comingSoon: true },
      { id: 'kitchen-chef-assistant', label: 'Chef Assistant', icon: '🧑‍🍳', desc: 'Sous-chef or helper for professional kitchens', comingSoon: true },
    ],
  },
  {
    id: 'garden-work',
    label: 'Garden Work',
    icon: '🌿',
    category: 'Outdoor & Garden',
    desc: 'Select the type of garden service you need',
    subtypes: [
      { id: 'garden-gardener', label: 'Gardener', icon: '🌻', desc: 'General garden maintenance and plant care', comingSoon: false },
      { id: 'garden-tree-trimmer', label: 'Tree Trimmer', icon: '🌳', desc: 'Tree pruning and trimming', comingSoon: true },
      { id: 'garden-lawn-mower', label: 'Lawn Mower', icon: '🌱', desc: 'Lawn mowing and grass cutting', comingSoon: true },
      { id: 'garden-landscape', label: 'Landscape Worker', icon: '🏡', desc: 'Garden design and landscaping', comingSoon: true },
    ],
  },
  {
    id: 'construction-heavy',
    label: 'Construction (Heavy Vehicle)',
    icon: '🏗️',
    category: 'Construction',
    desc: 'Select heavy machinery operator type',
    subtypes: [
      { id: 'construction-bulldozer', label: 'Bulldozer Operator', icon: '🚜', desc: 'Bulldozer for earthmoving and site clearing', comingSoon: true },
      { id: 'construction-crane', label: 'Crane Operator', icon: '🏗️', desc: 'Tower or mobile crane operations', comingSoon: true },
      { id: 'construction-jcb', label: 'JCB Operator', icon: '🦺', desc: 'JCB backhoe loader operations', comingSoon: true },
      { id: 'construction-excavator', label: 'Excavator Operator', icon: '⛏️', desc: 'Excavator for digging and trenching', comingSoon: true },
    ],
  },
  {
    id: 'electrician',
    label: 'Electrician',
    icon: '⚡',
    category: 'Home Repair',
    desc: 'Select the type of electrical service needed',
    subtypes: [
      { id: 'electrician-home', label: 'Home Electrician', icon: '🏠', desc: 'Wiring, fans, lights, switchboards at home', comingSoon: false },
      { id: 'electrician-industrial', label: 'Industrial Electrician', icon: '🏭', desc: 'Industrial wiring and high-voltage work', comingSoon: true },
      { id: 'electrician-emergency', label: 'Emergency Service', icon: '🚨', desc: 'Urgent electrical repairs and power outage help', comingSoon: true },
      { id: 'electrician-with-tools', label: 'Electrician with Tools', icon: '🔧', desc: 'Fully equipped electrician with all tools', comingSoon: false },
    ],
  },
  {
    id: 'plumber',
    label: 'Plumber',
    icon: '🧰',
    category: 'Home Repair',
    desc: 'Select the type of plumbing service needed',
    subtypes: [
      { id: 'plumber-home', label: 'Home Plumber', icon: '🏠', desc: 'Residential plumbing repairs and installations', comingSoon: false },
      { id: 'plumber-building', label: 'Building Plumber', icon: '🏢', desc: 'Commercial building plumbing work', comingSoon: true },
      { id: 'plumber-industrial', label: 'Industrial Plumber', icon: '🏭', desc: 'Industrial pipework and systems', comingSoon: true },
      { id: 'plumber-emergency', label: 'Emergency Plumber', icon: '🚨', desc: 'Urgent leak and pipe burst repairs', comingSoon: false },
    ],
  },
  {
    id: 'cleaner',
    label: 'Cleaner',
    icon: '🧹',
    category: 'Cleaning',
    desc: 'Select the type of cleaning service needed',
    subtypes: [
      { id: 'cleaner-home', label: 'Home Cleaner', icon: '🏠', desc: 'Regular or deep cleaning for homes', comingSoon: false },
      { id: 'cleaner-office', label: 'Office Cleaner', icon: '🏢', desc: 'Office and commercial space cleaning', comingSoon: true },
      { id: 'cleaner-industrial', label: 'Industrial Cleaner', icon: '🏭', desc: 'Factory and industrial facility cleaning', comingSoon: true },
    ],
  },
  {
    id: 'security',
    label: 'Security Guard',
    icon: '🛡️',
    category: 'Security',
    desc: 'Select the type of security service needed',
    subtypes: [
      { id: 'security-uniform', label: 'With Uniform', icon: '👮', desc: 'Uniformed security personnel', comingSoon: false },
      { id: 'security-plain', label: 'Without Uniform', icon: '🕵️', desc: 'Plain-clothes security personnel', comingSoon: true },
      { id: 'security-night', label: 'Night Duty', icon: '🌙', desc: 'Night shift security coverage', comingSoon: true },
      { id: 'security-day', label: 'Day Duty', icon: '☀️', desc: 'Day shift security coverage', comingSoon: true },
    ],
  },
  {
    id: 'delivery',
    label: 'Delivery',
    icon: '📦',
    category: 'Transport',
    desc: 'Select the type of delivery service needed',
    subtypes: [
      { id: 'delivery-small-parcel', label: 'Small Parcel', icon: '📦', desc: 'Small package and document delivery', comingSoon: false },
      { id: 'delivery-bike', label: 'Bike Delivery', icon: '🏍️', desc: 'Fast bike delivery for local areas', comingSoon: false },
      { id: 'delivery-van', label: 'Van Delivery', icon: '🚐', desc: 'Large items and bulk delivery by van', comingSoon: true },
      { id: 'delivery-courier', label: 'Courier Service', icon: '📬', desc: 'Professional courier and logistics', comingSoon: true },
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
