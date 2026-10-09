import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { WorkbenchService } from "./workbench.service";
import { AiPermissionConfig, PublishCategory, PublishUpdateMethod } from "@common/types/project";
import { Request } from 'express';
import { NoLocalAuthGuard } from "../auth/guards";
import { ProjectService } from "../project/project.services";
import { PREFERENCES } from "@main/constants";
import { Preferences } from "../common";
import { getAllForms, getAllPages, getInnerPublishUpdateMethod } from "@common/utils";
import { NocodeStructure, NocodeStructureType } from "@common/types/nocode";
 import { RequestStorage } from '@main/middleware';
import { deepClone, isEmpty } from "@common/utils/object";
import { AdminPermissionsGuard, NoAdminPermissionGuard } from "./guards";
import { isSystemAdminAccount } from "@common/types/account";

@Controller('workbench')
@UseGuards(AdminPermissionsGuard)
export class WorkbenchController {
  constructor(
    private readonly workbenchService: WorkbenchService,
    private readonly projectService: ProjectService,
    @Inject(PREFERENCES) private readonly preferences: Preferences,
  ) {}

  @NoLocalAuthGuard()
  @NoAdminPermissionGuard()
  @Get('/get-user-list')
  async getUserList(){
    return await this.workbenchService.getUserList();
  }

  @Post('/add-user')
  async addUser(@Body('user') user) {
    return await this.workbenchService.addUser(user);
  }

  @Post('/add-user-to-department')
  async addUserToDepartment(@Body('userIds') userIds: string[], @Body('departmentId') departmentId: string) {
    return await this.workbenchService.addUserToDepartment(userIds, departmentId);
  }

  @Post('/add-user-to-role')
  async addUserToRole(@Body('userIds') userIds: string[], @Body('roleId') roleId: string) {
    return await this.workbenchService.addUserToRole(userIds, roleId);
  }

  @Post('/update-department-parent')
  async updateDepartmentParent(@Body('departmentId') departmentId: string, @Body('parent') parent: string) {
    return await this.workbenchService.updateDepartmentParent(departmentId, parent);
  }

  @Post('/remove-user-permanently')
  async removeUserPermanently(@Req() req: Request, @Body('id') id: string) {
    return await this.workbenchService.removeUserPermanently(req.account, id);
  }

  @Post('/remove-user-permanently-list')
  async removeUserPermanentlyList(@Req() req: Request, @Body('ids') ids: string[]) {
    const targetIds = Array.isArray(ids) ? ids : [];
    const results: any[] = [];
    for (const targetId of targetIds) {
      results.push(await this.workbenchService.removeUserPermanently(req.account, targetId));
    }
    return results;
  }

  @Post('/update-user')
  async updateUser(@Body('user') user) {
    return await this.workbenchService.updateUser(user);
  }

  @NoAdminPermissionGuard()
  @Post('/update-user-info')
  async updateUserInfo(@Body('user') user) {
    return await this.workbenchService.updateUserInfo(user);
  }

  @NoAdminPermissionGuard()
  @Post('update-password')
  updatePassword(@Body('oldPassword') oldPassword: string, @Body('newPassword') newPassword: string, @Req() req: Request) {
    return this.workbenchService.updatePassword(req.account.id, oldPassword, newPassword);
  }

  @NoAdminPermissionGuard()
  @Get('personal-key-secret')
  getPersonalKeySecret(@Req() req: Request) {
    return this.workbenchService.getAccountKeySecret(req.account.id);
  }

  @NoAdminPermissionGuard()
  @Post('personal-key-secret/reset')
  resetPersonalKeySecret(@Req() req: Request) {
    return this.workbenchService.resetAccountKeySecret(req.account.id);
  }

  @NoLocalAuthGuard()
  @NoAdminPermissionGuard()
  @Get('/get-department-list')
  async getDepartmentList() {
    return await this.workbenchService.getDepartmentList();
  }

  @Post('/add-department')
  async addDepartment(@Body('department') department) {
    return await this.workbenchService.addDepartment(department);
  }

  @Post('/remove-department')
  async removeDepartment(@Body('id') id: string) {
    return await this.workbenchService.removeDepartment(id);
  }

  @Post('/update-department')
  async updateDepartment(@Body('department') department) {
    return await this.workbenchService.updateDepartment(department);
  }

  @Post('/update-department-managers')
  async updateDepartmentManagers(@Body('id') id: string, @Body('managers') managers: string[]) {
    const normalizedManagers = Array.isArray(managers)
      ? managers.map(item => String(item || "").trim()).filter(Boolean)
      : [];

    return await this.workbenchService.updateDepartmentManagers(id, normalizedManagers);
  }

  @NoLocalAuthGuard()
  @NoAdminPermissionGuard()
  @Get('/get-role-list')
  async getRoleList() {
    return await this.workbenchService.getRoleList();
  }

