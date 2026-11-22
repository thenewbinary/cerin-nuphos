import { Images, Target } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { measureFlowGeometry } from './matrixFlowGeometry.ts'
import { DepartmentNode, EdgePill, FlowLines, LeadNode } from './matrixFlowNodes.tsx'

import type { FlowGeometry } from './matrixFlowGeometry.ts'
import type { FlowModel } from './morningPaperItems.ts'

export function MatrixFlow({
  objective,
  model,
  workingCount,
  decisionCount,
  onOpenConversation,
}: {
  objective: string
  model: FlowModel
  workingCount: number
  decisionCount: number
  onOpenConversation: (sessionId: string) => void
}) {
  const rootRef = useRef<HTMLElement>(null)
  const goalRef = useRef<HTMLDivElement>(null)
  const leadRef = useRef<HTMLButtonElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)
  const proofRef = useRef<HTMLDivElement>(null)
  const departmentRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [geometry, setGeometry] = useState<FlowGeometry | null>(null)

  useEffect(() => {
    const root = rootRef.current
    const goal = goalRef.current
    const lead = leadRef.current
    const group = groupRef.current
    const proof = proofRef.current

    if (!root || !goal || !lead || !group || !proof) return
    const elements = { root, goal, lead, group, proof }
    let frame = 0

    function measureFrame() {
      const departments = departmentRefs.current
        .slice(0, model.departments.length)
        .filter((node): node is HTMLButtonElement => node !== null)

      setGeometry(measureFlowGeometry({ ...elements, departments }, model))
    }

    function measure() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measureFrame)
    }

    const observer = new ResizeObserver(measure)

    observer.observe(root)
    observer.observe(goal)
    observer.observe(lead)
    observer.observe(group)
    observer.observe(proof)
    for (const node of departmentRefs.current) {
      if (node) observer.observe(node)
    }
    measure()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [model])

  if (!model.lead) return null

  const lead = model.lead

  return (
    <section ref={rootRef} aria-label={objective} className="matrix-flow">
      {geometry && <FlowLines geometry={geometry} />}

      <div ref={goalRef} className="matrix-flow-goal">
        <div className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-line-control bg-elevated p-4 shadow-[var(--surface-shadow)]">
          <Target aria-hidden className="size-5 text-tertiary" strokeWidth={1.5} />
          <div className="mt-5 line-clamp-2 break-words font-display text-[18px] font-medium leading-[1.25] tracking-[-0.025em] text-main">
            {objective}
          </div>
        </div>
      </div>

      <LeadNode
        activity={lead}
        nodeRef={leadRef}
        onOpen={() => onOpenConversation(lead.bot.sessionId)}
      />
      <EdgePill position={geometry?.goalPill} icon="activity" count={workingCount} />
      <EdgePill position={geometry?.routePill} icon="decisions" count={decisionCount} />

      <div ref={groupRef} className="matrix-flow-departments">
        {model.departments.map((department, index) => (
          <DepartmentNode
            key={department.activity.bot.sessionId}
            department={department}
            index={index}
            count={model.departments.length}
            nodeRef={(node) => {
              departmentRefs.current[index] = node
            }}
            onOpen={() => onOpenConversation(department.activity.bot.sessionId)}
          />
        ))}
      </div>

      <div
        ref={proofRef}
        aria-hidden
        className="matrix-flow-proof flex size-9 items-center justify-center rounded-full border border-line-control bg-main text-tertiary"
      >
        <Images className="size-4" strokeWidth={1.5} />
      </div>
    </section>
  )
}
