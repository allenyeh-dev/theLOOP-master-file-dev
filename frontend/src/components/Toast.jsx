import './Toast.css'

export function Toast({ message }) {
  if (!message) return null
  return (
    <div className="ov-toast" role="status">
      {message}
    </div>
  )
}
