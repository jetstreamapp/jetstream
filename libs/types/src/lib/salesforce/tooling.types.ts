export interface ToolingApiResponse {
  id: string;
  success: boolean;
  errors: {
    fields: string[];
    message: string;
    statusCode: string;
  }[];
  warnings: {
    fields: string[];
    message: string;
    statusCode: string;
  }[];
  infos: any[];
}
