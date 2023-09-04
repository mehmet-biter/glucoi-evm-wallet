import { NextFunction, Request, Response } from "express";
import { errorResponse, processException } from "../utils/common";

const checkAPI =
  () => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { api_secret } = req.headers;
      const secretKey = process.env.API_SECRET ?? "";

      if (api_secret !== secretKey) {
        return errorResponse(res, "API Access denied!");
      }

      next();
    } catch (error) {
      processException(res, error);
    }
  };
export default checkAPI;
