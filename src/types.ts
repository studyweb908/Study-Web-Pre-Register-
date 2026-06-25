export interface WaitlistUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  grade: string;
  country: string;
  notify_launch: boolean;
  created_at: string;
}

export interface AdminConfig {
  spreadsheetId: string;
  googleEmail: string;
  isConnected: boolean;
  formId?: string;
}