  @Post('/add-role')
  async addRole(@Body() options) {
    const role = await this.workbenchService.addRole(options);
    if (options.userIds) {
      await this.workbenchService.addUserToRole(options.userIds, role.id);
    }
    return role;
  }

  @Post('/remove-role')
  async removeRole(@Body('id') id: string) {
    return await this.workbenchService.removeRole(id);
  }

  @Post('/remove-role-group')
  async removeRoleGroup(@Body('id') id: string) {
    return await this.workbenchService.removeRoleGroup(id);
  }

  @Post('/update-role')
  async updateRole(@Body('role') role) {
    return await this.workbenchService.updateRole(role);
  }
  
  @NoAdminPermissionGuard()
  @Get(":nocodeId/get-nocode-preview")
  async getNocodePreview(@Req() request: Request, @Param("nocodeId") nocodeId:string, @Query("filter") filter?: string, @Query("includePageBodies") includePageBodies?: string) {
    const shouldReturnPageBodies = includePageBodies !== "0";
    const shouldLoadPageBodies = shouldReturnPageBodies || !!filter;
    const meta = await this.projectService.getNocodeMeta(nocodeId);
    let {account} = RequestStorage.current.req ?? {};
    if (!account) {
      account = await this.workbenchService.getAnonymousUser();
    }
    const body = await this.projectService.getEditorNocodeBodyWithOtherDataSources(nocodeId, account);
    if (!body) {
      throw new Error(global.i18next.t('workbenchController.appNotExist'));
    }
    // body.structure 与主进程缓存的 nocodeBody 共享引用，下面按共享/权限过滤时会改写分组对象与数组，
    // 这里先克隆一份，避免把编辑器随后读取的结构裁掉（隐藏节点、未共享页面会被当成缺失表单重新补到根节点末尾）
    body.structure = deepClone(body.structure || []);
    const innerIsLiveUpdate = getInnerPublishUpdateMethod(meta) === PublishUpdateMethod.LIVE;
    const pages = getAllPages(body.structure || []);
    let pageBodies = [];
    let currentPageBodies = [];
    if (shouldLoadPageBodies) {
      pageBodies = await Promise.all(pages.map(async (page) => {
        try {
          return await this.projectService.getProjectBody(nocodeId, page.id, innerIsLiveUpdate);
        } catch (err) {
          return null;
        }
      }));
      currentPageBodies = innerIsLiveUpdate ? pageBodies : await Promise.all(pages.map(async (page) => {
        try {
          return await this.projectService.getProjectBody(nocodeId, page.id, true);
        } catch (err) {
          return null;
        }
      }));
    }
    const sharedPageIds = new Set(pageBodies.filter(page => page?.sharing).map(page => page.id));
    const currentSharedPageIds = new Set(currentPageBodies.filter(page => page?.sharing).map(page => page.id));
    const isPageShared = (pageId: string) => sharedPageIds.has(pageId) && currentSharedPageIds.has(pageId);
    
    // 获取当前登录的用户信息
    let departments: string[] = [];
    const allDepartments = await this.workbenchService.getAllDepartments();
    const departmentMap = new Map(allDepartments.map(dep => [dep.id, dep.parent]));

    for (const depId of account.departments) {
      let parentId: string | undefined = depId;
      const visited = new Set<string>(); // 防止循环

      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        departments.push(parentId);
        parentId = departmentMap.get(parentId);
      }
    }
    // 去重
    departments = [...new Set(departments)];

    //判断部门和角色是否包含在权限范围内的函数
    const hasIntersection = (rangeData, accountData) => accountData.some(item => rangeData.includes(item));

    //筛选出有查看权限的节点
    function filterNode(array) {
      for (let i = 0; i < array.length; i++) {
        const node = array[i];

        // 正确递归处理子节点
        if (node.type === 'group' && !isEmpty(node.children)) {
          filterNode(node.children);
          if(isEmpty(node.children)) {
            array.splice(i, 1);
            i--; // 防止跳过下一个
            continue;
          }
        }

        const table = body.formData?.tables?.find(table => table.uid === node.id);
        let sharing
        // 检查是否有共享设置
        if(table) {
          sharing = table.publish?.sharing || false
        } else if (node.type === NocodeStructureType.PAGE) {
          sharing = isPageShared(node.id)
        }
        // 自动发布默认开启共享
        if(innerIsLiveUpdate) {
          sharing = true
        }
        
        const permission = body.permissions.page[node.id];
        if (!permission) {
          continue;
        }
        const { range, rangeType } = permission.get;
        const notAllowed = (
          rangeType === 'custom' &&
          !range.users.includes(account.id) &&
          !hasIntersection(range.departments, departments) &&
          !hasIntersection(range.roles, account.roles)
        );
        if (notAllowed || !sharing) {
          array.splice(i, 1);
          i--; // 防止跳过下一个
          continue;
        }
      }
    }

