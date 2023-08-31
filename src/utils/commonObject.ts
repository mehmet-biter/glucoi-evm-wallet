export interface ResponseData {
    status_code:number;
    message: String;
    data: any;
}

export interface JwtResponseData {
    code: number;
    message: string;
}
  

export function generateResponse(statusCode: number, message: string, data?: any): ResponseData {
    return {
      status_code: statusCode,
      message: message,
      data: data,
    };
}
