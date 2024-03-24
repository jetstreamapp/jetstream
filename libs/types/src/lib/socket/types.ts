export interface SocketAck<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface SocketSubscribePlatformEvent {
  orgId: string;
  platformEventName: string;
  replayId?: number;
}

export interface PlatformEventMessage<T = any> {
  channel: string;
  data: PlatformEventMessagePayload<T>;
}

export interface PlatformEventMessagePayload<T = any> {
  schema: string;
  payload: T;
  event: PlatformEventMessageData;
}

export interface PlatformEventMessageData {
  EventUuid: string;
  replayId: number;
}
