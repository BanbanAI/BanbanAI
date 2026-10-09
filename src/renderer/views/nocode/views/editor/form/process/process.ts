import { isBranchNode } from "@common/utils/flow";
import { unique } from "@common/utils/unique";
import { ProcessNodeOwnerType, ApprovalCategory, ApprovalCategoryRule, ApprovalOptions, OwnerEmptyHandle, ApproverSameAsSubmitter, ApproverType, DataChangeOptions, DataChangeType, NotifyOptions, ProcessBranch, ProcessFlow, ProcessNodeType, TransactOptions, AddDataOptions, EditDataOptions, ConditionBranchOptions, TimeTaskOptions, TimeTaskMethod, TimeTaskDateType, TimeTaskDatePoint, ReportDataOptions, TimeTaskRepeat, TriggerMode, Table, isTimeTaskSingleTriggerMode, OperationTriggerMode, getOperationTriggerMode, ProcessTimeoutActionType, ProcessTimeoutDeadlineType, ProcessTimeoutRelativePoint, ProcessTimeoutUnit, ProcessNodeOwner } from "@common/types/project";
import { FormConditionValueType, LogicalOperator, ProcessContext } from "@common/types/nocode";
import { deepClone, equals, isEmpty } from '@common/utils/object';
import { effectScope, EffectScope, reactive, ref, watch } from "vue";
import { finalizationRegistry } from "@renderer/b2/finalization";
import { copyNodes } from "../utils";
import i18next from "i18next";
import { getUserDisplayName } from "@renderer/utils/other";
import { ADMIN_USERNAME } from "@common/types/account";

const getProcessUserName = (users: any[] = [], id?: string, fallback?: string) => {
  const user = (users || []).find(item => item?.id === id)
  return getUserDisplayName(user, fallback)
}

const asOwnerRecord = (value: unknown): Record<string, any> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
)

const asIdList = (value: unknown): string[] => (
  Array.isArray(value) ? value : []
)

const createDefaultTimeoutOption = () => ({
  enabled: false,
  deadline: {
    type: ProcessTimeoutDeadlineType.CUSTOM,
    value: {
      point: ProcessTimeoutRelativePoint.AFTER_NODE_ARRIVAL,
      delay: 1,
      unit: ProcessTimeoutUnit.DAY,
    },
  },
  deadlineFieldId: null,
  rules: [],
})

const defaultProcessNodeOwnerOrder = [
  ProcessNodeOwnerType.SUBMITTER,
  ProcessNodeOwnerType.ASSIGNEE,
  ProcessNodeOwnerType.DEPARTMENT_MANAGER,
  ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER,
  ProcessNodeOwnerType.FORM_MEMBER,
  ProcessNodeOwnerType.FORM_DEPARTMENT,
]

const getProcessNodeOwnerOrder = (owner?: ProcessNodeOwner) => {
  if (!owner) return []
  const selected = (type: ProcessNodeOwnerType) => type === ProcessNodeOwnerType.SUBMITTER ? owner[type] : type in owner
  const sourceOrder = Array.isArray(owner.ownerOrder) ? owner.ownerOrder : defaultProcessNodeOwnerOrder
  const order = sourceOrder.filter(type => defaultProcessNodeOwnerOrder.includes(type) && selected(type))
  const missingTypes = defaultProcessNodeOwnerOrder.filter(type => selected(type) && !order.includes(type))
  return [...order, ...missingTypes]
}

const getProcessNodeOwnerNames = (owner: ProcessNodeOwner, context: ProcessContext) => {
  let result = []
  const formFields = context.formFields
  const organizeData = context.organizeData
  for (const ownerType of getProcessNodeOwnerOrder(owner)) {
    if (ownerType === ProcessNodeOwnerType.SUBMITTER && owner[ProcessNodeOwnerType.SUBMITTER]) {
      result.push(i18next.t('process.submitterSelf'))
    }
    if (ownerType === ProcessNodeOwnerType.ASSIGNEE && owner[ProcessNodeOwnerType.ASSIGNEE]) {
      const assignee = owner[ProcessNodeOwnerType.ASSIGNEE]
      if (assignee?.roles?.length) {
        const roles = assignee.roles
          .map(item => (organizeData?.roles ?? []).find(d => d.id === item)?.name)
          .filter(Boolean)
        result = [...result, ...roles]
      }
      if (assignee?.users?.length) {
        const users = assignee.users
          .map(item => getProcessUserName(organizeData?.users, item))
          .filter(Boolean)
        result = [...result, ...users]
      }
    }
    if (ownerType === ProcessNodeOwnerType.DEPARTMENT_MANAGER && owner[ProcessNodeOwnerType.DEPARTMENT_MANAGER]) {
      const manager = owner[ProcessNodeOwnerType.DEPARTMENT_MANAGER]
      const title = manager.mode === 'down' ? i18next.t('process.topDeptManager') : i18next.t('process.directDeptManager')
      const level = manager.mode === 'down' ? i18next.t('process.minus') : i18next.t('process.plus')
      result.push(manager.value === 0 ? title : title + level + ` ${manager.value} ${i18next.t('process.levelDept')}` )
    }
    if (ownerType === ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER && owner[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER]) {
      const manager = owner[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER]
      const title = manager.mode === 'down' ? i18next.t('process.topDeptManager') : i18next.t('process.directDeptManager')
      const level = manager.mode === 'down' ? i18next.t('process.minus') : i18next.t('process.plus')
      result.push(manager.value === 0 ? title : title + level + ` ${manager.value} ${i18next.t('process.levelDept')}` )
    }
    if (ownerType === ProcessNodeOwnerType.FORM_MEMBER && owner[ProcessNodeOwnerType.FORM_MEMBER]) {
      owner[ProcessNodeOwnerType.FORM_MEMBER].forEach(item => {
        const field = formFields.find(f => f.uid === item)
        if(field) {
          result.push(field.alias)
        }
      })
    }
    if (ownerType === ProcessNodeOwnerType.FORM_DEPARTMENT && owner[ProcessNodeOwnerType.FORM_DEPARTMENT]) {
      const formDepartment = owner[ProcessNodeOwnerType.FORM_DEPARTMENT].value
      const filed = formFields.find(f => f.uid === formDepartment)
      if(filed) {
        result.push(filed.alias)
      }
    }
  }
  return result
}


