import { sendEthCoin } from "../services/evm/erc20.web3.service";
import { Request, Response } from "express";

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
    return response;
}

export default {
    sendEth,
}