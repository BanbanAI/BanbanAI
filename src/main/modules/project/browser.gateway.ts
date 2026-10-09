import { Logger, Injectable, Inject } from "@nestjs/common";
import { MessageBody, SubscribeMessage, WebSocketGateway, ConnectedSocket, OnGatewayConnection } from "@nestjs/websockets";
import { Socket } from "socket.io";
import { UserRest } from "../client";
import { ProjectService } from "./project.services";
import { CoEditingAccount, CoEditingAccounts, ProjectBody } from '@common/types/project';
import { handleMergeProjectBody } from "@common/utils";
import { Gateway } from "./gateway";
import { MikroORM } from "@mikro-orm/core";
import { UserWrapper } from "../user";
import AsyncLock from 'async-lock';
import { WorkbenchService } from "../workbench/workbench.service";
import { OfficeService } from "../office/office.service";
import { isEmpty } from "@common/utils/object";

@Injectable()
@WebSocketGateway({
  namespace: "project",
  cors: { origin: '*' },
  maxHttpBufferSize: 1e9,
  pingTimeout: 10 * 60 * 1000,
  upgradeTimeout: 60 * 1000,
  useHttpServer: true,
})
export class BrowserGateway extends Gateway implements OnGatewayConnection {
  protected readonly logger = new Logger("BrowserGateway");
  private lock = new AsyncLock({ timeout: 60 * 1000 });
  private readonly projectCoEditingInfo: Record<string, CoEditingAccounts> = {};  // 协作状态
  constructor(
    protected readonly orm: MikroORM, // used by @UseRequestContext()
    protected readonly projectService: ProjectService,
    protected readonly workbenchService: WorkbenchService,
    protected readonly userRest: UserRest,
    protected readonly officeService: OfficeService,
    @Inject("USER") protected user: UserWrapper,
  ) {
    super();
  }
  handleConnection(socket: Socket) {
    super.handleConnection(socket);
    if (this.getQuery(socket).isCoordinationEdit) {
      this.logger.log("Coordination Edit connection", this.getQuery(socket));
    }
  }

  handleDisconnect(socket: Socket) {
    if (this.getQuery(socket).isCoordinationEdit) {
      this.logger.log("Coordination Edit disconnect", this.getQuery(socket));
      this.exitCoEditing(socket);
    }
  }

  private async createEmptyCoEditingAccount(id: string): Promise<CoEditingAccount> {
    const account = await this.workbenchService.getUserById(id);
    if (!account) {
      this.logger.log("account not find", id);
      return null;
    }
    return {
      id,
      username: account.user,
      nickname: account.user,
    }
  }

  @SubscribeMessage("join-coordination-edit")
  async joinCoordinationEdit(@ConnectedSocket() socket: Socket) {
    const { projectId, accountId, clientId } = this.getQuery(socket);
    this.logger.log("join coordination edit", projectId, accountId, clientId);
    const coEditingAccount = await this.createEmptyCoEditingAccount(accountId);
    if (!coEditingAccount) {
      this.logger.log("create empty coordination account fail", accountId);
      return {
        success: false,
        message: global.i18next.t("browserGatewayTs.accountInvalid"),
      };
    }
    if (!this.projectCoEditingInfo[projectId]) {
      this.projectCoEditingInfo[projectId] = {};
    }
    const coEditingAccounts = this.projectCoEditingInfo[projectId];
    if (coEditingAccounts[accountId]) {
      // 这个账号已经在一个tab打开了
      this.logger.log("This account has already opened the same project", accountId, projectId);
    }
    coEditingAccounts[accountId] = coEditingAccount;
    this.logger.log("join account ", accountId);
    this.syncCooperationStates(coEditingAccounts, socket);
    return { success: true };
  }

  private async exitCoEditing(socket: Socket) {
    const { projectId, accountId } = this.getQuery(socket);
    if (!projectId || !accountId) return;
    let coEditingAccounts = this.projectCoEditingInfo[projectId];
    delete coEditingAccounts[accountId];
    this.logger.log("account exitCoEditing ", projectId, accountId);
    socket.disconnect();
    this.syncCooperationStates(coEditingAccounts, socket);

  }

  private syncCooperationStates(coEditingAccounts: CoEditingAccounts, socket: Socket) {
    const { projectId, accountId } = this.getQuery(socket);
    for (const [key, client] of socket.nsp.sockets) {
      // 只给同一个项目的人同步消息
      if (this.getQuery(client).projectId === projectId) {
        let coEditingAccounts = this.projectCoEditingInfo[projectId];
        const curCoEditingAccount = coEditingAccounts[accountId];
        client.emit('sync-coEditingAccounts', {
          coEditingAccounts: Object.values(coEditingAccounts),
          curCoEditingAccount
        });
      }
    }
  }