export class ProcessNode {
  protected _isValid = true;
  protected _errorMsg = "";

  constructor(private flow: ProcessFlow, public parent: Branch) {
    this.initAfterConstructor();
  }

  protected initAfterConstructor() {

  }


  get uid() {
    return this.flow.uid;
  }

  get type() {
    return this.flow.type;
  }
  
  get options() {
    return this.flow.options || {};
  }

  set options(options) {
    this.flow.options = options;
  }

  get title() {
    return this.options.name;
  }

  get content() {
    // const ownerNames = this.getOwnerNames();
    // if (ownerNames.length > 0) {
    //   return `${nodeOwnerAlias[this.type]}：${ownerNames.join("、")}` 
    // } else {
    //   return `暂未设置${nodeOwnerAlias[this.type]}` 
    // }
    // TODO
    return i18next.t('process.notDeveloped')
  }

  validate() {
    return true;
  }

  get valid() {
    return this._isValid;
  }

  get errorMsg() {
    return this._errorMsg;
  }

  get isOtherBranch() {
    return false;
  }

  get branchIndex() {
    const index = this.parent.getOwner().branches.findIndex(branch => 
      branch?.nodes?.some(node => node.getFlow().uid === this.uid)
    )
    return index
  }

  getFlow() {
    return this.flow;
  }

  copy() {
    if (!this.parent?.context?.allowStructureEdit) {
      return;
    }
    const flow = deepClone(this.flow);
    flow.uid = unique();
    const index = this.parent.nodes.findIndex(n => n.uid === this.uid);
    this.parent.addNode(flow, index + 1);
  }
  
  remove() {
    if (!this.parent?.context?.allowStructureEdit) {
      return;
    }
    this.parent.removeNode(this);
    this.destroy();
  }

  destroy() {

  }

  // 找到源头节点
  findSourceNode() {
    const _findSourceNode = (node: ProcessNode) => {
      const owner = node?.parent?.getOwner()
      if ((owner as StartNode)?.type === ProcessNodeType.START) {
        return node?.parent?.getBranch()?.flows?.[0]
      } else if (owner?.parent) {
        return _findSourceNode(owner)
      } else {
        return null
      }
    }
    return _findSourceNode(this)
  }

  findLastNode(predicate: (node: ProcessNode) => boolean): ProcessNode | null {
    const index = this.parent.nodes.findIndex(node => node.uid === this.uid);
    
    for (let i = index - 1; i >= 0; i--) {
      const node = this.parent.nodes[i];
      
      if ((node as BranchNode).branches) {
        const branchNode = node as BranchNode;
        for (let j = branchNode.branches.length - 1; j >= 0; j--) {
          const branch = branchNode.branches[j];
          const branchNodes = branch.nodes;
          if (branchNodes.length > 0) {
            const lastNodeInBranch = branchNodes[branchNodes.length - 1];
            const found = lastNodeInBranch.findLastNode(predicate);
            if (found) return found;
          }
        }
      }
      
      if (predicate(node)) {
        return node;
      }
    }
    
    const owner = this.parent.getOwner();
    if (owner && owner.parent) {
      return owner.findLastNode(predicate);
    }
    
    return null;
  }

}

//办理节点
export class TransactNode extends ProcessNode {
  name = "transactNode";
  constructor(flow: ProcessFlow, parent: Branch) {
    super(flow, parent);
    if(!flow.options) {
      flow.options = { fieldAuth: 'all', name: i18next.t('process.handle') }
      const optionValue = flow.options as TransactOptions
      optionValue.transactor = optionValue.transactor || {[ProcessNodeOwnerType.SUBMITTER]: true}
      optionValue.transactorEmpty = OwnerEmptyHandle.ADMIN
      optionValue.transactorEmptyAdmin = optionValue.transactorEmptyAdmin
        || parent.context?.organizeData?.users?.find(item => item?.user === ADMIN_USERNAME)?.id
      optionValue.allowTransfer = optionValue.allowTransfer == null ? true : optionValue.allowTransfer
      optionValue.allowRevert = optionValue.allowRevert == null ? true : optionValue.allowRevert
      optionValue.allowStash = optionValue.allowStash == null ? false : optionValue.allowStash
      optionValue.allowFinishFlow = optionValue.allowFinishFlow == null ? false : optionValue.allowFinishFlow
      optionValue.transactorType = ApproverType.OR
      optionValue.requireTransactComments = optionValue.requireTransactComments == null ? false : optionValue.requireTransactComments
      optionValue.requireSatisfyCondition = optionValue.requireSatisfyCondition == null ? false : optionValue.requireSatisfyCondition
      optionValue.timeout = optionValue.timeout || createDefaultTimeoutOption()
      optionValue.finishCondition = optionValue.finishCondition || {
        sourceTables: [],
        conditions: [[
          {
            type: FormConditionValueType.FORM,
            func: null,
            value: null,
            uid: null,
          }
        ]],
      }
    }
    const optionValue = flow.options as TransactOptions
    optionValue.transactor = asOwnerRecord(optionValue.transactor)
    optionValue.transactorEmptyUsers = asIdList(optionValue.transactorEmptyUsers)
  }

