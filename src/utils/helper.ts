import { Decimal } from "@prisma/client/runtime";
import * as safeMath from '@dip1059/safe-math-js';
import BigNumber from "bignumber.js";
import Web3 from "web3";

export function setApp() {

}

export const powerOfTen = (x:number) => {
    return Math.pow(10,x);
}

export const customFromWei = (amount:any,decimal:any) => {
    return (amount/powerOfTen(decimal)).toString();
}

export const customToWei = (amount:number,decimal:number) =>
{
  const isDecimal = !Number.isInteger(amount);
  if (isDecimal) {
    const tokenDecimals = new BigNumber(10).pow(decimal);
    const tokenToSend = new BigNumber(amount).times(tokenDecimals);

    return tokenToSend.toString();
  } else {
    const amountData = Web3.utils
      .toBN(amount)
      .mul(Web3.utils.toBN(10).pow(Web3.utils.toBN(decimal)));
    
    return amountData.toString();
  }
}

export const convertCoinAmountToInt = (
    amount: Decimal | number,
    decimal: number,
  ): string => {
    let multiplier: any = '1';
    for (let i = 0; i < decimal; i++) {
      multiplier += '0';
    }
    const result = multiplyNumbers(Number(amount), Number(multiplier));
    return result.toString();
  }

export const convertCoinAmountFromInt = (
    amount: string | number,
    decimal: number,
  ): string => {
    let multiplier: any = '1';
    for (let i = 0; i < decimal; i++) {
      multiplier += '0';
    }
    const result = divideNumbers(Number(amount), Number(multiplier));
    return result.toString();
  }


  export const addNumbers = (...numbers: number[]): number  => {
    return safeMath.add(numbers);
  }
  
  export const minusNumbers =(...numbers: number[]): number => {
    return safeMath.minus(numbers);
  }
  
  export const multiplyNumbers = (...numbers: number[]): number => {
    return safeMath.multiply(numbers);
  }
  
  export const divideNumbers = (...numbers: number[]): number => {
    return safeMath.divide(numbers);
  }
  
  export const formatAmountDecimal = (amount: number, decimal: number): number  =>{
    return Number(amount.toFixed(decimal));
  }

  export const sleep = async (delay_in_milisec: number) => {
    await new Promise((resolve) => setTimeout(resolve, delay_in_milisec));
    return;
  }

  export enum REGEX {
    BTC_TXID = '^[a-fA-F0-9]{64}$',
    ETH_TXHASH = '^0x[a-fA-F0-9]{64}$',
  }