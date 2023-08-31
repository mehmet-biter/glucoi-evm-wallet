import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { ResponseData, generateResponse} from '../utils/commonObject';

const prisma = new PrismaClient();
const secret = process.env.JWT_SECRET ??'';

const loginUserWithEmail = async (email : string) => {
  var responseData:ResponseData;
  var statusCode;
  var message;
  var data = {};

  try{
    
    const userDetails = await prisma.users.findUnique({
      where: {
        email: email
      }
    });
    
    if(userDetails)
    {
      var userData = {
        id: userDetails.id.toString(),
        first_name: userDetails.first_name,
        last_name: userDetails.last_name,
        nick_name: userDetails.nickname,
        email: userDetails.email,
        role: userDetails.role,
        role_id: userDetails.role_id,
        super_admin: userDetails.super_admin,
        status: userDetails.status,
      }

      var token = jwt.sign({ 
        user_details: userData
       }, secret);

      data = {
        user_details: userData,
        token:token
      };

      statusCode = 200;
      message = 'User login token is generated successfully!';
      
    } else {
      
      statusCode = 404;
      message = 'User login token is not generated!';
    
    }
  }catch(error){
    statusCode = 404;
    message = 'Something went wrong!';
  }

  return generateResponse(statusCode,message,data);
}

/**
 * Logout
 * @param {string} refreshToken
 * @returns {Promise<void>}
 */
const logout = async (refreshToken: string): Promise<void> => {
  
};

export default {
  loginUserWithEmail,
  logout
};