  private syncProjectBody(coEditingAccount: CoEditingAccount, projectBody: ProjectBody, socket: Socket) {
    const { projectId, clientId } = this.getQuery(socket);
    for (const [key, client] of socket.nsp.sockets) {
      // 只给同一个项目的人同步消息，自己不同步
      const { projectId: tProjectId, clientId: tClientId } = this.getQuery(client);
      if (tProjectId === projectId && tClientId !== clientId) {
        client.emit('sync-projectBody', {
          coEditingAccount,
          projectBody
        });
      }
    }
  }

  @SubscribeMessage("update-coordination-states")
  async updateCoordinationStates(@MessageBody() body, @ConnectedSocket() socket: Socket) {
    const { projectId, accountId } = this.getQuery(socket);
    if (!projectId || !accountId || isEmpty(body)) {
      this.logger.log("update coordination status fail", projectId, accountId, body);
      return false;
    }
    let coEditingAccounts = this.projectCoEditingInfo[projectId];
    const coEditingAccount = coEditingAccounts[accountId];
    if (!coEditingAccount) {
      this.logger.log("update states account is false");
      return false;
    }
    const hasEditingProjectAccount = Object.values(coEditingAccounts).find(coEditingAccount => {
      if(accountId !== coEditingAccount.id) {
        return coEditingAccount.editModule === 'project' || coEditingAccount.editModule === 'all'
      }
    });
    if (body.editModule === 'project' && hasEditingProjectAccount) {
      this.logger.log("current coordination status is not update", projectId, accountId, body);
      return false;
    }

    if (!coEditingAccount?.editModule) {
      coEditingAccount.editModule = body.editModule;
    } else if (coEditingAccount.editModule === 'all') {
      if (body.editModule !== 'board') {
        this.logger.log("current coordination status is not update", projectId, accountId, body);
        return true;
      }
    } else if (coEditingAccount.editModule !== body.editModule) {
      coEditingAccount.editModule = 'all';
    }

    if (body.editModule === 'board') {
      const boardUIDs = coEditingAccount.boardUIDs || [];
      if (boardUIDs.includes(body.boardId)) {
        this.logger.log("current coordination status is not update", projectId, accountId, body);
        return true;
      }
      boardUIDs.push(body.boardId);
      coEditingAccount.boardUIDs = boardUIDs;
    }

    // 同步消息;
    this.logger.log("update states account success", projectId, accountId, body);
    this.syncCooperationStates(coEditingAccounts, socket);
    return true;
  }

  @SubscribeMessage('save-project')
  async saveProject(@MessageBody('projectBody') newProjectBody: ProjectBody, @ConnectedSocket() socket: Socket) {
    const { projectId, accountId, nocodeId } = this.getQuery(socket);
    if (!projectId || !accountId) {
      this.logger.log("save project failed", projectId, accountId);
      return {
        success: false,
      };
    }

    let coEditingAccounts = this.projectCoEditingInfo[projectId];
    const coEditingAccount = coEditingAccounts[accountId];
    if (!coEditingAccount?.editModule) {
      this.logger.log(`${ coEditingAccount.username } not need save project`, projectId, accountId);
      return {
        success: true,
        message: global.i18next.t("browserGatewayTs.notNeedSaveProject")
      };
    }
    
    const data = await this.lock.acquire(projectId, async () => {
      const originProjectBody = await this.projectService.getProjectBody(nocodeId, projectId);
      //  根据editModule 和 boardsId来保存相应的部分
      const projectBody = await handleMergeProjectBody(coEditingAccount, originProjectBody, newProjectBody);
      try {
        this.logger.log(`${ coEditingAccount.username } start save project`, projectId, accountId);
        const startTime = Date.now();
        await this.projectService.saveProjectBody(nocodeId, projectId, projectBody);
        this.logger.log(`${ coEditingAccount.username } save project success`, projectId, accountId);
        this.logger.log(`Save Done in ${ Date.now() - startTime }ms`);
      } catch (err) {
        socket.emit('error', { message: err.message });
        this.logger.log(`${ coEditingAccount.username } save project fail`, projectId, accountId);
        return false;
      }
      return projectBody;
    });

    if (data) {
      // 先同步前端的projectBody
      this.syncProjectBody(coEditingAccount, data, socket);
      // 再reset 并同步状态
      delete coEditingAccount.editModule;
      delete coEditingAccount.boardUIDs;
      this.syncCooperationStates(coEditingAccounts, socket);
      return {
        success: true,
      };
    }
    return {
      success: false,
    };
  }

}
