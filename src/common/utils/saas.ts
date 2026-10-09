import { SaasPlan, SaasPlanLevel } from "@common/types/user";

/**
 * 判断 `curPlan` 套餐是否大于等于 `targetPlan`
 * @param curPlan 
 * @param targetPlan 
 * @returns boolean
 */
export const compareSaasPlan = (curPlan: SaasPlan, targetPlan: SaasPlan) => {
  const curLevel = SaasPlanLevel[curPlan] || 0;
  const targetLevel = SaasPlanLevel[targetPlan] || 0;
  return curLevel >= targetLevel;
}

