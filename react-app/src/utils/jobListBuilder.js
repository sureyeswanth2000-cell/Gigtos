import { SERVICE_CATALOG } from './aiAssistant';
import { SPECIAL_JOBS } from '../config/specialJobs';

/**
 * Normalizes a service name to a URL-safe ID.
 * @param {string} name
 * @returns {string}
 */
export function normalizeJobId(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/**
 * Merges SERVICE_CATALOG entries with matching SPECIAL_JOBS to produce a unified list.
 * Special jobs take priority; catalog items not covered by a special job are appended.
 * @returns {Array<{ id, name, icon, desc, category, isSpecial, isUpcoming?, keywords? }>}
 */
export function buildJobList() {
  const specialIds = new Set(SPECIAL_JOBS.map((j) => j.id));
  const list = SPECIAL_JOBS.map((sj) => ({
    id: sj.id,
    name: sj.label,
    icon: sj.icon,
    desc: sj.desc,
    category: sj.category,
    isSpecial: true,
  }));

  for (const svc of SERVICE_CATALOG) {
    const normalizedId = normalizeJobId(svc.name);
    if (!specialIds.has(normalizedId)) {
      list.push({
        id: normalizedId,
        name: svc.name,
        icon: svc.icon,
        desc: svc.desc,
        category: svc.category,
        isUpcoming: svc.isUpcoming,
        isSpecial: false,
        keywords: svc.keywords,
      });
    }
  }

  return list;
}

/**
 * Pre-built list of all jobs for reuse across components.
 */
export const ALL_JOBS = buildJobList();
