# Board / Widget Pivot Adapter Notes

这份说明专门记录被推回业务适配层的透视表展示诉求，避免后续 `form-widget` 或 board 接入时，再把业务布局需求反向塞回 `CrossTable` / `buildCrossTable`。

## 适用边界

- `PivotTable` 负责高层透视语义：维度、指标、小计、总计、展开态、slot contract。
- `CrossTable` / `buildCrossTable` 只负责结构渲染：左轴 meta 列、顶轴列树、交叉行与 merge span。
- board / widget 如果需要特殊展示，优先在高层 slot 或业务 wrapper 解决，不允许继续扩张低层 contract。

## 已进入核心层的能力

- 标准 cross 模式下的“左上角维度名称表头”现在已经是核心能力：
  - 开关：`PivotTable.showCornerDimensionHeader`
  - 生效条件：`mode="cross"` 且 `indicatorSide="top"`
  - 形态：原生表头列树，不是 overlay
- 如果业务只是想要简道云那种标准“顶部维度名 + 左侧维度名”表现，优先直接开启这个 prop，不要再在 wrapper 里盖一层 `.corner-dimension-header`。

## 被推回业务层的诉求

| 诉求 | 为什么不能进核心层 | 推荐实现位置 | 推荐接入手段 |
| --- | --- | --- | --- |
| 在原生左上角维度表头上再叠业务别名、副标题、按钮或额外组合布局 | 标准表头结构已经进入核心层，但这些内容属于业务展示编排，不应该继续膨胀成公共 pivot contract。 | board 或 `form-widget` 自己的 pivot wrapper | 优先用 `PivotTable` 的 `header-cell` slot；必要时在 wrapper 里补容器层。 |
| 总计行 / 总计列的特殊文案、特殊样式 | 核心层只表达“总计/小计”语义，不承接业务别名、强调色、排序偏好。 | board/widget 的渲染层 | 用 `header-cell` / `cell` slot 根据 `displayTitle`、`pivotRegion`、节点值做样式和文案改写。 |
| `indicatorSide="left"` 时的业务排版差异 | 指标放左侧是高层语义；额外占位列、业务对齐策略不应污染 `leftMetaColumns`。 | board/widget wrapper | 保持核心 `leftMetaColumns` 只表达左轴维度列，在 wrapper 或 cell slot 中做布局调整。 |
| board/widget 对表头层级、占位、组合展示的额外控制 | 这是业务容器自己的视图编排需求，不是公共透视表 contract。 | board/widget wrapper | 在 wrapper 中组合 `PivotTable`、自定义 header 区块、业务占位单元格，不要反向修改 `CrossTable/buildCrossTable`。 |

## 接入规则

- 第一优先级：如果需求只是标准左上角维度名称表头，直接使用 `showCornerDimensionHeader`。
- 第二优先级：使用 `PivotTable` 高层 `header-cell` / `cell` slot。
- 第三优先级：在 board 或 `form-widget` 自己的 pivot wrapper 中做二次编排。
- 不允许的做法：为了当前 widget 视觉效果，再回头给 `CrossTable` / `buildCrossTable` 加业务专用参数、占位列、重挂策略。

## form-widget 后续接入注意事项

- `form-widget` 当前如果还在用 `.pivot-table-widget__corner-dimension-header` 这类 overlay，应优先改成直接传 `showCornerDimensionHeader`，让表头跟随核心表格的列宽、冻结列和 sticky 逻辑。
- 如果要显示业务别名总计，直接在 slot 中判断 `displayTitle === "总计"` 或节点值再映射。
- 如果要做额外表头分组，请把“业务展示层”和“原生数据列树”分开，避免把 board 头部编排强行编码进 left/top cross tree。
- 如果要做特殊占位或组合表头，优先在 wrapper 增加容器层，而不是破坏 `leftHeaderWidth`、merge span 或 fixed geometry。
- 如果未来需要更强的业务布局控制，先扩展高层 `PivotTable` slot payload，再评估是否值得进入公共层；默认不要直接改低层 builder。
