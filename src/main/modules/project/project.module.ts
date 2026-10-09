import { Module, Global } from '@nestjs/common'
import { ProjectController } from './project.controller'
import { ProjectService } from './project.services'
import { ConnectionUtils } from './connection.utils'
import { WidgetManager } from '@main/modules/widgets/widget.manager'
import { BrowserGateway } from './browser.gateway'
import { Rest } from '../client/rest/base.rest'

@Global()
@Module({
  controllers: [ ProjectController ],
  providers: [ ProjectService, ConnectionUtils, WidgetManager, BrowserGateway, Rest ],
  exports: [ ProjectService, ConnectionUtils, BrowserGateway, WidgetManager ]
})
export class ProjectModule {
}
