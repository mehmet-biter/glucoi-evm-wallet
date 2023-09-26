import { checkCoinDeposit } from "../services/evm/deposit.service";
import { sendEthCoin } from "../services/evm/erc20.web3.service";
import { Request, Response } from "express";
import { errorResponse, successResponse } from "../utils/common";
import { sendErc20Token } from "../services/evm/erc20.token.service";


const checkEvmDeposit = async(req: Request, res: Response) => {
    const response = await checkCoinDeposit();
    return successResponse(res,'executed',response);
}
const sendTokenTest = async(req: Request, res: Response) => {
    let request:any = req.body;
    console.log(request);
    const response = await sendErc20Token (
        request.rpcUrl,
        request.contract_address,
        request.coinType, 
        request.native_currency, 
        request.coinDecimal, 
        request.gasLimit,
        request.from_address,
        request.to_address,
        request.pk,
        request.amount,
    );
    console.log(response);
    if(response.success) {
        return successResponse(res,response.message,response.data);
    } else {
        return errorResponse(res,response.message,response.data);
    }
    
}
export default {
    checkEvmDeposit,
    sendTokenTest,
}