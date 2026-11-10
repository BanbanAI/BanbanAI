import { Module, Global } from '@nestjs/common'
import { ProjectController } from './project.controller'
import { ProjectService } from './project.services'
import { ConnectionUtils } from './connection.utils'
import { WidgetManager } from '@main/modules/widgets/widget.manager'
import { BrowserGateway } from './browser.gateway'
import { Rest } from '../client/rest/base.rest'
import { CONNECTION_UTILS, PROJECT_SERVICE } from "@main/constants";

@Global()
@Module({
  controllers: [ ProjectController ],
  providers: [
    ProjectService,
    ConnectionUtils,
    WidgetManager,
    BrowserGateway,
    Rest,
    { provide: PROJECT_SERVICE, useExisting: ProjectService },
    { provide: CONNECTION_UTILS, useExisting: ConnectionUtils },
  ],
  exports: [ ProjectService, ConnectionUtils, BrowserGateway, WidgetManager, PROJECT_SERVICE, CONNECTION_UTILS ]
})
export class ProjectModule {
}
