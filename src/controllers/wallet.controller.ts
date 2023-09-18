import { errorResponse, processException, successResponse } from "../utils/common"
import { Request, Response } from "express";


import BigNumber from "bignumber.js";
import Web3 from "web3";
import { createAddress, createSystemAddress } from "../services/wallet.service";


const createWallet = async (req: Request, res: Response) => {
    try {
        const wallet:any = await createAddress(req.user,req.body.coin_type,req.body.network);
        if (wallet.success) {
            return successResponse(res,wallet.message,wallet.data)
        } else {
            return errorResponse(res, wallet.message, wallet.data);
        }
    } catch (err) {
        processException(res, err)
    }
}

const createSystemWallet = async (req: Request, res: Response) => {
    try {
        const wallet:any = await createSystemAddress(req.user,req.body.network);
        if (wallet.success) {
            return successResponse(res,wallet.message,wallet.data)
        } else {
            return errorResponse(res, wallet.message, wallet.data);
        }
    } catch (err) {
        processException(res, err)
    }
}

const customToWei = (amount:number, decimal:number = 18):string => {
  // return (amount*powerOfTen(decimal)).toString()
  const isDecimal = !Number.isInteger(amount);
  if (isDecimal) { console.log('decimal :', isDecimal);
    const tokenDecimals:BigNumber = new BigNumber(10).pow(decimal);
    const tokenToSend:BigNumber = new BigNumber(10).times(tokenDecimals);
    // @ts-ignore: Object is possibly 'null'
    return tokenToSend.toString();
  } else {
    const amountData = Web3.utils
    // @ts-ignore: Object is possibly 'null'
      .toBN(amount).mul(Web3.utils.toBN(10).pow(Web3.utils.toBN(decimal)));
      return amountData.toString();
  }
}

export default {
    createWallet,
    createSystemWallet,
}