    //默认状态保护
    if(!isSystemAdminAccount(account) && body.permissions && body.permissions?.page) {
      filterNode(body.structure)
    }

    if (filter) {
      const filterStructure = (structures: NocodeStructure[]) => {
        const _structures = [];
        for (const structure of structures) {
          if (structure.disable) continue;
          if (structure.type === NocodeStructureType.GROUP) {
            structure.children = filterStructure(structure.children);
            _structures.push(structure);
          } else if (structure.type === NocodeStructureType.PAGE) {
            if (isPageShared(structure.id)) {
              _structures.push(structure);
            }
          } else {
            _structures.push(structure);
          }
        }
        return _structures;
      }
      body.structure = filterStructure(body.structure || []);
    }

    pageBodies = pageBodies.filter(page => page && isPageShared(page.id));
    if (!shouldReturnPageBodies) {
      return {
        meta,
        body,
      };
    }
    return {
      meta,
      body,
      pageBodies,
    };
  }

  @NoLocalAuthGuard()
  @NoAdminPermissionGuard()
  @Get(":nocodeId/get-nocode-project")
  async getNocodeProject(@Query('type') type: PublishCategory, @Query('nocodeId') nocodeId: string, @Query('projectId') projectId: string, @Query('isPreview') isPreview: string) {
    return this.projectService.getNocodeProject(type, nocodeId, projectId, isPreview ? true : false);
  }

  @NoAdminPermissionGuard()
  @Get("/get-view-nocode-layer")
  async getViewNocodeLayer(@Query('type') type: PublishCategory, @Query('nocodeId') nocodeId: string, @Query('id') id: string) {
    return this.projectService.getViewNocodeLayer(type, nocodeId, id);
  }

  @NoLocalAuthGuard()
  @NoAdminPermissionGuard()
  @Post(":nocodeId/visit-nocode-project")
  async visitNocodeProject(@Body('type') type: PublishCategory, @Body('nocodeId') nocodeId: string, @Body('projectId') projectId: string, @Body('password') password: string) {
    return this.projectService.visitNocodeProject(type, nocodeId, projectId, password);
  }


  @NoLocalAuthGuard()
  @NoAdminPermissionGuard()
  @Post("completed-init")
  async completedInit(@Body("password") password: string, @Body("companyName") companyName: string) {
    await this.workbenchService.setCompanyName(companyName);
    return this.workbenchService.completedInit(password);
  }

  @NoAdminPermissionGuard()
  @Post("set-company-name")
  async setCompanyName(@Body("companyName") companyName: string) {
    return await this.workbenchService.setCompanyName(companyName);
  }

  @NoLocalAuthGuard()
  @NoAdminPermissionGuard()
  @Get("get-company-name")
  async getCompanyName() {
    return this.preferences.get("companyName", null)
  }

  @Get("get-ai-permission-config")
  async getAiPermissionConfig() {
    return await this.workbenchService.backfillNewlyCreatedAppAiPermissions();
  }

  @Post("set-ai-permission-config")
  async setAiPermissionConfig(@Body() config: AiPermissionConfig) {
    return await this.workbenchService.setAiPermissionConfig(config);
  }

  @Get("get-ai-permission-catalog")
  async getAiPermissionCatalog() {
    const nocodeMetas = await this.projectService.getAllNocodeMetas();
    const apps = await Promise.all(
      nocodeMetas
        .filter(meta => meta?.deleted !== true)
        .map(async meta => {
        const body = await this.projectService.getNocodeBody(meta.id).catch(() => null);
        if (!body) {
          return null;
        }

        const structure = Array.isArray(body.structure) ? body.structure : [];
        if (!getAllForms(structure).length) {
          return null;
        }

        return {
          meta: {
            id: meta.id,
            name: meta.name,
          },
          body: {
            structure,
          },
        };
        }),
    );

    return apps.filter(Boolean);
  }

  @Post("set-admins")
  async setAdmins(@Req() req: Request, @Body("ids") ids: string[]) {
    return await this.workbenchService.setAdmins(req.account, ids);
  }

  @Post("remove-user-as-admin")
  async removeUserAsAdmin(@Req() req: Request, @Body("id") id: string) {
    return await this.workbenchService.removeUserAsAdmin(req.account, id);
  }

  @Get("key-secret")
  async getKeySecret(){
    return this.workbenchService.getKeySecret();
  }

  @Post("key-secret/reset")
  async resetKeySecret(){
    return this.workbenchService.resetKeySecret();
  }

  @Post('/import-users')
  async importUsers(@Body('usersInfoData') usersInfoData) {
    return await this.workbenchService.importUsers(usersInfoData);
  }
}
