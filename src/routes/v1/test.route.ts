import express from "express";
import auth from "../../middlewares/auth";
import evmController from "../../controllers/wallet.controller";
import validate from "../../middlewares/validate";
import evmValidation from "../../validations/wallet.validation";
import testController from "../../controllers/test.controller";

const router = express.Router();

router.post("/send-eth", testController.sendEth);
router.get("/check-deposit", testController.checkDeposit);
router.get("/check-trx-deposit", testController.checkTrxDeposit);
export default router;
