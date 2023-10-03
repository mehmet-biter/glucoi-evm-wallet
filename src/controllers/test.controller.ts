import { checkCoinDeposit, checkTrxNativeDeposit } from "../services/evm/deposit.service";
import { sendEthCoin } from "../services/evm/erc20.web3.service";
import { Request, Response } from "express";
import { errorResponse, successResponse } from "../utils/common";

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
    if(response.success) {
        return successResponse(res,response.message,response.data);
    } else {
        return errorResponse(res,response.message,response.data);
    }
}

const checkDeposit = async(req: Request, res: Response) => {
    const response = await checkCoinDeposit();
    console.log('checkDeposit', 'executed');
    // console.log(response)
    return successResponse(res,'executed',response);
}

const checkTrxDeposit = async (req: Request, res: Response) => {
    const rpcUrl = 'https://nile.trongrid.io';
    const blockNumber = 0;
    const response = await checkTrxNativeDeposit(rpcUrl,blockNumber);
    console.log('response', response);
    return successResponse(res,'executed',response);
}

export default {
    sendEth,
    checkDeposit,
    checkTrxDeposit
}