  get title() {
    return super.title || i18next.t('process.handleNode');
  }

  get content() {
    const transactorEmptyUsers = asIdList(this.options.transactorEmptyUsers)
    const result = getProcessNodeOwnerNames(this.options.transactor, this.parent.context)
    if(result.length) {
      return i18next.t('process.handlerLabel') + result.join('、')
    } else if(this.options.transactorEmpty === OwnerEmptyHandle.ADMIN) {
      return getProcessUserName(this.parent.context?.organizeData?.users, this.options.transactorEmptyAdmin)
    } else {
      return i18next.t('process.handlerLabel') + transactorEmptyUsers.map(id => getProcessUserName(this.parent.context.organizeData?.users, id))?.filter(Boolean)?.join('、')
    }
  }

  override validate(): boolean {
    this._isValid = true;
    const optionValue = this.options as TransactOptions
    if(optionValue.transactorEmpty === OwnerEmptyHandle.ADMIN) {
      if(!optionValue.transactorEmptyAdmin) this._isValid = false;
      this._errorMsg = i18next.t('process.completeSettingsTips')
    } else if(optionValue.transactorEmpty === OwnerEmptyHandle.ASSIGNEE) {
      if(!optionValue.transactorEmptyUsers?.length) this._isValid = false;
      this._errorMsg = i18next.t('process.completeSettingsTips')
    }
    return this.valid;
  }
}

//审批节点
export class ApprovalNode extends ProcessNode { 
  name = "approvalNode"
  constructor(flow: ProcessFlow, parent: Branch) {
    super(flow, parent);
    if(!flow.options) {
      flow.options = { fieldAuth: 'all', name: i18next.t('process.approve') }
      const optionValue = flow.options as ApprovalOptions
      optionValue.category = optionValue.category || ApprovalCategory.MANUAL
      optionValue.categoryRule = optionValue.categoryRule || ApprovalCategoryRule.NORMAL
      optionValue.approver = optionValue.approver || {[ProcessNodeOwnerType.SUBMITTER]: true}
      optionValue.approverType = optionValue.approverType || ApproverType.AND
      optionValue.approverEmpty = optionValue.approverEmpty || OwnerEmptyHandle.AUTO_APPROVE
      optionValue.approverSameAsSubmitter = optionValue.approverSameAsSubmitter || ApproverSameAsSubmitter.SELF
      optionValue.allowTransfer = optionValue.allowTransfer == null ? true : optionValue.allowTransfer
      optionValue.allowStash = optionValue.allowStash == null ? false : optionValue.allowStash
      optionValue.allowFinishFlow = optionValue.allowFinishFlow == null ? false : optionValue.allowFinishFlow
      optionValue.allowRevert = optionValue.allowRevert == null ? true : optionValue.allowRevert
      optionValue.allowReject = optionValue.allowReject == null ? true : optionValue.allowReject
      optionValue.continueAfterReject = optionValue.continueAfterReject == null ? false : optionValue.continueAfterReject
      optionValue.rollbackDataBeforeReject = optionValue.rollbackDataBeforeReject == null ? false : optionValue.rollbackDataBeforeReject
      optionValue.requireApprovalComments = optionValue.requireApprovalComments == null ? false : optionValue.requireApprovalComments
      optionValue.timeout = optionValue.timeout || createDefaultTimeoutOption()
    }
    const optionValue = flow.options as ApprovalOptions
    optionValue.approver = asOwnerRecord(optionValue.approver)
    optionValue.approverEmptyUsers = asIdList(optionValue.approverEmptyUsers)
  }

  get title() {
    return super.title || i18next.t('process.approveNode');
  }

  get content() {
    if(this.options.category != ApprovalCategory.MANUAL) {
      return this.options.category === ApprovalCategory.AUTO_APPROVE ? i18next.t('process.autoApprove') : i18next.t('process.autoReject')
    }
    const approverEmptyUsers = asIdList(this.options.approverEmptyUsers)
    const result = getProcessNodeOwnerNames(this.options.approver, this.parent.context)
    
    if(result.length) {
      return i18next.t('process.approverLabel') + result.join('、')
    } else if(this.options.approverEmpty === OwnerEmptyHandle.AUTO_APPROVE){
      return i18next.t('process.autoApprove')
    } else if(this.options.approverEmpty === OwnerEmptyHandle.ADMIN) {
      return i18next.t('process.approverLabel') + getProcessUserName(this.parent.context.organizeData.users, this.options.approverEmptyAdmin)
    } else {
      return i18next.t('process.approverLabel') + approverEmptyUsers.map(id => getProcessUserName(this.parent.context.organizeData?.users, id))?.filter(Boolean)?.join('、')
    }
  }

  override validate(): boolean {
    this._isValid = true;
    const optionValue = this.options as ApprovalOptions
    if(optionValue.approverEmpty === OwnerEmptyHandle.ADMIN) {
      if(!optionValue.approverEmptyAdmin) this._isValid = false;
      this._errorMsg = i18next.t('process.completeSettingsTips')
    } else if(optionValue.approverEmpty === OwnerEmptyHandle.ASSIGNEE) {
      if(!optionValue.approverEmptyUsers?.length) this._isValid = false;
      this._errorMsg = i18next.t('process.completeSettingsTips')
    }
    return this.valid;
  }
}

