export interface ResponseData {
    success: boolean;
    message: String;
    data: any;
}

export interface JwtResponseData {
    code: number;
    message: string;
}
  

export function generateSuccessResponse( message: string, data?: any): ResponseData {
    return {
      success: true,
      message: message,
      data: data,
    };
}

export function generateErrorResponse( message: string, data?: any): ResponseData {
    return {
      success: true,
      message: message,
      data: data,
    };
}
