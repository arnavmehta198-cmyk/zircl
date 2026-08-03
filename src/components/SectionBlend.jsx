import './SectionBlend.css'

export default function SectionBlend({ from, to }) {
  return (
    <div
      className="section-blend"
      style={{ background: `linear-gradient(180deg, ${from} 0%, ${to} 100%)` }}
    />
  )
}