//抄送节点
export class NotifyNode extends ProcessNode {
  name = "notifyNode"
  constructor(flow: ProcessFlow, parent: Branch) {
    super(flow, parent);
    if(!flow.options) {
      flow.options = { fieldAuth: 'all', name: i18next.t('process.cc') }
      const optionValue = flow.options as NotifyOptions
      optionValue.notifier = optionValue.notifier || {[ProcessNodeOwnerType.SUBMITTER]: true}
    }
    const optionValue = flow.options as NotifyOptions
    optionValue.notifier = asOwnerRecord(optionValue.notifier)
  }

  get title() {
    return super.title || i18next.t('process.ccNode');
  }

  get content() {
    const result = getProcessNodeOwnerNames(this.options.notifier, this.parent.context)
    return i18next.t('process.ccPerson') + result.join('、')
  }

  override validate(): boolean {
    this._isValid = true;
    const notifier = asOwnerRecord(this.options.notifier)
    const hasNotifier = !!(
      notifier[ProcessNodeOwnerType.SUBMITTER]
      || notifier[ProcessNodeOwnerType.ASSIGNEE]?.roles?.length
      || notifier[ProcessNodeOwnerType.ASSIGNEE]?.users?.length
      || notifier[ProcessNodeOwnerType.DEPARTMENT_MANAGER]
      || notifier[ProcessNodeOwnerType.FORM_MEMBER]?.length
      || notifier[ProcessNodeOwnerType.FORM_DEPARTMENT]?.value
    )
    if(!hasNotifier) {
      this._isValid = false;
      this._errorMsg = i18next.t('process.completeSettingsTips')
    }
    return this.valid;
  }
}

export class Branch {
  private _instancedNode: { [key: string]: ProcessNode } = {};
  private _effectScope: EffectScope;
  private _nodes: ProcessNode[] = reactive([]);
  private _destroyed = false;
  private isValid = true;
  get effectScope() {
    if (!this._effectScope) {
      this._effectScope = effectScope(true);
    }
    return this._effectScope;
  }
  constructor(private branch: ProcessBranch, private owner: BranchNode, public context: ProcessContext) {
    this.effectScope.run(()=>{
      watch(() => this.branch.flows.map((flow)=>flow.uid), (value, oldValue) => {
        if (equals(value, oldValue)) return;
        this.syncNodes();
      }, {deep: true, immediate: true});
    });
  }

  private syncNodes() {
    const nodes: ProcessNode[] = [];
    for (const flow of this.branch.flows || []) {
      let node = this._instancedNode?.[flow.uid];
      if (!node) {
        const TheNode = getProcessNode(flow.type);
        if (!TheNode) continue;
        node = new TheNode(flow, this);
        this._instancedNode[flow.uid] = node;
        finalizationRegistry.register(node, "Node " + node.title);
      }
      nodes.push(node);
    }
    this._nodes.splice(0, this._nodes.length, ...nodes);
  }

  getBranch() {
    return this.branch;
  }

  getOwner() {
    return this.owner
  }

  getFlows() {
    return this.branch.flows || [];
  }

  addNode(node: ProcessFlow, _index = -1) {
    if (!this.context.allowStructureEdit) {
      return null;
    }
    const flows = this.branch.flows || [];
    const index = _index < 0 ? flows.length : _index;
    flows.splice(index, 0, node);
    this.branch.flows = flows;
    this.syncNodes();
    this.updateHistory("structure");
    return this.nodes.find(_node => _node.uid === node.uid);
  }

  moveNode(node: ProcessNode, targetBranch: Branch, targetIndex: number) {
    if (!this.context.allowStructureEdit || !targetBranch?.context?.allowStructureEdit) {
      return null;
    }
    if (!node || !targetBranch) return null;
    const sourceFlows = this.branch.flows || [];
    const sourceIndex = sourceFlows.findIndex(flow => flow.uid === node.uid);
    if (sourceIndex < 0) return null;

    const sameBranch = this.uid === targetBranch.uid;
    const nextTargetIndex = sameBranch && sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    const normalizedTargetIndex = Math.max(0, Math.min(nextTargetIndex, (targetBranch.branch.flows || []).length));
    if (sameBranch && normalizedTargetIndex === sourceIndex) {
      return node;
    }

    const [flow] = sourceFlows.splice(sourceIndex, 1);
    this.branch.flows = sourceFlows;

    const targetFlows = sameBranch ? sourceFlows : (targetBranch.branch.flows || []);
    if (!sameBranch) {
      const movingNode = this._instancedNode?.[flow.uid];
      if (movingNode) {
        delete this._instancedNode[flow.uid];
        movingNode.parent = targetBranch;
        targetBranch._instancedNode[flow.uid] = movingNode;
      }
    }
    targetFlows.splice(normalizedTargetIndex, 0, flow);
    targetBranch.branch.flows = targetFlows;

    this.syncNodes();
    if (!sameBranch) {
      targetBranch.syncNodes();
    }
    this.updateHistory("structure");
    return targetBranch.nodes.find(_node => _node.uid === node.uid) || null;
  }

  removeNode(node: ProcessNode) {
    if (!this.context.allowStructureEdit) {
      return;
    }
    const flows = this.branch.flows || [];
    const index = flows.findIndex(flow => flow.uid === node.uid);
    if (index < 0) return;
    flows.splice(index, 1);
    this.branch.flows = flows;
    this.syncNodes();
    this.updateHistory("structure");
  }

