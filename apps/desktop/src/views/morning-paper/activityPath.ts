type Point = { x: number; y: number }

export function smoothPath(points: readonly Point[]): string {
  if (points.length === 0) return ''
  const start = `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`

  if (points.length === 1) return start
  if (points.length === 2) {
    return `${start} L${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`
  }

  const widths = points.slice(1).map((point, index) => point.x - points[index].x)
  const slopes = points.slice(1).map((point, index) => (point.y - points[index].y) / widths[index])
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0]
    if (index === points.length - 1) return slopes[slopes.length - 1]
    const before = slopes[index - 1]
    const after = slopes[index]

    return before * after <= 0 ? 0 : (before + after) / 2
  })

  for (let index = 0; index < slopes.length; index += 1) {
    const slope = slopes[index]

    if (slope === 0) {
      tangents[index] = 0
      tangents[index + 1] = 0
      continue
    }

    const alpha = tangents[index] / slope
    const beta = tangents[index + 1] / slope
    const magnitude = alpha * alpha + beta * beta

    if (magnitude > 9) {
      const scale = 3 / Math.sqrt(magnitude)

      tangents[index] = scale * alpha * slope
      tangents[index + 1] = scale * beta * slope
    }
  }

  let d = start

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const point = points[index]
    const width = widths[index - 1]
    const low = Math.min(previous.y, point.y)
    const high = Math.max(previous.y, point.y)
    const clampY = (y: number) => Math.min(high, Math.max(low, y))
    const control1 = {
      x: previous.x + width / 3,
      y: clampY(previous.y + (tangents[index - 1] * width) / 3),
    }
    const control2 = {
      x: point.x - width / 3,
      y: clampY(point.y - (tangents[index] * width) / 3),
    }

    d += ` C${control1.x.toFixed(2)} ${control1.y.toFixed(2)} ${control2.x.toFixed(2)} ${control2.y.toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }

  return d
}
