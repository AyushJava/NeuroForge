import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

export interface PipelineStageUpdate {
  runId: number;
  stageName: string;
  status: string;
}

class PipelineWebSocketService {
  private stompClient: Client | null = null;
  private subscriptions: Map<string, any> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 2;
  private reconnectDelay = 3000;
  private currentProjectId?: number;
  private currentToken?: string;
  private isConnecting = false;

  connect(token: string, projectId?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.stompClient && this.stompClient.connected) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        resolve();
        return;
      }

      this.isConnecting = true;
      this.currentProjectId = projectId;
      this.currentToken = token;

      // WebSocket needs direct connection to backend, not through proxy
      const url = 'http://localhost:8081/pipeline-ws';

      const socket = new SockJS(url);

      this.stompClient = new Client({
        webSocketFactory: () => socket,
        connectHeaders: {
          Authorization: `Bearer ${token}`,
        },
        debug: (str) => {
          // Disable debug logging to reduce console noise
        },
        reconnectDelay: this.reconnectDelay,
        onConnect: () => {
          console.log('[PipelineWebSocket] Connected');
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          resolve();
        },
        onStompError: (frame) => {
          console.error('[PipelineWebSocket] STOMP error:', frame);
          this.isConnecting = false;
          reject(frame);
        },
        onWebSocketClose: () => {
          this.isConnecting = false;
          // Only attempt reconnection if we were previously connected
          if (this.reconnectAttempts > 0) {
            this.handleReconnect();
          }
        },
      });

      // Set a timeout to fail gracefully if connection doesn't establish
      const timeout = setTimeout(() => {
        if (!this.stompClient?.connected) {
          console.warn('[PipelineWebSocket] Connection timeout - WebSocket may not be available');
          this.isConnecting = false;
          resolve(); // Resolve anyway to not block the UI
        }
      }, 5000);

      this.stompClient.activate();

      // Clear timeout if connection succeeds
      this.stompClient.onConnect = () => {
        clearTimeout(timeout);
        console.log('[PipelineWebSocket] Connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        resolve();
      };
    });
  }

  subscribeToPipelineUpdates(
    runId: number,
    callback: (update: PipelineStageUpdate) => void
  ): void {
    if (!this.stompClient || !this.stompClient.connected) {
      console.warn('[PipelineWebSocket] Not connected, cannot subscribe');
      return;
    }

    const destination = `/topic/pipeline/${runId}`;
    
    if (this.subscriptions.has(destination)) {
      this.unsubscribeFromPipelineUpdates(runId);
    }

    const subscription = this.stompClient.subscribe(destination, (message) => {
      try {
        const update: PipelineStageUpdate = JSON.parse(message.body);
        console.log('[PipelineWebSocket] Received stage update:', update);
        callback(update);
      } catch (error) {
        console.error('[PipelineWebSocket] Error parsing message:', error);
      }
    });

    this.subscriptions.set(destination, subscription);
    console.log(`[PipelineWebSocket] Subscribed to ${destination}`);
  }

  unsubscribeFromPipelineUpdates(runId: number): void {
    const destination = `/topic/pipeline/${runId}`;
    const subscription = this.subscriptions.get(destination);
    
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(destination);
      console.log(`[PipelineWebSocket] Unsubscribed from ${destination}`);
    }
  }

  disconnect(): void {
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.stompClient = null;
      this.subscriptions.clear();
      console.log('[PipelineWebSocket] Disconnected');
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[PipelineWebSocket] Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      setTimeout(() => {
        if (this.currentToken) {
          this.connect(this.currentToken, this.currentProjectId).catch((error) => {
            console.error('[PipelineWebSocket] Reconnection failed:', error);
          });
        }
      }, this.reconnectDelay);
    } else {
      console.error('[PipelineWebSocket] Max reconnection attempts reached');
    }
  }

  isConnected(): boolean {
    return this.stompClient?.connected ?? false;
  }
}

export const pipelineWebSocketService = new PipelineWebSocketService();
