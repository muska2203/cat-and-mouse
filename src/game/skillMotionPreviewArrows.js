/**
 * Стрелки предпросмотра: откуда и куда сдвинется герой или оттолкнётся цель при подготовке скилла.
 * Данные приходят из единого плана расширенных скиллов (buildExtensionSkillResolvedPlan).
 */

import { getSkillById } from "../skillsRuntime.js?v=0.5.8-pre-alpha";
import {
  buildExtensionSkillResolvedPlan,
  EXTENSION_SKILL_IDS,
} from "./skillsPreparedCast.js?v=0.5.8-pre-alpha";

/**
 * @returns {Array<{ fromX: number, fromY: number, toX: number, toY: number, color: string }>}
 */
export function buildSkillMotionPreviewArrows(run, playerSheet, item, instanceData, skillId, selectedRoots = []) {
  if (!run?.player || !playerSheet || !skillId) return [];
  const roots = Array.isArray(selectedRoots) ? selectedRoots : [];
  if (EXTENSION_SKILL_IDS.has(skillId)) {
    const skill = getSkillById(skillId);
    if (!skill) return [];
    const plan = buildExtensionSkillResolvedPlan(run, playerSheet, skill, instanceData || {}, roots);
    return plan.ok ? (plan.motionArrows || []) : [];
  }
  void item;
  void instanceData;
  return [];
}
