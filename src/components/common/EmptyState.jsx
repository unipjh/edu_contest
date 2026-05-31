export default function EmptyState({ title, description }) {
  return (
    <section className="emptyState">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </section>
  )
}
