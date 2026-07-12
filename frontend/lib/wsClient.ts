import { useStore } from '../store/useStore'

class WebSocketClient {
  private socket: WebSocket | null = null
  private url: string

  constructor(url: string) {
    this.url = url
  }

  connect() {
    try {
      this.socket = new WebSocket(this.url)

      this.socket.onopen = () => {
        console.log('Connected to Live Data Loop')
      }

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          // Pipeline 1: Live Data Loop Updates
          if (data.type === 'risk_update' && data.id) {
            useStore.getState().setValuation(data.id, {
              price_index: data.price_index,
              risk_score: data.risk_score,
              volatility: data.volatility,
              pi_ratio: data.pi_ratio
            })
          }

        } catch (error) {
          console.error('Error parsing WS message:', error)
        }
      }

      this.socket.onclose = () => {
        console.log('WS Connection closed, retrying...')
        setTimeout(() => this.connect(), 3000)
      }

      this.socket.onerror = (error) => {
        console.error('WS Error:', error)
      }
    } catch (error) {
      console.error('Failed to connect to WS:', error)
    }
  }

  send(message: unknown) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
    }
  }
}

const defaultClientId =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `client-${Date.now()}`

const resolveWebSocketUrl = () => {
  const baseUrl = (process.env.NEXT_PUBLIC_WS_URL || 'wss://luminous-real-estate-1-2.onrender.com/ws').replace(/\/$/, '')
  return baseUrl.endsWith('/ws') ? `${baseUrl}/${defaultClientId}` : baseUrl
}

// Singleton instance for the Render backend.
const wsClient = new WebSocketClient(resolveWebSocketUrl())

export default wsClient
