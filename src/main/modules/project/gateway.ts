import { Logger, OnApplicationBootstrap } from '@nestjs/common'
import { getFileMd5 } from '@main/utils/md5';
import fs from 'fs';
import { ConnectedSocket, MessageBody, OnGatewayInit, OnGatewayConnection, SubscribeMessage, WebSocketServer } from '@nestjs/websockets';
import { UserRest } from '../client';
import { Namespace, Socket } from 'socket.io';
import path from 'path';
import { getRuntime } from '@main/runtime';
import { ProjectService } from './project.services';
import { MikroORM, RequestContext } from "@mikro-orm/core";
import { UserWrapper } from '../user';
import { getExpressSession } from '../auth/middlewares/session';
import passport from "socket.io-passport";
import { WorkbenchService } from '../workbench/workbench.service';
import { RequestStorage } from '@main/middleware';
import { OfficeService } from '@main/modules/office/office.service';

type GatewayMessage = {
  event: string;
  handler: (socket: Socket, ...args: any[]) => void;
};

type HandshakeQuery = {
  projectId: string;
  clientId: string;
  accountId?: string;
  nocodeId: string;
  isCoordinationEdit?: boolean;
  EIO: string;
  t: string;
  transport: string;
  installPlugin?: boolean;
}

type InstallInfo = Partial<{
  status: "downloading" | "downloaded" | "unzip" | "startupFail" | "startupSuccess" | "downloadError";
  progress: number;
}>

export class Gateway implements OnGatewayConnection, OnGatewayInit {
  protected readonly orm: MikroORM;
  protected readonly logger = new Logger("Gateway");
  protected readonly userRest: UserRest;
  protected readonly projectService: ProjectService;
  protected readonly workbenchService: WorkbenchService;
  protected readonly user: UserWrapper;
  protected readonly officeService: OfficeService;
  private installInfo: InstallInfo = {}; // 安装打印插件锁

  @WebSocketServer()
  server: Namespace;

  get port() {
    return this.httpServer.address().port;
  }

  get httpServer() {
    return this.server.server['httpServer'];
  }
  getQuery(socket: Socket) {
    return socket.handshake.query as unknown as HandshakeQuery;
  }

  afterInit(namespace: Namespace) {
    namespace.use((socket, next)=>{
      RequestStorage.runWithRequest(socket.request as any, next);
    });
    namespace.use(async (socket, next)=>{
      const req = socket.request as any;
      const m = /workbench\=(\w+)/.exec(req.url);
      if (m) {
        const nocodeId = m[1];
        req.nocode = {
          id: nocodeId,
        };
      }
      next();
    });
    namespace.use((socket, next)=>{
      const req = socket.request as any;
      getExpressSession().then((expressSession)=>{
        if (expressSession) {
          expressSession(req as any, {} as any, ()=>{
            passport.initialize({userProperty: "account"})(socket, () => {
              passport.session()(socket, () => {
                next();
              })
            })
          });
        } else {
          next();
        }
      });
    });
  }

  handleConnection(socket: Socket) {
    socket.use((event, next)=>{
      RequestStorage.runWithRequest(socket.request as any, next);
    });
    socket.use((event, next)=>{
      RequestContext.create(this.orm.em, next);
    });
  }

  protected emitByWhere(socket: Socket, where: (query: HandshakeQuery) => boolean, handle: (socket: Socket) => void) {
    for (const [key, client] of socket.nsp.sockets) {
      if (where(this.getQuery(client))) {
        handle(client);
      }
    }
  }

  @SubscribeMessage("install-print-plugin")
  async installPrintPlugin(
    @ConnectedSocket() socket: Socket
  ) {
    // 检查是否已有安装进程在运行
    if (this.installInfo.status) {
      socket.emit("install-multiple", { message: global.i18next.t('gateway.installing'), ...this.installInfo });
      return;
    }
    // 设置安装锁
    this.installInfo.status = "downloading";

    const userDataPath = await getRuntime().getUserDataPath();
    const filename = `office${Date.now()}.zip`;
    const tempDir = path.join(userDataPath, 'Temp');
    const savePath = path.join(tempDir, filename);
    
    try {
      //下载
      const installUrl = await this.officeService.getPluginInstallURL();
      await this.projectService.downloadFile(installUrl, savePath, (progress) => {
        const _progress = Math.floor((progress * 80 / 100) * 10000) / 100;
        this.installInfo.progress = _progress;
        this.emitByWhere(socket, (query) => query.installPlugin, (_socket) => {
          _socket.emit("progress", _progress);
          if (progress == 1) {
            this.installInfo.status = "downloaded";
            _socket.emit("downloaded");
          }
        })
      });

      // 解压
      const result = await this.officeService.installOfficePlugin(savePath);
      if (result) {
        this.installInfo.status = "unzip";
        this.emitByWhere(socket, (query) => query.installPlugin, (_socket) => {
          _socket.emit("unzip");
        });
      }
      // 启动服务
      const startUpInfo = await this.officeService.startup();
      if (!startUpInfo) {
        this.installInfo.status = "startupFail";
        this.emitByWhere(socket, (query) => query.installPlugin, (_socket) => {
          _socket.emit("startup-fail");
        });
      } else if (!startUpInfo?.success) {
        this.installInfo.status = "startupFail";
        this.emitByWhere(socket, (query) => query.installPlugin, (_socket) => {
          _socket.emit("startup-fail", startUpInfo.type);
        });
      } else {
        this.installInfo.status = "startupSuccess";
        this.emitByWhere(socket, (query) => query.installPlugin, (_socket) => {
          _socket.emit("startup-success");
        });
      }
    } catch (err) {
      this.installInfo.status = "downloadError";
      this.emitByWhere(socket, (query) => query.installPlugin, (_socket) => {
        _socket.emit("download-error", {
          message: err?.message || String(err),
          reason: err?.message || String(err),
        });
      });
    } finally {
      this.installInfo = {};
    }
  }
}