  private lastDeleteNodeIndex = -1;
  private hashlastDeleteFlows = [];

  // 删除某一个节点之后的所有节点，会先缓存所有的节点，然后删除
  removeNodeAfter(node: ProcessNode) {
    if (!this.context.allowStructureEdit) {
      return;
    }
    const flows = this.branch.flows || [];
    const index = flows.findIndex(flow => flow.uid === node.uid);
    if (index < 0) return;
    this.lastDeleteNodeIndex = index + 1;
    this.hashlastDeleteFlows = flows.splice(this.lastDeleteNodeIndex);
    this.branch.flows = flows;
    this.syncNodes();
    this.updateHistory("structure");
  }

  // 撤销删除某一个节点之后的所有节点
  undoRemoveNodeAfter() {
    if (!this.context.allowStructureEdit) {
      return;
    }
    if (this.lastDeleteNodeIndex < 0) return;
    const flows = this.branch.flows || [];
    flows.splice(this.lastDeleteNodeIndex, 0, ...this.hashlastDeleteFlows);
    this.branch.flows = flows;
    this.syncNodes();
    this.updateHistory("structure");
  }


  validate() {
    this.isValid = true;
    for (const node of this.nodes) {
      const valid = node.validate();
      if (!valid) this.isValid = false;
    }
    return this.isValid;
  }

  get uid() {
    return this.branch.uid;
  }

  get index() {
    return this.owner.getFlow().branches.findIndex(branch => branch.uid === this.uid);
  }

  get nodes() {
    return this._nodes;
  }

  get destroyed() {
    return this._destroyed;
  }

  updateHistory(changeType: "settings" | "structure" = "settings") {
    this.context.normalizeFlowOptions?.();
    this.context.updateHistory(changeType);
  }

  copy() {
    if (!this.owner?.parent?.context?.allowStructureEdit) {
      return;
    }
    this.owner.copyBranch(this);
  }

  remove() {
    if (!this.owner?.parent?.context?.allowStructureEdit) {
      return;
    }
    if (this.owner) {
      this.owner.removeBranch(this);
    }
    this.destroy();
  }

  changeIndex(targetIndex, thisIndex) {
    if (!this.owner?.parent?.context?.allowStructureEdit) {
      return;
    }
    if (this.owner) {
      this.owner.changeIndex(targetIndex, thisIndex);
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.effectScope.stop();
    for (const node of this._nodes) {
      node.destroy();
    }
    this._nodes.splice(0, this._nodes.length);
    this._instancedNode = {};
    this._destroyed = true;
  }

  /** 是否有某一个节点 */
  hasNodeType(types: string[]) {
    if (!Array.isArray(types) || types.length === 0) return false;
    const _findType = (flows: ProcessFlow[]) => {
      for (const flow of flows) {
        if (types.includes(flow.type)) return true;
        if (flow.branches) {
          for (const branch of flow.branches) {
            if (types.includes(branch.type)) return true;
            const state = _findType(branch.flows);
            if (state) return true;
          }
        }
      }
      return false;
    }

    return _findType(this.branch.flows)
  }
}

export class BranchNode extends ProcessNode {
  private _branches: Branch[] = reactive([]);
  private _effectScope: EffectScope;
  private _instancedBranch: { [key: string]: Branch } = {};
  get effectScope() {
    if (!this._effectScope) {
      this._effectScope = effectScope(true);
    }
    return this._effectScope;
  }
  protected override initAfterConstructor() {
    const flow = this.getFlow();
    this.effectScope.run(()=>{
      watch(() => flow.branches, () => {
        this.syncBranches();
      }, {deep: true});
    })
    if (isEmpty(flow.branches)) {
      // flow.flows = [];
      if (isBranchNode(this.type)) {
        this.addBranch()
        this.addBranch()
      }
    }
  }

  addBranch(nodes?: ProcessFlow[], _index = -1) {
    if (!this.parent?.context?.allowStructureEdit) {
      return;
    }
    nodes = !isEmpty(nodes) ? nodes : isBranchNode(this.type) ? [
      {
        uid: unique(),
        type: ProcessNodeType.BRANCH_SETTING,
      },
    ] : [];
    const flow = this.getFlow();
    const branches = (flow.branches || []).filter(b => !isEmpty(b.flows));
    const index = (_index < 0 && isBranchNode(this.type)) ? branches.length - 1 : _index;
    const branch = {
      uid: unique(),
      type: this.type,
      flows: nodes,
    };
    if (index < 0) {
      branches.push(branch);
    } else {
      branches.splice(index, 0, branch);
    }
    flow.branches = branches;
    this.parent?.updateHistory("structure");
  }

  removeBranch(branch: Branch) {
    if (!this.parent?.context?.allowStructureEdit) {
      return;
    }
    const flow = this.getFlow();
    if (isBranchNode(flow.type) && flow.branches.length === 2) {
      for (const _branch of this.branches) {
        if (!_branch.destroyed) {
          _branch.destroy();
        }
      }
      flow.branches.length = 0;
      this.remove();
    } else {
      flow.branches = flow.branches.filter((item) => item.uid !== branch.uid);
      if (!branch.destroyed) {
        branch.destroy();
      }
    }
    this.parent?.updateHistory("structure");
  }

  changeIndex(targetIndex, thisIndex) {
    if (!this.parent?.context?.allowStructureEdit) {
      return;
    }
    if(targetIndex === thisIndex || targetIndex < 0 || thisIndex < 0) {
      return
    }
    const branches = this.getFlow().branches
    if(targetIndex > branches.length - 2 || thisIndex > branches.length - 2) {
      return
    }
    const [currentBranch] = branches.splice(thisIndex, 1)
    branches.splice(targetIndex, 0, currentBranch)
  }

