import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata, forwardRef } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SaasPlan } from '@common/types/user'
import { compareSaasPlan } from '@common/utils/saas'
import { UserService } from '../../user/user.service'

const REQUIRED_SAAS_PLAN = 'REQUIRED_SAAS_PLAN'
const SAAS_PLAN_RESTRICTED_MESSAGE = 'SAAS_PLAN_RESTRICTED_MESSAGE'

export const RequireSaasPlan = (plan: SaasPlan) => SetMetadata(REQUIRED_SAAS_PLAN, plan)
export const RequireSaasPlanMessage = (messageKey: string) => SetMetadata(SAAS_PLAN_RESTRICTED_MESSAGE, messageKey)

@Injectable()
export class SaasPlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(forwardRef(() => UserService)) private readonly userService: UserService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPlan = this.reflector.getAllAndOverride<SaasPlan | undefined>(REQUIRED_SAAS_PLAN, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!requiredPlan) return true

    const currentPlan = this.userService.getSaasPlan()
    if (compareSaasPlan(currentPlan, requiredPlan)) {
      return true
    }

    const messageKey = this.reflector.getAllAndOverride<string | undefined>(SAAS_PLAN_RESTRICTED_MESSAGE, [
      context.getHandler(),
      context.getClass(),
    ])
    throw new ForbiddenException(global.i18next.t(messageKey || 'workbenchAiModelManage.planRestricted'))
  }
}
