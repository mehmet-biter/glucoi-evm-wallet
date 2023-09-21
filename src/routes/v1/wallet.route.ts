import express from "express";
import auth from "../../middlewares/auth";
import evmController from "../../controllers/wallet.controller";
import validate from "../../middlewares/validate";
import evmValidation from "../../validations/wallet.validation";

const router = express.Router();

router.post("/create-wallet", auth(), validate(evmValidation.walletCreate), evmController.createWallet);
router.post("/create-system-wallet", auth(), evmController.createSystemWallet);
router.post("/wallet-withdrawal-process", auth(), evmController.walletWithdrawalProcess);

export default router;