  copyBranch(branch: Branch) {
    if (!this.parent?.context?.allowStructureEdit) {
      return;
    }
    const flowNodes = copyNodes(branch.nodes);
    const index = this.branches.findIndex((item) => item.uid === branch.uid);
    this.addBranch(flowNodes, index + 1);
  }

  override validate(): boolean {
    this._isValid = true;
    for (const branch of this.branches) {
      const valid = branch.validate();
      if (!valid) this._isValid = false;
    }
    return this.valid;
  }

  get branches() {
    if (this.getFlow().branches.length !== this._branches.length) {
      this.syncBranches();
    }
    return this._branches;
  }

  private async syncBranches() {
    const flow = this.getFlow();
    const flowBranches = flow.branches;
    const branches: Branch[] = [];
    for (const flowBranch of flowBranches) {
      let branch = this._instancedBranch?.[flowBranch.uid];
      if (!branch) {
        branch = new Branch(flowBranch, this, this.parent.context);
        this._instancedBranch = this._instancedBranch || {};
        this._instancedBranch[flowBranch.uid] = branch;
        finalizationRegistry.register(branch, "Branch " );
      }
      branches.push(branch);
    }
    this._branches.splice(0, this._branches.length, ...branches);
  }

  destroy() {
    super.destroy();
    for (const branch of this._branches) {
      branch.destroy();
    }
    this._branches.splice(0, this._branches.length);
    this._instancedBranch = {};
  }
}

//条件分支节点
export class ConditionBranchNode extends BranchNode {
  name = "conditionBranchNode";

  constructor(flow: ProcessFlow, parent: Branch) {
    super(flow, parent);
    if(!flow.options) {
      flow.options = { name: i18next.t('process.conditionBranchNode') }
    }
    flow.branches = flow.branches.map(branch => {
      if (branch.flows[0]?.type !== ProcessNodeType.BRANCH_SETTING) {
        branch.flows.unshift({
          uid: unique(),
          type: ProcessNodeType.BRANCH_SETTING,
        })
        this.parent?.updateHistory();
      }
      return branch;
    })
  }

}

//并行分支节点
export class ParallelBranchNode extends BranchNode {
  name = "parallelBranchNode";

  constructor(flow: ProcessFlow, parent: Branch) {
    super(flow, parent);
    if(!flow.options) {
      flow.options = { name: i18next.t('process.parallelBranchNode') }
    }
    flow.branches = flow.branches.map(branch => {
      if (branch.flows[0]?.type !== ProcessNodeType.BRANCH_SETTING) {
        branch.flows.unshift({
          uid: unique(),
          type: ProcessNodeType.BRANCH_SETTING,
        })
        this.parent?.updateHistory();
      }
      return branch;
    })
  }

}

//分支设置节点
export class BranchSettingNode extends ProcessNode {
  name = "branchSettingNode";

  constructor(flow: ProcessFlow, parent: Branch) {
    super(flow, parent);
    if(!flow.options) {
      const ownerNode = this.parent.getOwner();
      const isParallel = ownerNode instanceof ParallelBranchNode;
      flow.options = { name: this.isOtherBranch ? i18next.t('process.otherBranch') : isParallel ? `${i18next.t('process.parallelBranch')}${parent.index+1}` : `${i18next.t('process.conditionBranch')}${parent.index+1}` }
      const optionValue = flow.options as ConditionBranchOptions
      optionValue.sourceTables = []
      if(!isParallel) {
        optionValue.conditions = [
          [
            {
              type: FormConditionValueType.FORM,
              func: null,
              value: null,
              uid: null,
            }
          ]
        ]
      } else {
        optionValue.conditions = []
      }
    }
  }

  get isOtherBranch() {
    const branch = this.parent.getOwner().getFlow().branches.at(-1);
    const uid = branch?.flows?.find(node => node?.type === ProcessNodeType.BRANCH_SETTING)?.uid;
    return uid === this.uid
  }

  get title() {
    return super.title || (this.parent as unknown as ConditionBranchNode).title;
  }

  get content() {
    const conditions = (this.options.conditions ?? [])
      .filter(group => {
        return group.filter(item => {
          return (item.type != FormConditionValueType.FORM || item.uid)
        }).length > 0
      })
    if(conditions.length === 0) {
      return i18next.t('process.setConditionTips')
    }
    const result = conditions.map((group, index) => {
      return i18next.t('process.conditionGroup')+ (index + 1)
    })
    return `${i18next.t('process.judgeConditionLabel')}${result.join('、')}`
  }

  override validate(): boolean {
    this._isValid = true;
    if (this.isOtherBranch) return true;
    if (this.parent.getOwner() instanceof ConditionBranchNode) {
      if(this.content === i18next.t('process.setConditionTips')) {
        this._isValid = false
      }
    }
    return this.valid;
  }
}

//数据变化节点
export class DataChangeNode extends ProcessNode {
  name = "dataChangeNode"
  constructor(flow: ProcessFlow, parent: Branch) {
    super(flow, parent);
    if(!flow.options) {
      flow.options = {fieldAuth: 'all', name: i18next.t('process.dataChange')}
      const optionValue = flow.options as DataChangeOptions
      optionValue.changeType = [DataChangeType.ADD]
      optionValue.allowStash = optionValue.allowStash == null ? false : optionValue.allowStash
      optionValue.allowFinishFlow = optionValue.allowFinishFlow == null ? false : optionValue.allowFinishFlow
      optionValue.enableTriggerConditions = false
      optionValue.sourceTables = []
      optionValue.waitCrossTableFlowCompletion = false
    }
    const optionValue = flow.options as DataChangeOptions
    optionValue.waitCrossTableFlowCompletion = optionValue.waitCrossTableFlowCompletion === true
  }

