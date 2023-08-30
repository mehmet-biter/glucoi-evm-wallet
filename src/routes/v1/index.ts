import express from 'express';
import authRoute from './auth.route';


const router = express.Router();

const defaultRoutes = [
  {
    path: "/auth",
    route: authRoute,
  },
  // {
  //   path: "/",
  //   route: authRoute,
  // },
];



defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

/* istanbul ignore next */


export default router;
