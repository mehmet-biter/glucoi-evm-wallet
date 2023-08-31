import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { authService } from '../services';
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { ResponseData } from '../utils/commonObject';

const prisma = new PrismaClient()
const secret = process.env.JWT_SECRET ??'';

const test = catchAsync(async (req, res) => {
  
  const data = 'api worked fine';
  res.json({ data });
});

 type Login = {email:String};

const login = async (req:Request, res:Response) => {
  
  try {
    const { email } = req.body;

    const response:ResponseData = await authService.loginUserWithEmail(email);
    console.log(response.status_code);
    res.status(response.status_code).json({ response });
    
  } catch (error) {

    res.status(500).json({ error: 'Internal server error' });
  }

};

const logout = catchAsync(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  res.status(httpStatus.NO_CONTENT).send();
});

export default {
  test,
  login,
  logout,

};
