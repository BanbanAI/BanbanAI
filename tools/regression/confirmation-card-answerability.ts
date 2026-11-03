import assert from 'node:assert/strict'

import {
  hasNewerAnswerableConfirmationCard,
} from '../../src/renderer/views/nocode/views/editor/ai/components/confirmationInteraction'

// 旧卡后面出现新的可作答确认卡：判被取代。
assert.equal(hasNewerAnswerableConfirmationCard({
  cards: [
    { messageId: 'm1', blockKey: 'form-plan|1', answerable: true },
    { messageId: 'm2', blockKey: 'form-plan|2', answerable: true },
  ],
  messageId: 'm1',
  blockKey: 'form-plan|1',
}), true)

// 后面只有已完成/只读/过期的卡：旧卡不能判被取代，否则就成了无提示死胡同。
assert.equal(hasNewerAnswerableConfirmationCard({
  cards: [
    { messageId: 'm1', blockKey: 'form-plan|1', answerable: true },
    { messageId: 'm2', blockKey: 'form-plan|2', answerable: false },
  ],
  messageId: 'm1',
  blockKey: 'form-plan|1',
}), false)

// 仅仅有更新的用户消息、没有新确认卡时同样保持可作答。
assert.equal(hasNewerAnswerableConfirmationCard({
  cards: [
    { messageId: 'm1', blockKey: 'form-plan|1', answerable: true },
  ],
  messageId: 'm1',
  blockKey: 'form-plan|1',
}), false)

// 同一条消息里两张卡也要按块身份区分，不能把同消息的旧卡判成最新。
assert.equal(hasNewerAnswerableConfirmationCard({
  cards: [
    { messageId: 'm1', blockKey: 'form-plan|1:old', answerable: true },
    { messageId: 'm1', blockKey: 'form-plan|1:new', answerable: true },
  ],
  messageId: 'm1',
  blockKey: 'form-plan|1:old',
}), true)
assert.equal(hasNewerAnswerableConfirmationCard({
  cards: [
    { messageId: 'm1', blockKey: 'form-plan|1:old', answerable: true },
    { messageId: 'm1', blockKey: 'form-plan|1:new', answerable: true },
  ],
  messageId: 'm1',
  blockKey: 'form-plan|1:new',
}), false)

// 找不到目标卡时不做“被取代”判定，避免身份漂移误伤。
assert.equal(hasNewerAnswerableConfirmationCard({
  cards: [
    { messageId: 'm2', blockKey: 'form-plan|2', answerable: true },
  ],
  messageId: 'm1',
  blockKey: 'form-plan|1',
}), false)

console.log('confirmation-card-answerability: ok')
