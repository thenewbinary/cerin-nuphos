import type { FlowModel } from './morningPaperItems.ts'

export type FlowPoint = { x: number; y: number }
type Edge = { id: string; d: string; working?: boolean }
type Dot = FlowPoint & { id: string; working?: boolean }
type Box = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}
type Draft = { edges: Edge[]; dots: Dot[] }

type Elements = {
  root: HTMLElement
  goal: HTMLElement
  lead: HTMLElement
  group: HTMLElement
  departments: HTMLButtonElement[]
  proof: HTMLElement
}

type Boxes = {
  goal: Box
  lead: Box
  group: Box
  departments: Box[]
  proof: Box
}

export type FlowGeometry = Draft & {
  width: number
  height: number
  goalPill: FlowPoint
  routePill: FlowPoint
}

const centerX = (box: Box) => box.left + box.width / 2
const centerY = (box: Box) => box.top + box.height / 2
const coordinate = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`
const midpoint = (a: FlowPoint, b: FlowPoint) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

function edge(draft: Draft, id: string, d: string, working = false) {
  draft.edges.push({ id, d, working })
}

function edgeBetween(draft: Draft, id: string, from: FlowPoint, to: FlowPoint, working = false) {
  edge(draft, id, `M${coordinate(from.x, from.y)} L${coordinate(to.x, to.y)}`, working)
}

function dot(draft: Draft, id: string, x: number, y: number, working = false) {
  draft.dots.push({ id, x, y, working })
}

function relativeBox(root: DOMRect, element: HTMLElement): Box {
  const rect = element.getBoundingClientRect()

  return {
    left: rect.left - root.left,
    top: rect.top - root.top,
    right: rect.right - root.left,
    bottom: rect.bottom - root.top,
    width: rect.width,
    height: rect.height,
  }
}

function goalRoute(draft: Draft, goal: Box, lead: Box, horizontal: boolean, working: boolean) {
  const start = {
    x: horizontal ? goal.right : centerX(goal),
    y: horizontal ? centerY(goal) : goal.bottom,
  }
  const end = {
    x: horizontal ? lead.left : centerX(lead),
    y: horizontal ? centerY(lead) : lead.top,
  }

  edgeBetween(draft, 'goal-lead', start, end, working)
  dot(draft, 'goal-start', start.x, start.y)
  dot(draft, 'goal-end', end.x, end.y, working)

  return midpoint(start, end)
}

function directRoute(draft: Draft, boxes: Boxes, working: boolean): FlowPoint {
  const start = { x: centerX(boxes.lead), y: boxes.lead.bottom }
  const end = { x: centerX(boxes.proof), y: boxes.proof.top }

  edgeBetween(draft, 'lead-proof', start, end, working)
  dot(draft, 'route-start', start.x, start.y)
  dot(draft, 'proof-end', end.x, end.y, working)

  return midpoint(start, end)
}

function departmentRoute(draft: Draft, boxes: Boxes, model: FlowModel): FlowPoint {
  const { lead, departments, proof } = boxes
  const rows: {
    departments: { box: Box; index: number }[]
    top: number
    bottom: number
  }[] = []

  departments.forEach((box, index) => {
    const row = rows.find(({ top }) => Math.abs(top - box.top) < 2)

    if (row) {
      row.departments.push({ box, index })
      row.bottom = Math.max(row.bottom, box.bottom)
    } else {
      rows.push({ departments: [{ box, index }], top: box.top, bottom: box.bottom })
    }
  })
  rows.sort((a, b) => a.top - b.top)

  const leadX = centerX(lead)
  const proofX = centerX(proof)
  const inputTrunkX = Math.max(
    0,
    Math.min(...departments.map((department) => department.left)) - 12,
  )
  const outputTrunkX = Math.min(
    boxes.group.right,
    Math.max(...departments.map((department) => department.right)) + 28,
  )
  const anyWorking = model.departments.some(({ activity }) => activity.status === 'working')
  const routes = rows.map((row, rowIndex) => {
    const previous = rowIndex === 0 ? undefined : rows[rowIndex - 1]
    const next = rowIndex === rows.length - 1 ? undefined : rows[rowIndex + 1]
    const inputY = previous
      ? previous.bottom + ((row.top - previous.bottom) * 2) / 3
      : lead.bottom + (row.top - lead.bottom) / 2
    const outputY = next
      ? row.bottom + (next.top - row.bottom) / 3
      : row.bottom + (proof.top - row.bottom) / 2

    return { row, inputY, outputY }
  })
  const first = routes[0]
  const last = routes.at(-1)

  if (!last) return directRoute(draft, boxes, anyWorking)

  edgeBetween(
    draft,
    'lead-route',
    { x: leadX, y: lead.bottom },
    { x: leadX, y: first.inputY },
    anyWorking,
  )
  if (first.inputY !== last.inputY) {
    edgeBetween(
      draft,
      'route-trunk',
      { x: inputTrunkX, y: first.inputY },
      { x: inputTrunkX, y: last.inputY },
      anyWorking,
    )
    edgeBetween(
      draft,
      'proof-trunk',
      { x: outputTrunkX, y: first.outputY },
      { x: outputTrunkX, y: last.outputY },
    )
  }
  dot(draft, 'lead-route', leadX, first.inputY, anyWorking)

  routes.forEach(({ row, inputY, outputY }, rowIndex) => {
    const xs = row.departments.map(({ box }) => centerX(box))
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const inputStart = rowIndex === 0 ? Math.min(inputTrunkX, leadX) : inputTrunkX
    const inputEnd = rowIndex === 0 ? Math.max(maxX, leadX) : maxX
    const outputStart = rowIndex === routes.length - 1 ? Math.min(minX, proofX) : minX
    const outputEnd = rowIndex === routes.length - 1 ? Math.max(outputTrunkX, proofX) : outputTrunkX

    edge(
      draft,
      `route-bus-${String(rowIndex)}`,
      `M${coordinate(inputStart, inputY)} L${coordinate(inputEnd, inputY)}`,
      anyWorking,
    )
    edge(
      draft,
      `proof-bus-${String(rowIndex)}`,
      `M${coordinate(outputStart, outputY)} L${coordinate(outputEnd, outputY)}`,
    )
    dot(draft, `route-trunk-${String(rowIndex)}`, inputTrunkX, inputY, anyWorking)
    dot(draft, `proof-trunk-${String(rowIndex)}`, outputTrunkX, outputY)

    row.departments.forEach(({ box, index }) => {
      const x = centerX(box)
      const working = model.departments[index]?.activity.status === 'working'
      const id = String(index)

      edgeBetween(draft, `department-${id}`, { x, y: inputY }, { x, y: box.top }, working)
      edgeBetween(draft, `department-proof-${id}`, { x, y: box.bottom }, { x, y: outputY })
      dot(draft, `department-${id}`, x, inputY, working)
      dot(draft, `department-proof-${id}`, x, outputY)
    })
  })

  edgeBetween(draft, 'proof-route', { x: proofX, y: last.outputY }, { x: proofX, y: proof.top })
  dot(draft, 'proof-route', proofX, last.outputY)
  dot(draft, 'proof-end', proofX, proof.top)

  return { x: leadX, y: first.inputY }
}

export function measureFlowGeometry(elements: Elements, model: FlowModel): FlowGeometry {
  const rootBox = elements.root.getBoundingClientRect()
  const boxes: Boxes = {
    goal: relativeBox(rootBox, elements.goal),
    lead: relativeBox(rootBox, elements.lead),
    group: relativeBox(rootBox, elements.group),
    departments: elements.departments.map((element) => relativeBox(rootBox, element)),
    proof: relativeBox(rootBox, elements.proof),
  }
  const horizontal =
    boxes.lead.left > boxes.goal.left && Math.abs(centerY(boxes.lead) - centerY(boxes.goal)) < 100
  const draft: Draft = { edges: [], dots: [] }
  const goalPill = goalRoute(
    draft,
    boxes.goal,
    boxes.lead,
    horizontal,
    model.lead?.status === 'working',
  )
  const routePill =
    boxes.departments.length > 0
      ? departmentRoute(draft, boxes, model)
      : directRoute(draft, boxes, model.lead?.status === 'working')

  return { width: rootBox.width, height: rootBox.height, ...draft, goalPill, routePill }
}