  get title() {
    return super.title || i18next.t('process.dataChange')
  }

  get content() {
    const textObj = {
      [DataChangeType.ADD]: i18next.t('process.add'),
      [DataChangeType.DELETE]: i18next.t('process.delete'),
      [DataChangeType.EDIT]: i18next.t('process.modify'),
    }
    return `${i18next.t('process.dataChangeLabel')}${this.options.changeType.map(item => textObj[item]).join('、')}`;
  }
}

//定时触发节点
export class TimeTaskNode extends ProcessNode {
  name = "timeTaskNode"

  constructor(flow: ProcessFlow, parent: Branch) {
    super(flow, parent);
    if(!flow.options) {
      flow.options = {name: i18next.t('process.timingTrigger')}
      const optionValue = flow.options as TimeTaskOptions
      optionValue.enableTriggerConditions = false
      optionValue.sourceTables = []
      optionValue.triggerTime = '21:00'
      optionValue.repeat = TimeTaskRepeat.ONECE
      optionValue.method = TimeTaskMethod.BASIC_TASK
      optionValue.triggerMode = TriggerMode.MULTI
      optionValue.startDate = {
        type: TimeTaskDateType.FIELD,
        value: null,
      }
      optionValue.endDate = {
        type: TimeTaskDateType.FIELD,
        value: null,
      }
      optionValue.triggerTimePoint = {
        type: TimeTaskDatePoint.AFTER,
        value: 1
      }
    }
  }

  get content() {
    return i18next.t('process.timingTask')
  }

  getNextFlowDisabledNodeTypes(options: TimeTaskOptions) {
    /** 定时任务节点 设置了单条触发模式 时 不支持审核/办理节点 */
    return isTimeTaskSingleTriggerMode(options) ? [ProcessNodeType.TRANSACT, ProcessNodeType.APPROVAL] : []
  }

  /** 后续流程需要禁用的节点 */
  get nextFlowDisabledNodeTypes() {
    /** 定时任务节点 设置了单条触发模式 时 不支持审核/办理节点 */
    const optionsValue = this.options as TimeTaskOptions
    return this.getNextFlowDisabledNodeTypes(optionsValue)
  }
}

export class ManualTriggerNode extends ProcessNode {
  name = "manualTriggerNode"

}

export class OperationTriggerNode extends ProcessNode {
  name = "operationTriggerNode"

  constructor(flow: ProcessFlow, parent: Branch) {
    super(flow, parent);
    if (!flow.options) {
      flow.options = {
        fieldAuth: "all",
        name: i18next.t("process.operationTrigger"),
        triggerMode: OperationTriggerMode.EACH_RECORD,
        allowViewContextOnce: false,
      } as any;
    } else {
      const operationTriggerOptions = flow.options as any;
      operationTriggerOptions.triggerMode = getOperationTriggerMode(flow.options as any);
      operationTriggerOptions.allowViewContextOnce = operationTriggerOptions.triggerMode === OperationTriggerMode.VIEW_CONTEXT_ONCE;
    }
  }

  get title() {
    return super.title || i18next.t("process.operationTrigger");
  }

  get content() {
    return i18next.t("process.operationTriggerContent");
  }
}

export class ReportDataNode extends ProcessNode {
  name = "reportDataNode"

  constructor(flow: ProcessFlow, parent: Branch) {
    super(flow, parent);
    if(!flow.options) {
      flow.options = {name: i18next.t('process.dataFill')}
      const optionValue = flow.options as ReportDataOptions
      optionValue.reporter = {
        [ProcessNodeOwnerType.SUBMITTER]: true,
      }
      optionValue.reporterEmpty = OwnerEmptyHandle.ASSIGNEE
      optionValue.reporterEmptyUser = null
      optionValue.reporterEmptyAdmin = null
      optionValue.allowStash = optionValue.allowStash == null ? false : optionValue.allowStash
      optionValue.allowFinishFlow = optionValue.allowFinishFlow == null ? false : optionValue.allowFinishFlow
      optionValue.requireTransactComments = optionValue.requireTransactComments == null ? true : optionValue.requireTransactComments
      optionValue.requireSatisfyCondition = optionValue.requireSatisfyCondition == null ? false : optionValue.requireSatisfyCondition
      optionValue.timeout = optionValue.timeout || createDefaultTimeoutOption()
      optionValue.finishCondition = optionValue.finishCondition || {
        sourceTables: [],
        conditions: [[
          {
            type: FormConditionValueType.FORM,
            func: null,
            value: null,
            uid: null,
          }
        ]],
      }
    }
  }

  get content() {
    const optionValue = this.options as ReportDataOptions
    if(optionValue.targetTableUID) {
      const name = this.parent?.context?.tables?.find(item => item.uid === optionValue.targetTableUID)?.alias ?? optionValue.targetTableUID
      return `${i18next.t('process.targetFormLabel')}${name}`
    } else {
      return i18next.t('process.setTargetFormTips')
    }
  }

