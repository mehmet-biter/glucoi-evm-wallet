import { checkCoinDeposit } from "../services/evm/deposit.service";
import { sendEthCoin } from "../services/evm/erc20.web3.service";
import { Request, Response } from "express";
import { successResponse } from "../utils/common";

const sendEth = async (req: Request, res: Response) => {
    let request:any = req.body;
    console.log(request);
    const response = await sendEthCoin (
        request.rpcUrl,
        request.coinType, 
        request.coinDecimal, 
        request.gasLimit,
        request.from_address,
        request.to_address,
        request.amount,
        request.pk
    );
    console.log(response);
    return successResponse(res,'executed');
}

const checkDeposit = async(res: Response) => {
    const response = await checkCoinDeposit();
    console.log('checkDeposit', 'executed');
    return successResponse(res,'executed');
}

export default {
    sendEth,
    checkDeposit
}