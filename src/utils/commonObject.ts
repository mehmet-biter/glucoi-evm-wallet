export interface ResponseData {
    status_code:Number;
    message: String;
    data: any;
}

export function generateResponse(statusCode: number, message: string, data?: any): ResponseData {
    return {
      status_code: statusCode,
      message: message,
      data: data,
    };
}
