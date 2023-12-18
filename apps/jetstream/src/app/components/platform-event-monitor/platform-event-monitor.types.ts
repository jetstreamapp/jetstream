export interface PlatformEventObject {
  name: string;
  label: string;
  channel: string;
  type: 'PLATFORM_EVENT' | 'PLATFORM_EVENT_STANDARD' | 'CHANGE_EVENT';
}

export interface EventMessage {
  clientId: string;
  channel: string;
  id: string;
  successful: boolean;
}

export interface EventMessageUnsuccessful extends EventMessage {
  subscription?: string;
  error?: string;
  successful: false;
  failure?: {
    connectionType: string;
    exception?: string;
    reason?: string;
    transport?: string;
  };
}
