import { checkCoinDeposit } from "../services/evm/deposit.service";
import { sendEthCoin } from "../services/evm/erc20.web3.service";
import { Request, Response } from "express";
import { errorResponse, successResponse } from "../utils/common";
import { sendErc20Token } from "../services/evm/erc20.token.service";
import { generateErrorResponse } from "../utils/commonObject";
import prisma from "../client";
import { STATUS_ACTIVE, STATUS_PENDING } from "../utils/coreConstant";


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

// receive deposit coin from user address to admin address
const receiveDepositCoin = async(transaction_id:any) => {
    try {
        const transaction = await prisma.deposite_transactions.findFirst({
            where:{
                AND:{
                    id:Number(transaction_id),
                    status:STATUS_ACTIVE,
                    is_admin_receive:STATUS_PENDING
                }
            }
        });
        if(transaction && transaction.network_id) {
            const network_id = transaction.network_id;
            const coin_id = transaction.coin_id;
            const coinNetwork = await prisma.$queryRaw`
            SELECT * FROM coin_networks
            JOIN networks ON networks.id = coin_networks.network_id
            where coin_networks.network_id = ${network_id} and coin_networks.coin_id = ${coin_id}`;

            console.log('coinNetwork', coinNetwork);
            // if (coinNetwork && (coinNetwork?.type == )) {

            // } else {
            //     return generateErrorResponse('Network not found');
            // }
            
        } else {
            return generateErrorResponse('Transaction or network not found');
        }
    } catch(err:any) {
        console.log(err);
        return generateErrorResponse(err.stack)
    }
}
export default {
    checkEvmDeposit,
    sendTokenTest,
    receiveDepositCoin
}