  override validate(): boolean {
    this._isValid = true;
    const optionValue = this.options as ReportDataOptions
    if(!optionValue.targetTableUID) {
      this._isValid = false;
      this._errorMsg = i18next.t('process.setTargetFormTips')
    } else if(optionValue.reporterEmpty === OwnerEmptyHandle.ADMIN) {
      if(!optionValue.reporterEmptyAdmin) this._isValid = false;
      this._errorMsg = i18next.t('process.completeSettingsTips')
    } else if(optionValue.reporterEmpty === OwnerEmptyHandle.ASSIGNEE) {
      if(!optionValue.reporterEmptyUser) this._isValid = false;
      this._errorMsg = i18next.t('process.completeSettingsTips')
    }
    return this.valid;
  }
}

export class OtherTableProcessingNode extends ProcessNode {
  name = "otherTableProcessingNode"

  override validate(): boolean {
    this._isValid = true;
    if (!this.options.targetTableUID) {
      this._isValid = false;
      this._errorMsg = i18next.t('process.setTargetFormTips');
    }
    return this.valid;
  }
}

//添加数据节点
export class AddDataNode extends OtherTableProcessingNode {
  name = "addDataNode"

  constructor(flow: ProcessFlow, parent: Branch) {
    super(flow, parent);
    if(!flow.options) {
      flow.options = { name: i18next.t('process.addData') }
      const optionValue = flow.options as AddDataOptions
      optionValue.sourceTables = []
      optionValue.triggerTargetProcess = true
    }
  }

  get content() {
    const content = getDataContent(this.parent?.context?.tables, this.options, 'add')
    return content
  }
}

//修改数据节点
export class EditDataNode extends OtherTableProcessingNode {
  name = "editDataNode"

  constructor(flow: ProcessFlow, parent: Branch) {
    super(flow, parent);
    if(!flow.options) {
      flow.options = { name: i18next.t('process.modifyData') }
      const optionValue = flow.options as EditDataOptions
      optionValue.sourceTables = []
      optionValue.triggerTargetProcess = true
      optionValue.targetTableFilterRule = {
        logic: LogicalOperator.AND,
        conditions: []
      }
    }
  }

  get content() {
    const content = getDataContent(this.parent?.context?.tables, this.options, 'edit')
    return content
  }
}

//删除数据节点
export class DeleteDataNode extends OtherTableProcessingNode {
  name = "deleteDataNode"

  constructor(flow: ProcessFlow, parent: Branch) {
    super(flow, parent);
    if(!flow.options) {
      flow.options = { name: i18next.t('process.deleteData') }
      const optionValue = flow.options as EditDataOptions
      optionValue.sourceTables = []
      optionValue.triggerTargetProcess = true
      optionValue.targetTableFilterRule = {
        logic: LogicalOperator.AND,
        conditions: []
      }
    }
  }

  get content() {
    const content = getDataContent(this.parent?.context?.tables, this.options, 'delete')
    return content
  }
}

//开始节点
export class StartNode extends BranchNode {
  name = "startNode"
}

//结束节点
export class EndNode extends ProcessNode {
  name = "endNode"
}

const allNodes = {
  [ProcessNodeType.START]: StartNode,
  [ProcessNodeType.END]: EndNode,
  [ProcessNodeType.TRANSACT]: TransactNode,
  [ProcessNodeType.APPROVAL]: ApprovalNode,
  [ProcessNodeType.NOTIFY]: NotifyNode,
  [ProcessNodeType.TRIGGER_DATA_CHANGE]: DataChangeNode,
  [ProcessNodeType.TRIGGER_TIME_TASK]: TimeTaskNode,
  [ProcessNodeType.TRIGGER_MANUAL]: ManualTriggerNode,
  [ProcessNodeType.TRIGGER_OPERATION]: OperationTriggerNode,
  [ProcessNodeType.CONDITION_BRANCH]: ConditionBranchNode,
  [ProcessNodeType.PARALLEL_BRANCH]: ParallelBranchNode,
  [ProcessNodeType.BRANCH_SETTING]: BranchSettingNode,
  [ProcessNodeType.REPORT_DATA]: ReportDataNode,
  [ProcessNodeType.ADD_DATA]: AddDataNode,
  [ProcessNodeType.EDIT_DATA]: EditDataNode,
  [ProcessNodeType.DELETE_DATA]: DeleteDataNode,
};
export function getProcessNode(type: ProcessNodeType) {
  return allNodes[type];
}

const getDataContent = (tables: Table[], options: AddDataOptions, type: 'edit' | 'delete' | 'add') => {
  const typeName = {
    get edit(){return i18next.t('process.edit')},
    get delete(){return i18next.t('process.delete')},
    get add(){return i18next.t('process.addSec')}
  }
  const optionValue = options
  if(optionValue.targetTableUID) {
    const table = tables?.find(item => item.uid === optionValue.targetTableUID)
    if (!table) {
      return i18next.t('process.formDeletedTips')
    }
    const isSubTable = !!table.meta?.extra?.primaryTable
    if(isSubTable) {
      const primaryTableUID = table.meta?.extra?.primaryTable?.[1]
      const primaryTable = tables?.find(item => item.uid === primaryTableUID)
      if (primaryTable) {
        const field = primaryTable.fields?.find(item => item.meta?.extra?.subTableUID?.[1] === table.uid)
        const name = field?.alias
        return `${typeName[type]}${i18next.t('process.dataLabel')}${primaryTable.alias}.${name}`
      }
    }
    const name = tables?.find(item => item.uid === optionValue.targetTableUID)?.alias ?? optionValue.targetTableUID
    return `${typeName[type]}${i18next.t('process.dataLabel')}${name}`
  } else {
    return i18next.t('process.setTargetFormTips')
  }
}
