import type { FlowModel } from './morningPaperItems.ts'

export type FlowPoint = { x: number; y: number }
type Edge = { id: string; d: string; working?: boolean }
type Dot = FlowPoint & { id: string; working?: boolean }
type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number }
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

function simpleRoute(draft: Draft, boxes: Boxes, working: boolean): FlowPoint {
  const hasDepartments = boxes.departments.length > 0
  const start = { x: centerX(boxes.lead), y: boxes.lead.bottom }
  const end = {
    x: hasDepartments ? centerX(boxes.group) : centerX(boxes.proof),
    y: hasDepartments ? boxes.group.top : boxes.proof.top,
  }

  edgeBetween(draft, 'lead-departments', start, end, working)
  dot(draft, 'route-start', start.x, start.y)
  dot(draft, 'route-end', end.x, end.y, working)
  if (hasDepartments) {
    edgeBetween(
      draft,
      'departments-proof',
      { x: centerX(boxes.group), y: boxes.group.bottom },
      { x: centerX(boxes.proof), y: boxes.proof.top },
    )
    dot(draft, 'proof-end', centerX(boxes.proof), boxes.proof.top)
  }

  return midpoint(start, end)
}

function desktopRoute(draft: Draft, boxes: Boxes, model: FlowModel): FlowPoint {
  const { lead, departments, proof } = boxes
  const top = Math.min(...departments.map((department) => department.top))
  const bottom = Math.max(...departments.map((department) => department.bottom))
  const xs = departments.map(centerX)
  const routeBusY = lead.bottom + (top - lead.bottom) / 2
  const proofBusY = bottom + (proof.top - bottom) / 2
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const anyWorking = model.departments.some(({ activity }) => activity.status === 'working')

  edgeBetween(
    draft,
    'lead-route',
    { x: centerX(lead), y: lead.bottom },
    { x: centerX(lead), y: routeBusY },
    anyWorking,
  )
  if (minX !== maxX) {
    edge(draft, 'route-bus', `M${coordinate(minX, routeBusY)} L${coordinate(maxX, routeBusY)}`, anyWorking)
    edge(draft, 'proof-bus', `M${coordinate(minX, proofBusY)} L${coordinate(maxX, proofBusY)}`)
  }
  edgeBetween(
    draft,
    'proof-route',
    { x: centerX(proof), y: proofBusY },
    { x: centerX(proof), y: proof.top },
  )
  dot(draft, 'lead-route', centerX(lead), routeBusY, anyWorking)
  dot(draft, 'proof-route', centerX(proof), proofBusY)

  departments.forEach((department, index) => {
    const x = centerX(department)
    const working = model.departments[index]?.activity.status === 'working'
    const id = String(index)

    edgeBetween(draft, `department-${id}`, { x, y: routeBusY }, { x, y: department.top }, working)
    edgeBetween(draft, `department-proof-${id}`, { x, y: department.bottom }, { x, y: proofBusY })
    dot(draft, `department-${id}`, x, routeBusY, working)
    dot(draft, `department-proof-${id}`, x, proofBusY)
  })
  dot(draft, 'proof-end', centerX(proof), proof.top)

  return { x: centerX(lead), y: routeBusY }
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
  const goalPill = goalRoute(draft, boxes.goal, boxes.lead, horizontal, model.lead?.status === 'working')
  const routePill =
    horizontal && boxes.departments.length > 0
      ? desktopRoute(draft, boxes, model)
      : simpleRoute(draft, boxes, model.departments.some(({ activity }) => activity.status === 'working'))

  return { width: rootBox.width, height: rootBox.height, ...draft, goalPill, routePill }
}
