// Renders lightweight section text: blank line = paragraph, "- " = bullet, "# " = subheading.
export function PlaybookBody({ text }) {
  const blocks = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const last = blocks[blocks.length - 1]
    if (trimmed.startsWith('- ')) {
      if (last?.type === 'ul') last.items.push(trimmed.slice(2))
      else blocks.push({ type: 'ul', items: [trimmed.slice(2)] })
    } else if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'h', text: trimmed.slice(2) })
    } else {
      blocks.push({ type: 'p', text: trimmed })
    }
  }
  return blocks.map((b, i) =>
    b.type === 'ul' ? (
      <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>
    ) : b.type === 'h' ? (
      <h3 key={i}>{b.text}</h3>
    ) : (
      <p key={i}>{b.text}</p>
    )
  )
}
