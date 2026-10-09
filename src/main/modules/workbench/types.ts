export enum UserRelations{
  allMembers = 'all-members', //全部成员
  manager = 'manager', //主管
  sameDepartmentUser = 'same-department-users', //同部门成员
  allSupervisorManager = 'all-supervisor-manager', //所有上级部门主管
  superiorDepartmentMembers = 'superior-department-members', //所有上级部门成员
  allDescendantMembers = 'all-descendant-members', //所有下级部门成员
  createrSelf = 'creater-self', //提交人自己
}