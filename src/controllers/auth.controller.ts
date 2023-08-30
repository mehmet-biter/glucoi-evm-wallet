import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { authService } from '../services';
import exclude from '../utils/exclude';


const test = catchAsync(async (req, res) => {
  
  const data = 'api worked fine';
  res.json({ data });
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const user:any = await authService.loginUserWithEmailAndPassword(email, password);
  const tokens = 'ssss';
  res.send({ user, tokens });
});

const logout = catchAsync(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  res.status(httpStatus.NO_CONTENT).send();
});


export default {
  test,
  login,
  logout,
 
};
