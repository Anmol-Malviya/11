// AI Manthan 2.0 Gesture & Conversation Types & Client

export interface GestureHealth {
  status: string;
  app_name: string;
  version: string;
  model_loaded: boolean;
  model_backend: string;
  database_connected: boolean;
  classes_count: number;
}

export interface GesturesInfo {
  classes: string[];
  default_phrases: Record<string, string>;
  input_shape: number[];
  color_mode: string;
}

export interface GesturePrediction {
  predicted_gesture: string;
  confidence: number;
  mapped_phrase: string;
  is_reliable: boolean;
  probabilities: Record<string, number>;
  processing_time_ms: number;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  text: string;
  speaker: "user" | "partner";
  modality: "gesture" | "speech_to_text" | "typed" | "quick_phrase";
  gesture_label?: string | null;
  confidence?: number | null;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  partner_name: string;
  created_at: string;
  message_count: number;
}

export interface PaginatedMessages {
  conversation_id: string;
  total_messages: number;
  page: number;
  page_size: number;
  messages: ConversationMessage[];
}

const getApiHost = () => {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/api\/v1\/?$/, "").replace(/\/api\/?$/, "");
  }
  if (typeof window !== "undefined") {
    // If running on next.js dev port 3000, backend is typically on 8000
    if (window.location.port === "3000") {
      return "http://localhost:8000";
    }
    return window.location.origin;
  }
  return "http://localhost:8000";
};

const API_ROOT = getApiHost();

export const gestureApi = {
  async getHealth(): Promise<GestureHealth> {
    const res = await fetch(`${API_ROOT}/api/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return res.json();
  },

  async getGestures(): Promise<GesturesInfo> {
    const res = await fetch(`${API_ROOT}/api/gestures`);
    if (!res.ok) throw new Error(`Get gestures failed: ${res.statusText}`);
    return res.json();
  },

  async predictGesture(imageBlobOrBase64: Blob | string, threshold = 0.60): Promise<GesturePrediction> {
    if (typeof imageBlobOrBase64 === "string") {
      const res = await fetch(`${API_ROOT}/api/gesture/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: imageBlobOrBase64,
          confidence_threshold: threshold
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Prediction failed: ${res.statusText}`);
      }
      return res.json();
    } else {
      const formData = new FormData();
      formData.append("file", imageBlobOrBase64, "frame.jpg");
      formData.append("threshold", threshold.toString());

      const res = await fetch(`${API_ROOT}/api/gesture/predict`, {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Prediction failed: ${res.statusText}`);
      }
      return res.json();
    }
  },

  async listConversations(): Promise<ConversationSummary[]> {
    const res = await fetch(`${API_ROOT}/api/conversations`);
    if (!res.ok) throw new Error("Failed to list conversations");
    return res.json();
  },

  async createConversation(title = "Live Conversation", partner_name = "Conversation Partner"): Promise<ConversationSummary> {
    const res = await fetch(`${API_ROOT}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, partner_name })
    });
    if (!res.ok) throw new Error("Failed to create conversation");
    return res.json();
  },

  async getMessages(conversationId: string, page = 1, pageSize = 50): Promise<PaginatedMessages> {
    const res = await fetch(`${API_ROOT}/api/conversations/${conversationId}/messages?page=${page}&page_size=${pageSize}`);
    if (!res.ok) throw new Error("Failed to fetch messages");
    return res.json();
  },

  async addMessage(
    conversationId: string,
    message: {
      text: string;
      speaker: "user" | "partner";
      modality: "gesture" | "speech_to_text" | "typed" | "quick_phrase";
      gesture_label?: string | null;
      confidence?: number | null;
    }
  ): Promise<ConversationMessage> {
    const res = await fetch(`${API_ROOT}/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message)
    });
    if (!res.ok) throw new Error("Failed to post message");
    return res.json();
  },

  async deleteConversation(conversationId: string): Promise<void> {
    const res = await fetch(`${API_ROOT}/api/conversations/${conversationId}`, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to delete conversation");
  }
};

