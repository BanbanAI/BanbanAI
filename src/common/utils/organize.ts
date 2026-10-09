import { Department } from "@common/types/account";

export const getAllRelatedDepartments = (allDepartments: Department[], departmentIds: string[]): string[] => {
  const departmentMap = new Map(allDepartments.map(dep => [dep.id, dep.parent]));
  const departments: string[] = [];

  for (const depId of departmentIds || []) {
    let parentId: string | undefined = depId;
    const visited = new Set<string>(); // 防止循环引用

    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      departments.push(parentId);
      parentId = departmentMap.get(parentId);
    }
  }

  // 去重并返回
  return [...new Set(departments)];
}